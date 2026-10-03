import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../config";
import { evaluateSession, type SessionFile } from "../evaluate";
import { simulateWords } from "../simulate";

/** Build a session file as Deepgram would have streamed it: one final result per sentence. */
function fileFor(sentences: string[], corrections: SessionFile["corrections"]): SessionFile {
  let t = 0;
  const messages = sentences.flatMap((text) => {
    const words = simulateWords(text, { startAt: t });
    t = words.at(-1)!.end + 1.5;
    return [
      {
        type: "Results",
        is_final: true,
        channel: {
          alternatives: [
            {
              words: words.map((w) => ({
                word: w.norm,
                punctuated_word: w.text,
                start: w.start,
                end: w.end,
                confidence: w.confidence,
              })),
            },
          ],
        },
      },
      { type: "UtteranceEnd" },
    ];
  });
  return { version: 2, savedAt: "", config: DEFAULT_CONFIG, messages, corrections, selfCatches: [] };
}

describe("evaluateSession", () => {
  const sentences = ["i like went to the mall", "we were just like sitting there", "i like tofu"];
  // Word starts at 150 wpm: sentence 2 begins after sentence 1 (6 words) + 1.5 s gap.
  const s2 = 6 * 0.4 - 0.08 + 1.5;
  const justLikeStart = s2 + 3 * 0.4;

  it("reports a labeled miss the current rules still miss", () => {
    const score = evaluateSession(fileFor(sentences, [{ start: justLikeStart, word: "like", label: "missed" }]));
    expect(score.detections).toBe(1); // only "like went"
    expect(score.misses.stillMissed.map((c) => c.word)).toEqual(["like"]);
  });

  it("reports a labeled false buzz that still fires, per speaking hour", () => {
    const score = evaluateSession(fileFor(sentences, [{ start: 0.4, word: "like", label: "false_buzz" }]));
    expect(score.falseBuzzes.stillFiring).toHaveLength(1);
    expect(score.falseBuzzesPerHour).toBeGreaterThan(0);
  });

  it("counts a fixed false buzz as fixed", () => {
    const score = evaluateSession(fileFor(["i like tofu"], [{ start: 0.4, word: "like", label: "false_buzz" }]));
    expect(score.falseBuzzes).toEqual({ labeled: 1, stillFiring: [] });
  });
});
