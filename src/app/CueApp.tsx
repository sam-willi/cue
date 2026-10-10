"use client";

import Image from "next/image";
import DeviceModel from "./DeviceModel";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_CONFIG, PACE_PRESETS, toApproxWpm, type CueConfig, type CueMode } from "@/lib/cue/config";
import type { Pace } from "@/lib/cue/pace";
import type { Correction, SessionFile } from "@/lib/cue/evaluate";
import {
  CONFIRMS,
  CUE_LEGEND,
  PATTERNS,
  patternFor,
  type ConfirmPattern,
  type CueKind,
  type CuePattern,
} from "@/lib/cue/patterns";
import { DOUBLE_TAP_GAP_MS, LONG_PRESS_MS, TAP_MAX_MS, TouchGestures, type TouchAction } from "@/lib/cue/touch";
import { isDisfluency, type Outcome } from "@/lib/cue/engine";
import { CueSession, type SessionUpdate, type Signals, type VolumeStatus } from "@/lib/cue/session";
import { simulateWords } from "@/lib/cue/simulate";
import type { CueDecision, LikeCheck, SpeechEvent, Word } from "@/lib/cue/types";
import { MAX_CUSTOM_FILLERS, parseCustomFiller } from "@/lib/cue/customFillers";
import { buildReport, type ReportSection, type SessionReport } from "@/lib/cue/report";
import { LiveTranscriber } from "@/lib/deepgram/liveTranscriber";
import { feedMessage, type DgMessage } from "@/lib/deepgram/parse";
import { encodeWav } from "@/lib/audio/wav";
import { confirmTones, cueTones, EarconPlayer, setAudioSession } from "@/lib/cue/earcon";

const LABEL: Record<CueKind, string> = {
  filler_um: "“um”",
  filler_uh: "“uh”",
  filler_like: "filler “like”",
  filler_lowkey: "“lowkey”",
  filler_custom: "a filler word",
  no_pause: "no pause",
  long_turn: "a long turn",
  rushing: "speaking fast",
  too_quiet: "speaking quietly",
};

const MODE_LABEL: Record<CueMode, string> = { conversation: "Conversation", presentation: "Presentation" };

/** What Cue asks of you for each kind of alert: pause, slow down, or speak up. */
const actionFor = (kind: CueKind) => PATTERNS[patternFor(kind)].action;
/** How an event is named on screen: the wearer's own filler words are shown as the word itself. */
const labelFor = (ev: SpeechEvent) => (ev.phrase ? `“${ev.phrase}”` : LABEL[ev.type]);

const WITHHELD: Record<NonNullable<CueDecision["withheldReason"]>, string> = {
  low_confidence: "not confident enough",
  cooldown: "too soon after the last cue",
  muted: "muted",
  category_off: "category off",
  not_a_pattern: "not a pattern yet",
  mode_off: "not tapped in Presentation mode",
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
  "So, um, I was like working on this project and, um, it was hard.",
  "I like went to the mall yesterday.",
  "I like tofu.",
  "I, I, I think we should, um, go now.",
  "There were like twenty people there.",
  "So we spent the whole weekend planning the launch, and honestly it went better than expected. The team pulled together, we fixed the last bugs on Saturday, and by Sunday night everything was ready to ship to our first customers.",
];

type Status = "idle" | "connecting" | "listening" | "demo" | "error";

