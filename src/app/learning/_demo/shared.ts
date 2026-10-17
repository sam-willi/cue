import type { Trace } from "@/lib/learning/demo";

// Helpers for the demo components, kept apart from them so Fast Refresh can swap components alone.
// No hooks here (they are in hooks.ts): the server-rendered page and loop read these too.

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cue";
export const CARD = "rounded-card border border-line bg-surface p-5";
export const BUTTON = `inline-flex h-11 items-center gap-2 rounded-full bg-action px-5 text-body-sm font-semibold text-on-action transition-opacity disabled:opacity-50 ${FOCUS}`;
export const CHIP = `h-11 rounded-full border px-5 text-body-sm font-semibold transition-colors ${FOCUS}`;
/** A block that rises into place when it first renders. */
export const ARRIVE = "transition duration-500 starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none";

/** The six steps of the loop; each act names the ones it shows. */
export const STEPS = ["Observe", "Discover", "Remember", "Adapt", "Evaluate", "Improve"] as const;
export type Step = (typeof STEPS)[number];

/** Slow-down taps felt up to a share of the session (all of it by default). */
export const rushingTaps = (t: Trace, progress = 1) =>
  t.taps.filter((x) => x.behavior === "rushing" && x.t <= progress * t.duration).length;

/** A y range, words a minute, that fits every trace given, so charts one above another compare. */
export function paceDomain(...traces: Trace[]): [number, number] {
  const all = traces.flatMap((t) => [...t.pace, ...t.limit].map((p) => p.wpm));
  return [Math.floor((Math.min(...all) - 10) / 20) * 20, Math.ceil((Math.max(...all) + 10) / 20) * 20];
}

/** How far through a part of a timeline that starts at `from` and lasts `ms`, 0 to 1. */
export const span = (elapsed: number, from: number, ms: number) => Math.min(1, Math.max(0, (elapsed - from) / ms));
