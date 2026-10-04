import { DEFAULT_CONFIG, type CueConfig } from "./config";
import { UH_FORMS, UM_FORMS } from "./lexicon";
import { classifyLike, NEED_MORE } from "./likeClassifier";
import { FRAME_SEC, median, noiseFloor, speechLevels, type LevelFrame } from "./loudness";
import { WearerModel, wordLevel } from "./wearer";
import { measurePace, type Pace } from "./pace";
import type { BehaviorType, CueDecision, LikeCheck, LikeUse, SpeechEvent, Word } from "./types";

/** Two detections of the same type closer than this (s) are the same event. */
const SAME_EVENT = 0.25;
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

export interface SessionUpdate {
  decisions: CueDecision[];
  /** "like"s judged during this update, including non-fillers. */
  likeChecks: LikeCheck[];
  pace: Pace | null;
  volume: VolumeStatus | null;
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
  private decided: { type: BehaviorType | "like_checked"; start: number }[] = [];
  private lastCueEnd = -Infinity;
  private lastPaceCueEnd = -Infinity;
  private paceAboveSince: number | null = null;
  private levels: LevelFrame[] = [];
  private calibrationLevels: number[] = [];
  private calibratedUpTo = -Infinity;
  private baselineDb: number | null = null;
  private baselineNoiseDb: number | null = null;
  private wearer = new WearerModel();
  /** Settled wearer/other decisions by word start, so a word never flips. */
  private attribution = new Map<number, boolean>();
  private quietSince: number | null = null;
  private lastQuietCueEnd = -Infinity;
  private nextId = 1;
  /** All decisions so far, newest last. */
  readonly history: CueDecision[] = [];
  readonly likeChecks: LikeCheck[] = [];

