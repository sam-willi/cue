import { describe, expect, it } from "vitest";
import { CueSession } from "@/lib/cue/session";
import { defaultPlan } from "@/lib/cue/plan";
import { simulateWords } from "@/lib/cue/simulate";
import { digestSession, findRestarts } from "../digest";
import { concludeExperiment, startExperiment } from "../evaluation";
import { hasGraduated, recommendFocus } from "../focus";
import {
  chooseFocus,
  correctUpdate,
  deletePreference,
  emptyProfile,
  forgetSession,
  judgeItem,
  learnFromSession,
  rateCues,
  resetProfile,
  setPreference,
} from "../learn";
import { localStore, memoryStore, migrate, STORAGE_KEY } from "../store";
import { SPEAKERS, simulateSessions } from "../simulate";
import { binomialTail, probBetter, signTest } from "../stats";
import type { Experiment, SessionDigest } from "../types";

const AT = "2026-10-01T12:00:00.000Z";

describe("memory persistence", () => {
  it("round-trips a learned profile through storage, and the next session uses it", () => {
    const store = memoryStore();
    const run = simulateSessions(SPEAKERS.quickTalker, { count: 2, seconds: 120 });
    store.save(run.profile);
    const loaded = store.load();
    expect(loaded).toEqual(run.profile);
    expect(loaded.plan.modes.conversation.paceBaselineSps).not.toBeNull();
    // A new session coached from the reloaded profile sees the same baseline.
    const s = new CueSession({}, { plan: loaded.plan });
    expect(s.paceLimit()).toBeCloseTo(Math.min(6, loaded.plan.modes.conversation.paceBaselineSps! * 1.2));
  });

  it("works on browser storage, keeps real and simulated memory apart, and survives broken data", () => {
    const backing = new Map<string, string>();
    const storage = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
    };
    const real = localStore(STORAGE_KEY.real, storage);
    const sandbox = localStore(STORAGE_KEY.sandbox, storage);
    const run = simulateSessions(SPEAKERS.quickTalker, { count: 1, seconds: 90 });
    sandbox.save(run.profile);
    expect(real.load().sessions).toHaveLength(0);
    expect(sandbox.load().sessions).toHaveLength(1);
    backing.set(STORAGE_KEY.real, "{not json");
    expect(real.load().sessions).toEqual([]);
    expect(migrate({ version: 99, sessions: [] }, AT).sessions).toEqual([]);
    sandbox.clear();
    expect(backing.has(STORAGE_KEY.sandbox)).toBe(false);
  });

  it("stores numbers, filler words and a few habit phrases, never the transcript", () => {
    const run = simulateSessions(SPEAKERS.burstyRusher, { count: 1, seconds: 120 });
    const text = JSON.stringify(run.profile);
    // "prototype" and "settings" are said, but only once a sentence: no phrase with them is kept.
    expect(text).not.toMatch(/prototype|settings screen/);
  });

  it("reset forgets everything but the settings", () => {
    const run = simulateSessions(SPEAKERS.quickTalker, { count: 2, seconds: 90 });
    const p = resetProfile({ ...run.profile, experiments: false }, AT);
    expect(p.sessions).toEqual([]);
    expect(p.insights).toEqual([]);
    expect(p.plan).toEqual(defaultPlan());
    expect(p.experiments).toBe(false);
    expect(p.events.map((e) => e.kind)).toEqual(["reset"]);
  });

  it("forgetting a session recalculates what depended on it", () => {
    const run = simulateSessions(SPEAKERS.quickTalker, { count: 1, seconds: 120 });
    const p = forgetSession(run.profile, run.profile.sessions[0].id, AT).profile;
    expect(p.sessions).toEqual([]);
    expect(p.interventions).toEqual([]);
    expect(p.plan.modes.conversation.paceBaselineSps).toBeNull();
  });

  it("pausing learning stops sessions being remembered", () => {
    const p = { ...emptyProfile(AT), learning: false };
    const run = simulateSessions(SPEAKERS.quickTalker, { count: 1, seconds: 90, profile: p });
    expect(run.profile.sessions).toEqual([]);
  });

  it("doesn't learn from a session that's too short", () => {
    const s = new CueSession();
    for (const w of simulateWords("so um we went to the shop and then came back home again")) s.ingest([w], true);
    const { digest, interventions } = digestSession({
      id: "x", at: AT, source: "live", mode: "conversation", words: s.words, history: s.history,
      records: s.engineRecords(), paceLimit: s.paceLimit(), noPauseLimit: s.noPauseLimit(), plan: null,
    });
    const r = learnFromSession(emptyProfile(AT), digest, interventions);
    expect(r.skipped).toMatch(/too short/);
    expect(r.profile.sessions).toEqual([]);
  });
});

