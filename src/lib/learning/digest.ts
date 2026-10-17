import type { CueMode } from "@/lib/cue/config";
import { isDisfluency, type TapRecord } from "@/lib/cue/engine";
import { normalize, UH_FORMS, UM_FORMS } from "@/lib/cue/lexicon";
import { measurePace } from "@/lib/cue/pace";
import { COACHED, defaultPlan, FOCUS_BEHAVIOR, type CoachingPlan } from "@/lib/cue/plan";
import type { BehaviorType, CueDecision, Word } from "@/lib/cue/types";
import { mean, median } from "./stats";
import type { InterventionRecord, SessionDigest, SessionSource } from "./types";

/**
 * Observe: turn one finished session into a digest of numbers (and the wearer's filler words and
 * a few short habit phrases). The words themselves are dropped once this has run; nothing here
 * needs audio.
 */

/** A gap (s) between words that counts as a real pause (the line the live engine uses). */
const PAUSE = 0.6;
/** A gap (s) that ends a speaking turn. */
const TURN_GAP = 2.5;
/** Pace is sampled this often (s) over a window this long (s), as in the report. */
const STEP = 5;
const WINDOW = 8;
/** The opening of a turn, where an answer starts (s). */
const TURN_OPENING = 6;
/** Faster than this many times the session's median counts as "faster than usual". */
const FAST = 1.1;
/** The opening of a session, for "rushes the beginning" (s of talk). */
const OPENING = 60;

const FILLER_WORD: Partial<Record<BehaviorType, string>> = {
  filler_um: "um",
  filler_uh: "uh",
  filler_like: "like",
  filler_lowkey: "lowkey",
};

/** Words that are often doubled on purpose ("very very", "no no"), so a double isn't a restart. */
const DOUBLES_OK = new Set(
  "very really so no yeah yes bye ha that had much more many far long well knock tick go bang".split(" "),
);
const STOPWORDS = new Set(
  "a an the and or but so to of in on at for with is was are were be been it its it's i you we they he she this that these those my your our their me us them do did does have has had not just then there here what when where how why who if as by from up out about into than too also can could would should will".split(
    " ",
  ),
);

export interface DigestInput {
  id: string;
  at: string;
  source: SessionSource;
  mode: CueMode;
  context?: string | null;
  /** The wearer's words, in order. */
  words: Word[];
  /** Every decision the session made. */
  history: CueDecision[];
  /** Every tap that was due, including holdouts (`CueSession.engineRecords()`). */
  records: TapRecord[];
  /** The rushing limit the session ended with (syllables/s). */
  paceLimit: number;
  /** Seconds without a pause before Cue would tap. */
  noPauseLimit: number;
  plan: CoachingPlan | null;
}

const isFillerWord = (w: Word) => UM_FORMS.has(w.norm) || UH_FORMS.has(w.norm);

