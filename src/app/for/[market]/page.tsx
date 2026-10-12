import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PATTERNS, type CuePattern } from "@/lib/cue/patterns";
import { MARKETS, SHARED, marketFor } from "@/lib/landing/markets";
import SignupForm from "./SignupForm";

// Painted-door pages: one per market in src/lib/landing/markets.ts, and nothing else under /for.
export const dynamicParams = false;

export function generateStaticParams() {
  return MARKETS.map((market) => ({ market: market.slug }));
}

export async function generateMetadata({ params }: PageProps<"/for/[market]">): Promise<Metadata> {
  const market = marketFor((await params).market);
  if (!market) return {};
  return {
    title: market.metaTitle,
    description: market.metaDescription,
    openGraph: { title: market.metaTitle, description: market.metaDescription, type: "website" },
    // Reached from ads only, so search traffic doesn't blur the comparison between markets.
    robots: { index: false, follow: false },
  };
}

const CUES: { pattern: CuePattern; key: "pause" | "slow" | "speak" }[] = [
  { pattern: "tap", key: "pause" },
  { pattern: "steps", key: "slow" },
  { pattern: "push", key: "speak" },
];

const REPORT_AREAS = ["Pauses", "Pace", "Volume", "Filler words", "Pitch and tone"];

const PHOTO = "rounded-2xl bg-surface-2 object-cover";
const CONCEPT_NOTE = "Design concept. The finished device may look different.";

/** A cue's rhythm as bars: one per pulse, as long as the pulse (DESIGN.md §11). */
function Rhythm({ pattern }: { pattern: CuePattern }) {
  const pulses = PATTERNS[pattern].vibrate.filter((_, i) => i % 2 === 0);
  return (
    <span aria-hidden="true" className="flex h-2 items-center gap-2">
      {pulses.map((ms, i) => (
        <span key={i} className="h-2 rounded-full bg-cue" style={{ width: Math.max(8, Math.round(ms / 8)) }} />
      ))}
    </span>
  );
}

function Logo() {
  // Horizontal lockup (Tier 2) at 112 px, as in the app header (DESIGN.md §3, §5).
  return (
    <>
      <Image
        src="/brand/cue-logo-horizontal-fullcolor-light.png"
        alt="Cue"
        width={112}
        height={25}
        priority
        className="dark:hidden"
      />
      <Image
        src="/brand/cue-logo-horizontal-fullcolor-dark.png"
        alt="Cue"
        width={112}
        height={25}
        priority
        className="hidden dark:block"
      />
    </>
  );
}

const SECTION_TITLE = "text-heading-2-m font-semibold tracking-[-0.02em] text-balance sm:text-heading-2";

