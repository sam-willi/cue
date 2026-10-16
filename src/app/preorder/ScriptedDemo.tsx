"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { CuePattern } from "@/lib/cue/patterns";
import { panel } from "@/lib/preorder/offer";
import { ON_EAR_MOTOR } from "./Hero";
import Rings, { type CuePlay } from "./Rings";
import s from "./preorder.module.css";

/**
 * A sprint review, as the page scrolls: each habit gets its cue, and the next line is the same
 * thought said again, better. The cues are the product's three (DESIGN.md §11); the numbers
 * are illustrative, and the voice demo below runs the real engine.
 */
type Kind = "redo" | "better";
interface Line {
  text: string;
  kind: Kind;
  style?: "fast" | "quiet";
  /** Time per word, in steps (a normal word is 1). */
  pace?: number;
  /** Words per minute shown while this line is spoken: [first word, last word]. */
  wpm: [number, number];
  /** A cue after this word (index in the line). */
  cue?: { at: number; pattern: CuePattern; label: string; why: string };
  /** Flagged filler words, by index in the line. */
  fillers?: number[];
  /** Silence after the line, in steps. */
  gap?: number;
}

const SCRIPT: Line[] = [
  {
    text: "okay so, um, this sprint we, uh, moved auth over and it’s, um, basically done,",
    kind: "redo",
    wpm: [150, 156],
    fillers: [2, 6, 12],
    cue: { at: 12, pattern: "tap", label: "pause", why: "3 fillers in 9 s" },
    gap: 5,
  },
  { text: "Auth is on the new service. Login works. Tokens refresh.", kind: "better", wpm: [142, 138], gap: 2 },
  {
    text: "and then the cache layer we rewrote because the old one kept leaking and honestly it’s way faster now and",
    kind: "redo",
    style: "fast",
    pace: 0.55,
    wpm: [168, 232],
    cue: { at: 15, pattern: "steps", label: "slow down", why: "232 wpm" },
    gap: 4,
  },
  { text: "The new cache is three times faster.", kind: "better", wpm: [140, 136], gap: 2 },
  {
    text: "the only real risk is friday’s migration…",
    kind: "redo",
    style: "quiet",
    pace: 1.2,
    wpm: [128, 118],
    cue: { at: 6, pattern: "push", label: "speak up", why: "trailing off" },
    gap: 4,
  },
  { text: "The one risk is Friday’s migration. We have a rollback plan.", kind: "better", wpm: [140, 140], gap: 3 },
];

interface TimedWord {
  text: string;
  t: number;
  line: number;
  filler: boolean;
  wpm: number;
}

/** Lays the script out on one clock: every word gets the step it's spoken at. */
function timeline() {
  const words: TimedWord[] = [];
  const cues: { t: number; line: number; pattern: CuePattern; label: string; why: string }[] = [];
  const lineStart: number[] = [];
  let t = 0;
  SCRIPT.forEach((line, l) => {
    lineStart.push(t);
    const parts = line.text.split(" ");
    parts.forEach((text, i) => {
      const wpm = Math.round(line.wpm[0] + ((line.wpm[1] - line.wpm[0]) * i) / Math.max(1, parts.length - 1));
      words.push({ text, t, line: l, filler: !!line.fillers?.includes(i), wpm });
      if (line.cue?.at === i) cues.push({ t: t + 0.6, line: l, ...line.cue });
      t += line.pace ?? 1;
    });
    t += line.gap ?? 1;
  });
  return { words, cues, lineStart, end: t };
}

const TIMELINE = timeline();

/** How far the visitor has scrolled through `el` while it's pinned, 0 to 1. */
function progressThrough(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const span = r.height - window.innerHeight;
  return span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 1;
}

