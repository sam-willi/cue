import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Signup } from "./signups";

/** Thrown when a deployed server has nowhere to keep sign-ups, so the form can say so honestly. */
export class SignupStoreMissing extends Error {}

/**
 * Keeps one sign-up. With SIGNUPS_SHEET_URL set, it is sent to the Google Sheet behind that
 * address (scripts/signups-sheet.gs), which adds it as a row. Without it, a local run appends to
 * ./signups/signups.jsonl (git-ignored), and a deployed server refuses: it has no disk to keep it on.
 */
export async function saveSignup(signup: Signup): Promise<void> {
  const sheet = process.env.SIGNUPS_SHEET_URL;
  if (sheet) {
    // Apps Script answers a POST with a redirect to the result, which fetch follows.
    const response = await fetch(sheet, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signup),
      signal: AbortSignal.timeout(10_000),
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean } | null;
    if (!response.ok || !result?.ok) throw new Error(`The sign-up sheet answered ${response.status}.`);
    return;
  }
  if (process.env.NODE_ENV !== "development") throw new SignupStoreMissing("SIGNUPS_SHEET_URL is not set.");
  const dir = join(process.cwd(), "signups");
  await mkdir(dir, { recursive: true });
  await appendFile(join(dir, "signups.jsonl"), JSON.stringify(signup) + "\n");
}