  constructor(config: Partial<CueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get words(): Word[] {
    return [...this.finalWords, ...this.interimWords];
  }

  /** All words, each marked with whether Cue attributes it to the wearer. */
  annotatedWords(): (Word & { wearer: boolean })[] {
    return this.words.map((w) => ({ ...w, wearer: this.isWearerWord(w) }));
  }

  /** Whether a word is the wearer's (always true with `onlyWearer` off). */
  isWearerWord(w: Word): boolean {
    if (!this.config.onlyWearer) return true;
    const key = Math.round(w.start * 100);
    const settled = this.attribution.get(key);
    if (settled !== undefined) return settled;
    const level = wordLevel(this.levels, w);
    const mine = this.wearer.isWearer(w, level, this.baselineDb);
    // Settle once calibrated and the word's audio has been measured.
    const measured = this.levels.length === 0 || this.levels[this.levels.length - 1].t >= w.end;
    if (this.baselineDb !== null && measured) this.attribution.set(key, mine);
    return mine;
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
    const all = this.words;
    // Coach only the wearer: other people's words are dropped before detection. The gap
    // they leave reads as a pause, which is how a turn change should look to the rules.
    const finalStarts = new Set(this.finalWords.map((w) => w.start));
    const words = all.filter((w) => this.isWearerWord(w));
    const interim = words.map((w) => !finalStarts.has(w.start));
    const decisions: CueDecision[] = [];
    const likeChecks: LikeCheck[] = [];
    const from = Math.max(0, words.length - SCAN_WINDOW);

    for (let i = from; i < words.length; i++) {
      const w = words[i];
      const isInterim = interim[i];
      const stable = !isInterim || rightClosed || words.length - 1 - i >= INTERIM_STABILITY;

      if (UM_FORMS.has(w.norm) || UH_FORMS.has(w.norm)) {
        // Hesitations need no context: a confident interim result is enough.
        if (!stable && w.confidence < FAST_HESITATION_CONFIDENCE) continue;
        const type: BehaviorType = UM_FORMS.has(w.norm) ? "filler_um" : "filler_uh";
        if (this.isDecided(type, w.start)) continue;
        this.markDecided(type, w.start);
        decisions.push(this.decide(this.event(type, w, w.confidence, `"${w.norm}" is a hesitation filler`, words, i)));
        continue;
      }

      if (w.norm === "like") {
        if (this.isDecided("like_checked", w.start)) continue;
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
        this.markDecided("like_checked", w.start);
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
        decisions.push(this.decide(ev));
      }
    }

    const pace = measurePace(words, this.config.paceWindowSec);
    const paceDecision = this.checkPace(words, pace);
    if (paceDecision) decisions.push(paceDecision);
    const { status: volume, decision: volumeDecision } = this.checkVolume(all, words);
    if (volumeDecision) decisions.push(volumeDecision);

    this.history.push(...decisions);
    this.likeChecks.push(...likeChecks);
    return { decisions, likeChecks, pace, volume };
  }

  private checkPace(words: Word[], pace: Pace | null): CueDecision | null {
    const now = words.at(-1)?.end ?? 0;
    const limit = this.config.paceThreshold;
    // Hysteresis: a brief dip (a comma, a short word) shouldn't restart the clock.
    if (pace === null || pace.sps < limit - PACE_HYSTERESIS) {
      this.paceAboveSince = null;
      return null;
    }
    if (pace.sps <= limit) return null;
    this.paceAboveSince ??= now;
    if (now - this.paceAboveSince < this.config.paceSustainSec) return null;
    if (now - this.lastPaceCueEnd < this.config.paceCooldownSec) return null;
    this.lastPaceCueEnd = now;
    const last = words.at(-1)!;
    const ev = this.event(
      "rushing",
      { ...last, start: this.paceAboveSince },
      0.9,
      `~${pace.sps.toFixed(1)} syllables/s (≈${Math.round(pace.wpm)} wpm) for ${Math.round(now - this.paceAboveSince)}s — limit ${this.config.paceThreshold.toFixed(1)}`,
      words,
      words.length - 1,
    );
    ev.pace = pace;
    this.paceAboveSince = null;
    return this.decide(ev);
  }

  /**
   * Too quiet = recent speech well below the wearer's own normal level, sustained.
   * The normal level is learned from the first `calibrationSec` of speech.
   */
  private checkVolume(all: Word[], mine: Word[]): { status: VolumeStatus | null; decision?: CueDecision } {
    if (this.levels.length === 0 || all.length === 0) return { status: null };
    const c = this.config;
    const now = all[all.length - 1].end;
    const none = { db: null, baselineDb: null, expectedDb: null, noiseDb: null };

    // Calibration: the wearer talks alone, so every word heard is theirs; learn their
    // normal level, their speaker label, and the room's noise at the time.
    if (this.baselineDb === null) {
      this.calibrationLevels.push(...speechLevels(this.levels, all, this.calibratedUpTo, now));
      for (const w of all) if (w.end > this.calibratedUpTo && w.end <= now) this.wearer.observeCalibration(w);
      this.calibratedUpTo = now + 1e-6;
      const learned = this.calibrationLevels.length * FRAME_SEC;
      if (learned < c.calibrationSec) return { status: { ...none, calibration: learned / c.calibrationSec } };
      this.baselineDb = median(this.calibrationLevels);
      this.baselineNoiseDb = noiseFloor(this.levels, -Infinity, now);
      this.wearer.finishCalibration();
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
    if (now - this.quietSince < c.quietSustainSec || now - this.lastQuietCueEnd < c.quietCooldownSec) return { status };

    this.lastQuietCueEnd = now;
    const last = mine[mine.length - 1];
    const roomNote = shift >= 3 ? " for this noisy room" : "";
    const ev = this.event(
      "too_quiet",
      { ...last, start: this.quietSince },
      0.9,
      `~${Math.round(expectedDb - db)} dB below your normal speaking level${roomNote} for ${Math.round(now - this.quietSince)}s`,
      mine,
      mine.length - 1,
    );
    ev.level = { db, baselineDb, expectedDb, noiseDb };
    this.quietSince = null;
    return { status, decision: this.decide(ev) };
  }

  /** The intervention policy: a detected event may correctly produce no cue. */
  private decide(event: SpeechEvent): CueDecision {
    const c = this.config;
    const cat = {
      filler_um: "um",
      filler_uh: "uh",
      filler_like: "like",
      rushing: "rushing",
      too_quiet: "quiet",
    } as const;
    let withheldReason: CueDecision["withheldReason"];
    if (!c.categories[cat[event.type]]) withheldReason = "category_off";
    else if (event.confidence < c.minConfidence) withheldReason = "low_confidence";
    else if (c.muted) withheldReason = "muted";
    else if (event.end - this.lastCueEnd < c.cooldownSec) withheldReason = "cooldown";
    const delivered = !withheldReason;
    if (delivered) this.lastCueEnd = event.end;
    return { event, delivered, withheldReason };
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

  private isDecided(type: BehaviorType | "like_checked", start: number) {
    return this.decided.some((d) => d.type === type && Math.abs(d.start - start) < SAME_EVENT);
  }

  private markDecided(type: BehaviorType | "like_checked", start: number) {
    this.decided.push({ type, start });
    if (this.decided.length > 500) this.decided.splice(0, 250);
  }
}

function contextAround(words: Word[], i: number): string {
  return words
    .slice(Math.max(0, i - 4), i + 4)
    .map((x) => x.text)
    .join(" ");
}
