"use client";

import { track } from "@vercel/analytics";
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { UTM_KEYS } from "@/lib/landing/signups";
import { BALANCE, COLORWAYS, OFFER, type ColorwayId } from "@/lib/preorder/offer";
import { CUTOUTS, cutout, type CutoutView } from "./Cutout";
import Save from "./Save";
import s from "./preorder.module.css";

/** Opens the detail view on a color; `from` is where the product sat, so it can fly into place. */
type Open = (color?: ColorwayId, from?: DOMRect) => void;

const ReserveContext = createContext<{ open: Open; full: boolean }>({ open: () => {}, full: false });

export const useReserve = () => useContext(ReserveContext);

/** "pay" sends the buyer to Stripe; "email" holds the price while deposits can't be taken yet. */
type Mode = "pay" | "email" | "saved";

/** The views the detail image can turn to. */
const VIEWS: { view: CutoutView; name: string }[] = [
  { view: "render", name: "Three-quarter" },
  { view: "side", name: "Side" },
];

/** What the concept shows, in plain words. Nothing here that the design hasn't settled. */
const SPEC = [
  "Satin metal body that follows the curve behind one ear",
  "Nothing goes in your ear",
  "Three haptic cues: pause, slow down, speak up",
  "Touch area: hold for on and off, double-tap to switch modes",
  "Charging case and cable in the box",
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

/** Each line of the detail panel arrives a beat after the last, out of a soft blur. */
const beat = (k: number) => ({ "--k": k }) as CSSProperties;

/**
 * The detail view and the page's one action. The product flies in from where it was pressed
 * (lilguy's grid-to-detail move), the details arrive line by line, and reserve sends the buyer
 * to Stripe for the $20 deposit. Until Stripe is set up (checkout answers "not_configured") it
 * holds the price by email instead and says plainly that no payment is taken yet.
 */
export function ReserveProvider({ full, children }: { full: boolean; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const hero = useRef<HTMLImageElement>(null);
  const titleId = useId();
  const [color, setColor] = useState<ColorwayId>("graphite");
  const [view, setView] = useState<CutoutView>("render");
  const [mode, setMode] = useState<Mode>("pay");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  // Once checkout says deposits aren't open, the view stays on the email form for this visit.
  const depositsOff = useRef(false);

  const open = useCallback<Open>((c, from) => {
    // Commit the chosen color now, so the product can be measured in place before the first paint.
    flushSync(() => {
      if (c) setColor(c);
      setView("render");
      setMode(depositsOff.current ? "email" : "pay");
      setError(null);
    });
    dialog.current?.showModal();
    track("preorder_open", { color: c ?? "none" });
    // FLIP: start the product where it sat on the card, then let it travel home.
    const img = hero.current;
    if (!from || !img || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = img.getBoundingClientRect();
    if (!to.width) return;
    img.style.transition = "none";
    img.style.transformOrigin = "top left";
    img.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})`;
    requestAnimationFrame(() => {
      img.style.transition = "transform 720ms cubic-bezier(0.16, 1, 0.3, 1)";
      img.style.transform = "";
    });
  }, []);

  const close = () => dialog.current?.close();

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
  const size = CUTOUTS[view];

  return (
    <ReserveContext.Provider value={{ open, full }}>
      {children}
      <dialog ref={dialog} className={s.detail} aria-labelledby={titleId}>
        <button type="button" className={s.detailBack} onClick={close}>
          <span aria-hidden="true">←</span> back
        </button>
        <div className={s.detailGrid}>
          <div className={s.detailMedia}>
            <div className={s.detailStage}>
              {/* eslint-disable-next-line @next/next/no-img-element -- moved by hand for the fly-in */}
              <img
                ref={hero}
                key={`${color}-${view}`}
                className={`${s.cutout} ${s.detailImage}`}
                src={cutout(color, view)}
                alt={`Cue in ${chosen.name}, ${VIEWS.find((v) => v.view === view)!.name.toLowerCase()} view`}
                width={size.w}
                height={size.h}
              />
            </div>
            <div className={s.views} role="group" aria-label="Views">
              {VIEWS.map((v) => (
                <button
                  key={v.view}
                  type="button"
                  className={s.viewButton}
                  aria-pressed={view === v.view}
                  aria-label={v.name}
                  onClick={() => setView(v.view)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- a small thumbnail of a cut-out */}
                  <img src={cutout(color, v.view)} alt="" />
                </button>
              ))}
            </div>
          </div>

          <div className={s.detailInfo} key={mode}>
            <span className={s.eyebrow} style={beat(0)}>
              Batch {OFFER.batch.number} · ships {OFFER.batch.ships}
            </span>
            <h2 id={titleId} className={s.h3} style={beat(1)}>
              {mode === "saved"
                ? "you’re on the list."
                : full
                  ? "batch 1 is full."
                  : `cue · ${chosen.name.toLowerCase()}`}
            </h2>

            {mode === "saved" ? (
              <>
                <p className={s.detailText} style={beat(2)}>
                  We’ve kept the ${OFFER.price} price and Premium for life for <strong>{email}</strong>, in{" "}
                  {chosen.name}. We’ll email you as soon as you can place your ${OFFER.deposit} deposit.
                </p>
                <button type="button" className={s.button} style={beat(3)} onClick={close}>
                  <span>done</span>
                </button>
              </>
            ) : (
              <>
                <ul className={s.spec} style={beat(2)}>
                  {SPEC.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <ul className={s.batches} style={beat(3)}>
                  <li>
                    <b>
                      batch {OFFER.batch.number} · {OFFER.batch.size} units · ships {OFFER.batch.ships}
                    </b>
                  </li>
                  <li>batch {OFFER.batch.number + 1} · opens when batch 1 is full</li>
                </ul>

                <fieldset className={s.swatches} style={beat(4)}>
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

                <ul className={s.summary} style={beat(5)}>
                  <li className={s.summaryPrice}>
                    <span>
                      Preorder price <Save />
                    </span>
                    <b>
                      <s>${OFFER.launchPrice}+</s> ${OFFER.price}
                    </b>
                  </li>
                  <li>
                    <span>{mode === "email" ? "Pay when deposits open" : "Pay today, refundable"}</span>
                    <b>${OFFER.deposit}</b>
                  </li>
                  <li>
                    <span>Pay when batch {OFFER.batch.number} ships</span>
                    <b>${BALANCE}</b>
                  </li>
                  <li>
                    <span>Premium subscription</span>
                    <b>free for life</b>
                  </li>
                </ul>

                <div style={beat(6)} className={s.detailAction}>
                  {mode === "email" ? (
                    <form onSubmit={saveEmail}>
                      <p className={s.fine} style={{ fontSize: 15, color: "var(--text)" }}>
                        Deposits open very soon. Leave your email and we’ll hold the ${OFFER.price} price for you. No
                        payment today.
                      </p>
                      <label className={s.srOnly} htmlFor={`${titleId}-email`}>
                        Email
                      </label>
                      <div className={s.emailRow}>
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
                        {/* The arrow appears once the address looks complete, as on lilguy. */}
                        <button
                          type="submit"
                          className={`${s.emailGo} ${EMAIL.test(email) ? s.ready : ""}`}
                          disabled={busy}
                          aria-label="Hold my price"
                        >
                          {busy ? "…" : "→"}
                        </button>
                      </div>
                      {/* People never see this field; bots fill it in. */}
                      <input type="text" name="website" tabIndex={-1} autoComplete="off" hidden />
                    </form>
                  ) : (
                    <button type="button" className={s.button} onClick={toCheckout} disabled={busy || full}>
                      <span>{busy ? "opening checkout…" : full ? "batch 1 is full" : "reserve"}</span>
                      <span className={s.buttonPrice}>${OFFER.deposit} down today</span>
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
                </div>
              </>
            )}
          </div>
        </div>
      </dialog>
    </ReserveContext.Provider>
  );
}

/** A button anywhere on the page that opens the detail view. */
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
