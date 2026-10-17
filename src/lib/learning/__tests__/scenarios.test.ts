import { describe, expect, it } from "vitest";
import { tapEffect, recordsFor } from "../evaluation";
import { judgeItem, rateCues, setPreference } from "../learn";
import { SPEAKERS, simulateSessions, speak } from "../simulate";

/*
 * Realistic multi-session scenarios: simulated speakers talk through a real CueSession, Cue learns
 * after each session, and the next session is coached with the plan it learned. The headline
 * tests compare two sessions with the same speech, where the second is coached differently
 * only because of what Cue learned in the first.
 */

const rushingTaps = (taps: Record<string, number>) => taps.rushing ?? 0;

describe("two sessions with the same speech, coached differently because of the first", () => {
  it("a naturally quick talker: tapped for 'rushing' in session 1, not in session 2", () => {
    // ~215 words a minute and steady, which is above the standard slow-down point but is this
    // person's normal. Session 1 only learns that after its first minute; session 2 knows it from the start.
    const run = simulateSessions(SPEAKERS.quickTalker, { count: 2, sameSpeech: true, seconds: 180 });
    const [s1, s2] = run.sessions;
    expect(s1.plan.modes.conversation.paceBaselineSps).toBeNull();
    expect(rushingTaps(s1.taps)).toBeGreaterThan(0);
    expect(s2.plan.modes.conversation.paceBaselineSps).not.toBeNull();
    expect(rushingTaps(s2.taps)).toBe(0);

    // The change is explained: what Cue learned, what it changed, and when.
    const ad = run.profile.adaptations.find((a) => a.field === "conversation.paceBaselineSps")!;
    expect(ad.learned).toMatch(/natural pace in conversations is about \d+ words a minute/);
    expect(ad.changed).toMatch(/slow-down taps start above about \d+ words a minute/);
    expect(run.profile.events.some((e) => e.kind === "baseline" && /baseline/.test(e.title))).toBe(true);
    expect(s1.update?.text).toMatch(/natural pace/);
  });

  it("the wearer says slow-down taps were too many: session 2 taps only for longer rushing", () => {
    const first = simulateSessions(SPEAKERS.burstyRusher, { count: 1, seconds: 240, seed: 5 });
    const s1 = first.sessions[0];
    expect(rushingTaps(s1.taps)).toBeGreaterThanOrEqual(3);
    const rated = rateCues(first.profile, first.profile.sessions[0].id, "rushing", "too_many", "2026-10-01T19:00:00Z");
    expect(rated.update?.text).toMatch(/^Got it\./);
    const pref = rated.profile.preferences.find((x) => x.kind === "less_often")!;
    expect(pref).toMatchObject({ behavior: "rushing", mode: "conversation", source: "you" });
    expect(rated.profile.plan.modes.conversation.behaviors.rushing).toMatchObject({
      strategy: "sustained",
      gapScale: 1.6,
    });

    // The same speech again, coached with the updated plan.
    const second = simulateSessions(SPEAKERS.burstyRusher, { count: 1, seconds: 240, seed: 5, profile: rated.profile });
    const s2 = second.sessions[0];
    expect(rushingTaps(s2.taps)).toBeLessThan(rushingTaps(s1.taps));
    // …but it still says something about the long stretches.
    expect(rushingTaps(s2.taps)).toBeGreaterThan(0);
  });

  it("the wearer asks for no filler feedback in conversations: none in session 2", () => {
    const filler = { ...SPEAKERS.burstyRusher, fillerPerMin: 8, bursts: [0], burstEvery: 1e9 };
    const a = simulateSessions(filler, { count: 1, seconds: 180, seed: 9 });
    expect(a.sessions[0].taps.fillers ?? 0).toBeGreaterThan(0);
    const p = setPreference(
      a.profile,
      { kind: "dont_coach", behavior: "fillers", mode: "conversation" },
      "2026-10-02T00:00:00Z",
    ).profile;
    const sim = speak(filler, { seconds: 180, seed: 9, plan: p.plan });
    const fillerDecisions = sim.decisions.filter((d) => d.event.type.startsWith("filler_"));
    expect(fillerDecisions.length).toBeGreaterThan(0);
    expect(fillerDecisions.every((d) => !d.delivered && d.withheldReason === "preference")).toBe(true);
  });

  it("correcting Cue undoes what it changed: reject the pace baseline and session 3 taps like session 1", () => {
    const run = simulateSessions(SPEAKERS.quickTalker, { count: 2, sameSpeech: true, seconds: 180 });
    const corrected = judgeItem(run.profile, "baseline_pace:conversation", "reject", "2026-10-05T00:00:00Z");
    expect(corrected.profile.plan.modes.conversation.paceBaselineSps).toBeNull();
    expect(corrected.adaptations[0].changed).toMatch(/standard slow-down point/);
    expect(corrected.adaptations[0].learned).toMatch(/isn’t right/);
    const third = simulateSessions(SPEAKERS.quickTalker, { count: 1, seconds: 180, profile: corrected.profile });
    expect(rushingTaps(third.sessions[0].taps)).toBeGreaterThan(0);
  });
});

