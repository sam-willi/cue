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
