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
