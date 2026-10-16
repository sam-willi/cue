// Keeps a preorder reservation left by email, while deposits can't be taken yet (no Stripe key).
// It goes to the same sign-up sheet as the landing pages, on a "Preorder" tab.
import { saveSignup, SignupStoreMissing } from "@/lib/landing/store";
import { parseReservation } from "@/lib/preorder/reserve";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseReservation(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  // A bot gets the same answer as a person, and nothing is saved.
  if ("bot" in parsed) return Response.json({ ok: true });

  try {
    await saveSignup(parsed.signup);
  } catch (error) {
    if (!(error instanceof SignupStoreMissing)) console.error("Saving a preorder reservation failed", error);
    return Response.json({ error: "We couldn’t save that just now. Please try again in a moment." }, { status: 503 });
  }
  return Response.json({ ok: true });
}
