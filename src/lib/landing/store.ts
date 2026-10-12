import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Signup } from "./signups";

/** Thrown when a deployed server has nowhere to keep sign-ups, so the form can say so honestly. */
export class SignupStoreMissing extends Error {}

/**
 * Keeps one sign-up. Running locally, it is appended to ./signups/signups.jsonl (git-ignored).
 * A deployed server has no disk to keep it on, so it refuses until a store is connected.
 */
export async function saveSignup(signup: Signup): Promise<void> {
  if (process.env.NODE_ENV !== "development") throw new SignupStoreMissing("No sign-up store is configured.");
  const dir = join(process.cwd(), "signups");
  await mkdir(dir, { recursive: true });
  await appendFile(join(dir, "signups.jsonl"), JSON.stringify(signup) + "\n");
}
