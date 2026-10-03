// Small closed-class word lists the "like" rules depend on. These are deliberately
// explicit rather than learned so every decision can be explained and tested.

const set = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

export const SUBJECT_PRONOUNS = set("i you we they he she it y'all yall people everyone everybody someone somebody");
export const OBJECT_PRONOUNS = set("me him her us them it you this that these those everything something anything nothing everyone someone anyone");
export const NOMINATIVE_ONLY = set("i we they he she");

export const BE_FORMS = set(
  "am is are was were be been being 's 'm 're i'm it's he's she's that's there's here's what's who's we're they're you're isn't wasn't aren't weren't ain't",
);

/** Words before "like" that make it a comparison ("looks like", "feel like"). */
export const COMPARISON_PREV = set(
  "look looks looked looking seem seems seemed seeming sound sounds sounded sounding feel feels felt feeling act acts acted acting smell smells smelled taste tastes tasted something nothing anything everything more less much exactly just almost quite unlike nobody somebody anybody",
);

/** Words before "like" that make it the verb ("would like", "don't like", "to like"). */
export const VERB_PREV = set(
  "would wouldn't 'd i'd you'd we'd they'd he'd she'd do does did don't doesn't didn't to might may will won't 'll i'll you'll we'll they'll could should can can't cannot must gonna wanna",
);

/** Adverbs that may sit between a subject and verb-"like" ("I really like it"). */
export const PRE_VERB_ADVERBS = set("really also still totally actually honestly kinda genuinely truly always never sometimes definitely all both");

/** Discourse connectors after which "like" usually starts a filler run. */
export const DISCOURSE_PREV = set(
  "and but so or because cause cuz then well yeah yes no okay ok oh anyway um uh honestly basically",
);

export const DETERMINERS = set(
  "a an the this that these those my your his her its our their some any every each no another all both what which whose",
);

export const INTENSIFIERS = set(
  "really so totally super very kinda kind sorta literally actually just pretty way insanely crazy lowkey highkey fully completely absolutely genuinely seriously",
);

/** Hesitation fillers. Backchannels like "uh-huh"/"mhmm" are intentionally excluded. */
export const UM_FORMS = set("um umm ummm uhm hmm erm");
export const UH_FORMS = set("uh uhh uhhh er ah");

/** Verbs that introduce speech: "like I said", "like you mentioned". */
export const SPEECH_VERBS = set("said say told mentioned thought think know knew explained asked put");

export const NUMBER_WORDS = set(
  "one two three four five six seven eight nine ten eleven twelve fifteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion half couple few dozen",
);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\-]/g, "")
    .replace(/^'+|'+$/g, "");
}
