import { normalize, UH_FORMS, UM_FORMS } from "./lexicon";
import type { Word } from "./types";

/** Longest phrase a wearer can add, in words. */
export const MAX_PHRASE_WORDS = 4;
export const MAX_CUSTOM_FILLERS = 20;

/** Words Cue already handles, with context rules a plain list can't match. */
const BUILT_IN = new Set([...UM_FORMS, ...UH_FORMS, "like", "lowkey", "low-key"]);

/**
 * Clean up what the wearer typed into a phrase Cue can match: lowercase words separated by
 * single spaces. Returns null with a reason if it can't be used.
 */
export function parseCustomFiller(text: string): { phrase: string } | { error: string } {
  const tokens = text.split(/\s+/).map(normalize).filter(Boolean);
  if (tokens.length === 0) return { error: "Type a word or short phrase." };
  if (tokens.length > MAX_PHRASE_WORDS) return { error: `Keep it to ${MAX_PHRASE_WORDS} words or fewer.` };
  const phrase = tokens.join(" ");
  if (tokens.length === 1 && BUILT_IN.has(phrase)) return { error: `Cue already listens for “${phrase}”.` };
  return { phrase };
}

/**
 * Words and phrases that are often a habit. None of them is always a filler, so Cue doesn't
 * count them by default; the report offers the ones a wearer leaned on as additions to their own
 * list. `perMin` is how often one must come up before it's worth offering: higher for words that
 * also do ordinary work in a sentence.
 */
const HABIT_WORDS: { phrase: string; perMin: number }[] = [
  ...["you know", "i mean", "kind of", "sort of", "or something", "and stuff", "to be honest"].map((phrase) => ({
    phrase,
    perMin: 1.5,
  })),
  ...["basically", "actually", "literally", "honestly", "obviously", "essentially", "totally", "definitely"].map(
    (phrase) => ({ phrase, perMin: 1.5 }),
  ),
  ...["anyway", "seriously", "whatever", "okay", "right"].map((phrase) => ({ phrase, perMin: 2.5 })),
  ...["so", "well", "just", "really"].map((phrase) => ({ phrase, perMin: 4 })),
];
const MIN_HABIT_COUNT = 3;

/**
 * Habit words the wearer said often enough to be worth adding to their list, most frequent
 * first. `talkSec` is how long they talked.
 */
export function suggestFillers(
  words: Word[],
  existing: string[],
  talkSec: number,
): { phrase: string; count: number }[] {
  if (talkSec < 30) return [];
  const have = new Set(existing);
  const out: { phrase: string; count: number }[] = [];
  for (const { phrase, perMin } of HABIT_WORDS) {
    if (have.has(phrase)) continue;
    const tokens = phrase.split(" ");
    let count = 0;
    for (let i = 0; i + tokens.length <= words.length; i++)
      if (tokens.every((t, k) => words[i + k].norm === t)) count++;
    if (count >= MIN_HABIT_COUNT && count / (talkSec / 60) >= perMin) out.push({ phrase, count });
  }
  return out.sort((a, b) => b.count - a.count).slice(0, 4);
}

/** Phrases split into words, longest first, so "you know what" wins over "you know". */
export function compileCustomFillers(phrases: string[]): string[][] {
  return phrases
    .map((p) => p.split(" ").filter(Boolean))
    .filter((p) => p.length > 0)
    .sort((a, b) => b.length - a.length);
}

/** How many words of `words`, starting at `i`, make up one of the wearer's phrases (0 if none). */
export function matchCustomFiller(words: Word[], i: number, compiled: string[][]): number {
  for (const tokens of compiled) {
    if (i + tokens.length > words.length) continue;
    if (tokens.every((t, k) => words[i + k].norm === t)) return tokens.length;
  }
  return 0;
}
