import type { Signup } from "@/lib/landing/signups";
import { UTM_KEYS } from "@/lib/landing/signups";
import { colorwayFor } from "./offer";

/** The sign-up sheet's tab for preorder reservations (scripts/signups-sheet.gs). */
export const PREORDER_MARKET = "preorder";

export type ParsedReservation = { ok: true; signup: Signup } | { ok: false; error: string } | { ok: true; bot: true };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Checks a reservation left by email, used while deposits can't be taken yet. Kept on the same
 * sheet as the landing-page sign-ups, on its own tab, with the colorway chosen.
 * `website` is a hidden field people never see; a filled one means a bot.
 */
export function parseReservation(body: unknown, now = new Date()): ParsedReservation {
  if (!body || typeof body !== "object") return { ok: false, error: "Something went wrong. Please try again." };
  const input = body as Record<string, unknown>;
  if (typeof input.website === "string" && input.website.trim()) return { ok: true, bot: true };

  const email = typeof input.email === "string" ? input.email.trim().slice(0, 254).toLowerCase() : "";
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address." };
  const colorway = colorwayFor(input.colorway);
  if (!colorway) return { ok: false, error: "Choose a color first." };

  const signup: Signup = {
    at: now.toISOString(),
    market: PREORDER_MARKET,
    kind: "early-access",
    email,
    colorway: colorway.id,
  };
  if (input.utm && typeof input.utm === "object") {
    const utm: Record<string, string> = {};
    for (const key of UTM_KEYS) {
      const value = (input.utm as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) utm[key] = value.trim().slice(0, 100);
    }
    if (Object.keys(utm).length) signup.utm = utm;
  }
  return { ok: true, signup };
}
