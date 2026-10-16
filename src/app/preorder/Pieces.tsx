"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { COLORWAYS, OFFER, type Colorway } from "@/lib/preorder/offer";
import { CUTOUTS, cutout, type CutoutView } from "./Cutout";
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

/** The angles a card turns through as the pointer crosses it, left to right. */
const TURN: CutoutView[] = ["device", "three-quarter", "front", "side", "back"];

/**
 * One colorway: its cut-out, which turns through the concept sheet's angles as the pointer
 * moves across the card (lilguy's cursor spin, with the five views there are), and an action
 * bar that fills with ink on hover. Pressing it opens the reserve dialog on that color.
 */
function ColorCard({ c }: { c: Colorway }) {
  const { open, full } = useReserve();
  const [frame, setFrame] = useState(0);
  const turn = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(0.999, Math.max(0, (e.clientX - r.left) / r.width));
    setFrame(Math.floor(x * TURN.length));
  };
  return (
    <button
      type="button"
      className={s.card}
      onClick={() => open(c.id)}
      onPointerMove={turn}
      onPointerLeave={() => setFrame(0)}
      aria-label={`Reserve Cue in ${c.name}, $${OFFER.deposit} deposit`}
    >
      <span className={s.cardHead}>
        <span>{c.name.toLowerCase()}</span>
        <span>${OFFER.price}</span>
      </span>
      <span className={s.cardImage}>
        {TURN.map((view, i) => (
          <Image
            key={view}
            className={`${s.cutout} ${i === frame ? s.on : ""}`}
            src={cutout(c.id, view)}
            alt={i === 0 ? `Cue in ${c.name}` : ""}
            width={CUTOUTS[view].w}
            height={CUTOUTS[view].h}
            sizes="(max-width: 760px) 80vw, 25vw"
            unoptimized
          />
        ))}
      </span>
      <span className={s.cardNote}>{c.note}</span>
      <span className={s.cardFoot}>
        <span>{full ? "batch 1 is full" : "reserve"}</span>
        <span className={s.footPrice}>${OFFER.deposit} today</span>
      </span>
    </button>
  );
}

export function Colorways() {
  return (
    <div className={s.cards}>
      {COLORWAYS.map((c) => (
        <ColorCard key={c.id} c={c} />
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
