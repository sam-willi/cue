import type { CueMode } from "./config";
import type { BehaviorType } from "./types";

/**
 * A personal coaching plan: what Cue has learned about one wearer, turned into the settings the
 * live engine coaches with. It's the contract between continuous learning (`src/lib/learning`,
 * which writes it between sessions) and the live session (which only reads it). Without a plan the
 * session coaches with the fixed defaults, exactly as before.
 */

/** The behaviors Cue coaches live, grouped the way the wearer thinks of them. */
export type CoachedBehavior = "rushing" | "fillers" | "no_pause" | "long_turn" | "too_quiet";
export const COACHED: CoachedBehavior[] = ["rushing", "no_pause", "fillers", "long_turn", "too_quiet"];

export const behaviorOf = (t: BehaviorType): CoachedBehavior =>
  t.startsWith("filler_") ? "fillers" : (t as Exclude<CoachedBehavior, "fillers">);

/** How strongly the motor taps. On the device the DRV2605L sets amplitude; the web stand-in shortens pulses. */
export type Intensity = "gentle" | "standard" | "firm";

/**
 * A coaching strategy for one behavior. Each behavior has a default and at most one alternative
 * that Cue can try when the default doesn't seem to help, or the wearer finds it too much.
 *  - rushing: "prompt" taps after 3 s of rushing; "sustained" waits for 8 s and re-taps half as often.
 *  - fillers: "cluster" taps for 3 within 12 s or a high rate; "rate" taps only for a high rate.
 *  - no_pause: "standard" taps after 30 s (22 s presenting); "patient" gives 10 s more.
 */
export type Strategy = "prompt" | "sustained" | "cluster" | "rate" | "standard" | "patient";

export const STRATEGIES: Record<CoachedBehavior, [Strategy, ...Strategy[]]> = {
  rushing: ["prompt", "sustained"],
  fillers: ["cluster", "rate"],
  no_pause: ["standard", "patient"],
  long_turn: ["standard"],
  too_quiet: ["standard"],
};

/** What each alternative strategy changes in the live rules. */
export const SUSTAINED_RUSH_SEC = 8;
export const SUSTAINED_RETAP_SCALE = 2;
export const PATIENT_EXTRA_SEC = 10;

export interface BehaviorPlan {
  /** False only when the wearer asked Cue not to coach this (in this mode). */
  enabled: boolean;
  strategy: Strategy;
  /** Multiplies the minimum time between two taps for this behavior: above 1 means fewer taps. */
  gapScale: number;
  /**
   * Chance (0–1) that a tap that's due is held back on purpose, so Cue can compare what happens
   * with and without a tap (CUE_CONTEXT.md §7, policy 6). Zero for new wearers.
   */
  holdoutRate: number;
}

export interface ModePlan {
  /** The wearer's natural pace in this mode (syllables/s) from earlier sessions, or null if not known yet. */
  paceBaselineSps: number | null;
  /** A personal long-turn limit (s), when the wearer is working on being concise. */
  longTurnSec: number | null;
  behaviors: Record<CoachedBehavior, BehaviorPlan>;
}

export type FocusKey = "pace" | "fillers" | "pauses" | "conciseness" | "repetition";

/** The live behavior each focus leans on. Repetition isn't tapped live (decision 15), so it has none. */
export const FOCUS_BEHAVIOR: Record<FocusKey, CoachedBehavior | null> = {
  pace: "rushing",
  fillers: "fillers",
  pauses: "no_pause",
  conciseness: "long_turn",
  repetition: null,
};

export interface CoachingPlan {
  focus: FocusKey | null;
  intensity: Intensity;
  modes: Record<CueMode, ModePlan>;
}

export const defaultBehaviorPlan = (b: CoachedBehavior): BehaviorPlan => ({
  enabled: true,
  strategy: STRATEGIES[b][0],
  gapScale: 1,
  holdoutRate: 0,
});

export function defaultModePlan(): ModePlan {
  return {
    paceBaselineSps: null,
    longTurnSec: null,
    behaviors: Object.fromEntries(COACHED.map((b) => [b, defaultBehaviorPlan(b)])) as ModePlan["behaviors"],
  };
}

export const defaultPlan = (): CoachingPlan => ({
  focus: null,
  intensity: "standard",
  modes: { conversation: defaultModePlan(), presentation: defaultModePlan() },
});

/** Pulse lengths scaled for an intensity: the web stand-in for the device's amplitude control. */
export function scaleVibration(pattern: number[], intensity: Intensity): number[] {
  const k = intensity === "gentle" ? 0.6 : intensity === "firm" ? 1.4 : 1;
  return pattern.map((ms, i) => (i % 2 === 0 ? Math.max(15, Math.round(ms * k)) : ms));
}
