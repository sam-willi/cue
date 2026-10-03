import { describe, expect, it } from "vitest";
import { classifyLike, NEED_MORE } from "../likeClassifier";
import { simulateWords } from "../simulate";
import type { LikeUse } from "../types";

/** Classify the n-th "like" (0-based) in a fully heard sentence. */
function use(sentence: string, nth = 0) {
  const words = simulateWords(sentence);
  const idx = words.map((w, i) => (w.norm === "like" ? i : -1)).filter((i) => i >= 0)[nth];
  const v = classifyLike(words, idx, { rightClosed: true });
  if (v === NEED_MORE) throw new Error("unexpected NEED_MORE");
  return v;
}

const FILLER: [string, LikeUse][] = [
  ["i like went to the mall yesterday", "discourse"],
  ["he like said no", "discourse"],
  ["i like totally forgot", "discourse"],
  ["we like literally ran out of time", "discourse"],
  ["she was like really tired", "discourse"],
  ["it's like super weird", "discourse"],
  ["and like we just left", "discourse"],
  ["so like i don't know", "discourse"],
  ["but like the thing is it's fine", "discourse"],
  ["Like, honestly it was fine", "discourse"],
  ["we went, like, home after", "discourse"],
  ["it was um like whatever", "discourse"],
  ["i was like going to call you", "discourse"],
  ["it was like like crazy", "discourse"],
  ["and i was, like, i don't know", "quotative"],
  ["she was like, no way", "quotative"],
  ["i was like this is crazy", "quotative"],
  ["there were like twenty people", "approximator"],
  ["it cost like 40 bucks", "approximator"],
];

const SEMANTIC: [string, LikeUse][] = [
  ["i like tofu", "verb"],
  ["i like your shirt", "verb"],
  ["you like it", "verb"],
  ["they like pizza", "verb"],
  ["my friends like hiking", "verb"],
  ["i like going there", "verb"],
  ["i would like to go", "verb"],
  ["i'd like a coffee", "verb"],
  ["i don't like that", "verb"],
  ["i really like it", "verb"],
  ["do you like like her", "verb"],
  ["what do you like?", "verb"],
  ["i want to like it", "verb"],
  ["i like big dogs", "verb"],
  ["it looks like rain", "comparison"],
  ["i feel like we should go", "comparison"],
  ["it sounds like a plan", "comparison"],
  ["it was like a dream", "comparison"],
  ["just like that", "comparison"],
  ["things like that", "example"],
  ["like i said it's fine", "conjunction"],
  ["kind of like a hug", "hedge"],
];

describe("classifyLike — fillers", () => {
  it.each(FILLER)("%s → %s", (s, expected) => {
    expect(use(s).use).toBe(expected);
  });
});

describe("classifyLike — meaningful uses", () => {
  it.each(SEMANTIC)("%s → %s", (s, expected) => {
    expect(use(s).use).toBe(expected);
  });
});

describe("classifyLike — the two headline examples", () => {
  it("buzz-worthy: 'i like went to the mall yesterday'", () => {
    const v = use("i like went to the mall yesterday");
    expect(v.use).toBe("discourse");
    expect(v.confidence).toBeGreaterThanOrEqual(0.85);
  });
  it("not a filler: 'i like tofu'", () => {
    const v = use("i like tofu");
    expect(v.use).toBe("verb");
  });
});

describe("classifyLike — waits for right context", () => {
  it("returns NEED_MORE when 'like' is the last word heard so far", () => {
    const words = simulateWords("i like");
    expect(classifyLike(words, 1, { rightClosed: false })).toBe(NEED_MORE);
  });
});
