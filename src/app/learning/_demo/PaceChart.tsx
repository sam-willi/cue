"use client";

import { useEffect, useRef, useState } from "react";
import type { Trace } from "@/lib/learning/demo";

const H = 150;
const PAD = { left: 34, right: 8, top: 22, bottom: 22 };

/** A y range, words a minute, that fits every trace given, so charts side by side compare. */
export function paceDomain(...traces: Trace[]): [number, number] {
  const all = traces.flatMap((t) => [...t.pace, ...t.limit].map((p) => p.wpm));
  return [Math.floor((Math.min(...all) - 10) / 20) * 20, Math.ceil((Math.max(...all) + 10) / 20) * 20];
}

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

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}`;

/** Pace through a session (area color), the slow-down point in force (dashed, Cue), and each tap. */
export default function PaceChart({ trace, domain }: { trace: Trace; domain: [number, number] }) {
  const [ref, width] = useWidth();
  const [lo, hi] = domain;
  const x = (t: number) => PAD.left + (t / trace.duration) * (width - PAD.left - PAD.right);
  const y = (wpm: number) => PAD.top + ((hi - wpm) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const line = (pts: { t: number; wpm: number }[]) => pts.map((p) => `${x(p.t)},${y(p.wpm)}`).join(" ");
  const ticks = [lo, (lo + hi) / 2, hi];
  const minutes = Array.from({ length: Math.floor(trace.duration / 60) + 1 }, (_, k) => k * 60);
  const rushing = trace.taps.filter((t) => t.behavior === "rushing");

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={`Pace over ${mmss(trace.duration)}, with ${rushing.length} slow-down taps`}
          className="block overflow-visible text-caption"
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(v)} dy="0.32em" textAnchor="end" fill="var(--muted)">
                {Math.round(v)}
              </text>
            </g>
          ))}
          {minutes.map((t) => (
            <text key={t} x={x(t)} y={H - 4} textAnchor={t === 0 ? "start" : "middle"} fill="var(--muted)">
              {mmss(t)}
            </text>
          ))}
          {/* Taps sit on a strip along the top, at the moment they were felt. */}
          {rushing.map((tap) => (
            <g key={tap.t}>
              <line
                x1={x(tap.t)}
                x2={x(tap.t)}
                y1={8}
                y2={H - PAD.bottom}
                stroke="var(--cue)"
                strokeOpacity={0.35}
                strokeWidth={1}
              />
              <circle cx={x(tap.t)} cy={8} r={5} fill="var(--cue)" />
            </g>
          ))}
          <polyline
            points={line(trace.limit)}
            fill="none"
            stroke="var(--cue)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <polyline
            points={line(trace.pace)}
            fill="none"
            stroke="var(--area-pace)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}

export function PaceLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-caption text-muted">
      <li className="flex items-center gap-1.5">
        <span className="h-[3px] w-4 rounded-full bg-[var(--area-pace)]" /> Pace, words a minute
      </li>
      <li className="flex items-center gap-1.5">
        <span className="w-4 border-t-[1.5px] border-dashed border-cue" /> Slow-down point
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-cue" /> Tap
      </li>
    </ul>
  );
}
