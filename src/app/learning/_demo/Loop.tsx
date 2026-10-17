import { STEPS, type Step } from "./shared";

const TEXT: Record<Step, string> = {
  Observe: "Each session ends as numbers: pace, fillers, pauses, turns. No audio, no words kept.",
  Discover: "Patterns that hold across sessions, checked with a sign test, not a hunch.",
  Remember: "A personal profile in your browser: your pace, your preferences, what worked.",
  Adapt: "The coaching plan is rebuilt from the profile, and the live engine reads it.",
  Evaluate: "Taps are compared with randomly held-back taps, and strategy against strategy.",
  Improve: "Cue adopts what works, steps back where you've improved, and picks a new focus.",
};

/** The six steps every session goes round, ending where the next session starts. */
export default function Loop() {
  return (
    <div className="mt-10">
      <ol className="grid gap-6 lg:grid-cols-6 lg:gap-4">
        {STEPS.map((s, k) => (
          <li key={s} className="relative rounded-card border border-line bg-surface p-4">
            <span className="flex size-7 items-center justify-center rounded-full bg-cue-soft font-mono text-label text-cue">
              {k + 1}
            </span>
            <h3 className="mt-2 text-title-m font-semibold">{s}</h3>
            <p className="mt-1 text-body-sm text-muted">{TEXT[s]}</p>
            {k < STEPS.length - 1 && (
              <span
                aria-hidden
                className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-cue lg:-right-3.5 lg:bottom-auto lg:left-auto lg:top-1/2 lg:-translate-y-1/2 lg:translate-x-0"
              >
                <span className="lg:hidden">↓</span>
                <span className="hidden lg:inline">→</span>
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center gap-2 rounded-card border border-dashed border-cue/40 px-4 py-3 text-body-sm text-muted">
        <span aria-hidden className="text-title text-cue">
          ↺
        </span>
        Back to Observe: the next session is coached with the new plan, and Cue learns from that one too.
      </div>
    </div>
  );
}
