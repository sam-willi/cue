import { modeRules, PRESENTATION, toApproxWpm, type CueConfig } from "./config";
import { suggestFillers } from "./customFillers";
import { isDisfluency, type TapRecord } from "./engine";
import { findInclusiveFlags, type InclusiveFlag } from "./inclusive";
import { normalize, UH_FORMS, UM_FORMS } from "./lexicon";
import { activeSpeechFrames, median } from "./loudness";
import { measurePace } from "./pace";
import { PATTERNS, type CuePattern } from "./patterns";
import { semitones } from "./pitch";
import type { BehaviorType, CueDecision, Word } from "./types";

/**
 * The after-session report (CUE_CONTEXT.md §26, decision 19): what a talk sounded like as a
 * whole, in the areas a speaking coach would comment on. Live, Cue only ever asks for three
 * things (pause, slow down, speak up); everything else waits for here.
 *
 * Every threshold below is a starting point to check against real sessions, not an
 * established cutoff.
 */

/** Gaps up to this long (s) are the wearer's own pauses; longer ones are someone else talking, or a stop. */
const TALK_GAP = 2.0;
/** A gap (s) between words that counts as a real pause (the same line the live engine uses). */
const MEANINGFUL_PAUSE = 0.6;
/** Under this much talking (s), there's too little to judge pace, pauses or pitch. */
const MIN_TALK_SEC = 20;
/** Filler rates are only quoted after this much talking (s). */
const MIN_RATE_SEC = 30;
/** Pace is sampled this often (s) over a window this long (s). */
const PACE_STEP = 5;
const PACE_WINDOW = 8;
/** Rushing for at least this share of the samples is worth working on. */
const FAST_SHARE = 0.2;
/** Comfortable average pace, words per minute (about 150 in conversation, 120–160 presenting). */
const PACE_BAND: Record<CueConfig["mode"], [number, number]> = { conversation: [110, 180], presentation: [110, 165] };
/** Volume is judged in blocks this long (s); this share of quiet blocks is worth working on. */
const VOLUME_BLOCK = 4;
const QUIET_SHARE = 0.2;
/** Voiced pitch frames (50 ms each) needed before judging pitch: 5 s of voice. */
const MIN_PITCH_FRAMES = 100;
/** Pitch spread (standard deviation, semitones) below this sounds flat. */
const FLAT_SEMITONES = 2;
/** Pitch frames further than this from the wearer's typical pitch are tracking errors (octave slips). */
const PITCH_OUTLIER = 12;
/** A run of this many words matching the notes exactly counts as reading. */
const VERBATIM_RUN = 5;
const MIN_SCRIPT_WORDS = 15;
/** Reading at least this share of the talk word for word is worth working on. */
const READING_SHARE = 0.5;

export type Verdict = "good" | "improve" | "none";
export type SectionKey = "pauses" | "pace" | "volume" | "fillers" | "pitch" | "originality" | "inclusive";

/** One concrete thing to practise, given when a section needs work. */
export interface Technique {
  name: string;
  how: string;
  /** What to do differently, as two or three words ("Slow down"). */
  action: string;
  /** The technique as one sentence: what to do next time, without the drill. */
  short: string;
}

/**
 * What a speaking coach would have you practise for each habit. Each is one physical action
 * plus a drill, since "slow down" on its own tells nobody how.
 */
