import { PitchDetector } from "pitchy";

/**
 * Voice pitch from short chunks of microphone audio, for the session report's "pitch and tone"
 * section. Uses pitchy's McLeod pitch method (0BSD), limited to the range of adult speaking
 * voices; returns null for silence, breath and consonant noise, which have no clear pitch.
 */

const MIN_HZ = 75;
const MAX_HZ = 400;
/** Quieter than this (RMS, full scale = 1) is treated as silence. */
const MIN_RMS = 0.005;
/** How periodic a chunk must be (0–1) to count as voiced. */
const MIN_CLARITY = 0.8;

const detectors = new Map<number, PitchDetector<Float32Array>>();
function detectorFor(length: number) {
  let d = detectors.get(length);
  if (!d) {
    d = PitchDetector.forFloat32Array(length);
    detectors.set(length, d);
  }
  return d;
}

/** Fundamental frequency (Hz) of a chunk of 16-bit PCM, or null if it isn't voiced speech. */
export function pitchHz(pcm: Int16Array, sampleRate = 16000): number | null {
  // Two periods of the lowest voice are needed to find its pitch.
  if (pcm.length < (2 * sampleRate) / MIN_HZ) return null;
  const x = new Float32Array(pcm.length);
  let energy = 0;
  for (let k = 0; k < pcm.length; k++) {
    x[k] = pcm[k] / 32768;
    energy += x[k] * x[k];
  }
  if (Math.sqrt(energy / pcm.length) < MIN_RMS) return null;
  const [hz, clarity] = detectorFor(pcm.length).findPitch(x, sampleRate);
  if (clarity < MIN_CLARITY || hz < MIN_HZ || hz > MAX_HZ) return null;
  return hz;
}

/**
 * Hz to semitones relative to `refHz`. Pitch is heard in ratios, so variation is measured this
 * way. The report's spread in semitones is close to Hincks's "pitch variation quotient" (standard
 * deviation over mean, 2005), the measure that tracked how lively judges found presentations:
 * 2 semitones is a quotient of about 0.12.
 */
export const semitones = (hz: number, refHz: number) => 12 * Math.log2(hz / refHz);
