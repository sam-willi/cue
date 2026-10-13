import { marketFor, PILOT_ROLES, type MarketKind } from "./markets";

/** One sign-up from a painted-door page: who, from which market page, and which ad sent them. */
export interface Signup {
  at: string;
  market: string;
  kind: MarketKind;
  email: string;
  organization?: string;
  role?: string;
  /** utm_source, utm_medium, utm_campaign, utm_content, utm_term from the page URL, when present. */
  utm?: Record<string, string>;
}

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export type ParsedSignup = { ok: true; signup: Signup } | { ok: false; error: string } | { ok: true; bot: true };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (value: unknown, max: number): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
};

/** Checks a posted sign-up. `website` is a hidden field people never see; a filled one means a bot. */
export function parseSignup(body: unknown, now = new Date()): ParsedSignup {
  if (!body || typeof body !== "object") return { ok: false, error: "Something went wrong. Please try again." };
  const input = body as Record<string, unknown>;
  if (text(input.website, 200)) return { ok: true, bot: true };

  const market = typeof input.market === "string" ? marketFor(input.market) : undefined;
  if (!market) return { ok: false, error: "Something went wrong. Please try again." };

  const email = text(input.email, 254)?.toLowerCase();
  if (!email || !EMAIL.test(email)) return { ok: false, error: "Enter a valid email address." };

  const signup: Signup = { at: now.toISOString(), market: market.slug, kind: market.kind, email };

  if (market.kind === "pilot") {
    // The school is optional: an email alone is enough to start a pilot conversation.
    const organization = text(input.organization, 120);
    if (organization) signup.organization = organization;
    const role = text(input.role, 40);
    if (role && (PILOT_ROLES as readonly string[]).includes(role)) signup.role = role;
  }

  if (input.utm && typeof input.utm === "object") {
    const utm: Record<string, string> = {};
    for (const key of UTM_KEYS) {
      const value = text((input.utm as Record<string, unknown>)[key], 100);
      if (value) utm[key] = value;
    }
    if (Object.keys(utm).length) signup.utm = utm;
  }

  return { ok: true, signup };
}