const TECHNIQUES = {
  pauses: {
    action: "Pause more",
    short: "At the end of each thought, close your mouth and take one full breath before you start the next.",
    name: "One thought, one breath",
    how: "At the end of each thought, close your mouth and breathe in through your nose before you start the next one. The silence feels long to you and normal to listeners. To practise, read a paragraph aloud and stop for a full breath at every full stop.",
  },
  paceFast: {
    action: "Slow down",
    short: "Finish the last word of each sentence, breathe in, then begin the next one.",
    name: "Land the last word",
    how: "Rushing usually comes from starting the next sentence before the last one has finished. Say the final word of each sentence all the way to its last sound, breathe in, then begin. To practise, read a page aloud with a slash marked at every comma and full stop, and stop at each slash.",
  },
  paceSlow: {
    action: "Pick up the pace",
    short: "Say five or six words in one breath, instead of placing each word on its own.",
    name: "Speak in phrases",
    how: "Say five or six words in one breath, then pause, instead of placing each word on its own. To practise, time yourself reading a 150-word paragraph aloud and aim to finish in about a minute.",
  },
  volume: {
    action: "Speak up",
    short: "Keep the last three words of every sentence as loud as the first three.",
    name: "Finish the sentence at full volume",
    how: "Quiet stretches are usually sentence endings fading out. Breathe in low, so your stomach moves and your shoulders stay still, and keep the last three words as loud as the first three. To practise, pick a spot on the far wall and say each sentence to it.",
  },
  fillers: {
    action: "Swap fillers for a pause",
    short: "When you feel a filler coming, close your lips and let the silence stand.",
    name: "Close your mouth",
    how: "A filler covers the moment while you find the next words. When you feel one coming, close your lips and let the silence stand: you can’t say “um” with your mouth shut. To practise, talk for one minute about your day and start the sentence again every time a filler slips out.",
  },
  pitch: {
    action: "Vary your voice",
    short: "In each sentence, pick the word that matters most and say it a little higher and longer.",
    name: "Lift one word",
    how: "In each sentence, choose the word that matters most and say it a little higher and a little longer. To practise, say one sentence five times, lifting a different word each time, and listen to how the meaning moves.",
  },
  originality: {
    action: "Talk around your notes",
    short: "Cut your notes to a few keywords for each point, look up, then say it in your own words.",
    name: "Keywords, not sentences",
    how: "Cut your notes down to three to five words for each point. Glance at the keywords, look up, then say the point in your own words. Full sentences on the page get read out; keywords can’t be.",
  },
  inclusive: {
    action: "Swap a few words",
    short: "Pick the word you’d rather use and say the sentence aloud three times with it.",
    name: "Rehearse the replacement",
    how: "Choose the word you’d rather use, then say the whole sentence aloud three times with it. The swap only sticks once you have practised saying it.",
  },
} satisfies Record<string, Technique>;

/**
 * The technique for each area, whatever the verdict: the report offers it on every card, so the
 * advice is there to read even when a session flagged nothing. (A section that needs work
 * carries its own `technique`, which for pace depends on whether it was too fast or too slow.)
 */
export const AREA_TECHNIQUE: Record<SectionKey, Technique> = {
  pauses: TECHNIQUES.pauses,
  pace: TECHNIQUES.paceFast,
  volume: TECHNIQUES.volume,
  fillers: TECHNIQUES.fillers,
  pitch: TECHNIQUES.pitch,
  originality: TECHNIQUES.originality,
  inclusive: TECHNIQUES.inclusive,
};

export interface ReportSection {
  key: SectionKey;
  title: string;
  /** "improve": something to work on. "good": nothing to change. "none": not enough to say. */
  verdict: Verdict;
  headline: string;
  advice: string;
  /** How to work on it; only when the verdict is "improve". */
  technique?: Technique;
  /** For sections judged by a share of the session: the share (0–1) and the line worth working on. */
  share?: { value: number; line: number; label: string };
  /** How well it went, 0–1, for the Speak score. Absent when there was too little to judge. */
  quality?: number;
  stats: { label: string; value: string }[];
}

export type ScoreLevel = "Very high" | "High" | "OK" | "Low" | "Very low";

/**
 * The Speak score (decision 25): one number out of 100 for how easy the session was to listen
 * to, built from points per area the way a sleep score is. An area that couldn't be measured
 * (no microphone, no volume set) is left out and the others are scaled up to 100.
 */
export interface SpeakScore {
  total: number;
  level: ScoreLevel;
  parts: { key: SectionKey; title: string; earned: number; max: number }[];
  /** Areas that count toward the score but weren't measured this time. */
  missing: string[];
}