export default function CueApp() {
  const [config, setConfig] = useState<CueConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  // A visitor's own Deepgram key. Kept in this browser only (this tab, or this device if they
  // choose) and sent straight to Deepgram, never to this app's server.
  const [apiKey, setApiKey] = useState("");
  const [rememberKey, setRememberKey] = useState(false);
  const [keyFormOpen, setKeyFormOpen] = useState(false);
  // "Set my volume" (decision 13): a short read-aloud saves the target level for one mode.
  const [calibratingFor, setCalibratingFor] = useState<CueMode | null>(null);
  const [volumeNote, setVolumeNote] = useState<string | null>(null);
  const [pace, setPace] = useState<Pace | null>(null);
  const [volume, setVolume] = useState<VolumeStatus | null>(null);
  const [demoQuiet, setDemoQuiet] = useState(false);
  const [demoFriend, setDemoFriend] = useState(false);
  const [log, setLog] = useState<CueDecision[]>([]);
  const [checks, setChecks] = useState<LikeCheck[]>([]);
  const [recorded, setRecorded] = useState(0);
  /** Measured delay (ms) from the end of a filler to its buzz, by event id. */
  const [latency, setLatency] = useState<Record<string, number>>({});
  /** Whether each tap worked (the user paused, slowed down, spoke up), by event id. */
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [signals, setSignals] = useState<Signals | null>(null);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [speakingSec, setSpeakingSec] = useState(0);
  const [words, setWords] = useState<(Word & { wearer: boolean })[]>([]);
  const [buzz, setBuzz] = useState<{ n: number; label: string; action: string; pattern: CuePattern } | null>(null);
  const [confirm, setConfirm] = useState<{ n: number; pattern: ConfirmPattern } | null>(null);
  /** A filler Cue detected but didn't buzz for (not a pattern yet, or cooling down). */
  const [heard, setHeard] = useState<{ n: number; label: string } | null>(null);
  const heardTimer = useRef<number | undefined>(undefined);
  /** Live transcript is a testing aid only; the product never needs the screen mid-conversation. */
  const [showTranscript, setShowTranscript] = useState(false);
  /** The after-session report, built when a session ends. */
  const [report, setReport] = useState<SessionReport | null>(null);
  /** Notes or a script the wearer pasted, to check how much of the talk was read word for word. */
  const [script, setScript] = useState("");
  const [fillerDraft, setFillerDraft] = useState("");
  const [fillerError, setFillerError] = useState<string | null>(null);
  const [open, setOpen] = useState({ review: false, practice: false, training: false, settings: false });
  /** Training recording: audio is kept only when the user starts one explicitly. */
  const [recordingTraining, setRecordingTraining] = useState(false);
  const recordAudioRef = useRef(false);
  const audioChunksRef = useRef<Int16Array[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const [trainingAudioUrl, setTrainingAudioUrl] = useState<string | null>(null);
  /** Ground-truth labels: word keys the user marked as fillers. */
  const [fillerMarks, setFillerMarks] = useState<Set<number>>(new Set());
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [trainingSaved, setTrainingSaved] = useState<string | null>(null);
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
  /** Voiced pitch frames [audio time s, Hz] from the last live session, for the report. */
  const pitchRef = useRef<[number, number][]>([]);
  /** Voice-activity frames [audio time s, voice heard] from the last live session, for the report. */
  const voiceRef = useRef<[number, boolean][]>([]);
  const clockRef = useRef<Clock | null>(null);
  const buzzTimer = useRef<number | undefined>(undefined);

  /** Cue sounds: each cue also plays as a quiet tone in headphones (AirPods), for testing before the device exists. */
  const [sound, setSound] = useState<SoundSettings>(DEFAULT_SOUND);
  const soundRef = useRef(sound);
  const earconRef = useRef<EarconPlayer | null>(null);
  /** The microphone chosen in Settings (empty = the browser's default). */
  const [micChoice, setMicChoice] = useState<MicChoice>({ deviceId: "", label: "" });
  /** Name of the mic in use (or last used). Volume targets are saved per mic: AirPods hear your voice at a different level. */
  const [micLabel, setMicLabel] = useState("");
  const micLabelRef = useRef("");
  const [mics, setMics] = useState<{ deviceId: string; label: string }[]>([]);
  /** Saved volume targets, by mic name ("" = saved before mics were told apart). */
  const [volumeByMic, setVolumeByMic] = useState<Record<string, CueConfig["volumeTarget"]>>({});

  const earcon = useCallback(() => (earconRef.current ??= new EarconPlayer()), []);
  /** Call from a click: lets later cues play sound (browsers block audio until the page is clicked). */
  const unlockSound = useCallback(() => {
    if (soundRef.current.on) earcon().unlock();
  }, [earcon]);

  const saveSound = (next: SoundSettings) => {
    setSound(next);
    soundRef.current = next;
    if (next.on) earcon().unlock();
    try {
      localStorage.setItem(SOUND_STORAGE, JSON.stringify(next));
    } catch {
      // Storage blocked: the choice lasts until the page closes.
    }
  };

  const refreshMics = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setMics(
        all
          .filter((d) => d.kind === "audioinput" && d.deviceId !== "default" && d.deviceId !== "communications")
          .map((d) => ({ deviceId: d.deviceId, label: d.label })),
      );
    } catch {
      // No media devices (insecure page, old browser): only the default mic is offered.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- device list only exists in the browser
    void refreshMics();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshMics);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refreshMics);
  }, [refreshMics]);

  const rememberMic = useCallback((label: string) => {
    micLabelRef.current = label;
    setMicLabel(label);
    try {
      localStorage.setItem(MIC_LABEL_STORAGE, label);
    } catch {
      // Storage blocked.
    }
  }, []);

  // The volume targets in effect are the ones saved for the mic in use.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived from the mic and saved targets
    setConfig((c) => ({ ...c, volumeTarget: volumeByMic[micLabel] ?? {} }));
  }, [micLabel, volumeByMic]);

  const configRef = useRef(config);
  useEffect(() => {
    sessionRef.current.config = config;
    configRef.current = config;
  }, [config]);
  const scriptRef = useRef(script);
  useEffect(() => {
    scriptRef.current = script;
  }, [script]);

  /** Play a touch-control confirmation (a ramp, never a coaching tap). */
  const playConfirm = useCallback((pattern: ConfirmPattern) => {
    setBuzz(null);
    setConfirm((c) => ({ n: (c?.n ?? 0) + 1, pattern }));
    navigator.vibrate?.(CONFIRMS[pattern].vibrate);
    if (soundRef.current.on) earconRef.current?.play(confirmTones(pattern), soundRef.current.volume);
    // The motor shakes the bone sensor: tell the session so it isn't read as speech.
    sessionRef.current.hapticPlayed(CONFIRMS[pattern].vibrate.reduce((x, y) => x + y, 0) / 1000);
    window.clearTimeout(buzzTimer.current);
    buzzTimer.current = window.setTimeout(() => setConfirm(null), CONFIRMS[pattern].durationMs + 600);
  }, []);

  /** A touch gesture on the device: long press = Cue on/off, double tap = switch mode. */
  const onTouch = useCallback(
    (action: TouchAction) => {
      const c = configRef.current;
      if (action === "toggle_on") {
        setConfig((x) => ({ ...x, muted: !c.muted }));
        playConfirm(c.muted ? "ramp_up" : "ramp_down");
      } else {
        const next = c.mode === "presentation" ? "conversation" : "presentation";
        setConfig((x) => ({ ...x, mode: next, paceMode: next, paceThreshold: PACE_PRESETS[next].threshold }));
        playConfirm(next === "presentation" ? "ramp_twice" : "ramp_once");
      }
    },
    [playConfirm],
  );

  const triggerBuzz = useCallback((kind: CueKind, label?: string) => {
    const pattern = patternFor(kind);
    setConfirm(null);
    setBuzz((b) => ({ n: (b?.n ?? 0) + 1, label: label ?? LABEL[kind], action: actionFor(kind), pattern }));
    navigator.vibrate?.(PATTERNS[pattern].vibrate);
    if (soundRef.current.on) earconRef.current?.play(cueTones(pattern), soundRef.current.volume);
    window.clearTimeout(buzzTimer.current);
    buzzTimer.current = window.setTimeout(() => setBuzz(null), PATTERNS[pattern].durationMs + 600);
  }, []);

  const apply = useCallback(
    (u: SessionUpdate) => {
      if (u.pace !== null) setPace(u.pace);
      if (u.volume !== null) setVolume(u.volume);
      const hit = u.decisions.find((d) => d.delivered);
      const held = u.decisions.find(
        (d) =>
          !d.delivered &&
          isDisfluency(d.event.type) &&
          (d.withheldReason === "not_a_pattern" || d.withheldReason === "cooldown"),
      );
      if (!hit && held) {
        const label =
          held.withheldReason === "cooldown"
            ? `Noticed ${labelFor(held.event)}. Cue just buzzed, so not again yet.`
            : `Noticed ${labelFor(held.event)}${held.trigger ? ` (${held.trigger})` : ""}. No buzz yet.`;
        setHeard((x) => ({ n: (x?.n ?? 0) + 1, label }));
        window.clearTimeout(heardTimer.current);
        heardTimer.current = window.setTimeout(() => setHeard(null), 1600);
      }
      if (hit) {
        setHeard(null);
        triggerBuzz(hit.event.type, describeTap(hit));
        const endedAt = isFiller(hit) ? clockRef.current?.toPage(hit.event.end) : null;
        if (endedAt != null) {
          const ms = Math.max(0, performance.now() - endedAt);
          setLatency((l) => ({ ...l, [hit.event.id]: ms }));
        }
      }
      if (u.decisions.length) setLog((l) => [...u.decisions.slice().reverse(), ...l].slice(0, 100));
      if (u.likeChecks.length) setChecks((c) => [...u.likeChecks.slice().reverse(), ...c].slice(0, 100));
      if (u.outcomes.length)
        setOutcomes((o) => ({ ...o, ...Object.fromEntries(u.outcomes.map((x) => [x.id, x.outcome])) }));
      setSignals(u.signals);
      const sess = sessionRef.current;
      setWords(sess.words.map((w) => ({ ...w, wearer: sess.isWearerWord(w) })));
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
    setOutcomes({});
    setSignals(null);
    setCorrections([]);
    setSpeakingSec(0);
    setPace(null);
    setVolume(null);
    setReport(null);
    levelsRef.current = [];
    pitchRef.current = [];
    voiceRef.current = [];
    setError(null);
  }, [config]);

  const stopAll = useCallback(() => {
    transcriberRef.current?.stop();
    transcriberRef.current = null;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setAudioSession("auto");
    setStatus("idle");
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY_STORAGE);
      const key = saved ?? sessionStorage.getItem(KEY_STORAGE);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage only exists after mount
      if (key) setApiKey(key);
      setRememberKey(saved !== null);
      // Volume targets per mic; one saved before mics were told apart stays under "".
      const byMic = JSON.parse(localStorage.getItem(VOLUME_BY_MIC_STORAGE) ?? "{}");
      setVolumeByMic(byMic);
      // Volumes saved before the level was measured the way listeners hear it (decision 21) are on
      // a different scale, so they're dropped and the wearer sets their volume once more.
      const outdated = OLD_VOLUME_STORAGE.filter((k) => localStorage.getItem(k) !== null);
      if (outdated.length) {
        outdated.forEach((k) => localStorage.removeItem(k));
        setVolumeNote("Cue now measures volume more accurately, so please set your volume again.");
      }
      const lastMic = localStorage.getItem(MIC_LABEL_STORAGE);
      if (lastMic) {
        micLabelRef.current = lastMic;
        setMicLabel(lastMic);
      }
      const chosen = localStorage.getItem(MIC_STORAGE);
      if (chosen) setMicChoice(JSON.parse(chosen));
      const savedSound = localStorage.getItem(SOUND_STORAGE);
      if (savedSound) {
        const next = { ...DEFAULT_SOUND, ...JSON.parse(savedSound) };
        soundRef.current = next;
        setSound(next);
      }
      const cues = localStorage.getItem(VOLUME_CUES_STORAGE);
      if (cues) setConfig((c) => ({ ...c, volumeCues: { ...c.volumeCues, ...JSON.parse(cues) } }));
      const fillers = JSON.parse(localStorage.getItem(CUSTOM_FILLERS_STORAGE) ?? "[]");
      if (Array.isArray(fillers) && fillers.length)
        setConfig((c) => ({ ...c, customFillers: fillers.filter((f) => typeof f === "string") }));
    } catch {
      // Storage blocked (private window, previews): the key just isn't remembered.
    }
  }, []);

  const saveKey = (key: string, remember: boolean) => {
    setApiKey(key);
    setRememberKey(remember);
    setKeyFormOpen(false);
    try {
      localStorage.removeItem(KEY_STORAGE);
      sessionStorage.removeItem(KEY_STORAGE);
      if (key) (remember ? localStorage : sessionStorage).setItem(KEY_STORAGE, key);
    } catch {
      // Storage blocked: the key works until the page closes.
    }
  };

  // Finish "Set my volume" once there's enough read-aloud speech, then save it for that mode.
  useEffect(() => {
    if (!calibratingFor) return;
    if (status === "error" || status === "idle") return;
    const timer = window.setInterval(() => {
      const level = sessionRef.current.measuredLevel(4);
      if (!level) return;
      const mode = calibratingFor;
      const mic = micLabelRef.current;
      setVolumeByMic((all) => {
        const next = { ...all, [mic]: { ...all[mic], [mode]: { db: level.db, noiseDb: level.noiseDb } } };
        try {
          localStorage.setItem(VOLUME_BY_MIC_STORAGE, JSON.stringify(next));
        } catch {
          // Storage blocked: the target lasts until the page closes.
        }
        return next;
      });
      setVolumeNote(`${MODE_LABEL[mode]} volume set${mic ? ` for ${mic}` : ""}. Cue taps if you drop well below it.`);
      setCalibratingFor(null);
      stopAll();
    }, 400);
    return () => window.clearInterval(timer);
  }, [calibratingFor, status, stopAll]);

  const startLive = async (opts: { record?: boolean; apiKey?: string } = {}) => {
    stopAll();
    reset();
    unlockSound();
    // iPhone: listen and play cue sounds at once, even with the ring switch on silent.
    setAudioSession("play-and-record");
    recordAudioRef.current = !!opts.record;
    setRecordingTraining(!!opts.record);
    audioChunksRef.current = [];
    audioBlobRef.current = null;
    if (trainingAudioUrl) URL.revokeObjectURL(trainingAudioUrl);
    setTrainingAudioUrl(null);
    setFillerMarks(new Set());
    setTrainingSaved(null);
    const t = new LiveTranscriber({
      onAudio: (pcm) => {
        if (recordAudioRef.current) audioChunksRef.current.push(pcm);
      },
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
      onPitch: (t, hz) => {
        pitchRef.current.push([t, hz]);
      },
      onVoice: (t, voice) => {
        voiceRef.current.push([t, voice]);
        sessionRef.current.ingestVoice(t, voice);
      },
      onMic: ({ label }) => {
        rememberMic(label);
        void refreshMics(); // names are only visible once the mic is allowed
      },
      onStatus: (s, detail, code) => {
        if (s === "stopped") return;
        setStatus(s === "error" ? "error" : s);
        if (detail) setError(detail);
        if (s === "error") setCalibratingFor(null);
        // No usable key: open the field for the visitor's own (the headline says why).
        if (code) setKeyFormOpen(true);
      },
    });
    rawRef.current = [];
    setRecorded(0);
    clockRef.current = { toPage: (x) => t.audioToPageTime(x), toAudio: (ms) => t.pageToAudioTime(ms) };
    transcriberRef.current = t;
    await t.start({
      apiKey: (opts.apiKey ?? apiKey) || undefined,
      deviceId: micChoice.deviceId || undefined,
      // Ask Deepgram to listen for the fillers it's most likely to mishear.
      keyterms: ["lowkey", ...config.customFillers],
    });
  };

  /** Build the after-session report from everything the session heard. */
  const makeReport = (notes: string): SessionReport => {
    const sess = sessionRef.current;
    return buildReport({
      words: sess.words.filter((w) => sess.isWearerWord(w)),
      history: sess.history,
      taps: sess.engineTaps(),
      levels: levelsRef.current,
      pitch: pitchRef.current,
      voice: voiceRef.current,
      config: sess.config,
      paceLimit: sess.paceLimit(),
      script: notes,
    });
  };

  const runDemo = (text = demoText) => {
    stopAll();
    reset();
    unlockSound();
    setStatus("demo");
    const demoStart = performance.now();
    clockRef.current = { toPage: (x) => demoStart + x * 1000, toAudio: (ms) => (ms - demoStart) / 1000 };
    let sim: Word[] = simulateWords(text, { wpm: demoWpm });
    // "A friend cuts in": the microphone hears them, but the device's bone sensor doesn't,
    // so their fillers shouldn't tap.
    let friend: Word[] = [];
    if (demoFriend && sim.length > 4) {
      const cut = sim[Math.floor(sim.length * 0.6)].start;
      friend = simulateWords("Um, yeah, I like went there too.", { wpm: 170, startAt: cut + 0.5 });
      const resume = friend.at(-1)!.end + 0.8 - cut;
      sim = [
        ...sim.filter((w) => w.start < cut),
        ...friend,
        ...sim.filter((w) => w.start >= cut).map((w) => ({ ...w, start: w.start + resume, end: w.end + resume })),
      ];
    }
    // Simulated mic level: speech at −20 dBFS (optionally trailing off to −32 for the
    // last 45%), a quiet room at −60. The demo's voice is its own volume target.
    const total = sim.at(-1)?.end ?? 0;
    sessionRef.current.config = {
      ...config,
      volumeTarget: { ...config.volumeTarget, [config.mode]: { db: -20, noiseDb: -60 } },
    };
    for (let t = 0; t <= total; t += 0.05) {
      const w = sim.find((x) => t >= x.start && t <= x.end);
      const db = !w ? -60 : demoQuiet && t > total * 0.55 ? -32 : -20;
      sessionRef.current.ingestLevel(t, db);
      levelsRef.current.push([t, db]);
      if (demoFriend) sessionRef.current.ingestBone(t, !!w && !friend.includes(w));
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
        setReport(makeReport(scriptRef.current));
        setOpen((o) => ({ ...o, review: true }));
      }, endAt),
    );
  };

  // Keep the screen on while listening: a phone that locks stops the microphone.
  useEffect(() => {
    if (status !== "listening") return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    void navigator.wakeLock
      ?.request("screen")
      .then((l) => {
        if (cancelled) void l.release();
        else lock = l;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      void lock?.release().catch(() => {});
    };
  }, [status]);

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
  const tapped = log.filter((d) => d.delivered);
  const worked = tapped.filter((d) => outcomes[d.event.id] === "worked").length;
  const judged = tapped.filter((d) => outcomes[d.event.id]).length;
  const noticed = log.filter(
    (d) => isDisfluency(d.event.type) && d.withheldReason !== "low_confidence" && d.withheldReason !== "category_off",
  ).length;
  const lat = Object.values(latency);
  const p50 = percentile(lat, 0.5);
  const p90 = percentile(lat, 0.9);
  const falseBuzzes = corrections.filter((c) => c.label === "false_buzz").length;
  const misses = corrections.filter((c) => c.label === "missed").length;
  const speakingMin = speakingSec / 60;
  const sps = pace?.sps ?? 0;
  const paceLimit = signals?.paceLimit ?? config.paceThreshold;
  const paceFrac = Math.min(1, sps / (paceLimit * 1.4));
  const presetLabel = MODE_LABEL[config.mode];

  const live = status === "listening" || status === "connecting";
  const volumeSet = !!config.volumeTarget[config.mode];
  const volumeOn = config.volumeCues[config.mode];
  const modeName = MODE_LABEL[config.mode].toLowerCase();
  const setVolumeCues = (on: boolean) =>
    setConfig((c) => {
      const volumeCues = { ...c.volumeCues, [c.mode]: on };
      try {
        localStorage.setItem(VOLUME_CUES_STORAGE, JSON.stringify(volumeCues));
      } catch {
        // Storage blocked: the choice lasts until the page closes.
      }
      return { ...c, volumeCues };
    });
  const endSession = () => {
    stopAll();
    if (recordAudioRef.current) {
      recordAudioRef.current = false;
      setRecordingTraining(false);
      const blob = encodeWav(audioChunksRef.current);
      audioBlobRef.current = blob;
      setTrainingAudioUrl(URL.createObjectURL(blob));
      // Start the labels from what Cue detected; the user adds and removes from there.
      setFillerMarks(new Set(log.filter(isFiller).map((d) => wordKey(d.event.start))));
      setOpen((o) => ({ ...o, training: true }));
    } else if (words.length) setOpen((o) => ({ ...o, review: true }));
    if (words.length) setReport(makeReport(script));
  };
  const setCustomFillers = (customFillers: string[]) => {
    setConfig((c) => ({ ...c, customFillers }));
    try {
      localStorage.setItem(CUSTOM_FILLERS_STORAGE, JSON.stringify(customFillers));
    } catch {
      // Storage blocked: the list lasts until the page closes.
    }
  };
  const addCustomFiller = () => {
    const parsed = parseCustomFiller(fillerDraft);
    if ("error" in parsed) return setFillerError(parsed.error);
    if (config.customFillers.includes(parsed.phrase))
      return setFillerError(`“${parsed.phrase}” is already on your list.`);
    if (config.customFillers.length >= MAX_CUSTOM_FILLERS)
      return setFillerError(`That’s the limit of ${MAX_CUSTOM_FILLERS}. Remove one to add another.`);
    setCustomFillers([...config.customFillers, parsed.phrase]);
    setFillerDraft("");
    setFillerError(null);
  };

  const toggleFillerMark = (start: number) =>
    setFillerMarks((m) => {
      const next = new Set(m);
      const k = wordKey(start);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const saveTraining = async () => {
    const file: SessionFile = {
      version: 2,
      savedAt: new Date().toISOString(),
      config,
      messages: rawRef.current,
      corrections: [],
      levels: levelsRef.current,
      latenciesMs: Object.values(latency),
      fillerLabels: words
        .filter((w) => fillerMarks.has(wordKey(w.start)))
        .map((w) => ({ start: w.start, word: w.norm })),
    };
    const form = new FormData();
    form.append("session", JSON.stringify(file));
    if (audioBlobRef.current) form.append("audio", audioBlobRef.current, "audio.wav");
    setTrainingSaved("Saving…");
    try {
      const res = await fetch("/api/training", { method: "POST", body: form });
      const body = await res.json();
      setTrainingSaved(
        res.ok
          ? `Saved to ${body.folder}: ${body.labels} filler${body.labels === 1 ? "" : "s"} marked${body.audio ? ", with audio" : ""}.`
          : (body.error ?? "Couldn’t save."),
      );
    } catch {
      setTrainingSaved("Couldn’t reach the app to save. Is it running locally?");
    }
  };

  // The hero is the cue itself: one word that says what Cue is telling you right now.
  const heroWord =
    calibratingFor && live
      ? "Set your volume."
      : confirm
        ? `${CONFIRMS[confirm.pattern].label}.`
        : buzz
          ? `${buzz.action}.`
          : status === "connecting"
            ? "Connecting…"
            : status === "error"
              ? "Couldn’t start."
              : config.muted
                ? "Cue is off."
                : status === "demo"
                  ? "Practicing."
                  : status === "listening"
                    ? "Listening."
                    : "Ready when you are.";
  const heroLine =
    calibratingFor && live
      ? `Read this aloud at the volume you want for ${calibratingFor === "presentation" ? "presenting to a room" : "conversation"}: “Cue taps when I need to pause, slow down, or speak up.”`
      : buzz
        ? capitalize(buzz.label)
        : heard && !confirm
          ? heard.label
          : confirm
            ? ""
            : status === "error"
              ? (error ?? "")
              : config.muted
                ? "Long-press the device, or switch Cue on below."
                : live
                  ? "Talk naturally. You don’t need to watch this screen."
                  : status === "demo"
                    ? "Playing your practice sentence."
                    : "Cue listens while you talk and taps when you need to pause, slow down, or speak up.";

  const totalCues = tapped.length;
  const reviewSummary = words.length
    ? `${speakingMin >= 1 ? `${speakingMin.toFixed(1)} min` : `${Math.round(speakingSec)} s`} of speaking, ${totalCues} ${totalCues === 1 ? "cue" : "cues"}${
        report && !busy
          ? report.focus.length
            ? `, ${report.focus.length} ${report.focus.length === 1 ? "thing" : "things"} to work on`
            : ", nothing to work on"
          : ""
      }`
    : "Nothing yet. Start listening or play a practice sentence.";

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-8 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        {/* Horizontal lockup (Tier 2, navigation) at ≥96 px wide (DESIGN.md §3, §5). Interim rasters
            derived from the approved concept; swap for the vector masters when they exist. */}
        <h1>
          <Image
            src="/brand/cue-logo-horizontal-fullcolor-light.png"
            alt="Cue"
            width={112}
            height={25}
            priority
            className="dark:hidden"
          />
          <Image
            src="/brand/cue-logo-horizontal-fullcolor-dark.png"
            alt="Cue"
            width={112}
            height={25}
            priority
            className="hidden dark:block"
          />
        </h1>
        <MicState status={status} recording={recordingTraining} />
      </header>

      <div className="lg:flex lg:flex-row-reverse lg:items-start lg:gap-12">
        {/* The behind-the-ear device, from its CAD: each cue leaves the motor on the skin side. Beside the page on wide
          screens, above it on phones. */}
        <aside aria-label="The device" className="mt-6 lg:sticky lg:top-8 lg:mt-8 lg:w-[44%] lg:shrink-0">
          <figure
            role="img"
            aria-label={
              confirm
                ? `Confirmation on the device: ${CONFIRMS[confirm.pattern].label}`
                : buzz
                  ? `The device buzzes: ${PATTERNS[buzz.pattern].name}, ${buzz.label}`
                  : heard
                    ? `Noticed ${heard.label}, no buzz yet`
                    : "The Cue behind-the-ear device, no cue right now"
            }
            className="overflow-hidden rounded-2xl bg-surface-2"
          >
            <DeviceModel
              buzz={buzz}
              confirm={confirm}
              noticed={heard}
              className="h-72 sm:h-96 lg:h-[calc(100svh-10rem)] lg:max-h-[44rem]"
            />
          </figure>
          <p className="mt-3 text-caption text-muted">
            Cue’s behind-the-ear (BTE) device, from its CAD. Taps leave the motor behind your ear; drag to turn it.
          </p>
        </aside>

        <div className="mx-auto w-full max-w-2xl lg:mx-0 lg:min-w-0 lg:flex-1">
          {/* --- Live: the one thing on screen while you talk --- */}
          <section aria-label="Live coaching" className="flex flex-col items-center pt-10 text-center lg:pt-20">
            <p
              className="font-display text-display-xl-m font-semibold tracking-[-0.03em] sm:text-display-xl text-balance"
              aria-live="polite"
            >
              {heroWord}
            </p>
            <p className="mt-4 min-h-12 max-w-md text-body text-muted">{heroLine}</p>

            <div className="mt-8 flex flex-col items-center gap-3">
              {live ? (
                <button onClick={endSession} className="min-h-12 rounded-lg bg-text px-8 text-body font-medium text-bg">
                  Stop
                </button>
              ) : status === "demo" ? (
                <button onClick={endSession} className="min-h-12 rounded-lg bg-text px-8 text-body font-medium text-bg">
                  Stop practice
                </button>
              ) : (
                <button
                  onClick={() => startLive()}
                  className="min-h-12 rounded-lg bg-text px-8 text-body font-medium text-bg"
                >
                  Start listening
                </button>
              )}
              <p className="max-w-md text-body-sm text-muted">
                {status === "demo"
                  ? "Practice doesn’t use the microphone."
                  : "Your audio goes to Deepgram to be transcribed. Cue doesn’t store it."}
              </p>
              {live && micLabel && (
                <p className="max-w-md text-body-sm text-muted" role="status">
                  Listening with {micLabel}
                  {sound.on ? ", cue sounds on" : ""}.
                </p>
              )}
              {status !== "demo" && !live && (
                <DeepgramKey
                  value={apiKey}
                  remember={rememberKey}
                  open={keyFormOpen}
                  onOpen={() => setKeyFormOpen(true)}
                  onCancel={() => setKeyFormOpen(false)}
                  onRemove={() => saveKey("", false)}
                  onSave={(key, remember) => {
                    saveKey(key, remember);
                    void startLive({ apiKey: key });
                  }}
                />
              )}
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
              <Segmented
                label="Mode"
                value={config.mode}
                options={[
                  { value: "conversation", label: "Conversation" },
                  { value: "presentation", label: "Presentation" },
                ]}
                onChange={(v) =>
                  setConfig((c) => ({
                    ...c,
                    mode: v,
                    paceMode: v,
                    paceThreshold: PACE_PRESETS[v].threshold,
                  }))
                }
              />
              <Switch label="Cue on" on={!config.muted} onChange={(v) => setConfig((c) => ({ ...c, muted: !v }))} />
              <Switch label="Cue sounds in AirPods" on={sound.on} onChange={(on) => saveSound({ ...sound, on })} />
              <Switch label={`Volume feedback in ${modeName}`} on={volumeOn} onChange={setVolumeCues} />
              <Switch label="Live transcript (testing)" on={showTranscript} onChange={setShowTranscript} />
            </div>

            {/* Right under the controls, so it's on screen while you talk. */}
            {showTranscript && (
              <div className="mt-6 w-full rounded-lg border border-dashed border-line p-4 text-left">
                <p className="text-body-sm text-muted">Live transcript, for testing the detector</p>
                {signals && (
                  <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-caption text-muted">
                    <div>
                      <dt className="inline">Fillers in the last minute: </dt>
                      <dd className="inline tabular-nums text-text">{signals.fillersLastMinute}</dd>
                    </div>
                    <div>
                      <dt className="inline">Since your last pause: </dt>
                      <dd className="inline tabular-nums text-text">{Math.round(signals.secondsSincePause)} s</dd>
                    </div>
                    <div>
                      <dt className="inline">This turn: </dt>
                      <dd className="inline tabular-nums text-text">{Math.round(signals.turnSeconds)} s</dd>
                    </div>
                    <div>
                      <dt className="inline">Your normal pace: </dt>
                      <dd className="inline tabular-nums text-text">
                        {signals.paceBaseline === null ? "learning" : `${signals.paceBaseline.toFixed(1)} syllables/s`}
                      </dd>
                    </div>
                  </dl>
                )}
                <p className="mt-2 text-body">
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
                                : "rounded px-1 text-cue outline-1 outline-dashed outline-cue"
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
            <p className="mt-4 max-w-md text-body-sm text-muted">
              {!volumeOn
                ? `No volume feedback in ${modeName}, so there's nothing to set.`
                : (volumeNote ??
                  (volumeSet
                    ? `Your ${modeName} volume is set${micLabel ? ` for ${micLabel}` : ""}.`
                    : `Speak-up cues start once you set your ${modeName} volume${micLabel ? ` with ${micLabel}` : ""}.`))}{" "}
              {volumeOn && !live && status !== "demo" && (
                <button
                  onClick={() => {
                    setVolumeNote(null);
                    setCalibratingFor(config.mode);
                    void startLive();
                  }}
                  className="underline underline-offset-2 hover:text-text"
                >
                  {volumeSet ? "Set it again" : "Set my volume"}
                </button>
              )}
            </p>

            {/* What each tap means */}
            <div className="mt-12 w-full">
              <p className="text-body-sm text-muted">
                What each tap means. Select one to {sound.on ? "hear" : "feel"} it.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {CUE_LEGEND.map(({ kind, label }) => {
                  const p = patternFor(kind);
                  return (
                    <button
                      key={kind}
                      onClick={() => {
                        unlockSound();
                        triggerBuzz(kind);
                        sessionRef.current.hapticPlayed(PATTERNS[p].vibrate.reduce((x, y) => x + y, 0) / 1000);
                      }}
                      className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border px-2 py-3 text-label transition-colors duration-200 hover:border-cue ${
                        buzz?.pattern === p ? "cue-playing border-cue" : "border-line"
                      }`}
                    >
                      <RhythmGlyph pattern={p} />
                      <span className="font-medium">{actionFor(kind)}</span>
                      <span className="text-muted">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* What's inside: an exploded view from the CAD, so the taps on the 3D model have a body. */}
            <figure className="mt-12 w-full text-left">
              <p className="text-body-sm text-muted">Inside the device</p>
              <div className="mt-3 overflow-hidden rounded-2xl bg-[#1c1c1c]">
                <Image
                  src="/cad/cue-bte-exploded.png"
                  alt="Exploded view of the Cue device: the outer shell on top, the circuit board below it, then the coin battery and the vibration motor sitting in the inner shell that rests against the skin behind the ear."
                  width={934}
                  height={1188}
                  sizes="(min-width: 1024px) 36rem, 100vw"
                  className="mx-auto h-auto w-full max-w-sm"
                />
              </div>
              <figcaption className="mt-3 max-w-prose text-body-sm text-muted">
                From top: the outer shell, the circuit board (Bluetooth, microphone, motion and bone-conduction sensor,
                haptic driver), the coin battery, and the vibration motor in the inner shell. The motor presses against
                the skin behind your ear, which is where each tap starts on the 3D model.
              </figcaption>
            </figure>

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
                    !volumeOn
                      ? `Volume feedback is off in ${modeName}`
                      : !volume
                        ? "Measuring once you speak"
                        : volume.baselineDb === null || volume.expectedDb === null
                          ? "Set your volume to compare against it"
                          : volume.db === null
                            ? "Volume set"
                            : `${formatDb(volume.db - volume.expectedDb)} from your set volume${
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
                      : 0
                  }
                  mark={volume?.expectedDb != null ? (20 - config.quietDropDb) / 27 : undefined}
                  alert={
                    volume?.expectedDb != null &&
                    volume.db !== null &&
                    volume.db < volume.expectedDb - config.quietDropDb
                  }
                  learning={volume?.expectedDb == null}
                />
              </div>
            )}
          </section>

          {/* --- Everything else waits below, collapsed --- */}
          <div className="mt-20 border-t border-line">
            <Disclosure
              title="Session report"
              summary={reviewSummary}
              open={open.review}
              onToggle={() => toggle("review")}
            >
              {words.length === 0 ? (
                <p className="text-body text-muted">
                  After you stop, this is your report: pauses, pace, volume, filler words, pitch and more, with a
                  transcript you can correct.
                </p>
              ) : (
                <div className="space-y-12">
                  {report && !busy && (
                    <ReportView
                      report={report}
                      script={script}
                      onScript={(notes) => {
                        setScript(notes);
                        setReport(makeReport(notes));
                      }}
                      customFillers={config.customFillers}
                      onAddFiller={(phrase) => {
                        if (config.customFillers.length < MAX_CUSTOM_FILLERS)
                          setCustomFillers([...config.customFillers, phrase]);
                      }}
                    />
                  )}
                  {report && !busy ? (
                    <dl className="grid grid-cols-2 gap-6 sm:grid-cols-5">
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
                  ) : (
                    <dl className="grid grid-cols-2 gap-6 sm:grid-cols-5">
                      <Stat
                        label="Speaking"
                        value={speakingMin >= 1 ? `${speakingMin.toFixed(1)} min` : `${Math.round(speakingSec)} s`}
                      />
                      <Stat
                        label="Taps"
                        value={String(totalCues)}
                        hint={judged ? `${worked} of ${judged} worked` : "none judged yet"}
                      />
                      <Stat
                        label="Fillers noticed"
                        value={String(noticed)}
                        hint={
                          speakingSec >= 30
                            ? `${(noticed / (speakingSec / 60)).toFixed(1)} per minute`
                            : "per minute after 30 s"
                        }
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
                  )}

                  <div>
                    <h3 className="font-display text-title-m font-medium tracking-[-0.01em] sm:text-title">
                      Transcript
                    </h3>
                    <p className="mt-1 text-body-sm text-muted">
                      Select a word to mark a wrong cue or a filler Cue missed. Hover a marked word for the reason.
                    </p>
                    <TranscriptKey />
                    <p className="mt-4 text-body leading-8">
                      {words.map((w, k) => {
                        if (!w.wearer)
                          return (
                            <span
                              key={k}
                              className="italic text-muted/70"
                              title="The bone sensor didn’t hear you say this, so it isn’t coached."
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
                            : "rounded px-1 text-cue outline-1 outline-dashed outline-cue"
                          : c
                            ? "rounded bg-surface-2 px-1"
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
                              title={`${why}${fix ? ". Marked, select to undo" : d ? ". Select if this wasn’t a filler" : ""}`}
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
                    <h3 className="font-display text-title-m font-medium tracking-[-0.01em] sm:text-title">
                      Why Cue acted
                    </h3>
                    <ul className="mt-4 divide-y divide-line">
                      {entries.map(({ key, d, c }) =>
                        c ? (
                          <li key={key} className="py-4 text-body">
                            <p className="font-medium">
                              “like” wasn’t a filler <span className="font-normal text-muted">({c.verdict.use})</span>
                            </p>
                            <p className="mt-1 text-muted">{c.verdict.reason}</p>
                            <p className="mt-1 text-body-sm text-muted">“…{c.context}…”</p>
                            <CorrectionButton
                              on={corrected.get(wordKey(c.start))?.label === "missed"}
                              onClick={() => toggleCorrection(c.start, "missed")}
                            >
                              It was a filler
                            </CorrectionButton>
                          </li>
                        ) : d ? (
                          <li key={key} className="py-4 text-body">
                            <p className="font-medium">
                              {capitalize(labelFor(d.event))}{" "}
                              <span className={`font-normal ${d.delivered ? "text-cue" : "text-muted"}`}>
                                {d.delivered
                                  ? `tapped${d.trigger ? `: ${d.trigger}` : ""}${
                                      outcomes[d.event.id] === "worked"
                                        ? ", and it worked"
                                        : outcomes[d.event.id] === "no_change"
                                          ? ", no change after"
                                          : ""
                                    }`
                                  : `held back: ${WITHHELD[d.withheldReason!]}${d.trigger ? ` (${d.trigger})` : ""}`}
                              </span>
                            </p>
                            <p className="mt-1 text-muted">{d.event.reason}</p>
                            <p className="mt-1 text-body-sm text-muted">
                              “…{d.event.context}…” {Math.round(d.event.confidence * 100)}% sure
                              {latency[d.event.id] != null &&
                                `, cued ${(latency[d.event.id] / 1000).toFixed(2)} s after`}
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
                        className="min-h-11 rounded-lg border border-line px-4 text-body hover:border-text"
                      >
                        Download session
                      </button>
                      <p className="mt-2 text-body-sm text-muted">
                        Saves what Deepgram heard, your marks, and cue timing. No audio. Keep it out of the repo.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Disclosure>

            <Disclosure
              title="Practice"
              summary="Try a sentence without a mic, or try the device’s touch controls"
              open={open.practice}
              onToggle={() => toggle("practice")}
            >
              <div className="space-y-12">
                <div>
                  <h3 className="font-display text-title-m font-medium tracking-[-0.01em] sm:text-title">
                    Try a sentence
                  </h3>
                  <p className="mt-1 text-body-sm text-muted">Cue reads it word by word, as if you were saying it.</p>
                  <textarea
                    value={demoText}
                    onChange={(e) => setDemoText(e.target.value)}
                    rows={3}
                    aria-label="Practice sentence"
                    className="mt-4 w-full resize-none rounded-lg border border-line bg-surface p-3 text-body outline-none focus:border-cue"
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
                        className="min-h-9 max-w-full truncate rounded-lg border border-line px-3 text-left text-body-sm text-muted hover:border-text hover:text-text"
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
                    <Switch
                      label="A friend cuts in with “um… like went”"
                      hint="The mic hears them; the device’s bone sensor doesn’t, so Cue ignores them."
                      on={demoFriend}
                      onChange={setDemoFriend}
                    />
                  </div>
                  <button
                    onClick={() => runDemo()}
                    disabled={live}
                    className="mt-6 min-h-11 rounded-lg bg-text px-6 text-body font-medium text-bg disabled:opacity-40"
                  >
                    Play sentence
                  </button>
                </div>

                <div>
                  <h3 className="font-display text-title-m font-medium tracking-[-0.01em] sm:text-title">
                    Try the device’s touch controls
                  </h3>
                  <p className="mt-1 text-body-sm text-muted">
                    On the device, touch is only for controls. A single tap does nothing, so fixing your hair won’t
                    trigger it.
                  </p>
                  <div className="mt-4">
                    <TouchPad onAction={onTouch} mode={presetLabel} on={!config.muted} />
                  </div>
                </div>
              </div>
            </Disclosure>

            {/* Saving recordings needs the local dev server (/api/training), so Training only shows there. */}
            {process.env.NODE_ENV === "development" && (
              <Disclosure
                title="Training"
                summary="Record yourself talking, then mark every filler to teach and test the detector"
                open={open.training}
                onToggle={() => toggle("training")}
              >
                <div className="space-y-8">
                  <div>
                    <p className="max-w-prose text-body text-muted">
                      Talk for a few minutes the way you normally do. Cue records the audio for this session only.
                      Afterwards, select every word that was a filler, then save it to the training set on this
                      computer.
                    </p>
                    <p className="mt-2 max-w-prose text-body-sm text-muted">
                      Recordings stay in the project’s <code>training/</code> folder, which is never uploaded to GitHub.
                      Only record people who have agreed to it.
                    </p>
                    <div className="mt-4">
                      {live && recordingTraining ? (
                        <button
                          onClick={endSession}
                          className="min-h-11 rounded-lg bg-text px-6 text-body font-medium text-bg"
                        >
                          Stop and label
                        </button>
                      ) : (
                        <button
                          onClick={() => startLive({ record: true })}
                          disabled={live || status === "demo"}
                          className="min-h-11 rounded-lg bg-text px-6 text-body font-medium text-bg disabled:opacity-40"
                        >
                          Start training recording
                        </button>
                      )}
                    </div>
                  </div>

                  {!busy && words.length > 0 && (trainingAudioUrl || fillerMarks.size > 0 || open.training) && (
                    <div>
                      <h3 className="font-display text-title-m font-medium tracking-[-0.01em] sm:text-title">
                        Mark the fillers
                      </h3>
                      <p className="mt-1 text-body-sm text-muted">
                        Select every word that was a filler; select again to unmark. Cue’s detections start selected, so
                        unselect any it got wrong. {trainingAudioUrl && "Play the recording to follow along."}
                      </p>
                      {trainingAudioUrl && (
                        <audio
                          controls
                          src={trainingAudioUrl}
                          className="mt-4 w-full"
                          onTimeUpdate={(e) => setPlayhead(e.currentTarget.currentTime)}
                          onEnded={() => setPlayhead(null)}
                        />
                      )}
                      <p className="mt-4 text-body leading-9">
                        {words.map((w, k) => {
                          const marked = fillerMarks.has(wordKey(w.start));
                          const now = playhead !== null && playhead >= w.start - 0.05 && playhead <= w.end + 0.05;
                          return (
                            <span key={k}>
                              <button
                                type="button"
                                aria-pressed={marked}
                                onClick={() => toggleFillerMark(w.start)}
                                className={`rounded px-1 ${marked ? "bg-cue text-bg" : "hover:bg-surface-2"} ${now ? "outline-2 outline-text" : ""}`}
                              >
                                {w.text}
                              </button>{" "}
                            </span>
                          );
                        })}
                      </p>
                      <div className="mt-6 flex flex-wrap items-center gap-4">
                        <button
                          onClick={saveTraining}
                          className="min-h-11 rounded-lg bg-text px-6 text-body font-medium text-bg"
                        >
                          Save to training set
                        </button>
                        <span className="text-body-sm text-muted">
                          {fillerMarks.size} {fillerMarks.size === 1 ? "word" : "words"} marked as fillers
                        </span>
                      </div>
                      {trainingSaved && (
                        <p className="mt-3 text-body-sm" role="status">
                          {trainingSaved}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </Disclosure>
            )}

            <Disclosure
              title="Settings"
              summary={`${presetLabel} mode, ${config.customFillers.length ? `${config.customFillers.length} of your own filler ${config.customFillers.length === 1 ? "word" : "words"}, ` : ""}${config.tapOn === "patterns" ? "taps for patterns" : "taps for every filler"}${sound.on ? ", cue sounds on" : ""}`}
              open={open.settings}
              onToggle={() => toggle("settings")}
            >
              <div className="space-y-10 text-body">
                <fieldset>
                  <legend className="font-display text-title-m font-medium tracking-[-0.01em] sm:text-title">
                    What Cue coaches
                  </legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["um", "uh", "like", "lowkey", "rushing", "pauses", "turns", "quiet"] as const).map((k) => (
                      <Chip
                        key={k}
                        on={config.categories[k]}
                        onClick={() =>
                          setConfig((c) => ({ ...c, categories: { ...c.categories, [k]: !c.categories[k] } }))
                        }
                      >
                        {CHIP_LABEL[k] ?? `“${k}”`}
                      </Chip>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <h3 className="font-display text-title-m font-medium tracking-[-0.01em] sm:text-title">
                    Your filler words
                  </h3>
                  <p className="mt-1 max-w-prose text-body-sm text-muted">
                    Add words or short phrases you lean on, like “so”, “basically” or “you know”. Cue counts one every
                    time you say it, so skip words you also use on purpose.
                  </p>
                  <form
                    className="mt-3 flex max-w-md gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      addCustomFiller();
                    }}
                  >
                    <label className="sr-only" htmlFor="custom-filler">
                      A filler word or phrase
                    </label>
                    <input
                      id="custom-filler"
                      value={fillerDraft}
                      onChange={(e) => {
                        setFillerDraft(e.target.value);
                        setFillerError(null);
                      }}
                      placeholder="you know"
                      autoComplete="off"
                      autoCapitalize="none"
                      aria-describedby={fillerError ? "custom-filler-error" : undefined}
                      className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-body placeholder:text-muted/70 focus:border-cue focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="min-h-11 rounded-lg border border-line px-4 text-label hover:border-cue"
                    >
                      Add
                    </button>
                  </form>
                  {fillerError && (
                    <p id="custom-filler-error" role="alert" className="mt-2 text-body-sm">
                      {fillerError}
                    </p>
                  )}
                  {config.customFillers.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {config.customFillers.map((f) => (
                        <li key={f}>
                          <button
                            type="button"
                            onClick={() => setCustomFillers(config.customFillers.filter((x) => x !== f))}
                            aria-label={`Remove “${f}”`}
                            className="flex min-h-11 items-center gap-2 rounded-lg border border-cue bg-cue-soft px-3 text-label hover:border-text"
                          >
                            “{f}”
                            <span aria-hidden className="text-muted">
                              ×
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-display text-title-m font-medium tracking-[-0.01em] sm:text-title">
                    How Cue taps
                  </h3>
                  <Switch
                    label="Tap for patterns, not every filler"
                    hint={
                      config.tapOn === "patterns"
                        ? `A tap needs ${config.clusterCount} fillers within ${config.clusterWindowSec} s, or ${config.densityPerMin} in a minute. One “um” is normal.`
                        : "Testing mode: every filler taps (with a short gap)."
                    }
                    on={config.tapOn === "patterns"}
                    onChange={(v) => setConfig((c) => ({ ...c, tapOn: v ? "patterns" : "every" }))}
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="font-display text-title-m font-medium tracking-[-0.01em] sm:text-title">
                    Filler “like”
                  </h3>
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
                  <h3 className="font-display text-title-m font-medium tracking-[-0.01em] sm:text-title">Thresholds</h3>
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
                    label="Quiet time between taps"
                    hint={config.mode === "presentation" ? "Presentation mode waits at least 25 s." : undefined}
                    value={config.cooldownSec}
                    min={10}
                    max={20}
                    step={1}
                    format={(v) => `${v} s`}
                    onChange={(v) => setConfig((c) => ({ ...c, cooldownSec: v }))}
                  />
                </div>

                <div className="space-y-5">
                  <h3 className="font-display text-title-m font-medium tracking-[-0.01em] sm:text-title">
                    Testing with AirPods
                  </h3>
                  <p className="max-w-prose text-body-sm text-muted">
                    Until the device exists, AirPods (or any headphones with a mic) can stand in for it: their mic
                    listens, and each cue plays as a quiet sound in your ear with the same rhythm as the tap. Set your
                    volume again with the AirPods in, since their mic hears you at a different level. Keep this page
                    open while you talk.
                  </p>
                  <Switch
                    label="Play cues as sounds"
                    hint="Each cue has its own pitch: Pause high, Slow down middle, Speak up low. Confirmations swell in softly."
                    on={sound.on}
                    onChange={(on) => saveSound({ ...sound, on })}
                  />
                  <Slider
                    label="Cue sound volume"
                    value={Math.round(sound.volume * 100)}
                    min={10}
                    max={100}
                    step={5}
                    format={(v) => `${v}%`}
                    onChange={(v) => saveSound({ ...sound, volume: v / 100 })}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      earcon().unlock();
                      earcon().play(cueTones("tap"), sound.volume);
                    }}
                    className="min-h-11 rounded-lg border border-line px-4 text-label hover:border-cue"
                  >
                    Play a test cue
                  </button>
                  <label className="block">
                    <span className="text-body">Microphone</span>
                    <select
                      value={micChoice.deviceId}
                      disabled={live}
                      onChange={(e) => {
                        const pick = mics.find((m) => m.deviceId === e.target.value);
                        const next = { deviceId: e.target.value, label: pick?.label ?? "" };
                        setMicChoice(next);
                        if (next.label) rememberMic(next.label);
                        try {
                          localStorage.setItem(MIC_STORAGE, JSON.stringify(next));
                        } catch {
                          // Storage blocked: the choice lasts until the page closes.
                        }
                      }}
                      className="mt-2 block min-h-11 w-full max-w-sm rounded-lg border border-line bg-surface px-3 text-body"
                    >
                      <option value="">Default microphone</option>
                      {mics.map((m, k) => (
                        <option key={m.deviceId} value={m.deviceId}>
                          {m.label || `Microphone ${k + 1}`}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-body-sm text-muted">
                      {mics.some((m) => m.label)
                        ? micLabel
                          ? `Last used: ${micLabel}.`
                          : "Pick the AirPods, or leave the default."
                        : "Names appear after you allow the microphone once (Start listening)."}{" "}
                      On iPhone, connected AirPods are used automatically.
                    </span>
                  </label>
                </div>

                <div>
                  <h3 className="font-display text-title-m font-medium tracking-[-0.01em] sm:text-title">Privacy</h3>
                  <p className="mt-2 max-w-prose text-muted">
                    While you listen, audio streams to Deepgram to be transcribed. If you add your own Deepgram key, it
                    stays in this browser and goes straight to Deepgram. Cue keeps nothing on its own. A session is only
                    saved if you choose Download session, and that file has words and timing, never audio. Cue never
                    builds a voiceprint: on the device, a bone-conduction sensor hears only your own voice. In this web
                    prototype the microphone hears everyone, so other people’s fillers can tap too.
                  </p>
                </div>
              </div>
            </Disclosure>
          </div>
        </div>
      </div>
    </main>
  );
}

const KEY_STORAGE = "cue.deepgramKey";

/**
 * Use your own Deepgram key: for a deployment with no key of its own, or anyone who'd rather
 * pay for their own transcription. The key stays in the browser and goes straight to Deepgram.
 */
function DeepgramKey({
  value,
  remember,
  open,
  onOpen,
  onCancel,
  onRemove,
  onSave,
}: {
  value: string;
  remember: boolean;
  open: boolean;
  onOpen: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onSave: (key: string, remember: boolean) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [keep, setKeep] = useState(remember);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    // Start each edit from what's saved.
    setWasOpen(open);
    if (open) {
      setDraft(value);
      setKeep(remember);
    }
  }

  if (!open) {
    return value ? (
      <p className="text-body-sm text-muted">
        Listening uses your Deepgram key.{" "}
        <button onClick={onOpen} className="underline underline-offset-2 hover:text-text">
          Change
        </button>{" "}
        or{" "}
        <button onClick={onRemove} className="underline underline-offset-2 hover:text-text">
          remove it
        </button>
      </p>
    ) : (
      <button onClick={onOpen} className="text-body-sm text-muted underline underline-offset-2 hover:text-text">
        Use your own Deepgram key
      </button>
    );
  }

  const key = draft.trim();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (key) onSave(key, keep);
      }}
      className="mt-2 w-full max-w-md rounded-lg border border-line bg-surface p-4 text-left"
    >
      <label htmlFor="dg-key" className="text-label font-medium">
        Deepgram API key
      </label>
      <input
        id="dg-key"
        type="password"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        autoFocus
        className="mt-1.5 min-h-11 w-full rounded-lg border border-line bg-bg px-3 font-mono text-body-sm focus:border-text focus:outline-none"
      />
      <label className="mt-3 flex items-center gap-2 text-body-sm">
        <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="accent-cue" />
        Remember on this device
      </label>
      <p className="mt-3 text-caption text-muted">
        Your key stays in this browser and goes straight to Deepgram; Cue’s server never sees it. Without “remember”,
        it’s forgotten when you close the tab. No key yet? New accounts at{" "}
        <a
          href="https://console.deepgram.com/signup"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-text"
        >
          console.deepgram.com
        </a>{" "}
        come with free credit.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!key}
          className="min-h-11 rounded-lg bg-text px-5 text-body-sm font-medium text-bg disabled:opacity-40"
        >
          Save and start listening
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-lg border border-line px-5 text-body-sm hover:border-text"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const VOLUME_BY_MIC_STORAGE = "cue.volumeTargetByMic.v2";
/** Where volumes were saved before the K-weighted level (decision 21). */
const OLD_VOLUME_STORAGE = ["cue.volumeTarget", "cue.volumeTargetByMic"];
const MIC_STORAGE = "cue.mic";
const MIC_LABEL_STORAGE = "cue.micLabel";
const SOUND_STORAGE = "cue.sound";

interface SoundSettings {
  on: boolean;
  /** 0–1. */
  volume: number;
}
const DEFAULT_SOUND: SoundSettings = { on: false, volume: 0.5 };

interface MicChoice {
  /** Empty: the browser's default microphone. */
  deviceId: string;
  label: string;
}
const VOLUME_CUES_STORAGE = "cue.volumeCues";

const CUSTOM_FILLERS_STORAGE = "cue.customFillers";

const CHIP_LABEL: Partial<Record<keyof CueConfig["categories"], string>> = {
  rushing: "Speaking fast",
  pauses: "No pauses",
  turns: "Long turns",
  quiet: "Speaking quietly",
};

/** What the hero says under the cue word: why Cue tapped. */
function describeTap(d: CueDecision): string {
  const n = d.trigger?.match(/^(\d+) in (\d+) s$/);
  if (d.tapReason === "filler_cluster" && n) return `${n[1]} fillers in ${n[2]} seconds`;
  if (d.tapReason === "filler_density" && d.trigger) return `${d.trigger.replace(/^(\d+) in/, "$1 fillers in")}`;
  if (d.event.type === "no_pause" || d.event.type === "long_turn") return capitalize(d.event.reason);
  return capitalize(labelFor(d.event));
}

const capitalize = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const formatDb = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(Math.round(x))} dB`;

/** A cue's rhythm drawn as beats: each pulse's length and gap to scale, lit in time when played. */
function RhythmGlyph({ pattern }: { pattern: CuePattern }) {
  const v = PATTERNS[pattern].vibrate;
  const beats = v.flatMap((ms, k) =>
    k % 2 === 0 ? [{ start: v.slice(0, k).reduce((a, b) => a + b, 0), ms, gap: v[k + 1] ?? 0 }] : [],
  );
  return (
    <span className="flex h-3 items-center" aria-hidden>
      {beats.map((b, k) => (
        <span
          key={k}
          className="beat h-3 rounded-sm bg-cue opacity-35"
          style={
            {
              width: Math.max(3, Math.round(b.ms / 12)),
              marginRight: k < beats.length - 1 ? Math.max(2, Math.round(b.gap / 12)) : 0,
              "--beat-delay": `${b.start}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

function MicState({ status, recording }: { status: Status; recording: boolean }) {
  const on = status === "listening";
  const text = {
    idle: "Microphone off",
    connecting: "Connecting…",
    listening: recording ? "Recording for training" : "Microphone on",
    demo: "Microphone off",
    error: "Microphone off",
  }[status];
  return (
    <span
      className={`flex min-h-8 items-center gap-2 rounded-full border px-3 text-label ${on ? "border-text text-text" : "border-line text-muted"}`}
      role="status"
    >
      <span className={`h-2 w-2 rounded-full ${on ? "motion-safe:animate-pulse bg-text" : "bg-line"}`} aria-hidden />
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
            <span className="block font-display text-heading-3-m font-semibold tracking-[-0.015em] sm:text-heading-3">
              {title}
            </span>
            <span className="mt-1 block text-body-sm text-muted">{summary}</span>
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
      <div className="flex items-baseline justify-between gap-3 text-label">
        <span className="font-medium">{label}</span>
        <span className="text-right tabular-nums text-muted">{value}</span>
      </div>
      <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full transition-all duration-300 ${learning ? "bg-neutral-soft" : alert ? "bg-text" : "bg-neutral"}`}
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
          className={`min-h-11 rounded-lg px-3 text-label transition-colors duration-200 ${
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
      className="flex min-h-11 items-center gap-3 text-left"
    >
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-cue" : "bg-line"}`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow-sm transition-transform duration-200 ${on ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </span>
      <span className="text-label sm:text-body">
        {label}
        {hint && <span className="block text-body-sm text-muted">{hint}</span>}
      </span>
    </button>
  );
}

function Slider(props: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3 text-body">
        {props.label}
        <span className="text-right text-body-sm tabular-nums text-muted">{props.format(props.value)}</span>
      </span>
      {props.hint && <span className="block text-body-sm text-muted">{props.hint}</span>}
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
      className={`min-h-11 rounded-lg border px-3 text-label transition-colors duration-200 ${on ? "border-cue bg-cue-soft text-text" : "border-line text-muted hover:text-text"}`}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-label text-muted">{label}</dt>
      <dd className="mt-1 font-display text-heading-3-m font-semibold tabular-nums tracking-[-0.015em] sm:text-heading-3">
        {value}
      </dd>
      {hint && <dd className="mt-0.5 text-caption text-muted">{hint}</dd>}
    </div>
  );
}

const VERDICT_TAG: Record<ReportSection["verdict"], string> = {
  improve: "Work on this",
  good: "Going well",
  none: "No data",
};

/** The after-session report: what to work on, then one card per area a speaking coach would comment on. */
function ReportView({
  report,
  script,
  onScript,
  customFillers,
  onAddFiller,
}: {
  report: SessionReport;
  script: string;
  onScript: (notes: string) => void;
  customFillers: string[];
  onAddFiller: (phrase: string) => void;
}) {
  const suggested = report.suggestedFillers.filter((f) => !customFillers.includes(f.phrase));
  const given = report.cues.reduce((n, c) => n + c.count, 0);
  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-display text-title-m font-medium tracking-[-0.01em] sm:text-title">
          {report.focus.length ? "Work on next" : "Nothing to work on from this one"}
        </h3>
        {report.focus.length ? (
          <ol className="mt-3 space-y-2">
            {report.focus.map((advice, k) => (
              <li key={k} className="flex gap-3 text-body">
                <span className="font-display font-semibold tabular-nums text-cue">{k + 1}</span>
                <span className="max-w-prose">{advice}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 max-w-prose text-body text-muted">
            Nothing here crossed a line worth changing. Longer sessions give the report more to go on.
          </p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat
          label="Talking time"
          value={report.talkSec >= 60 ? `${(report.talkSec / 60).toFixed(1)} min` : `${Math.round(report.talkSec)} s`}
        />
        <Stat label="Words" value={String(report.wordCount)} />
        <Stat
          label="Cues given"
          value={String(given)}
          hint={report.cues.map((c) => `${c.action} ${c.count}`).join(", ")}
        />
        <Stat
          label="Cues that worked"
          value={(() => {
            const judged = report.cues.reduce((n, c) => n + c.judged, 0);
            return judged ? `${report.cues.reduce((n, c) => n + c.worked, 0)} of ${judged}` : "None yet";
          })()}
          hint="You paused, slowed or spoke up after"
        />
      </dl>

      <div className="grid gap-4 sm:grid-cols-2">
        {report.sections.map((s) => (
          <section key={s.key} className="rounded-lg border border-line p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="text-label font-medium">{s.title}</h4>
              <span
                className={`whitespace-nowrap rounded px-2 py-0.5 text-caption ${s.verdict === "improve" ? "bg-cue-soft text-cue" : "text-muted"}`}
              >
                {VERDICT_TAG[s.verdict]}
              </span>
            </div>
            <p
              className={`mt-3 font-display text-title-m font-medium tracking-[-0.01em] ${s.verdict === "none" ? "text-muted" : ""}`}
            >
              {s.headline}
            </p>
            {s.advice && <p className="mt-2 text-body-sm text-muted">{s.advice}</p>}
            {s.stats.length > 0 && (
              <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
                {s.stats.map((x) => (
                  <div key={x.label}>
                    <dt className="text-caption text-muted">{x.label}</dt>
                    <dd className="text-body font-medium tabular-nums">{x.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {s.key === "pace" && report.paceTimeline.length > 2 && (
              <PaceChart timeline={report.paceTimeline} limitWpm={report.paceLimitWpm} />
            )}
            {s.key === "fillers" && report.fillers.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {report.fillers.map((f) => (
                  <li key={f.word} className="rounded bg-surface-2 px-2 py-1 text-body-sm tabular-nums">
                    “{f.word}” <span className="text-muted">× {f.count}</span>
                  </li>
                ))}
              </ul>
            )}
            {s.key === "fillers" && suggested.length > 0 && (
              <div className="mt-4">
                <p className="text-caption text-muted">
                  You also said these a lot. Add any that are fillers for you, and Cue will count them next time.
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {suggested.map((f) => (
                    <li key={f.phrase}>
                      <button
                        type="button"
                        onClick={() => onAddFiller(f.phrase)}
                        className="flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-body-sm hover:border-cue"
                      >
                        <span>
                          “{f.phrase}” <span className="tabular-nums text-muted">× {f.count}</span>
                        </span>
                        <span aria-hidden>+</span>
                        <span className="sr-only">Add to your filler words</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {s.key === "inclusive" && report.inclusive.length > 0 && (
              <ul className="mt-4 space-y-3">
                {report.inclusive.map((f) => (
                  <li key={f.phrase} className="text-body-sm">
                    <p>
                      <span className="font-medium">“{f.phrase}”</span>
                      {f.count > 1 && <span className="text-muted"> × {f.count}</span>}
                      <span className="text-muted"> Try: {f.instead}.</span>
                    </p>
                    <p className="mt-0.5 text-muted">“…{f.context}…”</p>
                  </li>
                ))}
              </ul>
            )}
            {s.key === "originality" && (
              <div className="mt-4">
                <label htmlFor="report-notes" className="text-caption text-muted">
                  Your notes or script. They stay in this browser tab.
                </label>
                <textarea
                  id="report-notes"
                  value={script}
                  onChange={(e) => onScript(e.target.value)}
                  rows={3}
                  placeholder="Paste what you planned to say"
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-body-sm placeholder:text-muted/70 focus:border-cue focus:outline-none"
                />
              </div>
            )}
          </section>
        ))}
      </div>
      <p className="max-w-prose text-body-sm text-muted">
        These lines are starting points and haven’t been tested with many speakers yet. Pitch and volume need a
        microphone session; a typed practice sentence has no voice to measure.
      </p>
    </div>
  );
}

/** Pace through the session as a line, with the rushing limit dashed across it. */
function PaceChart({ timeline, limitWpm }: { timeline: { t: number; wpm: number }[]; limitWpm: number }) {
  const W = 300;
  const H = 56;
  const lo = Math.min(limitWpm * 0.6, ...timeline.map((p) => p.wpm));
  const hi = Math.max(limitWpm * 1.15, ...timeline.map((p) => p.wpm));
  const t0 = timeline[0].t;
  const span = Math.max(1, timeline[timeline.length - 1].t - t0);
  const y = (wpm: number) => H - 4 - ((wpm - lo) / (hi - lo)) * (H - 8);
  const points = timeline.map((p) => `${(((p.t - t0) / span) * W).toFixed(1)},${y(p.wpm).toFixed(1)}`).join(" ");
  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Pace through the session, between ${Math.round(Math.min(...timeline.map((p) => p.wpm)))} and ${Math.round(Math.max(...timeline.map((p) => p.wpm)))} words a minute`}
        className="h-14 w-full"
      >
        <line
          x1="0"
          x2={W}
          y1={y(limitWpm)}
          y2={y(limitWpm)}
          stroke="var(--muted)"
          strokeWidth="1"
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={points}
          fill="none"
          stroke="var(--text)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <figcaption className="mt-1 text-caption text-muted">
        Start to finish. Above the dashed line (about {limitWpm} wpm) is rushing.
      </figcaption>
    </figure>
  );
}

function CorrectionButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`mt-3 min-h-11 rounded-lg border px-3 text-label ${on ? "border-text bg-surface-2 text-text" : "border-line text-muted hover:text-text"}`}
    >
      {on ? `Marked: ${children.toLowerCase()}` : children}
    </button>
  );
}

function TranscriptKey() {
  return (
    <ul
      className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-body-sm text-muted"
      aria-label="What the transcript markings mean"
    >
      <li>
        <span className="rounded bg-cue-soft px-1 text-cue">like</span> cued
      </li>
      <li>
        <span className="rounded px-1 text-cue outline-1 outline-dashed outline-cue">like</span> noticed, held back
      </li>
      <li>
        <span className="rounded bg-surface-2 px-1 text-text">like</span> not a filler
      </li>
      <li>
        <span className="text-text line-through decoration-2">like</span> you marked wrong
      </li>
      <li>
        <span className="rounded px-0.5 text-text ring-1 ring-text">like</span> you marked missed
      </li>
      <li>
        <span className="italic text-muted/70">um</span> not you (bone sensor)
      </li>
    </ul>
  );
}

/**
 * Stand-in for the device's touch surface (controls only). Hold 1.5 s = on/off,
 * double-tap = switch mode; a single tap does nothing, as on the real device.
 */
function TouchPad({ onAction, mode, on }: { onAction: (a: TouchAction) => void; mode: string; on: boolean }) {
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
        aria-label="Simulated touch surface on the device: hold 1.5 seconds to turn Cue on or off, double-tap to switch mode"
        className={`touch-pad relative grid h-20 w-20 shrink-0 touch-none select-none place-items-center rounded-full border border-neutral bg-neutral-soft text-body-sm font-medium ${pressing ? "pressing" : ""}`}
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
        Device
      </button>
      <div className="text-body">
        <p>Hold for 1.5 seconds to turn Cue {on ? "off" : "on"}.</p>
        <p>Double-tap to switch mode. Now: {mode}.</p>
        <p className="mt-1 min-h-5 text-body-sm text-muted" aria-live="polite">
          {hint}
        </p>
      </div>
    </div>
  );
}
