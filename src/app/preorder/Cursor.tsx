"use client";

import { useEffect, useRef, useState } from "react";
import s from "./preorder.module.css";

/** Things the lens wraps itself around. Text fields keep the system's text cursor. */
const TARGETS = "a, button, summary, label";
/** Bigger than this, and the lens just thins to a ring instead of wrapping the element. */
const WRAP_MAX = { w: 320, h: 96 };
const LENS = 34;

/**
 * lilguy's cursor, in Cue's terms: a small frosted lens that follows the pointer, wraps around
 * buttons and links, and leaves a cobalt tap ring wherever you click. Mouse only, and off for
 * reduced motion, text fields and the open detail view, where the system cursor comes back.
 * Also draws the thin scrollbar that replaces the system one on the same devices.
 */
export default function Cursor() {
  const lens = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const [taps, setTaps] = useState<{ id: number; x: number; y: number }[]>([]);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine) and (hover: hover)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduce.matches) return;
    const root = document.documentElement;
    root.classList.add("cue-cursor");
    const startId = window.setTimeout(() => setOn(true), 0);

    // Where the lens is drawn and where it's heading; it eases toward the target each frame.
    const cur = { x: -100, y: -100, w: LENS, h: LENS, r: LENS / 2 };
    const goal = { ...cur };
    let mode: "lens" | "wrap" | "ring" | "hidden" = "hidden";
    let frame = 0;
    let pressed = false;
    let tapId = 0;

    const draw = () => {
      const el = lens.current;
      if (el) {
        const k = mode === "wrap" ? 0.3 : 0.45;
        for (const key of ["x", "y", "w", "h", "r"] as const) cur[key] += (goal[key] - cur[key]) * k;
        const scale = pressed ? 0.88 : 1;
        el.style.transform = `translate(${cur.x - cur.w / 2}px, ${cur.y - cur.h / 2}px) scale(${scale})`;
        el.style.width = `${cur.w}px`;
        el.style.height = `${cur.h}px`;
        el.style.borderRadius = `${cur.r}px`;
        el.dataset.mode = mode;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const over = e.target instanceof Element ? e.target : null;
      if (document.querySelector("dialog[open]") || over?.closest("input, textarea, select")) {
        mode = "hidden";
        return;
      }
      if (mode === "hidden") Object.assign(cur, { x: e.clientX, y: e.clientY });
      const target = over?.closest(TARGETS);
      const rect = target?.getBoundingClientRect();
      if (target && rect && rect.width <= WRAP_MAX.w && rect.height <= WRAP_MAX.h) {
        // Wrap the control with a little air, matching its own corner radius.
        const radius = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 8;
        mode = "wrap";
        Object.assign(goal, {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          w: rect.width + 12,
          h: rect.height + 12,
          r: Math.min(radius + 6, (rect.height + 12) / 2),
        });
      } else {
        mode = target ? "ring" : "lens";
        Object.assign(goal, { x: e.clientX, y: e.clientY, w: LENS, h: LENS, r: LENS / 2 });
      }
    };
    const onDown = () => (pressed = true);
    const onUp = (e: PointerEvent) => {
      pressed = false;
      if (e.pointerType !== "mouse" || mode === "hidden") return;
      const id = ++tapId;
      setTaps((t) => [...t.slice(-4), { id, x: e.clientX, y: e.clientY }]);
      window.setTimeout(() => setTaps((t) => t.filter((x) => x.id !== id)), 900);
    };
    const onLeave = () => (mode = "hidden");

    // The scrollbar: a thin ink thumb that shows while scrolling and can be dragged.
    let fade = 0;
    let drag: { y: number; scroll: number } | null = null;
    const place = () => {
      const t = thumb.current;
      if (!t) return;
      const total = document.documentElement.scrollHeight;
      const view = window.innerHeight;
      const h = Math.max(40, Math.min(160, (view / total) * view));
      t.style.height = `${h}px`;
      t.style.transform = `translateY(${(window.scrollY / Math.max(1, total - view)) * (view - h)}px)`;
    };
    const show = () => {
      place();
      thumb.current?.classList.add(s.thumbOn);
      window.clearTimeout(fade);
      fade = window.setTimeout(() => !drag && thumb.current?.classList.remove(s.thumbOn), 900);
    };
    const onThumbDown = (e: PointerEvent) => {
      drag = { y: e.clientY, scroll: window.scrollY };
      (e.target as Element).setPointerCapture(e.pointerId);
    };
    const onThumbMove = (e: PointerEvent) => {
      if (!drag) return;
      const total = document.documentElement.scrollHeight;
      const view = window.innerHeight;
      const h = thumb.current?.offsetHeight ?? 40;
      window.scrollTo(0, drag.scroll + ((e.clientY - drag.y) / (view - h)) * (total - view));
    };
    const onThumbUp = () => {
      drag = null;
      show();
    };
    const t = thumb.current;
    t?.addEventListener("pointerdown", onThumbDown);
    t?.addEventListener("pointermove", onThumbMove);
    t?.addEventListener("pointerup", onThumbUp);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", show, { passive: true });
    window.addEventListener("resize", place);
    return () => {
      window.clearTimeout(startId);
      cancelAnimationFrame(frame);
      root.classList.remove("cue-cursor");
      t?.removeEventListener("pointerdown", onThumbDown);
      t?.removeEventListener("pointermove", onThumbMove);
      t?.removeEventListener("pointerup", onThumbUp);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", show);
      window.removeEventListener("resize", place);
    };
  }, []);

  return (
    <>
      <div ref={lens} className={s.lens} hidden={!on} aria-hidden="true" />
      {taps.map((t) => (
        <span key={t.id} className={s.clickTap} style={{ left: t.x, top: t.y }} aria-hidden="true" />
      ))}
      <div className={s.scrollbar} hidden={!on} aria-hidden="true">
        <div ref={thumb} className={s.thumb} />
      </div>
    </>
  );
}
