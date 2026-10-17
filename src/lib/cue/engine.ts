import { modeRules, PRESENTATION, isPresentation, type CueConfig } from "./config";
import { behaviorOf, SUSTAINED_RETAP_SCALE, type CoachedBehavior, type ModePlan, type Strategy } from "./plan";
import type { BehaviorType, CueDecision, SpeechEvent } from "./types";

/**
 * The behavioral decision engine (SOFTWARE.md §12–14). Detectors report what they
 * notice; the engine decides whether a tap would help *right now*:
 *
 *  - Fillers only tap as a pattern: a cluster
 *    (3 within 12 s) or a high rate (8+ in the last minute), not one at a time (§7).
 *  - Sustained behaviors (rushing, no pause, long turn, too quiet) wait for a natural
 *    break in speech, up to a few seconds (one second for rushing), so the tap doesn't land
 *    mid-word (§12).
 *  - One tap at a time: a 10–20 s cooldown after any tap (§13). Presentation mode is sparser
 *    (decision 11): 25 s between taps, at most 2 a minute, fillers judged as a rate, and long
 *    turns left for the review.
 *  - Only confident detections count (§14).
 *  - It checks whether each tap worked (the user paused, slowed, spoke up); if it did,
 *    it waits longer before tapping for that behavior again (§13, §17).
 *  - With a personal coaching plan (`plan.ts`, written by continuous learning), each behavior can
 *    be switched off at the wearer's request, tapped less often, coached with another strategy,
 *    and, now and then, held back on purpose (a "holdout") so Cue can tell whether its taps help
 *    or whether the wearer would have corrected course anyway.
 */

export type TapReason =
  "filler" | "filler_cluster" | "filler_density" | "rushing" | "no_pause" | "long_turn" | "too_quiet";
export type Outcome = "worked" | "no_change";

export interface TapRecord {
  id: string;
  reason: TapReason;
  at: number;
  outcome?: Outcome;
  behavior: CoachedBehavior;
  strategy: Strategy;
  /** True when the tap was due but held back on purpose, to compare against real taps. */
  holdout?: boolean;
  /**
   * The behavior's measure just before the tap and once its outcome was judged: pace in
   * syllables/s for rushing, fillers in the last 30 s, seconds without a pause, turn length in
   * seconds, or speaking level in dBFS.
   */
  pre?: number;
  post?: number;
}

export const DISFLUENCIES: BehaviorType[] = ["filler_um", "filler_uh", "filler_like", "filler_lowkey", "filler_custom"];
export const isDisfluency = (t: BehaviorType) => DISFLUENCIES.includes(t);

const CATEGORY: Record<BehaviorType, keyof CueConfig["categories"]> = {
  filler_um: "um",
  filler_uh: "uh",
  filler_like: "like",
  filler_lowkey: "lowkey",
  filler_custom: "custom",
  rushing: "rushing",
  no_pause: "pauses",
  long_turn: "turns",
  too_quiet: "quiet",
};

/** A tap that worked earns this much extra patience before tapping for the same thing. */
const WORKED_PATIENCE = 2;
/** In "every filler" testing mode, the cooldown is capped at this. */
const EVERY_FILLER_COOLDOWN = 1.5;
/** A sustained behavior waits at most this long (s) for a break in speech. */
const MAX_WAIT_FOR_BREAK = 3;
/** Rushing waits less: someone racing ahead is the speaker least likely to leave a break. */
const MAX_WAIT_FOR_BREAK_RUSHING = 1;
/** The rate window for filler density, seconds. */
const DENSITY_WINDOW = 60;
/** Fillers counted this far back (s) to describe the speech just before a filler tap. */
const PRE_FILLER_WINDOW = 30;

export interface Moment {
  /** Engine-clock time of the latest speech. */
  now: number;
  /** True when the speaker is at a natural break (a pause has started or a word just ended a phrase). */
  atBreak: boolean;
}

export class DecisionEngine {
  /** Every tap that was due: delivered taps and holdouts, in order. */
  readonly records: TapRecord[] = [];
  private evidence: { t: number; weight: number }[] = []; // counted disfluencies
  private evidenceSince = -Infinity; // disfluencies before the last pattern tap don't count again
  private lastTapAt = -Infinity;
  private lastTapByReason = new Map<TapReason, TapRecord>();
  private lastTapByBehavior = new Map<CoachedBehavior, number>();
  /** Per sustained behavior: when its current episode started waiting, and whether it's been handled. */
  private episodes = new Map<BehaviorType, { waitingSince: number; handledAt: number | null; loggedHold: boolean }>();

  constructor(
    private config: () => CueConfig,
    private plan: () => ModePlan | null = () => null,
    private random: () => number = Math.random,
  ) {}

