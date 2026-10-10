import { describe, expect, it } from "vitest";
import { activeSpeechFrames, kWeighting, median, pcmDbfs, SpeechLevelMeter } from "../loudness";
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

describe("volume feedback switch", () => {
  it("gives no too-quiet cues in a mode where volume feedback is off", () => {
    const { session } = talk(40, (t) => (t < 22 ? -20 : -30), {
      volumeCues: { conversation: false, presentation: true },
    });
    const cues = quietCues(session);
    expect(cues.filter((d) => d.delivered)).toEqual([]);
    expect(cues.map((d) => d.withheldReason)).toEqual(["category_off"]);
  });
});

describe("K-weighted level", () => {
  const tone = (hz: number, amp: number, rate = 16000, seconds = 1) =>
    Int16Array.from({ length: rate * seconds }, (_, k) => amp * Math.sin((2 * Math.PI * hz * k) / rate));
  /** Level once the filter has settled: the last of 20 chunks of 50 ms. */
  const settled = (pcm: Int16Array) => {
    const m = new SpeechLevelMeter();
    let db = -100;
    for (let k = 0; k + 800 <= pcm.length; k += 800) db = m.level(pcm.subarray(k, k + 800));
    return db;
  };

  it("matches the BS.1770 reference coefficients at 48 kHz", () => {
    const { shelf, highpass } = kWeighting(48000);
    expect(shelf.b0).toBeCloseTo(1.53512485958697, 6);
    expect(shelf.b1).toBeCloseTo(-2.69169618940638, 6);
    expect(shelf.b2).toBeCloseTo(1.19839281085285, 6);
    expect(shelf.a1).toBeCloseTo(-1.69065929318241, 6);
    expect(shelf.a2).toBeCloseTo(0.73248077421585, 6);
    expect(highpass.a1).toBeCloseTo(-1.99004745483398, 6);
    expect(highpass.a2).toBeCloseTo(0.99007225036621, 6);
  });

  it("reads mid-range speech frequencies about as plain RMS does", () => {
    const pcm = tone(500, 3000);
    expect(settled(pcm) - pcmDbfs(pcm)).toBeGreaterThan(-0.5);
    expect(settled(pcm) - pcmDbfs(pcm)).toBeLessThan(1);
  });

  it("drops low rumble and lifts the range that carries clarity", () => {
    const rumble = tone(20, 3000);
    expect(pcmDbfs(rumble) - settled(rumble)).toBeGreaterThan(8);
    expect(settled(tone(3000, 3000)) - settled(tone(300, 3000))).toBeGreaterThan(2);
  });

  it("returns the floor for silence", () => {
    expect(new SpeechLevelMeter().level(new Int16Array(800))).toBe(-100);
  });
});

describe("active speech level", () => {
  // Slow speech, so each word's span covers many level frames.
  const words = simulateWords(SENTENCE, { wpm: 40 });
  const end = words.at(-1)!.end;
  // The transcript's span for each word is generous: only the first 45% is voice, rising from
  // −26 to −14 dB; the rest is silence at −45 dB.
  const share = (t: number) => {
    const w = words.find((x) => t >= x.start && t <= x.end);
    return w ? (t - w.start) / (w.end - w.start) / 0.45 : 2;
  };
  const levels: { t: number; db: number }[] = [];
  const voice: { t: number; active: boolean }[] = [];
  for (let t = 0.025; t <= end; t += 0.05) levels.push({ t, db: share(t) <= 1 ? -26 + 12 * share(t) : -45 });
  for (let t = 0.016; t <= end; t += 0.032) voice.push({ t, active: share(t) <= 1 });
  const level = (v: typeof voice) => median(activeSpeechFrames(levels, words, v, 0, end).map((f) => f.db));

  it("measures only while a voice is heard, so silence inside a word's span doesn't drag the level down", () => {
    expect(level([])).toBe(-45);
    expect(Math.abs(level(voice) + 20)).toBeLessThan(1.5);
  });

  it("trusts the words when the detector hears almost nothing, so very quiet speech is still measured", () => {
    const deaf = voice.map((f, k) => ({ ...f, active: k % 20 === 0 }));
    expect(level(deaf)).toBe(-45);
  });

  it("counts frames the detector has no opinion about", () => {
    const early = voice.filter((f) => f.t < end / 3);
    expect(activeSpeechFrames(levels, words, early, end / 2, end)).toHaveLength(
      activeSpeechFrames(levels, words, [], end / 2, end).length,
    );
  });
});