export default async function MarketPage({ params }: PageProps<"/for/[market]">) {
  const market = marketFor((await params).market);
  if (!market) notFound();
  const shared = SHARED[market.wearer];
  const faq = [...market.faq, ...shared.faq];

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-16 pt-8 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <Logo />
        <a
          href="#join"
          className="rounded-lg px-1 text-label font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cue"
        >
          {market.cta}
        </a>
      </header>

      <section className="pt-12 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:items-center lg:gap-16 lg:pt-20">
        <div>
          <p className="text-label font-medium text-cue">{market.eyebrow}</p>
          <h1 className="mt-4 font-display text-display-lg-m font-semibold tracking-[-0.025em] text-balance sm:text-display-lg">
            {market.headline}
          </h1>
          <p className="mt-6 max-w-xl text-body-lg-m text-muted sm:text-body-lg">{market.lead}</p>
          <div className="mt-8 max-w-xl">
            <SignupForm market={market.slug} kind={market.kind} cta={market.cta} />
          </div>
        </div>
        <figure className="mt-12 lg:mt-0">
          <Image
            src="/landing/cue-concept-on-ear.webp"
            alt="Cue worn behind a person’s ear: a slim grey crescent that follows the back of the ear, with nothing in the ear itself."
            width={794}
            height={1024}
            priority
            sizes="(min-width: 1024px) 40vw, 100vw"
            className={`h-auto w-full ${PHOTO}`}
          />
          <figcaption className="mt-3 text-caption text-muted">{CONCEPT_NOTE}</figcaption>
        </figure>
      </section>

      <section aria-labelledby="problem" className="pt-24 sm:pt-32">
        <h2 id="problem" className={SECTION_TITLE}>
          {market.problemTitle}
        </h2>
        <ul className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
          {market.problems.map((problem) => (
            <li key={problem.title} className="border-t border-line pt-5">
              <h3 className="text-title-m font-medium sm:text-title">{problem.title}</h3>
              <p className="mt-2 text-body text-muted">{problem.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cues" className="pt-24 sm:pt-32">
        <h2 id="cues" className={SECTION_TITLE}>
          {shared.cuesTitle}
        </h2>
        <p className="mt-4 max-w-2xl text-body-lg-m text-muted sm:text-body-lg">{shared.cuesIntro}</p>
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {CUES.map((cue) => (
            <li key={cue.pattern} className="flex flex-col rounded-2xl border border-line bg-surface p-6">
              <Rhythm pattern={cue.pattern} />
              <h3 className="mt-5 text-heading-3-m font-semibold tracking-[-0.01em] sm:text-heading-3">
                {PATTERNS[cue.pattern].action}
              </h3>
              <p className="mt-1 text-body-sm text-muted">{PATTERNS[cue.pattern].name}</p>
              <p className="mt-4 text-body">{shared.detects[cue.key]}</p>
              <p className="mt-4 border-t border-line pt-4 text-body-sm text-muted">
                <span className="font-medium text-text">{market.moments.label}:</span> {market.moments[cue.key]}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="report" className="pt-24 sm:pt-32 lg:grid lg:grid-cols-2 lg:items-start lg:gap-16">
        <div>
          <h2 id="report" className={SECTION_TITLE}>
            {market.report.title}
          </h2>
          <p className="mt-4 max-w-xl text-body-lg-m text-muted sm:text-body-lg">{market.report.body}</p>
        </div>
        <ul aria-label="What the report covers" className="mt-10 rounded-2xl border border-line bg-surface lg:mt-0">
          {[...REPORT_AREAS, ...(market.extraReportAreas ?? [])].map((area) => (
            <li key={area} className="border-b border-line px-6 py-4 text-body last:border-b-0">
              {area}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="device" className="pt-24 sm:pt-32">
        <h2 id="device" className={SECTION_TITLE}>
          One small device, behind one ear
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Image
            src="/landing/cue-concept-device.webp"
            alt="The Cue device on its own: a smooth grey crescent with one slim button on its outer edge."
            width={733}
            height={419}
            sizes="(min-width: 768px) 66vw, 100vw"
            className={`h-auto w-full md:col-span-2 md:h-full ${PHOTO}`}
          />
          <Image
            src="/landing/cue-concept-detail-button.webp"
            alt="Close-up of the button and the small microphone opening beside it."
            width={345}
            height={324}
            sizes="(min-width: 768px) 33vw, 100vw"
            className={`h-auto w-full md:h-full ${PHOTO}`}
          />
          <Image
            src="/landing/cue-concept-angles.webp"
            alt="The device from the front, the side and the back."
            width={733}
            height={265}
            sizes="(min-width: 768px) 66vw, 100vw"
            className={`h-auto w-full md:col-span-2 md:h-full ${PHOTO}`}
          />
          <Image
            src="/landing/cue-concept-detail-inner.webp"
            alt="Close-up of the soft inner curve that rests against the ear."
            width={378}
            height={324}
            sizes="(min-width: 768px) 33vw, 100vw"
            className={`h-auto w-full md:h-full ${PHOTO}`}
          />
        </div>
        <p className="mt-3 text-caption text-muted">{CONCEPT_NOTE}</p>
        <ul className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {shared.facts.map((fact) => (
            <li key={fact.title} className="border-t border-line pt-5">
              <h3 className="text-title-m font-medium sm:text-title">{fact.title}</h3>
              <p className="mt-2 text-body text-muted">{fact.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="questions" className="pt-24 sm:pt-32">
        <h2 id="questions" className={SECTION_TITLE}>
          Questions
        </h2>
        <div className="mt-8 max-w-3xl border-t border-line">
          {faq.map((item) => (
            <details key={item.q} className="group border-b border-line">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-title-m font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cue sm:text-title [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  aria-hidden="true"
                  className="text-muted transition-transform duration-200 ease-out group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-2xl pb-5 text-body text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section
        id="join"
        aria-labelledby="join-title"
        className="mt-24 scroll-mt-8 rounded-2xl bg-surface-2 px-6 py-12 sm:mt-32 sm:px-12 sm:py-16"
      >
        <h2 id="join-title" className={SECTION_TITLE}>
          Speak with intention.
        </h2>
        <p className="mt-4 max-w-xl text-body-lg-m text-muted sm:text-body-lg">{shared.joinLine}</p>
        <div className="mt-8 max-w-xl">
          <SignupForm market={market.slug} kind={market.kind} cta={market.cta} />
        </div>
      </section>

      <footer className="pt-12 text-caption text-muted">
        <p>Cue is in development. What this page describes is being built and tested, and may change.</p>
        <p className="mt-1">© 2026 Cue</p>
      </footer>
    </main>
  );
}
