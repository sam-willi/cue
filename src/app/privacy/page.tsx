import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy policy — Cue",
  description: "What Cue collects on this website, why, and how to have it removed.",
};

const CONTACT = "speakwithcue@gmail.com";
const UPDATED = "October 12, 2026";

const H2 = "mt-12 text-heading-3-m font-semibold tracking-[-0.01em] sm:text-heading-3";
const P = "mt-3 text-body text-muted";
const LIST = "mt-3 list-disc space-y-1.5 pl-5 text-body text-muted";
const LINK = "font-medium text-text underline underline-offset-4";

// Keep this page true to the code: the sign-up form (src/app/for/[market]/SignupForm.tsx), where
// sign-ups are stored (src/lib/landing/store.ts), the visit counter on the landing pages
// (src/app/for/[market]/page.tsx) and the app's own privacy notes (README.md).
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-24 pt-8 sm:px-8">
      <header>
        <Link href="/" aria-label="Cue home" className="inline-block">
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
        </Link>
      </header>

      <h1 className="mt-14 text-heading-2-m font-semibold tracking-[-0.02em] sm:text-heading-2">Privacy policy</h1>
      <p className="mt-2 text-body-sm text-muted">Last updated {UPDATED}</p>

      <p className="mt-8 text-body-lg-m text-muted sm:text-body-lg">
        Cue is a speaking coach that is still in development. This page says what we collect on this website, why, and
        how to have it removed.
      </p>

      <h2 className={H2}>What we collect when you sign up</h2>
      <p className={P}>When you join early access or ask for a pilot, we keep:</p>
      <ul className={LIST}>
        <li>your email address</li>
        <li>your school or organization, if you add it when asking for a school pilot</li>
        <li>which of our pages you signed up on</li>
        <li>the campaign tags in the link you followed, which tell us which ad or post brought you here</li>
        <li>the date and time</li>
      </ul>

      <h2 className={H2}>What we use it for</h2>
      <ul className={LIST}>
        <li>to email you about Cue early access, or about a pilot if you asked for one</li>
        <li>to see which groups of people are most interested in Cue, so we know who to build for first</li>
      </ul>
      <p className={P}>We don’t sell your information, and we don’t use it for anything else.</p>

      <h2 className={H2}>Where it is kept and who can see it</h2>
      <p className={P}>
        Sign-ups are kept in a private spreadsheet in Google Sheets that only the Cue team can open. This website is
        hosted by Vercel, which handles each visit to the site and, like any web host, keeps routine technical records
        such as IP addresses. Google and Vercel act as our service providers. We don’t share your sign-up details with
        anyone else.
      </p>

      <h2 className={H2}>Cookies and tracking</h2>
      <p className={P}>
        This website doesn’t set advertising or analytics cookies. On our sign-up pages we count visits with Vercel Web
        Analytics, which doesn’t use cookies and doesn’t identify you: it records the page visited, the site and
        campaign tags that brought you there, and your general device type and country.
      </p>

      <h2 className={H2}>The Cue prototype app</h2>
      <p className={P}>
        The home page of this site is a working prototype. If you choose to start listening, your microphone audio is
        sent to Deepgram, a speech-recognition service, so your speech can be turned into text. Cue’s own server doesn’t
        store your audio or what you said. Your settings stay in your browser on your device.
      </p>

      <h2 className={H2}>How long we keep it</h2>
      <p className={P}>
        We keep your sign-up details until you ask us to delete them, or until we no longer need them to tell you about
        early access.
      </p>

      <h2 className={H2}>Your choices</h2>
      <p className={P}>
        Email{" "}
        <a href={`mailto:${CONTACT}`} className={LINK}>
          {CONTACT}
        </a>{" "}
        to see what we hold about you, correct it, or have it deleted. You can also ask us to stop emailing you at any
        time.
      </p>

      <h2 className={H2}>Children</h2>
      <p className={P}>
        This website is for adults. Our page for schools is written for teachers and administrators, and we don’t
        knowingly collect information from children under 13.
      </p>

      <h2 className={H2}>Changes to this page</h2>
      <p className={P}>If what we collect or how we use it changes, we’ll update this page and the date at the top.</p>

      <h2 className={H2}>Contact</h2>
      <p className={P}>
        Questions about this page or your information:{" "}
        <a href={`mailto:${CONTACT}`} className={LINK}>
          {CONTACT}
        </a>
      </p>
    </main>
  );
}
