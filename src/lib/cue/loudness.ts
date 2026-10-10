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

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/**
 * The K-weighting filter from ITU-R BS.1770, the broadcast loudness standard, for any sample
 * rate: a shelf that lifts the range speech is clearest in (about +4 dB above 1.7 kHz), then a
 * high-pass that drops rumble below about 40 Hz. Formulas as in libebur128 and pyloudnorm.
 */
export function kWeighting(sampleRate: number): { shelf: Biquad; highpass: Biquad } {
  const shelf = (() => {
    const k = Math.tan((Math.PI * 1681.974450955533) / sampleRate);
    const q = 0.7071752369554196;
    const vh = 10 ** (3.999843853973347 / 20);
    const vb = vh ** 0.4996667741545416;
    const a0 = 1 + k / q + k * k;
    return {
      b0: (vh + (vb * k) / q + k * k) / a0,
      b1: (2 * (k * k - vh)) / a0,
      b2: (vh - (vb * k) / q + k * k) / a0,
      a1: (2 * (k * k - 1)) / a0,
      a2: (1 - k / q + k * k) / a0,
    };
  })();
  const highpass = (() => {
    const k = Math.tan((Math.PI * 38.13547087602444) / sampleRate);
    const q = 0.5003270373238773;
    const a0 = 1 + k / q + k * k;
    return { b0: 1, b1: -2, b2: 1, a1: (2 * (k * k - 1)) / a0, a2: (1 - k / q + k * k) / a0 };
  })();
  return { shelf, highpass };
}

/**
 * Mic level the way listeners hear it: K-weighted, so desk thumps and low rumble don't read as
 * a loud voice. Feed it every chunk in order; the filter carries over from one chunk to the next.
 * Levels are a little higher than plain RMS for speech (the shelf), so they aren't comparable
 * with levels measured before this was introduced.
 */
export class SpeechLevelMeter {
  private readonly stages: Biquad[];
  /** Per stage: the last two inputs and outputs. */
  private state: number[][];

  constructor(sampleRate = 16000) {
    const k = kWeighting(sampleRate);
    this.stages = [k.shelf, k.highpass];
    this.state = this.stages.map(() => [0, 0, 0, 0]);
  }

  /** K-weighted level of the next chunk of 16-bit PCM, in dB relative to full scale. */
  level(samples: Int16Array): number {
    if (samples.length === 0) return -100;
    let sum = 0;
    for (let n = 0; n < samples.length; n++) {
      let x = samples[n] / 32768;
      for (let s = 0; s < this.stages.length; s++) {
        const c = this.stages[s];
        const z = this.state[s];
        const y = c.b0 * x + c.b1 * z[0] + c.b2 * z[1] - c.a1 * z[2] - c.a2 * z[3];
        z[1] = z[0];
        z[0] = x;
        z[3] = z[2];
        z[2] = y;
        x = y;
      }
      sum += x * x;
    }
    return 20 * Math.log10(Math.max(Math.sqrt(sum / samples.length), 1e-5));
  }
}

/** A voice frame further than this (s) from a level frame says nothing about it. */
const VOICE_REACH = 0.05;
/** If the voice detector rejects more than this share of what the transcript calls words, trust the words. */
const MAX_REJECTED = 0.75;

/**
 * Level frames from while the wearer was actually voicing a word in [from, to]: the "active
 * speech level" idea from ITU-T P.56. A word's time span from the transcript includes small
 * silences and drifts by a few hundred ms, so frames the voice detector heard as silence are
 * dropped. With no voice frames nearby (the detector isn't running), every frame inside a word
 * counts, as before. And if the detector rejects nearly all of them, it is likely missing very quiet
 * speech, which is exactly what "too quiet" must measure, so the words win.
 */
export function activeSpeechFrames(
  frames: LevelFrame[],
  words: Word[],
  voice: { t: number; active: boolean }[],
  from: number,
  to: number,
): LevelFrame[] {
  const spans = words.filter((w) => w.end >= from && w.start <= to);
  const inWords: LevelFrame[] = [];
  let j = 0;
  for (const f of frames) {
    if (f.t < from || f.t > to) continue;
    while (j < spans.length && spans[j].end < f.t) j++;
    if (j < spans.length && spans[j].start <= f.t) inWords.push(f);
  }
  if (voice.length === 0 || inWords.length === 0) return inWords;
  const voiced: LevelFrame[] = [];
  let v = 0;
  for (const f of inWords) {
    while (v + 1 < voice.length && voice[v + 1].t <= f.t) v++;
    const next = voice[v + 1];
    const near = next && Math.abs(next.t - f.t) < Math.abs(voice[v].t - f.t) ? next : voice[v];
    if (Math.abs(near.t - f.t) > VOICE_REACH || near.active) voiced.push(f);
  }
  return voiced.length < inWords.length * (1 - MAX_REJECTED) ? inWords : voiced;
}
