import type { BehaviorType } from "./types";

/**
 * Cue's haptic vocabulary. Patterns differ by rhythm, which people tell apart far
 * more reliably than strength or texture; kept to three so they stay learnable
 * mid-conversation. A working assumption to validate with users.
 */
export type CuePattern = "tap" | "double" | "long";

/** Alert kinds that can produce a cue. */
export type CueKind = BehaviorType;

export const PATTERNS: Record<CuePattern, { name: string; action: string; vibrate: number[]; durationMs: number }> = {
  tap: { name: "One tap", action: "Pause", vibrate: [60], durationMs: 800 },
  double: { name: "Two taps", action: "Slow down", vibrate: [50, 110, 50], durationMs: 900 },
  long: { name: "Long pulse", action: "Speak up", vibrate: [450], durationMs: 1200 },
};

/** The pattern for an alert. With distinct cues off, everything is a single tap ("make space"). */
export function patternFor(kind: CueKind, distinct: boolean): CuePattern {
  if (!distinct) return "tap";
  if (kind === "rushing") return "double";
  if (kind === "too_quiet") return "long";
  return "tap";
}

/**
 * Touch-control confirmations. Ramps (vibration that swells or fades) rather than taps,
 * so they can never be mistaken for a coaching cue.
 */
export type ConfirmPattern = "ramp_up" | "ramp_down" | "ramp_once" | "ramp_twice";

// navigator.vibrate can only switch on/off, so a ramp is approximated by pulses whose
// on-time grows (or shrinks) while the gaps shrink (or grow). The cuff's DRV2605L does true ramps.
const RISE = [8, 40, 14, 30, 22, 20, 32, 10, 60];
const FALL = [60, 10, 32, 20, 22, 30, 14, 40, 8];

export const CONFIRMS: Record<ConfirmPattern, { label: string; vibrate: number[]; durationMs: number }> = {
  ramp_up: { label: "Cue on", vibrate: RISE, durationMs: 900 },
  ramp_down: { label: "Cue off", vibrate: FALL, durationMs: 900 },
  ramp_once: { label: "Conversation mode", vibrate: RISE, durationMs: 900 },
  ramp_twice: { label: "Presentation mode", vibrate: [...RISE, 160, ...RISE], durationMs: 1500 },
};
