import { describe, expect, it } from "vitest";
import { countSyllables } from "../syllables";

describe("countSyllables", () => {
  it.each([
    ["I", 1],
    ["like", 1],
    ["went", 1],
    ["mall", 1],
    ["yesterday", 3],
    ["tofu", 2],
    ["table", 2],
    ["jumped", 1],
    ["wanted", 2],
    ["presentation", 4],
    ["unfortunately", 5],
    ["didn't", 2],
    ["don't", 1],
    ["can't", 1],
    ["it's", 1],
    ["we're", 1],
    ["people", 2],
    ["make", 1],
    ["together", 3],
    ["probably", 3],
    ["launch", 1],
    ["20", 2],
    ["7", 2],
    ["lately", 2],
    ["completely", 3],
    ["statement", 2],
    ["whole", 1],
    ["while", 1],
  ])("%s → %i", (w, n) => {
    expect(countSyllables(w)).toBe(n);
  });

  it("is close on a full sentence", () => {
    // 19 syllables by hand.
    const s = "Unfortunately the presentation didn't go the way we wanted";
    const total = s.split(" ").reduce((n, w) => n + countSyllables(w), 0);
    expect(Math.abs(total - 19)).toBeLessThanOrEqual(1);
  });
});
