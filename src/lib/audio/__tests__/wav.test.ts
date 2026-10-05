import { describe, expect, it } from "vitest";
import { encodeWav } from "../wav";

describe("encodeWav", () => {
  it("writes a valid 16 kHz mono 16-bit header and the samples in order", async () => {
    const blob = encodeWav([new Int16Array([1, -2]), new Int16Array([300])]);
    const v = new DataView(await blob.arrayBuffer());
    const tag = (o: number) => String.fromCharCode(...[0, 1, 2, 3].map((k) => v.getUint8(o + k)));
    expect([tag(0), tag(8), tag(12), tag(36)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    expect([v.getUint16(22, true), v.getUint32(24, true), v.getUint16(34, true)]).toEqual([1, 16000, 16]);
    expect(v.getUint32(40, true)).toBe(6);
    expect([v.getInt16(44, true), v.getInt16(46, true), v.getInt16(48, true)]).toEqual([1, -2, 300]);
  });
});
