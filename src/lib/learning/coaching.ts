import { PACE_PRESETS, toApproxWpm, type CueMode } from "@/lib/cue/config";
import {
  COACHED,
  defaultPlan,
  FOCUS_BEHAVIOR,
  STRATEGIES,
  type CoachedBehavior,
  type CoachingPlan,
  type Strategy,
} from "@/lib/cue/plan";
import { nextArm } from "./evaluation";
import { FOCUS_LABEL } from "./focus";
import { median } from "./stats";
import type { Adaptation, Profile } from "./types";

/**
 * Adapt: derive the coaching plan from everything in the profile. The plan is a pure function of
 * the profile, and each personalized value carries the reason it has that value. Comparing the
 * plan before and after a session (or a correction) gives the list of adaptations, so every
 * "what I changed" shown to the wearer is a real difference in how the next session coaches.
 */

export type Stage = "new" | "returning" | "experienced";

export const STAGE_LABEL: Record<Stage, string> = {
  new: "Getting to know you",
  returning: "Coaching to your baseline",
  experienced: "Fine-tuning your coaching",
};

export function stageOf(p: Profile): Stage {
  const real = p.sessions.filter((d) => d.talkSec >= 45);
  const talk = real.reduce((n, d) => n + d.talkSec, 0);
  if (real.length < 3 || talk < 300) return "new";
  const judged = p.interventions.filter((r) => r.outcome).length;
  if (real.length >= 8 && talk >= 1200 && judged >= 20) return "experienced";
  return "returning";
}

export const BEHAVIOR_NAME: Record<CoachedBehavior, string> = {
  rushing: "speaking fast",
  fillers: "filler words",
  no_pause: "going without a pause",
  long_turn: "long turns",
  too_quiet: "speaking quietly",
};
export const REMINDER_NAME: Record<CoachedBehavior, string> = {
  rushing: "slow-down reminders",
  fillers: "filler reminders",
  no_pause: "pause reminders",
  long_turn: "long-turn reminders",
  too_quiet: "speak-up reminders",
};
const MODE_IN: Record<CueMode, string> = { conversation: "in conversations", presentation: "in presentations" };
export const STRATEGY_TEXT: Record<Strategy, string> = {
  prompt: "tap after a few seconds of rushing",
  sustained: "only tap for longer stretches of rushing",
  cluster: "tap when fillers bunch up",
  rate: "only tap when fillers stay high for a whole minute",
  standard: "the standard timing",
  patient: "give you 10 more seconds before a pause reminder",
};

/** Sessions of pace a baseline needs (1 is provisional; 3 is settled). */
export const BASELINE_SETTLED = 3;
const PACE_RISE = { conversation: 1.2, presentation: 1.1 };

/** The wearer's natural pace in a mode: the median of their recent sessions' medians. */
export function paceBaseline(p: Profile, mode: CueMode): { sps: number; sessions: number } | null {
  const xs = p.sessions
    .filter((d) => d.mode === mode && d.pace.samples >= 12 && d.pace.medianSps !== null)
    .slice(-10)
    .map((d) => d.pace.medianSps!);
  return xs.length ? { sps: median(xs), sessions: xs.length } : null;
}

const limitWpm = (sps: number, mode: CueMode) => toApproxWpm(Math.min(6, Math.max(3.6, sps * PACE_RISE[mode])));

export interface Reason {
  learned: string;
  changed: string;
  basis: string[];
}

const rejected = (p: Profile, id: string) => p.insights.some((i) => i.id === id && i.status === "rejected");
const activePrefs = (p: Profile) => p.preferences.filter((x) => x.status !== "rejected");