export default function ScriptedDemo() {
  const { words, cues, end } = TIMELINE;
  const root = useRef<HTMLDivElement>(null);
  const linesBox = useRef<HTMLDivElement>(null);
  const lineEls = useRef<(HTMLSpanElement | null)[]>([]);
  const lastT = useRef(-1);
  const [t, setT] = useState(-1);
  const [play, setPlay] = useState<CuePlay | null>(null);
  const [shift, setShift] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const id = window.setTimeout(() => {
        setReduced(true);
        setT(end);
      }, 0);
      return () => window.clearTimeout(id);
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!root.current) return;
      // A little lead-in and run-out, so the first word and the last cue aren't at the very edges.
      const now = progressThrough(root.current) * (end + 4) - 1;
      const before = lastT.current;
      lastT.current = now;
      // A cue plays when the visitor scrolls forward past it, not when scrolling back up.
      const crossed = cues.findLast((c) => before < c.t && now >= c.t);
      if (crossed) setPlay((p) => ({ pattern: crossed.pattern, n: (p?.n ?? 0) + 1 }));
      setT(now);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [cues, end]);

  const current = words.findLast((w) => w.t <= t);
  const lineNow = current?.line ?? 0;

  // Keep the line being spoken in view, like a teleprompter.
  useEffect(() => {
    if (reduced) return;
    const box = linesBox.current;
    const el = lineEls.current[lineNow];
    if (!box || !el) return;
    const target = Math.max(0, el.offsetTop - box.clientHeight * 0.32);
    const id = window.requestAnimationFrame(() => setShift(target));
    return () => window.cancelAnimationFrame(id);
  }, [lineNow, reduced]);

  const fillers = words.filter((w) => w.filler && w.t <= t).length;
  const activeCue = cues.findLast((c) => c.t <= t && t < c.t + 4.5);

  return (
    <div ref={root} className={s.demo} id="hear-it">
      <div className={s.demoSticky}>
        <div className={s.wrap}>
          <div className={s.demoGrid}>
            <div>
              <span className={s.eyebrow}>Sprint review, Thursday, 10:02</span>
              <div ref={linesBox} className={reduced ? undefined : s.tBox}>
                <p
                  className={s.transcript}
                  style={{
                    transform: `translateY(${-shift}px)`,
                    transition: "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                >
                  {SCRIPT.map((line, l) => (
                    <span
                      key={l}
                      ref={(el) => {
                        lineEls.current[l] = el;
                      }}
                      className={`${s.tLine} ${s[line.kind]} ${line.style ? s[line.style] : ""} ${l < lineNow ? s.past : ""}`}
                    >
                      {words
                        .filter((w) => w.line === l)
                        .map((w, i) => (
                          <span key={i}>
                            <span className={`${s.word} ${w.filler ? s.flag : ""} ${w.t <= t ? s.said : ""}`}>
                              {w.text}
                            </span>{" "}
                          </span>
                        ))}
                      {line.cue && (
                        <span className={s.srOnly}>
                          Cue: {line.cue.label}, {line.cue.why}.
                        </span>
                      )}
                    </span>
                  ))}
                </p>
              </div>
            </div>

            <div className={s.demoSide}>
              <figure className={s.demoPhoto}>
                <Image
                  src={panel("graphite", "on-ear")}
                  alt="Cue in Graphite, worn behind the ear"
                  width={509}
                  height={298}
                  sizes="(max-width: 860px) 100vw, 40vw"
                />
                <Rings {...ON_EAR_MOTOR.graphite} play={play} />
              </figure>
              <div className={s.readouts} aria-hidden="true">
                <div className={s.readout}>
                  <span className={s.readoutLabel}>Pace</span>
                  <span className={s.readoutValue}>{current ? `${current.wpm} wpm` : "—"}</span>
                </div>
                <div className={s.readout}>
                  <span className={s.readoutLabel}>Fillers, last minute</span>
                  <span className={s.readoutValue}>{fillers}</span>
                </div>
              </div>
              <div className={`${s.cueToast} ${activeCue && !reduced ? s.show : ""}`} aria-hidden="true">
                <span>
                  <span className={s.dot} style={{ display: "inline-block", marginRight: 10 }} />
                  {activeCue?.label ?? "listening"}
                </span>
                <small>{activeCue?.why}</small>
              </div>
            </div>
          </div>
        </div>
        {!reduced && (
          <div
            className={s.progress}
            aria-hidden="true"
            style={{ opacity: t >= end ? 0 : 1, transition: "opacity 300ms" }}
          >
            <div className={s.progressBar} style={{ transform: `scaleX(${Math.max(0, Math.min(1, t / end))})` }} />
          </div>
        )}
      </div>
    </div>
  );
}
