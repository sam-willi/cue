import { toApproxWpm, type CueMode } from "@/lib/cue/config";
import { defaultPlan, STRATEGIES, type CoachedBehavior, type FocusKey } from "@/lib/cue/plan";
import {
  BASELINE_SETTLED,
  BEHAVIOR_NAME,
  derivePlan,
  diffPlans,
  paceBaseline,
  REMINDER_NAME,
  stageOf,
  STRATEGY_TEXT,
} from "./coaching";
import {
  concludeExperiment,
  formatMetric,
  METRIC_NAME,
  progress,
  recordArm,
  recordsFor,
  refreshArmFeedback,
  startExperiment,
  tapEffect,
} from "./evaluation";
import { currentFocusMetric, FOCUS_LABEL, focusMetric, GRADUATION_TEXT, hasGraduated, recommendFocus } from "./focus";
import { discoverPatterns, mergeInsights } from "./patterns";
import { pct } from "./stats";
import {
  PROFILE_VERSION,
  type Adaptation,
  type CueUpdate,
  type Experiment,
  type Insight,
  type InterventionRecord,
  type LearningEvent,
  type Preference,
  type Profile,
  type Rating,
  type SessionDigest,
} from "./types";

/**
 * The learning loop: OBSERVE (a session digest) → DISCOVER (patterns across sessions) →
 * REMEMBER (the profile) → ADAPT (a new coaching plan) → EVALUATE (taps against holdouts,
 * strategies against each other) → IMPROVE (adopt what works, step back where the wearer has
 * improved, move the focus on).
 *
 * Every function here takes a profile and returns a new one; nothing is changed in place. The
 * plan in the returned profile is what the next session coaches with.
 */

const MAX_SESSIONS = 200;
const MAX_INTERVENTIONS = 3000;
/** Sessions shorter than this (s of talking) aren't learned from. */
export const MIN_LEARN_SEC = 30;

export function emptyProfile(at: string): Profile {
  return {
    version: PROFILE_VERSION,
    createdAt: at,
    learning: true,
    experiments: true,
    sessions: [],
    interventions: [],
    insights: [],
    preferences: [],
    experimentsLog: [],
    adaptations: [],
    events: [],
    updates: [],
    focus: {
      current: null,
      chosenBy: "cue",
      since: null,
      startMetric: null,
      sessionsOnFocus: 0,
      suggestion: null,
      why: "",
      graduated: [],
    },
    faded: {},
    milestones: [],
    plan: defaultPlan(),
  };
}

const MODE_IN: Record<CueMode, string> = { conversation: "in conversations", presentation: "in presentations" };
const MODES_NAME: Record<CueMode, string> = { conversation: "conversations", presentation: "presentations" };
const capitalize = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

let seq = 0;
const uid = (prefix: string, at: string) => `${prefix}-${at}-${(seq++).toString(36)}`;

function event(
  p: Profile,
  at: string,
  track: LearningEvent["track"],
  kind: LearningEvent["kind"],
  title: string,
  why: string,
) {
  p.events.push({ id: uid("ev", at), at, track, kind, title, why });
}

/** Rebuild the plan and log what changed (and why) as adaptations. */
function replan(p: Profile, at: string, cause?: string): Adaptation[] {
  const { plan, reasons } = derivePlan(p, p.plan);
  // A change that repeats the last one logged for the same setting (an experiment alternating
  // between its two strategies, say) is already explained; it isn't logged again.
  const changes = diffPlans(p.plan, plan, reasons, at, cause).filter((c) => {
    const last = p.adaptations.findLast((a) => a.field === c.field);
    return !last || last.learned !== c.learned || last.changed !== c.changed;
  });
  p.plan = plan;
  for (const c of changes) {
    p.adaptations.push(c);
    // A new focus is already on the timeline as its own event.
    if (c.field !== "focus") event(p, at, "cue", "adaptation", c.changed, c.learned);
  }
  return changes;
}

const clone = (p: Profile): Profile => structuredClone(p);

function upsertInsight(p: Profile, ins: Omit<Insight, "firstSeen" | "status">): { fresh: boolean; insight: Insight } {
  const k = p.insights.findIndex((i) => i.id === ins.id);
  if (k < 0) {
    const insight: Insight = { ...ins, firstSeen: ins.updatedAt, status: "active" };
    p.insights.push(insight);
    return { fresh: true, insight };
  }
  p.insights[k] = { ...p.insights[k], ...ins, status: p.insights[k].status };
  return { fresh: false, insight: p.insights[k] };
}

