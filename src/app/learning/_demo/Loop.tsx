const STEPS = [
  { name: "Observe", text: "Each session ends as numbers: pace, fillers, pauses, turns. No audio, no words kept." },
  { name: "Discover", text: "Patterns that hold across sessions, checked with a sign test, not a hunch." },
  { name: "Remember", text: "A personal profile in your browser: your pace, your preferences, what worked." },
  { name: "Adapt", text: "The coaching plan is rebuilt from the profile, and the live engine reads it." },
  { name: "Evaluate", text: "Taps are compared with randomly held-back taps, and strategy against strategy." },
  { name: "Improve", text: "Cue adopts what works, steps back where you've improved, and picks a new focus." },
];

/** The six steps every session goes round, ending where the next session starts. */
export default function Loop() {
  return (
    <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {STEPS.map((s, k) => (
        <li key={s.name} className="rounded-card border border-line bg-surface p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-cue-soft font-mono text-label text-cue">
              {k + 1}
            </span>
            <h3 className="text-title-m font-semibold sm:text-title">{s.name}</h3>
          </div>
          <p className="mt-2 text-body-sm text-muted">{s.text}</p>
        </li>
      ))}
      <li className="text-body-sm text-muted sm:col-span-2 lg:col-span-3">
        <span className="text-cue">↻</span> …and the next session is coached with the new plan.
      </li>
    </ol>
  );
}
