import { toApproxWpm, type CueMode } from "@/lib/cue/config";
import { binomialTail, confidenceLevel, mean, median, signTest } from "./stats";
import type { Insight, SessionDigest } from "./types";

/**
 * Discover: patterns in the wearer's speech that hold up across sessions.
 *
 * Every pattern is a comparison made inside each session (fillers at the start of a turn vs the
 * rest of it, pace before a restart vs the session's usual pace, …) and then checked across
 * sessions with a sign test: it's reported only when at least three sessions have enough data
 * and nearly all of them point the same way, by a margin that matters. One unusual session can't
 * create a pattern, and a pattern that stops holding is marked stale rather than kept.
 */

/** Sessions with less talking than this (s) don't count as evidence. */
const MIN_TALK = 45;
/** A pattern needs at least this many sessions with data… */
const MIN_SESSIONS = 3;
/** …at least this share of them agreeing… */
const MIN_AGREE = 0.75;
/** …and a sign-test p-value no higher than this (3 of 3 is 0.125). */
const MAX_P = 0.13;
/** Typical conversational pace, syllables/s (about 150 words a minute). */
const TYPICAL_SPS = 3.5;
/** Patterns are judged on the most recent sessions, so old habits fade out. */
const RECENT = 12;

export interface Candidate {
  id: string;
  kind: string;
  statement: string;
  detail: string;
  p: number;
  sessions: number;
  combination?: boolean;
}

const wpm = (sps: number) => toApproxWpm(sps);
const MODE_NAME: Record<CueMode, string> = { conversation: "conversations", presentation: "presentations" };

/** Per-session pairs (a, b); counts sessions where a beats b by `ratio` (a > b × ratio). */
function compare(
  sessions: SessionDigest[],
  pick: (d: SessionDigest) => [number | null, number | null] | null,
  ratio: number,
) {
  const pairs = sessions
    .map(pick)
    .filter((x): x is [number, number] => !!x && x[0] !== null && x[1] !== null && Number.isFinite(x[0]) && Number.isFinite(x[1]));
  const agree = pairs.filter(([a, b]) => a > b * ratio || (b === 0 && a > 0.5)).length;
  return {
    n: pairs.length,
    agree,
    p: signTest(agree, pairs.length),
    a: mean(pairs.map((x) => x[0])),
    b: mean(pairs.map((x) => x[1])),
  };
}

const holds = (c: { n: number; agree: number; p: number }) =>
  c.n >= MIN_SESSIONS && c.agree / c.n >= MIN_AGREE && c.p <= MAX_P;

/** Pooled fillers that land in a window, across sessions, need at least this many… */
const MIN_POOLED = 6;
/** …and must bunch up there beyond chance (binomial test against the share of time it covers). */
const MAX_POOLED_P = 0.05;

/**
 * A filler pattern holds only if the per-session sign test agrees AND, pooling every session,
 * there are enough fillers in the window and more than its share of the time would give by
 * chance. A handful of fillers can make one session's rate look high; this stops that.
 */
function fillersBunch(sessions: SessionDigest[], pick: (d: SessionDigest) => [number, number] | null): boolean {
  let k = 0;
  let n = 0;
  let sec = 0;
  let total = 0;
  for (const d of sessions) {
    const c = pick(d);
    if (!c) continue;
    k += c[0];
    sec += c[1];
    n += d.fillers.total;
    total += d.talkSec;
  }
  if (k < MIN_POOLED || total <= 0) return false;
  return binomialTail(k, n, Math.min(0.95, sec / total)) <= MAX_POOLED_P;
}

const sessionsWord = (agree: number, n: number) => `${agree} of your last ${n} sessions`;

