import { describe, expect, it } from "vitest";
import { NEED_MORE } from "../likeClassifier";
import { classifyLowkey, lowkeySpan } from "../lowkeyClassifier";
import { simulateWords } from "../simulate";

function judge(sentence: string) {
  const words = simulateWords(sentence);
  const i = words.findIndex((_, k) => lowkeySpan(words, k) > 0);
  const v = classifyLowkey(words, i, lowkeySpan(words, i) as 1 | 2, { rightClosed: true });
  if (v === NEED_MORE) throw new Error("NEED_MORE");
  return v.filler;
}

describe("lowkey", () => {
  it.each([
    "i lowkey want to go",
    "it's lowkey good",
    "Lowkey, i'm so tired",
    "i low key hate this",
    "that was low-key amazing",
    "we lowkey forgot",
    "lowkey i think it's fine",
  ])("filler: %s", (s) => expect(judge(s)).toBe(true));

  it.each(["it was a low-key party", "keep it lowkey", "a pretty low key vibe", "we had a lowkey night"])(
    "not a filler: %s",
    (s) => expect(judge(s)).toBe(false),
  );

  it("waits for the next word when nothing follows yet", () => {
    const words = simulateWords("i lowkey");
    expect(classifyLowkey(words, 1, 1, { rightClosed: false })).toBe(NEED_MORE);
  });
});
