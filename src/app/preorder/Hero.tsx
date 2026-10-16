"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { OFFER } from "@/lib/preorder/offer";
import Cutout from "./Cutout";
import { ReserveButton } from "./Reserve";
import type { CuePlay } from "./Rings";
import s from "./preorder.module.css";

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

/** Letters that arrive one after another, numbered on from `start` for the stagger. */
function Letters({ text, start }: { text: string; start: number }) {
  return (
    <>
      {[...text].map((ch, c) => (
        <span key={c} className={s.char} style={{ "--i": start + c } as React.CSSProperties} onMouseEnter={press}>
          {ch === " " ? "\u00a0" : ch}
        </span>
      ))}
    </>
  );
}

/**
 * The opening, set like a poster: the headline arrives letter by letter, right-aligned, with the
 * product cut-outs tilted around it and running off the page. Once the words land, the graphite
 * Cue taps, once, and the answer appears under the headline.
 */
export default function Hero({ placesLeft }: { placesLeft: number | null }) {
  const [tapped, setTapped] = useState(false);
  const [play, setPlay] = useState<CuePlay | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealed = reduce ? 300 : 120 + 20 * 32 + 600;
    const tap = window.setTimeout(() => setPlay({ pattern: "tap", n: 1 }), revealed);
    const note = window.setTimeout(() => setTapped(true), revealed + 180);
    return () => {
      window.clearTimeout(tap);
      window.clearTimeout(note);
    };
  }, []);

  return (
    <section id="hero" className={`${s.hero} ${tapped ? s.caught : ""}`}>
      <div className={s.stage}>
        <Cutout
          color="graphite"
          alt="Cue in Graphite"
          priority
          speed={-0.14}
          delay={250}
          play={play}
          sizes="(max-width: 760px) 70vw, 46vw"
          className={s.heroGraphite}
        />
        <div className={`${s.wrap} ${s.stageText}`}>
          <h1 className={s.display} aria-label="you suck at speaking.">
            <span className={s.displayLine} aria-hidden="true">
              <Letters text="you suck" start={0} />
            </span>
            <span className={s.displayLine} aria-hidden="true">
              <Letters text="at" start={8} /> <br className={s.mobileBreak} />
              <Letters text="speaking." start={10} />
            </span>
          </h1>
          <p className={s.caughtNote} aria-hidden="true">
            <span className={s.dot} /> one tap. you’ll suck less.
          </p>
        </div>
      </div>

      <div className={`${s.wrap} ${s.heroIntro}`}>
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
              try it with your voice <span aria-hidden="true">↓</span>
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

      {/* Two more finishes tumble in below, one off each edge. */}
      <div className={s.tumble} aria-hidden="true">
        <Cutout color="silver" alt="" speed={-0.06} delay={500} sizes="40vw" className={s.heroSilver} />
        <Cutout color="champagne" alt="" speed={0.04} delay={650} sizes="40vw" className={s.heroChampagne} />
      </div>
    </section>
  );
}
