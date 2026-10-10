import { CONFIRMS, PATTERNS, type ConfirmPattern, type CuePattern } from "./patterns";

/**
 * Cue sounds: the three haptic cues played as quiet tones in headphones (AirPods), for testing
 * Cue with people before the device exists. This is a testing stand-in, not the product: Cue
 * stays a single behind-the-ear device that taps (CUE_CONTEXT.md decision 7).
 *
 * Each cue keeps its haptic rhythm exactly (the on/off steps in `patterns.ts`), so what people
 * learn by ear carries over to the motor. Cues start with a sharp onset like the haptics, and each
 * cue has its own pitch as a second hint: Pause high, Slow down middle, Speak up low. Touch-control
 * confirmations swell in and out with no sharp onset, so they never sound like a cue.
 */

export interface Tone {
  /** Start, seconds from the beginning of the sound. */
  at: number;
  /** Length, seconds. */
  dur: number;
  /** Hz. */
  freq: number;
  /** Seconds to full level. Cues: a few ms (sharp onset). Confirmations: most of the tone. */
  attack: number;
  /** Seconds to fade out at the end. */
  release: number;
  /** Relative level, 0–1. */
  peak: number;
}

/** Each cue's pitch: Pause high, Slow down middle, Speak up low. */
export const CUE_HZ: Record<CuePattern, number> = { tap: 660, steps: 523.25, push: 392 };
const CONFIRM_HZ = 440;
/** A tap this short or shorter rings down like a knock; longer steps hold, then fade. */
const SHORT_MS = 60;

/** The "on" steps of a vibrate pattern (on, off, on, … in ms) as [start, length] in seconds. */
export function onSegments(vibrate: number[]): { at: number; dur: number }[] {
  const out: { at: number; dur: number }[] = [];
  let t = 0;
  vibrate.forEach((ms, k) => {
    if (k % 2 === 0 && ms > 0) out.push({ at: t / 1000, dur: ms / 1000 });
    t += ms;
  });
  return out;
}

/** The tones for a coaching cue: its haptic rhythm, at its own pitch, each step with a sharp onset. */
export function cueTones(pattern: CuePattern): Tone[] {
  const { vibrate } = PATTERNS[pattern];
  return onSegments(vibrate).map(({ at, dur }) => {
    const short = dur * 1000 <= SHORT_MS;
    // Very short taps are hard to hear, so they ring a little past their haptic length.
    const len = short ? Math.max(dur, 0.09) : dur;
    return { at, dur: len, freq: CUE_HZ[pattern], attack: 0.004, release: short ? len - 0.004 : 0.03, peak: 1 };
  });
}

/**
 * The tones for a touch-control confirmation: soft swells that follow the ramp (pulses that grow or
 * shrink), never a sharp start.
 */
export function confirmTones(pattern: ConfirmPattern): Tone[] {
  const segs = onSegments(CONFIRMS[pattern].vibrate);
  const longest = Math.max(...segs.map((s) => s.dur));
  return segs.map(({ at, dur }) => {
    const len = Math.max(dur, 0.06);
    return {
      at,
      dur: len,
      freq: CONFIRM_HZ,
      attack: len * 0.6,
      release: len * 0.4,
      peak: 0.35 + 0.65 * (dur / longest),
    };
  });
}

/** Total length of a set of tones, seconds. */
export const tonesLength = (tones: Tone[]) => Math.max(0, ...tones.map((t) => t.at + t.dur));

/** Highest output level at volume 1, kept well below full scale: these play right in someone's ear. */
const MAX_GAIN = 0.35;

/** Plays tones through the default audio output (AirPods when they're connected). */
export class EarconPlayer {
  private ctx: AudioContext | null = null;

  /**
   * Browsers only start audio after a click or tap. Call this from one (Start listening, a
   * switch, Test sound) so later cues, which arrive with no click, can play.
   */
  unlock() {
    if (typeof window === "undefined") return;
    this.ctx ??= new AudioContext();
    void this.ctx.resume().catch(() => {});
  }

  /** Play tones at `volume` (0–1). Returns false when sound couldn't start yet (no click so far). */
  play(tones: Tone[], volume: number): boolean {
    const ctx = this.ctx;
    if (!ctx || volume <= 0) return false;
    if (ctx.state !== "running") void ctx.resume().catch(() => {});
    // Perceived loudness is roughly logarithmic, so the slider maps through a square.
    const level = MAX_GAIN * volume * volume;
    const t0 = ctx.currentTime + 0.02;
    for (const tone of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = tone.freq;
      const start = t0 + tone.at;
      const end = start + tone.dur;
      const peak = level * tone.peak;
      const attackEnd = start + Math.min(tone.attack, tone.dur);
      const releaseStart = Math.max(attackEnd, end - tone.release);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(peak, attackEnd);
      gain.gain.setValueAtTime(peak, releaseStart);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    }
    return ctx.state === "running";
  }
}

type AudioSessionType = "auto" | "playback" | "play-and-record";

/**
 * iPhone Safari (17+): choose how the page's audio behaves. "playback" plays even with the ring
 * switch on silent; "play-and-record" is for listening and playing at once. Other browsers ignore it.
 */
export function setAudioSession(type: AudioSessionType) {
  if (typeof navigator === "undefined") return;
  const session = (navigator as Navigator & { audioSession?: { type: AudioSessionType } }).audioSession;
  if (!session) return;
  try {
    session.type = type;
  } catch {
    // Not allowed right now (for example while capture is starting): keep the current type.
  }
}
