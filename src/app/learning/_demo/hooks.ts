// For the demo's client components.
import { useEffect, useRef, useState } from "react";

export function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Milliseconds into a played sequence, `total` long, and a function that plays it from the start.
 * With reduced motion it jumps straight to the end.
 */
export function useTimeline(total: number) {
  const [elapsed, setElapsed] = useState(0);
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function play() {
    cancelAnimationFrame(frame.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setElapsed(total);
      return;
    }
    setElapsed(0);
    const t0 = performance.now();
    const tick = (now: number) => {
      const e = Math.min(total, now - t0);
      setElapsed(e);
      if (e < total) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }
  return [elapsed, play] as const;
}
