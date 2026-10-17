"use client";

import { useRef, useState } from "react";
import { quickTalkerStory, type Trace, type TwoSessions } from "@/lib/learning/demo";
import PaceChart, { PaceLegend, paceDomain } from "./PaceChart";
import { Act, BUTTON, CARD, CueSays, TapCount, reveal } from "./ui";

export const rushingTaps = (t: Trace) => t.taps.filter((x) => x.behavior === "rushing").length;

/** Play: session 1, then what Cue learned, then the same speech again. */
const STAGE_MS = 900;

export default function ActOne() {
  const [story, setStory] = useState<TwoSessions | null>(null);
  const [stage, setStage] = useState(0);
  const timers = useRef<number[]>([]);

  function play() {
    timers.current.forEach(window.clearTimeout);
    setStory(quickTalkerStory());
    setStage(0);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timers.current = [1, 2, 3].map((s) => window.setTimeout(() => setStage(s), reduce ? 0 : s * STAGE_MS));
  }

  return (
    <Act
      n={1}
      title="Same speech, different coaching"
      lede="A naturally quick talker, fast but steady, gives the same speech twice. In session 1 Cue judges them against a standard pace; by session 2 it has learned theirs."
    >
      <button type="button" className={BUTTON} onClick={play}>
        <span aria-hidden>▶</span> {story ? "Play again" : "Play"}
      </button>
      {story && <Story story={story} stage={stage} />}
    </Act>
  );
}

function Story({ story, stage }: { story: TwoSessions; stage: number }) {
  const domain = paceDomain(story.first, story.second);
  return (
    <div className="mt-6 flex max-w-3xl flex-col gap-3" aria-live="polite">
      <div className={`${CARD} ${reveal(stage >= 1)}`}>
        <p className="text-label font-semibold">Session 1</p>
        <div className="mt-3">
          <TapCount taps={rushingTaps(story.first)} caption="Cue doesn't know them yet" />
        </div>
        <div className="mt-4">
          <PaceChart trace={story.first} domain={domain} />
        </div>
      </div>
      <div className={reveal(stage >= 2)}>
        <CueSays label={story.update?.label ?? "Cue updated"}>
          <p>{story.update?.text}</p>
          <p className="mt-2 text-body-sm text-muted">{story.changed[0]}</p>
        </CueSays>
      </div>
      <div className={`${CARD} ${reveal(stage >= 3)}`}>
        <p className="text-label font-semibold">Session 2 · the same speech</p>
        <div className="mt-3">
          <TapCount taps={rushingTaps(story.second)} caption="Cue knows their pace" />
        </div>
        <div className="mt-4">
          <PaceChart trace={story.second} domain={domain} />
        </div>
      </div>
      <div className={reveal(stage >= 1)}>
        <PaceLegend />
      </div>
    </div>
  );
}
