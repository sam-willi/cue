import {
  BE_FORMS,
  COMPARISON_PREV,
  DETERMINERS,
  DISCOURSE_PREV,
  INTENSIFIERS,
  NOMINATIVE_ONLY,
  NUMBER_WORDS,
  OBJECT_PRONOUNS,
  PRE_VERB_ADVERBS,
  SPEECH_VERBS,
  SUBJECT_PRONOUNS,
  UH_FORMS,
  UM_FORMS,
  VERB_PREV,
} from "./lexicon";
import { tagWords, type WordTags } from "./tagger";
import type { LikeUse, LikeVerdict, Word } from "./types";

/** Returned when the word(s) after "like" haven't been heard yet. */
export const NEED_MORE = "need_more" as const;

/** Pause (s) that counts as a prosodic break around "like". */
const BREAK_GAP = 0.3;
/** Pause (s) before a word that starts a new utterance. */
const UTTERANCE_GAP = 0.7;

const QUOTE_OPENERS = new Set([
  "oh",
  "what",
  "no",
  "yeah",
  "yes",
  "okay",
  "ok",
  "wow",
  "omg",
  "dude",
  "bro",
  "hey",
  "wait",
  "um",
  "uh",
  "hmm",
  "nah",
  "girl",
  "bruh",
]);
const SCALE_WORDS = new Set([
  "hundred",
  "thousand",
  "million",
  "billion",
  "few",
  "couple",
  "dozen",
  "bunch",
  "lot",
  "minute",
  "second",
  "week",
  "month",
  "year",
  "day",
  "half",
]);
const TO_VERB_PREV = new Set([
  "want",
  "wanna",
  "wants",
  "wanted",
  "try",
  "trying",
  "tried",
  "hard",
  "easy",
  "learn",
  "learning",
  "need",
  "needs",
  "used",
  "start",
  "started",
  "begin",
  "going",
  "gonna",
  "have",
  "has",
  "had",
  "got",
  "able",
]);

const isHesitation = (n: string) => UM_FORMS.has(n) || UH_FORMS.has(n);
const isNumber = (n: string | undefined, tags?: WordTags) =>
  !!n && (/^\d/.test(n) || NUMBER_WORDS.has(n) || !!tags?.value);

function verdict(use: LikeUse, confidence: number, reason: string): LikeVerdict {
  return { use, confidence, reason };
}

/**
 * Decide how the "like" at `words[i]` is being used, from the words around it,
 * their parts of speech, punctuation, and pauses.
 *
 * Returns NEED_MORE when the decision depends on words not yet heard and the
 * utterance hasn't ended (`rightClosed` false).
 */
