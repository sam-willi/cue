"use client";

import type { ManySessions } from "@/lib/learning/demo";
import { useWidth } from "./PaceChart";

const H = 190;
const PAD = { left: 26, right: 6, top: 26, bottom: 22 };

/**
 * Slow-down taps per session: filled for taps felt, outlined for taps Cue held back to measure.
 * Bars in Cue's color used the new strategy. The band marks the experiment, from the session Cue
 * started it to the one it adopted the new strategy.
 */
export default function TapsChart({ run, started, adopted }: { run: ManySessions; started: number; adopted: number }) {
  const [ref, width] = useWidth();
  const n = run.sessions.length;
  const max = Math.max(...run.sessions.map((s) => s.rushingTaps + s.rushingHoldouts));
  const slot = (width - PAD.left - PAD.right) / n;
  const x = (i: number) => PAD.left + (i - 1) * slot; // left edge of session i (1-based)
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  const bar = Math.max(4, slot * 0.62);
  const ticks = Array.from({ length: max + 1 }, (_, k) => k).filter((k) => k % 2 === 0 || max <= 4);
  // The update after session `started` starts the test; its next session is the first one tested.
  const bandFrom = x(started + 1);
  const bandTo = x(adopted + 1);

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={`Slow-down taps in each of ${n} sessions. Cue tested a new strategy after session ${started} and adopted it after session ${adopted}.`}
          className="block overflow-visible text-caption"
        >
          <rect
            x={bandFrom}
            y={PAD.top - 6}
            width={bandTo - bandFrom}
            height={H - PAD.top - PAD.bottom + 6}
            fill="var(--cue-soft)"
          />
          <text x={bandFrom + 4} y={PAD.top - 12} fill="var(--cue)" fontWeight={600}>
            Testing
          </text>
          <line x1={bandTo} x2={bandTo} y1={PAD.top - 6} y2={H - PAD.bottom} stroke="var(--cue)" strokeWidth={1.5} />
          <text x={bandTo + 4} y={PAD.top - 12} fill="var(--cue)" fontWeight={600}>
            Adopted
          </text>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(v)} dy="0.32em" textAnchor="end" fill="var(--muted)">
                {v}
              </text>
            </g>
          ))}
          {run.sessions.map((s) => {
            const cx = x(s.index) + (slot - bar) / 2;
            const fill = s.strategy === "sustained" ? "var(--cue)" : "var(--neutral)";
            return (
              <g key={s.index}>
                <rect x={cx} y={y(s.rushingTaps)} width={bar} height={y(0) - y(s.rushingTaps)} rx={2} fill={fill} />
                {s.rushingHoldouts > 0 && (
                  <rect
                    x={cx + 0.75}
                    y={y(s.rushingTaps + s.rushingHoldouts) + 0.75}
                    width={bar - 1.5}
                    height={y(0) - y(s.rushingHoldouts) - 1.5}
                    rx={2}
                    fill="none"
                    stroke={fill}
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                  />
                )}
                {(s.index === 1 || s.index % 5 === 0) && (
                  <text x={x(s.index) + slot / 2} y={H - 4} textAnchor="middle" fill="var(--muted)">
                    {s.index}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export function TapsLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-caption text-muted">
      <li className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-neutral" /> Tap after a few seconds of rushing
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-cue" /> Tap only for longer stretches
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm border-[1.5px] border-dashed border-muted" /> Held back, to measure
      </li>
    </ul>
  );
}
