"use client";

import { track } from "@vercel/analytics";
import Image from "next/image";
import { createContext, useCallback, useContext, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { UTM_KEYS } from "@/lib/landing/signups";
import { BALANCE, COLORWAYS, OFFER, type ColorwayId } from "@/lib/preorder/offer";
import { CUTOUTS, cutout } from "./Cutout";
import s from "./preorder.module.css";

const ReserveContext = createContext<{ open: (color?: ColorwayId) => void; full: boolean }>({
  open: () => {},
  full: false,
});

export const useReserve = () => useContext(ReserveContext);

/** "pay" sends the buyer to Stripe; "email" holds the price while deposits can't be taken yet. */
type Mode = "pay" | "email" | "saved";

/** Ad tags on the page address, kept with an email reservation like the landing-page sign-ups. */
function utmTags(): Record<string, string> {
  const q = new URLSearchParams(window.location.search);
  const tags: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = q.get(key);
    if (value) tags[key] = value;
  }
  return tags;
}

/**
 * The page's one action. Choosing a color and pressing continue sends the buyer to Stripe for
 * the $20 deposit. Until Stripe is set up (the checkout answers "not_configured") it offers to
 * hold the price by email instead, and says plainly that no payment is taken yet.
 */
export function ReserveProvider({ full, children }: { full: boolean; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [color, setColor] = useState<ColorwayId>("graphite");
  const [mode, setMode] = useState<Mode>("pay");
  const [busy, setBusy] = useState(false);
  // Once checkout says deposits aren't open, the dialog stays on the email form for this visit.
  const depositsOff = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  const open = useCallback((c?: ColorwayId) => {
    if (c) setColor(c);
    setMode(depositsOff.current ? "email" : "pay");
    setError(null);
    dialog.current?.showModal();
    track("preorder_open", { color: c ?? "none" });
  }, []);

  const toCheckout = async () => {
    setBusy(true);
    setError(null);
    track("preorder_checkout", { color });
    try {
      const res = await fetch("/api/preorder/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colorway: color }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; code?: string; error?: string };
      if (body.url) {
        window.location.assign(body.url);
        return;
      }
      if (body.code === "not_configured") {
        depositsOff.current = true;
        setMode("email");
        setBusy(false);
        return;
      }
      setError(body.error ?? "We couldn’t open checkout just now. Please try again in a moment.");
    } catch {
      setError("We couldn’t reach checkout. Check your connection and try again.");
    }
    setBusy(false);
  };

  const saveEmail = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const website = new FormData(e.currentTarget).get("website");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/preorder/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, colorway: color, website, utm: utmTags() }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setMode("saved");
        setBusy(false);
        track("preorder_email_saved", { color });
        return;
      }
      setError(body.error ?? "We couldn’t save that just now. Please try again in a moment.");
    } catch {
      setError("We couldn’t reach the server. Check your connection and try again.");
    }
    setBusy(false);
  };

  const chosen = COLORWAYS.find((c) => c.id === color)!;

  return (
    <ReserveContext.Provider value={{ open, full }}>
      {children}
      <dialog ref={dialog} className={s.dialog} aria-labelledby={titleId}>
        <div className={s.dialogBody}>
          <div className={s.dialogTop}>
            <div>
              <span className={s.eyebrow} style={{ marginBottom: 8 }}>
                Batch {OFFER.batch.number} · ships {OFFER.batch.ships}
              </span>
              <h2 id={titleId} className={s.h3}>
                {mode === "saved" ? "you’re on the list." : full ? "batch 1 is full." : "reserve your Cue."}
              </h2>
            </div>
            <button type="button" className={s.close} aria-label="Close" onClick={() => dialog.current?.close()}>
              ×
            </button>
          </div>

          <figure className={s.dialogPhoto}>
            <Image
              key={color}
              className={s.cutout}
              src={cutout(color, "device")}
              alt={`Cue in ${chosen.name}`}
              width={CUTOUTS.device.w}
              height={CUTOUTS.device.h}
              unoptimized
            />
          </figure>

          {mode === "saved" ? (
            <>
              <p className={s.body} style={{ fontSize: 16 }}>
                We’ve kept the ${OFFER.price} price and Premium for life for <strong>{email}</strong>, in {chosen.name}.
                We’ll email you as soon as you can place your ${OFFER.deposit} deposit.
              </p>
              <button type="button" className={s.button} onClick={() => dialog.current?.close()}>
                <span>done</span>
              </button>
            </>
          ) : (
            <>
              <fieldset className={s.swatches}>
                <legend className={s.srOnly}>Color</legend>
                {COLORWAYS.map((c) => (
                  <label key={c.id} className={s.swatch}>
                    <input
                      type="radio"
                      name="color"
                      value={c.id}
                      checked={color === c.id}
                      onChange={() => setColor(c.id)}
                    />
                    <span className={s.chip} style={{ background: c.swatch }} aria-hidden="true" />
                    {c.name}
                  </label>
                ))}
              </fieldset>

              <ul className={s.summary}>
                <li>
                  <span>{mode === "email" ? "Deposit, once it opens" : "Today, refundable"}</span>
                  <b>${OFFER.deposit}</b>
                </li>
                <li>
                  <span>When batch {OFFER.batch.number} ships</span>
                  <b>${BALANCE}</b>
                </li>
                <li>
                  <span>Premium</span>
                  <b>free for life</b>
                </li>
              </ul>

              {mode === "email" ? (
                <form onSubmit={saveEmail}>
                  <p className={s.fine} style={{ fontSize: 15, color: "var(--text)" }}>
                    Deposits open very soon. Leave your email and we’ll hold the ${OFFER.price} price for you. No
                    payment today.
                  </p>
                  <label className={s.srOnly} htmlFor={`${titleId}-email`}>
                    Email
                  </label>
                  <input
                    id={`${titleId}-email`}
                    className={s.field}
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@work.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  {/* People never see this field; bots fill it in. */}
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" hidden />
                  <button type="submit" className={s.button} disabled={busy}>
                    <span>{busy ? "saving…" : "hold my price"}</span>
                    <span aria-hidden="true">→</span>
                  </button>
                </form>
              ) : (
                <button type="button" className={s.button} onClick={toCheckout} disabled={busy || full}>
                  <span>{busy ? "opening checkout…" : full ? "batch 1 is full" : "continue to payment"}</span>
                  <span className={s.buttonPrice}>${OFFER.deposit}</span>
                </button>
              )}
              {error && (
                <p className={s.error} role="alert">
                  {error}
                </p>
              )}
              <p className={s.fine}>
                {mode === "email"
                  ? "We’ll only email you about your reservation."
                  : `Refundable any time before your Cue ships. Your card is saved so the $${BALANCE} balance can be charged when it does; we’ll email you before that happens.`}
              </p>
            </>
          )}
        </div>
      </dialog>
    </ReserveContext.Provider>
  );
}

/** A button anywhere on the page that opens the reserve dialog. */
export function ReserveButton({
  color,
  className,
  children,
}: {
  color?: ColorwayId;
  className?: string;
  children: ReactNode;
}) {
  const { open } = useReserve();
  return (
    <button type="button" className={className ?? s.button} onClick={() => open(color)}>
      {children}
    </button>
  );
}
