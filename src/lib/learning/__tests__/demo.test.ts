import { describe, expect, it } from "vitest";
import { experimentStory, feedbackStory, quickTalkerStory } from "../demo";

// The /learning demo page tells these stories from live computation; these checks keep them true.
describe("demo stories", () => {
  it("act 1: the same speech is tapped in session 1 and not in session 2", () => {
    const s = quickTalkerStory();
    expect(s.first.taps.filter((t) => t.behavior === "rushing").length).toBeGreaterThan(0);
    expect(s.second.taps.filter((t) => t.behavior === "rushing")).toHaveLength(0);
    expect(s.second.limit[0].wpm).toBeGreaterThan(s.first.limit[0].wpm);
    expect(s.first.pace.length).toBeGreaterThan(30);
    // Pace is drawn in the same units Cue states it in: the quick talker sits near their learned pace.
    const pace = s.first.pace.map((p) => p.wpm).sort((a, b) => a - b);
    const said = Number(s.update!.text.match(/about (\d+)/)![1]);
    expect(Math.abs(pace[pace.length >> 1] - said)).toBeLessThan(10);
  });

  it("act 2: after 'too many', fewer slow-down taps for the same speech", () => {
    const s = feedbackStory();
    const n = (t: typeof s.first) => t.taps.filter((x) => x.behavior === "rushing").length;
    expect(n(s.second)).toBeLessThan(n(s.first));
    expect(n(s.second)).toBeGreaterThan(0);
    expect(s.update?.text).toMatch(/^Got it/);
  });

  it("act 3: holdouts, an experiment, and an adopted strategy", () => {
    const s = experimentStory();
    expect(s.sessions).toHaveLength(20);
    expect(s.sessions.some((x) => x.rushingHoldouts > 0)).toBe(true);
    expect(s.profile.experimentsLog[0].status).toBe("adopted");
    expect(s.sessions.at(-1)!.strategy).toBe("sustained");
    expect(s.experiment).not.toBeNull();
    expect(s.after!.tapsPerSession).toBeLessThan(s.before!.tapsPerSession);
  });
});
