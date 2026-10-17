import { PACE_PRESETS, toApproxWpm } from "@/lib/cue/config";
import { measurePace } from "@/lib/cue/pace";
import { behaviorOf, type CoachedBehavior, type CoachingPlan } from "@/lib/cue/plan";
import { activeAdaptations } from "./coaching";
import { emptyProfile, rateCues } from "./learn";
import { finishSession } from "./live";
import { SPEAKERS, simulateSessions, speak, type SimulatedSession } from "./simulate";
import type { CueUpdate, Profile, Rating } from "./types";

/**
 * The three stories on the /learning demo page, computed by running simulated speakers through
 * the real engine and the real learning loop. Nothing here is scripted: change a threshold in the
 * engine and the page tells a different story.
 */

export interface Trace {
  duration: number;
  /**
   * Pace through the session every 2 s, in the engine's words a minute (syllables a second / 1.4),
   * the same units as the slow-down point and the paces Cue states.
   */
  pace: { t: number; wpm: number }[];
  /** The slow-down point in force at each moment, words a minute. */
  limit: { t: number; wpm: number }[];
  taps: { t: number; behavior: CoachedBehavior }[];
  holdouts: { t: number; behavior: CoachedBehavior }[];
}

/** Seconds of speaking (short gaps included) after which a session learns its own pace. */
const IN_SESSION_BASELINE = 60;

export function traceOf(sim: SimulatedSession, plan: CoachingPlan | null): Trace {
  const words = sim.words;
  const duration = words.at(-1)?.end ?? 0;
  const pace: Trace["pace"] = [];
  let idx = 0;
  for (let t = 8; t <= duration; t += 2) {
    while (idx < words.length && words[idx].end <= t) idx++;
    const p = measurePace(words.slice(Math.max(0, idx - 60), idx), 8);
    if (p) pace.push({ t, wpm: toApproxWpm(p.sps) });
  }
  const clamp = (sps: number) => toApproxWpm(Math.min(6, Math.max(3.6, sps * 1.2)));
  const known = plan?.modes.conversation.paceBaselineSps ?? null;
  let limit: Trace["limit"];
  if (known !== null)
    limit = [
      { t: 0, wpm: clamp(known) },
      { t: duration, wpm: clamp(known) },
    ];
  else {
    // Without a learned pace, the standard point holds until the session has heard a minute of speech.
    let spoken = 0;
    let learnedAt = duration;
    for (let k = 0; k < words.length; k++) {
      spoken += words[k].end - words[k].start;
      const gap = k + 1 < words.length ? words[k + 1].start - words[k].end : 0;
      if (gap > 0 && gap <= 0.6) spoken += gap;
      if (spoken >= IN_SESSION_BASELINE) {
        learnedAt = words[k].end;
        break;
      }
    }
    const standard = toApproxWpm(PACE_PRESETS.conversation.threshold);
    const after = toApproxWpm(sim.session.paceLimit());
    limit = [
      { t: 0, wpm: standard },
      { t: learnedAt, wpm: standard },
      { t: learnedAt, wpm: after },
      { t: duration, wpm: after },
    ];
  }
  const at = (d: (typeof sim.decisions)[number]) => ({ t: d.event.end, behavior: behaviorOf(d.event.type) });
  return {
    duration,
    pace,
    limit,
    taps: sim.decisions.filter((d) => d.delivered).map(at),
    holdouts: sim.decisions.filter((d) => d.withheldReason === "holdout").map(at),
  };
}

export interface TwoSessions {
  first: Trace;
  second: Trace;
  update: CueUpdate | null;
  learned: string;
  changed: string[];
}

const START = new Date("2026-10-01T18:00:00Z");

