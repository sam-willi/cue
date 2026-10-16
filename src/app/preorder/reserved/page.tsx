import type { Metadata } from "next";
import Link from "next/link";
import { BALANCE, OFFER, colorwayFor } from "@/lib/preorder/offer";
import { batchDeposits, batchNumber, checkoutSession, stripeKey, type PaidSession } from "@/lib/preorder/stripe";
import s from "../preorder.module.css";

export const metadata: Metadata = {
  title: "You’re in — Cue",
  robots: { index: false, follow: false },
};

/** Where Stripe sends a buyer after paying the deposit. It reads the session back to say what was reserved. */
export default async function ReservedPage({ searchParams }: PageProps<"/preorder/reserved">) {
  const id = (await searchParams).session_id;
  const key = stripeKey();
  let session: PaidSession | null = null;
  if (key && typeof id === "string" && id.startsWith("cs_")) {
    session = await checkoutSession(key, id).catch(() => null);
  }
  const color = colorwayFor(session?.colorway);
  // Your number is your place in the order deposits were paid. Stripe's search can take a minute
  // to include a payment this new, so the page says so rather than guessing.
  let number: number | null = null;
  if (key && session?.paid && session.paymentIntent) {
    const deposits = await batchDeposits(key, true).catch(() => []);
    const at = deposits.findIndex((d) => d.id === session.paymentIntent);
    if (at >= 0) number = at + 1;
  }

  return (
    <div className={s.page}>
      <main className={`${s.wrap} ${s.thanks}`}>
        <span className={s.eyebrow}>
          Batch {OFFER.batch.number} · ships {OFFER.batch.ships}
        </span>
        <h1 className={s.h2}>
          {session?.paid ? (number ? `you’re ${batchNumber(number)}.` : "you’re in.") : "almost there."}
        </h1>
        {session?.paid ? (
          <p className={s.body}>
            Your {color ? <strong>{color.name}</strong> : "Cue"} is reserved at ${OFFER.price}, with Premium free for
            life.{" "}
            {number
              ? `Your number in batch ${OFFER.batch.number} is ${batchNumber(number)} of ${OFFER.batch.size}.`
              : "Your number shows here within a minute or so; refresh to see it."}{" "}
            We’ve sent a receipt{session.email ? ` to ${session.email}` : ""}. We’ll email you before we charge the $
            {BALANCE} balance, and your ${OFFER.deposit} is refundable until it ships.
          </p>
        ) : (
          <p className={s.body}>
            We couldn’t confirm your deposit from here. If you paid, your receipt is on its way by email and your place
            is safe. If not, you can try again.
          </p>
        )}
        <div className={s.actions}>
          <Link className={s.button} href="/preorder">
            back to Cue
          </Link>
          <Link className={s.ghost} href="/">
            try the coaching app <span aria-hidden="true">→</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
