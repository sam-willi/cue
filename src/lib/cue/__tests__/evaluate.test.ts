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
  return { version: 2, savedAt: "", config: DEFAULT_CONFIG, messages, corrections };
}

describe("evaluateSession", () => {
  const sentences = ["i like went to the mall", "honestly she's like my best friend", "i like tofu"];
  // Word starts at 150 wpm: sentence 2 begins after sentence 1 (6 words) + 1.5 s gap.
  const s2 = 6 * 0.4 - 0.08 + 1.5;
  const justLikeStart = s2 + 2 * 0.4; // "like" is the 3rd word; ambiguous, so not detected

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

describe("scoreLabels", () => {
  it("compares detections with the words the user marked as fillers", async () => {
    const { scoreLabels } = await import("../evaluate");
    // Three sentences; "like went" (detected), "just like sitting" (detected now), "like tofu" (not a filler).
    const base = fileFor(["i like went to the mall", "um so we left", "i like tofu"], []);
    const at = (sentence: number, word: number) => {
      const starts: number[] = [];
      let t = 0;
      for (const text of ["i like went to the mall", "um so we left", "i like tofu"]) {
        const n = text.split(" ").length;
        starts.push(t);
        t += n * 0.4 - 0.08 + 1.5;
      }
      return starts[sentence] + word * 0.4;
    };
    // User marks "like" (went) and "um" as fillers, and also "so" (Cue won't detect that).
    const s = scoreLabels({
      ...base,
      config: { ...base.config, tapOn: "every" },
      fillerLabels: [
        { start: at(0, 1), word: "like" },
        { start: at(1, 0), word: "um" },
        { start: at(1, 1), word: "so" },
      ],
    })!;
    expect(s.caught).toBe(2);
    expect(s.missed.map((m) => m.word)).toEqual(["so"]);
    expect(s.wrong).toEqual([]);
    expect(s.recall).toBeCloseTo(2 / 3);
    expect(s.precision).toBe(1);
  });
});
