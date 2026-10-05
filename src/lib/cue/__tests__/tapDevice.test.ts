import { describe, expect, it } from "vitest";
import { CONFIRMS, PATTERNS } from "../patterns";
import { encodePattern } from "../tapDevice";

describe("encodePattern", () => {
  it("converts milliseconds to 10 ms units", () => {
    expect(Array.from(encodePattern([60]))).toEqual([6]);
    expect(Array.from(encodePattern([50, 110, 50]))).toEqual([5, 11, 5]);
  });

  it("clamps to 1..255 so every step stays on the wire", () => {
    expect(Array.from(encodePattern([0, 4, 3000]))).toEqual([1, 1, 255]);
  });

  it("fits every cue and confirmation pattern in one 20-byte write", () => {
    for (const p of [...Object.values(PATTERNS), ...Object.values(CONFIRMS)]) {
      const bytes = encodePattern(p.vibrate);
      expect(bytes.length).toBeLessThanOrEqual(20);
      expect(bytes.length).toBe(Math.min(20, p.vibrate.length));
    }
  });
});
