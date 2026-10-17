"use client";

import { useState } from "react";
import { experimentStory, type ManySessions, type Phase } from "@/lib/learning/demo";
import TapsChart, { TapsLegend } from "./TapsChart";
import { useTimeline } from "./hooks";
import { ARRIVE, BUTTON, CARD } from "./shared";
import { Act, CueSays } from "./ui";

/** Each session takes this long to appear, in milliseconds. */
const PER_SESSION = 120;
const SESSIONS = 20;

function PhaseCard({ title, phase }: { title: string; phase: Phase }) {
  return (
    <div className={CARD}>
      <p className="text-label font-semibold">
        Sessions {phase.from}–{phase.to} · {title}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-caption text-muted">Taps a session</dt>
          <dd className="text-heading-3-m font-semibold tabular-nums sm:text-heading-3">
            {phase.tapsPerSession.toFixed(1)}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted">Time spent rushing</dt>
          <dd className="text-heading-3-m font-semibold tabular-nums text-[var(--area-pace)] sm:text-heading-3">
            {Math.round(phase.rushShare * 100)}%
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default function ActThree() {
  const [run, setRun] = useState<ManySessions | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, play] = useTimeline(SESSIONS * PER_SESSION);

  function start() {
    setBusy(true);
    // Let the button show it's working before twenty sessions run on the main thread.
    window.setTimeout(() => {
      setRun(experimentStory());
      setBusy(false);
      play();
    }, 30);
  }

  const shown = Math.floor(elapsed / PER_SESSION) + 1;
  const ex = run?.experiment;
  const marks = run && ex ? [run.sessions[ex.started - 1], run.sessions[ex.settled - 1]] : [];

  return (
    <Act
      n={3}
      title="Cue tests itself"
      steps={["Evaluate", "Improve"]}
      lede="A slow-down tap is only worth sending if it helps. So Cue holds back about one tap in five at random and compares. When its taps aren't beating the held-back ones, it tries another way of tapping, and keeps whichever works."
    >
      <button type="button" className={BUTTON} onClick={start} disabled={busy}>
        <span aria-hidden>▶</span> {busy ? "Running 20 sessions…" : run ? "Run again" : "Run 20 sessions"}
      </button>
      {run && ex && (
        <div className="mt-6 flex max-w-3xl flex-col gap-3" aria-live="polite">
          <div className={CARD}>
            <p className="text-label font-semibold">Slow-down taps, session by session</p>
            <div className="mt-4">
              <TapsChart run={run} started={ex.started} adopted={ex.settled} shown={shown} />
            </div>
          </div>
          <TapsLegend />
          {marks
            .filter((s) => shown > s.index)
            .map((s) => (
              <div key={s.index} className={ARRIVE}>
                <CueSays label={`${s.update!.label} · after session ${s.index}`}>
                  <p>{s.update!.text}</p>
                </CueSays>
              </div>
            ))}
          {shown >= SESSIONS && run.before && run.after && (
            <div className={`grid gap-3 sm:grid-cols-2 ${ARRIVE}`}>
              <PhaseCard title="tap after a few seconds" phase={run.before} />
              <PhaseCard title="only longer stretches" phase={run.after} />
            </div>
          )}
        </div>
      )}
    </Act>
  );
}
