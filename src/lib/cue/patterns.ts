import type { BehaviorType } from "./types";

/**
 * Cue's haptic vocabulary (CUE_CONTEXT.md §26, decision 18): three rhythm-coded cues, one per
 * thing the wearer can do right now. Rhythm (pulse count and length) is what people tell apart
 * most reliably on one actuator; every cue starts with a sharp onset, and confirmations below
 * are smooth ramps, so they never read as a cue.
 *
 *   Pause:      one tap ("full stop"). No pause for a while, a long turn, or a run of fillers.
 *   Slow down:  slow steps (the pace to aim for). Rushing.
 *   Speak up:   long push. Too quiet.
 *
 * Timings are the web stand-in (navigator.vibrate on/off ms). On the device the DRV2605L
 * plays them with overdrive and braking.
 */
export type CuePattern = "tap" | "steps" | "push";

/** Alert kinds that can produce a cue. */
export type CueKind = BehaviorType;

export const PATTERNS: Record<CuePattern, { name: string; action: string; vibrate: number[]; durationMs: number }> = {
  tap: { name: "One tap", action: "Pause", vibrate: [50], durationMs: 800 },
  steps: { name: "Slow steps", action: "Slow down", vibrate: [100, 250, 100, 250, 100], durationMs: 1500 },
  push: { name: "Long push", action: "Speak up", vibrate: [450], durationMs: 1200 },
};

const CUE_FOR: Record<CueKind, CuePattern> = {
  no_pause: "tap",
  long_turn: "tap",
  filler_um: "tap",
  filler_uh: "tap",
  filler_like: "tap",
  filler_lowkey: "tap",
  filler_custom: "tap",
  rushing: "steps",
  too_quiet: "push",
};

/** The pattern for an alert. */
export const patternFor = (kind: CueKind): CuePattern => CUE_FOR[kind];

/** One alert of each cue, for the legend, with when it fires. */
export const CUE_LEGEND: { kind: CueKind; label: string }[] = [
  { kind: "too_quiet", label: "Too quiet" },
  { kind: "rushing", label: "Too fast" },
  { kind: "no_pause", label: "Talking too long, or too many fillers" },
];

/**
 * Touch-control confirmations. Ramps (vibration that swells or fades) rather than taps,
 * so they can never be mistaken for a coaching cue.
 */
export type ConfirmPattern = "ramp_up" | "ramp_down" | "ramp_once" | "ramp_twice";

// navigator.vibrate can only switch on/off, so a ramp is approximated by pulses whose
// on-time grows (or shrinks) while the gaps shrink (or grow). The device's DRV2605L does true
// ramps. None starts with a sharp pulse, which keeps them apart from cues.
export const CONFIRMS: Record<ConfirmPattern, { label: string; vibrate: number[]; durationMs: number }> = {
  ramp_up: { label: "Cue on", vibrate: [15, 40, 30, 30, 60], durationMs: 900 },
  ramp_down: { label: "Cue off", vibrate: [60, 30, 30, 40, 15], durationMs: 900 },
  ramp_once: { label: "Conversation mode", vibrate: [15, 30, 40, 150, 15, 30, 40], durationMs: 1000 },
  ramp_twice: { label: "Presentation mode", vibrate: [15, 30, 30, 30, 60, 30, 250], durationMs: 1200 },
};
