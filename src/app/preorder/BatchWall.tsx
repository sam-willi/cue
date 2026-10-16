"use client";

import { useMemo, useState } from "react";
import { COLORWAYS, OFFER } from "@/lib/preorder/offer";
import s from "./preorder.module.css";

const SIZE = OFFER.batch.size;
/** The golden angle: each number sits this far round from the last, so the disc fills evenly. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const VIEW = 1000;
const DOT = 13;

/** Number n (1-based) of the batch, placed on a sunflower spiral from #001 at the center outward. */
function place(n: number) {
  const r = (VIEW / 2 - DOT - 4) * Math.sqrt((n - 0.5) / SIZE);
  const a = n * GOLDEN;
  // Rounded, so the server and the browser draw the same numbers (their sin/cos differ in the last digits).
  return {
    x: Math.round((VIEW / 2 + r * Math.cos(a)) * 10) / 10,
    y: Math.round((VIEW / 2 + r * Math.sin(a)) * 10) / 10,
  };
}

const SWATCH = Object.fromEntries(COLORWAYS.map((c) => [c.id, c]));
const label = (n: number) => `#${String(n).padStart(3, "0")}`;

/**
 * The batch as a collection, after lilguy's wall of eye looks: one dot per number, #001 at the
 * center. Taken numbers show the finish their owner chose; the next open number glows. Pointing
 * at a dot names it. `taken` is null when deposits aren't open yet.
 */
export default function BatchWall({ taken }: { taken: (string | null)[] | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const dots = useMemo(() => Array.from({ length: SIZE }, (_, i) => ({ n: i + 1, ...place(i + 1) })), []);
  const count = taken?.length ?? 0;
  const next = count < SIZE ? count + 1 : null;

  const caption =
    hover === null
      ? next
        ? `${label(next)} is next.`
        : "Batch 1 is full."
      : hover <= count
        ? `${label(hover)} · ${SWATCH[taken?.[hover - 1] ?? ""]?.name.toLowerCase() ?? "reserved"}`
        : `${label(hover)} · open`;

  return (
    <figure className={s.wall}>
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        role="img"
        aria-label={`Batch ${OFFER.batch.number}: ${count} of ${SIZE} numbers taken.${next ? ` The next is ${label(next)}.` : ""}`}
        onPointerLeave={() => setHover(null)}
      >
        {dots.map((d) => {
          const color = d.n <= count ? SWATCH[taken?.[d.n - 1] ?? ""]?.swatch : undefined;
          return (
            <circle
              key={d.n}
              cx={d.x}
              cy={d.y}
              r={DOT}
              className={`${s.wallDot} ${d.n <= count ? s.taken : ""} ${d.n === next ? s.next : ""} ${d.n === hover ? s.hovered : ""}`}
              style={color ? { fill: color } : undefined}
              onPointerEnter={() => setHover(d.n)}
            />
          );
        })}
      </svg>
      <figcaption className={s.wallCaption} aria-live="polite">
        <span className={s.wallNumber}>{caption}</span>
        <span>
          {count} of {SIZE} taken
        </span>
      </figcaption>
    </figure>
  );
}
