"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ColorwayId } from "@/lib/preorder/offer";
import Rings, { type CuePlay } from "./Rings";
import s from "./preorder.module.css";

/** The product cut-outs made by scripts/colorway-cutouts.mjs, with their pixel sizes. */
export const CUTOUTS = {
  /** Three-quarter view, from assets/product/cue-colorways-renders.webp. */
  render: { w: 507, h: 580 },
  /** Side view with the touch area, from assets/product/cue-colorways-side.webp. */
  side: { w: 241, h: 612 },
} as const;
export type CutoutView = keyof typeof CUTOUTS;

export const cutout = (color: ColorwayId, view: CutoutView) => `/preorder/cutout/${color}-${view}.webp`;

/** Where the motor sits on each cut-out that can play a cue, as percentages of it. */
const MOTOR: Partial<Record<CutoutView, { x: number; y: number }>> = {
  render: { x: 80, y: 57 },
};

/** How long the arrival takes before the device taps hello (matches floatIn in the CSS). */
const ARRIVE_MS = 700;

/**
 * A product cut-out placed like a collage piece: tilted, often running off the page's edge.
 *
 * It arrives the first time it scrolls into view (fades, rises and settles), then keeps moving
 * with the scroll: `speed` drifts it against the page and `spin` turns it, both measured from
 * where it sits in the viewport, so it's at rest when centred and drifts either side. While on
 * screen it also bobs gently. With `tapOnArrive` it gives one tap, rings and all, as it lands;
 * `play` draws a cue on demand. Position and size come in through `className`/`style`
 * (left/right/top/width, --r for the resting tilt). Reduced motion: it simply appears.
 */
export default function Cutout({
  color,
  view = "render",
  alt,
  speed = 0,
  spin = 0,
  delay = 0,
  bob = 0,
  tapOnArrive = false,
  play = null,
  priority = false,
  sizes = "50vw",
  className,
  style,
}: {
  color: ColorwayId;
  view?: CutoutView;
  alt: string;
  /** Pixels of drift per pixel the element is from the viewport's centre. */
  speed?: number;
  /** Degrees of turn per 100 px the element is from the viewport's centre. */
  spin?: number;
  delay?: number;
  /** Phase of the idle bob in seconds, so devices near each other don't bob in step. */
  bob?: number;
  tapOnArrive?: boolean;
  play?: CuePlay | null;
  priority?: boolean;
  sizes?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [arrived, setArrived] = useState(false);
  const [hello, setHello] = useState<CuePlay | null>(null);

  // Arrive once, the first time it's on screen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setArrived(true);
        io.disconnect();
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Tap hello as it lands.
  useEffect(() => {
    if (!arrived || !tapOnArrive || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => setHello({ pattern: "tap", n: 1 }), delay + ARRIVE_MS);
    return () => window.clearTimeout(t);
  }, [arrived, tapOnArrive, delay]);

  // Drift and turn with the scroll, measured from the viewport's centre.
  useEffect(() => {
    const el = ref.current;
    if (!el || (!speed && !spin) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    // Where the element sits in the page, without the drift we add, so the drift can't feed back.
    let top = 0;
    let height = 0;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const drift = parseFloat(el.style.getPropertyValue("--py")) || 0;
      top = r.top + window.scrollY - drift;
      height = r.height;
    };
    const move = () => {
      frame = 0;
      // Half the movement on a phone, where there's little room around the text.
      const k = window.innerWidth < 760 ? 0.5 : 1;
      // Only the stretch near the viewport matters; beyond it the device is off screen anyway.
      const reach = window.innerHeight * 1.2;
      const raw = top + height / 2 - (window.scrollY + window.innerHeight / 2);
      const offset = Math.max(-reach, Math.min(reach, raw)) * k;
      el.style.setProperty("--py", `${Math.round(offset * speed)}px`);
      el.style.setProperty("--spin", `${((offset / 100) * spin).toFixed(2)}deg`);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(move);
    };
    const onResize = () => {
      measure();
      onScroll();
    };
    measure();
    move();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(frame);
    };
  }, [speed, spin]);

  const { w, h } = CUTOUTS[view];
  return (
    <div ref={ref} className={`${s.float} ${className ?? ""}`} style={style}>
      <div className={`${s.floatIn} ${arrived ? s.arrived : ""}`} style={{ "--delay": `${delay}ms` } as CSSProperties}>
        <div className={s.bob} style={{ "--bob": `${-bob}s` } as CSSProperties}>
          <Image
            className={s.cutout}
            src={cutout(color, view)}
            alt={alt}
            width={w}
            height={h}
            priority={priority}
            sizes={sizes}
            // Served as made: they're small already, and the optimizer shrinks transparent WebPs.
            unoptimized
          />
          {MOTOR[view] && <Rings {...MOTOR[view]} play={play ?? hello} />}
        </div>
      </div>
    </div>
  );
}
