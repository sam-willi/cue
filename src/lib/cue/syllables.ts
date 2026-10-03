// Fast English syllable estimate: vowel groups after stripping common silent
// endings, plus a few frequent exceptions. Good enough for a rolling pace,
// not for per-word accuracy.

const EXCEPTIONS: Record<string, number> = {
  the: 1,
  every: 3,
  everything: 4,
  everyone: 3,
  people: 2,
  really: 2,
  being: 2,
  area: 3,
  idea: 3,
  ideas: 3,
  business: 2,
  different: 3,
  interesting: 4,
  actually: 4,
  usually: 4,
  literally: 4,
  basically: 4,
  probably: 3,
  family: 3,
  evening: 2,
  maybe: 2,
  create: 2,
  quiet: 2,
  science: 2,
  video: 3,
  radio: 3,
  okay: 2,
  ok: 2,
  yeah: 1,
  wanted: 2,
  needed: 2,
  started: 2,
  decided: 3,
  ended: 2,
  have: 1,
  haven: 2,
  i: 1,
  a: 1,
};

/** Syllables in each spoken digit 0–9 ("seven" = 2). */
const DIGIT_SYLLABLES = [2, 1, 1, 1, 1, 1, 1, 2, 1, 1];
/** Silent "e" inside a suffixed word: "lately", "statement", "careful". */
const INNER_SILENT_E = /[^aeiouy]e(ly|ment|ful|ness|less)$/;

export function countSyllables(word: string): number {
  const w = word
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/[^a-z0-9']/g, "");
  if (!w) return 0;
  // Numbers: exact for single digits, ~1 per digit otherwise ("20", "100").
  if (/^\d+$/.test(w)) return w.length === 1 ? DIGIT_SYLLABLES[+w] : w.length;

  // "didn't" = did + n't (+1 after a consonant); "don't", "can't" add nothing.
  let extra = 0;
  let base = w;
  if (base.endsWith("n't")) {
    base = base.slice(0, -3);
    if (/[^aeiouy]$/.test(base)) extra = 1;
  } else {
    base = base.replace(/'(s|re|ve|ll|d|m)$/, "");
  }
  base = base.replace(/'/g, "");
  if (!base) return 1;
  if (EXCEPTIONS[base] !== undefined) return EXCEPTIONS[base] + extra;
  if (base.length <= 3) return 1 + extra;

  const stripped = base
    .replace(/([aeiouy]l)e$/, "$1") // "whole", "mile": silent e after vowel + l
    .replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "");
  const groups = stripped.match(/[aeiouy]{1,2}/g)?.length ?? 0;
  return Math.max(1, groups - (INNER_SILENT_E.test(base) ? 1 : 0)) + extra;
}