export interface SessionReport {
  /** Null until there's enough speech to judge pace, pauses and filler words. */
  score: SpeakScore | null;
  /** Seconds the wearer spent talking, counting their own short pauses. */
  talkSec: number;
  wordCount: number;
  sections: ReportSection[];
  /** Up to three things to work on next, most important first. */
  focus: string[];
  /** The area each of those is about, in the same order. */
  focusKeys: SectionKey[];
  /**
   * What to do differently next time, at most three, the one that cost the most points first:
   * the action in a few words, how in one sentence, and the finding behind it.
   */
  next: { key: SectionKey; title: string; action: string; how: string; why: string }[];
  /** Live cues given, by cue. */
  cues: { pattern: CuePattern; action: string; count: number; worked: number; judged: number }[];
  /** Pace through the session, words per minute, for a small chart. */
  paceTimeline: { t: number; wpm: number }[];
  paceLimitWpm: number;
  /** When the wearer's first word began (s), so the report can show times from the start of the talk. */
  startSec: number;
  /** What the wearer was saying where they rushed: the fastest few passages, in the order they were said. */
  rushed: { start: number; end: number; wpm: number; text: string }[];
  /** The comfortable average pace for this mode, words per minute. */
  paceBandWpm: [number, number];
  /** Each stretch of talking between two real pauses, in session seconds, for the pauses strip. */
  stretches: { start: number; end: number }[];
  /** A stretch longer than this (s) is worth a pause. */
  stretchLimitSec: number;
  /** The voice's pitch through the session, in semitones from the wearer's typical pitch. */
  pitchContour: { t: number; st: number }[];
  /** Each filler said, most frequent first. */
  fillers: { word: string; count: number }[];
  /** Habit words said often that aren't on the wearer's filler list, to offer as additions. */
  suggestedFillers: { phrase: string; count: number }[];
  inclusive: InclusiveFlag[];
}

export interface ReportInput {
  /** The wearer's words, in order. */
  words: Word[];
  /** Every decision the session made (`CueSession.history`). */
  history: CueDecision[];
  taps: TapRecord[];
  /** Mic level frames: [time s, dBFS]. Empty without a microphone. */
  levels: [number, number][];
  /** Voice-activity frames from the mic: [time s, whether a voice was heard]. Empty if the detector didn't run. */
  voice?: [number, boolean][];
  /** Voiced pitch frames: [time s, Hz]. Empty without a microphone. */
  pitch: [number, number][];
  config: CueConfig;
  /** The session's rushing limit, syllables/s. */
  paceLimit: number;
  /** The wearer's notes or script, if they pasted them, to check for reading word for word. */
  script?: string;
}

const FILLER_WORD: Partial<Record<BehaviorType, string>> = {
  filler_um: "um",
  filler_uh: "uh",
  filler_like: "like",
  filler_lowkey: "lowkey",
};