/** Patterns across sessions, folded into what Cue already knows. Returns the new ones. */
function discover(p: Profile, at: string): Insight[] {
  const keep = p.insights.filter((i) => i.kind === "baseline_pace" || i.kind.startsWith("coaching:"));
  const found = mergeInsights(
    p.insights.filter((i) => !keep.includes(i)),
    discoverPatterns(p.sessions),
    at,
  );
  p.insights = [...keep, ...found.insights];
  const shown = [...found.fresh, ...found.strengthened].filter((i) => i.status !== "rejected");
  for (const i of found.fresh) event(p, at, "cue", "pattern", `Cue noticed: ${lowerFirst(i.statement)}`, i.detail);
  return shown;
}

const lowerFirst = (t: string) => (t.startsWith("You") || t.startsWith("Your") ? t : t[0].toLowerCase() + t.slice(1));

/** What "worked" means for each behavior, in words. */
const WORKED: Record<CoachedBehavior, string> = {
  rushing: "slowed down",
  fillers: "stopped filling",
  no_pause: "paused",
  long_turn: "wrapped up",
  too_quiet: "spoke up",
};

interface UpdateCandidate {
  priority: number;
  update: Omit<CueUpdate, "id" | "at" | "status">;
}

function pickUpdate(p: Profile, at: string, candidates: UpdateCandidate[]): CueUpdate | null {
  const best = candidates.sort((a, b) => b.priority - a.priority)[0];
  if (!best) return null;
  if (p.updates.some((u) => u.text === best.update.text)) return null;
  const update: CueUpdate = { ...best.update, id: uid("up", at), at, status: "new" };
  // One new card at a time: an older unseen one is folded into the timeline instead.
  p.updates = p.updates.map((u) => (u.status === "new" ? { ...u, status: "seen" } : u));
  p.updates.push(update);
  return update;
}

export interface LearnResult {
  profile: Profile;
  update: CueUpdate | null;
  adaptations: Adaptation[];
  /** Why nothing was learned, if nothing was. */
  skipped?: string;
}

