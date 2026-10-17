import type { CueMode } from "@/lib/cue/config";
import type { Outcome } from "@/lib/cue/engine";
import type { CoachedBehavior, CoachingPlan, FocusKey, Intensity, Strategy } from "@/lib/cue/plan";

/**
 * The personal communication profile: everything Cue remembers about one wearer between
 * sessions. It holds derived numbers only (no audio and no transcripts): per-session summaries,
 * what happened around each tap, what the wearer told Cue, and the log of how Cue changed.
 *
 * Versioned so it can be migrated (CUE_CONTEXT.md §15, "All schemas should be versioned").
 */
export const PROFILE_VERSION = 1;

/** Where a session came from. Only "live" sessions teach Cue about the wearer's real speech. */
export type SessionSource = "live" | "practice" | "simulated";

/** The wearer's verdict on one kind of tap in one session. */
export type Rating = "helpful" | "too_many" | "distracting";

/** A summary of one session: the numbers pattern discovery and evaluation work from. */
export interface SessionDigest {
  id: string;
  /** When it ended (ISO). */
  at: string;
  source: SessionSource;
  mode: CueMode;
  /** What kind of session the wearer said it was ("interview", "meeting", …), if they said. */
  context: string | null;
  talkSec: number;
  wordCount: number;
  pace: {
    /** Median pace over the session's 5 s samples, syllables/s. */
    medianSps: number | null;
    samples: number;
    /** The rushing limit the session ended with (syllables/s). */
    limitSps: number;
    /** Share of pace samples over that limit. */
    rushShare: number | null;
    /** Median pace in the first minute vs the rest (sessions of 2.5 min or more). */
    openingSps: number | null;
    restSps: number | null;
    /** Mean change between successive pace samples within long turns (≥30 s) vs shorter turns. */
    jitterLong: number | null;
    jitterShort: number | null;
  };
  fillers: {
    total: number;
    perMin: number | null;
    byWord: Record<string, number>;
    /** Fillers per minute in the first 6 s of each turn (answering) vs the rest. */
    turnStartRate: number | null;
    restRate: number | null;
    /** Fillers per minute while faster than usual vs at a normal pace. */
    fastRate: number | null;
    normalRate: number | null;
    firstHalfRate: number | null;
    secondHalfRate: number | null;
    /** The counts and exposure (s) behind those rates, so sessions can be pooled. */
    counts: {
      turnStart: [number, number] | null;
      fast: [number, number] | null;
      secondHalf: [number, number] | null;
    };
  };
  pauses: {
    perMin: number | null;
    medianSec: number | null;
    longestStretchSec: number;
    /** Share of talk time spent past the no-pause limit. */
    overLimitShare: number;
  };
  turns: { count: number; medianSec: number | null };
  repetition: {
    /** Immediate restarts ("I think I think", "and then and then"). */
    restarts: number;
    perMin: number | null;
    /** Restarts right at the start of a sentence. */
    atStart: number;
    /** Mean pace in the few seconds before a restart, syllables/s. */
    preSps: number | null;
    preN: number;
  };
  /** Short phrases said three or more times this session (no other words are kept). */
  phrases: { phrase: string; count: number }[];
  /** What the session coached with, so experiments know which strategy it used. */
  plan: {
    focus: FocusKey | null;
    strategies: Record<CoachedBehavior, Strategy>;
    paceBaselineSps: number | null;
  };
  taps: number;
  feedback: Partial<Record<CoachedBehavior, Rating>>;
}

/** One tap that was due, delivered or held back, and what happened around it. */
export interface InterventionRecord {
  sessionId: string;
  /** Seconds into the session. */
  at: number;
  behavior: CoachedBehavior;
  strategy: Strategy;
  holdout: boolean;
  outcome: Outcome | null;
  pre: number | null;
  post: number | null;
  focus: boolean;
  intensity: Intensity;
}

export type Confidence = "emerging" | "likely" | "strong";