/** Act 1: a naturally quick talker, the same speech twice. Cue learns their pace in between. */
export function quickTalkerStory(): TwoSessions {
  const model = SPEAKERS.quickTalker;
  const sim1 = speak(model, { seconds: 150, seed: 1, plan: null });
  const r1 = finishSession(emptyProfile(START.toISOString()), sim1.session, {
    id: "a1",
    at: START.toISOString(),
    source: "simulated",
  });
  const plan2 = r1.profile.plan;
  const sim2 = speak(model, { seconds: 150, seed: 1, plan: plan2 });
  const ad = activeAdaptations(r1.profile).find((a) => a.field === "conversation.paceBaselineSps")!;
  return {
    first: traceOf(sim1, null),
    second: traceOf(sim2, plan2),
    update: r1.update,
    learned: ad.learned,
    changed: [ad.changed],
  };
}

/** Act 2: someone who rushes in bursts rates the slow-down taps after session 1. */
export function feedbackStory(rating: Rating = "too_many"): TwoSessions & { profile: Profile } {
  const model = SPEAKERS.burstyRusher;
  const sim1 = speak(model, { seconds: 240, seed: 5, plan: null });
  const r1 = finishSession(emptyProfile(START.toISOString()), sim1.session, {
    id: "b1",
    at: START.toISOString(),
    source: "simulated",
  });
  const rated = rateCues(r1.profile, "b1", "rushing", rating, START.toISOString());
  const sim2 = speak(model, { seconds: 240, seed: 5, plan: rated.profile.plan });
  return {
    first: traceOf(sim1, null),
    second: traceOf(sim2, rated.profile.plan),
    update: rated.update,
    learned: rated.adaptations[0]?.learned ?? "",
    changed: rated.adaptations.map((a) => a.changed),
    profile: rated.profile,
  };
}

export interface ManySessions {
  sessions: {
    index: number;
    rushingTaps: number;
    rushingHoldouts: number;
    strategy: string;
    rushShare: number | null;
    update: CueUpdate | null;
  }[];
  profile: Profile;
  /** The sessions after which Cue started the experiment and settled it, from its own updates. */
  experiment: { started: number; settled: number } | null;
  /** Up to the experiment, and after it settled: what Cue's decision was weighed on. */
  before: Phase | null;
  after: Phase | null;
}

export interface Phase {
  from: number;
  to: number;
  tapsPerSession: number;
  /** Mean share of speaking time spent rushing. */
  rushShare: number;
}

function phase(sessions: ManySessions["sessions"], from: number, to: number): Phase | null {
  const s = sessions.filter((x) => x.index >= from && x.index <= to);
  const shares = s.flatMap((x) => (x.rushShare === null ? [] : [x.rushShare]));
  if (!s.length || !shares.length) return null;
  return {
    from,
    to,
    tapsPerSession: s.reduce((a, x) => a + x.rushingTaps, 0) / s.length,
    rushShare: shares.reduce((a, x) => a + x, 0) / shares.length,
  };
}

/** Act 3: twenty sessions. Cue tests whether its taps help, tries something else, and adopts it. */
export function experimentStory(): ManySessions {
  const run = simulateSessions(SPEAKERS.burstyRusher, { count: 20, seconds: 240, seed: 1, start: START });
  const { profile } = run;
  const sessions = run.sessions.map((s, k) => ({
    index: k + 1,
    rushingTaps: s.taps.rushing ?? 0,
    rushingHoldouts: profile.interventions.filter(
      (r) => r.sessionId === profile.sessions[k].id && r.behavior === "rushing" && r.holdout,
    ).length,
    strategy: s.plan.modes.conversation.behaviors.rushing.strategy,
    rushShare: profile.sessions[k].pace.rushShare,
    update: s.update,
  }));
  // The two updates that name an experiment: the one that starts it, and the one that settles it.
  const marks = sessions.filter((s) => s.update?.ref.experiment).map((s) => s.index);
  const experiment = marks.length >= 2 ? { started: marks[0], settled: marks[1] } : null;
  return {
    profile,
    sessions,
    experiment,
    before: experiment && phase(sessions, 1, experiment.started),
    after: experiment && phase(sessions, experiment.settled + 1, sessions.length),
  };
}
