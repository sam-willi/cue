/**
 * Touch gestures on the device, for controls only (on/off, mode). Deliberately few and hard to
 * trigger by accident, since people touch their ears often:
 *   long press (hold ≥ 1.5 s)        → "toggle_on"   (Cue on/off)
 *   double tap (two quick taps)      → "toggle_mode" (Conversation ↔ Presentation)
 *   a single tap, or anything else   → nothing
 * Times are milliseconds on any monotonic clock.
 */
export type TouchAction = "toggle_on" | "toggle_mode";

export const LONG_PRESS_MS = 1500;
/** A touch shorter than this counts as a tap. */
export const TAP_MAX_MS = 300;
/** Second tap must start within this long after the first ends. */
export const DOUBLE_TAP_GAP_MS = 400;

export class TouchGestures {
  private downAt: number | null = null;
  private longFired = false;
  private lastTapEnd: number | null = null;

  down(t: number) {
    this.downAt = t;
    this.longFired = false;
  }

  /** Call while the finger is down; fires the long press once at 1.5 s, without waiting for release. */
  poll(t: number): TouchAction | null {
    if (this.downAt === null || this.longFired || t - this.downAt < LONG_PRESS_MS) return null;
    this.longFired = true;
    this.lastTapEnd = null;
    return "toggle_on";
  }

  up(t: number): TouchAction | null {
    if (this.downAt === null) return null;
    const held = t - this.downAt;
    const start = this.downAt;
    this.downAt = null;
    if (this.longFired) return null;
    if (held >= LONG_PRESS_MS) {
      this.lastTapEnd = null;
      return "toggle_on";
    }
    if (held > TAP_MAX_MS) {
      // A lingering touch (adjusting the device, hair): not a tap, and breaks any double tap.
      this.lastTapEnd = null;
      return null;
    }
    if (this.lastTapEnd !== null && start - this.lastTapEnd <= DOUBLE_TAP_GAP_MS) {
      this.lastTapEnd = null;
      return "toggle_mode";
    }
    this.lastTapEnd = t;
    return null;
  }

  /** Release without a gesture (finger slid off the surface). */
  cancel() {
    this.downAt = null;
    this.lastTapEnd = null;
  }
}
