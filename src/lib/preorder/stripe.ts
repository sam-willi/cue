// Stripe for preorder deposits, over its REST API with fetch (no SDK). STRIPE_SECRET_KEY is set
// in Vercel only (a test key, sk_test_…, until the account is live) and never reaches the browser.
// Without it the page still works: reserving falls back to leaving an email (see the reserve route).
import { BALANCE, BATCH_TAG, OFFER, type Colorway } from "./offer";

const API = "https://api.stripe.com/v1";

export const stripeKey = () => process.env.STRIPE_SECRET_KEY || null;

/**
 * The form for one Checkout Session: the deposit, with the card saved so the balance can be
 * charged when the batch ships, and tagged with the batch and colorway so places can be counted.
 */
export function checkoutForm(colorway: Colorway, origin: string): URLSearchParams {
  return new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/preorder/reserved?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/preorder#colors`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(OFFER.deposit * 100),
    "line_items[0][price_data][product_data][name]": `Cue preorder deposit · ${colorway.name}`,
    "line_items[0][price_data][product_data][description]":
      `Holds a Cue from batch ${OFFER.batch.number} at $${OFFER.price} with Premium free for life. ` +
      `Refundable until it ships. The $${BALANCE} balance is charged when batch ${OFFER.batch.number} ships (${OFFER.batch.ships}).`,
    customer_creation: "always",
    // Keep the card for the balance. Checkout tells the buyer it will be saved.
    "payment_intent_data[setup_future_usage]": "off_session",
    "payment_intent_data[metadata][cue_preorder]": BATCH_TAG,
    "payment_intent_data[metadata][colorway]": colorway.id,
    "metadata[cue_preorder]": BATCH_TAG,
    "metadata[colorway]": colorway.id,
    "custom_text[submit][message]": `Refundable any time before your Cue ships. $${BALANCE} more when batch ${OFFER.batch.number} ships.`,
  });
}

async function stripe<T>(key: string, path: string, init: RequestInit & { next?: { revalidate: number } } = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await response.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!response.ok || !body)
    throw new Error(`Stripe ${path} answered ${response.status}: ${body?.error?.message ?? ""}`);
  return body as T;
}

/** Starts a Checkout Session for a deposit and returns the address to send the buyer to. */
export async function createCheckout(key: string, colorway: Colorway, origin: string): Promise<string> {
  const session = await stripe<{ url: string }>(key, "/checkout/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: checkoutForm(colorway, origin),
    cache: "no-store",
  });
  return session.url;
}

/**
 * How many deposits for this batch have been paid, from Stripe's search (which can lag about a
 * minute). Refunded deposits still count, so the places-left number errs on the low side.
 */
export async function paidDeposits(key: string): Promise<number> {
  const query = `metadata['cue_preorder']:'${BATCH_TAG}' AND status:'succeeded'`;
  let count = 0;
  let page: string | null = null;
  // 500 places at 100 per page: a handful of pages at most.
  for (let i = 0; i < 10; i++) {
    const q = new URLSearchParams({ query, limit: "100" });
    if (page) q.set("page", page);
    const result: { data: unknown[]; has_more: boolean; next_page: string | null } = await stripe(
      key,
      `/payment_intents/search?${q}`,
      { next: { revalidate: 60 } },
    );
    count += result.data.length;
    if (!result.has_more || !result.next_page) break;
    page = result.next_page;
  }
  return count;
}

/** Places left in the batch, or null when Stripe isn't set up or can't be reached. */
export async function placesLeft(): Promise<number | null> {
  const key = stripeKey();
  if (!key) return null;
  try {
    return placesAfter(await paidDeposits(key));
  } catch (error) {
    console.error("Counting preorder deposits failed", error);
    return null;
  }
}

export const placesAfter = (paid: number) => Math.max(0, OFFER.batch.size - paid);

export interface PaidSession {
  colorway: string | null;
  email: string | null;
  paid: boolean;
}

/** The finished Checkout Session behind the thank-you page. */
export async function checkoutSession(key: string, id: string): Promise<PaidSession> {
  const s = await stripe<{
    payment_status: string;
    metadata?: Record<string, string>;
    customer_details?: { email?: string | null } | null;
  }>(key, `/checkout/sessions/${encodeURIComponent(id)}`, { cache: "no-store" });
  return {
    colorway: s.metadata?.colorway ?? null,
    email: s.customer_details?.email ?? null,
    paid: s.payment_status === "paid",
  };
}
