"use client";

import { useEffect, useState } from "react";
import { PATTERNS, type CuePattern } from "@/lib/cue/patterns";
import s from "./preorder.module.css";

/** One play of a cue. Bump `n` to play the same pattern again. */
export interface CuePlay {
  pattern: CuePattern;
  n: number;
}

/** When each pulse of a pattern starts and how long it runs (ms), from its vibrate on/off list. */
export function pulses(pattern: CuePattern): { at: number; ms: number }[] {
  const out: { at: number; ms: number }[] = [];
  let t = 0;
  PATTERNS[pattern].vibrate.forEach((ms, i) => {
    if (i % 2 === 0) out.push({ at: t, ms });
    t += ms;
  });
  return out;
}

/**
 * A cue drawn on a photo, where the device's motor is (`x`, `y` as percentages of the photo):
 * the motor glows while it's driven and a ring leaves it on every pulse (DESIGN.md §11).
 */
export default function Rings({ x, y, play }: { x: number; y: number; play: CuePlay | null }) {
  const [rings, setRings] = useState<{ key: string; delay: number; long: boolean }[]>([]);
  const [driving, setDriving] = useState(false);

  useEffect(() => {
    if (!play) return;
    const list = pulses(play.pattern);
    const timers: number[] = [];
    // Defer to the next frame: the play itself is what changed, not this component's render.
    timers.push(
      window.setTimeout(() => {
        setRings(list.map((p, i) => ({ key: `${play.n}-${i}`, delay: p.at, long: p.ms >= 300 })));
      }, 0),
    );
    for (const p of list) {
      timers.push(window.setTimeout(() => setDriving(true), p.at));
      timers.push(window.setTimeout(() => setDriving(false), p.at + Math.max(p.ms, 90)));
    }
    const end = list.at(-1)!;
    timers.push(window.setTimeout(() => setRings([]), end.at + 1800));
    return () => timers.forEach(window.clearTimeout);
  }, [play]);

  return (
    <span
      aria-hidden="true"
      className={`${s.rings} ${driving ? s.driving : ""}`}
      style={{ "--x": `${x}%`, "--y": `${y}%` } as React.CSSProperties}
    >
      <span className={s.motor} />
      {rings.map((r) => (
        <span
          key={r.key}
          className={`${s.ring} ${r.long ? s.long : ""}`}
          style={{ "--delay": `${r.delay}ms` } as React.CSSProperties}
        />
      ))}
    </span>
  );
}
