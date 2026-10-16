import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BALANCE, COLORWAYS, CONCEPT_NOTE, OFFER, panel } from "@/lib/preorder/offer";
import { placesLeft } from "@/lib/preorder/stripe";
import CueShowcase from "./CueShowcase";
import Hero from "./Hero";
import { Colorways, Reveal, StickyBar } from "./Pieces";
import { ReserveButton, ReserveProvider } from "./Reserve";
import ScriptedDemo from "./ScriptedDemo";
import VoiceDemo from "./VoiceDemo";
import s from "./preorder.module.css";

// The places-left count comes from Stripe; refresh it about once a minute.
export const revalidate = 60;

const TITLE = "Cue — say less, um.";
const DESCRIPTION = `A small coach behind your ear that taps you, privately, when a speaking habit shows up. Preorder for $${OFFER.price} with Premium free for life. $${OFFER.deposit} refundable deposit.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", images: [panel("graphite", "on-ear")] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/** What the page says about Cue, as lines that arrive on scroll. Plain claims only (DESIGN.md §17). */
const INFO = [
  "Cue listens for a habit as it builds: filler words piling up, rushing, going too long without a pause, a turn that runs on, your voice trailing off.",
  "Then it taps behind your ear, in one of three rhythms. You adjust. The room never knows.",
  "It doesn’t tap for every “um”. The occasional one is normal. It waits for a pattern, and stays quiet otherwise.",
  "Afterwards, the app shows how it went: your pauses, pace, volume, fillers, and pitch, and one thing to try differently next time.",
  "You’ve debugged worse than a quarterly update. This is just a feedback loop with a very short delay.",
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
  const places = await placesLeft();
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
              <ReserveButton>reserve · ${OFFER.deposit}</ReserveButton>
            </div>
          </div>
        </header>

        <main>
          <Hero placesLeft={places} />

          <section className={`${s.wrap} ${s.section}`}>
            <CueShowcase />
          </section>

          <section aria-label="A sprint review, with Cue">
            <ScriptedDemo />
          </section>

          <section className={`${s.wrap} ${s.section}`} style={{ paddingTop: 40 }}>
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
                <span className={s.offerBig}>${OFFER.launchPrice}+</span>
                <span className={s.offerSmall}>plus a Premium subscription</span>
              </div>
              <div className={s.offerCol}>
                <span className={s.offerLabel}>Preorder now</span>
                <span className={s.offerBig}>${OFFER.price}</span>
                <span className={s.offerSmall}>with Premium free, for life</span>
              </div>
            </div>
            <ol className={s.steps}>
              <li>
                <strong>${OFFER.deposit} today</strong>
                Holds your place and your price. Refundable any time before it ships.
              </li>
              <li>
                <strong>${BALANCE} when it ships</strong>
                Batch {OFFER.batch.number} ships {OFFER.batch.ships}. We email you before we charge.
              </li>
              <li>
                <strong>Premium, forever</strong>
                Included for as long as you use Cue. No subscription to remember.
              </li>
            </ol>
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

          <section className={`${s.wrap} ${s.section}`} aria-labelledby="details-title">
            <span className={s.eyebrow}>Up close</span>
            <h2 id="details-title" className={s.h3}>
              satin metal. one touch area. nothing in your ear.
            </h2>
            <div className={s.triptych}>
              {COLORWAYS.map((c, n) => (
                <figure key={c.id} className={s.photo} style={{ "--i": n } as React.CSSProperties}>
                  <Image
                    src={panel(c.id, "on-ear")}
                    alt={`Cue in ${c.name}, worn behind the ear`}
                    width={509}
                    height={298}
                    sizes="(max-width: 760px) 100vw, 33vw"
                  />
                  <figcaption className={s.photoLabel}>{c.name.toLowerCase()}</figcaption>
                </figure>
              ))}
            </div>
            <div className={s.details}>
              <figure>
                <Image
                  src={panel("silver", "button")}
                  alt="The touch area on the outer edge"
                  width={186}
                  height={128}
                  sizes="40vw"
                />
              </figure>
              <figure>
                <Image
                  src={panel("silver", "curve")}
                  alt="The inner curve that rests behind the ear"
                  width={130}
                  height={128}
                  sizes="30vw"
                />
              </figure>
              <figure>
                <Image
                  src={panel("silver", "port")}
                  alt="The small opening on the outer edge"
                  width={184}
                  height={128}
                  sizes="40vw"
                />
              </figure>
            </div>
            <div className={s.boxRow}>
              <figure>
                <Image
                  src={panel("graphite", "case")}
                  alt="The charging case, closed and open with Cue inside"
                  width={304}
                  height={193}
                  sizes="60vw"
                />
              </figure>
              <figure>
                <Image
                  src={panel("champagne", "box")}
                  alt="The box, with Cue, its case and a cable"
                  width={199}
                  height={193}
                  sizes="40vw"
                />
              </figure>
            </div>
            <div className={s.caption}>
              <p>
                <b>Touch, don’t tap your phone.</b> Hold to turn Cue on or off. Double-tap to switch between
                conversation and presentation.
              </p>
              <p>
                <b>Behind the ear.</b> It follows the curve behind one ear and sits close to your head. Your ear stays
                open.
              </p>
              <p>
                <b>In the box.</b> Cue, its charging case, and a cable.
              </p>
            </div>
            <p className={s.conceptNote}>{CONCEPT_NOTE}</p>
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
          </section>

          <section className={`${s.wrap} ${s.closer}`}>
            <h2 className={s.h2}>say less, um.</h2>
            <ReserveButton>
              {full ? "batch 1 is full" : "reserve yours"} <span className={s.buttonPrice}>${OFFER.deposit}</span>
            </ReserveButton>
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
              ${OFFER.deposit} today · ${OFFER.price} total
            </span>
          </ReserveButton>
        </StickyBar>
      </ReserveProvider>
      <Analytics />
    </div>
  );
}