  /** Taps actually delivered (holdouts left out). */
  get taps(): TapRecord[] {
    return this.records.filter((t) => !t.holdout);
  }

  private behaviorPlan(b: CoachedBehavior) {
    return this.plan()?.behaviors[b] ?? null;
  }

  /** The strategy in use for a behavior: the plan's, or the default. */
  strategyFor(b: CoachedBehavior): Strategy {
    return this.behaviorPlan(b)?.strategy ?? (b === "rushing" ? "prompt" : b === "fillers" ? "cluster" : "standard");
  }

  /** A disfluency was detected. Returns its decision: tapped as a pattern, or held. */
  considerDisfluency(event: SpeechEvent, m: Moment): CueDecision {
    const c = this.config();
    const held = this.gate(event);
    if (held) return { event, delivered: false, withheldReason: held };
    const soft = event.type !== "filler_um" && event.type !== "filler_uh";
    this.evidence.push({ t: event.end, weight: soft ? PRESENTATION.softFillerWeight : 1 });

    let reason: TapReason | null = null;
    let why = "";
    if (c.tapOn === "every") {
      reason = "filler";
    } else if (isPresentation(c)) {
      // Presentation (decision 11): a rate, not clusters; um/uh weigh more than "like"/"lowkey".
      const rate = this.evidence
        .filter((e) => e.t > this.evidenceSince && e.t >= m.now - DENSITY_WINDOW)
        .reduce((n, e) => n + e.weight, 0);
      const shown = Number.isInteger(rate) ? `${rate}` : rate.toFixed(1);
      if (rate > PRESENTATION.fillerRatePerMin) {
        reason = "filler_density";
        why = `${shown} in the last minute`;
      } else {
        return {
          event,
          delivered: false,
          withheldReason: "not_a_pattern",
          trigger: `${shown} of more than ${PRESENTATION.fillerRatePerMin} per minute`,
        };
      }
    } else {
      const counted = this.evidence.filter((e) => e.t > this.evidenceSince).map((e) => e.t);
      const inCluster = counted.filter((t) => t >= m.now - c.clusterWindowSec);
      const inMinute = counted.filter((t) => t >= m.now - DENSITY_WINDOW);
      // The "rate" strategy leaves clusters alone and taps only for a high rate: fewer taps.
      const clusters = this.strategyFor("fillers") !== "rate";
      if (clusters && inCluster.length >= c.clusterCount) {
        reason = "filler_cluster";
        why = `${inCluster.length} in ${Math.max(1, Math.round(m.now - inCluster[0]))} s`;
      } else if (inMinute.length >= c.densityPerMin) {
        reason = "filler_density";
        why = `${inMinute.length} in the last minute`;
      } else {
        return {
          event,
          delivered: false,
          withheldReason: "not_a_pattern",
          trigger: clusters
            ? `${inCluster.length} of ${c.clusterCount} within ${c.clusterWindowSec} s`
            : `${inMinute.length} of ${c.densityPerMin} in a minute`,
        };
      }
    }
    const cooldown = this.cooldownFor(reason, m.now);
    if (cooldown) return { event, delivered: false, withheldReason: "cooldown", trigger: why || undefined };
    const pre = this.evidence.filter((e) => e.t >= m.now - PRE_FILLER_WINDOW).length;
    this.evidenceSince = m.now;
    return this.tap(event, reason, m.now, why, pre);
  }

  /**
   * A sustained behavior's state this update. `active` while it holds; `event` describes
   * it. Returns a decision when the engine taps, or logs one hold per episode; else null.
   */
  considerSustained(type: BehaviorType, active: boolean, event: () => SpeechEvent, m: Moment): CueDecision | null {
    const ep = this.episodes.get(type);
    if (!active) {
      this.episodes.delete(type);
      return null;
    }
    const c = this.config();
    const state = ep ?? { waitingSince: m.now, handledAt: null, loggedHold: false };
    this.episodes.set(type, state);
    const reason = type as TapReason;
    // Still the same episode after a tap: only tap again if it persists well past it (§13).
    const behavior = behaviorOf(type);
    const reTap =
      c.reTapAfterSec *
      (this.behaviorPlan(behavior)?.gapScale ?? 1) *
      (this.strategyFor(behavior) === "sustained" ? SUSTAINED_RETAP_SCALE : 1);
    if (state.handledAt !== null && m.now - state.handledAt < reTap) return null;

    const ev = event();
    const held = this.gate(ev) ?? (this.cooldownFor(reason, m.now) ? "cooldown" : undefined);
    if (held) {
      if (state.loggedHold) return null;
      state.loggedHold = true;
      return { event: ev, delivered: false, withheldReason: held };
    }
    // Wait for a natural break so the tap doesn't land mid-word (bounded wait).
    const maxWait = type === "rushing" ? MAX_WAIT_FOR_BREAK_RUSHING : MAX_WAIT_FOR_BREAK;
    if (!m.atBreak && m.now - state.waitingSince < maxWait) return null;
    state.handledAt = m.now;
    state.waitingSince = m.now;
    return this.tap(ev, reason, m.now, "", preMeasure(ev));
  }

