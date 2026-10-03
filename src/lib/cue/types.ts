/** One recognized word with timing, as produced by the speech engine (seconds). */
export interface Word {
  /** Display text, possibly with punctuation ("like,"). */
  text: string;
  /** Lowercased, punctuation-stripped form used for matching ("like"). */
  norm: string;
  start: number;
  end: number;
  /** ASR confidence 0..1. */
  confidence: number;
}

export type BehaviorType = "filler_um" | "filler_uh" | "filler_like" | "rushing";

/**
 * How a particular "like" is being used. Only some of these are fillers;
 * which ones count is decided by config (see LikeConfig).
 */
export type LikeUse =
  | "discourse" // "I like went to the mall" — pure filler
  | "quotative" // "she was like, no way"
  | "approximator" // "there were like twenty people"
  | "verb" // "I like tofu"
  | "comparison" // "it looks like rain", "it was like a dream"
  | "example" // "things like that"
  | "conjunction" // "like I said"
  | "hedge" // "kind of like"
  | "unknown";

export interface LikeVerdict {
  use: LikeUse;
  /** How sure the rules are about `use`, 0..1. */
  confidence: number;
  /** Human-readable explanation, shown in the app's event log. */
  reason: string;
}

/** A model-observed behavior candidate. Detection is separate from the decision to cue. */
export interface SpeechEvent {
  id: string;
  type: BehaviorType;
  /** Seconds, on the speech engine's clock. */
  start: number;
  end: number;
  /** Probability this is a target behavior, 0..1. */
  confidence: number;
  reason: string;
  /** Surrounding words, for the event log. */
  context: string;
  like?: LikeVerdict;
  pace?: { sps: number; wpm: number };
}

export interface CueDecision {
  event: SpeechEvent;
  delivered: boolean;
  /** Why a cue was withheld, if it was. */
  withheldReason?: "low_confidence" | "cooldown" | "muted" | "category_off";
}

/** Every "like" the classifier judged, filler or not — so misses are explainable. */
export interface LikeCheck {
  id: string;
  start: number;
  context: string;
  verdict: LikeVerdict;
  /** Whether this use counts as a filler under the current settings. */
  counted: boolean;
}
