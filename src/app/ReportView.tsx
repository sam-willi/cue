"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  AREA_TECHNIQUE,
  type ReportSection,
  type SectionKey,
  type SessionReport,
  type SpeakScore,
} from "@/lib/cue/report";

/*
 * The after-session report (decision 19), drawn in color (decision 26). Two rules run through
 * every graphic here:
 *  - Each scored area has its own color, the same wherever it appears: its segment of the
 *    score ring, its icon, its chart, its technique. The five run in rainbow order, at full
 *    strength, on gray: no pale washes. Color says which area, never good or bad.
 *  - The part worth working on is drawn in ink (the page's text color), so it stands out from
 *    any of the hues, for every kind of color vision.
 */

/**
 * Each area's color, from the set in globals.css: a rainbow, in order round the score ring
 * (pauses red, pace orange, volume green, fillers blue, pitch violet). The two areas that aren't
 * scored stay neutral.
 */
const AREA: Record<SectionKey, string> = {
  pauses: "var(--area-pauses)",
  pace: "var(--area-pace)",
  volume: "var(--area-volume)",
  fillers: "var(--area-fillers)",
  pitch: "var(--area-pitch)",
  originality: "var(--neutral)",
  inclusive: "var(--neutral)",
};
const INK = "var(--text)";

/** What a track or ring shows where it isn't filled: plain gray, so the only color on show is the vivid one. */
const EMPTY = "var(--neutral-soft)";

const VERDICT_TAG: Record<ReportSection["verdict"], string> = {
  improve: "Work on this",
  good: "Going well",
  none: "No data",
};

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const duration = (sec: number) => (sec >= 90 ? `${(sec / 60).toFixed(1)} min` : `${Math.round(sec)} s`);
const percent = (x: number) => `${Math.round(x * 100)}%`;