/** Learn from one finished session. */
export function learnFromSession(
  prev: Profile,
  digest: SessionDigest,
  interventions: InterventionRecord[],
): LearnResult {
  if (!prev.learning) return { profile: prev, update: null, adaptations: [], skipped: "Learning is paused." };
  if (digest.talkSec < MIN_LEARN_SEC)
    return { profile: prev, update: null, adaptations: [], skipped: "That session was too short to learn from." };
  const p = clone(prev);
  const at = digest.at;
  const mode = digest.mode;
  const candidates: UpdateCandidate[] = [];
  const wasStage = stageOf(p);

  // REMEMBER --------------------------------------------------------------------
  p.sessions = [...p.sessions, digest].slice(-MAX_SESSIONS);
  p.interventions = [...p.interventions, ...interventions].slice(-MAX_INTERVENTIONS);
  if (p.sessions.length === 1)
    event(p, at, "cue", "baseline", "Cue started learning how you speak", "Your first session.");

  // The pace baseline for this mode: provisional after one session, settled after three.
  const base = paceBaseline(p, mode);
  if (base) {
    const wpm = toApproxWpm(base.sps);
    const settled = base.sessions >= BASELINE_SETTLED;
    const { fresh, insight } = upsertInsight(p, {
      id: `baseline_pace:${mode}`,
      kind: "baseline_pace",
      statement: `Your natural pace ${MODE_IN[mode]} is about ${wpm} words a minute.`,
      detail: settled
        ? `The middle of your last ${base.sessions} ${MODES_NAME[mode]}.`
        : `From ${base.sessions === 1 ? "one session" : `${base.sessions} sessions`} so far; it settles after ${BASELINE_SETTLED}.`,
      confidence: Math.min(0.95, 0.4 + 0.18 * base.sessions),
      level: settled ? "strong" : base.sessions === 2 ? "likely" : "emerging",
      sessions: base.sessions,
      combination: false,
      updatedAt: at,
    });
    if (fresh) {
      event(p, at, "cue", "baseline", `Cue established your speaking baseline ${MODE_IN[mode]}`, insight.statement);
      candidates.push({
        priority: 3,
        update: {
          label: "Cue updated",
          text: `I’ve learned your natural pace ${MODE_IN[mode]}: about ${wpm} words a minute. From now on I judge rushing against your own pace instead of a standard one.`,
          ref: { insight: insight.id },
        },
      });
    } else if (settled && base.sessions === BASELINE_SETTLED) {
      event(p, at, "cue", "baseline", `Your pace baseline ${MODE_IN[mode]} has settled`, insight.statement);
    }
  }

  // EVALUATE: running experiments in this mode take this session as one of their arms.
  p.experimentsLog = p.experimentsLog.map((e) => {
    if (e.status !== "running" || e.mode !== mode) return e;
    const next = concludeExperiment(recordArm(e, digest, interventions), at);
    if (next.status !== "running") {
      const b = next.behavior;
      const title =
        next.status === "adopted"
          ? `Cue adopted a new approach to ${BEHAVIOR_NAME[b]}`
          : next.status === "kept_by_you"
            ? `Cue checked fewer ${REMINDER_NAME[b]}`
            : `Cue kept its usual approach to ${BEHAVIOR_NAME[b]}`;
      event(p, at, "cue", "experiment", title, next.finding ?? "");
      candidates.push({
        priority: 4,
        update: {
          label: "Cue updated",
          text:
            next.status === "adopted"
              ? next.better
                ? `I’ve noticed you do better when I ${STRATEGY_TEXT[next.candidate]} than when I ${STRATEGY_TEXT[next.control]} (${next.finding}) I’ve adjusted your coaching accordingly.`
                : `I’ve noticed that when I ${STRATEGY_TEXT[next.candidate]}, instead of when I ${STRATEGY_TEXT[next.control]}, you do just as well with less from me (${next.finding}) I’ve adjusted your coaching accordingly.`
              : next.status === "kept_by_you"
                ? `Since you asked for fewer ${REMINDER_NAME[b]}, I’ve been watching how it goes: ${lowerFirst(next.finding ?? "")} I’ll keep them fewer, as you asked. Say if you’d like more again.`
                : `I tried a lighter touch with ${REMINDER_NAME[b]}, and it didn’t work as well for you (${lowerFirst(next.finding ?? "")}). I’ve gone back to how I coached before.`,
          ref: { experiment: next.id },
        },
      });
    }
    return next;
  });

  // EVALUATE: do taps beat holding back? Only with enough of both, for the strategy in use.
  const stage = stageOf(p);
  if (stage !== "new") {
    for (const b of ["rushing", "fillers", "no_pause"] as const) {
      const strategy = p.plan.modes[mode].behaviors[b].strategy;
      const eff = tapEffect(recordsFor(p.sessions, p.interventions, b, mode, strategy));
      if (eff.verdict === "measuring") continue;
      const tapShare = eff.tapWorked / eff.taps;
      const holdShare = eff.holdoutWorked / eff.holdouts;
      const facts = `After a tap you ${WORKED[b]} ${pct(tapShare)} of the time; when I held one back, you ${WORKED[b]} ${pct(holdShare)} of the time anyway (${eff.taps} taps, ${eff.holdouts} held back).`;
      const id = `coaching:${b}:${mode}`;
      const verdictText =
        eff.verdict === "helps"
          ? `My ${REMINDER_NAME[b]} help you ${MODE_IN[mode]}.`
          : eff.verdict === "no_benefit"
            ? `My ${REMINDER_NAME[b]} ${MODE_IN[mode]} haven’t made a clear difference yet.`
            : `It’s not yet clear whether my ${REMINDER_NAME[b]} ${MODE_IN[mode]} help.`;
      const { fresh } = upsertInsight(p, {
        id,
        kind: `coaching:${eff.verdict}`,
        statement: verdictText,
        detail: facts,
        confidence: Math.round(Math.max(eff.pBetter, 1 - eff.pBetter) * 100) / 100,
        level:
          eff.verdict === "helps" && eff.pBetter > 0.97 ? "strong" : eff.verdict === "unclear" ? "emerging" : "likely",
        sessions: new Set(recordsFor(p.sessions, p.interventions, b, mode).map((r) => r.sessionId)).size,
        combination: false,
        updatedAt: at,
      });
      if (fresh) event(p, at, "cue", "experiment", verdictText, facts);

      const exps = p.experimentsLog.filter((e) => e.behavior === b && e.mode === mode);
      const recentlyTried = exps.some(
        (e) => e.status === "running" || (e.concludedAt && p.sessions.slice(-10).some((d) => d.at === e.concludedAt)),
      );
      if (eff.verdict === "no_benefit" && STRATEGIES[b].length > 1 && !recentlyTried && strategy === STRATEGIES[b][0]) {
        const trigger = `${capitalize(REMINDER_NAME[b])} ${MODE_IN[mode]} haven’t made a clear difference. ${facts}`;
        const e = startExperiment(b, mode, "alternate", trigger, at, p.sessions);
        if (e) {
          p.experimentsLog.push(e);
          event(p, at, "cue", "experiment", `Cue started comparing two ways of coaching ${BEHAVIOR_NAME[b]}`, trigger);
          candidates.push({
            priority: 3,
            update: {
              label: "Cue updated",
              text: `${trigger} So I’m going to try something different in some ${MODES_NAME[mode]}: I’ll ${STRATEGY_TEXT[e.candidate]}, and compare.`,
              ref: { experiment: e.id },
            },
          });
        }
      }
    }
  }

  // DISCOVER ------------------------------------------------------------------------
  const found = discover(p, at);
  for (const i of found)
    if (i.level !== "emerging")
      candidates.push({
        priority: 2,
        update: {
          label: "Something new I've learned",
          text: `${i.statement} ${i.detail}`,
          ref: { insight: i.id },
        },
      });

  // IMPROVE: progress against the wearer's own early sessions, fading support, boosters.
  let boosterCause: string | undefined;
  for (const b of ["rushing", "fillers", "no_pause"] as const) {
    const prog = progress(p.sessions, b, mode);
    if (!prog) continue;
    const key = `${b}:${mode}`;
    for (const step of [20, 40, 60]) {
      const mk = `${key}:${step}`;
      if (prog.change * 100 >= step && prog.agree >= 2 && !p.milestones.includes(mk)) {
        p.milestones.push(mk);
        event(
          p,
          at,
          "you",
          "improvement",
          `Your ${METRIC_NAME[b]} ${MODE_IN[mode]} is down ${Math.round(prog.change * 100)}%`,
          `${formatMetric(b, prog.early)} in your first sessions, ${formatMetric(b, prog.recent)} across your last three.`,
        );
      }
    }
    if (!p.faded[key] && prog.change >= 0.4 && prog.agree === 3 && prog.n >= 6) {
      p.faded[key] = at;
      candidates.push({
        priority: 3,
        update: {
          label: "Cue updated",
          text: `You’ve cut your ${METRIC_NAME[b]} ${MODE_IN[mode]} by ${Math.round(prog.change * 100)}% since your first sessions, so I’m stepping back: fewer ${REMINDER_NAME[b]}, so you can catch it yourself. If it slips back, I’ll step in again.`,
          ref: {},
        },
      });
    } else if (p.faded[key] && prog.agree === 0 && prog.recent >= prog.early * 0.85) {
      delete p.faded[key];
      boosterCause = `Your ${METRIC_NAME[b]} ${MODE_IN[mode]} has slipped back over your last three sessions.`;
      event(p, at, "you", "improvement", `Your ${METRIC_NAME[b]} ${MODE_IN[mode]} slipped back`, boosterCause);
    }
  }

  // FOCUS -----------------------------------------------------------------------------
  const f = p.focus;
  if (f.current && focusMetric(digest, f.current) !== null) f.sessionsOnFocus++;
  if (f.current && f.startMetric === null) f.startMetric = currentFocusMetric(p, f.current);
  if (f.current && hasGraduated(p)) {
    const done = f.current;
    f.graduated.push({ key: done, at });
    event(
      p,
      at,
      "you",
      "improvement",
      GRADUATION_TEXT[done],
      `Your ${FOCUS_LABEL[done].toLowerCase()} improved by 30% or more since it became your focus.`,
    );
    const next = recommendFocus(p, [done]);
    if (next && f.chosenBy === "cue") {
      setFocusState(p, next.key, "cue", next.why, at);
      event(
        p,
        at,
        "cue",
        "focus",
        `Cue moved your focus to ${FOCUS_LABEL[next.key].toLowerCase()}`,
        `${GRADUATION_TEXT[done]} ${next.why}`,
      );
      candidates.push({
        priority: 5,
        update: {
          label: "Your new focus",
          text: `${FOCUS_LABEL[next.key]}. ${GRADUATION_TEXT[done]} ${next.why}`,
          ref: { focus: next.key },
        },
      });
    } else if (next) f.suggestion = next;
  } else if (!f.current && f.chosenBy === "cue") {
    const rec = recommendFocus(p);
    if (rec) {
      setFocusState(p, rec.key, "cue", rec.why, at);
      event(p, at, "cue", "focus", `Cue picked your first focus: ${FOCUS_LABEL[rec.key].toLowerCase()}`, rec.why);
      candidates.push({
        priority: 4,
        update: { label: "Your new focus", text: `${FOCUS_LABEL[rec.key]}. ${rec.why}`, ref: { focus: rec.key } },
      });
    }
  }

  if (wasStage !== stage)
    event(
      p,
      at,
      "cue",
      "baseline",
      stage === "returning"
        ? "Cue now coaches you from your own baseline"
        : "Cue has enough history to fine-tune your coaching",
      stage === "returning"
        ? `${p.sessions.length} sessions in, Cue knows your usual pace, fillers and pauses.`
        : "Cue has judged enough taps to tell which ones help you.",
    );

  // ADAPT ------------------------------------------------------------------------------
  const adaptations = replan(p, at, boosterCause);
  const update = pickUpdate(p, at, candidates);
  return { profile: p, update, adaptations };
}

