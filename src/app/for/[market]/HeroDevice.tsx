"use client";

import { useEffect, useState } from "react";
import { PATTERNS, type CuePattern } from "@/lib/cue/patterns";
import DeviceModel from "../../DeviceModel";

const LOOP: CuePattern[] = ["tap", "steps", "push"];

/**
 * The device from its CAD, playing the three cues in turn so a visitor sees where a tap comes
 * from and what it asks for. Stays still for people who prefer reduced motion.
 */
export default function HeroDevice() {
  const [buzz, setBuzz] = useState<{ n: number; label: string; pattern: CuePattern } | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let n = 0;
    const play = () => {
      const pattern = LOOP[n % LOOP.length];
      n += 1;
      setBuzz({ n, label: PATTERNS[pattern].action, pattern });
    };
    const first = window.setTimeout(play, 1600);
    const loop = window.setInterval(play, 4200);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(loop);
    };
  }, []);

  return (
    <figure>
      <div className="overflow-hidden rounded-2xl bg-surface-2">
        <div
          role="img"
          aria-label="The Cue behind-the-ear device. Rings leave the motor on its skin side each time it taps."
        >
          <DeviceModel buzz={buzz} confirm={null} noticed={null} className="h-64 sm:h-80 lg:h-[26rem]" />
        </div>
        {/* The cue being played, named where the app shows its cue word. */}
        <p aria-hidden="true" className="flex min-h-14 items-baseline justify-center gap-2 px-4 pb-5 pt-1">
          {buzz ? (
            <>
              <span key={buzz.n} className="cue-word text-title font-medium">
                {PATTERNS[buzz.pattern].action}.
              </span>
              <span className="text-body-sm text-muted">{PATTERNS[buzz.pattern].name}</span>
            </>
          ) : (
            <span className="text-body-sm text-muted">Three cues, felt behind the ear</span>
          )}
        </p>
      </div>
      <figcaption className="mt-3 text-caption text-muted">
        Cue’s behind-the-ear device, drawn from its CAD. Drag to turn it.
      </figcaption>
    </figure>
  );
}
