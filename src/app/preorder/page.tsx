import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BALANCE, CONCEPT_NOTE, OFFER, SAVING } from "@/lib/preorder/offer";
import { batchState } from "@/lib/preorder/stripe";
import CueShowcase from "./CueShowcase";
import Cursor from "./Cursor";
import Hero from "./Hero";
import { Colorways, Reveal, StickyBar } from "./Pieces";
import { ReserveButton, ReserveProvider } from "./Reserve";
import Save from "./Save";
import VoiceDemo from "./VoiceDemo";
import s from "./preorder.module.css";

// The places-left count comes from Stripe; refresh it about once a minute.
export const revalidate = 60;

const TITLE = "you suck at speaking. — Cue";
const DESCRIPTION = `A small coach behind your ear that taps you, privately, when a speaking habit shows up. Preorder for $${OFFER.price} with Premium free for life. $${OFFER.deposit} refundable deposit.`;

// Next makes image addresses absolute on its own but not video ones, and previews need them absolute.
// This is the same base Next falls back to on Vercel.
const SITE = new URL(
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000",
);

export const metadata: Metadata = {
  metadataBase: SITE,
  title: TITLE,
  description: DESCRIPTION,
  // Made by scripts/preorder-social.mjs: a still for every preview, and a short loop of the tap
  // for the apps that play one.
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    images: [{ url: "/preorder/social.png", width: 1200, height: 630, alt: "you suck at speaking. Cue, in Graphite." }],
    videos: [{ url: new URL("/preorder/social.mp4", SITE), width: 1200, height: 630, type: "video/mp4" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/preorder/social.png"] },
};

/**
 * Cue described by what it does to you, not what's inside it (the lilguy move: every sensor
 * explained as a feeling). Each line still states something true about the product.
 */
const INFO = [
  "Cue notices you rushing before your audience does.",
  "It doesn’t care how smart you are. It cares that you’ve said “basically” four times in a minute.",
  "It’s too polite to interrupt. One tap behind the ear, and you take it from there.",
  "It lets the odd “um” slide. Everyone gets a few. It taps when they start piling up.",
  "No screen. No voice. No opinion about your slides.",
  "Afterwards, the app shows how it went, and one thing to try next time.",
];

const FAQ = [
  {
    q: "Is the $20 really refundable?",
    a: `Yes. Ask any time before your Cue ships and you get the full $${OFFER.deposit} back, no questions.`,
  },
  {
    q: "When do I pay the rest?",
    a: `When batch ${OFFER.batch.number} is ready to ship (${OFFER.batch.ships}). We’ll email you first, then charge the $${BALANCE} balance to the card you reserved with. Changed your mind by then? Cancel and get your deposit back.`,
  },
  {
    q: "What does “Premium free for life” mean?",
    a: `At launch, Cue will cost $${OFFER.launchPrice} or more, plus a Premium subscription. Everyone who preorders from batch ${OFFER.batch.number} gets Premium free for as long as they use Cue.`,
  },
  {
    q: "Does it go in my ear?",
    a: "No. One small device follows the curve behind one ear. Your ear stays open, and it isn’t an earbud.",
  },
  {
    q: "What’s in the box?",
    a: "Cue, its charging case, and a cable.",
  },
  {
    q: "Does it record me?",
    a: "Cue has to hear your speech to coach it. Today’s prototype sends audio to a speech-recognition service to do that. Our aim for the product is to process speech on your own devices and keep no recordings by default, and we’ll tell you exactly how audio is handled before you wear one.",
  },
  {
    q: "Is this exactly what I’ll get?",
    a: `The images on this page are design concepts. The finished device may look different, and we’ll show you the final design before your batch ships, while your deposit is still refundable.`,
  },
];

function Logo() {
  return (
    <>
      <Image
        className="dark:hidden"
        src="/brand/cue-logo-horizontal-fullcolor-light.png"
        alt="Cue"
        width={104}
        height={23}
        priority
      />
      <Image
        className="hidden dark:block"
        src="/brand/cue-logo-horizontal-fullcolor-dark.png"
        alt="Cue"
        width={104}
        height={23}
        priority
      />
    </>
  );
}

export default async function PreorderPage() {
  const batch = await batchState();
  const places = batch?.left ?? null;
  const full = places === 0;
  const batchLine =
    places === null ? (
      <>
        Batch {OFFER.batch.number}: <b>{OFFER.batch.size} units</b>, ships {OFFER.batch.ships}
      </>
    ) : (
      <>
        Batch {OFFER.batch.number}:{" "}
        <b>
          {places} of {OFFER.batch.size} left
        </b>
        , ships {OFFER.batch.ships}
      </>
    );

  return (
    <div className={s.page}>
      <ReserveProvider full={full}>
        <header className={s.header}>
          <div className={`${s.wrap} ${s.headerRow}`}>
            <Logo />
            <div className={s.headerRight}>
              <span className={s.headerBatch}>{batchLine}</span>
              <Save className={s.headerSave} />
              <ReserveButton>reserve · ${OFFER.deposit}</ReserveButton>
            </div>
          </div>
        </header>

        {/* Seven beats, like lilguy: the claim, the tap, the pick, your own voice, what it's like, the deal, the fine print. */}
        <main>
          <Hero placesLeft={places} />

          <section className={`${s.wrap} ${s.section}`}>
            <CueShowcase />
          </section>

          <section id="colors" className={`${s.wrap} ${s.section}`} aria-labelledby="colors-title">
            <div className={s.colorsHead}>
              <div>
                <span className={s.eyebrow}>Three finishes</span>
                <h2 id="colors-title" className={s.h2}>
                  pick yours.
                </h2>
              </div>
              <p className={s.batchLine}>{batchLine}</p>
            </div>
            <Colorways />
            <p className={s.conceptNote}>{CONCEPT_NOTE}</p>
          </section>

          <section id="hear-it" className={`${s.wrap} ${s.section}`} style={{ paddingTop: 0 }}>
            <VoiceDemo />
          </section>

          <section className={`${s.wrap} ${s.section}`}>
            <div className={s.info}>
              {INFO.map((line, i) => (
                <Reveal key={i} text={line} className={i === INFO.length - 1 ? s.quietP : undefined} />
              ))}
            </div>
          </section>

          <section className={`${s.wrap} ${s.section}`} aria-labelledby="offer-title">
            <span className={s.eyebrow}>The batch 1 offer</span>
            <h2 id="offer-title" className={s.h2} style={{ marginBottom: 48 }}>
              early is cheaper.
            </h2>
            <div className={s.offer}>
              <div className={`${s.offerCol} ${s.then}`}>
                <span className={s.offerLabel}>At launch</span>
                <span className={s.offerBig}>
                  <s>${OFFER.launchPrice}+</s>
                </span>
                <span className={s.offerSmall}>
                  <s>plus a Premium subscription, every month</s>
                </span>
              </div>
              <div className={s.offerCol}>
                <span className={s.offerLabel}>
                  Preorder now <Save />
                </span>
                <span className={s.offerBig}>${OFFER.price}</span>
                <span className={s.offerSmall}>
                  with Premium <b>free, for life</b>
                </span>
              </div>
            </div>
            <ol className={s.steps}>
              <li>
                <strong>${OFFER.deposit} today</strong>
                Holds your place and your price. Refundable until it ships.
              </li>
              <li>
                <strong>${BALANCE} when it ships</strong>
                Batch {OFFER.batch.number} ships {OFFER.batch.ships}. We email you before we charge.
              </li>
              <li>
                <strong>Premium, forever</strong>
                Included for as long as you use Cue.
              </li>
            </ol>
          </section>

          <section className={`${s.wrap} ${s.section}`} aria-labelledby="faq-title">
            <span className={s.eyebrow}>Questions</span>
            <h2 id="faq-title" className={s.h3}>
              the fine print, in plain words.
            </h2>
            <div className={s.faq}>
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
            <div className={s.closer}>
              <h2 className={s.h2}>say less, um.</h2>
              <p className={s.closerSave}>
                <Save long />
              </p>
              <ReserveButton>
                {full ? "batch 1 is full" : "reserve yours"} <span className={s.buttonPrice}>${OFFER.deposit}</span>
              </ReserveButton>
            </div>
          </section>
        </main>

        <footer className={s.wrap}>
          <div className={s.footer}>
            <Logo />
            <nav aria-label="Footer">
              <Link href="/">Try the coaching app</Link>
              <Link href="/privacy">Privacy</Link>
            </nav>
          </div>
        </footer>

        <StickyBar>
          <ReserveButton>
            <span>{full ? "batch 1 is full" : "reserve yours"}</span>
            <span className={s.buttonPrice}>
              ${OFFER.price}, save ${SAVING}+
            </span>
          </ReserveButton>
        </StickyBar>
      </ReserveProvider>
      <Cursor />
      <Analytics />
    </div>
  );
}
