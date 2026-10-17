import { DEFAULT_CONFIG, type CueConfig, type CueMode } from "@/lib/cue/config";
import { normalize } from "@/lib/cue/lexicon";
import type { CoachingPlan } from "@/lib/cue/plan";
import { CueSession } from "@/lib/cue/session";
import type { CueDecision, Word } from "@/lib/cue/types";
import { emptyProfile } from "./learn";
import { finishSession } from "./live";
import { seededRandom } from "./stats";
import type { CueUpdate, Profile, Rating } from "./types";

/**
 * Simulated speakers, for tests and for the practice sandbox in the app. A simulated speaker
 * talks through a real `CueSession` word by word and reacts to its taps according to a stated
 * model (how often a tap makes them slow down, and how that wears off when taps come too often).
 *
 * This is a model of a person, not evidence about people: it exists to show what Cue's learning
 * does when a wearer behaves a certain way. Results here say nothing about real users.
 */

export interface SpeakerModel {
  name: string;
  normalWpm: number;
  /** Rushing episodes: their lengths (s), cycled, starting every `burstEvery` seconds. */
  burstWpm: number;
  bursts: number[];
  burstEvery: number;
  /** Chance a rushing episode ends early on its own, without a tap. */
  spontaneousCalm: number;
  fillerPerMin: number;
  /** Fillers are this many times likelier while rushing, and at the start of a turn. */
  fillerWhenFast: number;
  fillerAtTurnStart: number;
  /** A turn ends (3 s of silence, as if someone else spoke) about this often (s). */
  turnEvery: number;
  restartPerMin: number;
  restartWhenFast: number;
  /** Chance a slow-down tap makes them slow down, given seconds since the previous one. */
  respondToPace: (sinceLastTap: number) => number;
  /** Chance a pause tap after a filler run stops the fillers for a while. */
  respondToFillers: number;
  /** Sentence-end pause (s). Shorter means fewer real pauses. */
  sentenceGap: number;
}

const CORPUS = [
  "we spent most of the week planning the launch with the whole team.",
  "the hardest part was deciding what to leave out of the first version.",
  "our customers kept asking for a simpler way to share their results.",
  "so we built a small prototype and tested it with twelve people.",
  "most of them understood it right away, which was a good sign.",
  "a few of them got stuck on the settings screen, so we changed it.",
  "next month we want to try it with a bigger group in two cities.",
  "the budget is tight, but the plan is realistic if we stay focused.",
  "i think the most important thing is to listen to the early feedback.",
  "after that we can decide whether to grow the team or the product first.",
];

export const SPEAKERS = {
  /** Naturally quick (about 215 words a minute) and steady: fast is simply their normal. */
  quickTalker: {
    name: "A naturally quick talker",
    normalWpm: 215,
    burstWpm: 215,
    bursts: [0],
    burstEvery: 1e9,
    spontaneousCalm: 0,
    fillerPerMin: 1,
    fillerWhenFast: 1,
    fillerAtTurnStart: 1,
    turnEvery: 40,
    restartPerMin: 0.3,
    restartWhenFast: 1,
    respondToPace: () => 0.5,
    respondToFillers: 0.5,
    sentenceGap: 0.8,
  },
  /**
   * Speeds up in bursts, short and long. Slow-down taps that come often (within 80 s of the
   * last) stop registering: about 1 in 7 works; occasional ones work well (7 in 10). Fillers come with speed and at
   * the start of a turn, and so do restarts.
   */
  burstyRusher: {
    name: "Rushes in bursts; frequent taps stop registering",
    normalWpm: 165,
    burstWpm: 255,
    bursts: [10, 24],
    burstEvery: 45,
    spontaneousCalm: 0.2,
    fillerPerMin: 2,
    fillerWhenFast: 3,
    fillerAtTurnStart: 3,
    turnEvery: 30,
    restartPerMin: 0.4,
    restartWhenFast: 3,
    respondToPace: (since: number) => (since < 80 ? 0.15 : 0.7),
    respondToFillers: 0.6,
    sentenceGap: 0.8,
  },
} satisfies Record<string, SpeakerModel>;

export interface SimulatedSession {
  session: CueSession;
  decisions: CueDecision[];
  words: Word[];
}

