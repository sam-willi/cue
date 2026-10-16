"use client";

import Image from "next/image";
import { useEffect, useRef, type CSSProperties } from "react";
import type { ColorwayId } from "@/lib/preorder/offer";
import Rings, { type CuePlay } from "./Rings";
import s from "./preorder.module.css";

/** The product cut-outs made by scripts/colorway-cutouts.mjs, with their pixel sizes. */
export const CUTOUTS = {
  device: { w: 458, h: 408 },
  "three-quarter": { w: 313, h: 254 },
  side: { w: 95, h: 250 },
  front: { w: 101, h: 250 },
  back: { w: 95, h: 250 },
  case: { w: 592, h: 309 },
  /** The larger studio render, for the hero and the cue section (the cards keep `device`). */
  render: { w: 507, h: 580 },
} as const;
export type CutoutView = keyof typeof CUTOUTS;

export const cutout = (color: ColorwayId, view: CutoutView) => `/preorder/cutout/${color}-${view}.webp`;

/** Where the motor sits on each cut-out that can play a cue, as percentages of it. */
const MOTOR: Partial<Record<CutoutView, { x: number; y: number }>> = {
  device: { x: 84, y: 60 },
  render: { x: 80, y: 57 },
};

/**
 * A product cut-out placed like a collage piece: tilted, often running off the page's edge, and
 * drifting a little against the scroll (`speed` × scroll distance). `play` draws a cue's rings
 * from the motor. Position and size come in through `style` (left/right/top/width, --r for tilt).
 */
export default function Cutout({
  color,
  view = "device",
  alt,
  speed = 0,
  delay = 0,
  play = null,
  priority = false,
  sizes = "50vw",
  className,
  style,
}: {
  color: ColorwayId;
  view?: CutoutView;
  alt: string;
  speed?: number;
  delay?: number;
  play?: CuePlay | null;
  priority?: boolean;
  sizes?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !speed || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const move = () => {
      frame = 0;
      el.style.translate = `0 ${Math.round(window.scrollY * speed)}px`;
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(move);
    };
    move();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [speed]);

  const { w, h } = CUTOUTS[view];
  return (
    <div ref={ref} className={`${s.float} ${className ?? ""}`} style={style}>
      <div className={s.floatIn} style={{ "--delay": `${delay}ms` } as CSSProperties}>
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
        {MOTOR[view] && <Rings {...MOTOR[view]} play={play} />}
      </div>
    </div>
  );
}