/**
 * The width of an element as it's laid out, so a chart can draw at real pixel size and keep its
 * text crisp. The drawing itself is positioned out of the flow: if it took up space, its own
 * width would stop the element shrinking when the page narrows.
 */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function ReportView({
  report,
  script,
  onScript,
  customFillers,
  onAddFiller,
}: {
  report: SessionReport;
  script: string;
  onScript: (notes: string) => void;
  customFillers: string[];
  onAddFiller: (phrase: string) => void;
}) {
  const suggested = report.suggestedFillers.filter((f) => !customFillers.includes(f.phrase));
  const given = report.cues.reduce((n, c) => n + c.count, 0);
  const judged = report.cues.reduce((n, c) => n + c.judged, 0);
  const worked = report.cues.reduce((n, c) => n + c.worked, 0);
  const hasChart = (s: ReportSection) =>
    (s.key === "pace" && report.paceTimeline.length > 2) ||
    (s.key === "pauses" && report.stretches.length > 1) ||
    (s.key === "pitch" && report.pitchContour.length > 2);

  return (
    <div className="space-y-10">
      {/* The score, and right under it what to do differently: the two things most people came for. */}
      <div className="rounded-2xl border border-line">
        {report.score ? (
          <ScoreCard score={report.score} />
        ) : (
          <p className="p-5 text-body-sm text-muted sm:p-6">Talk for at least 30 seconds to get a Speak score.</p>
        )}
        <NextTime items={report.next} judged={report.score !== null} />
      </div>

      <div className="rounded-2xl border border-line">
        <dl className="grid grid-cols-2 sm:grid-cols-4">
          <Figure
            label="Talking time"
            value={report.talkSec >= 60 ? (report.talkSec / 60).toFixed(1) : String(Math.round(report.talkSec))}
            unit={report.talkSec >= 60 ? "min" : "s"}
          />
          <Figure label="Words" value={report.wordCount.toLocaleString("en-US")} />
          <Figure
            label="Cues given"
            value={String(given)}
            hint={
              given
                ? report.cues
                    .filter((c) => c.count)
                    .map((c) => `${c.action} ${c.count}`)
                    .join(", ")
                : undefined
            }
          />
          <Figure
            label="Cues that worked"
            value={judged ? String(worked) : "–"}
            unit={judged ? `of ${judged}` : undefined}
            hint={judged ? "You paused, slowed or spoke up after" : "None judged yet"}
          >
            {judged > 0 && <Track value={worked / judged} className="mt-2" />}
          </Figure>
        </dl>
        {/* Every area at a glance: a dot for what to work on, a tick for what's going well, a ring for no data. */}
        <ul className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line px-5 py-4">
          {report.sections.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-body-sm">
              <VerdictMark verdict={s.verdict} color={AREA[s.key]} />
              <span className={s.verdict === "none" ? "text-muted" : ""}>{s.title}</span>
              <span className="sr-only">: {VERDICT_TAG[s.verdict]}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {report.sections.map((s) => (
          <section
            key={s.key}
            className={`flex min-w-0 flex-col rounded-2xl border border-line p-5 sm:p-6 ${hasChart(s) ? "sm:col-span-2" : ""}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AreaChip area={s.key} quiet={s.verdict === "none"} />
                <h4 className="text-label font-medium">{s.title}</h4>
              </div>
              <span
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-caption ${
                  s.verdict === "improve" ? "bg-text font-medium text-bg" : "text-muted"
                }`}
              >
                <VerdictMark verdict={s.verdict} color={AREA[s.key]} />
                {VERDICT_TAG[s.verdict]}
              </span>
            </div>
            <p
              className={`mt-3 text-balance font-display text-title-m font-medium tracking-[-0.01em] sm:text-title ${
                s.verdict === "none" ? "text-muted" : ""
              }`}
            >
              {s.headline}
            </p>

            {s.key === "pace" && report.paceTimeline.length > 2 && (
              <PaceChart
                timeline={report.paceTimeline}
                limitWpm={report.paceLimitWpm}
                band={report.paceBandWpm}
                startSec={report.startSec}
              />
            )}
            {s.key === "pauses" && report.stretches.length > 1 && (
              <StretchStrip stretches={report.stretches} limitSec={report.stretchLimitSec} />
            )}
            {s.key === "pitch" && report.pitchContour.length > 2 && (
              <PitchChart contour={report.pitchContour} startSec={report.startSec} />
            )}
            {s.key === "pace" && report.rushed.length > 0 && (
              <div className="mt-5">
                <p className="text-caption text-muted">What you were saying when you sped up</p>
                <ul className="mt-2 space-y-3">
                  {report.rushed.map((p) => (
                    <li key={p.start} className="border-l-2 border-text pl-3">
                      <p className="text-caption tabular-nums text-muted">
                        {clock(p.start - report.startSec)} to {clock(p.end - report.startSec)}, about{" "}
                        {Math.round(p.wpm / 5) * 5} words a minute
                      </p>
                      <p className="mt-0.5 max-w-prose text-body-sm">“{p.text}”</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {s.share && <ShareMeter share={s.share} color={AREA[s.key]} />}
            {s.key === "fillers" && report.fillers.length > 0 && (
              <FillerBars fillers={report.fillers} accent={s.verdict === "improve"} />
            )}

            {s.stats.length > 0 && (
              <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
                {s.stats.map((x) => (
                  <div key={x.label}>
                    <dt className="text-caption text-muted">{x.label}</dt>
                    <dd className="text-body font-medium tabular-nums">{x.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {s.advice && <p className="mt-4 max-w-prose text-body-sm text-muted">{s.advice}</p>}
            {/* Every card offers its technique, drill included. It's open where the area needs work;
                otherwise one press shows it. */}
            <details className="group mt-4 rounded-xl bg-surface-2" open={s.verdict === "improve"}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-body-sm [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: AREA[s.key] }} />
                <span className="text-muted">Technique:</span>
                <span className="font-medium">{(s.technique ?? AREA_TECHNIQUE[s.key]).name}</span>
                <svg
                  aria-hidden
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="ml-auto shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
                >
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </summary>
              <p className="max-w-prose px-4 pb-4 text-body-sm text-muted">
                {(s.technique ?? AREA_TECHNIQUE[s.key]).how}
              </p>
            </details>

            {s.key === "fillers" && suggested.length > 0 && (
              <div className="mt-4">
                <p className="text-caption text-muted">
                  You also said these a lot. Add any that are fillers for you, and Cue will count them next time.
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {suggested.map((f) => (
                    <li key={f.phrase}>
                      <button
                        type="button"
                        onClick={() => onAddFiller(f.phrase)}
                        className="flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-body-sm hover:border-cue"
                      >
                        <span>
                          “{f.phrase}” <span className="tabular-nums text-muted">× {f.count}</span>
                        </span>
                        <span aria-hidden>+</span>
                        <span className="sr-only">Add to your filler words</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {s.key === "inclusive" && report.inclusive.length > 0 && (
              <ul className="mt-4 space-y-3">
                {report.inclusive.map((f) => (
                  <li key={f.phrase} className="text-body-sm">
                    <p>
                      <span className="font-medium">“{f.phrase}”</span>
                      {f.count > 1 && <span className="text-muted"> × {f.count}</span>}
                      <span className="text-muted"> Try: {f.instead}.</span>
                    </p>
                    <p className="mt-0.5 text-muted">“…{f.context}…”</p>
                  </li>
                ))}
              </ul>
            )}
            {s.key === "originality" && (
              <div className="mt-4">
                <label htmlFor="report-notes" className="text-caption text-muted">
                  Your notes or script. They stay in this browser tab.
                </label>
                <textarea
                  id="report-notes"
                  value={script}
                  onChange={(e) => onScript(e.target.value)}
                  rows={3}
                  placeholder="Paste what you planned to say"
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-body-sm placeholder:text-muted/70 focus:border-cue focus:outline-none"
                />
              </div>
            )}
          </section>
        ))}
      </div>
      <p className="max-w-prose text-body-sm text-muted">
        These lines are starting points and haven’t been tested with many speakers yet. Pitch and volume need a
        microphone session; a typed practice sentence has no voice to measure.
      </p>
    </div>
  );
}

/** A point on a circle, with 0° at the top and angles running clockwise. */
function onCircle(c: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [c + r * Math.cos(rad), c + r * Math.sin(rad)];
}

function arc(c: number, r: number, from: number, to: number) {
  const [x1, y1] = onCircle(c, r, from);
  const [x2, y2] = onCircle(c, r, to);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/**
 * The Speak score (decision 25): a ring cut into one segment per area, each as long as the
 * points it can earn and filled as far as the points it did. The list beside it says the same
 * thing in words and numbers, in the same order, clockwise from the top.
 */
function ScoreCard({ score }: { score: SpeakScore }) {
  const [on, setOn] = useState<number | null>(null);
  const size = 184;
  const c = size / 2;
  const r = c - 10;
  const gap = 5; // degrees of surface between segments
  const segments = score.parts.map((part, k) => {
    const from = score.parts.slice(0, k).reduce((deg, p) => deg + (p.max / 100) * 360, 0);
    const start = from + gap / 2;
    const end = from + (part.max / 100) * 360 - gap / 2;
    return { start, end, filled: start + (end - start) * (part.earned / part.max) };
  });
  return (
    <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:gap-10 sm:p-6">
      <div className="relative mx-auto shrink-0 sm:mx-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} aria-hidden>
          {segments.map((seg, k) => (
            <g key={k} opacity={on === null || on === k ? 1 : 0.3} className="transition-opacity duration-200">
              <path d={arc(c, r, seg.start, seg.end)} fill="none" stroke={EMPTY} strokeWidth={12} />
              {seg.filled - seg.start > 0.5 && (
                <path
                  d={arc(c, r, seg.start, seg.filled)}
                  pathLength={1}
                  className="report-draw"
                  fill="none"
                  stroke={AREA[score.parts[k].key]}
                  strokeWidth={12}
                />
              )}
            </g>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-caption text-muted">Speak score</p>
          <p className="font-display text-[52px] font-semibold leading-none tracking-[-0.03em]">{score.total}</p>
          <p className="mt-1 text-body-sm font-medium">{score.level}</p>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="sr-only">
          Speak score: {score.total} out of 100, {score.level}
        </h3>
        <ul className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-3">
          {score.parts.map((part, k) => (
            <li
              key={part.key}
              className="col-span-3 grid grid-cols-subgrid items-center"
              onPointerEnter={() => setOn(k)}
              onPointerLeave={() => setOn(null)}
            >
              <span className="flex items-center gap-2 text-body-sm">
                <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: AREA[part.key] }} />
                {part.title}
              </span>
              <Track value={part.earned / part.max} color={AREA[part.key]} />
              <span className="text-right text-body-sm tabular-nums">
                <span className="font-medium">{part.earned}</span>
                <span className="text-muted"> / {part.max}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-prose text-caption text-muted">
          Out of 100, from how easy this session was to listen to. It isn’t a test of perfect speech: a few filler words
          and a brisk pace still earn full points.
          {score.missing.length > 0 &&
            ` Not measured this time, so left out: ${score.missing.join(" and ").toLowerCase()}.`}
        </p>
      </div>
    </div>
  );
}

/**
 * What to do differently next time, directly under the score: each one an action in a few
 * words, how in one sentence, and the finding behind it. The cards below carry the detail.
 */
function NextTime({ items, judged }: { items: SessionReport["next"]; judged: boolean }) {
  return (
    <div className="border-t border-line p-5 sm:p-6">
      <h3 className="font-display text-heading-3-m font-semibold tracking-[-0.015em] sm:text-heading-3">
        {items.length ? "Next time, do this" : "Next time, do the same again"}
      </h3>
      {items.length ? (
        <ol className="mt-5 grid gap-5">
          {items.map((item, k) => (
            <li key={item.key} className="flex items-start gap-4">
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-text font-display text-body font-semibold tabular-nums text-bg"
              >
                {k + 1}
              </span>
              <div className="min-w-0">
                <p className="font-display text-title-m font-semibold tracking-[-0.01em] sm:text-title">
                  {item.action}
                </p>
                <p className="mt-1 max-w-prose text-body">{item.how}</p>
                <p className="mt-2 flex items-start gap-2 text-body-sm text-muted">
                  <span
                    aria-hidden
                    className="mt-1.5 size-2 shrink-0 rounded-full"
                    style={{ background: AREA[item.key] }}
                  />
                  <span>
                    {item.title}: {item.why.charAt(0).toLowerCase() + item.why.slice(1)}
                  </span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 max-w-prose text-body text-muted">
          {judged
            ? "Nothing in this session crossed a line worth changing."
            : "Nothing stood out yet. A longer session gives the report more to go on."}
        </p>
      )}
    </div>
  );
}

/** One headline number. Proportional figures: tabular ones look loose at this size. */
function Figure({
  label,
  value,
  unit,
  hint,
  children,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-line p-5 max-sm:[&:nth-child(-n+2)]:border-b max-sm:[&:nth-child(odd)]:border-r sm:[&:not(:last-child)]:border-r">
      <dt className="text-label text-muted">{label}</dt>
      <dd className="mt-1 font-display text-heading-2-m font-semibold tracking-[-0.02em] sm:text-heading-2">
        {value}
        {unit && <span className="ml-1.5 text-body font-normal tracking-normal text-muted">{unit}</span>}
      </dd>
      {children && <dd>{children}</dd>}
      {hint && <dd className="mt-1.5 text-caption text-muted">{hint}</dd>}
    </div>
  );
}

/**
 * A dot for "work on this", a tick for "going well", a ring for "no data": shape first, so it
 * never rests on color. The tick takes its area's color; the dot takes the ink around it.
 */
function VerdictMark({ verdict, color }: { verdict: ReportSection["verdict"]; color: string }) {
  if (verdict === "improve") return <span aria-hidden className="size-2 shrink-0 rounded-full bg-current" />;
  if (verdict === "good")
    return (
      <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" className="shrink-0" style={{ color }}>
        <path
          d="M2.5 6.5l2.3 2.3 4.7-5.3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  return <span aria-hidden className="size-2 shrink-0 rounded-full border border-muted/60" />;
}

/** An area's icon on its color: the same mark on its card and in "work on next". */
function AreaChip({ area, quiet = false }: { area: SectionKey; quiet?: boolean }) {
  const line = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
      style={{ background: quiet ? "var(--neutral)" : AREA[area], opacity: quiet ? 0.5 : 1 }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16">
        {area === "pauses" && <path d="M5.5 3.5v9M10.5 3.5v9" {...line} strokeWidth="2.4" />}
        {area === "pace" && <path d="M3 4l4 4-4 4M8.5 4l4 4-4 4" {...line} strokeWidth="1.8" />}
        {area === "volume" && <path d="M3.5 10.5v2M8 6.5v6M12.5 3v9.5" {...line} strokeWidth="2.2" />}
        {area === "fillers" && (
          <path
            d="M4 3h8a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 12 11H7.5l-3 2.5V11H4a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 4 3z"
            {...line}
            strokeWidth="1.6"
          />
        )}
        {area === "pitch" && <path d="M1.5 8q2.25-7.5 4.5 0t4.5 0t4 0" {...line} strokeWidth="1.8" />}
        {area === "originality" && <path d="M3.5 4.5h9M3.5 8h9M3.5 11.5h5.5" {...line} strokeWidth="1.8" />}
        {area === "inclusive" && (
          <>
            <circle cx="6" cy="8" r="3.5" {...line} strokeWidth="1.6" />
            <circle cx="10" cy="8" r="3.5" {...line} strokeWidth="1.6" />
          </>
        )}
      </svg>
    </span>
  );
}

/** A share of something as a filled track: the fill in color, the rest gray. */
function Track({
  value,
  color = "var(--neutral)",
  className = "",
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  return (
    <div className={`h-2 overflow-hidden rounded-full ${className}`} style={{ background: EMPTY }}>
      <div
        className="report-grow h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }}
      />
    </div>
  );
}

/** A share of the session against the line worth working on, which is marked on the track. */
function ShareMeter({ share, color }: { share: NonNullable<ReportSection["share"]>; color: string }) {
  const over = share.value >= share.line;
  return (
    <figure className="mt-5">
      <p className="flex items-baseline justify-between gap-3 text-body-sm">
        <span className="text-muted">{share.label}</span>
        <span className="font-medium tabular-nums">{percent(share.value)}</span>
      </p>
      <div className="relative mt-2.5 pb-5">
        {/* The area's color up to the line worth working on; anything past it in ink. */}
        <div className="relative h-2 overflow-hidden rounded-full" style={{ background: EMPTY }}>
          <div
            className="report-grow absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${Math.min(1, share.value) * 100}%`, background: over ? INK : color }}
          />
          <div
            className="report-grow absolute inset-y-0 left-0 rounded-l-full"
            style={{ width: `${Math.min(share.value, share.line) * 100}%`, background: color }}
          />
        </div>
        <span aria-hidden className="absolute -top-1 h-4 w-px bg-text" style={{ left: `${share.line * 100}%` }} />
        <span
          className="absolute top-4 whitespace-nowrap text-caption text-muted"
          style={
            share.line > 0.6
              ? { right: `${(1 - share.line) * 100}%`, paddingRight: 6 }
              : { left: `${share.line * 100}%`, paddingLeft: 6 }
          }
        >
          worth working on from {percent(share.line)}
        </span>
      </div>
    </figure>
  );
}

/** Each filler as a bar, most used first. The top one turns to ink when fillers are worth working on. */
function FillerBars({ fillers, accent }: { fillers: SessionReport["fillers"]; accent: boolean }) {
  const shown = fillers.slice(0, 6);
  const rest = fillers.slice(6);
  const max = shown[0].count;
  return (
    <figure className="mt-5">
      <ul className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2.5">
        {shown.map((f, k) => (
          <li key={f.word} className="col-span-3 grid grid-cols-subgrid items-center">
            <span className="text-body-sm">“{f.word}”</span>
            <span className="block h-2.5">
              <span
                className="report-grow block h-full min-w-1 rounded-r-[4px]"
                style={{ width: `${(f.count / max) * 100}%`, background: accent && k === 0 ? INK : AREA.fillers }}
              />
            </span>
            <span className="text-right text-body-sm font-medium tabular-nums">{f.count}</span>
          </li>
        ))}
      </ul>
      {rest.length > 0 && (
        <p className="mt-2.5 text-caption text-muted">
          and {rest.reduce((n, f) => n + f.count, 0)} more across {rest.length} other{" "}
          {rest.length === 1 ? "word" : "words"}
        </p>
      )}
    </figure>
  );
}

interface Hover {
  x: number;
  y: number;
  value: string;
  detail: string;
}

/** The small readout that follows the pointer: the value first, then when. */
function Tip({ hover, width }: { hover: Hover; width: number }) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-caption shadow-sm"
      style={{ left: Math.max(56, Math.min(width - 56, hover.x)), top: hover.y - 10 }}
    >
      <span className="font-medium tabular-nums text-text">{hover.value}</span>
      <span className="ml-2 tabular-nums text-muted">{hover.detail}</span>
    </div>
  );
}

/**
 * A value through the session as a line. Optional extras: a band marked by two hairlines (a comfortable range),
 * a reference line, ink on whatever rises above a limit, and a wash between the line and a
 * baseline. The line takes its area's color. Pointer and arrow keys read
 * out the nearest point.
 */
function TimeChart({
  points,
  domain,
  height = 168,
  band,
  rule,
  accentAbove,
  color,
  washTo,
  startSec,
  mark,
  format,
  label,
}: {
  points: { t: number; v: number }[];
  domain: [number, number];
  height?: number;
  band?: { lo: number; hi: number; label: string };
  rule?: { v: number; label: string };
  accentAbove?: number;
  color: string;
  /** Shade between the line and this value. */
  washTo?: number;
  /** When the talk began (s): times are shown from here, so they match the quotes and the pause strip. */
  startSec?: number;
  /** Which point gets the dot and the value label, if any does. */
  mark: "peak" | "none";
  format: (v: number) => string;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [at, setAt] = useState<number | null>(null);
  const clip = useId();
  const padTop = 22;
  const padBottom = 8;
  const padX = 6;
  const t0 = points[0].t;
  const origin = startSec ?? t0;
  const span = Math.max(1, points[points.length - 1].t - t0);
  const x = (t: number) => padX + ((t - t0) / span) * Math.max(1, width - 2 * padX);
  const y = (v: number) => padTop + (1 - (v - domain[0]) / (domain[1] - domain[0])) * (height - padTop - padBottom);
  const path = points.map((p, k) => `${k ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join("");
  const peak = points.reduce((best, p, k) => (p.v > points[best].v ? k : best), 0);
  const marked = peak;
  const over = accentAbove !== undefined && points[peak].v > accentAbove;
  const shown = at ?? null;
  const nearest = (clientX: number, left: number) => {
    const px = clientX - left;
    return points.reduce((best, p, k) => (Math.abs(x(p.t) - px) < Math.abs(x(points[best].t) - px) ? k : best), 0);
  };
  const labelAnchor = (px: number) => (px < 48 ? "start" : px > width - 48 ? "end" : "middle");

  return (
    <figure className="mt-5">
      <div
        ref={ref}
        role="img"
        aria-label={label}
        tabIndex={0}
        className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cue"
        style={{ height }}
        onPointerMove={(e) => setAt(nearest(e.clientX, e.currentTarget.getBoundingClientRect().left))}
        onPointerLeave={() => setAt(null)}
        onBlur={() => setAt(null)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          setAt((k) => Math.max(0, Math.min(points.length - 1, (k ?? marked) + (e.key === "ArrowLeft" ? -1 : 1))));
        }}
      >
        {width > 0 && (
          <svg width={width} height={height} className="absolute left-0 top-0 overflow-visible" aria-hidden>
            {band && (
              <>
                {/* The comfortable range as two hairlines, so the color under the line stays clean. */}
                <line x1={0} x2={width} y1={y(band.hi)} y2={y(band.hi)} stroke="var(--line)" strokeWidth={1} />
                <line x1={0} x2={width} y1={y(band.lo)} y2={y(band.lo)} stroke="var(--line)" strokeWidth={1} />
                <text x={8} y={y(band.lo) - 7} className="fill-muted text-[11px]">
                  {band.label}
                </text>
              </>
            )}
            {rule && <line x1={0} x2={width} y1={y(rule.v)} y2={y(rule.v)} stroke="var(--muted)" strokeWidth={1} />}
            {washTo !== undefined && (
              <path
                d={`${path}L${x(points[points.length - 1].t).toFixed(1)} ${y(washTo)}L${x(t0).toFixed(1)} ${y(washTo)}Z`}
                fill={color}
                fillOpacity={0.3}
              />
            )}
            <path
              d={path}
              pathLength={1}
              className="report-draw"
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {over && (
              <g clipPath={`url(#${clip})`}>
                <clipPath id={clip}>
                  <rect x={0} y={0} width={width} height={y(accentAbove)} />
                </clipPath>
                <path
                  d={path}
                  pathLength={1}
                  className="report-draw"
                  fill="none"
                  stroke={INK}
                  strokeWidth={3}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>
            )}
            {shown === null && mark === "peak" && (
              <>
                <circle
                  cx={x(points[marked].t)}
                  cy={y(points[marked].v)}
                  r={4.5}
                  fill={over ? INK : color}
                  stroke="var(--bg)"
                  strokeWidth={2}
                />
                <text
                  x={x(points[marked].t)}
                  y={Math.max(11, y(points[marked].v) - 10)}
                  textAnchor={labelAnchor(x(points[marked].t))}
                  className="fill-text text-[12px] font-medium"
                >
                  {format(points[marked].v)}
                </text>
              </>
            )}
            {shown !== null && (
              <>
                <line
                  x1={x(points[shown].t)}
                  x2={x(points[shown].t)}
                  y1={padTop - 8}
                  y2={height}
                  stroke="var(--muted)"
                  strokeWidth={1}
                />
                <circle
                  cx={x(points[shown].t)}
                  cy={y(points[shown].v)}
                  r={4.5}
                  fill={accentAbove !== undefined && points[shown].v > accentAbove ? INK : color}
                  stroke="var(--bg)"
                  strokeWidth={2}
                />
              </>
            )}
          </svg>
        )}
        {shown !== null && width > 0 && (
          <Tip
            width={width}
            hover={{
              x: x(points[shown].t),
              y: y(points[shown].v),
              value: format(points[shown].v),
              detail: `at ${clock(points[shown].t - origin)}`,
            }}
          />
        )}
      </div>
      {/* The reference line is named down here, beside a key, where no data can run through the words. */}
      <div className="mt-1.5 flex items-center justify-between gap-3 text-caption tabular-nums text-muted" aria-hidden>
        <span>{clock(t0 - origin)}</span>
        {rule && (
          <span className="flex items-center gap-2">
            <span className="h-px w-5 bg-muted" />
            {rule.label}
          </span>
        )}
        <span>{clock(t0 + span - origin)}</span>
      </div>
    </figure>
  );
}

/** Pace through the session, over the comfortable range, with any rushing picked out. */
function PaceChart({
  timeline,
  limitWpm,
  band,
  startSec,
}: {
  timeline: SessionReport["paceTimeline"];
  limitWpm: number;
  band: [number, number];
  startSec: number;
}) {
  const values = timeline.map((p) => p.wpm);
  const lo = Math.min(band[0] * 0.85, ...values);
  const hi = Math.max(limitWpm * 1.12, ...values) * 1.04;
  return (
    <TimeChart
      points={timeline.map((p) => ({ t: p.t, v: p.wpm }))}
      domain={[lo, hi]}
      band={{ lo: band[0], hi: band[1], label: `comfortable, ${band[0]} to ${band[1]} wpm` }}
      rule={{ v: limitWpm, label: `rushing above about ${limitWpm} wpm` }}
      accentAbove={limitWpm}
      color={AREA.pace}
      washTo={lo}
      startSec={startSec}
      mark="peak"
      format={(v) => `${Math.round(v)} wpm`}
      label={`Pace through the session, between ${Math.round(Math.min(...values))} and ${Math.round(Math.max(...values))} words a minute. Rushing is above about ${limitWpm}.`}
    />
  );
}

/** The voice's pitch through the session, around the wearer's typical pitch. */
function PitchChart({ contour, startSec }: { contour: SessionReport["pitchContour"]; startSec: number }) {
  const reach = Math.max(4, ...contour.map((p) => Math.abs(p.st))) * 1.15;
  const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)} semitones`;
  return (
    <TimeChart
      points={contour.map((p) => ({ t: p.t, v: p.st }))}
      domain={[-reach, reach]}
      height={140}
      rule={{ v: 0, label: "your typical pitch" }}
      color={AREA.pitch}
      washTo={0}
      startSec={startSec}
      mark="none"
      format={signed}
      label={`Pitch through the session, from ${signed(Math.min(...contour.map((p) => p.st)))} to ${signed(Math.max(...contour.map((p) => p.st)))} around your typical pitch.`}
    />
  );
}

/**
 * The session as a strip: each bar is a stretch of talking, each gap a pause. The longest
 * stretch is labeled, and turns to ink if it ran past the point where a pause was due.
 */
function StretchStrip({ stretches, limitSec }: { stretches: SessionReport["stretches"]; limitSec: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [at, setAt] = useState<number | null>(null);
  const height = 58;
  const barY = 26;
  const barH = 18;
  const t0 = stretches[0].start;
  const span = Math.max(1, stretches[stretches.length - 1].end - t0);
  const x = (t: number) => ((t - t0) / span) * width;
  const len = (s: { start: number; end: number }) => s.end - s.start;
  const longest = stretches.reduce((best, s, k) => (len(s) > len(stretches[best]) ? k : best), 0);
  const tooLong = len(stretches[longest]) > limitSec;
  const mid = (k: number) => (x(stretches[k].start) + x(stretches[k].end)) / 2;
  const nearest = (clientX: number, left: number) => {
    const px = clientX - left;
    return stretches.reduce((best, _, k) => (Math.abs(mid(k) - px) < Math.abs(mid(best) - px) ? k : best), 0);
  };
  const labelX = Math.max(4, Math.min(width - 4, mid(longest)));

  return (
    <figure className="mt-5">
      <div
        ref={ref}
        role="img"
        aria-label={`${stretches.length} stretches of talking with pauses between them. The longest ran ${duration(len(stretches[longest]))} without a pause.`}
        tabIndex={0}
        className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cue"
        style={{ height }}
        onPointerMove={(e) => setAt(nearest(e.clientX, e.currentTarget.getBoundingClientRect().left))}
        onPointerLeave={() => setAt(null)}
        onBlur={() => setAt(null)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          setAt((k) => Math.max(0, Math.min(stretches.length - 1, (k ?? longest) + (e.key === "ArrowLeft" ? -1 : 1))));
        }}
      >
        {width > 0 && (
          <svg width={width} height={height} className="absolute left-0 top-0 overflow-visible" aria-hidden>
            <rect x={0} y={barY + barH / 2 - 0.5} width={width} height={1} fill="var(--line)" />
            {stretches.map((s, k) => {
              // A hair of space either side, so two stretches split by a short pause never touch.
              const w = Math.max(2, x(s.end) - x(s.start) - 2);
              return (
                <rect
                  key={k}
                  x={x(s.start) + 1}
                  y={barY}
                  width={w}
                  height={barH}
                  rx={Math.min(4, w / 2)}
                  fill={k === longest && tooLong ? INK : AREA.pauses}
                  opacity={at === null || at === k ? 1 : 0.45}
                />
              );
            })}
            {at === null && (
              <text
                x={labelX}
                y={barY - 9}
                textAnchor={labelX < 70 ? "start" : labelX > width - 70 ? "end" : "middle"}
                className="fill-text text-[12px] font-medium"
              >
                longest without a pause, {duration(len(stretches[longest]))}
              </text>
            )}
          </svg>
        )}
        {at !== null && width > 0 && (
          <Tip
            width={width}
            hover={{
              x: mid(at),
              y: barY,
              value: `${duration(len(stretches[at]))} without a pause`,
              detail: `from ${clock(stretches[at].start - t0)}`,
            }}
          />
        )}
      </div>
      <div className="flex justify-between text-caption tabular-nums text-muted" aria-hidden>
        <span>0:00</span>
        <span>each gap is a pause</span>
        <span>{clock(span)}</span>
      </div>
    </figure>
  );
}
