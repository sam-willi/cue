"use client";

import Image from "next/image";
import { useEffect, useState, type MouseEvent } from "react";
import { COLORWAYS, CONCEPT_NOTE, OFFER, panel } from "@/lib/preorder/offer";
import { ReserveButton } from "./Reserve";
import Rings, { type CuePlay } from "./Rings";
import s from "./preorder.module.css";

const LINES = ["say less,", "um."];

/** Where the device's motor sits on each on-ear photo, as percentages of the photo. */
export const ON_EAR_MOTOR = {
  graphite: { x: 57, y: 34 },
  silver: { x: 59, y: 40 },
  champagne: { x: 57, y: 39 },
} as const;

/** Press a letter for a moment when the pointer reaches it; it springs back on its own. */
function press(e: MouseEvent<HTMLSpanElement>) {
  const el = e.currentTarget;
  el.classList.add(s.pressed);
  window.setTimeout(() => el.classList.remove(s.pressed), 110);
}

/**
 * The opening: the headline arrives letter by letter, then Cue taps the wearer in the first
 * photo, once, and "um." steps back, the way a filler fades once you've caught it.
 */
export default function Hero({ placesLeft }: { placesLeft: number | null }) {
  const [caught, setCaught] = useState(false);
  const [play, setPlay] = useState<CuePlay | null>(null);
  const chars = LINES.join("").length;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealed = reduce ? 300 : 120 + chars * 32 + 700;
    const tap = window.setTimeout(() => setPlay({ pattern: "tap", n: 1 }), revealed);
    const dim = window.setTimeout(() => setCaught(true), revealed + 180);
    return () => {
      window.clearTimeout(tap);
      window.clearTimeout(dim);
    };
  }, [chars]);

  let i = 0;
  return (
    <section id="hero" className={`${s.wrap} ${s.hero} ${caught ? s.caught : ""}`}>
      <h1 className={s.display} aria-label="say less, um.">
        {LINES.map((line, l) => (
          <span key={line} className={s.displayLine} aria-hidden="true">
            <span className={l === 1 ? s.um : undefined}>
              {[...line].map((ch, c) => (
                <span key={c} className={s.char} style={{ "--i": i++ } as React.CSSProperties} onMouseEnter={press}>
                  {ch === " " ? " " : ch}
                </span>
              ))}
            </span>
          </span>
        ))}
      </h1>
      <p className={s.caughtNote} aria-hidden="true">
        <span className={s.dot} /> one tap. you caught it.
      </p>

      <div className={s.heroIntro}>
        <div>
          <p className={s.lede}>
            <strong>Cue sits behind your ear and taps you, privately,</strong> when a speaking habit shows up. For
            people who’d rather be writing code than giving the talk.
          </p>
          <div className={s.actions}>
            <ReserveButton>
              reserve yours <span className={s.buttonPrice}>${OFFER.deposit}</span>
            </ReserveButton>
            <a className={s.ghost} href="#hear-it">
              hear it work <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
        <p className={s.stamp}>
          <span className={s.stampPrice}>
            <s>${OFFER.launchPrice}+</s>${OFFER.price}
          </span>
          Premium free for life · batch {OFFER.batch.number}
          <br />
          {placesLeft === null
            ? `${OFFER.batch.size} units · ships ${OFFER.batch.ships}`
            : `${placesLeft} of ${OFFER.batch.size} left · ships ${OFFER.batch.ships}`}
        </p>
      </div>

      <div className={s.triptych}>
        {COLORWAYS.map((c, n) => (
          <figure key={c.id} className={s.photo} style={{ "--i": n } as React.CSSProperties}>
            <Image
              src={panel(c.id, "on-ear")}
              alt={`Cue in ${c.name}, worn behind the ear`}
              width={509}
              height={298}
              priority={n === 0}
              sizes="(max-width: 760px) 100vw, 33vw"
            />
            {n === 0 && <Rings {...ON_EAR_MOTOR[c.id]} play={play} />}
            <figcaption className={s.photoLabel}>{c.name.toLowerCase()}</figcaption>
          </figure>
        ))}
      </div>
      <p className={s.conceptNote}>{CONCEPT_NOTE}</p>
    </section>
  );
}
