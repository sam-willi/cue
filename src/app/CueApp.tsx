"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_CONFIG, PACE_PRESETS, toApproxWpm, type CueConfig } from "@/lib/cue/config";
import type { Pace } from "@/lib/cue/pace";
import type { Correction, SessionFile } from "@/lib/cue/evaluate";
import { PATTERNS, patternFor, type CueKind, type CuePattern } from "@/lib/cue/patterns";
import { CueSession, type SessionUpdate } from "@/lib/cue/session";
import { simulateWords } from "@/lib/cue/simulate";
import type { CueDecision, LikeCheck, Word } from "@/lib/cue/types";
import { LiveTranscriber } from "@/lib/deepgram/liveTranscriber";
import { feedMessage, type DgMessage } from "@/lib/deepgram/parse";

const LABEL: Record<CueKind, string> = {
  filler_um: "“um”",
  filler_uh: "“uh”",
  filler_like: "filler “like”",
  rushing: "speaking fast",
  volume: "volume",
};

/** The legend's preview entries, one per rhythm. */
const LEGEND: { kind: CueKind; label: string }[] = [
  { kind: "filler_um", label: "Filler word" },
  { kind: "rushing", label: "Too fast" },
  { kind: "volume", label: "Volume (preview)" },
];

const WITHHELD: Record<NonNullable<CueDecision["withheldReason"]>, string> = {
  low_confidence: "not confident enough",
  cooldown: "too soon after the last cue",
  muted: "muted",
  category_off: "category off",
};

/** Converts between the speech engine's clock (s) and the page clock (performance.now(), ms). */
interface Clock {
  toPage: (t: number) => number | null;
  toAudio: (ms: number) => number | null;
}

const wordKey = (start: number) => Math.round(start * 100);