export function derivePlan(
  p: Profile,
  prev: CoachingPlan = p.plan,
): { plan: CoachingPlan; reasons: Map<string, Reason> } {
  const plan = defaultPlan();
  const reasons = new Map<string, Reason>();
  const stage = stageOf(p);
  const prefs = activePrefs(p);
  const focusBehavior = p.focus.current ? FOCUS_BEHAVIOR[p.focus.current] : null;

  plan.focus = p.focus.current;
  if (p.focus.current)
    reasons.set("focus", {
      learned: p.focus.why,
      changed: `Your focus is ${FOCUS_LABEL[p.focus.current].toLowerCase()}: I give it priority when more than one thing is due.`,
      basis: ["focus"],
    });

  const intensity = prefs.find((x) => x.kind === "intensity");
  if (intensity?.value === "gentle" || intensity?.value === "firm") {
    plan.intensity = intensity.value;
    reasons.set("intensity", {
      learned: intensity.why,
      changed: intensity.value === "gentle" ? "I switched to gentler taps." : "I switched to firmer taps.",
      basis: [intensity.id],
    });
  }

  for (const mode of ["conversation", "presentation"] as const) {
    const mp = plan.modes[mode];
    const prevMode = prev.modes[mode];

    // Personal pace baseline (returning wearers), unless the wearer said Cue's read is wrong.
    const base = paceBaseline(p, mode);
    if (base && !rejected(p, `baseline_pace:${mode}`) && !rejected(p, `natural_pace:${mode}`)) {
      const old = prevMode.paceBaselineSps;
      // Small drifts don't move the threshold: it only changes when the baseline moves 4% or more.
      const sps = old !== null && Math.abs(base.sps - old) / old < 0.04 ? old : Math.round(base.sps * 20) / 20;
      mp.paceBaselineSps = sps;
      const settled = base.sessions >= BASELINE_SETTLED;
      const mine = limitWpm(sps, mode);
      const standard = toApproxWpm(PACE_PRESETS[mode].threshold);
      reasons.set(`${mode}.paceBaselineSps`, {
        learned: `Your natural pace ${MODE_IN[mode]} is about ${toApproxWpm(sps)} words a minute${settled ? "" : ` (from ${base.sessions === 1 ? "one session" : `${base.sessions} sessions`} so far)`}.`,
        changed:
          Math.abs(mine - standard) < 6
            ? `I judge rushing against your own pace: slow-down taps start above about ${mine} words a minute, close to the standard.`
            : `I judge rushing against your own pace: slow-down taps start above about ${mine} words a minute, not the standard ${standard}.`,
        basis: [`baseline_pace:${mode}`],
      });
    }

    // Personal long-turn limit while working on conciseness.
    if (p.focus.current === "conciseness" && mode === "conversation") {
      mp.longTurnSec = 60;
      reasons.set(`${mode}.longTurnSec`, {
        learned: "You’re working on being concise.",
        changed: "I remind you to wrap up a little sooner in a long answer: after 60 seconds instead of 90.",
        basis: ["focus"],
      });
    }

    for (const b of COACHED) {
      const bp = mp.behaviors[b];
      const key = `${mode}.${b}`;

      const off = prefs.find((x) => x.kind === "dont_coach" && x.behavior === b && (!x.mode || x.mode === mode));
      if (off) {
        bp.enabled = false;
        reasons.set(`${key}.enabled`, {
          learned: off.why,
          changed: `I’ve stopped tapping for ${BEHAVIOR_NAME[b]}${off.mode ? ` ${MODE_IN[off.mode]}` : ""}.`,
          basis: [off.id],
        });
      }

      // Strategy: an experiment in progress, or the outcome of the last one.
      const exps = p.experimentsLog.filter((e) => e.behavior === b && e.mode === mode);
      const running = exps.find((e) => e.status === "running");
      const last = exps.filter((e) => e.status !== "running").at(-1);
      if (running) {
        bp.strategy = nextArm(running);
        reasons.set(`${key}.strategy`, {
          learned: running.trigger,
          changed:
            running.design === "switch"
              ? `I now ${STRATEGY_TEXT[running.candidate]} ${MODE_IN[mode]}, and I’m checking it works as well.`
              : `I’m trying something different in some ${mode === "conversation" ? "conversations" : "presentations"}: I ${STRATEGY_TEXT[running.candidate]}. I’ll compare it with how I coach now before deciding.`,
          basis: [running.id],
        });
      } else if (last && (last.status === "adopted" || last.status === "kept_by_you")) {
        bp.strategy = last.candidate;
        reasons.set(`${key}.strategy`, {
          learned:
            last.status === "adopted"
              ? `${capitalize(REMINDER_NAME[b])} that ${STRATEGY_TEXT[last.candidate]} worked for you: ${last.finding}`
              : `You asked for fewer ${REMINDER_NAME[b]}. ${last.finding ? `Sessions since: ${last.finding}` : ""}`.trim(),
          changed: `I ${STRATEGY_TEXT[last.candidate]} from now on.`,
          basis: [last.id],
        });
      } else if (last && last.status === "kept_control") {
        reasons.set(`${key}.strategy`, {
          learned: `I tried ${STRATEGY_TEXT[last.candidate].replace(/^only /, "only ")}: ${last.finding}`,
          changed: `I went back to ${STRATEGY_TEXT[last.control]}.`,
          basis: [last.id],
        });
      }

      // Frequency: the wearer's wishes first, then stepping back from what's improved, then focus.
      let scale = 1;
      const why: Reason[] = [];
      const less = prefs.find((x) => x.kind === "less_often" && x.behavior === b && (!x.mode || x.mode === mode));
      if (less) {
        scale *= 1.6;
        why.push({ learned: less.why, changed: `I tap less often for ${BEHAVIOR_NAME[b]}.`, basis: [less.id] });
      }
      const fewer = prefs.find((x) => x.kind === "fewer_taps");
      if (fewer) {
        scale *= 1.4;
        why.push({ learned: fewer.why, changed: "I leave more room between taps.", basis: [fewer.id] });
      }
      if (p.faded[`${b}:${mode}`]) {
        scale *= 1.5;
        why.push({
          learned: `You’ve improved a lot at ${BEHAVIOR_NAME[b]} ${MODE_IN[mode]}.`,
          changed: `I’m stepping back: fewer ${REMINDER_NAME[b]}, so you can catch it yourself.`,
          basis: [`fade:${b}:${mode}`],
        });
      }
      if (focusBehavior && b !== focusBehavior && stage !== "new" && b !== "too_quiet") {
        scale *= 1.3;
        why.push({
          learned: `You’re working on ${FOCUS_LABEL[p.focus.current!].toLowerCase()}.`,
          changed: "I tap less for your other habits so we can concentrate on it.",
          basis: ["focus"],
        });
      }
      bp.gapScale = Math.min(3, Math.round(scale * 10) / 10);
      if (why.length) reasons.set(`${key}.gapScale`, why[0]);

      // Holdouts: once the baseline is known, Cue checks its taps help instead of assuming it.
      if (p.experiments && stage !== "new" && bp.enabled) {
        bp.holdoutRate = p.faded[`${b}:${mode}`] ? 0.3 : b === focusBehavior ? 0.15 : 0.2;
        reasons.set(`${key}.holdoutRate`, {
          learned: "I know your baseline now.",
          changed:
            "Now and then I hold back a tap on purpose and see what happens, so I can tell whether my taps help you rather than assume it.",
          basis: ["stage"],
        });
      }
    }
  }
  return { plan, reasons };
}

