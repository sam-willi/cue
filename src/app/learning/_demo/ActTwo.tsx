"use client";

import { useMemo, useState } from "react";
import { feedbackStory } from "@/lib/learning/demo";
import type { Rating } from "@/lib/learning/types";
import { rushingTaps } from "./ActOne";
import PaceChart, { PaceLegend, paceDomain } from "./PaceChart";
import { Act, CARD, CueSays, TapCount } from "./ui";

const RATINGS: { value: Rating; label: string }[] = [
  { value: "helpful", label: "Helpful" },
  { value: "too_many", label: "Too many" },
  { value: "distracting", label: "Distracting" },
];

export default function ActTwo() {
  // Session 1 is the same whatever the rating; the rating only shapes session 2.
  const first = useMemo(() => feedbackStory().first, []);
  const [rating, setRating] = useState<Rating | null>(null);
  const story = useMemo(() => (rating ? feedbackStory(rating) : null), [rating]);
  const domain = paceDomain(first, ...(story ? [story.second] : []));

  return (
    <Act
      n={2}
      title="Tell Cue once"
      lede="Someone who rushes in bursts gets slow-down taps through a conversation. Afterwards Cue asks how they were. One answer changes the next session."
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
                onClick={() => setRating(r.value)}
                className={`h-11 rounded-full border px-5 text-body-sm font-semibold transition-colors ${
                  rating === r.value ? "border-cue bg-cue text-bg" : "border-field bg-surface hover:border-cue"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </fieldset>

        {story && (
          <div className="flex flex-col gap-3" aria-live="polite">
            {story.update ? (
              <CueSays label={story.update.label}>
                <p>{story.update.text}</p>
              </CueSays>
            ) : (
              <p className="text-body-sm text-muted">
                Helpful taps keep their strategy. Session 2 differs only by what Cue learned from session 1 itself.
              </p>
            )}
            <div className={CARD}>
              <p className="text-label font-semibold">Session 2 · the same speech</p>
              <div className="mt-3">
                <TapCount taps={rushingTaps(story.second)} caption="after one answer" />
              </div>
              <div className="mt-4">
                <PaceChart trace={story.second} domain={domain} />
              </div>
            </div>
          </div>
        )}
      </div>
    </Act>
  );
}