describe("preferences and corrections", () => {
  const base = simulateSessions(SPEAKERS.burstyRusher, { count: 3, seconds: 150 }).profile;

  it("keeps what the wearer said apart from what Cue inferred", () => {
    let p = rateCues(base, base.sessions[1].id, "rushing", "distracting", AT).profile;
    p = rateCues(p, base.sessions[2].id, "fillers", "distracting", AT).profile;
    const said = p.preferences.filter((x) => x.source === "you");
    const inferred = p.preferences.filter((x) => x.source === "cue");
    expect(said.map((x) => x.kind).sort()).toEqual(["less_often", "less_often"]);
    expect(inferred).toHaveLength(1);
    expect(inferred[0]).toMatchObject({ kind: "intensity", value: "gentle", status: "active", statement: "You prefer gentle vibrations." });
    expect(p.plan.intensity).toBe("gentle");
    // Rejecting the inference undoes it.
    const r = judgeItem(p, inferred[0].id, "reject", AT);
    expect(r.profile.plan.intensity).toBe("standard");
    expect(r.adaptations.some((a) => a.changed === "Taps are back to standard strength.")).toBe(true);
  });

  it("a goal becomes the focus; removing it hands the choice back", () => {
    const p = setPreference(base, { kind: "goal", value: "conciseness" }, AT).profile;
    expect(p.focus).toMatchObject({ current: "conciseness", chosenBy: "you" });
    expect(p.plan.modes.conversation.longTurnSec).toBe(60);
    const goal = p.preferences.find((x) => x.kind === "goal")!;
    expect(goal.statement).toBe("Your current priority is speaking more concisely.");
    const q = deletePreference(p, goal.id, AT).profile;
    expect(q.plan.modes.conversation.longTurnSec).toBeNull();
  });

  it("the wearer's own focus choice is kept, not overridden by Cue", () => {
    let p = chooseFocus(base, "repetition", AT).profile;
    p = simulateSessions(SPEAKERS.burstyRusher, { count: 2, seconds: 120, profile: p }).profile;
    expect(p.focus).toMatchObject({ current: "repetition", chosenBy: "you" });
  });

  it("'That's not right' on a Cue updated card undoes it", () => {
    const run = simulateSessions(SPEAKERS.quickTalker, { count: 1, seconds: 120 });
    const update = run.sessions[0].update!;
    expect(update.ref.insight).toBe("baseline_pace:conversation");
    const r = correctUpdate(run.profile, update.id, AT);
    expect(r.profile.plan.modes.conversation.paceBaselineSps).toBeNull();
    expect(r.profile.updates.find((u) => u.id === update.id)?.status).toBe("corrected");
    expect(r.profile.insights.find((i) => i.id === update.ref.insight)?.status).toBe("rejected");
  });
});

describe("live engine with a plan", () => {
  it("holds back taps at the planned rate, logs them apart, and judges their outcome too", () => {
    const plan = defaultPlan();
    plan.modes.conversation.behaviors.rushing.holdoutRate = 1;
    const s = new CueSession({ categories: { ...new CueSession().config.categories, pauses: false } }, { plan, random: () => 0 });
    const text = Array.from({ length: 40 }, () => "we talked about the plan for the launch and what to change next time").join(" ");
    for (const w of simulateWords(text, { wpm: 300 })) s.ingest([w], true);
    s.endUtterance();
    const held = s.history.filter((d) => d.withheldReason === "holdout");
    expect(held.length).toBeGreaterThan(0);
    expect(s.engineTaps().filter((t) => t.behavior === "rushing")).toHaveLength(0);
    expect(s.engineRecords().filter((r) => r.holdout).every((r) => r.outcome && r.pre !== undefined)).toBe(true);
  });

  it("a focus decides first when two cues are due together", () => {
    const run = (focus: "fillers" | null) => {
      const plan = defaultPlan();
      plan.focus = focus;
      const s = new CueSession({}, { plan });
      const talk = Array.from({ length: 8 }, () => "we talked about the plan for the launch and what to change").join(" ");
      const words = simulateWords(talk, { wpm: 150 }).filter((w) => w.end < 29.6);
      for (const w of words) s.ingest([w], true);
      // Three fillers arrive in one result, just as "no pause" falls due: both want the same moment.
      const t = words.at(-1)!.end + 0.3;
      const ums = ["um", "uh", "um"].map((x, k) => ({ text: x, norm: x, start: t + k * 0.6, end: t + k * 0.6 + 0.3, confidence: 0.95 }));
      s.ingest(ums, true);
      return s.history.filter((d) => d.delivered).map((d) => d.tapReason);
    };
    expect(run(null)).toEqual(["no_pause"]);
    expect(run("fillers")).toEqual(["filler_cluster"]);
  });
});

