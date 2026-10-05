import { describe, expect, it } from "vitest";
import { TouchGestures } from "../touch";

describe("TouchGestures", () => {
  it("long press toggles on/off while still holding, once", () => {
    const g = new TouchGestures();
    g.down(0);
    expect(g.poll(1000)).toBeNull();
    expect(g.poll(1500)).toBe("toggle_on");
    expect(g.poll(2000)).toBeNull();
    expect(g.up(2500)).toBeNull(); // already fired
  });

  it("double tap switches mode", () => {
    const g = new TouchGestures();
    g.down(0);
    expect(g.up(120)).toBeNull();
    g.down(350);
    expect(g.up(450)).toBe("toggle_mode");
  });

  it("ignores a single tap", () => {
    const g = new TouchGestures();
    g.down(0);
    expect(g.up(100)).toBeNull();
  });

  it("ignores two taps that are too far apart", () => {
    const g = new TouchGestures();
    g.down(0);
    g.up(100);
    g.down(700);
    expect(g.up(800)).toBeNull();
  });

  it("ignores a lingering touch, and it breaks a double tap", () => {
    const g = new TouchGestures();
    g.down(0);
    g.up(100); // tap
    g.down(300);
    expect(g.up(900)).toBeNull(); // 600 ms hold: adjusting the device
    g.down(1000);
    expect(g.up(1100)).toBeNull(); // a fresh first tap, not a double
  });

  it("a cancelled touch does nothing", () => {
    const g = new TouchGestures();
    g.down(0);
    g.cancel();
    expect(g.poll(2000)).toBeNull();
    expect(g.up(2100)).toBeNull();
  });
});
