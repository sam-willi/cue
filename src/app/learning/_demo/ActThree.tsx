"use client";

import { useState } from "react";
import { experimentStory, type ManySessions } from "@/lib/learning/demo";
import type { TapEffect } from "@/lib/learning/evaluation";
import TapsChart, { TapsLegend } from "./TapsChart";
import { Act, BUTTON, CARD, CueSays } from "./ui";

const VERDICT: Record<TapEffect["verdict"], string> = {
  measuring: "Still measuring",
  helps: "Helps",
  unclear: "Unclear",
  no_benefit: "No clear difference",
};

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");

function Effect({ title, e }: { title: string; e: TapEffect }) {
  return (
    <div className={CARD}>
      <p className="text-label font-semibold">{title}</p>
      <p className="mt-2 text-title-m font-semibold sm:text-title">{VERDICT[e.verdict]}</p>
      <p className="mt-1 text-body-sm text-muted">
        Slowed down after {pct(e.tapWorked, e.taps)} of {e.taps} taps, and after {pct(e.holdoutWorked, e.holdouts)} of{" "}
        {e.holdouts} held back.
      </p>
    </div>
  );
}

export default function ActThree() {
  const [run, setRun] = useState<ManySessions | null>(null);
  const [busy, setBusy] = useState(false);

  function start() {
    setBusy(true);
    // Let the button show it's working before twenty sessions run on the main thread.
    window.setTimeout(() => {
      setRun(experimentStory());
      setBusy(false);
    }, 30);
  }

  // The two updates that name an experiment: the one that starts it, and the one that settles it.
  const marks = run?.sessions.filter((s) => s.update?.ref.experiment) ?? [];

  return (
    <Act
      n={3}
      title="Cue tests itself"
      lede="A slow-down tap is only worth sending if it helps. So Cue holds back about one tap in five at random and compares. When its taps aren't beating the held-back ones, it tries another way of tapping, and keeps whichever works."
    >
      <button type="button" className={BUTTON} onClick={start} disabled={busy}>
        <span aria-hidden>▶</span> {busy ? "Running 20 sessions…" : run ? "Run again" : "Run 20 sessions"}
      </button>
      {run && marks.length >= 2 && (
        <div className="mt-6 flex max-w-3xl flex-col gap-3" aria-live="polite">
          <div className={CARD}>
            <p className="text-label font-semibold">Slow-down taps, session by session</p>
            <div className="mt-4">
              <TapsChart run={run} started={marks[0].index} adopted={marks[1].index} />
            </div>
          </div>
          <TapsLegend />
          {marks.map((s) => (
            <CueSays key={s.index} label={`${s.update!.label} · after session ${s.index}`}>
              <p>{s.update!.text}</p>
            </CueSays>
          ))}
          <div className="grid gap-3 sm:grid-cols-2">
            <Effect title="Before: tap after a few seconds" e={run.before} />
            <Effect title="After: tap only for longer stretches" e={run.after} />
          </div>
        </div>
      )}
    </Act>
  );
}
