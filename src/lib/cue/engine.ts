import { modeRules, PRESENTATION, isPresentation, type CueConfig } from "./config";
import type { BehaviorType, CueDecision, SpeechEvent } from "./types";

/**
 * The behavioral decision engine (SOFTWARE.md §12–14). Detectors report what they
 * notice; the engine decides whether a tap would help *right now*:
 *
 *  - Fillers only tap as a pattern: a cluster
 *    (3 within 12 s) or a high rate (8+ in the last minute), not one at a time (§7).
 *  - Sustained behaviors (rushing, no pause, long turn, too quiet) wait for a natural
 *    break in speech, up to a few seconds, so the tap doesn't land mid-word (§12).
 *  - One tap at a time: a 10–20 s cooldown after any tap (§13). Presentation mode is sparser
 *    (decision 11): 25 s between taps, at most 2 a minute, fillers judged as a rate, and long
 *    turns left for the review.
 *  - Only confident detections count (§14).
 *  - It checks whether each tap worked (the user paused, slowed, spoke up); if it did,
 *    it waits longer before tapping for that behavior again (§13, §17).
 */

export type TapReason =
  "filler" | "filler_cluster" | "filler_density" | "rushing" | "no_pause" | "long_turn" | "too_quiet";
export type Outcome = "worked" | "no_change";

export interface TapRecord {
  id: string;
  reason: TapReason;
  at: number;
  outcome?: Outcome;
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
/** The rate window for filler density, seconds. */
const DENSITY_WINDOW = 60;

export interface Moment {
  /** Engine-clock time of the latest speech. */
  now: number;
  /** True when the speaker is at a natural break (a pause has started or a word just ended a phrase). */
  atBreak: boolean;
}

export class DecisionEngine {
  readonly taps: TapRecord[] = [];
  private evidence: { t: number; weight: number }[] = []; // counted disfluencies
  private evidenceSince = -Infinity; // disfluencies before the last pattern tap don't count again
  private lastTapAt = -Infinity;
  private lastTapByReason = new Map<TapReason, TapRecord>();
  /** Per sustained behavior: when its current episode started waiting, and whether it's been handled. */
  private episodes = new Map<BehaviorType, { waitingSince: number; handledAt: number | null; loggedHold: boolean }>();

  constructor(private config: () => CueConfig) {}

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
      if (inCluster.length >= c.clusterCount) {
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
          trigger: `${inCluster.length} of ${c.clusterCount} within ${c.clusterWindowSec} s`,
        };
      }
    }
    const cooldown = this.cooldownFor(reason, m.now);
    if (cooldown) return { event, delivered: false, withheldReason: "cooldown", trigger: why || undefined };
    this.evidenceSince = m.now;
    return this.tap(event, reason, m.now, why);
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
    if (state.handledAt !== null && m.now - state.handledAt < c.reTapAfterSec) return null;

    const ev = event();
    const held = this.gate(ev) ?? (this.cooldownFor(reason, m.now) ? "cooldown" : undefined);
    if (held) {
      if (state.loggedHold) return null;
      state.loggedHold = true;
      return { event: ev, delivered: false, withheldReason: held };
    }
    // Wait for a natural break so the tap doesn't land mid-word (bounded wait).
    if (!m.atBreak && m.now - state.waitingSince < MAX_WAIT_FOR_BREAK) return null;
    state.handledAt = m.now;
    state.waitingSince = m.now;
    return this.tap(ev, reason, m.now, "");
  }

  /** Record how a tap turned out, once its outcome window has passed. */
  resolve(tap: TapRecord, outcome: Outcome) {
    tap.outcome = outcome;
  }

  /** Taps whose outcome window has passed but haven't been judged yet. */
  due(now: number): TapRecord[] {
    return this.taps.filter((t) => !t.outcome && now - t.at >= this.config().outcomeWindowSec);
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
    return false;
  }

  private tap(event: SpeechEvent, reason: TapReason, now: number, why: string): CueDecision {
    const record: TapRecord = { id: event.id, reason, at: now };
    this.taps.push(record);
    this.lastTapAt = now;
    this.lastTapByReason.set(reason, record);
    return { event, delivered: true, trigger: why || undefined, tapReason: reason };
  }
}
