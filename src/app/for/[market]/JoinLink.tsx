"use client";

import type { MouseEvent, ReactNode } from "react";

/**
 * The header's button: brings the sign-up form into view and puts the cursor in its first field,
 * from anywhere on the page. Without JavaScript it is a plain link to the form.
 */
export default function JoinLink({ target, children }: { target: string; children: ReactNode }) {
  function go(event: MouseEvent<HTMLAnchorElement>) {
    const form = document.getElementById(target);
    const field = form?.querySelector<HTMLElement>('input:not([name="website"])');
    if (!form || !field) return;
    event.preventDefault();
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    form.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" });
    field.focus({ preventScroll: true });
  }

  return (
    <a
      href={`#${target}`}
      onClick={go}
      className="grid min-h-11 place-items-center rounded-control bg-action px-5 text-body-sm font-semibold text-on-action transition-opacity duration-200 ease-out hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cue"
    >
      {children}
    </a>
  );
}
