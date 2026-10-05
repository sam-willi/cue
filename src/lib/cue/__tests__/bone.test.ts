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

  it("ignores the motor's own vibration in the bone sensor during a tap", () => {
    // Wearer: a filler cluster → tap. A friend says "yeah" right as the motor buzzes,
    // which shakes the bone sensor. Without masking, "yeah" would look like the wearer's.
    const run = (mask: boolean) => {
      const s = new CueSession({ cooldownSec: 0 });
      const mine = simulateWords("um uh um okay");
      const tapAt = mine.at(-1)!.end; // engine taps on the cluster's last filler
      for (let t = 0; t <= tapAt; t += 0.05)
        s.ingestBone(
          t,
          mine.some((w) => t >= w.start && t <= w.end),
        );
      for (const w of mine) s.ingest([w], true);
      if (!mask) (s as unknown as { hapticMasks: unknown[] }).hapticMasks.length = 0;
      const friend = simulateWords("yeah", { startAt: tapAt + 0.05 })[0];
      // Motor buzz (~0.06 s tap, then settling) reads as activity on the bone sensor.
      for (let t = tapAt + 0.05; t <= tapAt + 0.6; t += 0.05) s.ingestBone(t, t <= tapAt + 0.25);
      s.ingest([friend], true);
      expect(s.history.some((d) => d.delivered)).toBe(true);
      return s.isWearerWord(friend);
    };
    expect(run(false)).toBe(true); // the problem: the buzz makes "yeah" look like the wearer's
    expect(run(true)).toBe(false); // with masking, it's correctly someone else's
  });

  it("lets the app mask haptics it plays itself (confirmations, previews)", () => {
    const s = new CueSession();
    for (let t = 0; t <= 1; t += 0.05) s.ingestBone(t, t >= 0.5 && t <= 0.8); // only the motor
    s.hapticPlayed(0.3, 0.5);
    const w = { text: "yeah", norm: "yeah", start: 0.5, end: 0.8, confidence: 0.9 };
    expect(s.isWearerWord(w)).toBe(false);
  });
});
