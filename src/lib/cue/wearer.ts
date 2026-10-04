import { median, type LevelFrame } from "./loudness";
import type { Word } from "./types";

/** Without speaker labels, a voice this far below the wearer's normal (dB) is someone else. */
export const OTHER_DROP_DB = 12;
/** A new speaker label this close to the wearer's normal level (dB) is the wearer, relabeled. */
export const ALIAS_DB = 4;

/** Median mic level while `w` was being said, or null if no frames cover it yet. */
export function wordLevel(frames: LevelFrame[], w: Word): number | null {
  const inside = frames.filter((f) => f.t >= w.start && f.t <= w.end).map((f) => f.db);
  return inside.length ? median(inside) : null;
}

/**
 * Decides whether a word was said by the wearer or someone nearby, combining two
 * imperfect signals:
 *  - Deepgram's speaker labels (streaming diarization is error-prone, and labels can change);
 *  - loudness: the wearer is nearest the mic, so other voices arrive well below
 *    the wearer's normal level.
 * The wearer's label is learned during calibration, when the wearer talks alone.
 * Session-only: no voiceprint is created or stored.
 */
export class WearerModel {
  private wearerLabels = new Set<number>();
  private calibrationSeconds = new Map<number, number>();
  private calibrated = false;

  /** During calibration, everything heard is assumed to be the wearer. */
  observeCalibration(w: Word) {
    if (w.speaker === undefined) return;
    this.calibrationSeconds.set(w.speaker, (this.calibrationSeconds.get(w.speaker) ?? 0) + (w.end - w.start));
  }

  /** Calibration done: the label heard most while the wearer talked alone is the wearer's. */
  finishCalibration() {
    this.calibrated = true;
    let best: number | undefined;
    let most = 0;
    for (const [label, sec] of this.calibrationSeconds) if (sec > most) [best, most] = [label, sec];
    if (best !== undefined) this.wearerLabels.add(best);
  }

  get learnedLabel(): number | null {
    return this.wearerLabels.size ? [...this.wearerLabels][0] : null;
  }

  /** True if `w` is the wearer's. `level` is the word's mic level; `normalDb` the wearer's normal. */
  isWearer(w: Word, level: number | null, normalDb: number | null): boolean {
    if (!this.calibrated || normalDb === null) return true;
    if (w.speaker !== undefined && this.wearerLabels.size) {
      if (this.wearerLabels.has(w.speaker)) return true;
      // Diarization sometimes gives the same voice a new label; a voice as loud as the
      // wearer's normal, this close to the mic, is the wearer.
      if (level !== null && level >= normalDb - ALIAS_DB) {
        this.wearerLabels.add(w.speaker);
        return true;
      }
      return false;
    }
    // No labels: loudness alone.
    return level === null || level >= normalDb - OTHER_DROP_DB;
  }
}