const round = (x: number) => Math.round(x);
const pct = (x: number) => `${round(x * 100)}%`;
const secs = (x: number) => (x >= 90 ? `${(x / 60).toFixed(1)} min` : `${round(x)} s`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Points per area, out of 100. Pace, pauses and fillers are what Cue coaches live and what
 * listeners notice first; volume and pitch count for less and need a microphone. Reading from
 * notes and wording are choices, not delivery, so they aren't scored.
 */
const SCORE_WEIGHTS: Partial<Record<SectionKey, number>> = { pace: 30, pauses: 25, fillers: 25, volume: 10, pitch: 10 };
/** Without these three there is no score: they're the ones every session can measure. */
const SCORE_NEEDS: SectionKey[] = ["pace", "pauses", "fillers"];
const SCORE_LEVELS: [number, ScoreLevel][] = [
  [90, "Very high"],
  [75, "High"],
  [55, "OK"],
  [35, "Low"],
  [0, "Very low"],
];
/** Fillers a minute at or under this score full marks (it is not a test of saying none); this many score nothing. */
const FILLERS_FREE = 2;
const FILLERS_ZERO = 12;

const unit = (x: number) => Math.max(0, Math.min(1, x));

function speakScore(sections: ReportSection[]): SpeakScore | null {
  const counted = sections.filter((s) => SCORE_WEIGHTS[s.key] !== undefined);
  const measured = counted.filter((s) => s.quality !== undefined);
  if (SCORE_NEEDS.some((key) => !measured.some((s) => s.key === key))) return null;
  // Scale the measured areas' weights up to 100 in whole points (largest remainders get the spare ones).
  const weightSum = measured.reduce((n, s) => n + SCORE_WEIGHTS[s.key]!, 0);
  const exact = measured.map((s) => (SCORE_WEIGHTS[s.key]! / weightSum) * 100);
  const max = exact.map(Math.floor);
  const spare = 100 - max.reduce((a, b) => a + b, 0);
  exact
    .map((x, k) => ({ k, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac)
    .slice(0, spare)
    .forEach(({ k }) => max[k]++);
  const parts = measured.map((s, k) => ({
    key: s.key,
    title: s.title,
    max: max[k],
    earned: round(s.quality! * max[k]),
  }));
  const total = parts.reduce((n, part) => n + part.earned, 0);
  return {
    total,
    level: SCORE_LEVELS.find(([floor]) => total >= floor)![1],
    parts,
    missing: counted.filter((s) => s.quality === undefined).map((s) => s.title),
  };
}

export function buildReport(input: ReportInput): SessionReport {
  const { words, config } = input;
  const talkSec = talkSeconds(words);
  const enough = talkSec >= MIN_TALK_SEC;
  const fillers = countFillers(input.history);
  const inclusive = findInclusiveFlags(words);
  const pace = paceSection(words, input.paceLimit, config, enough);
  const pitch = pitchSection(words, input.pitch);
  const sections: ReportSection[] = [
    pauseSection(words, talkSec, config, enough),
    pace.section,
    volumeSection(words, input.levels, input.voice ?? [], config),
    fillerSection(fillers, talkSec),
    pitch.section,
    originalitySection(words, input.script),
    inclusiveSection(inclusive),
  ];
  const score = speakScore(sections);
  // What cost the most points comes first; areas that aren't scored keep their usual order after those.
  const lost = (s: ReportSection) => {
    const part = score?.parts.find((x) => x.key === s.key);
    return part ? part.max - part.earned : 0;
  };
  const focus = sections
    .filter((s) => s.verdict === "improve")
    .sort((a, b) => lost(b) - lost(a))
    .slice(0, 3);
  return {
    score,
    talkSec,
    wordCount: words.length,
    sections,
    focus: focus.map((s) => s.advice),
    focusKeys: focus.map((s) => s.key),
    next: focus.map((s) => ({
      key: s.key,
      title: s.title,
      action: (s.technique ?? AREA_TECHNIQUE[s.key]).action,
      how: (s.technique ?? AREA_TECHNIQUE[s.key]).short,
      why: s.headline,
    })),
    cues: cueCounts(input.taps),
    paceTimeline: pace.timeline,
    startSec: words[0]?.start ?? 0,
    rushed: enough ? rushedPassages(words, input.paceLimit) : [],
    paceLimitWpm: toApproxWpm(input.paceLimit),
    paceBandWpm: PACE_BAND[config.mode],
    stretches: enough ? stretchesOf(words) : [],
    stretchLimitSec: modeRules(config).noPauseSec,
    pitchContour: pitch.contour,
    fillers,
    suggestedFillers: suggestFillers(words, config.customFillers, talkSec),
    inclusive,
  };
}

/** Seconds of talking: words plus the gaps between them, up to `TALK_GAP` each. */
export function talkSeconds(words: Word[]): number {
  let total = 0;
  for (let k = 0; k < words.length; k++) {
    total += words[k].end - words[k].start;
    const gap = k + 1 < words.length ? words[k + 1].start - words[k].end : 0;
    if (gap > 0 && gap <= TALK_GAP) total += gap;
  }
  return total;
}

function countFillers(history: CueDecision[]): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of history) {
    if (!isDisfluency(d.event.type)) continue;
    if (d.withheldReason === "low_confidence" || d.withheldReason === "category_off") continue;
    const word = d.event.phrase ?? FILLER_WORD[d.event.type] ?? "filler";
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count);
}

function cueCounts(taps: TapRecord[]): SessionReport["cues"] {
  const patternOf = (t: TapRecord): CuePattern =>
    t.reason === "rushing" ? "steps" : t.reason === "too_quiet" ? "push" : "tap";
  return (["tap", "steps", "push"] as const).map((pattern) => {
    const mine = taps.filter((t) => patternOf(t) === pattern);
    return {
      pattern,
      action: PATTERNS[pattern].action,
      count: mine.length,
      worked: mine.filter((t) => t.outcome === "worked").length,
      judged: mine.filter((t) => t.outcome).length,
    };
  });
}

/** The stretches of talking between real pauses: what the pauses section counts, as spans. */
function stretchesOf(words: Word[]): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  let start = words[0].start;
  for (let k = 1; k < words.length; k++) {
    if (words[k].start - words[k - 1].end < MEANINGFUL_PAUSE) continue;
    out.push({ start, end: words[k - 1].end });
    start = words[k].start;
  }
  out.push({ start, end: words[words.length - 1].end });
  return out;
}