const capitalize = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/** Flatten a plan into comparable fields. */
function fields(plan: CoachingPlan): Map<string, string> {
  const out = new Map<string, string>();
  out.set("focus", plan.focus ?? "none");
  out.set("intensity", plan.intensity);
  for (const mode of ["conversation", "presentation"] as const) {
    const mp = plan.modes[mode];
    out.set(`${mode}.paceBaselineSps`, mp.paceBaselineSps === null ? "none" : mp.paceBaselineSps.toFixed(2));
    out.set(`${mode}.longTurnSec`, String(mp.longTurnSec ?? "none"));
    for (const b of COACHED) {
      const bp = mp.behaviors[b];
      out.set(`${mode}.${b}.enabled`, String(bp.enabled));
      out.set(`${mode}.${b}.strategy`, bp.strategy);
      out.set(`${mode}.${b}.gapScale`, bp.gapScale.toFixed(1));
      out.set(`${mode}.${b}.holdoutRate`, bp.holdoutRate > 0 ? "on" : "off");
    }
  }
  return out;
}

const DEFAULT_STRATEGY = (field: string): string | null => {
  const m = field.match(/^\w+\.(\w+)\.strategy$/);
  return m ? STRATEGIES[m[1] as CoachedBehavior][0] : null;
};

/**
 * What changed between two plans, as adaptations: what Cue learned and what it changed. A value
 * that went back to its default without a reason of its own is explained by `cause` (e.g. the
 * wearer's correction). Identical explanations across modes and behaviors are merged.
 */
export function diffPlans(
  before: CoachingPlan,
  after: CoachingPlan,
  reasons: Map<string, Reason>,
  at: string,
  cause?: string,
): Adaptation[] {
  const a = fields(before);
  const b = fields(after);
  const out: Adaptation[] = [];
  for (const [field, to] of b) {
    const from = a.get(field)!;
    if (from === to) continue;
    // Holdouts switching off with the wearer's setting is shown by the setting, not as an adaptation.
    if (field.endsWith(".holdoutRate") && to === "off" && !cause) continue;
    const r = reasons.get(field);
    const fewerHolds = field.endsWith(".gapScale") && Number(to) < Number(from);
    let learned: string;
    let changed: string;
    if (fewerHolds) {
      learned = cause ?? r?.learned ?? "What made me hold back has changed.";
      changed = to === "1.0" ? "I tap at the usual rate again." : "I tap a little more often again.";
    } else if (r && !(to === DEFAULT_STRATEGY(field) && cause)) {
      learned = r.learned;
      changed = r.changed;
    } else {
      learned = cause ?? "Something I was relying on no longer holds.";
      changed = revertText(field);
    }
    const basis = r?.basis ?? [];
    const dup = out.find((x) => x.learned === learned && x.changed === changed);
    if (dup) {
      dup.field += `, ${field}`;
      continue;
    }
    out.push({ id: `ad-${at}-${out.length}`, at, field, learned, changed, from, to, basis });
  }
  return out;
}

function revertText(field: string): string {
  if (field === "focus") return "You don’t have a focus right now.";
  if (field === "intensity") return "Taps are back to standard strength.";
  if (field.endsWith("paceBaselineSps")) return "I went back to the standard slow-down point.";
  if (field.endsWith("longTurnSec")) return "Long-turn reminders are back to 90 seconds.";
  if (field.endsWith(".enabled")) return "I’ll coach this again.";
  if (field.endsWith(".strategy")) return "I went back to my standard approach.";
  if (field.endsWith(".holdoutRate")) return "I no longer hold back taps on purpose.";
  return "I went back to the default.";
}

/**
 * How Cue coaches this wearer differently from a new wearer, right now: every personalized value
 * in the current plan, with what Cue learned and what it changed, and when it last changed.
 */
export function activeAdaptations(p: Profile): (Adaptation & { since: string | null })[] {
  const { plan, reasons } = derivePlan(p, p.plan);
  return diffPlans(defaultPlan(), plan, reasons, "now").map((a) => ({
    ...a,
    since: p.adaptations.findLast((x) => x.changed === a.changed)?.at ?? null,
  }));
}
