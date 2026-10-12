"use client";

import { useId, useState, type FormEvent } from "react";
import { PILOT_ROLES, type MarketKind } from "@/lib/landing/markets";
import { UTM_KEYS } from "@/lib/landing/signups";

const FIELD =
  "min-h-12 w-full rounded-lg border border-line bg-surface px-4 text-body text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cue";

/** The page's one action: leave an email (and, for a pilot, a school) against this market. */
export default function SignupForm({ market, kind, cta }: { market: string; kind: MarketKind; cta: string }) {
  const id = useId();
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const pilot = kind === "pilot";

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
          role: form.get("role"),
          website: form.get("website"),
          utm,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Something went wrong. Please try again.");
      }
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
      <div role="status" className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-title-m font-medium sm:text-title">
          {pilot ? "Thanks. Request received." : "You’re on the list."}
        </p>
        <p className="mt-2 text-body text-muted">
          {pilot
            ? "We’ll email you to talk through what a pilot could look like at your school."
            : "We’ll email you when early access opens."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {pilot && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="sm:flex-1">
            <label htmlFor={`${id}-organization`} className="mb-1.5 block text-label font-medium">
              School or organization
            </label>
            <input
              id={`${id}-organization`}
              name="organization"
              required
              maxLength={120}
              autoComplete="organization"
              className={FIELD}
            />
          </div>
          <div className="sm:w-56">
            <label htmlFor={`${id}-role`} className="mb-1.5 block text-label font-medium">
              Your role <span className="font-normal text-muted">(optional)</span>
            </label>
            <select id={`${id}-role`} name="role" defaultValue="" className={FIELD}>
              <option value="">Choose one</option>
              {PILOT_ROLES.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      <div>
        <label htmlFor={`${id}-email`} className="mb-1.5 block text-label font-medium">
          {pilot ? "Work email" : "Email"}
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            placeholder="you@example.com"
            aria-describedby={error ? `${id}-error` : `${id}-note`}
            aria-invalid={error ? true : undefined}
            className={`${FIELD} sm:flex-1`}
          />
          <button
            type="submit"
            disabled={state === "sending"}
            className="min-h-12 shrink-0 rounded-lg bg-text px-6 text-body font-medium text-bg transition-opacity duration-200 ease-out hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cue disabled:opacity-60"
          >
            {state === "sending" ? "Sending…" : cta}
          </button>
        </div>
      </div>
      {/* Hidden from people and assistive tech; a filled value marks a bot. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-body-sm font-medium">
          {error}
        </p>
      )}
      <p id={`${id}-note`} className="text-body-sm text-muted">
        Cue is in development. We’ll use your email to contact you about {pilot ? "a pilot" : "early access"}, and for
        nothing else.
      </p>
    </form>
  );
}