function pauseSection(words: Word[], talkSec: number, config: CueConfig, enough: boolean): ReportSection {
  const title = "Pauses";
  if (!enough)
    return { key: "pauses", title, verdict: "none", headline: "Not enough speech yet", advice: "", stats: [] };
  let pauses = 0;
  let runStart = words[0].start;
  let longest = 0;
  for (let k = 1; k < words.length; k++) {
    const gap = words[k].start - words[k - 1].end;
    if (gap < MEANINGFUL_PAUSE) continue;
    pauses++;
    longest = Math.max(longest, words[k - 1].end - runStart);
    runStart = words[k].start;
  }
  longest = Math.max(longest, words[words.length - 1].end - runStart);
  const limit = modeRules(config).noPauseSec;
  const perMin = pauses / (talkSec / 60);
  const improve = longest > limit;
  return {
    key: "pauses",
    title,
    verdict: improve ? "improve" : "good",
    headline: improve
      ? `You went ${secs(longest)} without a pause`
      : `You paused about every ${secs(talkSec / Math.max(1, pauses))}`,
    advice: improve
      ? `Pause more. Your longest stretch without one was ${secs(longest)}; end a thought, breathe, then start the next.`
      : "Your pauses gave listeners room to keep up. Keep ending thoughts with a breath.",
    technique: improve ? TECHNIQUES.pauses : undefined,
    // Full marks up to the point where a pause was due; nothing at three times that.
    quality: 1 - unit((longest - limit) / (2 * limit)),
    stats: [
      { label: "Pauses", value: `${pauses} (${perMin.toFixed(1)} a minute)` },
      { label: "Longest without one", value: secs(longest) },
    ],
  };
}

function paceSection(
  words: Word[],
  paceLimit: number,
  config: CueConfig,
  enough: boolean,
): { section: ReportSection; timeline: SessionReport["paceTimeline"] } {
  const title = "Pace";
  if (!enough)
    return {
      section: { key: "pace", title, verdict: "none", headline: "Not enough speech yet", advice: "", stats: [] },
      timeline: [],
    };
  const timeline: SessionReport["paceTimeline"] = [];
  let fast = 0;
  let idx = 0;
  const end = words[words.length - 1].end;
  for (let t = words[0].start + PACE_WINDOW; t <= end + PACE_STEP; t += PACE_STEP) {
    while (idx < words.length && words[idx].end <= t) idx++;
    // Skip samples that land in a long silence: there's no current pace to measure.
    if (idx === 0 || t - words[idx - 1].end > TALK_GAP) continue;
    const p = measurePace(words.slice(0, idx), PACE_WINDOW);
    if (!p) continue;
    timeline.push({ t, wpm: p.wpm });
    if (p.sps > paceLimit) fast++;
  }
  const speaking = speakingOnly(words);
  const avg = speaking > 0 ? (words.length / speaking) * 60 : 0;
  const fastShare = timeline.length ? fast / timeline.length : 0;
  const fastest = timeline.length ? Math.max(...timeline.map((p) => p.wpm)) : avg;
  const [lo, hi] = PACE_BAND[config.mode];
  const tooFast = fastShare >= FAST_SHARE || avg > hi;
  const tooSlow = !tooFast && avg < lo;
  return {
    timeline,
    section: {
      key: "pace",
      title,
      verdict: tooFast || tooSlow ? "improve" : "good",
      headline: tooFast
        ? fastShare >= FAST_SHARE
          ? `You were rushing ${pct(fastShare)} of the time`
          : `You averaged ${round(avg)} words a minute, which is fast`
        : tooSlow
          ? `You averaged ${round(avg)} words a minute, which is slow`
          : `A steady ${round(avg)} words a minute`,
      advice: tooFast
        ? `Slow down. You peaked near ${round(fastest)} words a minute; aim for ${lo} to ${hi}.`
        : tooSlow
          ? `Pick up the pace a little. Listeners follow most easily between ${lo} and ${hi} words a minute.`
          : `Your pace sat in the comfortable ${lo} to ${hi} range.`,
      technique: tooFast ? TECHNIQUES.paceFast : tooSlow ? TECHNIQUES.paceSlow : undefined,
      // The worse of two things: how much of the time was rushed, and how far the average sat outside the band.
      quality: Math.min(1 - unit(fastShare / 0.6), 1 - unit(Math.max(avg - hi, lo - avg) / 40)),
      stats: [
        { label: "Average", value: `${round(avg)} wpm` },
        { label: "Fastest stretch", value: `${round(fastest)} wpm` },
        { label: "Time rushing", value: pct(fastShare) },
      ],
    },
  };
}

