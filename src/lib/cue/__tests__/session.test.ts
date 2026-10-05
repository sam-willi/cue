import { describe, expect, it } from "vitest";
import { CueSession } from "../session";
import { simulateWords } from "../simulate";

function run(text: string, opts: { wpm?: number; config?: ConstructorParameters<typeof CueSession>[0] } = {}) {
  const s = new CueSession(opts.config);
  const words = simulateWords(text, { wpm: opts.wpm });
  // Stream word by word as interim results, then commit and close the utterance.
  for (let k = 1; k <= words.length; k++) s.ingest(words.slice(0, k), false);
  s.ingest(words, true);
  s.endUtterance();
  return s.history;
}

const delivered = (h: ReturnType<typeof run>) => h.filter((d) => d.delivered).map((d) => d.event.type);

describe("CueSession", () => {
  it("buzzes once for 'i like went to the mall yesterday'", () => {
    expect(delivered(run("i like went to the mall yesterday"))).toEqual(["filler_like"]);
  });

  it("stays silent for 'i like tofu'", () => {
    expect(run("i like tofu")).toEqual([]);
  });

  it("cues a confident filler 'like' as soon as the next word is heard", () => {
    const s = new CueSession();
    const words = simulateWords("i like went to the mall");
    s.ingest(words.slice(0, 2), false); // "i like" — needs the next word
    expect(s.history).toHaveLength(0);
    s.ingest(words.slice(0, 3), false); // "i like went" — interim, but clear
    expect(s.history.map((d) => [d.event.type, d.delivered])).toEqual([["filler_like", true]]);
  });

  it("waits for stable words when the word after 'like' is uncertain", () => {
    const s = new CueSession();
    const words = simulateWords("i like went to the mall");
    words[2].confidence = 0.5; // recognizer unsure about "went"
    s.ingest(words.slice(0, 3), false);
    expect(s.history).toHaveLength(0);
    s.ingest(words.slice(0, 5), false); // "went" now followed by two words
    expect(s.history.map((d) => d.event.type)).toEqual(["filler_like"]);
  });

  it("never decides a non-filler on unstable words, so a revision can still be caught", () => {
    const s = new CueSession();
    // Interim mishears "went" as "wind": "i like wind" reads as the verb.
    const misheard = simulateWords("i like wind");
    s.ingest(misheard, false);
    expect(s.likeChecks).toHaveLength(0);
    s.ingest(simulateWords("i like went to the mall"), true);
    expect(s.history.map((d) => d.event.type)).toEqual(["filler_like"]);
  });

  it("counts one 'um' once even when Deepgram's interim timings drift", () => {
    // Real timings from a nova-2 stream: interim 13.30, interim 13.01, final 13.73.
    const s = new CueSession({ cooldownSec: 0 });
    const w = (text: string, start: number, end: number) => ({
      text,
      norm: text.toLowerCase().replace(/\W/g, ""),
      start,
      end,
      confidence: 0.99,
    });
    s.ingest([w("enough", 12.5, 12.9), w("now.", 12.9, 13.2), w("Um,", 13.3, 13.55)], false);
    s.ingest([w("enough", 12.5, 12.9), w("now.", 12.9, 13.0), w("Um,", 13.01, 13.51), w("so", 13.6, 13.7)], false);
    s.ingest([w("enough", 12.5, 12.9), w("now.", 12.9, 13.0), w("Um,", 13.73, 13.81), w("so", 13.9, 14.0)], true);
    expect(s.history.filter((d) => d.event.type === "filler_um")).toHaveLength(1);
  });

  it("matches a drifted 'um' by the word before it, up to ~1.5 s", () => {
    // Real timings: interim 21.79, final 22.75 (0.96 s apart), both after "later."
    const s = new CueSession({ cooldownSec: 0 });
    const w = (text: string, start: number, end: number) => ({
      text,
      norm: text.toLowerCase().replace(/\W/g, ""),
      start,
      end,
      confidence: 0.99,
    });
    s.ingest([w("later.", 21.2, 21.6), w("Um,", 21.79, 22.29)], false);
    s.ingest([w("later.", 21.2, 21.6), w("Um,", 22.75, 22.83), w("yeah.", 23.0, 23.3)], true);
    expect(s.history.filter((d) => d.event.type === "filler_um")).toHaveLength(1);
  });

  it("still counts two separate 'um's said close together", () => {
    const s = new CueSession({ cooldownSec: 0 });
    s.ingest(simulateWords("so um um i think"), true);
    expect(s.history.filter((d) => d.event.type === "filler_um")).toHaveLength(2);
  });

  it("cues a confident interim 'um' immediately", () => {
    const s = new CueSession();
    s.ingest(simulateWords("so um"), false);
    expect(s.history.map((d) => [d.event.type, d.delivered])).toEqual([["filler_um", true]]);
  });

  it("waits on a low-confidence interim 'um'", () => {
    const s = new CueSession();
    const words = simulateWords("so um");
    words[1].confidence = 0.6;
    s.ingest(words, false);
    expect(s.history).toHaveLength(0);
  });

  it("measures speaking time without long pauses", () => {
    const s = new CueSession();
    s.ingest(simulateWords("one two three. four five six"), true);
    // 6 words × 0.32 s + 4 short gaps × 0.08 s; the 0.88 s gap after "three." is excluded.
    expect(s.speakingSeconds()).toBeCloseTo(6 * 0.32 + 4 * 0.08, 2);
  });

  it("buzzes for um/uh but not for backchannels", () => {
    expect(delivered(run("um so the plan is fine. uh-huh. mhmm."))).toEqual(["filler_um"]);
  });

  it("does not double-count when interim words become final", () => {
    const h = run("so um i was thinking we could go");
    expect(h.filter((d) => d.event.type === "filler_um")).toHaveLength(1);
  });

  it("applies a cooldown between buzzes", () => {
    const h = run("um uh i like went home");
    expect(h.map((d) => [d.event.type, d.delivered, d.withheldReason])).toEqual([
      ["filler_um", true, undefined],
      ["filler_uh", false, "cooldown"],
      ["filler_like", false, "cooldown"],
    ]);
  });

  it("respects the quotative and approximator settings", () => {
    const quote = "and she was like, no way that happened";
    const approx = "there were like twenty people at the party";
    expect(delivered(run(quote))).toEqual(["filler_like"]);
    expect(delivered(run(quote, { config: { likeCounts: { quotative: false, approximator: false } } }))).toEqual([]);
    expect(delivered(run(approx))).toEqual([]);
    expect(delivered(run(approx, { config: { likeCounts: { quotative: true, approximator: true } } }))).toEqual([
      "filler_like",
    ]);
  });

  const longText = Array.from(
    { length: 8 },
    () => "we should probably get the whole team together and plan the launch",
  ).join(" ");

  it("flags sustained fast speech", () => {
    const h = run(longText, { wpm: 240 });
    expect(delivered(h)).toContain("rushing");
  });

  it("does not flag a normal pace", () => {
    expect(run(longText, { wpm: 150 })).toEqual([]);
  });

  it("is stricter in the presentation preset", () => {
    // 16 syllables / 12 words here, so 190 wpm ≈ 4.2 syllables/s: between the two presets.
    expect(delivered(run(longText, { wpm: 190 }))).not.toContain("rushing");
    expect(delivered(run(longText, { wpm: 190, config: { paceMode: "presentation", paceThreshold: 4.0 } }))).toContain(
      "rushing",
    );
  });

  it("reports pace in syllables per second", () => {
    const h = run(longText, { wpm: 240 });
    const ev = h.find((d) => d.event.type === "rushing")!.event;
    expect(ev.pace!.sps).toBeGreaterThan(4.5);
    expect(ev.pace!.sps).toBeLessThan(6);
  });

  it("waits through a pause after 'like' and decides from what follows", () => {
    // Deepgram finalizes "and i was like" at a short endpointing pause, then the rest.
    const words = simulateWords("and i was like... i don't know what to say");
    const s = new CueSession();
    s.ingest(words.slice(0, 4), true); // segment ends on "like"
    expect(s.likeChecks).toHaveLength(0); // still waiting for right context
    s.ingest(words.slice(4), true);
    expect(s.history.map((d) => [d.event.type, d.delivered])).toEqual([["filler_like", true]]);
  });

  it("logs non-filler likes with a reason", () => {
    const s = new CueSession();
    const words = simulateWords("i like tofu a lot");
    s.ingest(words, true);
    s.endUtterance();
    expect(s.history).toEqual([]);
    expect(s.likeChecks.map((c) => [c.verdict.use, c.counted])).toEqual([["verb", false]]);
  });

  it("keeps the rushing clock running through brief dips", () => {
    // Fast speech with commas (short pauses) that briefly lower the measured rate.
    const text = Array.from({ length: 6 }, () => "we should get the team together, plan the launch, and ship it").join(
      " ",
    );
    const h = run(text, { wpm: 330 }); // ≈4.9 syllables/s including the comma pauses
    expect(delivered(h)).toContain("rushing");
  });

  it("detects filler 'lowkey' in all three spellings, and not the adjective", () => {
    expect(delivered(run("i lowkey want to go"))).toEqual(["filler_lowkey"]);
    expect(delivered(run("it's low key good"))).toEqual(["filler_lowkey"]);
    expect(delivered(run("that was low-key amazing"))).toEqual(["filler_lowkey"]);
    expect(run("it was a low-key party")).toEqual([]);
    expect(run("keep it lowkey")).toEqual([]);
  });

  it("withholds everything when muted", () => {
    const h = run("i like went home", { config: { muted: true } });
    expect(h.map((d) => d.withheldReason)).toEqual(["muted"]);
  });
});
