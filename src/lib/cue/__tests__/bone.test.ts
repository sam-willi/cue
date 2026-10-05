import { describe, expect, it } from "vitest";
import { CueSession } from "../session";
import { simulateWords } from "../simulate";
import type { Word } from "../types";

/** Stream words with a bone-sensor frame every 50 ms: active only while `wearer(w)` words are said. */
function withBone(words: Word[], wearer: (w: Word) => boolean, config = {}) {
  const s = new CueSession({ tapOn: "every", cooldownSec: 0, ...config });
  for (let t = 0; t <= words.at(-1)!.end + 0.5; t += 0.05) {
    s.ingestBone(
      t,
      words.some((w) => wearer(w) && t >= w.start && t <= w.end),
    );
  }
  for (const w of words) s.ingest([w], true);
  s.endUtterance();
  return s;
}
const fillers = (s: CueSession) => s.history.filter((d) => d.delivered).map((d) => d.event.type);

describe("bone-conduction wearer verification", () => {
  it("coaches only words the bone sensor confirms (the mic hears everyone)", () => {
    const mine = simulateWords("so um i was thinking");
    const friend = simulateWords("um yeah i like went there too", { startAt: mine.at(-1)!.end + 0.8 });
    const later = simulateWords("and uh we left", { startAt: friend.at(-1)!.end + 0.8 });
    const s = withBone([...mine, ...friend, ...later], (w) => !friend.includes(w));
    expect(fillers(s)).toEqual(["filler_um", "filler_uh"]);
    expect(s.words.filter((w) => !s.isWearerWord(w)).map((w) => w.norm)).toEqual(friend.map((w) => w.norm));
  });

  it("treats every word as the wearer's when there's no bone signal (web prototype)", () => {
    const s = new CueSession({ tapOn: "every", cooldownSec: 0 });
    s.ingest(simulateWords("um yeah i like went there"), true);
    s.endUtterance();
    expect(fillers(s)).toEqual(["filler_um", "filler_like"]);
  });

  it("ends the wearer's speaking turn when someone else talks", () => {
    const mine = simulateWords("we should plan the launch");
    const friend = simulateWords("sounds good to me", { startAt: mine.at(-1)!.end + 0.3 });
    const again = simulateWords("great so next week", { startAt: friend.at(-1)!.end + 0.3 });
    const s = withBone([...mine, ...friend, ...again], (w) => !friend.includes(w));
    const u = s.endUtterance();
    expect(u.signals.turnSeconds).toBeLessThan(again.at(-1)!.end - again[0].start + 0.01);
  });
});
