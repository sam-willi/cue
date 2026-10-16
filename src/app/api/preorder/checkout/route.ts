// Starts a Stripe Checkout for a preorder deposit (/preorder). Answers 503 with code
// "not_configured" while there's no Stripe key, so the page can offer an email reservation instead.
import { colorwayFor } from "@/lib/preorder/offer";
import { createCheckout, paidDeposits, placesAfter, stripeKey } from "@/lib/preorder/stripe";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { colorway?: unknown } | null;
  const colorway = colorwayFor(body?.colorway);
  if (!colorway) return Response.json({ error: "Choose a color first." }, { status: 400 });

  const key = stripeKey();
  if (!key) return Response.json({ code: "not_configured" }, { status: 503 });

  try {
    if (placesAfter(await paidDeposits(key)) <= 0)
      return Response.json({ code: "sold_out", error: "Batch 1 is full." }, { status: 409 });
    const url = await createCheckout(key, colorway, new URL(request.url).origin);
    return Response.json({ url });
  } catch (error) {
    console.error("Starting a preorder checkout failed", error);
    return Response.json(
      { error: "We couldn’t open checkout just now. Please try again in a moment." },
      { status: 502 },
    );
  }
}
