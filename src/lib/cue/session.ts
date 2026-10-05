import { DEFAULT_CONFIG, type CueConfig } from "./config";
import { UH_FORMS, UM_FORMS } from "./lexicon";
import { classifyLowkey, lowkeySpan } from "./lowkeyClassifier";
import { DecisionEngine, type Moment, type Outcome } from "./engine";
import { PATTERNS, patternFor } from "./patterns";
import { classifyLike, NEED_MORE } from "./likeClassifier";
import { FRAME_SEC, median, noiseFloor, speechLevels, type LevelFrame } from "./loudness";
import { measurePace, type Pace } from "./pace";
import type { BehaviorType, CueDecision, LikeCheck, LikeUse, SpeechEvent, Word } from "./types";

/**
 * Deciding whether two detections are the same word. Deepgram's interim results move a
 * word's timestamps by up to ~1 s before the final result (measured: one "um" at 13.01 →
 * 13.30 → 13.73 s; another at 21.79 → 22.75 s), so time alone isn't enough:
 *  - within SAME_EVENT_CLOSE seconds, it's the same word regardless of context;
 *  - within SAME_EVENT_FAR seconds, it's the same word if the word before it matches.
 * Two real fillers after the same word that close together can't happen ("um, um" has
 * different previous words).
 */
const SAME_EVENT_CLOSE = 0.3;
const SAME_EVENT_FAR = 1.5;
/** Words an interim word must be followed by before we trust it. */
const INTERIM_STABILITY = 2;
/** Interim "um"/"uh" at or above this ASR confidence cue immediately (no context needed). */
const FAST_HESITATION_CONFIDENCE = 0.8;
/** A filler "like" decided on not-yet-stable words cues early only if this sure… */
const EARLY_LIKE_CONFIDENCE = 0.85;
/** …and the recognizer is this sure of the word right after it. */
const EARLY_NEXT_WORD_CONFIDENCE = 0.8;
/** Only rescan this many trailing words on each update. */
const SCAN_WINDOW = 40;
/** Once rushing starts, pace must drop this far below the limit to reset (syllables/s). */
const PACE_HYSTERESIS = 0.3;
/** Window over which the current speaking level is measured, seconds. */
const VOLUME_WINDOW = 4;
/** Minimum speech inside that window to judge volume, seconds. */
const VOLUME_MIN_SPEECH = 1;
/** Once quiet, level must recover this much above the quiet line to reset (dB). */
const VOLUME_HYSTERESIS = 2;
/** Keep this many seconds of level frames. */
const LEVEL_HISTORY = 60;
/** Window for measuring the room's background noise, seconds. */
const NOISE_WINDOW = 10;
/** Speakers raise their voice ~0.6 dB per dB of background noise (Lombard effect). */
const LOMBARD_SLOPE = 0.6;
/** Cap on how far room noise can move the expected level, dB. */
const LOMBARD_MAX = 10;
/** Silence (s) after a word that counts as a natural break for a tap. */
const BREAK_SEC = 0.25;
/** Rushing = this much faster than the wearer's own normal pace (SOFTWARE.md §8). */
const PACE_RISE = { conversation: 1.2, presentation: 1.1 };
/** Never call speech under this rushing (syllables/s), however slow the wearer's normal is. */
const PACE_FLOOR = 3.6;
/** A gap (s) between the wearer's words that counts as a meaningful pause (SOFTWARE.md §9). */
const MEANINGFUL_PAUSE = 0.6;
/** Bone frames this close (s) around a word still count toward it (sensor and audio timing differ slightly). */
const BONE_SLACK = 0.1;
/** Share of a word's bone frames that must be active for it to be the wearer's. */
const BONE_SHARE = 0.5;
/**
 * The vibration motor shakes the bone sensor, which would read as the wearer speaking.
 * Bone frames from just before a tap until the motor has settled are ignored.
 */
const HAPTIC_MASK_BEFORE = 0.05;
const HAPTIC_MASK_AFTER = 0.15;
/** If a word's bone frames are all masked, judge it by the unmasked frames this close (s). */
const MASK_FALLBACK = 0.3;
/** Silence (s) that ends the wearer's speaking turn. */
const TURN_GAP = 2.5;

