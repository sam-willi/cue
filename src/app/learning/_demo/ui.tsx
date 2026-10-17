import type { ReactNode } from "react";

export const CARD = "rounded-card border border-line bg-surface p-5";
export const BUTTON =
  "inline-flex h-11 items-center gap-2 rounded-full bg-action px-5 text-body-sm font-semibold text-on-action transition-opacity disabled:opacity-50";

/** Reveal a block once its turn comes, with a short rise. */
export function reveal(shown: boolean) {
  return `transition-all duration-500 motion-reduce:transition-none ${shown ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-2"}`;
}

export function Act({ n, title, lede, children }: { n: number; title: string; lede: string; children: ReactNode }) {
  return (
    <section className="mt-20 sm:mt-28" aria-labelledby={`act-${n}`}>
      <p className="text-label font-medium uppercase tracking-[0.08em] text-muted">Act {n}</p>
      <h2 id={`act-${n}`} className="mt-2 text-heading-2-m font-semibold tracking-[-0.02em] sm:text-heading-2">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-body text-muted">{lede}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** What Cue said, set apart in Cue's color. */
export function CueSays({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-card border border-cue/30 bg-cue-soft p-5">
      <p className="text-label font-semibold text-cue">{label}</p>
      <div className="mt-2 text-body">{children}</div>
    </div>
  );
}

/** A session's slow-down tap count, the number the act turns on. */
export function TapCount({ taps, caption }: { taps: number; caption: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-display-lg-m font-semibold tabular-nums text-[var(--area-pace)] sm:text-display-lg">
        {taps}
      </span>
      <span className="text-body-sm text-muted">
        slow-down {taps === 1 ? "tap" : "taps"}
        <br />
        {caption}
      </span>
    </div>
  );
}
