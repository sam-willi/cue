import type { Word } from "./types";

/** One loudness measurement: engine-clock time (s) and level in dBFS. */
export interface LevelFrame {
  t: number;
  db: number;
}

/** Duration of one level frame (50 ms audio chunks), seconds. */
export const FRAME_SEC = 0.05;

/** RMS level of 16-bit PCM in dBFS (0 = full scale; speech is typically −35 to −15). */
export function pcmDbfs(samples: Int16Array): number {
  if (samples.length === 0) return -100;
  let sum = 0;
  for (let k = 0; k < samples.length; k++) sum += samples[k] * samples[k];
  const rms = Math.sqrt(sum / samples.length) / 32768;
  return 20 * Math.log10(Math.max(rms, 1e-5));
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Levels measured while the wearer was actually saying a word in [from, to].
 * Gating on recognized words keeps pauses and room noise out of the measurement.
 */
/**
 * Background noise floor over [from, to]: the 10th percentile of all frames. The
 * quietest moments (between words, breaths) are the room; this works without needing
 * long silences, which normal speech rarely has. Null if under 1 s of audio.
 */
export function noiseFloor(frames: LevelFrame[], from: number, to: number): number | null {
  const xs = frames.filter((f) => f.t >= from && f.t <= to).map((f) => f.db);
  if (xs.length * FRAME_SEC < 1) return null;
  xs.sort((a, b) => a - b);
  return xs[Math.floor(xs.length * 0.1)];
}

export function speechLevels(frames: LevelFrame[], words: Word[], from: number, to: number): number[] {
  const spans = words.filter((w) => w.end >= from && w.start <= to);
  const out: number[] = [];
  let j = 0;
  for (const f of frames) {
    if (f.t < from || f.t > to) continue;
    while (j < spans.length && spans[j].end < f.t) j++;
    if (j < spans.length && spans[j].start <= f.t) out.push(f.db);
  }
  return out;
}
