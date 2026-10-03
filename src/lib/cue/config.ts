export type PaceMode = "conversation" | "presentation" | "custom";

/**
 * Rushing thresholds in syllables/second, measured over speaking time (pauses
 * > 0.6 s removed). Derived from published norms: ~150 wpm conversation, 120–160
 * wpm for presentations, typical English ~4 syll/s. These are starting points to
 * validate against real users, not established cutoffs.
 */
export const PACE_PRESETS: Record<Exclude<PaceMode, "custom">, { label: string; threshold: number }> = {
  conversation: { label: "Conversation", threshold: 4.5 },
  presentation: { label: "Presentation / interview", threshold: 4.0 },
};

/** Average syllables per word in conversational English, used only to show an approximate wpm. */
export const SYLLABLES_PER_WORD = 1.4;

export const toApproxWpm = (sps: number) => Math.round((sps * 60) / SYLLABLES_PER_WORD);

export interface CueConfig {
  categories: { um: boolean; uh: boolean; like: boolean; rushing: boolean };
  /** Which non-discourse "like" uses also count as fillers. */
  likeCounts: { quotative: boolean; approximator: boolean };
  /** Minimum detection confidence that may produce a buzz. */
  minConfidence: number;
  /** Which pace preset is active; "custom" when the slider was moved. */
  paceMode: PaceMode;
  /** Speaking rate (syllables/s, long pauses excluded) considered rushing. */
  paceThreshold: number;
  /** Rolling window used to measure pace, seconds. */
  paceWindowSec: number;
  /** Pace must stay above threshold this long before cueing, seconds. */
  paceSustainSec: number;
  /** Minimum gap between any two buzzes, seconds. */
  cooldownSec: number;
  /** Minimum gap between two pace buzzes, seconds. */
  paceCooldownSec: number;
  muted: boolean;
}

export const DEFAULT_CONFIG: CueConfig = {
  categories: { um: true, uh: true, like: true, rushing: true },
  likeCounts: { quotative: true, approximator: false },
  minConfidence: 0.75,
  paceMode: "conversation",
  paceThreshold: 4.5,
  paceWindowSec: 8,
  paceSustainSec: 3,
  cooldownSec: 2.5,
  paceCooldownSec: 12,
  muted: false,
};