function setFocusState(p: Profile, key: FocusKey | null, by: "cue" | "you", why: string, at: string) {
  p.focus = {
    ...p.focus,
    current: key,
    chosenBy: by,
    since: key ? at : null,
    startMetric: key ? currentFocusMetric(p, key) : null,
    sessionsOnFocus: 0,
    suggestion: null,
    why,
  };
}

const RATING_TEXT: Record<Rating, string> = {
  helpful: "helpful",
  too_many: "too frequent",
  distracting: "distracting",
};

/** The wearer's verdict on one kind of tap in a session. */
export function rateCues(
  prev: Profile,
  sessionId: string,
  b: CoachedBehavior,
  rating: Rating,
  at: string,
): LearnResult {
  const p = clone(prev);
  const d = p.sessions.find((x) => x.id === sessionId);
  if (!d) return { profile: prev, update: null, adaptations: [] };
  d.feedback = { ...d.feedback, [b]: rating };
  p.experimentsLog = p.experimentsLog.map((e) => (e.behavior === b ? refreshArmFeedback(e, d) : e));
  const mode = d.mode;
  let cause: string | undefined;
  if (rating === "helpful") {
    event(
      p,
      at,
      "cue",
      "preference",
      `You found ${REMINDER_NAME[b]} helpful`,
      `After your ${MODES_NAME[mode].slice(0, -1)} session.`,
    );
  } else {
    const why = `You said ${REMINDER_NAME[b]} were ${RATING_TEXT[rating]} ${MODE_IN[mode]}.`;
    upsertPref(p, {
      kind: "less_often",
      behavior: b,
      mode,
      statement: `You’d rather have fewer ${REMINDER_NAME[b]} ${MODE_IN[mode]}.`,
      source: "you",
      why,
      at,
    });
    event(p, at, "cue", "preference", `Cue remembered: fewer ${REMINDER_NAME[b]} ${MODE_IN[mode]}`, why);
    const busy = p.experimentsLog.some(
      (e) => e.behavior === b && e.mode === mode && (e.status === "running" || e.status !== "kept_control"),
    );
    if (STRATEGIES[b].length > 1 && !busy && p.plan.modes[mode].behaviors[b].strategy === STRATEGIES[b][0]) {
      const e = startExperiment(b, mode, "switch", why, at, p.sessions);
      if (e) p.experimentsLog.push(e);
    }
    // Distracting more than once, whatever the cue: the taps themselves may be too strong.
    const distracting = p.sessions.filter((s) => Object.values(s.feedback).includes("distracting")).length;
    const hasIntensity = p.preferences.some((x) => x.kind === "intensity");
    if (rating === "distracting" && distracting >= 2 && !hasIntensity) {
      upsertPref(p, {
        kind: "intensity",
        value: "gentle",
        statement: "You prefer gentle vibrations.",
        source: "cue",
        why: `You found taps distracting in ${distracting} sessions, so I guessed gentler taps would suit you. Confirm or correct me.`,
        at,
      });
      event(
        p,
        at,
        "cue",
        "preference",
        "Cue inferred you prefer gentle vibrations",
        `Taps were distracting in ${distracting} sessions.`,
      );
    }
    cause = why;
  }
  const adaptations = replan(p, at, cause);
  const update =
    adaptations.length > 0
      ? pickUpdate(p, at, [
          {
            priority: 5,
            update: {
              label: "Cue updated",
              text: `Got it. ${adaptations.map((a) => a.changed).join(" ")}`,
              ref: {
                preference: p.preferences.find((x) => x.kind === "less_often" && x.behavior === b && x.mode === mode)
                  ?.id,
              },
            },
          },
        ])
      : null;
  return { profile: p, update, adaptations };
}

