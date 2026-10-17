import type { CueMode } from "@/lib/cue/config";
import { FOCUS_BEHAVIOR, type FocusKey } from "@/lib/cue/plan";
import { sessionMetric } from "./evaluation";
import { mean, pct } from "./stats";
import type { Profile, SessionDigest } from "./types";

/**
 * Your Focus: one skill at a time. Cue recommends the habit that stands out most in recent
 * sessions (weighted toward the wearer's own goal), leans its live coaching toward it, and moves
 * on to a new skill once that one has clearly improved. The wearer can always choose instead.
 */

export const FOCUS_LABEL: Record<FocusKey, string> = {
  pace: "Speaking pace",
  fillers: "Filler words",
  pauses: "Intentional pauses",
  conciseness: "Conciseness",
  repetition: "Repetition",
};

export const FOCUS_KEYS: FocusKey[] = ["pace", "fillers", "pauses", "conciseness", "repetition"];

/** The measure of progress for a focus, per session. Lower is better. */
export function focusMetric(d: SessionDigest, key: FocusKey): number | null {
  if (key === "repetition") return d.talkSec >= 60 ? d.repetition.perMin : null;
  const b = FOCUS_BEHAVIOR[key];
  return b ? sessionMetric(d, b) : null;
}

/** How much each habit stands out, 0 (fine) and up; 1 is "clearly worth working on". */
function severity(key: FocusKey, recent: SessionDigest[]): number | null {
  const xs = recent.map((d) => focusMetric(d, key)).filter((x): x is number => x !== null);
  if (!xs.length) return null;
  const x = mean(xs);
  if (key === "pace") return x / 0.25;
  if (key === "fillers") return Math.max(0, (x - 2) / 5);
  if (key === "pauses") return x / 0.12;
  if (key === "conciseness") return Math.max(0, (x - 35) / 35);
  return x / 1.5;
}

/** Why a focus, in the wearer's own numbers (and the matching pattern, if Cue has found one). */
function explain(key: FocusKey, recent: SessionDigest[], profile: Profile): string {
  const xs = recent.map((d) => focusMetric(d, key)).filter((x): x is number => x !== null);
  const x = xs.length ? mean(xs) : 0;
  const pattern = (kind: string) =>
    profile.insights.find((i) => i.kind === kind && i.status !== "rejected" && !i.stale)?.statement;
  if (key === "pace")
    return `${pattern("rush_opening") ?? pattern("context_pace") ?? `You were past your own comfortable pace for ${pct(x)} of your recent speaking.`} Let’s work on keeping a steady pace.`;
  if (key === "fillers")
    return `${pattern("fillers_turn_start") ?? pattern("fillers_when_fast") ?? `You’ve been using about ${x.toFixed(1)} filler words a minute.`} Let’s swap them for a short pause.`;
  if (key === "pauses")
    return x > 0.02
      ? `You often keep going well past the point where a pause would help. Let’s work on using pauses on purpose.`
      : `Your pace and fillers are in a good place. Let’s work on using pauses more effectively: a breath at the end of each thought.`;
  if (key === "conciseness")
    return `Your answers usually run about ${Math.round(x)} seconds. Let’s work on making the point, then stopping.`;
  return `${pattern("repeat_starts") ?? "You restart sentences fairly often."} Let’s work on pausing instead of restarting.`;
}

/** Enough to recommend a first focus: two sessions, three minutes of talking. */
export const canRecommend = (p: Profile) =>
  p.sessions.filter((d) => d.talkSec >= 45).length >= 2 && p.sessions.reduce((n, d) => n + d.talkSec, 0) >= 180;

export function recommendFocus(p: Profile, exclude: FocusKey[] = []): { key: FocusKey; why: string } | null {
  if (!canRecommend(p)) return null;
  const recent = p.sessions.filter((d) => d.talkSec >= 45).slice(-3);
  const goal = p.preferences.find((x) => x.kind === "goal" && x.status !== "rejected")?.value as FocusKey | undefined;
  const offLive = new Set(
    p.preferences.filter((x) => x.kind === "dont_coach" && x.status !== "rejected" && !x.mode).map((x) => x.behavior),
  );
  const recentlyDone = new Set(p.focus.graduated.slice(-2).map((g) => g.key));
  const scored = FOCUS_KEYS.filter((k) => !exclude.includes(k) && !recentlyDone.has(k))
    .filter((k) => !(FOCUS_BEHAVIOR[k] && offLive.has(FOCUS_BEHAVIOR[k]!)))
    .map((k) => ({ k, s: (severity(k, recent) ?? 0) * (k === goal ? 1.5 : 1) }))
    .sort((a, b) => b.s - a.s);
  const best = scored[0];
  // Nothing stands out: grow a new skill instead of correcting an old one.
  const key = best && best.s >= 0.6 ? best.k : !exclude.includes("pauses") ? "pauses" : (best?.k ?? "pauses");
  return { key, why: explain(key, recent, p) };
}

/** The focus metric now (mean of the last three sessions with it). */
export function currentFocusMetric(p: Profile, key: FocusKey, mode?: CueMode): number | null {
  const xs = p.sessions
    .filter((d) => !mode || d.mode === mode)
    .map((d) => focusMetric(d, key))
    .filter((x): x is number => x !== null)
    .slice(-3);
  return xs.length ? mean(xs) : null;
}

/**
 * Improved enough to move on: after at least four sessions on the focus, the last three are each
 * better than when it began and 30% better on average. One good session doesn't count.
 */
export function hasGraduated(p: Profile): boolean {
  const f = p.focus;
  if (!f.current || f.startMetric === null || f.startMetric <= 0 || f.sessionsOnFocus < 4) return false;
  const last = p.sessions
    .map((d) => focusMetric(d, f.current!))
    .filter((x): x is number => x !== null)
    .slice(-3);
  if (last.length < 3 || last.some((x) => x >= f.startMetric!)) return false;
  return (f.startMetric - mean(last)) / f.startMetric >= 0.3;
}

export const GRADUATION_TEXT: Record<FocusKey, string> = {
  pace: "Your pacing has become more consistent.",
  fillers: "You’re using noticeably fewer filler words.",
  pauses: "You’re pausing much more naturally.",
  conciseness: "Your answers have become more concise.",
  repetition: "You’re restarting sentences far less.",
};
