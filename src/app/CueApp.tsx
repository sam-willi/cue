"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_CONFIG, PACE_PRESETS, toApproxWpm, type CueConfig } from "@/lib/cue/config";
import type { Pace } from "@/lib/cue/pace";
import type { Correction, SessionFile } from "@/lib/cue/evaluate";
import { CONFIRMS, PATTERNS, patternFor, type ConfirmPattern, type CueKind, type CuePattern } from "@/lib/cue/patterns";
import { DOUBLE_TAP_GAP_MS, LONG_PRESS_MS, TAP_MAX_MS, TouchGestures, type TouchAction } from "@/lib/cue/touch";
import { CueSession, type SessionUpdate, type VolumeStatus } from "@/lib/cue/session";
import { simulateWords } from "@/lib/cue/simulate";
import type { CueDecision, LikeCheck, Word } from "@/lib/cue/types";
import { LiveTranscriber } from "@/lib/deepgram/liveTranscriber";
import { feedMessage, type DgMessage } from "@/lib/deepgram/parse";

const LABEL: Record<CueKind, string> = {
  filler_um: "“um”",
  filler_uh: "“uh”",
  filler_like: "filler “like”",
  rushing: "speaking fast",
  too_quiet: "speaking quietly",
};

/** The legend's preview entries, one per rhythm. */
const LEGEND: { kind: CueKind; label: string }[] = [
  { kind: "filler_um", label: "Filler word" },
  { kind: "rushing", label: "Too fast" },
  { kind: "too_quiet", label: "Too quiet" },
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

/** Filler cues point at a word; pace and volume cues describe a stretch of speech. */
const isFiller = (d: CueDecision) => d.event.type.startsWith("filler_");

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
  "So we spent the whole weekend planning the launch, and honestly it went better than expected. The team pulled together, we fixed the last bugs on Saturday, and by Sunday night everything was ready to ship to our first customers.",
];

type Status = "idle" | "connecting" | "listening" | "demo" | "error";