interface PrefInput {
  kind: Preference["kind"];
  behavior?: CoachedBehavior;
  mode?: CueMode | null;
  value?: string;
  statement: string;
  source: Preference["source"];
  why: string;
  at: string;
}

function upsertPref(p: Profile, x: PrefInput): Preference {
  const same = (q: Preference) =>
    q.kind === x.kind && q.behavior === x.behavior && (q.mode ?? null) === (x.mode ?? null);
  const old = p.preferences.find(same);
  const pref: Preference = {
    id: old?.id ?? uid("pref", x.at),
    kind: x.kind,
    behavior: x.behavior,
    mode: x.mode ?? null,
    value: x.value,
    statement: x.statement,
    source: x.source,
    status: x.source === "you" ? "confirmed" : "active",
    why: x.why,
    createdAt: old?.createdAt ?? x.at,
    updatedAt: x.at,
  };
  p.preferences = [...p.preferences.filter((q) => !same(q)), pref];
  return pref;
}

export const GOAL_TEXT: Record<FocusKey, string> = {
  pace: "keeping a steady pace",
  fillers: "using fewer filler words",
  pauses: "using pauses well",
  conciseness: "speaking more concisely",
  repetition: "repeating yourself less",
};

/** Something the wearer tells Cue directly, in "Your preferences". */
export type PreferenceRequest =
  | { kind: "intensity"; value: "gentle" | "standard" | "firm" }
  | { kind: "fewer_taps" }
  | { kind: "dont_coach"; behavior: CoachedBehavior; mode: CueMode | null }
  | { kind: "goal"; value: FocusKey };

