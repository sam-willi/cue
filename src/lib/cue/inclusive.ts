import type { Word } from "./types";

/**
 * A short starting list of terms many audiences find dated or excluding, each with a plainer
 * alternative, for the session report. Deliberately small and explicit: every flag can be
 * explained, and the report only suggests. It never taps live.
 */
const TERMS: { phrase: string; instead: string }[] = [
  { phrase: "you guys", instead: "everyone, you all, folks" },
  { phrase: "hey guys", instead: "hi everyone" },
  { phrase: "guys", instead: "everyone, folks, team" },
  { phrase: "ladies and gentlemen", instead: "everyone, colleagues, friends" },
  { phrase: "mankind", instead: "humanity, people" },
  { phrase: "manpower", instead: "workforce, staff, people" },
  { phrase: "man hours", instead: "work hours, person-hours" },
  { phrase: "man-hours", instead: "work hours, person-hours" },
  { phrase: "manmade", instead: "artificial, manufactured" },
  { phrase: "man-made", instead: "artificial, manufactured" },
  { phrase: "chairman", instead: "chair, chairperson" },
  { phrase: "salesman", instead: "salesperson, sales rep" },
  { phrase: "salesmen", instead: "salespeople, sales reps" },
  { phrase: "businessman", instead: "businessperson" },
  { phrase: "businessmen", instead: "businesspeople" },
  { phrase: "policeman", instead: "police officer" },
  { phrase: "fireman", instead: "firefighter" },
  { phrase: "stewardess", instead: "flight attendant" },
  { phrase: "middleman", instead: "go-between, intermediary" },
  { phrase: "manned", instead: "staffed, crewed" },
  { phrase: "freshman", instead: "first-year student" },
  { phrase: "freshmen", instead: "first-year students" },
  { phrase: "blacklist", instead: "blocklist, deny list" },
  { phrase: "whitelist", instead: "allowlist" },
  { phrase: "master slave", instead: "primary and replica" },
  { phrase: "grandfathered", instead: "exempted, legacy" },
  { phrase: "sanity check", instead: "quick check, confidence check" },
  { phrase: "crazy", instead: "wild, surprising, intense" },
  { phrase: "insane", instead: "wild, unbelievable, intense" },
  { phrase: "lame", instead: "weak, boring, disappointing" },
  { phrase: "dumb", instead: "silly, not useful" },
  { phrase: "crippled", instead: "badly limited, broken" },
  { phrase: "tone deaf", instead: "out of touch" },
  { phrase: "tone-deaf", instead: "out of touch" },
  { phrase: "blind spot", instead: "gap, something we missed" },
  { phrase: "falls on deaf ears", instead: "is ignored" },
  { phrase: "spirit animal", instead: "favorite, kindred spirit" },
  { phrase: "powwow", instead: "meeting, huddle" },
  { phrase: "low man on the totem pole", instead: "most junior person" },
  { phrase: "the elderly", instead: "older people, older adults" },
  { phrase: "third world", instead: "low-income countries, or name the country" },
];

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
