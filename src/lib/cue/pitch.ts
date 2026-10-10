/**
 * Voice pitch from short chunks of microphone audio, for the session report's "pitch and tone"
 * section. Autocorrelation over the range of adult speaking voices; returns null for silence,
 * breath and consonant noise, which have no clear pitch.
 */

const MIN_HZ = 75;
const MAX_HZ = 400;
/** Quieter than this (RMS, full scale = 1) is treated as silence. */
const MIN_RMS = 0.005;
/** How periodic a chunk must be (0–1) to count as voiced. */
const MIN_CLARITY = 0.55;
/** Prefer the shortest period nearly as strong as the best, to avoid reporting an octave too low. */
const OCTAVE_GUARD = 0.9;

/** Fundamental frequency (Hz) of a chunk of 16-bit PCM, or null if it isn't voiced speech. */
export function pitchHz(pcm: Int16Array, sampleRate = 16000): number | null {
  const minLag = Math.floor(sampleRate / MAX_HZ);
  const maxLag = Math.ceil(sampleRate / MIN_HZ);
  const n = pcm.length - maxLag;
  if (n < maxLag) return null;

  let mean = 0;
  for (let k = 0; k < pcm.length; k++) mean += pcm[k];
  mean /= pcm.length;
  const x = new Float32Array(pcm.length);
  let energy = 0;
  for (let k = 0; k < pcm.length; k++) {
    x[k] = (pcm[k] - mean) / 32768;
    energy += x[k] * x[k];
  }
  if (Math.sqrt(energy / pcm.length) < MIN_RMS) return null;

  let e0 = 0;
  for (let k = 0; k < n; k++) e0 += x[k] * x[k];
  // Normalized correlation of the chunk with itself shifted by each candidate period.
  const corr = new Float32Array(maxLag + 2);
  let best = 0;
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let cross = 0;
    let eLag = 0;
    for (let k = 0; k < n; k++) {
      cross += x[k] * x[k + lag];
      eLag += x[k + lag] * x[k + lag];
    }
    corr[lag] = cross / Math.sqrt(e0 * eLag + 1e-12);
    if (lag >= minLag && lag <= maxLag && corr[lag] > best) best = corr[lag];
  }
  if (best < MIN_CLARITY) return null;

  for (let lag = minLag; lag <= maxLag; lag++) {
    const c = corr[lag];
    if (c < best * OCTAVE_GUARD || c < corr[lag - 1] || c < corr[lag + 1]) continue;
    // Refine between samples with a parabola through the peak and its neighbors.
    const denom = corr[lag - 1] - 2 * c + corr[lag + 1];
    const shift = denom === 0 ? 0 : (0.5 * (corr[lag - 1] - corr[lag + 1])) / denom;
    return sampleRate / (lag + shift);
  }
  return null;
}

/** Hz to semitones relative to `refHz`. Pitch is heard in ratios, so variation is measured this way. */
export const semitones = (hz: number, refHz: number) => 12 * Math.log2(hz / refHz);