function percentile(xs: number[], p: number) {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

const EXAMPLES = [
  "I like went to the mall yesterday.",
  "I like tofu.",
  "So um, she was like, no way.",
  "There were like twenty people there.",
  "It looks like rain, and I feel like we should go.",
];

type Status = "idle" | "connecting" | "listening" | "demo" | "error";

export default function CueApp() {
  const [config, setConfig] = useState<CueConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pace, setPace] = useState<Pace | null>(null);
  const [log, setLog] = useState<CueDecision[]>([]);
  const [checks, setChecks] = useState<LikeCheck[]>([]);
  const [recorded, setRecorded] = useState(0);
  /** Measured delay (ms) from the end of a filler to its buzz, by event id. */
  const [latency, setLatency] = useState<Record<string, number>>({});
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [speakingSec, setSpeakingSec] = useState(0);
  const [words, setWords] = useState<Word[]>([]);
  const [buzz, setBuzz] = useState<{ n: number; label: string; pattern: CuePattern } | null>(null);
  const [showTranscript, setShowTranscript] = useState(true);
  const [demoText, setDemoText] = useState(EXAMPLES[0]);
  const [demoWpm, setDemoWpm] = useState(150);

  const sessionRef = useRef<CueSession>(new CueSession(DEFAULT_CONFIG));
  const transcriberRef = useRef<LiveTranscriber | null>(null);
  const timersRef = useRef<number[]>([]);
  /** Raw Deepgram messages from the last live session, for "Download session". */
  const rawRef = useRef<DgMessage[]>([]);
  const clockRef = useRef<Clock | null>(null);
  const buzzTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    sessionRef.current.config = config;
  }, [config]);

  const triggerBuzz = useCallback((kind: CueKind) => {
    const pattern = patternFor(kind, sessionRef.current.config.distinctCues);
    setBuzz((b) => ({ n: (b?.n ?? 0) + 1, label: LABEL[kind], pattern }));
    navigator.vibrate?.(PATTERNS[pattern].vibrate);
    window.clearTimeout(buzzTimer.current);
    buzzTimer.current = window.setTimeout(() => setBuzz(null), PATTERNS[pattern].durationMs + 600);
  }, []);

  const apply = useCallback(
    (u: SessionUpdate) => {
      if (u.pace !== null) setPace(u.pace);
      const hit = u.decisions.find((d) => d.delivered);
      if (hit) {
        triggerBuzz(hit.event.type);
        const endedAt = hit.event.type !== "rushing" ? clockRef.current?.toPage(hit.event.end) : null;
        if (endedAt != null) {
          const ms = Math.max(0, performance.now() - endedAt);
          setLatency((l) => ({ ...l, [hit.event.id]: ms }));
        }
      }
      if (u.decisions.length) setLog((l) => [...u.decisions.slice().reverse(), ...l].slice(0, 100));
      if (u.likeChecks.length) setChecks((c) => [...u.likeChecks.slice().reverse(), ...c].slice(0, 100));
      setWords(sessionRef.current.words);
      setSpeakingSec(sessionRef.current.speakingSeconds());
    },
    [triggerBuzz],
  );

  const reset = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    sessionRef.current = new CueSession(config);
    setLog([]);
    setChecks([]);
    setWords([]);
    setLatency({});
    setCorrections([]);
    setSpeakingSec(0);
    setPace(null);
    setError(null);
  }, [config]);

  const stopAll = useCallback(() => {
    transcriberRef.current?.stop();
    transcriberRef.current = null;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setStatus("idle");
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  const startLive = async () => {
    stopAll();
    reset();
    const t = new LiveTranscriber({
      onMessage: (msg) => {
        rawRef.current.push(msg);
        if (rawRef.current.length % 10 === 1) setRecorded(rawRef.current.length);
        const u = feedMessage(sessionRef.current, msg);
        if (u) apply(u);
      },
      onStatus: (s, detail) => {
        if (s === "stopped") return;
        setStatus(s === "error" ? "error" : s);
        if (detail) setError(detail);
      },
    });
    rawRef.current = [];
    setRecorded(0);
    clockRef.current = { toPage: (x) => t.audioToPageTime(x), toAudio: (ms) => t.pageToAudioTime(ms) };
    transcriberRef.current = t;
    await t.start();
  };

  const runDemo = (text = demoText) => {
    stopAll();
    reset();
    setStatus("demo");
    const demoStart = performance.now();
    clockRef.current = { toPage: (x) => demoStart + x * 1000, toAudio: (ms) => (ms - demoStart) / 1000 };
    const sim = simulateWords(text, { wpm: demoWpm });
    sim.forEach((w, k) => {
      timersRef.current.push(
        window.setTimeout(() => apply(sessionRef.current.ingest(sim.slice(0, k + 1), false)), w.end * 1000),
      );
    });
    const endAt = (sim.at(-1)?.end ?? 0) * 1000 + 400;
    timersRef.current.push(
      window.setTimeout(() => {
        apply(sessionRef.current.ingest(sim, true));
        apply(sessionRef.current.endUtterance());
        setStatus("idle");
      }, endAt),
    );
  };

  const busy = status === "listening" || status === "connecting" || status === "demo";

  /** Mark (or unmark) a word as a false buzz or a missed filler. */
  const toggleCorrection = (start: number, label: Correction["label"]) => {
    const word = words.find((w) => wordKey(w.start) === wordKey(start))?.norm ?? "";
    setCorrections((cs) =>
      cs.some((c) => wordKey(c.start) === wordKey(start))
        ? cs.filter((c) => wordKey(c.start) !== wordKey(start))
        : [...cs, { start, word, label }],
    );
  };

  const downloadSession = () => {
    const file: SessionFile = {
      version: 2,
      savedAt: new Date().toISOString(),
      config,
      messages: rawRef.current,
      corrections,
      latenciesMs: Object.values(latency),
    };
    const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cue-session-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const flagged = new Map(log.filter((d) => d.event.type !== "rushing").map((d) => [wordKey(d.event.start), d]));
  const checked = new Map(checks.map((c) => [wordKey(c.start), c]));
  const corrected = new Map(corrections.map((c) => [wordKey(c.start), c]));
  type Entry = { key: string; start: number; d?: CueDecision; c?: LikeCheck };
  const entries: Entry[] = [
    ...log.map((d) => ({ key: d.event.id, start: d.event.start, d })),
    ...checks.filter((c) => !c.counted).map((c) => ({ key: c.id, start: c.start, c })),
  ].sort((a, b) => b.start - a.start);

  // "This session" numbers.
  const fillerCues = log.filter((d) => d.delivered && d.event.type !== "rushing").length;
  const paceCues = log.filter((d) => d.delivered && d.event.type === "rushing").length;
  const lat = Object.values(latency);
  const p50 = percentile(lat, 0.5);
  const p90 = percentile(lat, 0.9);
  const falseBuzzes = corrections.filter((c) => c.label === "false_buzz").length;
  const misses = corrections.filter((c) => c.label === "missed").length;
  const speakingMin = speakingSec / 60;
  const sps = pace?.sps ?? 0;
  const paceFrac = Math.min(1, sps / (config.paceThreshold * 1.4));
  const presetLabel = config.paceMode === "custom" ? "Custom" : PACE_PRESETS[config.paceMode].label;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Cue<span className="text-accent">.</span>
          </h1>
          <p className="text-sm text-muted">Speak with intention.</p>
        </div>
        <StatusPill status={status} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* --- The cue --- */}
        <section className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <div className="flex flex-col items-center gap-6">
            <BuzzIndicator buzz={buzz} />
            <p className="relative z-10 h-5 text-center text-sm text-muted" aria-live="polite">
              {buzz ? (
                <>
                  <span className="font-medium text-cue">
                    {config.distinctCues ? PATTERNS[buzz.pattern].action : "Make space"}
                  </span>{" "}
                  · {buzz.label}
                </>
              ) : busy ? (
                "Listening for fillers and pace…"
              ) : (
                "Tap = make space. Pause, breathe, or slow down."
              )}
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              {status === "listening" || status === "connecting" ? (
                <button onClick={stopAll} className="rounded-full bg-text px-6 py-3 text-sm font-medium text-bg">
                  Stop
                </button>
              ) : (
                <button
                  onClick={startLive}
                  className="rounded-full bg-text px-6 py-3 text-sm font-medium text-bg disabled:opacity-50"
                  disabled={status === "demo"}
                >
                  Start listening
                </button>
              )}
              <button
                onClick={() => setConfig((c) => ({ ...c, muted: !c.muted }))}
                className="rounded-full border border-line px-5 py-3 text-sm"
                aria-pressed={config.muted}
              >
                {config.muted ? "Unmute cues" : "Mute cues"}
              </button>
            </div>
            {error && <p className="max-w-md text-center text-sm text-red-500">{error}</p>}

            {/* Cue language: what each rhythm means; click to preview */}
            <div className="w-full max-w-sm">
              <p className="mb-2 text-xs text-muted">Cue language · tap to preview</p>
              <div className="grid grid-cols-3 gap-2">
                {LEGEND.map(({ kind, label }) => {
                  const p = patternFor(kind, config.distinctCues);
                  return (
                    <button
                      key={kind}
                      onClick={() => triggerBuzz(kind)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border border-line px-2 py-2.5 text-xs hover:border-cue ${
                        buzz?.pattern === p && buzz.label === LABEL[kind] ? "cue-playing border-cue" : ""
                      }`}
                    >
                      <RhythmGlyph pattern={p} />
                      <span className="font-medium">{config.distinctCues ? PATTERNS[p].action : "Make space"}</span>
                      <span className="text-muted">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pace meter */}
            <div className="w-full max-w-sm">
              <div className="mb-1 flex justify-between text-xs text-muted">
                <span>Pace · {presetLabel}</span>
                <span className="font-mono">
                  {pace ? `${pace.sps.toFixed(1)} syl/s ≈${Math.round(pace.wpm)} wpm` : "—"} / limit{" "}
                  {config.paceThreshold.toFixed(1)}
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${paceFrac * 100}%`,
                    background: sps > config.paceThreshold ? "var(--cue)" : "var(--accent)",
                  }}
                />
                <div
                  className="absolute top-0 h-full w-0.5 bg-text/60"
                  style={{ left: `${(1 / 1.4) * 100}%` }}
                  title="limit"
                />
              </div>
            </div>
          </div>
        </section>

        {/* --- Try it without a mic --- */}
        <section className="rounded-3xl border border-line bg-surface p-6">
          <h2 className="mb-1 font-medium">Try a sentence</h2>
          <p className="mb-4 text-sm text-muted">Plays typed text through the same detector, word by word.</p>
          <textarea
            value={demoText}
            onChange={(e) => setDemoText(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-line bg-bg p-3 text-sm outline-none focus:border-accent"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setDemoText(ex);
                  runDemo(ex);
                }}
                className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted hover:text-text"
              >
                {ex}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <label className="flex flex-1 items-center gap-3 text-xs text-muted">
              <span className="whitespace-nowrap">Speak at {demoWpm} wpm</span>
              <input
                type="range"
                min={100}
                max={280}
                step={10}
                value={demoWpm}
                onChange={(e) => setDemoWpm(+e.target.value)}
                className="flex-1 accent-[var(--accent)]"
              />
            </label>
            <button
              onClick={() => runDemo()}
              disabled={status === "listening" || status === "connecting"}
              className="rounded-full border border-line px-4 py-2 text-sm disabled:opacity-50"
            >
              Play
            </button>
          </div>
        </section>

        {/* --- Transcript (dev aid) --- */}
        <section className="rounded-3xl border border-line bg-surface p-6 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-medium">Transcript</h2>
              <p className="text-xs text-muted">
                Click a word to mark a wrong buzz (strikethrough) or a filler Cue missed (outlined).
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={showTranscript} onChange={(e) => setShowTranscript(e.target.checked)} />
              Show (dev only)
            </label>
          </div>
          {showTranscript && (
            <p className="min-h-12 text-[15px] leading-8">
              {words.length === 0 && <span className="text-muted">Nothing yet.</span>}
              {words.map((w, k) => {
                const d = flagged.get(wordKey(w.start));
                const c = !d && w.norm === "like" ? checked.get(wordKey(w.start)) : undefined;
                const fix = corrected.get(wordKey(w.start));
                const base = d
                  ? d.delivered
                    ? "rounded bg-cue-soft px-1 text-cue"
                    : "rounded px-1 text-cue underline decoration-dotted"
                  : c
                    ? "underline decoration-muted decoration-dotted underline-offset-4"
                    : "";
                const marked = fix
                  ? fix.label === "false_buzz"
                    ? " line-through decoration-2"
                    : " ring-1 ring-ok rounded"
                  : "";
                const why = d
                  ? d.event.reason
                  : c
                    ? `Not a filler (${c.verdict.use}): ${c.verdict.reason}`
                    : "Click to mark as a missed filler";
                return (
                  <span key={k}>
                    <button
                      type="button"
                      onClick={() => toggleCorrection(w.start, d ? "false_buzz" : "missed")}
                      title={`${why}${fix ? " · marked (click to undo)" : d ? " · click if this wasn't a filler" : ""}`}
                      className={`cursor-pointer hover:bg-surface-2 ${base}${marked}`}
                    >
                      {w.text}
                    </button>{" "}
                  </span>
                );
              })}
            </p>
          )}
        </section>

        {/* --- This session --- */}
        <section className="rounded-3xl border border-line bg-surface p-6 lg:col-span-2">
          <h2 className="mb-4 font-medium">This session</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
            <Stat
              label="Speaking"
              value={speakingMin >= 1 ? `${speakingMin.toFixed(1)} min` : `${Math.round(speakingMin * 60)} s`}
            />
            <Stat label="Cues" value={`${fillerCues}${paceCues ? ` + ${paceCues} pace` : ""}`} />
            <Stat
              label="Cue delay"
              value={p50 == null ? "—" : `${(p50 / 1000).toFixed(2)}s`}
              hint={p90 == null ? "typical, after the filler" : `typical · slowest ${(p90 / 1000).toFixed(2)}s`}
            />
            <Stat label="Marked wrong buzz" value={String(falseBuzzes)} />
            <Stat label="Marked missed" value={String(misses)} />
          </dl>
        </section>

        {/* --- Event log --- */}
        <section className="rounded-3xl border border-line bg-surface p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-medium">Why Cue acted</h2>
            {recorded > 0 && !busy && (
              <button
                onClick={downloadSession}
                className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-text"
                title="Saves what Deepgram heard (words and timings, no audio) so misses can be replayed and fixed"
              >
                Download session
              </button>
            )}
          </div>
          {entries.length === 0 ? (
            <p className="text-sm text-muted">
              Detections appear here with the reason, including ones Cue chose not to cue and every “like” it judged to
              be meaningful.
            </p>
          ) : (
            <ul className="space-y-3">
              {entries.map(({ key, d, c }) =>
                c ? (
                  <li key={key} className="border-b border-line pb-3 text-sm last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-muted">“like” · {c.verdict.use}</span>
                      <span className="text-xs text-muted">not a filler</span>
                    </div>
                    <p className="mt-1 text-muted">{c.verdict.reason}</p>
                    <p className="mt-1 font-mono text-xs text-muted">“…{c.context}…”</p>
                    <CorrectionButton
                      on={corrected.get(wordKey(c.start))?.label === "missed"}
                      onClick={() => toggleCorrection(c.start, "missed")}
                    >
                      It was a filler
                    </CorrectionButton>
                  </li>
                ) : d ? (
                  <li key={key} className="border-b border-line pb-3 text-sm last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{LABEL[d.event.type]}</span>
                      <span className={`text-xs ${d.delivered ? "text-cue" : "text-muted"}`}>
                        {d.delivered ? "cued" : `held · ${WITHHELD[d.withheldReason!]}`}
                      </span>
                    </div>
                    <p className="mt-1 text-muted">{d.event.reason}</p>
                    <p className="mt-1 font-mono text-xs text-muted">
                      “…{d.event.context}…” · {Math.round(d.event.confidence * 100)}%
                      {latency[d.event.id] != null && ` · ${(latency[d.event.id] / 1000).toFixed(2)}s after`}
                    </p>
                    {d.event.type !== "rushing" && (
                      <CorrectionButton
                        on={corrected.get(wordKey(d.event.start))?.label === "false_buzz"}
                        onClick={() => toggleCorrection(d.event.start, "false_buzz")}
                      >
                        Not a filler
                      </CorrectionButton>
                    )}
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </section>

        {/* --- Settings --- */}
        <section className="rounded-3xl border border-line bg-surface p-6">
          <h2 className="mb-4 font-medium">Settings</h2>
          <div className="space-y-4 text-sm">
            <fieldset>
              <legend className="mb-2 text-xs uppercase tracking-wide text-muted">Cue me for</legend>
              <div className="flex flex-wrap gap-2">
                {(["um", "uh", "like", "rushing"] as const).map((k) => (
                  <Chip
                    key={k}
                    on={config.categories[k]}
                    onClick={() =>
                      setConfig((c) => ({
                        ...c,
                        categories: { ...c.categories, [k]: !c.categories[k] },
                      }))
                    }
                  >
                    {k === "rushing" ? "speaking fast" : `“${k}”`}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <Toggle
              label="Different cue for each alert"
              hint="Off: one tap for everything (“make space”)"
              on={config.distinctCues}
              onChange={(v) => setConfig((c) => ({ ...c, distinctCues: v }))}
            />
            <Toggle
              label="Count quote “like”"
              hint="“she was like, no way”"
              on={config.likeCounts.quotative}
              onChange={(v) =>
                setConfig((c) => ({
                  ...c,
                  likeCounts: { ...c.likeCounts, quotative: v },
                }))
              }
            />
            <Toggle
              label="Count “about” “like”"
              hint="“like twenty people”"
              on={config.likeCounts.approximator}
              onChange={(v) =>
                setConfig((c) => ({
                  ...c,
                  likeCounts: { ...c.likeCounts, approximator: v },
                }))
              }
            />
            <fieldset>
              <legend className="mb-2 text-xs uppercase tracking-wide text-muted">Pace preset</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PACE_PRESETS) as (keyof typeof PACE_PRESETS)[]).map((k) => (
                  <Chip
                    key={k}
                    on={config.paceMode === k}
                    onClick={() =>
                      setConfig((c) => ({
                        ...c,
                        paceMode: k,
                        paceThreshold: PACE_PRESETS[k].threshold,
                      }))
                    }
                  >
                    {PACE_PRESETS[k].label}
                  </Chip>
                ))}
                {config.paceMode === "custom" && (
                  <Chip on onClick={() => {}}>
                    Custom
                  </Chip>
                )}
              </div>
            </fieldset>
            <Slider
              label="Too fast above"
              value={config.paceThreshold}
              min={3}
              max={6.5}
              step={0.1}
              format={(v) => `${v.toFixed(1)} syl/s ≈${toApproxWpm(v)} wpm`}
              onChange={(v) => {
                const preset = (Object.keys(PACE_PRESETS) as (keyof typeof PACE_PRESETS)[]).find(
                  (k) => Math.abs(PACE_PRESETS[k].threshold - v) < 0.01,
                );
                setConfig((c) => ({
                  ...c,
                  paceThreshold: v,
                  paceMode: preset ?? "custom",
                }));
              }}
            />
            <Slider
              label="Sensitivity"
              value={Math.round((1 - config.minConfidence) * 100)}
              min={5}
              max={35}
              step={5}
              format={(v) => (v <= 10 ? "cautious" : v <= 25 ? "balanced" : "eager")}
              onChange={(v) => setConfig((c) => ({ ...c, minConfidence: 1 - v / 100 }))}
            />
            <Slider
              label="Quiet time between cues"
              value={config.cooldownSec}
              min={0.5}
              max={10}
              step={0.5}
              format={(v) => `${v}s`}
              onChange={(v) => setConfig((c) => ({ ...c, cooldownSec: v }))}
            />
          </div>
        </section>
      </div>

      <p className="mt-8 text-center text-xs text-muted">
        Prototype. Live mode streams mic audio to Deepgram for transcription; nothing is stored by Cue.
      </p>
    </main>
  );
}

function BuzzIndicator({ buzz }: { buzz: { n: number; label: string; pattern: CuePattern } | null }) {
  return (
    <div
      key={buzz?.n ?? 0}
      data-pattern={buzz?.pattern}
      className={`relative grid h-44 w-44 place-items-center ${buzz ? "cue-buzzing" : ""}`}
      role="img"
      aria-label={buzz ? `Haptic cue: ${PATTERNS[buzz.pattern].name}, ${buzz.label}` : "Haptic cue idle"}
    >
      <div className="pointer-events-none absolute inset-0">
        {[0, 1].map((k) => (
          <span key={k} className="cue-ring absolute inset-0 rounded-full border-2 border-cue opacity-0" />
        ))}
      </div>
      <div
        className={`cue-core grid h-28 w-28 place-items-center rounded-full border transition-colors duration-300 ${
          buzz ? "border-cue bg-cue-soft text-cue" : "border-line bg-surface-2 text-muted"
        }`}
      >
        {/* Vibration glyph: a device with motion lines */}
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
          <rect x="20" y="12" width="16" height="32" rx="4" stroke="currentColor" strokeWidth="2.5" />
          <path d="M13 20v16M8 24v8M43 20v16M48 24v8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

/** A pattern's rhythm drawn as beats: ▮ / ▮ ▮ / ▬. */
function RhythmGlyph({ pattern }: { pattern: CuePattern }) {
  const beats = pattern === "double" ? ["w-1.5", "w-1.5"] : pattern === "long" ? ["w-6"] : ["w-1.5"];
  return (
    <span className="flex h-3 items-center gap-1" aria-hidden>
      {beats.map((w, k) => (
        <span key={k} className={`beat h-3 ${w} rounded-sm bg-cue opacity-35`} />
      ))}
    </span>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "ok" }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-1 text-xl font-medium tabular-nums ${tone === "ok" ? "text-ok" : ""}`}>{value}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  );
}

function CorrectionButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`mt-2 rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-text bg-surface-2 text-text" : "border-line text-muted hover:text-text"}`}
    >
      {on ? `✓ ${children}` : children}
    </button>
  );
}

function StatusPill({ status }: { status: Status }) {
  const text = {
    idle: "Idle",
    connecting: "Connecting…",
    listening: "Listening",
    demo: "Playing demo",
    error: "Error",
  }[status];
  const live = status === "listening";
  return (
    <span className="flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-muted">
      <span
        className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-ok" : status === "error" ? "bg-red-500" : "bg-line"}`}
      />
      {text}
    </span>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-3 py-1 text-xs ${on ? "border-accent bg-accent-soft text-text" : "border-line text-muted"}`}
    >
      {children}
    </button>
  );
}

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span>
        {label}
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--accent)]"
      />
    </label>
  );
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex justify-between">
        {props.label}
        <span className="font-mono text-xs text-muted">{props.format(props.value)}</span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(+e.target.value)}
        className="mt-1 w-full accent-[var(--accent)]"
      />
    </label>
  );
}
