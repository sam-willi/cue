import { describe, expect, it } from "vitest";
import { CueSession } from "../session";
import { simulateWords } from "../simulate";
import type { Word } from "../types";

/**
 * A scripted conversation: each turn is said by a speaker at a level, with mic frames
 * every 50 ms (pauses at the given room noise). `label` is the diarization label
 * Deepgram would assign, or undefined when diarization is off.
 */
interface Turn {
  text: string;
  db: number;
  label?: number;
}

function converse(
  turns: Turn[],
  opts: { noiseDb?: number; noiseAfter?: { t: number; db: number }; config?: object } = {},
) {
  const s = new CueSession({ cooldownSec: 0, calibrationSec: 6, ...opts.config });
  let t = 0;
  for (const turn of turns) {
    const words: Word[] = simulateWords(turn.text, { startAt: t }).map((w) => ({ ...w, speaker: turn.label }));
    const end = words.at(-1)!.end;
    for (let f = t; f < end + 0.7; f += 0.05) {
      const noise = opts.noiseAfter && f >= opts.noiseAfter.t ? opts.noiseAfter.db : (opts.noiseDb ?? -60);
      const speaking = words.some((w) => f >= w.start && f <= w.end);
      s.ingestLevel(f, speaking ? turn.db : noise);
    }
    for (const w of words) s.ingest([w], true);
    s.endUtterance();
    t = end + 0.7;
  }
  return s;
}

// ~7 s of the wearer talking alone, to calibrate (calibrationSec: 6 in these tests).
const SETUP = "so this is me talking on my own for a little while so cue can learn how i sound normally okay";
const types = (s: CueSession) => s.history.filter((d) => d.delivered).map((d) => d.event.type);

describe("coaching only the wearer", () => {
  it("ignores another person's fillers, using speaker labels", () => {
    const s = converse([
      { text: SETUP, db: -20, label: 0 },
      { text: "um yeah i like went there too", db: -29, label: 1 }, // friend across the table
      { text: "nice and um what did you think", db: -20, label: 0 }, // wearer
    ]);
    expect(types(s)).toEqual(["filler_um"]);
    expect(s.history[0].event.context).toContain("nice");
  });

  it("ignores a quieter voice using loudness when there are no speaker labels", () => {
    const s = converse([
      { text: SETUP, db: -20 },
      { text: "um so i like went home", db: -36 }, // far below the wearer: someone else
      { text: "um okay", db: -21 },
    ]);
    expect(types(s)).toEqual(["filler_um"]);
  });

  it("still coaches the wearer when diarization relabels their voice", () => {
    const s = converse([
      { text: SETUP, db: -20, label: 0 },
      { text: "and um i like went home after", db: -20, label: 3 }, // same voice, new label
    ]);
    expect(types(s)).toEqual(["filler_um", "filler_like"]);
  });

  it("marks other people's words in the transcript", () => {
    const s = converse([
      { text: SETUP, db: -20, label: 0 },
      { text: "hey there", db: -30, label: 1 },
    ]);
    const words = s.annotatedWords();
    expect(words.filter((w) => !w.wearer).map((w) => w.text)).toEqual(["hey", "there"]);
  });

  it("coaches everyone when 'only my voice' is off", () => {
    const s = converse(
      [
        { text: SETUP, db: -20, label: 0 },
        { text: "um yeah", db: -30, label: 1 },
      ],
      { config: { onlyWearer: false } },
    );
    expect(types(s)).toEqual(["filler_um"]);
  });
});

describe("noise-aware 'too quiet'", () => {
  const long = (db: number) => ({
    text: "and then we kept talking about the plan for the launch and what we would change next time around",
    db,
    label: 0,
  });

  it("doesn't call naturally softer speech in a quieter room 'too quiet'", () => {
    // Calibrated in a café (noise −40, speaking at −18); later a quiet room (noise −60),
    // speaking naturally softer at −26. 8 dB under normal, but the room got 20 dB quieter.
    const s = converse([{ text: SETUP, db: -18, label: 0 }, long(-26), long(-26), long(-26)], {
      noiseDb: -40,
      noiseAfter: { t: 8, db: -60 },
    });
    expect(types(s)).not.toContain("too_quiet");
  });

  it("does flag normal-level speech that's too quiet for a much noisier room", () => {
    // Calibrated in a quiet room; then a loud bar (noise +25 dB) while still speaking at normal.
    const s = converse([{ text: SETUP, db: -22, label: 0 }, long(-22), long(-22), long(-22)], {
      noiseDb: -60,
      noiseAfter: { t: 8, db: -35 },
    });
    const quiet = s.history.find((d) => d.event.type === "too_quiet");
    expect(quiet?.delivered).toBe(true);
    expect(quiet?.event.reason).toMatch(/noisy room/);
  });

  it("still flags genuinely quieter speech when the room hasn't changed", () => {
    const s = converse([{ text: SETUP, db: -20, label: 0 }, long(-31), long(-31), long(-31)], { noiseDb: -55 });
    expect(types(s)).toContain("too_quiet");
  });
});
