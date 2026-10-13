"use client";

import { useId, useState, type FormEvent } from "react";
import type { MarketKind } from "@/lib/landing/markets";
import { UTM_KEYS } from "@/lib/landing/signups";

const FIELD =
  "min-h-12 w-full rounded-control border border-field bg-bg px-5 text-body text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cue";
const LABEL = "mb-1.5 block text-body-sm font-medium";
const CARD = "scroll-mt-24 rounded-card border border-line bg-surface p-4 sm:p-7";

/** What the visitor is signing up for, and what follows, in the order it happens. */
const COPY: Record<MarketKind, { intro: string; steps: string[]; note: string }> = {
  "early-access": {
    intro: "Cue isn’t on sale yet. Join the list and be among the first to try it.",
    steps: ["Leave your email", "We email you when early access opens", "You decide if you want one"],
    note: "Free to join. No payment details. We only email you about early access.",
  },
  pilot: {
    intro: "Cue isn’t on sale yet. Leave your email and we’ll plan a small pilot with you.",
    steps: ["Leave your email", "We email you to plan a pilot", "You decide whether to go ahead"],
    note: "Free to ask. No commitment. We only email you about a pilot.",
  },
};

/**
 * The page's one action: leave an email (and, for a pilot, a school if they wish) against this market.
 * The email field and button come first, so on a phone they show without scrolling.
 * `title` heads the card where no section heading already does; `anchor` lets the header's
 * button bring the visitor here.
 */
export default function SignupForm({
  market,
  kind,
  cta,
  title,
  anchor,
}: {
  market: string;
  kind: MarketKind;
  cta: string;
  title?: string;
  anchor?: string;
}) {
  const id = useId();
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const pilot = kind === "pilot";
  const copy = COPY[kind];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;
    const form = new FormData(event.currentTarget);
    // Which ad sent this visitor: the utm_* tags on the page address.
    const query = new URLSearchParams(window.location.search);
    const utm = Object.fromEntries(UTM_KEYS.flatMap((key) => (query.get(key) ? [[key, query.get(key)]] : [])));
    setState("sending");
    setError(null);
    try {
      const response = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market,
          email: form.get("email"),
          organization: form.get("organization"),
          website: form.get("website"),
          utm,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Something went wrong. Please try again.");
      }
      setEmail(String(form.get("email") ?? "").trim());
      setState("done");
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message !== "Failed to fetch"
          ? caught.message
          : "We couldn’t reach Cue. Check your connection and try again.",
      );
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div id={anchor} role="status" className={CARD}>
        <p className="flex items-center gap-3 text-title-m font-semibold sm:text-title">
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-cue-soft text-cue"
          >
            ✓
          </span>
          {pilot ? "Request received" : "You’re on the list"}
        </p>
        <p className="mt-3 text-body text-muted">
          We’ll email <span className="font-medium break-all text-text">{email}</span>
          {pilot ? " to plan a pilot with you." : " when early access opens."} There’s nothing else to do for now.
        </p>
      </div>
    );
  }

  return (
    <form id={anchor} onSubmit={submit} className={`${CARD} flex flex-col gap-3 sm:gap-4`}>
      {title && <h2 className="landing-display text-heading-3-m sm:text-heading-3">{title}</h2>}

      <div>
        <label htmlFor={`${id}-email`} className={`sr-only sm:not-sr-only ${LABEL}`}>
          Your email
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            inputMode="email"
            required
            maxLength={254}
            autoComplete="email"
            placeholder="name@example.com"
            aria-describedby={error ? `${id}-error` : `${id}-note`}
            aria-invalid={error ? true : undefined}
            className={`${FIELD} sm:flex-1`}
          />
          <button
            type="submit"
            disabled={state === "sending"}
            className="min-h-12 shrink-0 rounded-control bg-action px-7 text-body font-semibold text-on-action transition-opacity duration-200 ease-out hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cue disabled:opacity-60"
          >
            {state === "sending" ? "Sending…" : cta}
          </button>
        </div>
        {error && (
          <p id={`${id}-error`} role="alert" className="mt-2 text-body-sm font-medium">
            {error}
          </p>
        )}
        <p className="mt-3 text-body text-muted">{copy.intro}</p>
        <p id={`${id}-note`} className="mt-2 text-body-sm text-muted">
          {copy.note}{" "}
          <a href="/privacy" className="underline underline-offset-4">
            Privacy policy
          </a>
        </p>
      </div>

      {pilot && (
        <div>
          <label htmlFor={`${id}-organization`} className={LABEL}>
            School or organization <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id={`${id}-organization`}
            name="organization"
            maxLength={120}
            autoComplete="organization"
            placeholder="Lincoln High School"
            className={FIELD}
          />
        </div>
      )}

      {/* Hidden from people and assistive tech; a filled value marks a bot. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="border-t border-line pt-4">
        <p className="text-body-sm font-medium">What happens next</p>
        <ol className="mt-2 grid gap-2 sm:grid-cols-3 sm:gap-4">
          {copy.steps.map((step, i) => (
            <li key={step} className="flex items-start gap-2 text-body-sm text-muted">
              <span
                aria-hidden="true"
                className="grid size-5 shrink-0 place-items-center rounded-full bg-cue-soft text-caption font-semibold text-cue"
              >
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </form>
  );
}
