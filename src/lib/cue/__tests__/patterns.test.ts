import { describe, expect, it } from "vitest";
import { patternFor } from "../patterns";

describe("patternFor", () => {
  it("gives each alert its own rhythm when distinct cues are on", () => {
    expect(patternFor("filler_um", true)).toBe("tap");
    expect(patternFor("filler_like", true)).toBe("tap");
    expect(patternFor("rushing", true)).toBe("double");
    expect(patternFor("too_quiet", true)).toBe("long");
  });

  it("uses one tap for everything when distinct cues are off", () => {
    expect(patternFor("rushing", false)).toBe("tap");
    expect(patternFor("too_quiet", false)).toBe("tap");
  });
});