export function classifyLike(words: Word[], i: number, opts: { rightClosed: boolean }): LikeVerdict | typeof NEED_MORE {
  const w = words[i];
  // The word before "like", skipping hesitations ("I um like tofu").
  let pi = i - 1;
  while (pi >= 0 && isHesitation(words[pi].norm)) pi--;
  const prevRaw = words[i - 1];
  const pe = words[pi]?.norm;
  const p2 = words[pi - 1]?.norm;
  const n1w = words[i + 1];
  const n2w = words[i + 2];
  const n1 = n1w?.norm;
  const n2 = n2w?.norm;

  // Tags for a small window around "like".
  const lo = Math.max(0, i - 3);
  const hi = Math.min(words.length, i + 4);
  const tags = tagWords(words.slice(lo, hi).map((x) => x.norm));
  const tagAt = (k: number): WordTags | undefined => (k >= lo && k < hi ? tags[k - lo] : undefined);
  const tn1 = tagAt(i + 1);
  const tn2 = tagAt(i + 2);
  const tpe = pi >= 0 ? tagAt(pi) : undefined;

  const gapBefore = prevRaw ? w.start - prevRaw.end : Infinity;
  const gapAfter = n1w ? n1w.start - w.end : Infinity;
  const commaAfter = /[,…]|\.\.\.$|—$|-$/.test(w.text);
  const commaBefore = !!prevRaw && /[,…]|\.\.\.$|—$/.test(prevRaw.text);
  const startOfUtterance = !prevRaw || gapBefore >= UTTERANCE_GAP || /[.?!]$/.test(prevRaw.text);
  const breakAfter = commaAfter || (n1w !== undefined && gapAfter >= BREAK_GAP);
  const breakBefore = commaBefore || (prevRaw !== undefined && gapBefore >= BREAK_GAP);

  const peIsSubject =
    !!pe &&
    (SUBJECT_PRONOUNS.has(pe) ||
      // "I really like it": subject + adverb + like
      (PRE_VERB_ADVERBS.has(pe) && !!p2 && SUBJECT_PRONOUNS.has(p2)));
  const peIsBe = !!pe && (BE_FORMS.has(pe) || !!tpe?.copula);

  // Nothing heard after "like" yet.
  if (!n1w) {
    if (!opts.rightClosed) return NEED_MORE;
    if (pe && (VERB_PREV.has(pe) || SUBJECT_PRONOUNS.has(pe)))
      return verdict("verb", 0.8, `"${pe} like" ends the phrase — a verb ("what do you like?")`);
    // "and I was like…" trailing off: a filler when it's marked as a break.
    if (commaAfter || /\.\.\.$|…$/.test(w.text)) return verdict("discourse", 0.8, `"like…" trailing off`);
    if (pe && COMPARISON_PREV.has(pe)) return verdict("comparison", 0.7, `"${pe} like" — a comparison, cut off`);
    if (peIsBe || (pe && DISCOURSE_PREV.has(pe)))
      return verdict("discourse", 0.75, `"${pe} like" and then silence — trailing off`);
    return verdict("unknown", 0.5, `nothing follows "like"; not enough context`);
  }
  // Some rules need a second word of right context.
  const needN2 = () => !n2w && !opts.rightClosed;

  // --- Idioms that are never fillers -------------------------------------
  if (n1 && SUBJECT_PRONOUNS.has(n1) && !peIsSubject) {
    if (needN2()) return NEED_MORE;
    if (n2 && SPEECH_VERBS.has(n2)) return verdict("conjunction", 0.9, `"like ${n1} ${n2}" means "as ${n1} ${n2}"`);
  }
  if (pe && (pe === "kinda" || pe === "sorta" || (pe === "of" && (p2 === "kind" || p2 === "sort")))) {
    return verdict("hedge", 0.8, `"kind of like" is a hedge, not a filler`);
  }
  if (pe && VERB_PREV.has(pe) && pe !== "to") {
    return verdict("verb", 0.9, `"${pe} like" — "like" is the verb`);
  }
  if (pe === "to") {
    if (p2 && TO_VERB_PREV.has(p2)) return verdict("verb", 0.85, `"${p2} to like" — "like" is the verb`);
    // "went to like the mall" vs "hard to like him" is genuinely ambiguous here.
  }
  // "do you like like her?" — doubled like as emphasis, not a filler.
  if (n1 === "like" && (peIsSubject || (pe && VERB_PREV.has(pe)))) {
    return verdict("verb", 0.8, `"${pe} like like" — emphatic "like like"`);
  }
  if (pe === "like") {
    const p2s = words[pi - 1]?.norm;
    if (p2s && (SUBJECT_PRONOUNS.has(p2s) || VERB_PREV.has(p2s)))
      return verdict("verb", 0.8, `second "like" in "${p2s} like like"`);
  }

  // --- Strong filler signals from the next word --------------------------
  if (n1 && isHesitation(n1)) return verdict("discourse", 0.85, `"like ${n1}" — a filler next to a hesitation`);
  if (n1 === "like") return verdict("discourse", 0.85, `repeated "like like"`);
  if (tn1?.pastVerb && !(pe && COMPARISON_PREV.has(pe) && tn1.adjective)) {
    if (needN2()) return NEED_MORE;
    const modifiesNoun = tn1.adjective && !!tn2?.noun;
    if (!modifiesNoun) {
      return verdict(
        "discourse",
        0.9,
        `"like ${n1}" — a past-tense verb can't follow verb "like", so it's a filler (deleting it leaves "…${pe ?? ""} ${n1}")`,
      );
    }
  }
  if (n1 && (INTENSIFIERS.has(n1) || tn1?.adverb) && tn2?.pastVerb && !tn2.adjective) {
    return verdict("discourse", 0.9, `"like ${n1} ${n2}" — filler before an adverb + verb`);
  }

  // --- Comparison ("looks like rain", "feel like") -----------------------
  if (pe && COMPARISON_PREV.has(pe)) return verdict("comparison", 0.85, `"${pe} like" — a comparison`);

  // "it was um like whatever": a hesitation right before "like" (outside subject + verb).
  if (prevRaw && isHesitation(prevRaw.norm) && !peIsSubject) {
    return verdict("discourse", 0.8, `"${prevRaw.norm} like" — a filler chained to a hesitation`);
  }

  // --- After a form of "be": quotative, approximator, hedge, or comparison
  if (peIsBe) {
    if (isNumber(n1, tn1)) return verdict("approximator", 0.85, `"${pe} like ${n1}" — approximation ("about ${n1}")`);
    if ((n1 === "a" || n1 === "an") && n2 && SCALE_WORDS.has(n2))
      return verdict("approximator", 0.8, `"like a ${n2}" — approximation`);
    if (n1 && (n1 === "this" || n1 === "that")) {
      if (needN2()) return NEED_MORE;
      if (n2 && (BE_FORMS.has(n2) || tn2?.presentVerb || tn2?.pastVerb || SUBJECT_PRONOUNS.has(n2)))
        return verdict("quotative", 0.8, `"${pe} like ${n1} ${n2}…" — introducing a quote or reaction`);
      return verdict("comparison", 0.8, `"${pe} like ${n1}" — a comparison`);
    }
    if (breakAfter || (n1 && (QUOTE_OPENERS.has(n1) || NOMINATIVE_ONLY.has(n1))))
      return verdict(
        "quotative",
        0.85,
        `"${pe} like${breakAfter ? "," : ""} ${n1}…" — introducing a quote or reaction`,
      );
    if (n1 && DETERMINERS.has(n1))
      return verdict("comparison", 0.8, `"${pe} like ${n1} …" — a comparison ("it was like a dream")`);
    if (n1 && (INTENSIFIERS.has(n1) || tn1?.adverb || (tn1?.adjective && !tn1.noun)))
      return verdict("discourse", 0.85, `"${pe} like ${n1}" — filler before a description`);
    if (tn1?.gerund) return verdict("discourse", 0.8, `"${pe} like ${n1}" — filler inside "${pe} ${n1}"`);
    if (n1 === "you") return verdict("quotative", 0.8, `"${pe} like you…" — introducing a quote or reaction`);
    if (tn1?.noun) return verdict("comparison", 0.7, `"${pe} like ${n1}" — probably a comparison`);
    return verdict("unknown", 0.5, `after "${pe}", but the next word is ambiguous`);
  }

  // --- "it cost like 40 bucks" ---------------------------------------------
  if (isNumber(n1, tn1) && !peIsSubject)
    return verdict("approximator", 0.75, `"like ${n1}" — approximation ("about ${n1}")`);

  // --- "things like that" -------------------------------------------------
  if (tpe?.noun && pe && !SUBJECT_PRONOUNS.has(pe) && n1 && ["this", "that", "these", "those"].includes(n1)) {
    return verdict("example", 0.8, `"${pe} like ${n1}" — "such as"`);
  }

  // --- Subject + like: usually the verb ("I like tofu") --------------------
  if (peIsSubject || (tpe?.noun && !breakBefore)) {
    const objectLike =
      (n1 && (DETERMINERS.has(n1) || OBJECT_PRONOUNS.has(n1) || n1 === "to")) ||
      tn1?.noun ||
      tn1?.gerund ||
      isNumber(n1, tn1);
    if (objectLike && !breakAfter) return verdict("verb", 0.9, `"${pe} like ${n1}" — subject + verb + object`);
    if (n1 && NOMINATIVE_ONLY.has(n1)) {
      return breakAfter
        ? verdict("discourse", 0.85, `"${pe} like, ${n1}…" — filler before restarting the sentence`)
        : verdict("discourse", 0.7, `"${pe} like ${n1}" — probably a filler, but not certain`);
    }
    if (n1 && (INTENSIFIERS.has(n1) || tn1?.adverb)) {
      if (needN2()) return NEED_MORE;
      if (tn2?.adjective || tn2?.noun)
        return verdict("verb", 0.7, `"${pe} like ${n1} ${n2}" — likely the verb ("I like really spicy food")`);
      return verdict("unknown", 0.55, `"${pe} like ${n1}" — ambiguous`);
    }
    if (tn1?.adjective) return verdict("verb", 0.75, `"${pe} like ${n1}…" — likely the verb with an adjective object`);
    if (breakAfter) return verdict("discourse", 0.75, `"${pe} like," — pause after "like"`);
    return verdict("verb", 0.6, `"${pe} like ${n1}" — likely the verb`);
  }

  // --- After "and/so/but", or starting an utterance ------------------------
  if ((pe && DISCOURSE_PREV.has(pe)) || startOfUtterance) {
    const where = startOfUtterance ? "at the start of a phrase" : `after "${pe}"`;
    if (n1 && (SUBJECT_PRONOUNS.has(n1) || DETERMINERS.has(n1) || INTENSIFIERS.has(n1) || tn1?.adverb))
      return verdict("discourse", 0.85, `"like ${n1}" ${where} — a discourse filler`);
    if (breakAfter) return verdict("discourse", 0.85, `"like," ${where} — a discourse filler`);
    if (tn1?.noun) return verdict("example", 0.55, `"like ${n1}" ${where} — could be an example`);
    return verdict("unknown", 0.55, `"like" ${where}, next word ambiguous`);
  }

  // --- Set off by commas or pauses on both sides: "we went, like, home" -----
  if (breakBefore && breakAfter) return verdict("discourse", 0.8, `"like" set off by pauses on both sides`);

  // --- After a verb: "talk like a pirate" vs "it went like really well" ----
  if (tpe && (tpe.presentVerb || tpe.pastVerb || tpe.gerund)) {
    if (n1 && (INTENSIFIERS.has(n1) || tn1?.adverb) && n1 !== "crazy")
      return verdict("discourse", 0.75, `"${pe} like ${n1}" — filler before an intensifier`);
    return verdict("comparison", 0.65, `"${pe} like ${n1}" — probably "in the way of"`);
  }

  if (breakAfter) return verdict("discourse", 0.7, `pause after "like"`);
  return verdict("unknown", 0.5, `no clear pattern around "like"`);
}