describe("the feedback learning loop across many sessions", () => {
  // Rushes in bursts; frequent slow-down taps stop registering, occasional ones work (see SPEAKERS).
  const run = simulateSessions(SPEAKERS.burstyRusher, { count: 20, seconds: 240, seed: 1 });
  const { profile, sessions } = run;

  it("taps every rushing burst at first, with no holdouts while it learns the baseline", () => {
    expect(sessions.slice(0, 3).every((s) => s.holdouts === 0)).toBe(true);
    expect(sessions[0].plan.modes.conversation.behaviors.rushing.strategy).toBe("prompt");
  });

  it("holds back some taps once it knows the wearer, to measure whether taps help", () => {
    expect(sessions.slice(3).reduce((n, s) => n + s.holdouts, 0)).toBeGreaterThan(3);
    const holdouts = profile.interventions.filter((r) => r.holdout);
    expect(holdouts.every((r) => r.outcome !== null)).toBe(true);
  });

  it("doesn't credit taps for changes that happen anyway, so it tries a different approach", () => {
    const e = profile.experimentsLog.find((x) => x.behavior === "rushing")!;
    expect(e.design).toBe("alternate");
    expect(e.trigger).toMatch(/haven’t made a clear difference/);
    expect(e.trigger).toMatch(/when I held one back/);
    // Sessions took turns between the two strategies while it ran.
    const used = sessions.map((s) => s.plan.modes.conversation.behaviors.rushing.strategy);
    const start = used.indexOf("sustained");
    expect(used.slice(start, start + 4)).toEqual(["sustained", "prompt", "sustained", "prompt"]);
  });

  it("adopts the alternative once comparable sessions show it works as well with fewer taps", () => {
    const e = profile.experimentsLog.find((x) => x.behavior === "rushing")!;
    expect(e.status).toBe("adopted");
    expect(profile.plan.modes.conversation.behaviors.rushing.strategy).toBe("sustained");
    const cand = e.arms.filter((a) => a.arm === "candidate");
    const ctrl = e.arms.filter((a) => a.arm === "control");
    expect(cand.length).toBeGreaterThanOrEqual(3);
    expect(ctrl.length).toBeGreaterThanOrEqual(3);
    const tpm = (xs: typeof cand) => xs.reduce((n, a) => n + a.tapsPerMin, 0) / xs.length;
    expect(tpm(cand)).toBeLessThan(tpm(ctrl));
    expect(sessions.some((s) => s.update && /adjusted your coaching/.test(s.update.text))).toBe(true);
    expect(
      profile.adaptations.some((a) => a.field === "conversation.rushing.strategy" && /from now on/.test(a.changed)),
    ).toBe(true);
  });

  it("with the sparser strategy, its taps now beat holding back", () => {
    const eff = tapEffect(recordsFor(profile.sessions, profile.interventions, "rushing", "conversation", "sustained"));
    expect(eff.taps).toBeGreaterThan(0);
    expect(eff.tapWorked / eff.taps).toBeGreaterThan(eff.holdouts ? eff.holdoutWorked / eff.holdouts : 0);
  });

  it("finds the patterns this speaker really has, with evidence and confidence", () => {
    const turnStart = profile.insights.find((i) => i.id === "fillers_turn_start")!;
    expect(turnStart.statement).toMatch(/more filler words when you start answering/);
    expect(turnStart.sessions).toBeGreaterThanOrEqual(3);
    expect(turnStart.level).toBe("strong");
    expect(turnStart.detail).toMatch(/of your last \d+ sessions/);
  });

  it("picks a focus from the wearer's habits and gives it priority", () => {
    expect(profile.focus.current).toBe("pace");
    expect(profile.focus.chosenBy).toBe("cue");
    expect(profile.plan.focus).toBe("pace");
    // Other habits are tapped less while working on the focus.
    expect(profile.plan.modes.conversation.behaviors.fillers.gapScale).toBeGreaterThan(1);
    expect(profile.plan.modes.conversation.behaviors.rushing.gapScale).toBe(1);
  });
});

describe("no learning from too little evidence", () => {
  it("one session gives a provisional baseline and no patterns", () => {
    const run = simulateSessions(SPEAKERS.burstyRusher, { count: 1, seconds: 240 });
    expect(run.profile.insights.map((i) => i.kind)).toEqual(["baseline_pace"]);
    expect(run.profile.insights[0].level).toBe("emerging");
    expect(run.profile.focus.current).toBeNull();
  });

  it("doesn't invent a pattern the speaker doesn't have", () => {
    // The quick talker's fillers are spread evenly, not bunched at the start of turns.
    const run = simulateSessions(SPEAKERS.quickTalker, { count: 6, seconds: 180 });
    expect(run.profile.insights.some((i) => i.kind === "fillers_turn_start")).toBe(false);
    expect(run.profile.insights.some((i) => i.kind === "fast_before_repeat")).toBe(false);
  });
});
