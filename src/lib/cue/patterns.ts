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
