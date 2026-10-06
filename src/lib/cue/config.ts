export type PaceMode = "conversation" | "presentation" | "custom";
/** The coaching mode, switched by a double tap on the device. */
export type CueMode = "conversation" | "presentation";

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

/**
 * Presentation mode (CUE_CONTEXT.md §26, decision 11). A talk is one long turn, so long turns
 * don't tap and are left for the after-session review. Fillers tap on rate, not
 * clusters: audiences mark speakers down at around 5+ per minute, mostly for um/uh (Laske et
 * al. 2024). Taps are sparser, since one prompt about every 20 s beat continuous feedback
 * (Rhema, Tanveer et al. 2015). When several behaviors are due, the order of consideration
 * gives priority: rushing, then no pause, then fillers, then too quiet. Starting points to test.
 */
export const PRESENTATION = {
  /** Behaviors detected but not tapped live in Presentation mode. */
  notLive: ["long_turn"] as const,
  noPauseSec: 22,
  /** Filler taps fire when the weighted rate over the last minute is above this. */
  fillerRatePerMin: 5,
  /** "like" and "lowkey" count this much toward the rate; um/uh count 1. */
  softFillerWeight: 0.5,
  /** At least this long between any two taps, seconds. */
  minGapSec: 25,
  maxTapsPerMin: 2,
  quietSustainSec: 10,
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
  /** A cluster: this many fillers… */
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
  /** Conversation or Presentation (decision 11): changes which behaviors tap and how often. */
  mode: CueMode;
  /** Which pace preset is active; "custom" when the slider was moved. */
  paceMode: PaceMode;
  /** Speaking rate (syllables/s, long pauses excluded) considered rushing. */
  paceThreshold: number;
  /** Rolling window used to measure pace, seconds. */
  paceWindowSec: number;
  /** Pace must stay above threshold this long before cueing, seconds. */
  paceSustainSec: number;
  /** Minimum gap between any two taps, seconds (SOFTWARE.md §13: 10–20 s; Presentation uses at least 25). */
  cooldownSec: number;
  /**
   * The speaking level (dBFS) the wearer set for each mode by reading aloud, and the room
   * noise floor at the time (decision 13). Without one for the current mode, too-quiet is off:
   * a session can't tell whether the wearer's own normal is already too quiet.
   */
  volumeTarget: Partial<Record<CueMode, { db: number; noiseDb: number | null }>>;
  /** "Too quiet" = this many dB below the target level… */
  quietDropDb: number;
  /** …for at least this long, seconds. */
  quietSustainSec: number;
  muted: boolean;
  /** Six distinct cues (decision 12); off plays only each family's root ("simpler cues"). */
  distinctCues: boolean;
}

export const DEFAULT_CONFIG: CueConfig = {
  categories: {
    um: true,
    uh: true,
    like: true,
    lowkey: true,
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
  mode: "conversation",
  paceMode: "conversation",
  paceThreshold: 4.5,
  paceWindowSec: 8,
  paceSustainSec: 3,
  cooldownSec: 15,
  volumeTarget: {},
  quietDropDb: 6,
  quietSustainSec: 3,
  muted: false,
  distinctCues: true,
};

export const isPresentation = (c: CueConfig) => c.mode === "presentation";

/** The effective timing rules for the current mode. */
export function modeRules(c: CueConfig) {
  const p = isPresentation(c);
  return {
    noPauseSec: p ? PRESENTATION.noPauseSec : c.noPauseSec,
    cooldownSec: p ? Math.max(c.cooldownSec, PRESENTATION.minGapSec) : c.cooldownSec,
    maxTapsPerMin: p ? PRESENTATION.maxTapsPerMin : Infinity,
    quietSustainSec: p ? PRESENTATION.quietSustainSec : c.quietSustainSec,
  };
}
