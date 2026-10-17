"use client";

import { useMemo, useState } from "react";
import { feedbackStory } from "@/lib/learning/demo";
import type { Rating } from "@/lib/learning/types";
import PaceChart, { PaceLegend } from "./PaceChart";
import { useTimeline } from "./hooks";
import { ARRIVE, CARD, CHIP, paceDomain, rushingTaps, span } from "./shared";
import { Act, CueSays, SlowDownShift, TapCount } from "./ui";

const RATINGS: { value: Rating; label: string }[] = [
  { value: "helpful", label: "Helpful" },
  { value: "too_many", label: "Too many" },
  { value: "distracting", label: "Distracting" },
];

/** Session 2 plays out after each answer, in milliseconds. */
const PLAY_MS = 2600;

export default function ActTwo() {
  // Session 1 is the same whatever the rating; the rating only shapes session 2.
  const first = useMemo(() => feedbackStory().first, []);
  const [rating, setRating] = useState<Rating | null>(null);
  const story = useMemo(() => (rating ? feedbackStory(rating) : null), [rating]);
  const [elapsed, play] = useTimeline(PLAY_MS);
  const domain = paceDomain(first, ...(story ? [story.second] : []));
  const p2 = span(elapsed, 0, PLAY_MS);

  function rate(r: Rating) {
    setRating(r);
    play();
  }

  return (
    <Act
      n={2}
      title="Tell Cue once"
      steps={["Adapt"]}
      lede="Someone who rushes in bursts gets slow-down taps through a conversation. Afterwards Cue asks how they were, and one answer changes the next session. The simulated speaker reacts to each tap, so a burst Cue lets pass can run on longer."
    >
      <div className="flex max-w-3xl flex-col gap-3">
        <div className={CARD}>
          <p className="text-label font-semibold">Session 1</p>
          <div className="mt-3">
            <TapCount taps={rushingTaps(first)} caption="before any feedback" />
          </div>
          <div className="mt-4">
            <PaceChart trace={first} domain={domain} />
          </div>
        </div>
        <PaceLegend />

        <fieldset className="mt-3">
          <legend className="text-body font-semibold">How were the slow-down taps?</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {RATINGS.map((r) => (
              <button
                key={r.value}
                type="button"
                aria-pressed={rating === r.value}
                onClick={() => rate(r.value)}
                className={`${CHIP} ${
                  rating === r.value ? "border-cue bg-cue text-on-cue" : "border-field bg-surface hover:border-cue"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </fieldset>

        {story && (
          <div key={rating} className={`flex flex-col gap-3 ${ARRIVE}`} aria-live="polite">
            {story.update ? (
              <CueSays label={story.update.label}>
                <p>{story.update.text}</p>
                <p className="mt-2 text-body-sm text-muted">{story.learned}</p>
              </CueSays>
            ) : (
              <div className={CARD}>
                <p className="text-body">
                  Cue keeps tapping the same way. Session 2 still differs a little: Cue learned this speaker&rsquo;s
                  pace from session 1, and the speaker reacts to each tap, so the bursts don&rsquo;t repeat exactly.
                </p>
                <div className="mt-2">
                  <SlowDownShift first={first} second={story.second} />
                </div>
              </div>
            )}
            <div className={CARD}>
              <p className="text-label font-semibold">Session 2 · same speaker, same script</p>
              <div className="mt-3">
                <TapCount taps={rushingTaps(story.second, p2)} caption="after one answer" />
              </div>
              <div className="mt-4">
                <PaceChart trace={story.second} domain={domain} progress={p2} />
              </div>
            </div>
          </div>
        )}
      </div>
    </Act>
  );
}
