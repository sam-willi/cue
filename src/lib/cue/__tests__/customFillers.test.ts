import { describe, expect, it } from "vitest";
import { parseCustomFiller, suggestFillers } from "../customFillers";
import { CueSession } from "../session";
import { simulateWords } from "../simulate";

function run(text: string, customFillers: string[], extra: ConstructorParameters<typeof CueSession>[0] = {}) {
  const s = new CueSession({ tapOn: "every", cooldownSec: 0.5, customFillers, ...extra });
  const words = simulateWords(text);
  for (let k = 1; k <= words.length; k++) s.ingest(words.slice(0, k), false);
  s.ingest(words, true);
  s.endUtterance();
  return s.history;
}

describe("parseCustomFiller", () => {
  it("cleans up what was typed", () => {
    expect(parseCustomFiller("  You  Know, ")).toEqual({ phrase: "you know" });
    expect(parseCustomFiller("Basically")).toEqual({ phrase: "basically" });
  });

  it("rejects empty input, long phrases and words Cue already handles", () => {
    expect(parseCustomFiller("  ")).toHaveProperty("error");
    expect(parseCustomFiller("at the end of the day")).toHaveProperty("error");
    expect(parseCustomFiller("um")).toHaveProperty("error");
    expect(parseCustomFiller("like")).toHaveProperty("error");
  });
});

describe("the wearer's own filler words", () => {
  it("counts each one, with the word it was", () => {
    const h = run("so we basically shipped it and basically nobody noticed", ["basically"]);
    expect(h.map((d) => [d.event.type, d.event.phrase])).toEqual([
      ["filler_custom", "basically"],
      ["filler_custom", "basically"],
    ]);
  });

  it("matches phrases, preferring the longest", () => {
    const h = run("it was you know what a long day you know", ["you know", "you know what"]);
    expect(h.map((d) => d.event.phrase)).toEqual(["you know what", "you know"]);
  });

  it("is counted once however many interim results repeat it", () => {
    const s = new CueSession({ tapOn: "every", customFillers: ["right"] });
    const words = simulateWords("that works right and then we go");
    for (let pass = 0; pass < 3; pass++) for (let k = 1; k <= words.length; k++) s.ingest(words.slice(0, k), false);
    expect(s.history.filter((d) => d.event.type === "filler_custom")).toHaveLength(1);
  });

  it("stays silent for words that aren't on the list, and when the category is off", () => {
    expect(run("so we shipped it", [])).toEqual([]);
    const off = run("so we shipped it", ["so"], {
      categories: { ...new CueSession().config.categories, custom: false },
    });
    expect(off.map((d) => d.withheldReason)).toEqual(["category_off"]);
  });

  it("taps as a pattern alongside other fillers", () => {
    const s = new CueSession({ customFillers: ["basically"] });
    const words = simulateWords("um it was basically um fine");
    for (let k = 1; k <= words.length; k++) s.ingest(words.slice(0, k), false);
    s.ingest(words, true);
    s.endUtterance();
    const tap = s.history.find((d) => d.delivered);
    expect(tap?.tapReason).toBe("filler_cluster");
  });
});

describe("suggestFillers", () => {
  const talk = simulateWords(
    "So basically we rebuilt it. You know, the old one was slow, and basically nobody liked it. " +
      "You know how it goes. We basically started over, you know, and it was basically fine. So that is it.",
  );

  it("offers habit words the wearer leaned on, most frequent first", () => {
    expect(suggestFillers(talk, [], 45)).toEqual([
      { phrase: "basically", count: 4 },
      { phrase: "you know", count: 3 },
    ]);
  });

  it("skips words already on the list, rare ones, and very short sessions", () => {
    expect(suggestFillers(talk, ["basically"], 45).map((f) => f.phrase)).toEqual(["you know"]);
    expect(suggestFillers(talk, [], 600)).toEqual([]);
    expect(suggestFillers(talk, [], 10)).toEqual([]);
  });
});
