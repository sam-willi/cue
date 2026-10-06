import { describe, expect, it } from "vitest";
import { CueSession } from "../session";
import { simulateWords } from "../simulate";
import type { Word } from "../types";

/**
 * Scripted speech: each turn at a level, with mic frames every 50 ms (pauses at the
 * given room noise).
 */
interface Turn {
  text: string;
  db: number;
}

function converse(
  turns: Turn[],
  opts: { noiseDb?: number; noiseAfter?: { t: number; db: number }; config?: object } = {},
) {
  // The first turn is the wearer setting their volume, in the room as it was then (decision 13).
  const volumeTarget = { conversation: { db: turns[0].db, noiseDb: opts.noiseDb ?? -60 } };
  const s = new CueSession({ tapOn: "every", cooldownSec: 0, volumeTarget, ...opts.config });
  let t = 0;
  for (const turn of turns) {
    const words: Word[] = simulateWords(turn.text, { startAt: t });
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

// ~7 s of the wearer talking alone at the volume they set.
const SETUP = "so this is me talking on my own for a little while so cue can learn how i sound normally okay";
const types = (s: CueSession) => s.history.filter((d) => d.delivered).map((d) => d.event.type);

describe("noise-aware 'too quiet'", () => {
  const long = (db: number) => ({
    text: "and then we kept talking about the plan for the launch and what we would change next time around",
    db,
    label: 0,
  });

  it("doesn't call naturally softer speech in a quieter room 'too quiet'", () => {
    // Calibrated in a café (noise −40, speaking at −18); later a quiet room (noise −60),
    // speaking naturally softer at −26. 8 dB under normal, but the room got 20 dB quieter.
    const s = converse([{ text: SETUP, db: -18 }, long(-26), long(-26), long(-26)], {
      noiseDb: -40,
      noiseAfter: { t: 8, db: -60 },
    });
    expect(types(s)).not.toContain("too_quiet");
  });

  it("does flag normal-level speech that's too quiet for a much noisier room", () => {
    // Calibrated in a quiet room; then a loud bar (noise +25 dB) while still speaking at normal.
    const s = converse([{ text: SETUP, db: -22 }, long(-22), long(-22), long(-22)], {
      noiseDb: -60,
      noiseAfter: { t: 8, db: -35 },
    });
    const quiet = s.history.find((d) => d.event.type === "too_quiet");
    expect(quiet?.delivered).toBe(true);
    expect(quiet?.event.reason).toMatch(/noisy room/);
  });

  it("still flags genuinely quieter speech when the room hasn't changed", () => {
    const s = converse([{ text: SETUP, db: -20 }, long(-31), long(-31), long(-31)], { noiseDb: -55 });
    expect(types(s)).toContain("too_quiet");
  });
});
