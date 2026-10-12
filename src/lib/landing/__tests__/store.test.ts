import { afterEach, describe, expect, it, vi } from "vitest";
import type { Signup } from "../signups";
import { saveSignup, SignupStoreMissing } from "../store";

const SIGNUP: Signup = { at: "2026-10-11T12:00:00.000Z", market: "sales", kind: "early-access", email: "a@b.co" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("saveSignup", () => {
  it("posts the sign-up to the sheet when its address is set", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("SIGNUPS_SHEET_URL", "https://script.example/exec");
    await saveSignup(SIGNUP);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://script.example/exec");
    expect(JSON.parse(init.body as string)).toEqual(SIGNUP);
  });

  it("fails when the sheet doesn't confirm the row", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>Sign in</html>", { status: 200 })),
    );
    vi.stubEnv("SIGNUPS_SHEET_URL", "https://script.example/exec");
    await expect(saveSignup(SIGNUP)).rejects.toThrow();
  });

  it("refuses on a deployed server with no sheet", async () => {
    vi.stubEnv("SIGNUPS_SHEET_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    await expect(saveSignup(SIGNUP)).rejects.toBeInstanceOf(SignupStoreMissing);
  });
});