/** A pattern Cue found in the wearer's speech across sessions. */
export interface Insight {
  /** Stable: the same pattern keeps its id as evidence grows. */
  id: string;
  kind: string;
  statement: string;
  /** The evidence behind it, in plain words. */
  detail: string;
  /** 0–1: one minus a sign-test p-value across sessions, or similar. */
  confidence: number;
  level: Confidence;
  sessions: number;
  /** A pattern that links two behaviors ("faster before repeating"). */
  combination: boolean;
  firstSeen: string;
  updatedAt: string;
  /** "rejected": the wearer said it's wrong. Cue hides it and stops acting on it. */
  status: "active" | "confirmed" | "rejected";
  /** Cue noticed it but it's no longer supported by recent sessions. */
  stale?: boolean;
}

export type PreferenceKind = "intensity" | "fewer_taps" | "dont_coach" | "goal" | "less_often";

/** Something the wearer told Cue, or that Cue inferred from their feedback. */
export interface Preference {
  id: string;
  kind: PreferenceKind;
  behavior?: CoachedBehavior;
  mode?: CueMode | null;
  value?: string;
  statement: string;
  /** "you": the wearer said it. "cue": inferred from feedback, until the wearer confirms it. */
  source: "you" | "cue";
  status: "active" | "confirmed" | "rejected";
  why: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentArm {
  sessionId: string;
  arm: "control" | "candidate";
  metric: number;
  tapsPerMin: number;
  worked: number;
  judged: number;
  negative: boolean;
}

/** A comparison of two coaching strategies for one behavior across comparable sessions. */
export interface Experiment {
  id: string;
  behavior: CoachedBehavior;
  mode: CueMode;
  control: Strategy;
  candidate: Strategy;
  /** "alternate": sessions take turns. "switch": the wearer asked for less, so Cue switched and watches. */
  design: "alternate" | "switch";
  trigger: string;
  startedAt: string;
  arms: ExperimentArm[];
  /** For "switch": the metric in comparable sessions before it started. */
  before: number[];
  status: "running" | "adopted" | "kept_control" | "kept_by_you";
  concludedAt?: string;
  finding?: string;
  /** For an adopted candidate: clearly better (true), or as good with less intervention (false). */
  better?: boolean;
}

/** One change in how Cue coaches, tied to what caused it. */
export interface Adaptation {
  id: string;
  at: string;
  /** The plan field that changed, e.g. "conversation.rushing.strategy". */
  field: string;
  learned: string;
  changed: string;
  from: string;
  to: string;
  basis: string[];
}

export type EventKind =
  | "baseline"
  | "pattern"
  | "preference"
  | "adaptation"
  | "experiment"
  | "focus"
  | "improvement"
  | "correction"
  | "reset";

/** One entry in the learning timeline. */
export interface LearningEvent {
  id: string;
  at: string;
  /** "you": how the wearer changed. "cue": how Cue changed. */
  track: "you" | "cue";
  kind: EventKind;
  title: string;
  why: string;
}

/** A "Cue updated" moment, shown once after a session. */
export interface CueUpdate {
  id: string;
  at: string;
  label: "Cue updated" | "Something new I've learned" | "Your new focus";
  text: string;
  /** What the wearer can correct from the card. */
  ref: { insight?: string; preference?: string; experiment?: string; focus?: FocusKey };
  status: "new" | "seen" | "corrected";
}

export interface FocusState {
  current: FocusKey | null;
  chosenBy: "cue" | "you";
  since: string | null;
  /** The focus metric when it started, to judge progress against. */
  startMetric: number | null;
  sessionsOnFocus: number;
  /** A focus Cue recommends but hasn't switched to (the wearer chose the current one). */
  suggestion: { key: FocusKey; why: string } | null;
  why: string;
  graduated: { key: FocusKey; at: string }[];
}

export interface Profile {
  version: number;
  createdAt: string;
  /** Learning paused: sessions aren't remembered. */
  learning: boolean;
  /** Cue may hold back a few taps on purpose to check they help. */
  experiments: boolean;
  sessions: SessionDigest[];
  interventions: InterventionRecord[];
  insights: Insight[];
  preferences: Preference[];
  experimentsLog: Experiment[];
  adaptations: Adaptation[];
  events: LearningEvent[];
  updates: CueUpdate[];
  focus: FocusState;
  /** Behaviors Cue is stepping back from because the wearer improved (by "behavior:mode"). */
  faded: Record<string, string>;
  /** Improvement milestones already announced (by "behavior:mode:step"). */
  milestones: string[];
  /** The plan the next session coaches with. */
  plan: CoachingPlan;
}