export interface VolumeStatus {
  /** Recent speaking level, dBFS, or null when not enough recent speech. */
  db: number | null;
  /** The wearer's normal speaking level once learned, dBFS. */
  baselineDb: number | null;
  /** What the wearer's level should be in the current room (normal adjusted for noise), dBFS. */
  expectedDb: number | null;
  /** Current background noise, dBFS. */
  noiseDb: number | null;
  /** 0..1 progress toward learning the normal level. */
  calibration: number;
}

const FILLER_LIKE_USES: Record<LikeUse, keyof CueConfig["likeCounts"] | true | false> = {
  discourse: true,
  quotative: "quotative",
  approximator: "approximator",
  verb: false,
  comparison: false,
  example: false,
  conjunction: false,
  hedge: false,
  unknown: false,
};

/** What the engine is currently seeing (SOFTWARE.md §12), for display. */
export interface Signals {
  fillersLastMinute: number;
  /** The wearer's learned normal pace (syllables/s), once known. */
  paceBaseline: number | null;
  /** Current rushing threshold (syllables/s). */
  paceLimit: number;
  secondsSincePause: number;
  turnSeconds: number;
}

export interface SessionUpdate {
  decisions: CueDecision[];
  /** "like"s judged during this update, including non-fillers. */
  likeChecks: LikeCheck[];
  pace: Pace | null;
  volume: VolumeStatus | null;
  /** Earlier taps whose outcome was just judged. */
  outcomes: { id: string; outcome: Outcome }[];
  signals: Signals;
}

/**
 * Turns a stream of recognized words into speech events and cue decisions.
 *
 * Feed it Deepgram-style results: interim results replace the current segment's
 * words; a final result commits them. Call `endUtterance()` on a speech pause so
 * a trailing "like" can be decided without more right context. Use a real
 * utterance end (about a second of silence), not a short endpointing pause: a pause
 * right after "like" is evidence it's a filler, so we wait to hear what follows.
 */
export class CueSession {
  config: CueConfig;
  private finalWords: Word[] = [];
  private interimWords: Word[] = [];
  /** Every candidate already decided (cued, withheld, or judged not a filler). */
  private decided: { type: BehaviorType | "like_checked"; start: number; prev: string }[] = [];
  private engine = new DecisionEngine(() => this.config);
  private paceAboveSince: number | null = null;
  private paceSamples: number[] = [];
  private paceBaseline: number | null = null;
  private levels: LevelFrame[] = [];
  private calibrationLevels: number[] = [];
  private calibratedUpTo = -Infinity;
  private baselineDb: number | null = null;
  private baselineNoiseDb: number | null = null;
  private quietSince: number | null = null;
  private bone: { t: number; active: boolean }[] = [];
  /** Audio-time intervals when the vibration motor was running. */
  private hapticMasks: [number, number][] = [];
  private nextId = 1;
  /** All decisions so far, newest last. */
  readonly history: CueDecision[] = [];
  readonly likeChecks: LikeCheck[] = [];

