import { describe, expect, it } from "vitest";
import { confirmTones, cueTones, CUE_NOTES, onSegments, tonesLength } from "../earcon";
import { CONFIRMS, PATTERNS, type ConfirmPattern, type CuePattern } from "../patterns";

const CUES = Object.keys(PATTERNS) as CuePattern[];
const RAMPS = Object.keys(CONFIRMS) as ConfirmPattern[];

describe("onSegments", () => {
  it("keeps the on steps of an on/off pattern", () => {
    expect(onSegments([50, 150, 50])).toEqual([
      { at: 0, dur: 0.05 },
      { at: 0.2, dur: 0.05 },
    ]);
    expect(onSegments([450])).toEqual([{ at: 0, dur: 0.45 }]);
  });
});

describe("cue sounds", () => {
  it("play each cue's haptic rhythm: one tone per pulse, at the pulse's start", () => {
    for (const p of CUES) {
      const tones = cueTones(p);
      const pulses = onSegments(PATTERNS[p].vibrate);
      expect(tones.map((t) => t.at)).toEqual(pulses.map((s) => s.at));
    }
  });

  it("start sharply, like the haptic cues", () => {
    for (const p of CUES) for (const t of cueTones(p)) expect(t.attack).toBeLessThanOrEqual(0.005);
  });

  it("give each cue its own shape: a single tick, steps going down, a sweep going up", () => {
    const tap = cueTones("tap");
    expect(tap).toHaveLength(1);
    expect(tap[0].freqEnd).toBeUndefined();

    const steps = cueTones("steps").map((t) => t.freq);
    for (let k = 1; k < steps.length; k++) expect(steps[k]).toBeLessThan(steps[k - 1]);

    const [push] = cueTones("push");
    expect(push.freqEnd).toBeGreaterThan(push.freq);

    const starts = CUES.map((p) => cueTones(p)[0].freq);
    expect(new Set(starts).size).toBe(CUES.length);
  });

  it("never let one tone run into the next, so the rhythm stays countable", () => {
    for (const p of CUES) {
      const tones = cueTones(p);
      for (let k = 1; k < tones.length; k++) expect(tones[k - 1].at + tones[k - 1].dur).toBeLessThan(tones[k].at);
    }
  });

  it("fit inside the cue's on-screen time", () => {
    for (const p of CUES) expect(tonesLength(cueTones(p)) * 1000).toBeLessThan(PATTERNS[p].durationMs);
  });
});

describe("confirmation sounds", () => {
  it("swell in with no sharp onset, so they can't be mistaken for a cue", () => {
    for (const r of RAMPS) for (const t of confirmTones(r)) expect(t.attack).toBeGreaterThanOrEqual(0.015);
  });

  it("grow for Cue on and fade for Cue off", () => {
    const up = confirmTones("ramp_up").map((t) => t.peak);
    const down = confirmTones("ramp_down").map((t) => t.peak);
    expect(up.at(-1)!).toBeGreaterThan(up[0]);
    expect(down.at(-1)!).toBeLessThan(down[0]);
  });

  it("hold a steady pitch that no cue note uses", () => {
    const cueHz = new Set(Object.values(CUE_NOTES).flat());
    for (const r of RAMPS)
      for (const t of confirmTones(r)) {
        expect(cueHz.has(t.freq)).toBe(false);
        expect(t.freqEnd).toBeUndefined();
      }
  });
});
