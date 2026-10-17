import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import Link from "next/link";
import { OFFER } from "@/lib/preorder/offer";
import Cursor from "../Cursor";
import Logo from "../Logo";
import VoiceDemo from "../VoiceDemo";
import s from "../preorder.module.css";

export const metadata: Metadata = {
  title: "Try Cue with your voice",
  description: "Talk for 45 seconds and feel Cue's coaching cues: the same engine as the device, in your browser.",
};

/**
 * The voice demo on its own page, opened in a new tab from /preorder: the real coaching engine on
 * the visitor's microphone, with the way back to reserving at the bottom.
 */
export default function TryPage() {
  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={`${s.wrap} ${s.headerRow}`}>
          <Link href="/preorder" aria-label="Cue preorder">
            <Logo />
          </Link>
          <div className={s.headerRight}>
            <Link className={s.button} href="/preorder#colors">
              reserve · ${OFFER.deposit} down
            </Link>
          </div>
        </div>
      </header>

      <main className={`${s.wrap} ${s.tryPage}`}>
        <div className={s.tryIntro}>
          <span className={s.eyebrow}>The demo</span>
          <h1 className={s.h2}>hear what it notices.</h1>
          <p className={s.body}>
            Press start and talk about your week. Cue listens for the habits it coaches and taps when one builds. On a
            phone, you’ll feel each tap.
          </p>
        </div>

        <VoiceDemo />

        <div className={s.tryNext}>
          <p className={s.body} style={{ margin: 0 }}>
            Batch {OFFER.batch.number} ships {OFFER.batch.ships}. ${OFFER.price} now, Premium free for life.
          </p>
          <Link className={s.tryLink} href="/preorder#colors">
            pick your finish <span aria-hidden="true">→</span>
          </Link>
        </div>
      </main>
      <Cursor />
      <Analytics />
    </div>
  );
}
