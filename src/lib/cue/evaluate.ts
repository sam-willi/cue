import { feedMessage, type DgMessage } from "@/lib/deepgram/parse";
import type { CueConfig } from "./config";
import { CueSession } from "./session";
import type { BehaviorType, CueDecision } from "./types";

/** A user's verdict on one moment of a session, made in the app. */
export interface Correction {
  /** Engine-clock start (s) of the word in question. */
  start: number;
  word: string;
  /** "false_buzz": Cue flagged a filler that wasn't one. "missed": Cue should have flagged it. */
  label: "false_buzz" | "missed";
}

/** What "Download session" saves: the raw Deepgram stream plus the user's labels. No audio. */
export interface SessionFile {
  version: 2;
  savedAt: string;
  config: CueConfig;
  messages: DgMessage[];
  corrections: Correction[];
  /** Mic level frames as [engine time s, dBFS], for replaying volume cues. */
  levels?: [number, number][];
  /** Bone-conduction voice activity frames as [engine time s, active], when a cuff is used. */
  bone?: [number, boolean][];
  /** Measured cue delays in this session, ms after the filler ended. */
  latenciesMs?: number[];
  /**
   * Ground truth from a training recording: every word the user marked as a filler
   * (anything not listed is not a filler). Present only for labeled training sessions.
   */
  fillerLabels?: { start: number; word: string }[];
}

export interface LabelScore {
  /** Fillers Cue detected that the user also marked. */
  caught: number;
  /** Marked fillers Cue didn't detect. */
  missed: { start: number; word: string }[];
  /** Detections the user didn't mark as fillers. */
  wrong: { start: number; word: string }[];
  /** caught / (caught + wrong); 1 when Cue detected nothing. */
  precision: number;
  /** caught / (caught + missed); 1 when nothing was marked. */
  recall: number;
}

/**
 * Score a labeled training session: replay it through the current detector and compare
 * its filler detections, word by word, with the words the user marked as fillers.
 */
export function scoreLabels(file: SessionFile, config?: Partial<CueConfig>): LabelScore | null {
  if (!file.fillerLabels) return null;
  const session = new CueSession({ ...file.config, muted: false, ...config });
  for (const [t, db] of file.levels ?? []) session.ingestLevel(t, db);
  for (const [t, active] of file.bone ?? []) session.ingestBone(t, active);
  for (const msg of file.messages) feedMessage(session, msg);
  session.endUtterance();
  const detected = session.history.filter(wouldCue).map((d) => ({ start: d.event.start, word: d.event.context }));
  const marked = file.fillerLabels;
  const near = (a: { start: number }, list: { start: number }[]) =>
    list.some((b) => Math.abs(a.start - b.start) < SAME_WORD);
  const caught = marked.filter((m) => near(m, detected)).length;
  const missed = marked.filter((m) => !near(m, detected));
  const wrong = detected
    .filter((d) => !near(d, marked))
    .map((d) => ({
      start: d.start,
      word: session.words.find((w) => Math.abs(w.start - d.start) < SAME_WORD)?.norm ?? d.word,
    }));
  return {
    caught,
    missed,
    wrong,
    precision: caught + wrong.length ? caught / (caught + wrong.length) : 1,
    recall: caught + missed.length ? caught / (caught + missed.length) : 1,
  };
}

const SAME_WORD = 0.25;
const FILLER_TYPES: BehaviorType[] = ["filler_um", "filler_uh", "filler_like", "filler_lowkey"];

/** A detection that would have buzzed if cooldown and mute didn't apply. */
const wouldCue = (d: CueDecision) =>
  FILLER_TYPES.includes(d.event.type) && d.withheldReason !== "low_confidence" && d.withheldReason !== "category_off";

export interface SessionScore {
  speakingMinutes: number;
  detections: number;
  falseBuzzes: { labeled: number; stillFiring: Correction[] };
  misses: { labeled: number; stillMissed: Correction[] };
  /** Still-firing labeled false buzzes per speaking hour (lower bound: unlabeled cues are assumed right). */
  falseBuzzesPerHour: number;
}

/**
 * Replay a saved session through the current detector and check it against the
 * user's corrections. Unlabeled detections are assumed correct.
 */
export function evaluateSession(file: SessionFile, config?: Partial<CueConfig>): SessionScore {
  const session = new CueSession({ ...file.config, muted: false, ...config });
  // Level frames are keyed by audio time, so they can all be loaded before the words.
  for (const [t, db] of file.levels ?? []) session.ingestLevel(t, db);
  for (const [t, active] of file.bone ?? []) session.ingestBone(t, active);
  for (const msg of file.messages) feedMessage(session, msg);
  session.endUtterance();

  const detected = session.history.filter(wouldCue);
  const near = (c: Correction) => detected.some((d) => Math.abs(d.event.start - c.start) < SAME_WORD);
  const fb = file.corrections.filter((c) => c.label === "false_buzz");
  const missed = file.corrections.filter((c) => c.label === "missed");
  const stillFiring = fb.filter(near);
  const speakingMinutes = session.speakingSeconds() / 60;

  return {
    speakingMinutes,
    detections: detected.length,
    falseBuzzes: { labeled: fb.length, stillFiring },
    misses: { labeled: missed.length, stillMissed: missed.filter((c) => !near(c)) },
    falseBuzzesPerHour: speakingMinutes > 0 ? (stillFiring.length / speakingMinutes) * 60 : 0,
  };
}