export function digestSession(input: DigestInput): { digest: SessionDigest; interventions: InterventionRecord[] } {
  const words = input.words;
  const plan = input.plan ?? defaultPlan();
  const modePlan = plan.modes[input.mode];
  const t0 = words[0]?.start ?? 0;
  const talkSec = talkSeconds(words);
  const minutes = talkSec / 60;

  // --- Pace -----------------------------------------------------------------
  const samples = paceSamples(words, STEP, WINDOW);
  const sps = samples.map((s) => s.sps);
  const medianSps = sps.length ? median(sps) : null;
  const rushShare = sps.length ? sps.filter((x) => x > input.paceLimit).length / sps.length : null;
  let openingSps: number | null = null;
  let restSps: number | null = null;
  if (talkSec >= 150 && samples.length >= 20) {
    const cut = t0 + OPENING;
    const open = samples.filter((s) => s.t <= cut).map((s) => s.sps);
    const rest = samples.filter((s) => s.t > cut).map((s) => s.sps);
    if (open.length >= 5 && rest.length >= 8) {
      openingSps = median(open);
      restSps = median(rest);
    }
  }

  // --- Turns, stretches and pauses ---------------------------------------------
  const turns = split(words, TURN_GAP);
  const stretches = split(words, PAUSE);
  const gaps: number[] = [];
  for (let k = 1; k < words.length; k++) {
    const g = words[k].start - words[k - 1].end;
    if (g >= PAUSE && g < TURN_GAP) gaps.push(g);
  }
  const stretchLens = stretches.map((s) => s.end - s.start);
  const overLimit = stretchLens.reduce((n, len) => n + Math.max(0, len - input.noPauseLimit), 0);

  // Pace steadiness within long turns (an explanation) vs shorter ones.
  const jitter = (min: number, max: number) => {
    const diffs: number[] = [];
    for (const turn of turns.filter((t) => t.end - t.start >= min && t.end - t.start < max)) {
      const tw = words.slice(turn.from, turn.to + 1);
      const ts = paceSamples(tw, 2.5, 5).map((s) => s.sps);
      for (let k = 1; k < ts.length; k++) diffs.push(Math.abs(ts[k] - ts[k - 1]));
    }
    return diffs.length >= 6 ? mean(diffs) : null;
  };

  // --- Fillers ----------------------------------------------------------------
  const fillerEvents = input.history.filter(
    (d) =>
      isDisfluency(d.event.type) && d.withheldReason !== "low_confidence" && d.withheldReason !== "category_off",
  );
  const byWord: Record<string, number> = {};
  for (const d of fillerEvents) {
    const w = d.event.phrase ?? FILLER_WORD[d.event.type] ?? "filler";
    byWord[w] = (byWord[w] ?? 0) + 1;
  }
  const fillerTimes = fillerEvents.map((d) => d.event.start);
  const rate = (n: number, sec: number) => (sec >= 20 ? n / (sec / 60) : null);

  const counts: SessionDigest["fillers"]["counts"] = { turnStart: null, fast: null, secondHalf: null };
  let turnStartRate: number | null = null;
  let restRate: number | null = null;
  const openings = turns.filter((t) => t.end - t.start >= TURN_OPENING + 2);
  if (openings.length >= 3) {
    const inOpening = (t: number) => openings.some((o) => t >= o.start && t < o.start + TURN_OPENING);
    const openingSec = openings.length * TURN_OPENING;
    const n = fillerTimes.filter(inOpening).length;
    turnStartRate = rate(n, openingSec);
    restRate = rate(fillerTimes.length - n, talkSec - openingSec);
    counts.turnStart = [n, openingSec];
  }

  let fastRate: number | null = null;
  let normalRate: number | null = null;
  if (medianSps !== null && samples.length >= 8) {
    const fastAt = (t: number) => {
      const s = samples.find((x) => x.t >= t) ?? samples[samples.length - 1];
      return s.sps > medianSps * FAST;
    };
    const fastSec = samples.filter((s) => s.sps > medianSps * FAST).length * STEP;
    const normalSec = samples.length * STEP - fastSec;
    const nFast = fillerTimes.filter(fastAt).length;
    fastRate = rate(nFast, fastSec);
    normalRate = rate(fillerTimes.length - nFast, normalSec);
    if (fastSec + normalSec > 0) counts.fast = [nFast, (fastSec / (fastSec + normalSec)) * talkSec];
  }

  let firstHalfRate: number | null = null;
  let secondHalfRate: number | null = null;
  if (talkSec >= 120) {
    const mid = (t0 + (words.at(-1)?.end ?? t0)) / 2;
    const firstSec = talkSeconds(words.filter((w) => w.end <= mid));
    firstHalfRate = rate(fillerTimes.filter((t) => t < mid).length, firstSec);
    secondHalfRate = rate(fillerTimes.filter((t) => t >= mid).length, talkSec - firstSec);
    counts.secondHalf = [fillerTimes.filter((t) => t >= mid).length, talkSec - firstSec];
  }

  // --- Repetition ---------------------------------------------------------------
  const restarts = findRestarts(words);
  const pre = restarts.map((r) => r.preSps).filter((x): x is number => x !== null);

  // --- Interventions -------------------------------------------------------------
  const focusBehavior = plan.focus ? FOCUS_BEHAVIOR[plan.focus] : null;
  const interventions: InterventionRecord[] = input.records.map((r) => ({
    sessionId: input.id,
    at: Math.round((r.at - t0) * 10) / 10,
    behavior: r.behavior,
    strategy: r.strategy,
    holdout: !!r.holdout,
    outcome: r.outcome ?? null,
    pre: r.pre ?? null,
    post: r.post ?? null,
    focus: r.behavior === focusBehavior,
    intensity: plan.intensity,
  }));

  const digest: SessionDigest = {
    id: input.id,
    at: input.at,
    source: input.source,
    mode: input.mode,
    context: input.context ?? null,
    talkSec: Math.round(talkSec),
    wordCount: words.length,
    pace: {
      medianSps,
      samples: samples.length,
      limitSps: input.paceLimit,
      rushShare,
      openingSps,
      restSps,
      jitterLong: jitter(30, Infinity),
      jitterShort: jitter(8, 30),
    },
    fillers: {
      total: fillerEvents.length,
      perMin: minutes >= 0.5 ? fillerEvents.length / minutes : null,
      byWord,
      turnStartRate,
      restRate,
      fastRate,
      normalRate,
      firstHalfRate,
      secondHalfRate,
      counts,
    },
    pauses: {
      perMin: minutes >= 0.5 ? gaps.length / minutes : null,
      medianSec: gaps.length >= 3 ? median(gaps) : null,
      longestStretchSec: stretchLens.length ? Math.max(...stretchLens) : 0,
      overLimitShare: talkSec > 0 ? overLimit / talkSec : 0,
    },
    turns: { count: turns.length, medianSec: turns.length ? median(turns.map((t) => t.end - t.start)) : null },
    repetition: {
      restarts: restarts.length,
      perMin: minutes >= 0.5 ? restarts.length / minutes : null,
      atStart: restarts.filter((r) => r.atStart).length,
      preSps: pre.length ? mean(pre) : null,
      preN: pre.length,
    },
    phrases: habitPhrases(words),
    plan: {
      focus: plan.focus,
      strategies: Object.fromEntries(
        COACHED.map((b) => [b, modePlan.behaviors[b].strategy]),
      ) as SessionDigest["plan"]["strategies"],
      paceBaselineSps: modePlan.paceBaselineSps,
    },
    taps: input.records.filter((r) => !r.holdout).length,
    feedback: {},
  };
  return { digest, interventions };
}

