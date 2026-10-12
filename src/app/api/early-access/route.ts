// Takes a sign-up from a painted-door page (/for/<market>) and keeps it with its market and ad tags.
import { parseSignup } from "@/lib/landing/signups";
import { saveSignup, SignupStoreMissing } from "@/lib/landing/store";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 400 });
  }

  const parsed = parseSignup(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  // A bot gets the same answer as a person, and nothing is saved.
  if ("bot" in parsed) return Response.json({ ok: true });

  try {
    await saveSignup(parsed.signup);
  } catch (error) {
    if (!(error instanceof SignupStoreMissing)) console.error("Saving a sign-up failed", error);
    return Response.json({ error: "We couldn’t save that just now. Please try again in a moment." }, { status: 503 });
  }
  return Response.json({ ok: true });
}
