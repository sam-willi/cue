import { describe, expect, it } from "vitest";
import { CueSession } from "@/lib/cue/session";
import { feedMessage, parseResults, type DgMessage } from "../parse";

const fluxUpdate = (words: [string, number, number][], event = "Update", windowStart = 0): DgMessage => ({
  type: "TurnInfo",
  event,
  audio_window_start: windowStart,
  words: words.map(([word, start, end]) => ({ word, start, end, confidence: 0.99 })),
});

describe("parseResults", () => {
  it("reads Flux turn updates as interim and EndOfTurn as final", () => {
    const u = parseResults(
      fluxUpdate([
        ["Um,", 1, 1.3],
        ["so", 1.4, 1.6],
      ]),
    );
    expect(u?.isFinal).toBe(false);
    expect(u?.words.map((w) => [w.text, w.norm])).toEqual([
      ["Um,", "um"],
      ["so", "so"],
    ]);
    expect(parseResults(fluxUpdate([["so", 1.4, 1.6]], "EndOfTurn"))?.isFinal).toBe(true);
  });

  it("shifts Flux word times if they're relative to the turn's audio window", () => {
    const u = parseResults(fluxUpdate([["hi", 0.1, 0.4]], "Update", 12));
    expect(u?.words[0].start).toBeCloseTo(12.1);
  });

  it("still reads Nova results", () => {
    const u = parseResults({
      type: "Results",
      is_final: true,
      channel: {
        alternatives: [
          { words: [{ word: "like", punctuated_word: "like,", start: 2, end: 2.2, confidence: 0.9, speaker: 0 }] },
        ],
      },
    });
    expect(u).toEqual({
      isFinal: true,
      words: [{ text: "like,", norm: "like", start: 2, end: 2.2, confidence: 0.9, speaker: 0 }],
    });
  });
});

describe("feedMessage with Flux", () => {
  it("cues an 'um' from a Flux update and treats EndOfTurn as an utterance end", () => {
    const s = new CueSession();
    feedMessage(s, fluxUpdate([["Um,", 1, 1.3]]));
    expect(s.history.map((d) => d.event.type)).toEqual(["filler_um"]);
    // "I was like" then the turn ends: the trailing "like" is decided at the turn end.
    const s2 = new CueSession();
    feedMessage(
      s2,
      fluxUpdate([
        ["I", 1, 1.1],
        ["was", 1.2, 1.4],
        ["like...", 1.5, 1.8],
      ]),
    );
    expect(s2.likeChecks).toHaveLength(0);
    feedMessage(
      s2,
      fluxUpdate(
        [
          ["I", 1, 1.1],
          ["was", 1.2, 1.4],
          ["like...", 1.5, 1.8],
        ],
        "EndOfTurn",
      ),
    );
    expect(s2.likeChecks).toHaveLength(1);
  });
});