export function discoverPatterns(all: SessionDigest[]): Candidate[] {
  const sessions = all.filter((d) => d.talkSec >= MIN_TALK).slice(-RECENT);
  const out: Candidate[] = [];
  const add = (c: Candidate) => out.push(c);

  // Fillers when starting to answer: the first seconds of a turn vs the rest.
  {
    const c = compare(sessions, (d) => [d.fillers.turnStartRate, d.fillers.restRate], 1.3);
    if (holds(c) && fillersBunch(sessions, (d) => d.fillers.counts?.turnStart ?? null))
      add({
        id: "fillers_turn_start",
        kind: "fillers_turn_start",
        statement: "You use more filler words when you start answering than once you’re into your answer.",
        detail: `In ${sessionsWord(c.agree, c.n)}, the first few seconds of each turn had about ${c.a.toFixed(1)} fillers a minute, against ${c.b.toFixed(1)} for the rest.`,
        p: c.p,
        sessions: c.n,
      });
  }

  // Fillers when speeding up: a recurring combination.
  {
    const c = compare(sessions, (d) => [d.fillers.fastRate, d.fillers.normalRate], 1.3);
    if (holds(c) && fillersBunch(sessions, (d) => d.fillers.counts?.fast ?? null))
      add({
        id: "fillers_when_fast",
        kind: "fillers_when_fast",
        statement: "Your filler words come with speed: you use more of them when you speed up.",
        detail: `In ${sessionsWord(c.agree, c.n)}, you said about ${c.a.toFixed(1)} fillers a minute while faster than your usual pace, against ${c.b.toFixed(1)} at your normal pace.`,
        p: c.p,
        sessions: c.n,
        combination: true,
      });
  }

  // Speeding up just before repeating yourself: another combination.
  {
    const c = compare(sessions, (d) => (d.repetition.preN >= 2 ? [d.repetition.preSps, d.pace.medianSps] : null), 1.06);
    if (holds(c))
      add({
        id: "fast_before_repeat",
        kind: "fast_before_repeat",
        statement: "You tend to speak faster immediately before repeating yourself.",
        detail: `In ${sessionsWord(c.agree, c.n)}, the seconds before a restart ran at about ${wpm(c.a)} words a minute, against your usual ${wpm(c.b)}.`,
        p: c.p,
        sessions: c.n,
        combination: true,
      });
  }

  // Restarting sentences.
  {
    const rated = sessions.filter((d) => d.talkSec >= 90);
    const agree = rated.filter((d) => d.repetition.atStart / (d.talkSec / 60) >= 0.75).length;
    const p = signTest(agree, rated.length);
    if (rated.length >= MIN_SESSIONS && agree / rated.length >= MIN_AGREE && p <= MAX_P) {
      const perMin = mean(rated.map((d) => d.repetition.atStart / (d.talkSec / 60)));
      add({
        id: "repeat_starts",
        kind: "repeat_starts",
        statement: "You often repeat the beginning of sentences.",
        detail: `About ${perMin.toFixed(1)} times a minute, in ${sessionsWord(agree, rated.length)}, you said the first words of a sentence twice before carrying on.`,
        p,
        sessions: rated.length,
      });
    }
  }

  // Pace less steady in long explanations.
  {
    const c = compare(sessions, (d) => [d.pace.jitterLong, d.pace.jitterShort], 1.2);
    if (holds(c))
      add({
        id: "pace_jitter_long",
        kind: "pace_jitter_long",
        statement: "Your speaking pace becomes less consistent during longer explanations.",
        detail: `In ${sessionsWord(c.agree, c.n)}, your pace swung about ${Math.round((c.a / c.b - 1) * 100)}% more from moment to moment in turns over 30 seconds than in shorter ones.`,
        p: c.p,
        sessions: c.n,
      });
  }

  // Fillers creeping up later in a session.
  {
    const c = compare(sessions, (d) => [d.fillers.secondHalfRate, d.fillers.firstHalfRate], 1.3);
    if (holds(c) && fillersBunch(sessions, (d) => d.fillers.counts?.secondHalf ?? null))
      add({
        id: "fillers_later",
        kind: "fillers_later",
        statement: "Your filler words build up the longer you talk.",
        detail: `In ${sessionsWord(c.agree, c.n)}, the second half had about ${c.b > 0 ? `${Math.round((c.a / c.b - 1) * 100)}% more` : "more"} fillers than the first.`,
        p: c.p,
        sessions: c.n,
      });
  }

  for (const mode of ["conversation", "presentation"] as const) {
    const inMode = sessions.filter((d) => d.mode === mode);
    // Rushing the opening, then settling.
    const c = compare(inMode, (d) => [d.pace.openingSps, d.pace.restSps], 1.07);
    if (holds(c))
      add({
        id: `rush_opening:${mode}`,
        kind: "rush_opening",
        statement: `You tend to rush through the beginning of your ${MODE_NAME[mode]}, then settle into a steadier pace.`,
        detail: `In ${sessionsWord(c.agree, c.n)} ${MODE_NAME[mode]}, your first minute ran at about ${wpm(c.a)} words a minute, against ${wpm(c.b)} after it.`,
        p: c.p,
        sessions: c.n,
      });

    // A naturally fast (or slow) talker, against a typical pace.
    const paced = inMode.filter((d) => d.pace.samples >= 12 && d.pace.medianSps !== null);
    if (paced.length >= MIN_SESSIONS) {
      const fast = paced.filter((d) => d.pace.medianSps! > TYPICAL_SPS * 1.15).length;
      const slow = paced.filter((d) => d.pace.medianSps! < TYPICAL_SPS * 0.85).length;
      const m = median(paced.map((d) => d.pace.medianSps!));
      for (const [n, word] of [
        [fast, "faster"],
        [slow, "slower"],
      ] as const) {
        const p = signTest(n, paced.length);
        if (n / paced.length >= MIN_AGREE && p <= MAX_P)
          add({
            id: `natural_pace:${mode}`,
            kind: "natural_pace",
            statement: `You naturally speak ${word} than most people in ${MODE_NAME[mode]}.`,
            detail: `Your usual pace across ${paced.length} ${MODE_NAME[mode]} is about ${wpm(m)} words a minute; around 150 is typical.`,
            p,
            sessions: paced.length,
          });
      }
    }
  }

  // Differences between kinds of session: a mode or a context the wearer named, against the rest.
  const contextOf = (d: SessionDigest) => d.context ?? d.mode;
  const contexts = [...new Set(sessions.map(contextOf))];
  for (const ctx of contexts) {
    const inside = sessions.filter((d) => contextOf(d) === ctx);
    const outside = sessions.filter((d) => contextOf(d) !== ctx);
    if (inside.length < 2 || outside.length < 2) continue;
    const name = ctx === "conversation" || ctx === "presentation" ? MODE_NAME[ctx] : `${ctx}s`;
    const paceIn = inside.map((d) => d.pace.medianSps).filter((x): x is number => x !== null);
    const paceOut = outside.map((d) => d.pace.medianSps).filter((x): x is number => x !== null);
    if (paceIn.length >= 2 && paceOut.length >= 2) {
      const ref = mean(paceOut);
      const faster = paceIn.filter((x) => x > ref * 1.07).length;
      const n = paceIn.length + paceOut.length;
      // Each session on its own side of the line counts as agreeing.
      const agree = faster + paceOut.filter((x) => x <= mean(paceIn)).length;
      const p = signTest(agree, n);
      if (faster === paceIn.length && mean(paceIn) > ref * 1.07 && p <= MAX_P)
        add({
          id: `context_pace:${ctx}`,
          kind: "context_pace",
          statement: `You tend to speak faster during ${name}.`,
          detail: `Every one of your ${paceIn.length} ${name} ran faster than your other sessions: about ${wpm(mean(paceIn))} words a minute, against ${wpm(ref)}.`,
          p,
          sessions: n,
        });
    }
    const fillIn = inside.map((d) => d.fillers.perMin).filter((x): x is number => x !== null);
    const fillOut = outside.map((d) => d.fillers.perMin).filter((x): x is number => x !== null);
    if (fillIn.length >= 2 && fillOut.length >= 2) {
      const ref = mean(fillOut);
      const more = fillIn.filter((x) => x > ref * 1.4 && x - ref >= 1).length;
      const n = fillIn.length + fillOut.length;
      const agree = more + fillOut.filter((x) => x <= mean(fillIn)).length;
      const p = signTest(agree, n);
      if (more === fillIn.length && p <= MAX_P)
        add({
          id: `context_fillers:${ctx}`,
          kind: "context_fillers",
          statement: `You use more filler words during ${name}.`,
          detail: `About ${mean(fillIn).toFixed(1)} a minute across your ${fillIn.length} ${name}, against ${ref.toFixed(1)} in your other sessions.`,
          p,
          sessions: n,
        });
    }
  }

  // The most common filler, once there are enough of them to say.
  {
    const totals = new Map<string, number>();
    for (const d of sessions) for (const [w, n] of Object.entries(d.fillers.byWord)) totals.set(w, (totals.get(w) ?? 0) + n);
    const sum = [...totals.values()].reduce((a, b) => a + b, 0);
    const [top, count] = [...totals].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
    const withFillers = sessions.filter((d) => d.fillers.total >= 2);
    const topIn = withFillers.filter((d) => {
      const best = Object.entries(d.fillers.byWord).sort((a, b) => b[1] - a[1])[0];
      return best && best[0] === top;
    }).length;
    if (sum >= 10 && withFillers.length >= 2 && count / sum >= 0.35 && topIn / withFillers.length >= 0.66)
      add({
        id: "top_filler",
        kind: "top_filler",
        statement: `Your most common filler word is “${top}”.`,
        detail: `${Math.round((count / sum) * 100)}% of the ${sum} fillers Cue heard across ${withFillers.length} sessions, and the top one in ${topIn} of them.`,
        p: signTest(topIn, withFillers.length),
        sessions: withFillers.length,
      });
  }

  // A phrase the wearer leans on, session after session.
  {
    const seen = new Map<string, { sessions: number; count: number }>();
    for (const d of sessions)
      for (const ph of d.phrases) {
        const s = seen.get(ph.phrase) ?? { sessions: 0, count: 0 };
        seen.set(ph.phrase, { sessions: s.sessions + 1, count: s.count + ph.count });
      }
    const best = [...seen].filter(([, s]) => s.sessions >= MIN_SESSIONS).sort((a, b) => b[1].count - a[1].count)[0];
    if (best && best[1].sessions / sessions.length >= 0.6)
      add({
        id: `habit_phrase:${best[0]}`,
        kind: "habit_phrase",
        statement: `You often say “${best[0]}”.`,
        detail: `${best[1].count} times across ${best[1].sessions} sessions. If it’s a habit rather than a choice, add it to your filler words.`,
        p: signTest(best[1].sessions, sessions.length),
        sessions: best[1].sessions,
      });
  }

  return out;
}