  constructor(config: Partial<CueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Taps the engine has made, with their outcomes once judged. */
  engineTaps() {
    return this.engine.taps;
  }

  /**
   * Add one frame of the device's bone-conduction voice activity: whether the wearer's own
   * voice was vibrating through the sensor at engine-clock time `t` (one frame per ~50 ms).
   * Frames must arrive in time order.
   */
  ingestBone(t: number, active: boolean) {
    this.bone.push({ t, active });
    if (this.bone.length > 2400) this.bone.splice(0, 1200);
  }

  /** True if the bone sensor confirms the wearer said `w` (always true with no bone signal). */
  isWearerWord(w: Word): boolean {
    if (this.bone.length === 0) return true;
    const near = (slack: number) =>
      this.bone.filter((f) => f.t >= w.start - slack && f.t <= w.end + slack && !this.masked(f.t));
    const all = this.bone.filter((f) => f.t >= w.start - BONE_SLACK && f.t <= w.end + BONE_SLACK);
    // Not heard yet by the bone stream: count it for now; it's re-checked on later updates.
    if (all.length === 0) return this.bone[this.bone.length - 1].t < w.end;
    // Ignore frames while the motor was vibrating; if that hides the whole word, judge it
    // by the frames just around it, and if there are none, give the wearer the benefit.
    let frames = near(BONE_SLACK);
    if (frames.length === 0) frames = near(MASK_FALLBACK);
    if (frames.length === 0) return true;
    return frames.filter((f) => f.active).length / frames.length >= BONE_SHARE;
  }

  /**
   * The motor just played a pattern lasting `durationSec` (a tap the app chose to play,
   * e.g. a touch-control confirmation or a preview). Bone frames during it are ignored.
   * Taps from the decision engine are recorded automatically.
   */
  hapticPlayed(durationSec: number, at = this.audioNow()) {
    this.hapticMasks.push([at - HAPTIC_MASK_BEFORE, at + durationSec + HAPTIC_MASK_AFTER]);
    if (this.hapticMasks.length > 200) this.hapticMasks.splice(0, 100);
  }

  /** The latest audio time heard on any stream: the bone sensor and mic run ahead of transcription. */
  private audioNow(): number {
    return Math.max(
      this.bone[this.bone.length - 1]?.t ?? -Infinity,
      this.levels[this.levels.length - 1]?.t ?? -Infinity,
      this.words[this.words.length - 1]?.end ?? 0,
    );
  }

  private masked(t: number): boolean {
    return this.hapticMasks.some(([a, b]) => t >= a && t <= b);
  }

  get words(): Word[] {
    return [...this.finalWords, ...this.interimWords];
  }

  ingest(words: Word[], isFinal: boolean): SessionUpdate {
    if (isFinal) {
      this.finalWords.push(...words);
      this.interimWords = [];
    } else {
      this.interimWords = words;
    }
    return this.process(false);
  }

  endUtterance(): SessionUpdate {
    return this.process(true);
  }

  /** Add one loudness frame from the mic (engine-clock time, dBFS). Frames must arrive in time order. */
  ingestLevel(t: number, db: number) {
    this.levels.push({ t, db });
    const cutoff = t - LEVEL_HISTORY;
    if (this.levels[0].t < cutoff - 10) this.levels = this.levels.filter((f) => f.t >= cutoff);
  }

  /** Seconds of speech so far, excluding pauses longer than 0.6 s. */
  speakingSeconds(): number {
    const words = this.words;
    let total = 0;
    for (let k = 0; k < words.length; k++) {
      total += words[k].end - words[k].start;
      const gap = k + 1 < words.length ? words[k + 1].start - words[k].end : 0;
      if (gap > 0 && gap <= 0.6) total += gap;
    }
    return total;
  }

  private process(rightClosed: boolean): SessionUpdate {
    // The microphone hears everyone; the device's bone-conduction sensor confirms when the
    // wearer is the one speaking (CUE_CONTEXT §26, decision 6). Only confirmed words are
    // coached. With no bone signal (the web prototype), every word counts as the wearer's.
    const all = this.words;
    const finalStarts = new Set(this.finalWords.map((w) => w.start));
    const words = all.filter((w) => this.isWearerWord(w));
    const interim = words.map((w) => !finalStarts.has(w.start));
    const decisions: CueDecision[] = [];
    const likeChecks: LikeCheck[] = [];
    const from = Math.max(0, words.length - SCAN_WINDOW);
    const moment = this.moment(words, rightClosed);
    const disfluent = (ev: SpeechEvent) => decisions.push(this.engine.considerDisfluency(ev, moment));

    for (let i = from; i < words.length; i++) {
      const w = words[i];
      const isInterim = interim[i];
      const stable = !isInterim || rightClosed || words.length - 1 - i >= INTERIM_STABILITY;

      if (UM_FORMS.has(w.norm) || UH_FORMS.has(w.norm)) {
        // Hesitations need no context: a confident interim result is enough.
        if (!stable && w.confidence < FAST_HESITATION_CONFIDENCE) continue;
        const type: BehaviorType = UM_FORMS.has(w.norm) ? "filler_um" : "filler_uh";
        const prev = words[i - 1]?.norm ?? "";
        if (this.isDecided(type, w.start, prev)) continue;
        this.markDecided(type, w.start, prev);
        disfluent(this.event(type, w, w.confidence, `"${w.norm}" is a hesitation filler`, words, i));
        continue;
      }

      if (w.norm === "like") {
        const prevWord = words[i - 1]?.norm ?? "";
        if (this.isDecided("like_checked", w.start, prevWord)) continue;
        const v = classifyLike(words, i, { rightClosed });
        if (v === NEED_MORE) continue;
        const counts = FILLER_LIKE_USES[v.use];
        const isFiller = counts === true || (typeof counts === "string" && this.config.likeCounts[counts]);
        // Decide on unstable words only for a confident filler whose next word is clearly heard;
        // otherwise wait — a revised interim word could flip the verdict either way.
        if (!stable) {
          const next = words[i + 1];
          const early =
            isFiller &&
            v.confidence >= EARLY_LIKE_CONFIDENCE &&
            !!next &&
            next.confidence >= EARLY_NEXT_WORD_CONFIDENCE;
          if (!early) continue;
        }
        this.markDecided("like_checked", w.start, prevWord);
        likeChecks.push({
          id: `l${this.nextId++}`,
          start: w.start,
          context: contextAround(words, i),
          verdict: v,
          counted: isFiller,
        });
        if (!isFiller) continue;
        // A detection's probability is capped by how sure the recognizer was of the word.
        const confidence = Math.min(v.confidence, Math.max(w.confidence, 0.5) + 0.1);
        const ev = this.event("filler_like", w, confidence, v.reason, words, i);
        ev.like = v;
        disfluent(ev);
        continue;
      }

      const span = lowkeySpan(words, i);
      if (span) {
        const prevWord = words[i - 1]?.norm ?? "";
        if (this.isDecided("filler_lowkey", w.start, prevWord)) continue;
        const v = classifyLowkey(words, i, span, { rightClosed });
        if (v === NEED_MORE) continue;
        // Like "like": decide on unstable words only for a confident filler.
        if (!stable && !(v.filler && v.confidence >= EARLY_LIKE_CONFIDENCE)) continue;
        this.markDecided("filler_lowkey", w.start, prevWord);
        if (!v.filler) continue;
        const last = words[i + span - 1];
        disfluent(this.event("filler_lowkey", { ...w, end: last.end }, v.confidence, v.reason, words, i));
        continue;
      }

      // Repetition ("I, I, I think", "and then, and then"): judged once the run has ended.
      if (stable) {
        const rep = findRepetition(words, i, rightClosed);
        if (rep && !this.isDecided("repetition", words[rep.from].start, words[rep.from - 1]?.norm ?? "")) {
          this.markDecided("repetition", words[rep.from].start, words[rep.from - 1]?.norm ?? "");
          const ev = this.event(
            "repetition",
            { ...words[rep.from], end: words[i].end },
            rep.confidence,
            rep.reason,
            words,
            i,
          );
          disfluent(ev);
        }
      }
    }

    // --- Sustained behaviors -------------------------------------------------
    const pace = measurePace(words, this.config.paceWindowSec);
    this.learnPace(words, pace);
    const paceLimit = this.paceLimit();
    const rushing = this.rushingActive(words, pace, paceLimit);
    const lastWord = words[words.length - 1];
    const sustained = (type: BehaviorType, active: boolean, describe: () => SpeechEvent) => {
      const d = this.engine.considerSustained(type, active, describe, moment);
      if (d) decisions.push(d);
    };
    sustained("rushing", rushing, () => {
      const ev = this.event(
        "rushing",
        { ...lastWord, start: this.paceAboveSince ?? lastWord.start },
        0.9,
        `~${pace!.sps.toFixed(1)} syllables/s (≈${Math.round(pace!.wpm)} wpm) for ${Math.round(moment.now - (this.paceAboveSince ?? moment.now))} s; ${
          this.paceBaseline !== null && this.config.paceMode !== "custom"
            ? `your normal is ~${this.paceBaseline.toFixed(1)}`
            : `limit ${paceLimit.toFixed(1)}`
        }`,
        words,
        words.length - 1,
      );
      ev.pace = pace!;
      return ev;
    });

    const sincePause = words.length ? moment.now - lastPauseEnd(words) : 0;
    sustained("no_pause", sincePause >= this.config.noPauseSec, () =>
      this.event(
        "no_pause",
        { ...lastWord, start: lastPauseEnd(words) },
        0.9,
        `${Math.round(sincePause)} s of talking without a pause`,
        words,
        words.length - 1,
      ),
    );

    const turn = words.length ? moment.now - turnStart(all, (w) => this.isWearerWord(w)) : 0;
    sustained("long_turn", turn >= this.config.longTurnSec, () =>
      this.event(
        "long_turn",
        { ...lastWord, start: moment.now - turn },
        0.9,
        `you've been talking for ${Math.round(turn)} s; maybe give the other person space`,
        words,
        words.length - 1,
      ),
    );

    const { status: volume, quiet } = this.checkVolume(all, words);
    if (quiet) sustained("too_quiet", true, quiet);
    else sustained("too_quiet", false, () => null as never);

    // --- Did earlier taps work? (SOFTWARE.md §13) -----------------------------
    const outcomes: { id: string; outcome: Outcome }[] = [];
    for (const tap of this.engine.due(moment.now)) {
      const after = tap.at + this.config.outcomeWindowSec;
      let worked: boolean;
      if (tap.reason === "rushing") worked = !rushing;
      else if (tap.reason === "no_pause") worked = lastPauseEnd(words) > tap.at;
      else if (tap.reason === "long_turn") worked = moment.now - turn > tap.at;
      else if (tap.reason === "too_quiet") worked = !quiet;
      else worked = this.engine.disfluenciesBetween(tap.at, after) === 0;
      const outcome: Outcome = worked ? "worked" : "no_change";
      this.engine.resolve(tap, outcome);
      outcomes.push({ id: tap.id, outcome });
    }

    // The motor vibrates the moment a tap is delivered: mask the bone sensor for it.
    for (const d of decisions) {
      if (!d.delivered) continue;
      const pattern = PATTERNS[patternFor(d.event.type, this.config.distinctCues)];
      this.hapticPlayed(pattern.vibrate.reduce((a, b) => a + b, 0) / 1000);
    }
    this.history.push(...decisions);
    this.likeChecks.push(...likeChecks);
    const signals: Signals = {
      fillersLastMinute: this.engine.fillerRate(moment.now),
      paceBaseline: this.paceBaseline,
      paceLimit,
      secondsSincePause: sincePause,
      turnSeconds: turn,
    };
    return { decisions, likeChecks, pace, volume, outcomes, signals };
  }

  /** "Now" on the speech clock, and whether the wearer is at a natural break in speech. */
  private moment(words: Word[], rightClosed: boolean): Moment {
    const last = words[words.length - 1];
    const now = last?.end ?? this.words[this.words.length - 1]?.end ?? 0;
    if (rightClosed || !last) return { now, atBreak: true };
    // The mic runs ahead of transcription: if the audio right after the last word is quiet,
    // a pause has begun. Without audio, use the gap before the last word.
    const after = this.levels.filter((f) => f.t > now && f.t <= now + BREAK_SEC);
    if (after.length * FRAME_SEC >= BREAK_SEC * 0.8) {
      const voicedLine = (this.baselineNoiseDb ?? -60) + 10;
      return { now, atBreak: after.every((f) => f.db <= voicedLine) };
    }
    const prev = words[words.length - 2];
    return { now, atBreak: !!prev && last.start - prev.end >= BREAK_SEC };
  }

  /** Learn the wearer's normal pace from their first `paceBaselineSec` of speech. */
  private learnPace(words: Word[], pace: Pace | null) {
    if (this.paceBaseline !== null || !pace) return;
    this.paceSamples.push(pace.sps);
    if (speakingSecondsOf(words) >= this.config.paceBaselineSec) this.paceBaseline = median(this.paceSamples);
  }

  /** Rushing threshold: relative to the wearer's normal once learned (SOFTWARE.md §8). */
  private paceLimit(): number {
    const c = this.config;
    if (c.paceMode === "custom" || this.paceBaseline === null) return c.paceThreshold;
    const rise = c.paceMode === "presentation" ? PACE_RISE.presentation : PACE_RISE.conversation;
    return Math.max(PACE_FLOOR, this.paceBaseline * rise);
  }

  private rushingActive(words: Word[], pace: Pace | null, limit: number): boolean {
    const now = words.at(-1)?.end ?? 0;
    // Hysteresis: a brief dip (a comma, a short word) shouldn't restart the clock.
    if (pace === null || pace.sps < limit - PACE_HYSTERESIS) {
      this.paceAboveSince = null;
      return false;
    }
    if (pace.sps > limit) this.paceAboveSince ??= now;
    return this.paceAboveSince !== null && now - this.paceAboveSince >= this.config.paceSustainSec;
  }

  /**
   * Too quiet = recent speech well below the wearer's own normal level, sustained.
   * The normal level is learned from the first `calibrationSec` of speech.
   */
  private checkVolume(all: Word[], mine: Word[]): { status: VolumeStatus | null; quiet?: () => SpeechEvent } {
    if (this.levels.length === 0 || all.length === 0) return { status: null };
    const c = this.config;
    const now = all[all.length - 1].end;
    const none = { db: null, baselineDb: null, expectedDb: null, noiseDb: null };

    // Calibration: learn the wearer's normal speaking level and the room's noise at the time.
    if (this.baselineDb === null) {
      this.calibrationLevels.push(...speechLevels(this.levels, all, this.calibratedUpTo, now));
      this.calibratedUpTo = now + 1e-6;
      const learned = this.calibrationLevels.length * FRAME_SEC;
      if (learned < c.calibrationSec) return { status: { ...none, calibration: learned / c.calibrationSec } };
      this.baselineDb = median(this.calibrationLevels);
      this.baselineNoiseDb = noiseFloor(this.levels, -Infinity, now);
    }
    const baselineDb = this.baselineDb!;

    // Room noise now vs. during calibration: people naturally speak up in noise (Lombard
    // effect), so the expected level moves with it. Without this, calibrating in a café
    // and then talking in a quiet room would falsely read as "too quiet".
    const noiseDb = noiseFloor(this.levels, now - NOISE_WINDOW, now);
    const shift =
      noiseDb !== null && this.baselineNoiseDb !== null
        ? Math.max(-LOMBARD_MAX, Math.min(LOMBARD_MAX, LOMBARD_SLOPE * (noiseDb - this.baselineNoiseDb)))
        : 0;
    const expectedDb = baselineDb + shift;

    const recent = mine.length ? speechLevels(this.levels, mine, now - VOLUME_WINDOW, now) : [];
    if (recent.length * FRAME_SEC < VOLUME_MIN_SPEECH)
      return { status: { db: null, baselineDb, expectedDb, noiseDb, calibration: 1 } };
    const db = median(recent);
    const status: VolumeStatus = { db, baselineDb, expectedDb, noiseDb, calibration: 1 };

    const quietLine = expectedDb - c.quietDropDb;
    if (db > quietLine + VOLUME_HYSTERESIS) this.quietSince = null;
    if (db >= quietLine) return { status };
    this.quietSince ??= now;
    if (now - this.quietSince < c.quietSustainSec) return { status };

    const since = this.quietSince;
    const last = mine[mine.length - 1];
    const roomNote = shift >= 3 ? " for this noisy room" : "";
    return {
      status,
      quiet: () => {
        const ev = this.event(
          "too_quiet",
          { ...last, start: since },
          0.9,
          `~${Math.round(expectedDb - db)} dB below your normal speaking level${roomNote} for ${Math.round(now - since)} s`,
          mine,
          mine.length - 1,
        );
        ev.level = { db, baselineDb, expectedDb, noiseDb };
        return ev;
      },
    };
  }

  private event(
    type: BehaviorType,
    w: Word,
    confidence: number,
    reason: string,
    words: Word[],
    i: number,
  ): SpeechEvent {
    return {
      id: `e${this.nextId++}`,
      type,
      start: w.start,
      end: w.end,
      confidence,
      reason,
      context: contextAround(words, i),
    };
  }

  private isDecided(type: BehaviorType | "like_checked", start: number, prev: string) {
    return this.decided.some((d) => {
      if (d.type !== type) return false;
      const gap = Math.abs(d.start - start);
      return gap < SAME_EVENT_CLOSE || (gap < SAME_EVENT_FAR && d.prev === prev);
    });
  }

  private markDecided(type: BehaviorType | "like_checked", start: number, prev: string) {
    this.decided.push({ type, start, prev });
    if (this.decided.length > 500) this.decided.splice(0, 250);
  }
}

function contextAround(words: Word[], i: number): string {
  return words
    .slice(Math.max(0, i - 4), i + 4)
    .map((x) => x.text)
    .join(" ");
}

function isHesitation(w: Word): boolean {
  return UM_FORMS.has(w.norm) || UH_FORMS.has(w.norm);
}

/** Seconds of speech in `words`, excluding pauses longer than 0.6 s. */
function speakingSecondsOf(words: Word[]): number {
  let total = 0;
  for (let k = 0; k < words.length; k++) {
    total += words[k].end - words[k].start;
    const gap = k + 1 < words.length ? words[k + 1].start - words[k].end : 0;
    if (gap > 0 && gap <= 0.6) total += gap;
  }
  return total;
}

/** When the wearer last resumed speaking after a meaningful pause (or started). */
function lastPauseEnd(words: Word[]): number {
  for (let k = words.length - 1; k > 0; k--)
    if (words[k].start - words[k - 1].end >= MEANINGFUL_PAUSE) return words[k].start;
  return words[0]?.start ?? 0;
}

/** Start of the wearer's current speaking turn: since someone else spoke, or a long silence. */
function turnStart(all: Word[], isWearer: (w: Word) => boolean): number {
  let start = all[all.length - 1]?.start ?? 0;
  for (let k = all.length - 1; k >= 0; k--) {
    if (!isWearer(all[k])) break;
    start = all[k].start;
    if (k > 0 && all[k].start - all[k - 1].end >= TURN_GAP) break;
  }
  return start;
}

/** Words that are often repeated on purpose ("very, very", "no, no", "bye bye"). */
const INTENTIONAL_REPEATS = new Set(
  "very really so no yeah yes yep bye ha haha hey ok okay well wow please go come that had is more much bla blah".split(
    " ",
  ),
);

/**
 * Accidental repetition ending at word `i`: a word said 2+ times in a row ("I, I, I think")
 * or a two-word phrase repeated ("and then, and then"). Words often repeated for emphasis
 * don't count. Returns the run's first index and a confidence, once the run has ended.
 */
function findRepetition(
  words: Word[],
  i: number,
  rightClosed: boolean,
): { from: number; confidence: number; reason: string } | null {
  const w = words[i];
  if (!w || INTENTIONAL_REPEATS.has(w.norm) || isHesitation(w) || w.norm === "like") return null;
  const next = words[i + 1];
  // Single word repeated
  if (words[i - 1]?.norm === w.norm) {
    if (next?.norm === w.norm) return null; // run continues; judge at its end
    if (!next && !rightClosed) return null;
    let from = i;
    while (from > 0 && words[from - 1].norm === w.norm) from--;
    const n = i - from + 1;
    return { from, confidence: n >= 3 ? 0.9 : 0.82, reason: `"${w.norm}" said ${n} times in a row` };
  }
  // Two-word phrase repeated: "and then and then"
  const a = words[i - 3];
  const b = words[i - 2];
  const c = words[i - 1];
  if (a && b && c && a.norm === c.norm && b.norm === w.norm && a.norm !== b.norm && !INTENTIONAL_REPEATS.has(a.norm)) {
    if (next && words[i + 1]?.norm === a.norm && words[i + 2]?.norm === w.norm) return null; // continues
    return { from: i - 3, confidence: 0.88, reason: `"${c.norm} ${w.norm}" repeated` };
  }
  return null;
}