export function setPreference(prev: Profile, req: PreferenceRequest, at: string): LearnResult {
  const p = clone(prev);
  let pref: Preference;
  if (req.kind === "intensity")
    pref = upsertPref(p, {
      kind: "intensity",
      value: req.value,
      statement: `You prefer ${req.value} vibrations.`,
      source: "you",
      why: `You chose ${req.value} vibrations.`,
      at,
    });
  else if (req.kind === "fewer_taps")
    pref = upsertPref(p, {
      kind: "fewer_taps",
      statement: "You prefer fewer taps overall.",
      source: "you",
      why: "You asked for fewer taps.",
      at,
    });
  else if (req.kind === "dont_coach")
    pref = upsertPref(p, {
      kind: "dont_coach",
      behavior: req.behavior,
      mode: req.mode,
      statement: `You don’t want feedback about ${BEHAVIOR_NAME[req.behavior]}${req.mode ? ` ${MODE_IN[req.mode]}` : ""}.`,
      source: "you",
      why: `You asked me not to coach ${BEHAVIOR_NAME[req.behavior]}${req.mode ? ` ${MODE_IN[req.mode]}` : ""}.`,
      at,
    });
  else {
    pref = upsertPref(p, {
      kind: "goal",
      value: req.value,
      statement: `Your current priority is ${GOAL_TEXT[req.value]}.`,
      source: "you",
      why: `You told me your priority is ${GOAL_TEXT[req.value]}.`,
      at,
    });
    setFocusState(p, req.value, "you", `You chose this: your priority is ${GOAL_TEXT[req.value]}.`, at);
  }
  event(p, at, "cue", "preference", `Cue remembered: ${lowerFirst(pref.statement)}`, pref.why);
  const adaptations = replan(p, at, pref.why);
  return { profile: p, update: null, adaptations };
}