/** Fold new candidates into the stored insights: new ones appear, old ones strengthen, fade or stay corrected. */
export function mergeInsights(
  existing: Insight[],
  found: Candidate[],
  at: string,
): { insights: Insight[]; fresh: Insight[]; strengthened: Insight[] } {
  const fresh: Insight[] = [];
  const strengthened: Insight[] = [];
  const byId = new Map(existing.map((i) => [i.id, i]));
  const insights: Insight[] = existing.map((i) => ({ ...i, stale: !found.some((c) => c.id === i.id) }));
  for (const c of found) {
    const level = confidenceLevel(c.p);
    const next = {
      kind: c.kind,
      statement: c.statement,
      detail: c.detail,
      confidence: Math.round((1 - c.p) * 100) / 100,
      level,
      sessions: c.sessions,
      combination: !!c.combination,
      updatedAt: at,
      stale: false,
    };
    const old = byId.get(c.id);
    if (!old) {
      const ins: Insight = { id: c.id, firstSeen: at, status: "active", ...next };
      insights.push(ins);
      fresh.push(ins);
      continue;
    }
    const k = insights.findIndex((i) => i.id === c.id);
    insights[k] = { ...old, ...next };
    if (old.level !== "strong" && level === "strong" && old.status !== "rejected") strengthened.push(insights[k]);
  }
  return { insights, fresh, strengthened };
}
