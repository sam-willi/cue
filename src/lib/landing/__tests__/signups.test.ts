import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MARKETS } from "../markets";
import { parseSignup } from "../signups";

const NOW = new Date("2026-10-11T12:00:00.000Z");

describe("parseSignup", () => {
  it("accepts an early-access sign-up and normalizes the email", () => {
    const result = parseSignup({ market: "sales", email: "  Rep@Example.com " }, NOW);
    expect(result).toEqual({
      ok: true,
      signup: { at: "2026-10-11T12:00:00.000Z", market: "sales", kind: "early-access", email: "rep@example.com" },
    });
  });

  it("rejects a missing or malformed email", () => {
    expect(parseSignup({ market: "sales" }, NOW)).toMatchObject({ ok: false });
    expect(parseSignup({ market: "sales", email: "not an email" }, NOW)).toMatchObject({ ok: false });
  });

  it("rejects a market that has no page", () => {
    expect(parseSignup({ market: "plumbers", email: "a@b.co" }, NOW)).toMatchObject({ ok: false });
    expect(parseSignup(null, NOW)).toMatchObject({ ok: false });
  });

  it("needs an organization for a pilot request and keeps only a listed role", () => {
    expect(parseSignup({ market: "schools", email: "t@school.edu" }, NOW)).toMatchObject({ ok: false });
    expect(
      parseSignup({ market: "schools", email: "t@school.edu", organization: "Lincoln High", role: "Teacher" }, NOW),
    ).toMatchObject({ ok: true, signup: { kind: "pilot", organization: "Lincoln High", role: "Teacher" } });
    const odd = parseSignup({ market: "schools", email: "t@school.edu", organization: "Lincoln High", role: "x" }, NOW);
    expect(odd).toMatchObject({ ok: true });
    expect("signup" in odd && odd.signup.role).toBeUndefined();
  });

  it("ignores organization and role on early-access pages", () => {
    const result = parseSignup({ market: "english", email: "a@b.co", organization: "Acme", role: "Teacher" }, NOW);
    expect("signup" in result && result.signup).toEqual({
      at: NOW.toISOString(),
      market: "english",
      kind: "early-access",
      email: "a@b.co",
    });
  });

  it("keeps known utm values and drops everything else", () => {
    const result = parseSignup(
      {
        market: "interviews",
        email: "a@b.co",
        utm: { utm_source: "meta", utm_campaign: "interviews-a", other: "x", utm_term: 5 },
      },
      NOW,
    );
    expect("signup" in result && result.signup.utm).toEqual({ utm_source: "meta", utm_campaign: "interviews-a" });
  });

  it("flags a filled hidden field as a bot without an error", () => {
    expect(parseSignup({ market: "sales", email: "a@b.co", website: "http://spam.example" }, NOW)).toEqual({
      ok: true,
      bot: true,
    });
  });
});

describe("markets", () => {
  it("has five pages with unique slugs and three problems each", () => {
    expect(MARKETS).toHaveLength(5);
    expect(new Set(MARKETS.map((m) => m.slug)).size).toBe(5);
    for (const market of MARKETS) expect(market.problems).toHaveLength(3);
  });

  it("has a tab in the sign-up sheet script for every page", () => {
    const script = readFileSync("scripts/signups-sheet.gs", "utf8");
    const tabs = script.slice(script.indexOf("const TABS = {"), script.indexOf("};"));
    for (const market of MARKETS) expect(tabs).toContain(`${market.slug}: "`);
  });
});
