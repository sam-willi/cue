import nlp from "compromise";

/** Coarse part-of-speech facts about one word, derived from compromise's tags. */
export interface WordTags {
  pastVerb: boolean;
  presentVerb: boolean;
  gerund: boolean;
  infinitive: boolean;
  copula: boolean;
  noun: boolean;
  adjective: boolean;
  adverb: boolean;
  value: boolean;
}

const EMPTY: WordTags = {
  pastVerb: false,
  presentVerb: false,
  gerund: false,
  infinitive: false,
  copula: false,
  noun: false,
  adjective: false,
  adverb: false,
  value: false,
};

function toTags(tags: string[]): WordTags {
  const has = (t: string) => tags.includes(t);
  return {
    pastVerb: has("Verb") && has("PastTense"),
    presentVerb: has("Verb") && has("PresentTense") && !has("Gerund"),
    gerund: has("Gerund"),
    infinitive: has("Infinitive"),
    copula: has("Copula"),
    noun: has("Noun") && !has("Pronoun"),
    adjective: has("Adjective"),
    adverb: has("Adverb"),
    value: has("Value") || has("Cardinal"),
  };
}

interface Term {
  text: string;
  normal: string;
  tags: string[];
}

/**
 * Tag each word in context. compromise splits contractions ("it's" → "it" + "is"),
 * so terms are merged back onto the original words by walking the text in order.
 */
export function tagWords(words: string[]): WordTags[] {
  if (words.length === 0) return [];
  const doc = nlp(words.join(" "));
  const terms: Term[] = (doc.json() as { terms: Term[] }[]).flatMap((s) => s.terms);
  const out: WordTags[] = [];
  let t = 0;
  for (const w of words) {
    const target = w.toLowerCase();
    const merged: string[] = [];
    let consumed = "";
    // Take terms until their visible text covers this word.
    while (t < terms.length && consumed.length < target.length) {
      const term = terms[t++];
      merged.push(...term.tags);
      consumed += term.text.toLowerCase().replace(/[^a-z0-9'\-]/g, "");
    }
    // Swallow zero-width expansion terms that belong to this word (e.g. the "is" in "it's").
    while (t < terms.length && terms[t].text === "") merged.push(...terms[t++].tags);
    out.push(merged.length ? toTags(merged) : EMPTY);
  }
  return out;
}
