import { modeRules, PRESENTATION, toApproxWpm, type CueConfig } from "./config";
import { suggestFillers } from "./customFillers";
import { isDisfluency, type TapRecord } from "./engine";
import { findInclusiveFlags, type InclusiveFlag } from "./inclusive";
import { normalize, UH_FORMS, UM_FORMS } from "./lexicon";
import { median } from "./loudness";
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

export interface ReportSection {
  key: SectionKey;
  title: string;
  /** "improve": something to work on. "good": nothing to change. "none": not enough to say. */
  verdict: Verdict;
  headline: string;
  advice: string;
  stats: { label: string; value: string }[];
}

export interface SessionReport {
  /** Seconds the wearer spent talking, counting their own short pauses. */
  talkSec: number;
  wordCount: number;
  sections: ReportSection[];
  /** Up to three things to work on next, most important first. */
  focus: string[];
  /** Live cues given, by cue. */
  cues: { pattern: CuePattern; action: string; count: number; worked: number; judged: number }[];
  /** Pace through the session, words per minute, for a small chart. */
  paceTimeline: { t: number; wpm: number }[];
  paceLimitWpm: number;
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

export function buildReport(input: ReportInput): SessionReport {
  const { words, config } = input;
  const talkSec = talkSeconds(words);
  const enough = talkSec >= MIN_TALK_SEC;
  const fillers = countFillers(input.history);
  const inclusive = findInclusiveFlags(words);
  const pace = paceSection(words, input.paceLimit, config, enough);
  const sections: ReportSection[] = [
    pauseSection(words, talkSec, config, enough),
    pace.section,
    volumeSection(words, input.levels, config),
    fillerSection(fillers, talkSec),
    pitchSection(words, input.pitch),
    originalitySection(words, input.script),
    inclusiveSection(inclusive),
  ];
  return {
    talkSec,
    wordCount: words.length,
    sections,
    focus: sections
      .filter((s) => s.verdict === "improve")
      .slice(0, 3)
      .map((s) => s.advice),
    cues: cueCounts(input.taps),
    paceTimeline: pace.timeline,
    paceLimitWpm: toApproxWpm(input.paceLimit),
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
      stats: [
        { label: "Average", value: `${round(avg)} wpm` },
        { label: "Fastest stretch", value: `${round(fastest)} wpm` },
        { label: "Time rushing", value: pct(fastShare) },
      ],
    },
  };
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

function volumeSection(words: Word[], levels: [number, number][], config: CueConfig): ReportSection {
  const title = "Volume";
  const speech = duringWords(levels, words);
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
    stats,
  };
}

function pitchSection(words: Word[], pitch: [number, number][]): ReportSection {
  const title = "Pitch and tone";
  const voiced = duringWords(pitch, words).map((p) => p[1]);
  if (voiced.length < MIN_PITCH_FRAMES)
    return {
      key: "pitch",
      title,
      verdict: "none",
      headline: "Needs a microphone session",
      advice: "",
      stats: [],
    };
  const typical = median(voiced);
  const st = voiced.map((hz) => semitones(hz, typical)).filter((x) => Math.abs(x) <= PITCH_OUTLIER);
  const mean = st.reduce((a, b) => a + b, 0) / st.length;
  const sd = Math.sqrt(st.reduce((a, b) => a + (b - mean) ** 2, 0) / st.length);
  const sorted = [...st].sort((a, b) => a - b);
  const range = sorted[Math.floor(sorted.length * 0.95)] - sorted[Math.floor(sorted.length * 0.05)];
  const flat = sd < FLAT_SEMITONES;
  return {
    key: "pitch",
    title,
    verdict: flat ? "improve" : "good",
    headline: flat ? "Your voice stayed fairly flat" : "Your pitch moved, which keeps people listening",
    advice: flat
      ? "Vary your voice. Let your pitch rise on questions and the points that matter, and drop at the end of a thought."
      : "Your voice rose and fell enough to sound engaged.",
    stats: [
      { label: "Typical pitch", value: `${round(typical)} Hz` },
      { label: "Variation", value: `${sd.toFixed(1)} semitones` },
      { label: "Range", value: `${round(range)} semitones` },
    ],
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
    stats: [],
  };
}