  /** Record how a tap (or a holdout) turned out, once its outcome window has passed. */
  resolve(tap: TapRecord, outcome: Outcome, post?: number) {
    tap.outcome = outcome;
    if (post !== undefined) tap.post = post;
  }

  /** Taps and holdouts whose outcome window has passed but haven't been judged yet. */
  due(now: number): TapRecord[] {
    return this.records.filter((t) => !t.outcome && now - t.at >= this.config().outcomeWindowSec);
  }

  /** Counted disfluencies in the 30 s before `now`, the same measure a filler tap records as `pre`. */
  recentFillers(now: number): number {
    return this.evidence.filter((e) => e.t >= now - PRE_FILLER_WINDOW && e.t <= now).length;
  }

  /** Disfluencies counted in (from, to]. */
  disfluenciesBetween(from: number, to: number): number {
    return this.evidence.filter((e) => e.t > from && e.t <= to).length;
  }

  /** Counted disfluencies per minute over the last minute of the session. */
  fillerRate(now: number): number {
    return this.evidence.filter((e) => e.t >= now - DENSITY_WINDOW).length;
  }

  private gate(event: SpeechEvent): CueDecision["withheldReason"] {
    const c = this.config();
    if (!c.categories[CATEGORY[event.type]]) return "category_off";
    if (this.behaviorPlan(behaviorOf(event.type))?.enabled === false) return "preference";
    if (event.type === "too_quiet" && !c.volumeCues[c.mode]) return "category_off";
    if (isPresentation(c) && (PRESENTATION.notLive as readonly BehaviorType[]).includes(event.type)) return "mode_off";
    if (event.confidence < c.minConfidence) return "low_confidence";
    if (c.muted) return "muted";
    return undefined;
  }

  private cooldownFor(reason: TapReason, now: number): boolean {
    const c = this.config();
    const rules = modeRules(c);
    const base =
      c.tapOn === "every" && reason === "filler"
        ? Math.min(rules.cooldownSec, EVERY_FILLER_COOLDOWN)
        : rules.cooldownSec;
    if (now - this.lastTapAt < base) return true;
    if (this.taps.filter((t) => t.at > now - 60).length >= rules.maxTapsPerMin) return true;
    // If the last tap for this same behavior worked, give the user more room before the next.
    const last = this.lastTapByReason.get(reason);
    if (last?.outcome === "worked" && now - last.at < base * WORKED_PATIENCE) return true;
    // A plan that taps a behavior less often keeps a longer gap between its own taps.
    const behavior = behaviorOfReason(reason);
    const scale = this.behaviorPlan(behavior)?.gapScale ?? 1;
    const lastSame = this.lastTapByBehavior.get(behavior);
    if (scale > 1 && lastSame !== undefined && now - lastSame < base * scale) return true;
    return false;
  }

  private tap(event: SpeechEvent, reason: TapReason, now: number, why: string, pre?: number): CueDecision {
    const behavior = behaviorOf(event.type);
    const strategy = this.strategyFor(behavior);
    const record: TapRecord = { id: event.id, reason, at: now, behavior, strategy, pre };
    this.records.push(record);
    // A holdout: the tap was due, and is held back on purpose so its outcome can be compared with
    // real taps'. It still counts as handled (the episode, the filler pattern) but not as a tap,
    // so it doesn't start a cooldown the wearer never felt.
    const holdoutRate = this.behaviorPlan(behavior)?.holdoutRate ?? 0;
    if (holdoutRate > 0 && this.random() < holdoutRate) {
      record.holdout = true;
      return { event, delivered: false, withheldReason: "holdout", trigger: why || undefined, tapReason: reason, strategy };
    }
    this.lastTapAt = now;
    this.lastTapByReason.set(reason, record);
    this.lastTapByBehavior.set(behavior, now);
    return { event, delivered: true, trigger: why || undefined, tapReason: reason, strategy };
  }
}

const behaviorOfReason = (r: TapReason): CoachedBehavior =>
  r === "filler" || r.startsWith("filler_") ? "fillers" : (r as CoachedBehavior);

/** The behavior's measure at the moment a sustained cue is due, from the event that describes it. */
function preMeasure(ev: SpeechEvent): number | undefined {
  if (ev.type === "rushing") return ev.pace?.sps;
  if (ev.type === "too_quiet") return ev.level?.db;
  if (ev.type === "no_pause" || ev.type === "long_turn") return ev.end - ev.start;
  return undefined;
}
