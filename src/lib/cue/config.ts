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
  categories: {
    um: boolean;
    uh: boolean;
    like: boolean;
    lowkey: boolean;
    repetition: boolean;
    rushing: boolean;
    pauses: boolean;
    turns: boolean;
    quiet: boolean;
  };
  /**
   * "patterns" (default, SOFTWARE.md §7): fillers tap only as a cluster or a high rate.
   * "every": tap on each filler, for testing detection.
   */
  tapOn: "patterns" | "every";
  /** A cluster: this many fillers or repetitions… */
  clusterCount: number;
  /** …within this many seconds. */
  clusterWindowSec: number;
  /** Or this many in the last minute. */
  densityPerMin: number;
  /** Tap if the wearer has talked this long (s) without a meaningful pause. */
  noPauseSec: number;
  /** Tap if the wearer's speaking turn runs this long (s). */
  longTurnSec: number;
  /** A sustained behavior that continues this long (s) after a tap may be tapped again. */
  reTapAfterSec: number;
  /** How long after a tap (s) to judge whether it worked. */
  outcomeWindowSec: number;
  /** Seconds of the wearer's speech used to learn their normal pace (then rushing is relative to it). */
  paceBaselineSec: number;
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
  /** Minimum gap between any two taps, seconds (SOFTWARE.md §13: 10–20 s). */
  cooldownSec: number;
  /** Seconds of speech used to learn the wearer's normal speaking level. */
  calibrationSec: number;
  /** "Too quiet" = this many dB below the wearer's normal level… */
  quietDropDb: number;
  /** …for at least this long, seconds. */
  quietSustainSec: number;
  muted: boolean;
  /** Different haptic rhythms per alert (filler / pace / volume) instead of one tap for all. */
  distinctCues: boolean;
}

export const DEFAULT_CONFIG: CueConfig = {
  categories: {
    um: true,
    uh: true,
    like: true,
    lowkey: true,
    repetition: true,
    rushing: true,
    pauses: true,
    turns: true,
    quiet: true,
  },
  tapOn: "patterns",
  clusterCount: 3,
  clusterWindowSec: 12,
  densityPerMin: 8,
  noPauseSec: 30,
  longTurnSec: 90,
  reTapAfterSec: 45,
  outcomeWindowSec: 8,
  paceBaselineSec: 60,
  likeCounts: { quotative: true, approximator: false },
  minConfidence: 0.8,
  paceMode: "conversation",
  paceThreshold: 4.5,
  paceWindowSec: 8,
  paceSustainSec: 3,
  cooldownSec: 15,
  calibrationSec: 15,
  quietDropDb: 6,
  quietSustainSec: 3,
  muted: false,
  distinctCues: true,
};
