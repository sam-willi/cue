import { describe, expect, it } from "vitest";
import { DISFLUENCIES } from "../engine";
import { CONFIRMS, CUE_LEGEND, PATTERNS, patternFor } from "../patterns";

describe("patternFor", () => {
  it("asks for a pause when the wearer has talked too long or used too many fillers", () => {
    for (const filler of DISFLUENCIES) expect(patternFor(filler)).toBe("tap");
    expect(patternFor("no_pause")).toBe("tap");
    expect(patternFor("long_turn")).toBe("tap");
    expect(PATTERNS.tap.action).toBe("Pause");
  });

  it("has one cue for rushing and one for speaking quietly", () => {
    expect(patternFor("rushing")).toBe("steps");
    expect(PATTERNS.steps.action).toBe("Slow down");
    expect(patternFor("too_quiet")).toBe("push");
    expect(PATTERNS.push.action).toBe("Speak up");
  });
});

describe("haptic vocabulary", () => {
  it("has three cues, each with a different rhythm", () => {
    const rhythms = Object.values(PATTERNS).map((p) => p.vibrate.join(","));
    expect(new Set(rhythms).size).toBe(3);
    expect(CUE_LEGEND).toHaveLength(3);
    expect(new Set(CUE_LEGEND.map((c) => patternFor(c.kind))).size).toBe(3);
  });

  it("keeps every cue under a second", () => {
    for (const p of Object.values(PATTERNS)) expect(p.vibrate.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(1000);
  });

  it("shapes confirmations as ramps: each swells from, or fades to, a pulse weaker than any cue's onset", () => {
    const firstCue = Math.min(...Object.values(PATTERNS).map((p) => p.vibrate[0]));
    for (const c of Object.values(CONFIRMS)) {
      const on = c.vibrate.filter((_, k) => k % 2 === 0);
      expect(Math.min(on[0], on[on.length - 1])).toBeLessThan(firstCue);
    }
  });
});
