"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { COLORWAYS, OFFER, panel } from "@/lib/preorder/offer";
import { useReserve } from "./Reserve";
import s from "./preorder.module.css";

/**
 * A paragraph whose words rise into place the first time it's half on screen. Screen readers
 * get the sentence whole; the split words are only for the eye.
 */
export function Reveal({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <p ref={ref} className={`${s.reveal} ${shown ? s.in : ""} ${className ?? ""}`}>
      <span className={s.srOnly}>{text}</span>
      <span aria-hidden="true">
        {text.split(" ").map((word, i) => (
          <span key={i}>
            <span className={s.rw} style={{ "--i": i } as React.CSSProperties}>
              {word}
            </span>{" "}
          </span>
        ))}
      </span>
    </p>
  );
}

/** One card per colorway: the studio shot, which turns into the colorway worn on hover. */
export function Colorways() {
  const { open, full } = useReserve();
  return (
    <div className={s.cards}>
      {COLORWAYS.map((c) => (
        <button
          key={c.id}
          type="button"
          className={s.card}
          onClick={() => open(c.id)}
          aria-label={`Reserve Cue in ${c.name}, $${OFFER.deposit} deposit`}
        >
          <span className={s.cardHead}>
            <span>{c.name.toLowerCase()}</span>
            <span>${OFFER.price}</span>
          </span>
          <span className={s.cardImage}>
            <Image
              className={s.worn}
              src={panel(c.id, "on-ear")}
              alt=""
              width={509}
              height={298}
              sizes="(max-width: 760px) 100vw, 33vw"
            />
            <Image
              className={s.studioShot}
              src={panel(c.id, "device")}
              alt={`Cue in ${c.name}`}
              width={507}
              height={209}
              sizes="(max-width: 760px) 100vw, 33vw"
            />
          </span>
          <span className={s.cardNote}>{c.note}</span>
          <span className={s.cardFoot}>
            <span>{full ? "batch 1 is full" : "reserve"}</span>
            <span className={s.footPrice}>${OFFER.deposit} today</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** On a phone, a reserve bar slides up once the hero has scrolled away, and hides at the colors. */
export function StickyBar({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("hero");
    const colors = document.getElementById("colors");
    if (!hero) return;
    let pastHero = false;
    let atColors = false;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) pastHero = !e.isIntersecting && e.boundingClientRect.top < 0;
        if (e.target === colors) atColors = e.isIntersecting;
      }
      setShow(pastHero && !atColors);
    });
    io.observe(hero);
    if (colors) io.observe(colors);
    return () => io.disconnect();
  }, []);
  return <div className={`${s.stickyBar} ${show ? s.show : ""}`}>{children}</div>;
}
