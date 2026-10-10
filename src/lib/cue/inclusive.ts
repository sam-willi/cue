import terms from "./inclusiveTerms.json";
import type { Word } from "./types";

/**
 * Terms many audiences find dated or excluding, each with a plainer alternative, for the
 * session report. The report only suggests; these never tap live.
 *
 * Most of the list comes from retext-equality (MIT), the data behind the `alex` linter, cut
 * down to what suits speech by `scripts/build-inclusive.mjs`. The entries below are Cue's own:
 * ways of addressing a room that the prose list doesn't cover, and plainer suggestions for a
 * few very common words. They win over the generated list.
 */
const OWN_TERMS: { phrase: string; instead: string }[] = [
  { phrase: "you guys", instead: "everyone, you all, folks" },
  { phrase: "hey guys", instead: "hi everyone" },
  { phrase: "guys", instead: "everyone, folks, team" },
  { phrase: "ladies and gentlemen", instead: "everyone, colleagues, friends" },
  { phrase: "man hours", instead: "work hours, person-hours" },
  { phrase: "man-hours", instead: "work hours, person-hours" },
  { phrase: "man-made", instead: "artificial, manufactured" },
  { phrase: "master slave", instead: "primary and replica" },
  { phrase: "sanity check", instead: "quick check, confidence check" },
  { phrase: "crazy", instead: "wild, surprising, intense" },
  { phrase: "insane", instead: "wild, unbelievable, intense" },
  { phrase: "insanely", instead: "wildly, extremely" },
  { phrase: "lame", instead: "weak, boring, disappointing" },
  { phrase: "dumb", instead: "silly, not useful" },
  { phrase: "tone deaf", instead: "out of touch" },
  { phrase: "tone-deaf", instead: "out of touch" },
  { phrase: "blind spot", instead: "gap, something we missed" },
  { phrase: "falls on deaf ears", instead: "is ignored" },
  { phrase: "spirit animal", instead: "favorite, kindred spirit" },
  { phrase: "low man on the totem pole", instead: "most junior person" },
  { phrase: "the elderly", instead: "older people, older adults" },
  { phrase: "third world", instead: "low-income countries, or name the country" },
];

const own = new Set(OWN_TERMS.map((t) => t.phrase));
const TERMS = [...OWN_TERMS, ...terms.filter((t) => !own.has(t.phrase))];

const COMPILED = TERMS.map((t) => ({ ...t, tokens: t.phrase.split(" ") })).sort(
  (a, b) => b.tokens.length - a.tokens.length,
);

export interface InclusiveFlag {
  phrase: string;
  instead: string;
  /** How many times it was said. */
  count: number;
  /** A few words around the first time. */
  context: string;
}

/** Terms from the list found in what was said, most frequent first. */
export function findInclusiveFlags(words: Word[]): InclusiveFlag[] {
  const found = new Map<string, InclusiveFlag>();
  for (let i = 0; i < words.length; i++) {
    const hit = COMPILED.find(
      (t) => i + t.tokens.length <= words.length && t.tokens.every((tok, k) => words[i + k].norm === tok),
    );
    if (!hit) continue;
    const prior = found.get(hit.phrase);
    if (prior) prior.count++;
    else
      found.set(hit.phrase, {
        phrase: hit.phrase,
        instead: hit.instead,
        count: 1,
        context: words
          .slice(Math.max(0, i - 3), i + hit.tokens.length + 3)
          .map((w) => w.text)
          .join(" "),
      });
    i += hit.tokens.length - 1;
  }
  return [...found.values()].sort((a, b) => b.count - a.count);
}
