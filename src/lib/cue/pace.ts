import { countSyllables } from "./syllables";
import type { Word } from "./types";

/** Pauses longer than this are excluded from speaking time, seconds. */
const LONG_PAUSE = 0.6;
const MIN_WORDS = 6;
const MIN_SPAN = 2.5;

export interface Pace {
  /** Syllables per second of speaking time. */
  sps: number;
  /** Words per minute of speaking time. */
  wpm: number;
}

/**
 * Speaking rate over the trailing `windowSec` of speech, ending at the last word.
 * Long pauses are subtracted so a breath doesn't hide rushing in between.
 * Returns null until there's enough speech to measure.
 */
export function measurePace(words: Word[], windowSec: number): Pace | null {
  if (words.length < MIN_WORDS) return null;
  const last = words[words.length - 1];
  let first = words.length - 1;
  while (first > 0 && words[first - 1].start >= last.end - windowSec) first--;
  const slice = words.slice(first);
  if (slice.length < MIN_WORDS) return null;

  let speaking = last.end - slice[0].start;
  for (let k = 1; k < slice.length; k++) {
    const gap = slice[k].start - slice[k - 1].end;
    if (gap > LONG_PAUSE) speaking -= gap;
  }
  if (speaking < MIN_SPAN) return null;
  const syllables = slice.reduce((n, w) => n + countSyllables(w.text), 0);
  return { sps: syllables / speaking, wpm: (slice.length / speaking) * 60 };
}
