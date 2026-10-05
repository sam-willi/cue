import { BE_FORMS, DETERMINERS, SUBJECT_PRONOUNS } from "./lexicon";
import { NEED_MORE } from "./likeClassifier";
import { tagWords } from "./tagger";
import type { Word } from "./types";

/**
 * "lowkey" as a hedge is a filler ("I lowkey want to go", "it's lowkey good",
 * "Lowkey, I'm tired"); as an adjective meaning relaxed it isn't ("a low-key party",
 * "keep it low-key"). Speech engines write it as "lowkey", "low-key" or "low key".
 */

/** If a lowkey token starts at `i`, how many words it spans (1, or 2 for "low key"); else 0. */
export function lowkeySpan(words: Word[], i: number): 0 | 1 | 2 {
  const n = words[i]?.norm;
  if (n === "lowkey" || n === "low-key") return 1;
  if (n === "low" && words[i + 1]?.norm === "key") return 2;
  return 0;
}

const ADJ_PREV = new Set([
  ...DETERMINERS,
  "very",
  "pretty",
  "so",
  "more",
  "most",
  "quite",
  "fairly",
  "super",
  "really",
]);
const KEEP = new Set(["keep", "keeps", "keeping", "kept", "stay", "stays", "stayed", "staying"]);

export interface LowkeyVerdict {
  filler: boolean;
  confidence: number;
  reason: string;
}

export function classifyLowkey(
  words: Word[],
  i: number,
  span: 1 | 2,
  opts: { rightClosed: boolean },
): LowkeyVerdict | typeof NEED_MORE {
  const prev = words[i - 1]?.norm;
  const p2 = words[i - 2]?.norm;
  const tok = words[i + span - 1];
  const nextW = words[i + span];
  const next = nextW?.norm;
  const startOfPhrase = !words[i - 1] || /[.?!]$/.test(words[i - 1].text) || words[i].start - words[i - 1].end > 0.7;
  const commaAfter = /[,…]$/.test(tok.text);

  // Adjective uses: "a low-key party", "pretty low-key", "keep it low-key".
  if (prev && ADJ_PREV.has(prev))
    return { filler: false, confidence: 0.85, reason: `"${prev} lowkey" — an adjective (relaxed)` };
  if ((prev && KEEP.has(prev)) || (prev === "it" && p2 && KEEP.has(p2)))
    return { filler: false, confidence: 0.85, reason: `"keep it lowkey" — means keep it relaxed` };

  if (startOfPhrase && commaAfter)
    return { filler: true, confidence: 0.9, reason: `"Lowkey," opening a sentence — a hedge` };
  if (!nextW) {
    if (!opts.rightClosed) return NEED_MORE;
    return { filler: false, confidence: 0.6, reason: `"lowkey" ends the phrase — probably "relaxed"` };
  }

  const tags = tagWords(words.slice(i + span, i + span + 1).map((w) => w.norm))[0];
  if (tags?.noun && !tags.adjective && !tags.presentVerb && !tags.pastVerb && !(next && SUBJECT_PRONOUNS.has(next)))
    return { filler: false, confidence: 0.75, reason: `"lowkey ${next}" — an adjective describing "${next}"` };
  if (
    (next && (SUBJECT_PRONOUNS.has(next) || BE_FORMS.has(next))) ||
    tags?.presentVerb ||
    tags?.pastVerb ||
    tags?.adverb ||
    tags?.adjective ||
    tags?.gerund
  )
    return { filler: true, confidence: 0.85, reason: `"lowkey ${next}" — a hedge before what you mean` };
  if (startOfPhrase) return { filler: true, confidence: 0.8, reason: `"Lowkey" opening a sentence — a hedge` };
  return { filler: false, confidence: 0.5, reason: `"lowkey ${next}" — not sure, so no cue` };
}