/** Seconds of talking: words plus gaps shorter than a turn break. */
export function talkSeconds(words: Word[]): number {
  let total = 0;
  for (let k = 0; k < words.length; k++) {
    total += words[k].end - words[k].start;
    const gap = k + 1 < words.length ? words[k + 1].start - words[k].end : 0;
    if (gap > 0 && gap < TURN_GAP) total += gap;
  }
  return total;
}

/** Pace every `step` seconds over a trailing `window`, skipping long silences. */
function paceSamples(words: Word[], step: number, window: number): { t: number; sps: number }[] {
  const out: { t: number; sps: number }[] = [];
  if (words.length < 6) return out;
  let idx = 0;
  const end = words[words.length - 1].end;
  for (let t = words[0].start + window; t <= end + step; t += step) {
    while (idx < words.length && words[idx].end <= t) idx++;
    if (idx === 0 || t - words[idx - 1].end > TURN_GAP) continue;
    const p = measurePace(words.slice(Math.max(0, idx - 60), idx), window);
    if (p) out.push({ t, sps: p.sps });
  }
  return out;
}

/** Runs of words separated by gaps of at least `gap` seconds. */
function split(words: Word[], gap: number): { from: number; to: number; start: number; end: number }[] {
  const out: { from: number; to: number; start: number; end: number }[] = [];
  if (!words.length) return out;
  let from = 0;
  for (let k = 1; k <= words.length; k++) {
    if (k < words.length && words[k].start - words[k - 1].end < gap) continue;
    out.push({ from, to: k - 1, start: words[from].start, end: words[k - 1].end });
    from = k;
  }
  return out;
}

/**
 * Immediate restarts: one to three words said and then said again straight away ("I think I
 * think", "and then and then"). Doubles people use on purpose ("very very") don't count.
 */
export function findRestarts(words: Word[]): { start: number; atStart: boolean; preSps: number | null }[] {
  const out: { start: number; atStart: boolean; preSps: number | null }[] = [];
  const norm = words.map((w) => normalize(w.norm));
  for (let i = 0; i < words.length; i++) {
    for (let k = 3; k >= 1; k--) {
      if (i + 2 * k > words.length) continue;
      const a = norm.slice(i, i + k);
      const b = norm.slice(i + k, i + 2 * k);
      if (a.join(" ") !== b.join(" ") || a.some((x) => !x)) continue;
      if (words.slice(i, i + 2 * k).some(isFillerWord)) continue;
      if (k === 1 && DOUBLES_OK.has(a[0])) continue;
      if (words[i + k].start - words[i + k - 1].end > 1) continue;
      const before = words.filter((w) => w.start >= words[i].start - 4 && w.end <= words[i + k - 1].end);
      const p = measurePace(before, Infinity);
      const gapBefore = i === 0 ? Infinity : words[i].start - words[i - 1].end;
      out.push({
        start: words[i + k].start,
        atStart: gapBefore >= PAUSE || /[.?!]$/.test(words[i - 1]?.text ?? "."),
        preSps: p?.sps ?? null,
      });
      i += 2 * k - 1;
      break;
    }
  }
  return out;
}

/** Two- to four-word phrases said three or more times, other than fillers and stock function words. */
function habitPhrases(words: Word[]): { phrase: string; count: number }[] {
  const norms = words.filter((w) => !isFillerWord(w)).map((w) => w.norm);
  const counts = new Map<string, number>();
  for (let n = 2; n <= 4; n++)
    for (let i = 0; i + n <= norms.length; i++) {
      const gram = norms.slice(i, i + n);
      if (gram.every((g) => STOPWORDS.has(g)) || new Set(gram).size === 1) continue;
      const key = gram.join(" ");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  const kept = [...counts].filter(([, c]) => c >= 3).sort((a, b) => b[0].split(" ").length - a[0].split(" ").length);
  const out: { phrase: string; count: number }[] = [];
  for (const [phrase, count] of kept) {
    // A shorter phrase inside a kept longer one with the same count says nothing new.
    if (out.some((o) => o.phrase.includes(phrase) && o.count >= count)) continue;
    out.push({ phrase, count });
  }
  return out.sort((a, b) => b.count - a.count).slice(0, 5);
}
