import { normalize } from "./lexicon";
import type { Word } from "./types";

/**
 * Turn typed text into timed words, as if spoken at `wpm`. Commas and ellipses
 * add a short pause; sentence ends add a longer one. Used by tests and the
 * "type a sentence" mode in the app.
 */
export function simulateWords(text: string, opts: { wpm?: number; startAt?: number } = {}): Word[] {
  const wpm = opts.wpm ?? 150;
  const perWord = 60 / wpm;
  let t = opts.startAt ?? 0;
  const out: Word[] = [];
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    const norm = normalize(raw);
    if (!norm) continue;
    const dur = perWord * 0.8;
    out.push({ text: raw, norm, start: t, end: t + dur, confidence: 0.95 });
    t += perWord;
    if (/[,…]$|\.\.\.$/.test(raw)) t += 0.35;
    else if (/[.?!]$/.test(raw)) t += 0.8;
  }
  return out;
}