export default function CueApp() {
  const [config, setConfig] = useState<CueConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pace, setPace] = useState<Pace | null>(null);
  const [volume, setVolume] = useState<VolumeStatus | null>(null);
  const [demoQuiet, setDemoQuiet] = useState(false);
  const [demoOther, setDemoOther] = useState(false);
  const [log, setLog] = useState<CueDecision[]>([]);
  const [checks, setChecks] = useState<LikeCheck[]>([]);
  const [recorded, setRecorded] = useState(0);
  /** Measured delay (ms) from the end of a filler to its buzz, by event id. */
  const [latency, setLatency] = useState<Record<string, number>>({});
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [speakingSec, setSpeakingSec] = useState(0);
  const [words, setWords] = useState<(Word & { wearer: boolean })[]>([]);
  const [buzz, setBuzz] = useState<{ n: number; label: string; pattern: CuePattern } | null>(null);
  const [confirm, setConfirm] = useState<{ n: number; pattern: ConfirmPattern } | null>(null);
  /** Live transcript is a testing aid only; the product never needs the screen mid-conversation. */
  const [showTranscript, setShowTranscript] = useState(false);
  const [open, setOpen] = useState({ review: false, practice: false, settings: false });
  const toggle = (k: keyof typeof open) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const [demoText, setDemoText] = useState(EXAMPLES[0]);
  const [demoWpm, setDemoWpm] = useState(150);

  const sessionRef = useRef<CueSession>(new CueSession(DEFAULT_CONFIG));
  const transcriberRef = useRef<LiveTranscriber | null>(null);
  const timersRef = useRef<number[]>([]);
  /** Raw Deepgram messages from the last live session, for "Download session". */
  const rawRef = useRef<DgMessage[]>([]);
  /** Mic level frames [audio time s, dBFS] from the last live session. */
  const levelsRef = useRef<[number, number][]>([]);
  const clockRef = useRef<Clock | null>(null);
  const buzzTimer = useRef<number | undefined>(undefined);

  const configRef = useRef(config);
  useEffect(() => {
    sessionRef.current.config = config;
    configRef.current = config;
  }, [config]);

  /** Play a touch-control confirmation (a ramp, never a coaching tap). */
  const playConfirm = useCallback((pattern: ConfirmPattern) => {
    setBuzz(null);
    setConfirm((c) => ({ n: (c?.n ?? 0) + 1, pattern }));
    navigator.vibrate?.(CONFIRMS[pattern].vibrate);
    window.clearTimeout(buzzTimer.current);
    buzzTimer.current = window.setTimeout(() => setConfirm(null), CONFIRMS[pattern].durationMs + 600);
  }, []);

  /** A cuff touch gesture: long press = Cue on/off, double tap = switch mode. */
  const onTouch = useCallback(
    (action: TouchAction) => {
      const c = configRef.current;
      if (action === "toggle_on") {
        setConfig((x) => ({ ...x, muted: !c.muted }));
        playConfirm(c.muted ? "ramp_up" : "ramp_down");
      } else {
        const next = c.paceMode === "presentation" ? "conversation" : "presentation";
        setConfig((x) => ({ ...x, paceMode: next, paceThreshold: PACE_PRESETS[next].threshold }));
        playConfirm(next === "presentation" ? "ramp_twice" : "ramp_once");
      }
    },
    [playConfirm],
  );

  const triggerBuzz = useCallback((kind: CueKind) => {
    const pattern = patternFor(kind, sessionRef.current.config.distinctCues);
    setConfirm(null);
    setBuzz((b) => ({ n: (b?.n ?? 0) + 1, label: LABEL[kind], pattern }));
    navigator.vibrate?.(PATTERNS[pattern].vibrate);
    window.clearTimeout(buzzTimer.current);
    buzzTimer.current = window.setTimeout(() => setBuzz(null), PATTERNS[pattern].durationMs + 600);
  }, []);

  const apply = useCallback(
    (u: SessionUpdate) => {
      if (u.pace !== null) setPace(u.pace);
      if (u.volume !== null) setVolume(u.volume);
      const hit = u.decisions.find((d) => d.delivered);
      if (hit) {
        triggerBuzz(hit.event.type);
        const endedAt = isFiller(hit) ? clockRef.current?.toPage(hit.event.end) : null;
        if (endedAt != null) {
          const ms = Math.max(0, performance.now() - endedAt);
          setLatency((l) => ({ ...l, [hit.event.id]: ms }));
        }
      }
      if (u.decisions.length) setLog((l) => [...u.decisions.slice().reverse(), ...l].slice(0, 100));
      if (u.likeChecks.length) setChecks((c) => [...u.likeChecks.slice().reverse(), ...c].slice(0, 100));
      setWords(sessionRef.current.annotatedWords());
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
    setVolume(null);
    levelsRef.current = [];
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
      onLevel: (t, db) => {
        levelsRef.current.push([t, db]);
        sessionRef.current.ingestLevel(t, db);
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
    // The wearer is speaker 0. With "another speaker", a friend (speaker 1, further from
    // the mic, so quieter) cuts in about halfway with fillers Cue should ignore.
    let sim: Word[] = simulateWords(text, { wpm: demoWpm }).map((w) => ({ ...w, speaker: 0 }));
    if (demoOther && sim.length > 6) {
      const cut = sim[Math.floor(sim.length * 0.7)].start;
      const friend = simulateWords("Um, yeah, I like went there too.", { wpm: 170, startAt: cut + 0.5 }).map((w) => ({
        ...w,
        speaker: 1,
      }));
      const resume = friend.at(-1)!.end + 0.8 - cut;
      sim = [
        ...sim.filter((w) => w.start < cut),
        ...friend,
        ...sim.filter((w) => w.start >= cut).map((w) => ({ ...w, start: w.start + resume, end: w.end + resume })),
      ];
    }
    // Simulated mic level: the wearer at −20 dBFS (optionally trailing off to −32 for the
    // last 45%), the friend at −32, a quiet room at −60. The demo learns "normal" from its
    // first ~30% instead of 15 s.
    const total = sim.at(-1)?.end ?? 0;
    sessionRef.current.config = { ...config, calibrationSec: Math.min(config.calibrationSec, total * 0.3) };
    for (let t = 0; t <= total; t += 0.05) {
      const w = sim.find((x) => t >= x.start && t <= x.end);
      const db = !w ? -60 : w.speaker === 1 ? -32 : demoQuiet && t > total * 0.55 ? -32 : -20;
      sessionRef.current.ingestLevel(t, db);
    }
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
        setOpen((o) => ({ ...o, review: true }));
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
      levels: levelsRef.current,
      latenciesMs: Object.values(latency),
    };
    const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cue-session-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const flagged = new Map(log.filter(isFiller).map((d) => [wordKey(d.event.start), d]));
  const checked = new Map(checks.map((c) => [wordKey(c.start), c]));
  const corrected = new Map(corrections.map((c) => [wordKey(c.start), c]));
  type Entry = { key: string; start: number; d?: CueDecision; c?: LikeCheck };
  const entries: Entry[] = [
    ...log.map((d) => ({ key: d.event.id, start: d.event.start, d })),
    ...checks.filter((c) => !c.counted).map((c) => ({ key: c.id, start: c.start, c })),
  ].sort((a, b) => b.start - a.start);

  // "This session" numbers.
  const fillerCues = log.filter((d) => d.delivered && isFiller(d)).length;
  const paceCues = log.filter((d) => d.delivered && d.event.type === "rushing").length;
  const quietCues = log.filter((d) => d.delivered && d.event.type === "too_quiet").length;
  const lat = Object.values(latency);
  const p50 = percentile(lat, 0.5);
  const p90 = percentile(lat, 0.9);
  const falseBuzzes = corrections.filter((c) => c.label === "false_buzz").length;
  const misses = corrections.filter((c) => c.label === "missed").length;
  const speakingMin = speakingSec / 60;
  const sps = pace?.sps ?? 0;
  const paceFrac = Math.min(1, sps / (config.paceThreshold * 1.4));
  const presetLabel = config.paceMode === "custom" ? "Custom" : PACE_PRESETS[config.paceMode].label;

  const live = status === "listening" || status === "connecting";
  const calibrating = status === "listening" && config.onlyWearer && volume?.expectedDb == null;
  const endSession = () => {
    stopAll();
    if (words.length) setOpen((o) => ({ ...o, review: true }));
  };

  // The hero is the cue itself: one word that says what Cue is telling you right now.
  const heroWord = confirm
    ? `${CONFIRMS[confirm.pattern].label}.`
    : buzz
      ? `${config.distinctCues ? PATTERNS[buzz.pattern].action : "Make space"}.`
      : status === "connecting"
        ? "Connecting…"
        : status === "error"
          ? "Couldn't start."
          : config.muted
            ? "Cue is off."
            : status === "demo"
              ? "Practicing."
              : calibrating
                ? "Learning your voice."
                : status === "listening"
                  ? "Listening."
                  : "Ready when you are.";
  const heroLine = buzz
    ? capitalize(buzz.label)
    : confirm
      ? ""
      : status === "error"
        ? (error ?? "")
        : config.muted
          ? "Long-press the cuff, or switch Cue on below."
          : calibrating
            ? "Talk on your own for a few seconds so Cue knows which voice is yours."
            : live
              ? "Talk naturally. You don't need to watch this screen."
              : status === "demo"
                ? "Playing your practice sentence."
                : "Cue listens while you talk and taps when you need to pause, slow down, or speak up.";

  const totalCues = fillerCues + paceCues + quietCues;
  const reviewSummary = words.length
    ? `${speakingMin >= 1 ? `${speakingMin.toFixed(1)} min` : `${Math.round(speakingSec)} s`} of speaking, ${totalCues} ${totalCues === 1 ? "cue" : "cues"}`
    : "Nothing yet. Start listening or play a practice sentence.";

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-24 pt-8 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-display text-lg font-semibold tracking-tight">Cue</h1>
        <MicState status={status} />
      </header>

      {/* --- Live: the one thing on screen while you talk --- */}
      <section aria-label="Live coaching" className="flex flex-col items-center pt-14 text-center sm:pt-20">
        <CueRings buzz={buzz} confirm={confirm} />
        <p
          className="mt-10 font-display text-[clamp(2.25rem,7vw,3.75rem)] font-semibold leading-[1.05] tracking-tight"
          aria-live="polite"
        >
          {heroWord}
        </p>
        <p className="mt-4 min-h-12 max-w-md text-[15px] leading-6 text-muted">{heroLine}</p>

        <div className="mt-8 flex flex-col items-center gap-3">
          {live ? (
            <button onClick={endSession} className="min-h-12 rounded-lg bg-text px-8 text-[15px] font-medium text-bg">
              Stop
            </button>
          ) : status === "demo" ? (
            <button onClick={endSession} className="min-h-12 rounded-lg bg-text px-8 text-[15px] font-medium text-bg">
              Stop practice
            </button>
          ) : (
            <button onClick={startLive} className="min-h-12 rounded-lg bg-text px-8 text-[15px] font-medium text-bg">
              Start listening
            </button>
          )}
          <p className="max-w-md text-[13px] text-muted">
            {status === "demo"
              ? "Practice doesn't use the microphone."
              : "Your audio goes to Deepgram to be transcribed. Cue doesn't store it."}
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
          <Segmented
            label="Mode"
            value={config.paceMode === "custom" ? null : config.paceMode}
            options={[
              { value: "conversation", label: "Conversation" },
              { value: "presentation", label: "Presentation" },
            ]}
            onChange={(v) =>
              setConfig((c) => ({
                ...c,
                paceMode: v,
                paceThreshold: PACE_PRESETS[v as keyof typeof PACE_PRESETS].threshold,
              }))
            }
          />
          <Switch label="Cue on" on={!config.muted} onChange={(v) => setConfig((c) => ({ ...c, muted: !v }))} />
          <Switch label="Live transcript (testing)" on={showTranscript} onChange={setShowTranscript} />
        </div>

        {/* What each tap means */}
        <div className="mt-12 w-full">
          <p className="text-[13px] text-muted">What each tap means. Select one to feel it.</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {LEGEND.map(({ kind, label }) => {
              const p = patternFor(kind, config.distinctCues);
              return (
                <button
                  key={kind}
                  onClick={() => triggerBuzz(kind)}
                  className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border px-2 py-3 text-[13px] transition-colors duration-200 hover:border-cue ${
                    buzz?.pattern === p && buzz.label === LABEL[kind] ? "cue-playing border-cue" : "border-line"
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

        {(live || status === "demo" || pace || volume) && (
          <div className="mt-10 grid w-full gap-5 text-left sm:grid-cols-2">
            <Meter
              label="Pace"
              value={
                pace
                  ? `${pace.sps.toFixed(1)} syllables/s, about ${Math.round(pace.wpm)} wpm`
                  : "Measuring after a few words"
              }
              frac={paceFrac}
              mark={1 / 1.4}
              alert={sps > config.paceThreshold}
            />
            <Meter
              label="Volume"
              value={
                !volume
                  ? "Measuring once you speak"
                  : volume.baselineDb === null || volume.expectedDb === null
                    ? `Learning your normal level, ${Math.round(volume.calibration * 100)}%`
                    : volume.db === null
                      ? "Normal level learned"
                      : `${formatDb(volume.db - volume.expectedDb)} from your normal${
                          Math.abs(volume.expectedDb - volume.baselineDb) >= 3
                            ? volume.expectedDb > volume.baselineDb
                              ? " for this noisy room"
                              : " for this quiet room"
                            : ""
                        }`
              }
              frac={
                volume?.expectedDb != null && volume.db !== null
                  ? Math.max(0, Math.min(1, (volume.db - volume.expectedDb + 20) / 27))
                  : (volume?.calibration ?? 0)
              }
              mark={volume?.expectedDb != null ? (20 - config.quietDropDb) / 27 : undefined}
              alert={
                volume?.expectedDb != null && volume.db !== null && volume.db < volume.expectedDb - config.quietDropDb
              }
              learning={volume?.expectedDb == null}
            />
          </div>
        )}

        {showTranscript && (
          <div className="mt-10 w-full rounded-lg border border-dashed border-line p-4 text-left">
            <p className="text-[13px] text-muted">Live transcript, for testing the detector</p>
            <p className="mt-2 text-[15px] leading-7">
              {words.length === 0 && <span className="text-muted">Words appear here as Deepgram hears them.</span>}
              {words.map((w, k) => {
                const d = flagged.get(wordKey(w.start));
                return (
                  <span
                    key={k}
                    className={
                      !w.wearer
                        ? "italic text-muted/70"
                        : d
                          ? d.delivered
                            ? "rounded bg-cue-soft px-1 text-cue"
                            : "text-cue underline decoration-dotted"
                          : undefined
                    }
                  >
                    {w.text}{" "}
                  </span>
                );
              })}
            </p>
          </div>
        )}
      </section>

      {/* --- Everything else waits below, collapsed --- */}
      <div className="mt-20 border-t border-line">
        <Disclosure
          title="Review last session"
          summary={reviewSummary}
          open={open.review}
          onToggle={() => toggle("review")}
        >
          {words.length === 0 ? (
            <p className="text-[15px] text-muted">
              After you stop, this shows what Cue noticed, why it acted, and a transcript you can correct.
            </p>
          ) : (
            <div className="space-y-12">
              <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <Stat
                  label="Speaking"
                  value={speakingMin >= 1 ? `${speakingMin.toFixed(1)} min` : `${Math.round(speakingSec)} s`}
                />
                <Stat
                  label="Cues"
                  value={String(totalCues)}
                  hint={`${fillerCues} filler, ${paceCues} pace, ${quietCues} quiet`}
                />
                <Stat
                  label="Cue delay"
                  value={p50 == null ? "None yet" : `${(p50 / 1000).toFixed(2)} s`}
                  hint={p90 == null ? "after the filler ends" : `slowest ${(p90 / 1000).toFixed(2)} s`}
                />
                <Stat
                  label="You marked"
                  value={`${falseBuzzes + misses}`}
                  hint={`${falseBuzzes} wrong, ${misses} missed`}
                />
              </dl>

              <div>
                <h3 className="font-display text-base font-semibold">Transcript</h3>
                <p className="mt-1 text-[13px] text-muted">
                  Select a word to mark a wrong cue or a filler Cue missed. Hover a marked word for the reason.
                </p>
                <TranscriptKey />
                <p className="mt-4 text-[15px] leading-8">
                  {words.map((w, k) => {
                    if (!w.wearer)
                      return (
                        <span
                          key={k}
                          className="italic text-muted/70"
                          title="Someone else talking. Cue doesn't coach other people."
                        >
                          {w.text}{" "}
                        </span>
                      );
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
                        : " rounded ring-1 ring-text"
                      : "";
                    const why = d
                      ? d.event.reason
                      : c
                        ? `Not a filler (${c.verdict.use}): ${c.verdict.reason}`
                        : "Select to mark as a missed filler";
                    return (
                      <span key={k}>
                        <button
                          type="button"
                          onClick={() => toggleCorrection(w.start, d ? "false_buzz" : "missed")}
                          title={`${why}${fix ? ". Marked, select to undo" : d ? ". Select if this wasn't a filler" : ""}`}
                          className={`cursor-pointer rounded hover:bg-surface-2 ${base}${marked}`}
                        >
                          {w.text}
                        </button>{" "}
                      </span>
                    );
                  })}
                </p>
              </div>

              <div>
                <h3 className="font-display text-base font-semibold">Why Cue acted</h3>
                <ul className="mt-4 divide-y divide-line">
                  {entries.map(({ key, d, c }) =>
                    c ? (
                      <li key={key} className="py-4 text-[15px]">
                        <p className="font-medium">
                          “like” wasn&apos;t a filler <span className="font-normal text-muted">({c.verdict.use})</span>
                        </p>
                        <p className="mt-1 text-muted">{c.verdict.reason}</p>
                        <p className="mt-1 text-[13px] text-muted">“…{c.context}…”</p>
                        <CorrectionButton
                          on={corrected.get(wordKey(c.start))?.label === "missed"}
                          onClick={() => toggleCorrection(c.start, "missed")}
                        >
                          It was a filler
                        </CorrectionButton>
                      </li>
                    ) : d ? (
                      <li key={key} className="py-4 text-[15px]">
                        <p className="font-medium">
                          {capitalize(LABEL[d.event.type])}{" "}
                          <span className={`font-normal ${d.delivered ? "text-cue" : "text-muted"}`}>
                            {d.delivered ? "cued" : `held back: ${WITHHELD[d.withheldReason!]}`}
                          </span>
                        </p>
                        <p className="mt-1 text-muted">{d.event.reason}</p>
                        <p className="mt-1 text-[13px] text-muted">
                          “…{d.event.context}…” {Math.round(d.event.confidence * 100)}% sure
                          {latency[d.event.id] != null && `, cued ${(latency[d.event.id] / 1000).toFixed(2)} s after`}
                        </p>
                        {isFiller(d) && (
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
              </div>

              {recorded > 0 && !busy && (
                <div>
                  <button
                    onClick={downloadSession}
                    className="min-h-11 rounded-lg border border-line px-4 text-[15px] hover:border-text"
                  >
                    Download session
                  </button>
                  <p className="mt-2 text-[13px] text-muted">
                    Saves what Deepgram heard, your marks, and cue timing. No audio. Keep it out of the repo.
                  </p>
                </div>
              )}
            </div>
          )}
        </Disclosure>

        <Disclosure
          title="Practice"
          summary="Try a sentence without a mic, or try the cuff's touch controls"
          open={open.practice}
          onToggle={() => toggle("practice")}
        >
          <div className="space-y-12">
            <div>
              <h3 className="font-display text-base font-semibold">Try a sentence</h3>
              <p className="mt-1 text-[13px] text-muted">Cue reads it word by word, as if you were saying it.</p>
              <textarea
                value={demoText}
                onChange={(e) => setDemoText(e.target.value)}
                rows={3}
                aria-label="Practice sentence"
                className="mt-4 w-full resize-none rounded-lg border border-line bg-surface p-3 text-[15px] leading-6 outline-none focus:border-cue"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => {
                      setDemoText(ex);
                      setOpen((o) => ({ ...o, practice: true }));
                      runDemo(ex);
                    }}
                    className="min-h-9 max-w-full truncate rounded-lg border border-line px-3 text-left text-[13px] text-muted hover:border-text hover:text-text"
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <div className="mt-6 space-y-4">
                <Slider
                  label="Speaking speed"
                  value={demoWpm}
                  min={100}
                  max={280}
                  step={10}
                  format={(v) => `${v} wpm`}
                  onChange={setDemoWpm}
                />
                <Switch label="Trail off quietly at the end" on={demoQuiet} onChange={setDemoQuiet} />
                <Switch label="Add a friend cutting in with “um… like went”" on={demoOther} onChange={setDemoOther} />
              </div>
              <button
                onClick={() => runDemo()}
                disabled={live}
                className="mt-6 min-h-11 rounded-lg bg-text px-6 text-[15px] font-medium text-bg disabled:opacity-40"
              >
                Play sentence
              </button>
            </div>

            <div>
              <h3 className="font-display text-base font-semibold">Try the cuff&apos;s touch controls</h3>
              <p className="mt-1 text-[13px] text-muted">
                On the cuff, touch is only for controls. A single tap does nothing, so fixing your hair won&apos;t
                trigger it.
              </p>
              <div className="mt-4">
                <CuffTouchPad onAction={onTouch} mode={presetLabel} on={!config.muted} />
              </div>
            </div>
          </div>
        </Disclosure>

        <Disclosure
          title="Settings"
          summary={`${presetLabel} mode, ${config.distinctCues ? "three taps" : "one tap for everything"}, ${config.onlyWearer ? "your voice only" : "everyone's voice"}`}
          open={open.settings}
          onToggle={() => toggle("settings")}
        >
          <div className="space-y-10 text-[15px]">
            <fieldset>
              <legend className="font-display text-base font-semibold">What Cue coaches</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["um", "uh", "like", "rushing", "quiet"] as const).map((k) => (
                  <Chip
                    key={k}
                    on={config.categories[k]}
                    onClick={() => setConfig((c) => ({ ...c, categories: { ...c.categories, [k]: !c.categories[k] } }))}
                  >
                    {k === "rushing" ? "Speaking fast" : k === "quiet" ? "Speaking quietly" : `“${k}”`}
                  </Chip>
                ))}
              </div>
            </fieldset>

            <div className="space-y-4">
              <h3 className="font-display text-base font-semibold">How Cue taps</h3>
              <Switch
                label="A different tap for each kind of cue"
                hint="Off: one tap for everything, meaning make space."
                on={config.distinctCues}
                onChange={(v) => setConfig((c) => ({ ...c, distinctCues: v }))}
              />
              <Switch
                label="Only coach my voice"
                hint="Cue learns your voice in the first 15 seconds, so talk on your own then."
                on={config.onlyWearer}
                onChange={(v) => setConfig((c) => ({ ...c, onlyWearer: v }))}
              />
            </div>

            <div className="space-y-4">
              <h3 className="font-display text-base font-semibold">Filler “like”</h3>
              <Switch
                label="Count quoting “like”"
                hint="“She was like, no way”"
                on={config.likeCounts.quotative}
                onChange={(v) => setConfig((c) => ({ ...c, likeCounts: { ...c.likeCounts, quotative: v } }))}
              />
              <Switch
                label="Count “like” meaning “about”"
                hint="“Like twenty people”"
                on={config.likeCounts.approximator}
                onChange={(v) => setConfig((c) => ({ ...c, likeCounts: { ...c.likeCounts, approximator: v } }))}
              />
            </div>

            <div className="space-y-5">
              <h3 className="font-display text-base font-semibold">Thresholds</h3>
              <Slider
                label="Too fast above"
                value={config.paceThreshold}
                min={3}
                max={6.5}
                step={0.1}
                format={(v) => `${v.toFixed(1)} syllables/s, about ${toApproxWpm(v)} wpm`}
                onChange={(v) => {
                  const preset = (Object.keys(PACE_PRESETS) as (keyof typeof PACE_PRESETS)[]).find(
                    (k) => Math.abs(PACE_PRESETS[k].threshold - v) < 0.01,
                  );
                  setConfig((c) => ({ ...c, paceThreshold: v, paceMode: preset ?? "custom" }));
                }}
              />
              <Slider
                label="Sensitivity"
                value={Math.round((1 - config.minConfidence) * 100)}
                min={5}
                max={35}
                step={5}
                format={(v) => (v <= 10 ? "Cautious" : v <= 25 ? "Balanced" : "Eager")}
                onChange={(v) => setConfig((c) => ({ ...c, minConfidence: 1 - v / 100 }))}
              />
              <Slider
                label="Quiet time between cues"
                value={config.cooldownSec}
                min={0.5}
                max={10}
                step={0.5}
                format={(v) => `${v} s`}
                onChange={(v) => setConfig((c) => ({ ...c, cooldownSec: v }))}
              />
            </div>

            <div>
              <h3 className="font-display text-base font-semibold">Privacy</h3>
              <p className="mt-2 max-w-prose text-muted">
                While you listen, audio streams to Deepgram to be transcribed. Cue keeps nothing on its own. A session
                is only saved if you choose Download session, and that file has words and timing, never audio. Speaker
                labels last for one session; Cue never builds a voiceprint.
              </p>
            </div>
          </div>
        </Disclosure>
      </div>
    </main>
  );
}

const capitalize = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const formatDb = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(Math.round(x))} dB`;

/** The cue, drawn: a still center with outward rings (one, two, or one slow). */
function CueRings({
  buzz,
  confirm,
}: {
  buzz: { n: number; label: string; pattern: CuePattern } | null;
  confirm: { n: number; pattern: ConfirmPattern } | null;
}) {
  const state = confirm ? "cue-confirming" : buzz ? "cue-buzzing" : "";
  return (
    <div
      key={`${buzz?.n ?? 0}-${confirm?.n ?? 0}`}
      data-pattern={buzz?.pattern}
      data-confirm={confirm?.pattern}
      className={`relative grid h-40 w-40 place-items-center ${state}`}
      role="img"
      aria-label={
        confirm
          ? `Confirmation: ${CONFIRMS[confirm.pattern].label}`
          : buzz
            ? `Cue: ${PATTERNS[buzz.pattern].name}, ${buzz.label}`
            : "No cue right now"
      }
    >
      {[0, 1].map((k) => (
        <span
          key={k}
          className="cue-ring pointer-events-none absolute inset-6 rounded-full border-2 border-cue opacity-0"
        />
      ))}
      <span
        className={`cue-core block h-28 w-28 rounded-full border transition-colors duration-200 ${
          confirm ? "border-neutral bg-neutral-soft" : buzz ? "border-cue bg-cue-soft" : "border-line bg-surface"
        }`}
      />
      <span
        className={`absolute h-3 w-3 rounded-full transition-colors duration-200 ${buzz ? "bg-cue" : confirm ? "bg-neutral" : "bg-line"}`}
        aria-hidden
      />
    </div>
  );
}

/** A pattern's rhythm drawn as beats: one, two, or one long. */
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

/** Always-visible microphone state (DESIGN.md §12: recording state must be unmistakable). */
function MicState({ status }: { status: Status }) {
  const on = status === "listening";
  const text = {
    idle: "Microphone off",
    connecting: "Connecting…",
    listening: "Microphone on",
    demo: "Microphone off",
    error: "Microphone off",
  }[status];
  return (
    <span
      className={`flex min-h-8 items-center gap-2 rounded-full border px-3 text-[13px] ${on ? "border-cue text-text" : "border-line text-muted"}`}
      role="status"
    >
      <span className={`h-2 w-2 rounded-full ${on ? "animate-pulse bg-cue" : "bg-line"}`} aria-hidden />
      {text}
    </span>
  );
}

/** A collapsed section: title plus a one-line summary of what's inside. */
function Disclosure({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const id = `section-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section className="border-b border-line">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="flex w-full items-center gap-4 py-6 text-left"
        >
          <span className="flex-1">
            <span className="block font-display text-xl font-semibold tracking-tight">{title}</span>
            <span className="mt-1 block text-[13px] text-muted">{summary}</span>
          </span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className={`shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h2>
      {open && (
        <div id={id} className="pb-12 pt-2">
          {children}
        </div>
      )}
    </section>
  );
}

function Meter({
  label,
  value,
  frac,
  mark,
  alert,
  learning,
}: {
  label: string;
  value: string;
  frac: number;
  mark?: number;
  alert?: boolean;
  learning?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="font-medium">{label}</span>
        <span className="text-right tabular-nums text-muted">{value}</span>
      </div>
      <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full transition-all duration-300 ${learning ? "bg-neutral-soft" : alert ? "bg-cue" : "bg-neutral"}`}
          style={{ width: `${frac * 100}%` }}
        />
        {mark !== undefined && (
          <div className="absolute top-0 h-full w-0.5 bg-text/50" style={{ left: `${mark * 100}%` }} />
        )}
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg border border-line p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-9 rounded-md px-3 text-[13px] transition-colors duration-200 ${
            value === o.value ? "bg-text text-bg" : "text-muted hover:text-text"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Switch({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-9 items-center gap-3 text-left"
    >
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-cue" : "bg-line"}`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow-sm transition-transform duration-200 ${on ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </span>
      <span className="text-[13px] sm:text-[15px]">
        {label}
        {hint && <span className="block text-[13px] text-muted">{hint}</span>}
      </span>
    </button>
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
      <span className="flex items-baseline justify-between gap-3 text-[15px]">
        {props.label}
        <span className="text-right text-[13px] tabular-nums text-muted">{props.format(props.value)}</span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(+e.target.value)}
        className="mt-2 w-full accent-[var(--cue)]"
      />
    </label>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-9 rounded-lg border px-3 text-[13px] transition-colors duration-200 ${on ? "border-cue bg-cue-soft text-text" : "border-line text-muted hover:text-text"}`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight">{value}</dd>
      {hint && <dd className="mt-0.5 text-[13px] text-muted">{hint}</dd>}
    </div>
  );
}

function CorrectionButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`mt-3 min-h-8 rounded-lg border px-3 text-[13px] ${on ? "border-text bg-surface-2 text-text" : "border-line text-muted hover:text-text"}`}
    >
      {on ? `Marked: ${children.toLowerCase()}` : children}
    </button>
  );
}

function TranscriptKey() {
  return (
    <ul
      className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted"
      aria-label="What the transcript markings mean"
    >
      <li>
        <span className="rounded bg-cue-soft px-1 text-cue">like</span> cued
      </li>
      <li>
        <span className="text-cue underline decoration-dotted">like</span> noticed, held back
      </li>
      <li>
        <span className="text-text underline decoration-muted decoration-dotted underline-offset-4">like</span> not a
        filler
      </li>
      <li>
        <span className="text-text line-through decoration-2">like</span> you marked wrong
      </li>
      <li>
        <span className="rounded px-0.5 text-text ring-1 ring-text">like</span> you marked missed
      </li>
      <li>
        <span className="italic text-muted/70">um</span> someone else
      </li>
    </ul>
  );
}

/**
 * Stand-in for the cuff's touch surface (controls only). Hold 1.5 s = on/off,
 * double-tap = switch mode; a single tap does nothing, as on the real cuff.
 */
function CuffTouchPad({ onAction, mode, on }: { onAction: (a: TouchAction) => void; mode: string; on: boolean }) {
  const gestures = useRef(new TouchGestures());
  const holdTimer = useRef<number | undefined>(undefined);
  const hintTimer = useRef<number | undefined>(undefined);
  const downAt = useRef(0);
  const longFired = useRef(false);
  const [pressing, setPressing] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const flash = (text: string) => {
    setHint(text);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(null), 1600);
  };
  const fire = (a: TouchAction | null) => a && onAction(a);
  const release = (cancelled: boolean) => {
    window.clearTimeout(holdTimer.current);
    setPressing(false);
    if (cancelled) return gestures.current.cancel();
    const now = performance.now();
    const a = gestures.current.up(now);
    if (a) return fire(a);
    if (longFired.current) return;
    const held = now - downAt.current;
    // Explain ignored touches, but only once it's clear no second tap is coming.
    if (held <= TAP_MAX_MS)
      hintTimer.current = window.setTimeout(
        () => flash("A single tap does nothing. Double-tap to switch mode."),
        DOUBLE_TAP_GAP_MS + 50,
      );
    else flash("Let go too early. Hold for 1.5 seconds to turn Cue on or off.");
  };

  return (
    <div className="flex items-center gap-5">
      <button
        type="button"
        aria-label="Simulated cuff touch surface: hold 1.5 seconds to turn Cue on or off, double-tap to switch mode"
        className={`cuff-pad relative grid h-20 w-20 shrink-0 touch-none select-none place-items-center rounded-full border border-neutral bg-neutral-soft text-[13px] font-medium ${pressing ? "pressing" : ""}`}
        onPointerDown={(e) => {
          try {
            e.currentTarget.setPointerCapture(e.pointerId); // keep the press if the finger drifts
          } catch {
            /* synthetic or already-released pointer */
          }
          window.clearTimeout(hintTimer.current);
          setHint(null);
          downAt.current = performance.now();
          longFired.current = false;
          gestures.current.down(downAt.current);
          setPressing(true);
          holdTimer.current = window.setTimeout(() => {
            setPressing(false);
            const a = gestures.current.poll(performance.now());
            if (a) longFired.current = true;
            fire(a);
          }, LONG_PRESS_MS);
        }}
        onPointerUp={() => release(false)}
        onPointerCancel={() => release(true)}
        onKeyDown={(e) => {
          // Keyboard: Enter = double tap, Shift+Enter = long press.
          if (e.key !== "Enter") return;
          e.preventDefault();
          onAction(e.shiftKey ? "toggle_on" : "toggle_mode");
        }}
      >
        <svg className="absolute inset-0 text-text" viewBox="0 0 36 36" aria-hidden>
          <circle
            className="press-ring"
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            pathLength={100}
            transform="rotate(-90 18 18)"
          />
        </svg>
        Cuff
      </button>
      <div className="text-[15px]">
        <p>Hold for 1.5 seconds to turn Cue {on ? "off" : "on"}.</p>
        <p>Double-tap to switch mode. Now: {mode}.</p>
        <p className="mt-1 min-h-5 text-[13px] text-muted" aria-live="polite">
          {hint}
        </p>
      </div>
    </div>
  );
}