/** Speak for `seconds` through a session coached with `plan`, reacting to its taps. */
export function speak(
  model: SpeakerModel,
  opts: { seconds: number; seed: number; plan: CoachingPlan | null; mode?: CueMode; config?: Partial<CueConfig> },
): SimulatedSession {
  const rand = seededRandom(opts.seed);
  // Cue's holdout choices get their own random stream, so the speech doesn't depend on them.
  const session = new CueSession(
    { ...DEFAULT_CONFIG, mode: opts.mode ?? "conversation", paceMode: opts.mode ?? "conversation", ...opts.config },
    { plan: opts.plan, random: seededRandom(opts.seed * 7919 + 1) },
  );
  const words: Word[] = [];
  const decisions: CueDecision[] = [];
  let t = 0;
  let burstIdx = 0;
  let nextBurst = model.burstEvery * 0.6;
  let burstEnd = -1;
  let lastPaceTap = -Infinity;
  let calmFillersUntil = -1;
  let nextTurn = model.turnEvery;
  let turnStart = 0;
  let sentence = 0;
  let token = 0;
  const tokens = () => CORPUS[sentence % CORPUS.length].split(" ");

  const push = (text: string, wpm: number, gapAfter: number) => {
    const per = 60 / wpm;
    const w: Word = { text, norm: normalize(text), start: t, end: t + per * 0.8, confidence: 0.95 };
    words.push(w);
    t += per + gapAfter;
    const u = session.ingest([w], true);
    for (const d of u.decisions) {
      decisions.push(d);
      if (!d.delivered) continue;
      if (d.event.type === "rushing") {
        if (burstEnd > t && rand() < model.respondToPace(t - lastPaceTap)) burstEnd = Math.min(burstEnd, t + 1.5);
        lastPaceTap = t;
      } else if (d.event.type.startsWith("filler_") && rand() < model.respondToFillers) calmFillersUntil = t + 25;
    }
  };

  while (t < opts.seconds) {
    if (t >= nextBurst) {
      const len = model.bursts[burstIdx++ % model.bursts.length];
      burstEnd = t + (rand() < model.spontaneousCalm ? len * (0.3 + 0.4 * rand()) : len);
      nextBurst += model.burstEvery;
    }
    const fast = t < burstEnd;
    const wpm = fast ? model.burstWpm : model.normalWpm;
    const wordsPerMin = wpm;
    // Fillers.
    let fillerP = model.fillerPerMin / wordsPerMin;
    if (fast) fillerP *= model.fillerWhenFast;
    if (t - turnStart < 6) fillerP *= model.fillerAtTurnStart;
    if (t < calmFillersUntil) fillerP *= 0.2;
    if (rand() < fillerP) push(rand() < 0.6 ? "um," : "uh,", wpm, 0.15);
    const toks = tokens();
    const text = toks[token];
    // Restarts: say the next two words twice.
    let restartP = model.restartPerMin / wordsPerMin;
    if (fast) restartP *= model.restartWhenFast;
    if (token + 1 < toks.length && token > 0 && rand() < restartP) {
      push(toks[token], wpm, 0.05);
      push(toks[token + 1].replace(/[.,]$/, ""), wpm, 0.1);
    }
    const end = token === toks.length - 1;
    push(text, wpm, end ? model.sentenceGap : 0);
    token++;
    if (end) {
      token = 0;
      sentence++;
      if (t >= nextTurn) {
        session.endUtterance();
        t += 3;
        turnStart = t;
        nextTurn = t + model.turnEvery * (0.7 + 0.6 * rand());
      }
    }
  }
  const u = session.endUtterance();
  decisions.push(...u.decisions);
  return { session, decisions, words };
}

export interface SimulatedRun {
  profile: Profile;
  sessions: {
    index: number;
    taps: Record<string, number>;
    holdouts: number;
    plan: CoachingPlan;
    update: CueUpdate | null;
  }[];
}

/**
 * Several sessions in a row by one simulated speaker, learning after each. `rate` decides how
 * the simulated wearer rates each kind of tap after a session (or doesn't).
 */
export function simulateSessions(
  model: SpeakerModel,
  opts: {
    count: number;
    seconds?: number;
    seed?: number;
    profile?: Profile;
    mode?: CueMode;
    start?: Date;
    rate?: (s: { index: number; taps: Record<string, number> }) => Partial<Record<"rushing" | "fillers" | "no_pause", Rating>>;
    sameSpeech?: boolean;
  },
  rateCues?: (p: Profile, sessionId: string, b: "rushing" | "fillers" | "no_pause", r: Rating, at: string) => { profile: Profile; update: CueUpdate | null },
): SimulatedRun {
  const start = opts.start ?? new Date("2026-10-01T18:00:00Z");
  let profile = opts.profile ?? emptyProfile(start.toISOString());
  const out: SimulatedRun["sessions"] = [];
  for (let k = 0; k < opts.count; k++) {
    const plan = structuredClone(profile.plan);
    const sim = speak(model, {
      seconds: opts.seconds ?? 240,
      seed: (opts.seed ?? 1) + (opts.sameSpeech ? 0 : k * 101),
      plan,
      mode: opts.mode,
    });
    const at = new Date(start.getTime() + k * 86400000 * 1.5).toISOString();
    const res = finishSession(profile, sim.session, { id: `sim-${at}`, at, source: "simulated" });
    profile = res.profile;
    let update = res.update;
    const taps: Record<string, number> = {};
    for (const r of sim.session.engineRecords()) if (!r.holdout) taps[r.behavior] = (taps[r.behavior] ?? 0) + 1;
    const holdouts = sim.session.engineRecords().filter((r) => r.holdout).length;
    const ratings = opts.rate?.({ index: k, taps }) ?? {};
    for (const [b, r] of Object.entries(ratings)) {
      if (!rateCues || !r) continue;
      const rr = rateCues(profile, res.digest.id, b as "rushing", r, at);
      profile = rr.profile;
      update = rr.update ?? update;
    }
    out.push({ index: k, taps, holdouts, plan, update });
  }
  return { profile, sessions: out };
}
