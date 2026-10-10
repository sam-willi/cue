import { describe, expect, it } from "vitest";
import { pitchHz, semitones } from "../pitch";

const RATE = 16000;
/** 50 ms of a voice-like tone: a fundamental plus weaker harmonics. */
function voice(hz: number, amp = 6000, n = 800): Int16Array {
  const out = new Int16Array(n);
  for (let k = 0; k < n; k++) {
    const t = k / RATE;
    out[k] =
      amp *
      (Math.sin(2 * Math.PI * hz * t) + 0.5 * Math.sin(4 * Math.PI * hz * t) + 0.25 * Math.sin(6 * Math.PI * hz * t));
  }
  return out;
}

describe("pitchHz", () => {
  it("finds the pitch of voiced audio across speaking voices", () => {
    for (const hz of [95, 120, 165, 210, 280]) expect(pitchHz(voice(hz))).toBeCloseTo(hz, -0.5);
  });

  it("reports the fundamental, not an octave below", () => {
    expect(pitchHz(voice(220))! / 220).toBeCloseTo(1, 1);
  });

  it("returns null for silence and for noise", () => {
    expect(pitchHz(new Int16Array(800))).toBeNull();
    expect(pitchHz(voice(150, 20))).toBeNull();
    let seed = 7;
    const noise = Int16Array.from({ length: 800 }, () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed % 12000) - 6000;
    });
    expect(pitchHz(noise)).toBeNull();
  });
});

describe("semitones", () => {
  it("measures pitch in ratios", () => {
    expect(semitones(220, 110)).toBeCloseTo(12);
    expect(semitones(110, 110)).toBe(0);
  });
});
