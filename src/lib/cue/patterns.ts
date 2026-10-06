import type { BehaviorType } from "./types";

/**
 * Cue's haptic vocabulary (CUE_CONTEXT.md §26, decision 12): six rhythm-coded cues in three
 * families, so a mix-up inside a family still points the right way. Rhythm (pulse count and
 * length) is what people tell apart most reliably on one actuator; every cue starts with a
 * sharp onset, and confirmations below are smooth ramps, so they never read as a cue.
 *
 *   Space: no pause → one tap ("full stop"); long turn → two knocks ("let them in")
 *   Pace:  rushing → slow steps (the pace to aim for); repetition → rattle ("I-I-I")
 *   Voice: filler pattern → tap and hum ("uh… mmm"); too quiet → long push
 *
 * Timings are the web stand-in (navigator.vibrate on/off ms). On the device the DRV2605L
 * plays them with overdrive and braking. A working assumption to validate in a pilot: if
 * people confuse pairs, "simpler cues" plays only each family's root.
 */
export type CuePattern = "tap" | "knock" | "steps" | "rattle" | "hum" | "push";
export type CueFamily = "space" | "pace" | "voice";

/** Alert kinds that can produce a cue. */
export type CueKind = BehaviorType;

export const PATTERNS: Record<
  CuePattern,
  { name: string; action: string; family: CueFamily; vibrate: number[]; durationMs: number }
> = {
  tap: { name: "One tap", action: "Breathe", family: "space", vibrate: [50], durationMs: 800 },
  knock: { name: "Two knocks", action: "Give space", family: "space", vibrate: [50, 150, 50], durationMs: 900 },
  steps: {
    name: "Slow steps",
    action: "Slow down",
    family: "pace",
    vibrate: [100, 250, 100, 250, 100],
    durationMs: 1500,
  },
  rattle: { name: "Rattle", action: "Reset", family: "pace", vibrate: [30, 60, 30, 60, 30, 60, 30], durationMs: 900 },
  hum: { name: "Tap and hum", action: "Pause", family: "voice", vibrate: [40, 90, 280], durationMs: 1000 },
  push: { name: "Long push", action: "Speak up", family: "voice", vibrate: [450], durationMs: 1200 },
};

const CUE_FOR: Record<CueKind, CuePattern> = {
  no_pause: "tap",
  long_turn: "knock",
  rushing: "steps",
  repetition: "rattle",
  filler_um: "hum",
  filler_uh: "hum",
  filler_like: "hum",
  filler_lowkey: "hum",
  too_quiet: "push",
};

/** Each family's root, played for every cue in the family when distinct cues are off. */
const FAMILY_ROOT: Record<CueFamily, CuePattern> = { space: "tap", pace: "steps", voice: "push" };

/** The pattern for an alert. With distinct cues off ("simpler cues"), each family plays its root. */
export function patternFor(kind: CueKind, distinct: boolean): CuePattern {
  const p = CUE_FOR[kind];
  return distinct ? p : FAMILY_ROOT[PATTERNS[p].family];
}

/** One alert of each cue, in family order, for the legend. */
export const CUE_LEGEND: { kind: CueKind; label: string }[] = [
  { kind: "filler_um", label: "Filler words" },
  { kind: "too_quiet", label: "Too quiet" },
  { kind: "rushing", label: "Too fast" },
  { kind: "repetition", label: "Repeating" },
  { kind: "no_pause", label: "No pauses" },
  { kind: "long_turn", label: "Long turn" },
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
