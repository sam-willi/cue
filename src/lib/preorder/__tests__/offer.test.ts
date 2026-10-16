import { describe, expect, it } from "vitest";
import { BALANCE, COLORWAYS, OFFER, colorwayFor } from "../offer";
import { parseReservation } from "../reserve";
import { batchNumber, checkoutForm, numbered, placesAfter } from "../stripe";

describe("preorder offer", () => {
  it("charges the deposit now and the rest at shipping", () => {
    expect(OFFER.deposit + BALANCE).toBe(OFFER.price);
    expect(BALANCE).toBe(90);
  });

  it("knows its three colorways and nothing else", () => {
    expect(COLORWAYS.map((c) => c.id)).toEqual(["graphite", "silver", "champagne"]);
    expect(colorwayFor("silver")?.name).toBe("Silver");
    expect(colorwayFor("space-grey")).toBeUndefined();
    expect(colorwayFor(7)).toBeUndefined();
  });

  it("numbers deposits in the order they were paid", () => {
    const order = numbered([
      { id: "pi_b", created: 20, colorway: "silver" },
      { id: "pi_a", created: 10, colorway: "graphite" },
      { id: "pi_c", created: 20, colorway: "champagne" },
    ]).map((d) => d.id);
    expect(order).toEqual(["pi_a", "pi_b", "pi_c"]);
    expect(batchNumber(1)).toBe("#001");
    expect(batchNumber(89)).toBe("#089");
    expect(batchNumber(500)).toBe("#500");
  });

  it("never shows fewer than zero places", () => {
    expect(placesAfter(0)).toBe(500);
    expect(placesAfter(88)).toBe(412);
    expect(placesAfter(612)).toBe(0);
  });
});

describe("checkout form", () => {
  const form = checkoutForm(colorwayFor("champagne")!, "https://cue.example");

  it("charges the $20 deposit in cents, in dollars", () => {
    expect(form.get("mode")).toBe("payment");
    expect(form.get("line_items[0][price_data][unit_amount]")).toBe("2000");
    expect(form.get("line_items[0][price_data][currency]")).toBe("usd");
    expect(form.get("line_items[0][price_data][product_data][name]")).toBe("Cue preorder deposit · Champagne");
  });

  it("saves the card for the balance and tags the batch and color", () => {
    expect(form.get("payment_intent_data[setup_future_usage]")).toBe("off_session");
    expect(form.get("payment_intent_data[metadata][cue_preorder]")).toBe("batch-1");
    expect(form.get("payment_intent_data[metadata][colorway]")).toBe("champagne");
  });

  it("comes back to the thank-you page with the session id placeholder Stripe fills in", () => {
    expect(form.get("success_url")).toBe("https://cue.example/preorder/reserved?session_id={CHECKOUT_SESSION_ID}");
    expect(form.get("cancel_url")).toBe("https://cue.example/preorder#colors");
  });
});

describe("email reservation", () => {
  const now = new Date("2026-10-15T12:00:00Z");

  it("keeps the email, color and ad tags on the preorder tab", () => {
    const r = parseReservation(
      { email: " Ada@Example.com ", colorway: "graphite", utm: { utm_source: "meta", other: "x" } },
      now,
    );
    expect(r).toEqual({
      ok: true,
      signup: {
        at: "2026-10-15T12:00:00.000Z",
        market: "preorder",
        kind: "early-access",
        email: "ada@example.com",
        colorway: "graphite",
        utm: { utm_source: "meta" },
      },
    });
  });

  it("asks for a real email and a known color", () => {
    expect(parseReservation({ email: "nope", colorway: "graphite" })).toEqual({
      ok: false,
      error: "Enter a valid email address.",
    });
    expect(parseReservation({ email: "a@b.co", colorway: "gold" })).toEqual({
      ok: false,
      error: "Choose a color first.",
    });
  });

  it("quietly drops bots that fill the hidden field", () => {
    expect(parseReservation({ email: "a@b.co", colorway: "silver", website: "spam" })).toEqual({ ok: true, bot: true });
  });
});