/** A word counts as rushed by the pace of the speech this many seconds around it. */
const LOCAL_WINDOW = 4;
/** A rushed passage is at least this many words; up to this many slower words in a row don't break it. */
const MIN_PASSAGE_WORDS = 8;
const PASSAGE_BRIDGE = 2;
/** The report quotes this many passages, each cut off after this many words. */
const MAX_PASSAGES = 3;
const MAX_PASSAGE_WORDS = 40;

/**
 * The words said where the pace ran over the limit. The pace chart shows when the wearer
 * rushed; this says what they were saying, which is usually what explains it (a list, a
 * story they've told before, the part they were nervous about).
 */
function rushedPassages(words: Word[], paceLimit: number): SessionReport["rushed"] {
  const fast = words.map((w, k) => {
    let a = k;
    let b = k;
    while (a > 0 && words[a - 1].start >= w.start - LOCAL_WINDOW / 2) a--;
    while (b + 1 < words.length && words[b + 1].end <= w.end + LOCAL_WINDOW / 2) b++;
    const pace = measurePace(words.slice(a, b + 1), Infinity);
    return pace !== null && pace.sps > paceLimit;
  });
  const passages: SessionReport["rushed"] = [];
  for (let k = 0; k < words.length; k++) {
    if (!fast[k]) continue;
    let end = k;
    for (let j = k + 1, slow = 0; j < words.length && slow <= PASSAGE_BRIDGE; j++) {
      // A real pause ends the passage: whatever comes after it is a new thought.
      if (words[j].start - words[j - 1].end >= MEANINGFUL_PAUSE) break;
      if (fast[j]) {
        end = j;
        slow = 0;
      } else slow++;
    }
    const said = words.slice(k, end + 1);
    if (said.length >= MIN_PASSAGE_WORDS) {
      const shown = said.slice(0, MAX_PASSAGE_WORDS).map((w) => w.text);
      passages.push({
        start: said[0].start,
        end: said[said.length - 1].end,
        wpm: (said.length / speakingOnly(said)) * 60,
        text: shown.join(" ") + (said.length > MAX_PASSAGE_WORDS ? " …" : ""),
      });
    }
    k = end;
  }
  return passages
    .sort((a, b) => b.wpm - a.wpm)
    .slice(0, MAX_PASSAGES)
    .sort((a, b) => a.start - b.start);
}

/** Speaking time with pauses of 0.6 s or more removed, the way live pace is measured. */
function speakingOnly(words: Word[]): number {
  let total = 0;
  for (let k = 0; k < words.length; k++) {
    total += words[k].end - words[k].start;
    const gap = k + 1 < words.length ? words[k + 1].start - words[k].end : 0;
    if (gap > 0 && gap < MEANINGFUL_PAUSE) total += gap;
  }
  return total;
}

/** The samples taken while the wearer was saying a word. */
function duringWords(samples: [number, number][], words: Word[]): [number, number][] {
  const out: [number, number][] = [];
  let j = 0;
  for (const s of samples) {
    while (j < words.length && words[j].end < s[0]) j++;
    if (j < words.length && words[j].start <= s[0]) out.push(s);
  }
  return out;
}

