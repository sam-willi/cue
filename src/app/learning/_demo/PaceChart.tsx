"use client";

import { useId } from "react";
import type { Trace } from "@/lib/learning/demo";
import { useWidth } from "./hooks";

const H = 150;
const PAD = { left: 34, right: 8, top: 22, bottom: 22 };
/** A change of slow-down point mid-session worth pointing out, words a minute. */
const NOTABLE_SHIFT = 5;

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}`;

/**
 * Pace through a session (area color), the slow-down point in force (dashed, Cue), and each tap,
 * drawn up to `progress` of the session so a session can play out.
 */
export default function PaceChart({
  trace,
  domain,
  progress = 1,
}: {
  trace: Trace;
  domain: [number, number];
  progress?: number;
}) {
  const [ref, width] = useWidth();
  const clip = useId();
  const [lo, hi] = domain;
  const now = progress * trace.duration;
  const x = (t: number) => PAD.left + (t / trace.duration) * (width - PAD.left - PAD.right);
  const y = (wpm: number) => PAD.top + ((hi - wpm) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const line = (pts: { t: number; wpm: number }[]) => pts.map((p) => `${x(p.t)},${y(p.wpm)}`).join(" ");
  const ticks = [lo, (lo + hi) / 2, hi];
  const minutes = Array.from({ length: Math.floor(trace.duration / 60) + 1 }, (_, k) => k * 60);
  const total = trace.taps.filter((t) => t.behavior === "rushing").length;
  const taps = trace.taps.filter((t) => t.behavior === "rushing" && t.t <= now);
  // Without a learned pace, a session learns one after a minute of speech: the step in the line.
  const [, before, after] = trace.limit;
  const learned = after && Math.abs(after.wpm - before.wpm) >= NOTABLE_SHIFT && now >= after.t ? after : null;

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={`Pace over ${mmss(trace.duration)}, with ${total} slow-down taps`}
          className="block overflow-visible text-caption"
        >
          <defs>
            <clipPath id={clip}>
              <rect x={0} y={0} width={x(now)} height={H} />
            </clipPath>
          </defs>
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
          {taps.map((tap) => (
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
          <g clipPath={`url(#${clip})`}>
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
          </g>
          {learned && (
            <text x={x(learned.t) + 6} y={y(Math.max(learned.wpm, before.wpm)) - 6} fill="var(--cue)" fontWeight={600}>
              Cue learns their pace
            </text>
          )}
          {progress > 0 && progress < 1 && (
            <line x1={x(now)} x2={x(now)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--muted)" strokeWidth={1} />
          )}
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
