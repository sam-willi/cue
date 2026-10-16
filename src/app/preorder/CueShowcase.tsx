"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PATTERNS, type CuePattern } from "@/lib/cue/patterns";
import { panel } from "@/lib/preorder/offer";
import Rings, { pulses, type CuePlay } from "./Rings";
import s from "./preorder.module.css";

/** The three cues (DESIGN.md §11), in the words a wearer would use. */
const CUES: { pattern: CuePattern; name: string; when: string }[] = [
  { pattern: "tap", name: "pause", when: "One tap. No pause for a while, a long turn, or a run of fillers." },
  { pattern: "steps", name: "slow down", when: "Slow steps. Faster than your own usual pace." },
  { pattern: "push", name: "speak up", when: "One long push. Well below the volume you set." },
];

/** Where the motor sits on the studio shot of the device, as percentages. */
const DEVICE_MOTOR = { x: 63, y: 58 };
/** Time between cues while the section plays on its own. */
const CYCLE_MS = 2600;

/** A cue's rhythm as bars, one per pulse, lit while that pulse plays. */
function Rhythm({ pattern, playing }: { pattern: CuePattern; playing: number | null }) {
  const [lit, setLit] = useState(-1);
  useEffect(() => {
    if (playing === null) return;
    const timers = pulses(pattern).flatMap((p, i) => [
      window.setTimeout(() => setLit(i), p.at),
      window.setTimeout(() => setLit(-1), p.at + Math.max(p.ms, 120)),
    ]);
    return () => timers.forEach(window.clearTimeout);
  }, [pattern, playing]);
  return (
    <span className={s.rhythm} aria-hidden="true">
      {pulses(pattern).map((p, i) => (
        <span key={i} className={`${s.beat} ${lit === i ? s.on : ""}`} style={{ width: Math.max(8, p.ms / 8) }} />
      ))}
    </span>
  );
}

/**
 * "It's just a tap": the device, with its three cues playing in turn while the section is on
 * screen. Choosing one plays it, and on a phone that can vibrate, the visitor feels it too.
 */
export default function CueShowcase() {
  const root = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState<CuePlay | null>(null);
  const [auto, setAuto] = useState(true);
  const [canVibrate, setCanVibrate] = useState(false);
  const n = useRef(0);

  const playCue = (pattern: CuePattern, felt: boolean) => {
    n.current += 1;
    setPlay({ pattern, n: n.current });
    if (felt) navigator.vibrate?.(PATTERNS[pattern].vibrate);
  };

  useEffect(() => {
    // Read once on the client: the server can't know, and a phone gets the "feel it" line.
    const t = window.setTimeout(
      () => setCanVibrate(typeof navigator.vibrate === "function" && matchMedia("(pointer: coarse)").matches),
      0,
    );
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    let k = 0;
    const tick = () => {
      playCue(CUES[k % CUES.length].pattern, false);
      k += 1;
      timer = window.setTimeout(tick, CYCLE_MS);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        window.clearTimeout(timer);
        if (entry.isIntersecting) timer = window.setTimeout(tick, 400);
      },
      { threshold: 0.5 },
    );
    if (root.current) io.observe(root.current);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [auto]);

  return (
    <div ref={root} className={s.tapGrid}>
      <div>
        <span className={s.eyebrow}>How it coaches</span>
        <h2 className={s.h2}>it’s just a tap.</h2>
        <p className={s.body}>
          Cue doesn’t talk to you and there’s nothing to look at. <strong>Three rhythms, three things to do.</strong>{" "}
          You learn them in a minute, and nobody else can tell.
        </p>
        <ul className={s.cueList}>
          {CUES.map((c) => (
            <li key={c.pattern}>
              <button
                type="button"
                className={s.cueButton}
                aria-pressed={play?.pattern === c.pattern}
                onClick={() => {
                  setAuto(false);
                  playCue(c.pattern, true);
                }}
              >
                <span>
                  <span className={s.cueName}>{c.name}</span>
                  <span className={s.cueWhen}>{c.when}</span>
                </span>
                <Rhythm pattern={c.pattern} playing={play?.pattern === c.pattern ? play.n : null} />
              </button>
            </li>
          ))}
        </ul>
        <p className={s.feelNote}>
          {canVibrate ? "Tap one to feel it on your phone." : "Choose one to play it. On a phone, you’ll feel it."}
        </p>
      </div>
      <figure className={s.deviceCard}>
        <Image
          src={panel("silver", "device")}
          alt="Cue in Silver, a slim crescent with a touch area near one end"
          width={507}
          height={209}
          sizes="(max-width: 860px) 100vw, 55vw"
        />
        <Rings {...DEVICE_MOTOR} play={play} />
      </figure>
    </div>
  );
}
