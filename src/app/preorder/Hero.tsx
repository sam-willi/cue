"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { OFFER } from "@/lib/preorder/offer";
import Cutout from "./Cutout";
import Deal from "./Deal";
import Save from "./Save";
import { ReserveButton } from "./Reserve";
import type { CuePlay } from "./Rings";
import s from "./preorder.module.css";

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
 * Cue taps, once.
 */
export default function Hero({ placesLeft }: { placesLeft: number | null }) {
  const [play, setPlay] = useState<CuePlay | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealed = reduce ? 300 : 120 + 20 * 32 + 600;
    const tap = window.setTimeout(() => setPlay({ pattern: "tap", n: 1 }), revealed);
    return () => window.clearTimeout(tap);
  }, []);

  return (
    <section id="hero" className={s.hero}>
      <div className={s.stage}>
        <Cutout
          color="graphite"
          view="render"
          alt="Cue in Graphite"
          priority
          speed={0.12}
          spin={3}
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
        </div>
      </div>

      <div className={`${s.wrap} ${s.heroIntro}`}>
        <div>
          <p className={s.lede}>
            <strong>Cue sits behind your ear and taps you, privately,</strong> when a speaking habit shows up.
          </p>
          <div className={s.actions}>
            <ReserveButton>
              reserve yours <span className={s.buttonPrice}>${OFFER.deposit} down</span>
            </ReserveButton>
            <a className={s.ghost} href="#how-it-coaches">
              see how it taps <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
        <div className={s.stamp}>
          <Save long className={s.stampSave} />
          <Deal />
          <p className={s.stampBatch}>
            batch {OFFER.batch.number} ·{" "}
            {placesLeft === null
              ? `${OFFER.batch.size} units · ships ${OFFER.batch.ships}`
              : `${placesLeft} of ${OFFER.batch.size} left · ships ${OFFER.batch.ships}`}
          </p>
        </div>
      </div>

      {/* Two more finishes tumble in below, one off each edge. */}
      <div className={s.tumble} aria-hidden="true">
        <Cutout
          color="silver"
          view="render"
          alt=""
          speed={0.22}
          spin={-5}
          bob={2.2}
          delay={120}
          tapOnArrive
          sizes="40vw"
          className={s.heroSilver}
        />
        <Cutout
          color="champagne"
          view="render"
          alt=""
          speed={-0.08}
          spin={7}
          bob={4.1}
          delay={260}
          tapOnArrive
          sizes="40vw"
          className={s.heroChampagne}
        />
      </div>
    </section>
  );
}