/** Confirm, reject or restore something Cue inferred (a pattern or a preference). */
export function judgeItem(
  prev: Profile,
  id: string,
  verdict: "confirm" | "reject" | "restore",
  at: string,
): LearnResult {
  const p = clone(prev);
  const status = verdict === "confirm" ? "confirmed" : verdict === "reject" ? "rejected" : "active";
  const ins = p.insights.find((i) => i.id === id);
  const pref = p.preferences.find((x) => x.id === id);
  const item = ins ?? pref;
  if (!item) return { profile: prev, update: null, adaptations: [] };
  item.status = status;
  const what = item.statement;
  let cause: string | undefined;
  if (verdict === "reject") {
    cause = `You told me “${what}” isn’t right.`;
    event(p, at, "cue", "correction", `You corrected Cue: “${what}”`, "Cue stopped using it.");
  } else if (verdict === "confirm") {
    event(p, at, "cue", "correction", `You confirmed: “${what}”`, "Cue will keep using it.");
  } else {
    cause = `You told me “${what}” is right after all.`;
    event(p, at, "cue", "correction", `You restored: “${what}”`, "Cue is using it again.");
  }
  const adaptations = replan(p, at, cause);
  return { profile: p, update: null, adaptations };
}

/** Remove a preference the wearer set. */
export function deletePreference(prev: Profile, id: string, at: string): LearnResult {
  const p = clone(prev);
  const pref = p.preferences.find((x) => x.id === id);
  if (!pref) return { profile: prev, update: null, adaptations: [] };
  p.preferences = p.preferences.filter((x) => x.id !== id);
  // Asking for fewer reminders started a switch; removing the wish ends it.
  if (pref.kind === "less_often")
    p.experimentsLog = p.experimentsLog.map((e) =>
      e.behavior === pref.behavior && e.mode === pref.mode && e.design === "switch" && e.status !== "kept_control"
        ? { ...e, status: "kept_control", concludedAt: at, finding: e.finding ?? "you removed the preference" }
        : e,
    );
  if (pref.kind === "goal" && p.focus.chosenBy === "you" && p.focus.current === pref.value)
    setFocusState(p, null, "cue", "", at);
  const cause = `You removed “${pref.statement}”.`;
  event(p, at, "cue", "correction", `You removed a preference: “${pref.statement}”`, "Cue no longer acts on it.");
  return { profile: p, update: null, adaptations: replan(p, at, cause) };
}

/** Choose a focus yourself, or hand the choice back to Cue (null). */
export function chooseFocus(prev: Profile, key: FocusKey | null, at: string): LearnResult {
  const p = clone(prev);
  if (key) {
    setFocusState(p, key, "you", `You chose to work on ${FOCUS_LABEL[key].toLowerCase()}.`, at);
    event(p, at, "you", "focus", `You chose your focus: ${FOCUS_LABEL[key].toLowerCase()}`, "Cue gives it priority.");
  } else {
    const rec = recommendFocus(p);
    setFocusState(p, rec?.key ?? null, "cue", rec?.why ?? "", at);
    event(
      p,
      at,
      "cue",
      "focus",
      rec ? `Cue picked your focus: ${FOCUS_LABEL[rec.key].toLowerCase()}` : "Cue will pick a focus once it knows you",
      rec?.why ?? "It needs two sessions first.",
    );
  }
  return {
    profile: p,
    update: null,
    adaptations: replan(p, at, key ? `You chose ${FOCUS_LABEL[key].toLowerCase()} as your focus.` : undefined),
  };
}

