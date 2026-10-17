import type { CueMode } from "@/lib/cue/config";
import { STRATEGIES, type CoachedBehavior, type Strategy } from "@/lib/cue/plan";
import { mean, pct, probBetter, signTest } from "./stats";
import type { Experiment, InterventionRecord, SessionDigest } from "./types";

/**
 * Evaluate: is Cue's coaching actually helping this wearer?
 *
 * Two questions, kept apart:
 *  1. Right after a tap, does the behavior change more often than it does anyway? A wearer often
 *     slows down or stops filling on their own, so "they slowed down after the tap" proves
 *     nothing by itself. Cue answers it by comparing taps with holdouts: moments when a tap was
 *     due and Cue held it back on purpose, at random. Only the difference counts as the tap's effect.
 *  2. Across sessions, which strategy goes with better sessions? Answered by experiments that
 *     compare comparable sessions (same mode, enough talking) coached two ways.
 */

/** The session-level measure of each behavior. Lower is better for all of them. */
export function sessionMetric(d: SessionDigest, b: CoachedBehavior): number | null {
  if (d.talkSec < 60) return null;
  if (b === "rushing") return d.pace.rushShare;
  if (b === "fillers") return d.fillers.perMin;
  if (b === "no_pause") return d.pauses.overLimitShare;
  if (b === "long_turn") return d.turns.count >= 3 ? d.turns.medianSec : null;
  return null;
}

/** How much worse a candidate strategy may do on the metric and still count as "as good". */
const TOLERANCE: Record<CoachedBehavior, number> = {
  rushing: 0.05,
  fillers: 0.6,
  no_pause: 0.03,
  long_turn: 5,
  too_quiet: 0,
};

export const formatMetric = (b: CoachedBehavior, x: number) =>
  b === "rushing" || b === "no_pause" ? pct(x) : b === "fillers" ? `${x.toFixed(1)} a minute` : `${Math.round(x)} s`;

export const METRIC_NAME: Record<CoachedBehavior, string> = {
  rushing: "time spent rushing",
  fillers: "filler words",
  no_pause: "time without a pause",
  long_turn: "typical answer length",
  too_quiet: "time too quiet",
};

export type EffectVerdict = "measuring" | "helps" | "unclear" | "no_benefit";

export interface TapEffect {
  taps: number;
  tapWorked: number;
  holdouts: number;
  holdoutWorked: number;
  /** Share that changed after a tap minus share that changed anyway. */
  effect: number;
  /** Probability taps beat holding back. */
  pBetter: number;
  verdict: EffectVerdict;
}

/** Minimum judged taps and holdouts before Cue draws a conclusion. */
const MIN_TAPS = 8;
const MIN_HOLDOUTS = 4;

export function tapEffect(records: InterventionRecord[]): TapEffect {
  const judged = records.filter((r) => r.outcome);
  const taps = judged.filter((r) => !r.holdout);
  const holds = judged.filter((r) => r.holdout);
  const tw = taps.filter((r) => r.outcome === "worked").length;
  const hw = holds.filter((r) => r.outcome === "worked").length;
  const effect = (taps.length ? tw / taps.length : 0) - (holds.length ? hw / holds.length : 0);
  const pBetter = probBetter(tw, taps.length, hw, holds.length);
  const verdict: EffectVerdict =
    taps.length < MIN_TAPS || holds.length < MIN_HOLDOUTS
      ? "measuring"
      : pBetter >= 0.9
        ? "helps"
        : pBetter < 0.75 && effect < 0.15
          ? "no_benefit"
          : "unclear";
  return { taps: taps.length, tapWorked: tw, holdouts: holds.length, holdoutWorked: hw, effect, pBetter, verdict };
}

/** Interventions for one behavior and strategy in one mode, over the most recent sessions. */
export function recordsFor(
  sessions: SessionDigest[],
  records: InterventionRecord[],
  b: CoachedBehavior,
  mode: CueMode,
  strategy?: Strategy,
  lastSessions = 10,
): InterventionRecord[] {
  const ids = new Set(
    sessions
      .filter((d) => d.mode === mode)
      .slice(-lastSessions)
      .map((d) => d.id),
  );
  return records.filter((r) => ids.has(r.sessionId) && r.behavior === b && (!strategy || r.strategy === strategy));
}

/**
 * Change in a behavior across sessions: the first three comparable sessions against the last
 * three. `agree` counts recent sessions better than the early average (for a sign test).
 */
export function progress(sessions: SessionDigest[], b: CoachedBehavior, mode: CueMode) {
  const series = sessions
    .filter((d) => d.mode === mode)
    .map((d) => sessionMetric(d, b))
    .filter((x): x is number => x !== null);
  if (series.length < 6) return null;
  const early = mean(series.slice(0, 3));
  const recent = series.slice(-3);
  const agree = recent.filter((x) => x < early).length;
  const change = early > 0 ? (early - mean(recent)) / early : 0;
  return { early, recent: mean(recent), change, agree, p: signTest(agree, recent.length), n: series.length };
}