function volumeSection(
  words: Word[],
  levels: [number, number][],
  voice: [number, boolean][],
  config: CueConfig,
): ReportSection {
  const title = "Volume";
  // Only while actually voicing a word, the same way the live "too quiet" check measures.
  const speech = activeSpeechFrames(
    levels.map(([t, db]) => ({ t, db })),
    words,
    voice.map(([t, active]) => ({ t, active })),
    -Infinity,
    Infinity,
  ).map((f): [number, number] => [f.t, f.db]);
  if (speech.length < 40)
    return {
      key: "volume",
      title,
      verdict: "none",
      headline: "Needs a microphone session",
      advice: "",
      stats: [],
    };
  const typical = median(speech.map((s) => s[1]));
  const target = config.volumeTarget[config.mode];
  if (!target || !config.volumeCues[config.mode])
    return {
      key: "volume",
      title,
      verdict: "none",
      headline: "No volume set to compare against",
      advice: "Set your volume before your next session, and this will show how much of it you spent too quiet.",
      stats: [{ label: "Typical level", value: `${round(typical)} dB` }],
    };
  const quietLine = target.db - config.quietDropDb;
  const blocks = new Map<number, number[]>();
  for (const [t, db] of speech) {
    const b = Math.floor(t / VOLUME_BLOCK);
    blocks.set(b, [...(blocks.get(b) ?? []), db]);
  }
  // Blocks with under a second of speech are too thin to judge.
  const judged = [...blocks.values()].filter((b) => b.length >= 20).map(median);
  const quietShare = judged.length ? judged.filter((db) => db < quietLine).length / judged.length : 0;
  const diff = typical - target.db;
  const improve = quietShare >= QUIET_SHARE;
  return {
    key: "volume",
    title,
    verdict: improve ? "improve" : "good",
    headline: improve ? `You were too quiet ${pct(quietShare)} of the time` : "You kept close to the volume you set",
    advice: improve
      ? `Speak up. You dropped well below your set volume for ${pct(quietShare)} of the session, often a sign of trailing off at the end of a thought.`
      : "Your volume held up through the session.",
    technique: improve ? TECHNIQUES.volume : undefined,
    share: { value: quietShare, line: QUIET_SHARE, label: "Time too quiet" },
    quality: 1 - unit(quietShare / 0.6),
    stats: [
      { label: "Against your set volume", value: `${diff >= 0 ? "+" : "−"}${Math.abs(round(diff))} dB` },
      { label: "Time too quiet", value: pct(quietShare) },
    ],
  };
}

function fillerSection(fillers: SessionReport["fillers"], talkSec: number): ReportSection {
  const title = "Filler words";
  const total = fillers.reduce((n, f) => n + f.count, 0);
  const rated = talkSec >= MIN_RATE_SEC;
  const perMin = rated ? total / (talkSec / 60) : 0;
  const top = fillers[0];
  const stats = [
    { label: "Fillers", value: String(total) },
    ...(rated ? [{ label: "A minute", value: perMin.toFixed(1) }] : []),
    ...(top ? [{ label: "Most used", value: `“${top.word}” (${top.count})` }] : []),
  ];
  if (total === 0)
    return {
      key: "fillers",
      title,
      verdict: rated ? "good" : "none",
      headline: "No filler words",
      advice: rated ? "Nothing to change here." : "",
      quality: rated ? 1 : undefined,
      stats,
    };
  // Audiences start marking speakers down at around five a minute (CUE_CONTEXT.md decision 11).
  const improve = rated && perMin > PRESENTATION.fillerRatePerMin;
  return {
    key: "fillers",
    title,
    verdict: improve ? "improve" : rated ? "good" : "none",
    headline: rated ? `${perMin.toFixed(1)} fillers a minute` : plural(total, "filler"),
    advice: improve
      ? `Swap fillers for a pause. “${top.word}” was your most common (${top.count}); when you feel it coming, stop and breathe instead.`
      : rated
        ? "A few fillers are normal and listeners don’t notice them at this rate."
        : "",
    technique: improve ? TECHNIQUES.fillers : undefined,
    quality: rated ? 1 - unit((perMin - FILLERS_FREE) / (FILLERS_ZERO - FILLERS_FREE)) : undefined,
    stats,
  };
}

/** The pitch contour is drawn from one point a second, or fewer for a long session (at most this many). */
const CONTOUR_POINTS = 240;

