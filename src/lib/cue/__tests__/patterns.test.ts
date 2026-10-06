import { describe, expect, it } from "vitest";
import { CONFIRMS, CUE_LEGEND, PATTERNS, patternFor } from "../patterns";

describe("patternFor", () => {
  it("gives each behavior its own cue when distinct cues are on", () => {
    expect(patternFor("filler_um", true)).toBe("hum");
    expect(patternFor("filler_like", true)).toBe("hum");
    expect(patternFor("filler_lowkey", true)).toBe("hum");
    expect(patternFor("rushing", true)).toBe("steps");
    expect(patternFor("no_pause", true)).toBe("tap");
    expect(patternFor("long_turn", true)).toBe("knock");
    expect(patternFor("too_quiet", true)).toBe("push");
  });

  it("plays each family's root when distinct cues are off", () => {
    expect(patternFor("long_turn", false)).toBe("tap");
    expect(patternFor("filler_um", false)).toBe("push");
    expect(patternFor("too_quiet", false)).toBe("push");
  });
});

describe("haptic vocabulary", () => {
  it("has five cues, each with a different rhythm", () => {
    const rhythms = Object.values(PATTERNS).map((p) => p.vibrate.join(","));
    expect(new Set(rhythms).size).toBe(5);
    expect(CUE_LEGEND).toHaveLength(5);
    expect(new Set(CUE_LEGEND.map((c) => patternFor(c.kind, true))).size).toBe(5);
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
