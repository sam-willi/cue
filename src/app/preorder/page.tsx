import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import Link from "next/link";
import { BALANCE, CONCEPT_NOTE, OFFER } from "@/lib/preorder/offer";
import { batchState } from "@/lib/preorder/stripe";
import CueShowcase from "./CueShowcase";
import Logo from "./Logo";
import Cutout from "./Cutout";
import Cursor from "./Cursor";
import Hero from "./Hero";
import { Colorways, Reveal, StickyBar } from "./Pieces";
import { ReserveButton, ReserveProvider } from "./Reserve";
import Deal from "./Deal";
import Save from "./Save";
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
              <a className={s.headerDemo} href="/preorder/try" target="_blank" rel="noopener">
                try the demo <span aria-hidden="true">↗</span>
              </a>
              <span className={s.headerBatch}>{batchLine}</span>
              <Save className={s.headerSave} />
              <ReserveButton>
                reserve<span className={s.headerPrice}> · ${OFFER.deposit} down</span>
              </ReserveButton>
            </div>
          </div>
        </header>

        {/* Six beats, like lilguy: the claim, the tap, the pick, what it's like, the deal, the fine print. */}
        <main>
          <Hero placesLeft={places} />

          <section id="how-it-coaches" className={`${s.wrap} ${s.section}`}>
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

          <section className={`${s.wrap} ${s.section} ${s.drifting}`}>
            <Cutout
              color="graphite"
              view="side"
              alt=""
              speed={0.35}
              spin={-10}
              bob={3.3}
              sizes="15vw"
              className={s.infoDrifterLeft}
            />
            <Cutout
              color="silver"
              view="render"
              alt=""
              speed={-0.15}
              spin={6}
              bob={1.8}
              tapOnArrive
              sizes="20vw"
              className={s.infoDrifterRight}
            />
            <div className={s.info}>
              {INFO.map((line, i) => (
                <Reveal key={i} text={line} className={i === INFO.length - 1 ? s.quietP : undefined} />
              ))}
            </div>
          </section>

          <section className={`${s.wrap} ${s.section} ${s.drifting}`} aria-labelledby="offer-title">
            <Cutout
              color="champagne"
              view="side"
              alt=""
              speed={0.3}
              spin={9}
              bob={0.7}
              sizes="20vw"
              className={s.offerDrifter}
            />
            <span className={s.eyebrow}>The batch 1 offer</span>
            <h2 id="offer-title" className={s.h2} style={{ marginBottom: 48 }}>
              early is cheaper.
            </h2>
            <table className={s.compare}>
              <caption className={s.srOnly}>Cue at launch compared with a batch 1 preorder</caption>
              <thead>
                <tr>
                  <td />
                  <th scope="col">At launch</th>
                  <th scope="col" className={s.now}>
                    Preorder now <Save />
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Cue</th>
                  <td>
                    <s>${OFFER.launchPrice}+</s>
                  </td>
                  <td className={s.now}>${OFFER.price}</td>
                </tr>
                <tr>
                  <th scope="row">Premium</th>
                  <td>
                    <s>a monthly subscription</s>
                  </td>
                  <td className={s.now}>free for life</td>
                </tr>
                <tr>
                  <th scope="row">Pay today</th>
                  <td className={s.na}>not on sale yet</td>
                  <td className={s.now}>
                    ${OFFER.deposit} <span>refundable until it ships</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Pay later</th>
                  <td>—</td>
                  <td className={s.now}>
                    ${BALANCE}{" "}
                    <span>
                      when batch {OFFER.batch.number} ships, {OFFER.batch.ships}. We email first.
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
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
            <div className={`${s.closer} ${s.drifting}`}>
              <Cutout
                color="graphite"
                alt=""
                speed={0.2}
                spin={-7}
                bob={0.4}
                tapOnArrive
                sizes="20vw"
                className={s.closerGraphite}
              />
              <Cutout
                color="silver"
                view="side"
                alt=""
                speed={-0.12}
                spin={8}
                bob={2.6}
                delay={120}
                sizes="12vw"
                className={s.closerSilver}
              />
              <Cutout
                color="champagne"
                alt=""
                speed={0.28}
                spin={5}
                bob={4.4}
                delay={240}
                tapOnArrive
                sizes="18vw"
                className={s.closerChampagne}
              />
              <h2 className={s.h2}>say less, um.</h2>
              <Deal className={s.closerDeal} />
              <ReserveButton>
                {full ? "batch 1 is full" : "reserve yours"}{" "}
                <span className={s.buttonPrice}>${OFFER.deposit} down</span>
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
              ${OFFER.deposit} down · ${OFFER.price} total
            </span>
          </ReserveButton>
        </StickyBar>
      </ReserveProvider>
      <Cursor />
      <Analytics />
    </div>
  );
}
