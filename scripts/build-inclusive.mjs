// Builds src/lib/cue/inclusiveTerms.json from retext-equality's English patterns (MIT,
// https://github.com/retextjs/retext-equality), the list behind the `alex` linter.
//
//   node scripts/build-inclusive.mjs
//
// That list was written for prose. Speech is different: everyday words it flags in writing
// ("just", "special", "master") would be noise in a talk, and it flags a lone "he" or "mother".
// So this keeps only terms that are worth a second look when said aloud:
//   - "basic" patterns that have a suggested alternative, minus the ambiguous everyday words below;
//   - gendered job titles from the "or" patterns ("chairman", "policemen"), not family words or pronouns.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const lib = dirname(require.resolve("retext-equality"));
const { patterns } = await import(pathToFileURL(join(lib, "patterns-en.js")).href);

/** Everyday or ambiguous in speech: flagging them would be wrong more often than right. */
const SKIP_TERMS = new Set(
  `add adhd bi binge depressed insomnia insomniac insomniacs special challenged invalid disabled mental nuts
   delirious moan moaning hang hanged tribe totem spade sane dummy primitive stone-age fellowship bugreport
   midwife motherly latino latina rehab detox master masters masterful mastermind masterpiece masterplan
   masterstroke slave slaves maiden sportsmanship sportsmanlike workmanship oneupmanship dwarf bony
   homosexual stammering stutterer gentleman gentlemen pocahontas asylum barren manic anorexic`.split(/\s+/),
);
const SKIP_PHRASES = [
  /^maiden /,
  /^master /,
  /^rehab /,
  /^detox /,
  /^panic attack$/,
  /^pull the trigger$/,
  /^long time no /,
  /^small person$/,
  /^stone age$/,
  /^gay rights$/,
  /^special rights$/,
  /^special needs$/,
  /^short bus$/,
  /^english master$/,
  /^failed attempt$/,
  /^of course$/,
];
/** Gendered titles worth flagging; stories and family words aren't. */
const GENDERED_TITLE = /(man|men|woman|women|lady|ladies|girl|boy)$/;
const NOT_A_TITLE =
  /^(woman|women|man|men|lady|ladies|girl|boy|human|own |common |super|sand|bog|boog|cave|hang|kins|country|hench|cow|delivery)/;
const EXTRA_TITLES = new Set(["stewardess", "stewardesses", "waitress", "waitresses", "hostess", "hostesses"]);

const normalize = (term) =>
  term
    .toLowerCase()
    .split(/\s+/)
    .map((w) =>
      w
        .replace(/[’‘]/g, "'")
        .replace(/[^a-z0-9'\-]/g, "")
        .replace(/^'+|'+$/g, ""),
    )
    .filter(Boolean)
    .join(" ");

const out = new Map();
for (const p of patterns) {
  if (!p.considerate || !p.inconsiderate) continue;
  const instead = Object.keys(p.considerate).slice(0, 3).join(", ");
  for (const raw of Object.keys(p.inconsiderate)) {
    if (raw.includes("*") || raw.includes(".") || raw.includes(",")) continue;
    const phrase = normalize(raw);
    if (!phrase || phrase.split(" ").length > 5) continue;
    if (SKIP_TERMS.has(phrase) || SKIP_PHRASES.some((re) => re.test(phrase))) continue;
    if (p.type === "or" && !EXTRA_TITLES.has(phrase)) {
      if (!GENDERED_TITLE.test(phrase) || NOT_A_TITLE.test(phrase) || phrase.length < 7) continue;
    }
    if (!out.has(phrase)) out.set(phrase, instead);
  }
}
const terms = [...out]
  .map(([phrase, instead]) => ({ phrase, instead }))
  .sort((a, b) => a.phrase.localeCompare(b.phrase));
writeFileSync(new URL("../src/lib/cue/inclusiveTerms.json", import.meta.url), `${JSON.stringify(terms, null, 2)}\n`);
console.log(`${terms.length} terms`);