function pitchSection(
  words: Word[],
  pitch: [number, number][],
): { section: ReportSection; contour: SessionReport["pitchContour"] } {
  const title = "Pitch and tone";
  const samples = duringWords(pitch, words);
  const voiced = samples.map((p) => p[1]);
  if (voiced.length < MIN_PITCH_FRAMES)
    return {
      section: { key: "pitch", title, verdict: "none", headline: "Needs a microphone session", advice: "", stats: [] },
      contour: [],
    };
  const typical = median(voiced);
  const timed = samples
    .map(([t, hz]): [number, number] => [t, semitones(hz, typical)])
    .filter(([, x]) => Math.abs(x) <= PITCH_OUTLIER);
  const st = timed.map(([, x]) => x);
  const mean = st.reduce((a, b) => a + b, 0) / st.length;
  const sd = Math.sqrt(st.reduce((a, b) => a + (b - mean) ** 2, 0) / st.length);
  const sorted = [...st].sort((a, b) => a - b);
  const range = sorted[Math.floor(sorted.length * 0.95)] - sorted[Math.floor(sorted.length * 0.05)];
  const flat = sd < FLAT_SEMITONES;
  // One point per second (the median of that second's frames), so the line shows the melody, not the jitter.
  const t0 = timed[0][0];
  const binSec = Math.max(1, (timed[timed.length - 1][0] - t0) / CONTOUR_POINTS);
  const bins = new Map<number, number[]>();
  for (const [t, x] of timed) {
    const b = Math.floor((t - t0) / binSec);
    bins.set(b, [...(bins.get(b) ?? []), x]);
  }
  const contour = [...bins]
    .sort((x, y) => x[0] - y[0])
    .map(([b, xs]) => ({ t: t0 + (b + 0.5) * binSec, st: median(xs) }));
  return {
    contour,
    section: {
      key: "pitch",
      title,
      verdict: flat ? "improve" : "good",
      headline: flat ? "Your voice stayed fairly flat" : "Your pitch moved, which keeps people listening",
      advice: flat
        ? "Vary your voice. Let your pitch rise on questions and the points that matter, and drop at the end of a thought."
        : "Your voice rose and fell enough to sound engaged.",
      technique: flat ? TECHNIQUES.pitch : undefined,
      // Full marks once the voice moves enough not to sound flat; nothing for a near monotone.
      quality: unit((sd - 0.5) / (FLAT_SEMITONES - 0.5)),
      stats: [
        { label: "Typical pitch", value: `${round(typical)} Hz` },
        { label: "Variation", value: `${sd.toFixed(1)} semitones` },
        { label: "Range", value: `${round(range)} semitones` },
      ],
    },
  };
}

function originalitySection(words: Word[], script?: string): ReportSection {
  const title = "Reading from notes";
  const scriptWords = (script ?? "").split(/\s+/).map(normalize).filter(Boolean);
  if (scriptWords.length < MIN_SCRIPT_WORDS)
    return {
      key: "originality",
      title,
      verdict: "none",
      headline: "Paste your notes to check",
      advice: "",
      stats: [],
    };
  const grams = new Set<string>();
  for (let k = 0; k + VERBATIM_RUN <= scriptWords.length; k++)
    grams.add(scriptWords.slice(k, k + VERBATIM_RUN).join(" "));
  // Hesitations in the middle of a sentence don't make it any less read aloud.
  const said = words.map((w) => w.norm).filter((w) => !UM_FORMS.has(w) && !UH_FORMS.has(w));
  const read = new Array<boolean>(said.length).fill(false);
  for (let k = 0; k + VERBATIM_RUN <= said.length; k++)
    if (grams.has(said.slice(k, k + VERBATIM_RUN).join(" "))) read.fill(true, k, k + VERBATIM_RUN);
  let longest = 0;
  let run = 0;
  for (const r of read) {
    run = r ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  const share = said.length ? read.filter(Boolean).length / said.length : 0;
  const improve = share >= READING_SHARE;
  return {
    key: "originality",
    title,
    verdict: improve ? "improve" : "good",
    headline: improve
      ? `About ${pct(share)} matched your notes word for word`
      : share > 0
        ? `Mostly your own words (${pct(share)} matched your notes)`
        : "All in your own words",
    advice: improve
      ? "Talk around your notes instead of reading them. Keep the key points and say each one the way you’d explain it to a friend."
      : "You used your notes as a guide and didn’t read them out.",
    technique: improve ? TECHNIQUES.originality : undefined,
    share: { value: share, line: READING_SHARE, label: "Read word for word" },
    stats: [
      { label: "Word for word", value: pct(share) },
      { label: "Longest run read", value: plural(longest, "word") },
    ],
  };
}

function inclusiveSection(flags: InclusiveFlag[]): ReportSection {
  const total = flags.reduce((n, f) => n + f.count, 0);
  return {
    key: "inclusive",
    title: "Inclusive language",
    verdict: total ? "improve" : "good",
    headline: total ? `${plural(total, "term")} to reconsider` : "Nothing flagged",
    advice: total
      ? `Consider other words for “${flags[0].phrase}”${flags.length > 1 ? ` and ${plural(flags.length - 1, "other term")}` : ""}: some listeners hear them as dated or excluding.`
      : "No terms from Cue’s list came up.",
    technique: total ? TECHNIQUES.inclusive : undefined,
    stats: [],
  };
}
