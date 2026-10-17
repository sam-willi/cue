import type { Metadata } from "next";
import Link from "next/link";
import ActOne from "./_demo/ActOne";
import ActThree from "./_demo/ActThree";
import ActTwo from "./_demo/ActTwo";
import Loop from "./_demo/Loop";

export const metadata: Metadata = {
  title: "Cue learns you — Cue",
  description: "Cue learns from every session and changes how it coaches you. Three stories, computed live.",
};

// The continuous-learning demo. Every number on it comes from src/lib/learning/demo.ts, which runs
// simulated speakers through the real engine; this page only draws them.
export default function LearningDemoPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-12 sm:px-8 sm:pt-20">
      <header>
        <p className="text-label font-medium uppercase tracking-[0.08em] text-cue">Continuous learning</p>
        <h1 className="mt-3 text-display-xl-m font-semibold tracking-[-0.03em] sm:text-display-xl">Cue learns you.</h1>
        <p className="mt-5 max-w-2xl text-body-lg-m text-muted sm:text-body-lg">
          Every session teaches Cue something about how you speak, and the next session is coached differently because
          of it. Not more data about your habits: better coaching, one session at a time.
        </p>
      </header>
      <Loop />
      <ActOne />
      <ActTwo />
      <ActThree />
      <footer className="mt-20 max-w-2xl border-t border-line pt-8 sm:mt-28">
        <p className="text-body-lg-m sm:text-body-lg">
          All of this ran live, in your browser: simulated speakers through Cue&rsquo;s real engine and learning loop.
          Nothing on this page is recorded or scripted.
        </p>
        <p className="mt-2 text-body-sm text-muted">
          The simulated speakers react to taps by a stated rule, so this shows how Cue learns, not how people respond.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-action px-5 text-body-sm font-semibold text-on-action"
        >
          Try Cue →
        </Link>
      </footer>
    </main>
  );
}
