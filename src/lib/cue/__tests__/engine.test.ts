import { describe, expect, it } from "vitest";
import { CueSession } from "../session";
import { simulateWords } from "../simulate";
import type { Word } from "../types";

/** Stream sentences word by word (final results), one after another with a pause between. */
function speak(s: CueSession, sentences: string[], opts: { wpm?: number; gap?: number; startAt?: number } = {}) {
  let t = opts.startAt ?? 0;
  const all: Word[] = [];
  for (const text of sentences) {
    const words = simulateWords(text, { wpm: opts.wpm, startAt: t });
    for (const w of words) s.ingest([w], true);
    all.push(...words);
    t = words.at(-1)!.end + (opts.gap ?? 1);
  }
  s.endUtterance();
  return { end: t, words: all };
}
const taps = (s: CueSession) => s.history.filter((d) => d.delivered).map((d) => d.tapReason);
const CLEAN = "we talked about the plan for the launch and what to change next time";

describe("decision engine (SOFTWARE.md §7, §12–14)", () => {
  it("doesn't tap for a single filler in otherwise clean speech", () => {
    const s = new CueSession();
    speak(s, [CLEAN, "um so that was the idea", CLEAN]);
    expect(taps(s)).toEqual([]);
    expect(s.history.find((d) => d.event.type === "filler_um")?.withheldReason).toBe("not_a_pattern");
  });

  it("taps once for a cluster, not once per filler (the §25 interview example)", () => {
    const s = new CueSession();
    speak(s, ["So, um, I was like working on this project and, um, it was hard."]);
    expect(taps(s)).toEqual(["filler_cluster"]);
    expect(s.history.find((d) => d.delivered)?.trigger).toMatch(/^3 in \d+ s$/);
  });

  it("doesn't reuse the same fillers for a second tap, and respects the cooldown", () => {
    const s = new CueSession();
    // Two clusters 5 s apart: the second is inside the 15 s cooldown.
    speak(s, ["um uh um okay", "um uh um right"], { gap: 2 });
    expect(taps(s)).toEqual(["filler_cluster"]);
    expect(s.history.filter((d) => d.withheldReason === "cooldown").length).toBeGreaterThan(0);
  });

  it("taps for a high filler rate even when fillers never cluster", () => {
    const s = new CueSession({ densityPerMin: 4 });
    // One filler every ~6 s: never 3 within 12 s, but 4 within a minute.
    speak(
      s,
      Array.from({ length: 5 }, () => "um we should keep going with the plan"),
      { gap: 3 },
    );
    expect(taps(s)).toContain("filler_density");
  });

  it("checks whether a tap worked: no more fillers afterwards", () => {
    const s = new CueSession();
    const { end } = speak(s, ["um uh um okay"]);
    speak(s, [CLEAN, CLEAN], { startAt: end });
    const tap = s.history.find((d) => d.delivered)!;
    expect(s.engineTaps().find((t) => t.id === tap.event.id)?.outcome).toBe("worked");
  });

  it("…or didn't: the fillers kept coming", () => {
    const s = new CueSession();
    const { end } = speak(s, ["um uh um okay"]);
    speak(s, ["and um so uh yeah"], { startAt: end });
    speak(s, [CLEAN], { startAt: end + 9 });
    const tap = s.history.find((d) => d.delivered)!;
    expect(s.engineTaps().find((t) => t.id === tap.event.id)?.outcome).toBe("no_change");
  });

  it("counts accidental repetition as a disfluency, not emphasis", () => {
    const s = new CueSession({ tapOn: "every" });
    speak(s, ["I I I think we should go", "it is very very important", "and then and then we left"]);
    expect(s.history.filter((d) => d.event.type === "repetition").map((d) => d.event.reason)).toEqual([
      '"i" said 3 times in a row',
      '"and then" repeated',
    ]);
  });

  it("taps after a long stretch without a pause, and sees when the user pauses", () => {
    const s = new CueSession();
    const long = Array.from({ length: 7 }, () => CLEAN).join(" "); // ~38 s with no pause
    const { end } = speak(s, [long]);
    expect(taps(s)).toEqual(["no_pause"]);
    speak(s, [CLEAN], { startAt: end + 1.5 }); // paused, then carried on
    expect(s.engineTaps()[0].outcome).toBe("worked");
  });

  it("taps for a very long speaking turn", () => {
    const s = new CueSession({ categories: { ...new CueSession().config.categories, pauses: false } });
    // ~100 s of the wearer talking, short breaths (< 2.5 s) between sentences.
    speak(
      s,
      Array.from({ length: 22 }, () => CLEAN),
      { gap: 1 },
    );
    expect(taps(s)).toContain("long_turn");
  });

  it("judges pace against the wearer's own normal, not a universal one", () => {
    const fast = Array.from({ length: 30 }, () => CLEAN);
    // A naturally fast talker at ~4.6 syllables/s: over the fixed 4.5 default, but their normal.
    const s = new CueSession({ categories: { ...new CueSession().config.categories, pauses: false } });
    const { end } = speak(s, fast.slice(0, 16), { wpm: 230, gap: 0.7 });
    const before = taps(s).filter((r) => r === "rushing").length;
    speak(s, fast.slice(16), { wpm: 230, gap: 0.7, startAt: end });
    // Once their normal is learned (~60 s), the same pace is no longer "rushing"…
    expect(taps(s).filter((r) => r === "rushing").length).toBe(before);
    // …but speeding up well past it is.
    const s2 = new CueSession({ categories: { ...new CueSession().config.categories, pauses: false } });
    const r = speak(s2, fast.slice(0, 16), { wpm: 180, gap: 0.7 });
    speak(s2, fast.slice(16), { wpm: 260, gap: 0.7, startAt: r.end });
    expect(taps(s2)).toContain("rushing");
  });
});