/** A new experiment comparing a behavior's current strategy with its alternative. */
export function startExperiment(
  b: CoachedBehavior,
  mode: CueMode,
  design: Experiment["design"],
  trigger: string,
  at: string,
  sessions: SessionDigest[],
): Experiment | null {
  const [control, candidate] = STRATEGIES[b];
  if (!candidate) return null;
  const before = sessions
    .filter((d) => d.mode === mode && d.plan.strategies[b] === control)
    .map((d) => sessionMetric(d, b))
    .filter((x): x is number => x !== null)
    .slice(-4);
  return {
    id: `exp-${b}-${mode}-${at}`,
    behavior: b,
    mode,
    control,
    candidate,
    design,
    trigger,
    startedAt: at,
    arms: [],
    before,
    status: "running",
  };
}

/** Which strategy the next session in this experiment's mode should use. */
export function nextArm(e: Experiment): Strategy {
  if (e.design === "switch") return e.candidate;
  const cand = e.arms.filter((a) => a.arm === "candidate").length;
  const ctrl = e.arms.filter((a) => a.arm === "control").length;
  return cand <= ctrl ? e.candidate : e.control;
}

/** Add a finished session to a running experiment, if it's comparable. */
export function recordArm(e: Experiment, d: SessionDigest, records: InterventionRecord[]): Experiment {
  if (e.status !== "running" || d.mode !== e.mode) return e;
  const metric = sessionMetric(d, e.behavior);
  const used = d.plan.strategies[e.behavior];
  if (metric === null || (used !== e.control && used !== e.candidate)) return e;
  const mine = records.filter((r) => r.sessionId === d.id && r.behavior === e.behavior && !r.holdout);
  const judged = mine.filter((r) => r.outcome);
  const rating = d.feedback[e.behavior];
  return {
    ...e,
    arms: [
      ...e.arms,
      {
        sessionId: d.id,
        arm: used === e.candidate ? "candidate" : "control",
        metric,
        tapsPerMin: mine.length / (d.talkSec / 60),
        worked: judged.filter((r) => r.outcome === "worked").length,
        judged: judged.length,
        negative: rating === "too_many" || rating === "distracting",
      },
    ],
  };
}

/** Feedback given after the session was added still counts toward its arm. */
export function refreshArmFeedback(e: Experiment, d: SessionDigest): Experiment {
  const rating = d.feedback[e.behavior];
  return {
    ...e,
    arms: e.arms.map((a) =>
      a.sessionId === d.id ? { ...a, negative: rating === "too_many" || rating === "distracting" } : a,
    ),
  };
}

const ARM_SESSIONS = 3;
const MAX_SESSIONS = 8;

/**
 * Decide an experiment once both sides have enough comparable sessions. The candidate (the
 * gentler alternative) is adopted when sessions with it were clearly better, or no worse while
 * tapping less, drawing fewer complaints, or with taps that worked more often.
 */
export function concludeExperiment(e: Experiment, at: string): Experiment {
  if (e.status !== "running") return e;
  const cand = e.arms.filter((a) => a.arm === "candidate");
  const ctrlArms = e.arms.filter((a) => a.arm === "control");
  const ctrlMetrics = e.design === "switch" ? [...e.before, ...ctrlArms.map((a) => a.metric)] : ctrlArms.map((a) => a.metric);
  const enough = cand.length >= ARM_SESSIONS && ctrlMetrics.length >= (e.design === "switch" ? 2 : ARM_SESSIONS);
  if (!enough && e.arms.length < MAX_SESSIONS) return e;
  if (!cand.length || !ctrlMetrics.length) return { ...e, status: "kept_control", concludedAt: at, finding: "not enough comparable sessions" };

  const b = e.behavior;
  const mc = mean(cand.map((a) => a.metric));
  const mo = mean(ctrlMetrics);
  const tol = TOLERANCE[b];
  const better = mc < mo - tol;
  const asGood = mc <= mo + tol;
  const rate = (arms: typeof cand) => {
    const j = arms.reduce((n, a) => n + a.judged, 0);
    return j >= 5 ? arms.reduce((n, a) => n + a.worked, 0) / j : null;
  };
  const ctrlTaps = ctrlArms.length ? mean(ctrlArms.map((a) => a.tapsPerMin)) : null;
  const fewerTaps = ctrlTaps !== null && mean(cand.map((a) => a.tapsPerMin)) < ctrlTaps * 0.85;
  const ctrlNeg = ctrlArms.length ? ctrlArms.filter((a) => a.negative).length / ctrlArms.length : e.design === "switch" ? 1 : 0;
  const fewerComplaints = cand.filter((a) => a.negative).length / cand.length < ctrlNeg;
  const rc = rate(cand);
  const ro = rate(ctrlArms);
  const workedMore = rc !== null && ro !== null && rc > ro + 0.15;
  const adopt = better || (asGood && (fewerTaps || fewerComplaints || workedMore));
  const name = METRIC_NAME[b];
  const facts = `${formatMetric(b, mc)} ${name} with it, against ${formatMetric(b, mo)} before`;
  const why = [fewerTaps && "fewer taps", fewerComplaints && "fewer times you found it too much", workedMore && "taps that worked more often"]
    .filter(Boolean)
    .join(", ");
  if (adopt)
    return {
      ...e,
      status: "adopted",
      concludedAt: at,
      better,
      finding: better ? `${facts}: better.` : `${facts}: just as good, with ${why}.`,
    };
  return {
    ...e,
    status: e.design === "switch" ? "kept_by_you" : "kept_control",
    concludedAt: at,
    finding: `${facts}: not as good.`,
  };
}