/** "That's not right" on a Cue updated card: undo what it describes. */
export function correctUpdate(prev: Profile, updateId: string, at: string): LearnResult {
  const u = prev.updates.find((x) => x.id === updateId);
  if (!u) return { profile: prev, update: null, adaptations: [] };
  let r: LearnResult = { profile: prev, update: null, adaptations: [] };
  if (u.ref.insight) r = judgeItem(prev, u.ref.insight, "reject", at);
  else if (u.ref.preference) r = deletePreference(prev, u.ref.preference, at);
  else if (u.ref.experiment) {
    const p = clone(prev);
    const e = p.experimentsLog.find((x) => x.id === u.ref.experiment)!;
    p.experimentsLog = p.experimentsLog.map((x): Experiment =>
      x.id === e.id ? { ...x, status: "kept_control", concludedAt: at, finding: "you said it didn’t suit you" } : x,
    );
    event(
      p,
      at,
      "cue",
      "correction",
      `You corrected Cue about ${REMINDER_NAME[e.behavior]}`,
      "Cue went back to its usual approach.",
    );
    r = {
      profile: p,
      update: null,
      adaptations: replan(p, at, `You told me the change to ${REMINDER_NAME[e.behavior]} didn’t suit you.`),
    };
  } else if (u.ref.focus) {
    const p = clone(prev);
    setFocusState(p, null, "you", "", at);
    event(p, at, "cue", "correction", "You turned down Cue’s focus", "Choose one yourself whenever you like.");
    r = { profile: p, update: null, adaptations: replan(p, at, "You turned down the focus I picked.") };
  }
  r.profile = {
    ...r.profile,
    updates: r.profile.updates.map((x) => (x.id === updateId ? { ...x, status: "corrected" } : x)),
  };
  return r;
}

export function markUpdateSeen(p: Profile, id: string): Profile {
  return { ...p, updates: p.updates.map((u) => (u.id === id && u.status === "new" ? { ...u, status: "seen" } : u)) };
}

/** The wearer says what kind of session it was ("interview", …), so contexts can be compared. */
export function setSessionContext(prev: Profile, sessionId: string, context: string | null, at: string): LearnResult {
  const p = clone(prev);
  const d = p.sessions.find((x) => x.id === sessionId);
  if (!d) return { profile: prev, update: null, adaptations: [] };
  d.context = context;
  discover(p, at);
  return { profile: p, update: null, adaptations: replan(p, at) };
}

/** Forget one session: its numbers, its taps, and anything that depended on them. */
export function forgetSession(prev: Profile, sessionId: string, at: string): LearnResult {
  const p = clone(prev);
  p.sessions = p.sessions.filter((d) => d.id !== sessionId);
  p.interventions = p.interventions.filter((r) => r.sessionId !== sessionId);
  p.experimentsLog = p.experimentsLog.map((e) => ({ ...e, arms: e.arms.filter((a) => a.sessionId !== sessionId) }));
  p.insights = p.insights.filter((i) => (i.kind !== "baseline_pace" && !i.kind.startsWith("coaching:") ? true : false));
  for (const mode of ["conversation", "presentation"] as const) {
    const base = paceBaseline(p, mode);
    if (base)
      upsertInsight(p, {
        id: `baseline_pace:${mode}`,
        kind: "baseline_pace",
        statement: `Your natural pace ${MODE_IN[mode]} is about ${toApproxWpm(base.sps)} words a minute.`,
        detail: `From ${base.sessions} session${base.sessions === 1 ? "" : "s"}.`,
        confidence: Math.min(0.95, 0.4 + 0.18 * base.sessions),
        level: base.sessions >= BASELINE_SETTLED ? "strong" : "emerging",
        sessions: base.sessions,
        combination: false,
        updatedAt: at,
      });
  }
  discover(p, at);
  event(p, at, "cue", "correction", "You deleted a session", "Cue forgot its numbers and recalculated what it knows.");
  return { profile: p, update: null, adaptations: replan(p, at, "You deleted a session.") };
}

export function setLearning(p: Profile, on: boolean): Profile {
  return { ...p, learning: on };
}

export function setExperiments(prev: Profile, on: boolean, at: string): LearnResult {
  const p = clone(prev);
  p.experiments = on;
  return {
    profile: p,
    update: null,
    adaptations: replan(p, at, on ? undefined : "You asked me not to hold back taps."),
  };
}

/** Forget everything. Settings (learning on, experiments on) are kept. */
export function resetProfile(prev: Profile, at: string): Profile {
  const p = emptyProfile(at);
  p.learning = prev.learning;
  p.experiments = prev.experiments;
  event(p, at, "cue", "reset", "You reset what Cue had learned", "Cue starts again from its standard coaching.");
  return p;
}

export { stageOf };