describe("digest and statistics", () => {
  it("finds restarts and leaves deliberate doubles alone", () => {
    const words = simulateWords("I think I think we should go. It was very very good. And then and then we left.");
    expect(findRestarts(words)).toHaveLength(2);
  });

  it("sign and binomial tests", () => {
    expect(signTest(3, 3)).toBeCloseTo(0.125);
    expect(signTest(5, 5)).toBeCloseTo(0.03125);
    expect(signTest(2, 4)).toBeCloseTo(11 / 16);
    expect(binomialTail(6, 10, 0.2)).toBeLessThan(0.01);
    expect(binomialTail(2, 10, 0.2)).toBeGreaterThan(0.5);
    expect(probBetter(8, 10, 2, 10)).toBeGreaterThan(0.95);
    expect(probBetter(5, 10, 5, 10)).toBeCloseTo(0.5);
  });
});

describe("experiments", () => {
  const d = (metric: number): SessionDigest =>
    ({ mode: "conversation", talkSec: 200, pace: { rushShare: metric }, plan: { strategies: { rushing: "prompt" } } }) as unknown as SessionDigest;
  const arm = (a: "control" | "candidate", metric: number, tapsPerMin: number) => ({
    sessionId: Math.random().toString(), arm: a, metric, tapsPerMin, worked: 2, judged: 3, negative: false,
  });
  const exp = (arms: Experiment["arms"]): Experiment => ({ ...startExperiment("rushing", "conversation", "alternate", "t", AT, [d(0.2)])!, arms });

  it("adopts a candidate that's as good with fewer taps", () => {
    const e = concludeExperiment(exp([arm("candidate", 0.2, 0.5), arm("control", 0.21, 1), arm("candidate", 0.22, 0.6), arm("control", 0.2, 1.1), arm("candidate", 0.2, 0.5), arm("control", 0.2, 1)]), AT);
    expect(e.status).toBe("adopted");
    expect(e.better).toBe(false);
  });

  it("keeps the usual approach when the candidate does worse", () => {
    const e = concludeExperiment(exp([arm("candidate", 0.35, 0.5), arm("control", 0.2, 1), arm("candidate", 0.32, 0.6), arm("control", 0.2, 1.1), arm("candidate", 0.3, 0.5), arm("control", 0.21, 1)]), AT);
    expect(e.status).toBe("kept_control");
  });

  it("waits for enough comparable sessions", () => {
    const e = concludeExperiment(exp([arm("candidate", 0.1, 0.5), arm("control", 0.3, 1)]), AT);
    expect(e.status).toBe("running");
  });
});

describe("focus", () => {
  it("recommends a focus only after a baseline, and graduates on sustained improvement only", () => {
    const one = simulateSessions(SPEAKERS.burstyRusher, { count: 1, seconds: 240 }).profile;
    expect(recommendFocus(one)).toBeNull();
    const p = simulateSessions(SPEAKERS.burstyRusher, { count: 2, seconds: 240 }).profile;
    expect(recommendFocus(p)?.key).toBe("pace");
    const sessions = [0.3, 0.3, 0.1, 0.1, 0.1].map((x, k) => ({ ...p.sessions[0], id: `s${k}`, pace: { ...p.sessions[0].pace, rushShare: x } }));
    const focused = { ...p, sessions, focus: { ...p.focus, current: "pace" as const, startMetric: 0.3, sessionsOnFocus: 4 } };
    expect(hasGraduated(focused)).toBe(true);
    const blip = { ...focused, sessions: [...sessions.slice(0, 4), { ...sessions[0], pace: { ...sessions[0].pace, rushShare: 0.35 } }] };
    expect(hasGraduated(blip)).toBe(false);
  });
});
