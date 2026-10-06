import { describe, expect, it } from "vitest";
import { pcmDbfs } from "../loudness";
import { CueSession, type SessionUpdate } from "../session";
import { simulateWords } from "../simulate";

const SENTENCE = "we should probably get the whole team together and plan the launch for next week";

/**
 * Stream ~`seconds` of speech as final results, sentence by sentence, with mic level
 * frames every 50 ms. `levelAt(t)` gives the speech level; pauses sit at −60 dB.
 */
// The wearer set their conversation volume at −20 dBFS in a quiet room (decision 13).
const TARGET = { conversation: { db: -20, noiseDb: -60 } };

function talk(seconds: number, levelAt: (t: number) => number, config = {}) {
  const s = new CueSession({ cooldownSec: 0, volumeTarget: TARGET, ...config });
  let t = 0;
  let last: SessionUpdate | null = null;
  while (t < seconds) {
    const words = simulateWords(SENTENCE, { startAt: t });
    const end = words.at(-1)!.end;
    for (let f = t; f < end + 0.6; f += 0.05) {
      const speaking = words.some((w) => f >= w.start && f <= w.end);
      s.ingestLevel(f, speaking ? levelAt(f) : -60);
    }
    for (const w of words) last = s.ingest([w], true); // word-by-word, like streaming finals
    t = end + 0.6;
  }
  return { session: s, last: last! };
}

const quietCues = (s: CueSession) => s.history.filter((d) => d.event.type === "too_quiet");

describe("too-quiet detection", () => {
  it("compares against the volume set for the mode, and stays silent at it", () => {
    const { session, last } = talk(40, () => -20);
    expect(last.volume!.baselineDb).toBeCloseTo(-20, 0);
    expect(quietCues(session)).toEqual([]);
  });

  it("cues once when speech drops well below normal and stays there", () => {
    const { session } = talk(40, (t) => (t < 22 ? -20 : -30));
    const cues = quietCues(session);
    expect(cues).toHaveLength(1);
    expect(cues[0].delivered).toBe(true);
    expect(cues[0].event.reason).toMatch(/10 dB below the volume you set/);
    // Not before the drop, and only after it's been sustained.
    expect(cues[0].event.start).toBeGreaterThanOrEqual(22);
  });

  it("ignores a small dip that stays within the allowed drop", () => {
    const { session } = talk(40, (t) => (t < 22 ? -20 : -24));
    expect(quietCues(session)).toEqual([]);
  });

  it("stays off without a volume set for this mode", () => {
    // Quiet from the start, but nothing to compare against: a session can't tell whether
    // someone's own normal is already too quiet.
    const { session, last } = talk(30, () => -35, { volumeTarget: {} });
    expect(last.volume!.baselineDb).toBeNull();
    expect(last.volume!.calibrated).toBe(false);
    expect(last.volume!.db).toBeCloseTo(-35, 0);
    expect(quietCues(session)).toEqual([]);
  });

  it("uses the target for the current mode", () => {
    // Only a conversation volume is set: in Presentation mode too-quiet stays off.
    const { session } = talk(40, (t) => (t < 22 ? -20 : -30), { mode: "presentation" });
    expect(quietCues(session)).toEqual([]);
    // With a louder presentation target, normal conversation volume reads as too quiet.
    const loud = talk(40, () => -20, {
      mode: "presentation",
      volumeTarget: { presentation: { db: -12, noiseDb: -60 } },
    });
    expect(quietCues(loud.session).filter((d) => d.delivered)).toHaveLength(1);
  });

  it("measures a read-aloud for 'Set my volume'", () => {
    const { session } = talk(8, () => -22, { volumeTarget: {} });
    const level = session.measuredLevel(4)!;
    expect(level.db).toBeCloseTo(-22, 0);
    expect(level.noiseDb).toBeCloseTo(-60, 0);
    expect(session.measuredLevel(60)).toBeNull();
  });

  it("measures only while speaking, not during pauses", () => {
    // Speech steady at −20; the −60 pauses between sentences must not count as quiet.
    const { session } = talk(60, () => -20);
    expect(quietCues(session)).toEqual([]);
  });

  it("respects the quiet category toggle", () => {
    const { session } = talk(40, (t) => (t < 22 ? -20 : -30), {
      categories: { um: true, uh: true, like: true, rushing: true, quiet: false },
    });
    expect(quietCues(session).map((d) => d.withheldReason)).toEqual(["category_off"]);
  });
});

describe("pcmDbfs", () => {
  it("measures full-scale and quiet signals", () => {
    const full = new Int16Array(800).map((_, k) => (k % 2 ? 32767 : -32768));
    expect(pcmDbfs(full)).toBeCloseTo(0, 0);
    const quiet = full.map((x) => Math.round(x / 100));
    expect(pcmDbfs(quiet)).toBeCloseTo(-40, 0);
    expect(pcmDbfs(new Int16Array(800))).toBe(-100);
  });
});
