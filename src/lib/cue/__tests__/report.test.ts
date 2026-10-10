import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type CueConfig } from "../config";
import { findInclusiveFlags } from "../inclusive";
import { buildReport, talkSeconds, type ReportInput, type SectionKey } from "../report";
import { CueSession } from "../session";
import { simulateWords } from "../simulate";

const TALK =
  "We spent the whole quarter rebuilding the onboarding flow. The old one lost people at the second step. " +
  "The new one asks for less up front and explains why. Sign ups are higher and support tickets are lower. " +
  "Next we want to do the same for billing. That is the plan for the rest of the year.";

/** Long enough for every section to have something to judge. */
const LONG = `${TALK} ${TALK} ${TALK}`;

function report(text: string, opts: { wpm?: number; config?: Partial<CueConfig>; extra?: Partial<ReportInput> } = {}) {
  const s = new CueSession(opts.config);
  const words = simulateWords(text, { wpm: opts.wpm });
  for (let k = 1; k <= words.length; k++) s.ingest(words.slice(0, k), false);
  s.ingest(words, true);
  s.endUtterance();
  return buildReport({
    words,
    history: s.history,
    taps: s.engineTaps(),
    levels: [],
    pitch: [],
    config: s.config,
    paceLimit: s.config.paceThreshold,
    ...opts.extra,
  });
}
const section = (r: ReturnType<typeof report>, key: SectionKey) => r.sections.find((s) => s.key === key)!;

describe("talkSeconds", () => {
  it("counts the wearer's own pauses but not long silences", () => {
    const a = simulateWords("one two three");
    const b = simulateWords("four five six", { startAt: 60 });
    expect(talkSeconds([...a, ...b])).toBeCloseTo(talkSeconds(a) + talkSeconds(b), 5);
  });
});

describe("session report", () => {
  it("covers the same areas every time, in priority order", () => {
    expect(report(TALK).sections.map((s) => s.key)).toEqual([
      "pauses",
      "pace",
      "volume",
      "fillers",
      "pitch",
      "originality",
      "inclusive",
    ]);
  });

  it("finds nothing to fix in a steady, well-paused talk", () => {
    const r = report(LONG, { wpm: 150 });
    expect(section(r, "pace").verdict).toBe("good");
    expect(section(r, "pauses").verdict).toBe("good");
    expect(section(r, "fillers").verdict).toBe("good");
    expect(r.focus).toEqual([]);
  });

  it("says when there's too little speech to judge", () => {
    const r = report("I like tofu.");
    expect(section(r, "pace").verdict).toBe("none");
    expect(section(r, "pauses").verdict).toBe("none");
  });

  it("flags rushing and suggests slowing down", () => {
    const r = report(LONG, { wpm: 230 });
    const pace = section(r, "pace");
    expect(pace.verdict).toBe("improve");
    expect(pace.advice).toMatch(/^Slow down/);
    expect(r.paceTimeline.length).toBeGreaterThan(2);
  });

  it("flags a long stretch without a pause", () => {
    const noStops = TALK.replace(/[.,]/g, "");
    const r = report(`${noStops} ${noStops}`, { wpm: 150 });
    const pauses = section(r, "pauses");
    expect(pauses.verdict).toBe("improve");
    expect(r.focus[0]).toMatch(/^Pause more/);
  });

  it("counts fillers by word, including the wearer's own", () => {
    const text =
      "So um we basically rebuilt it. Um the old one was um slow. Basically nobody liked it. Um and uh we basically started over. " +
      "Um it took a while. Um but it works. Um so that is where we are. Um any questions.";
    const r = report(`${text} ${text}`, { config: { customFillers: ["basically"] } });
    expect(r.fillers[0]).toEqual({ word: "um", count: 16 });
    expect(r.fillers).toContainEqual({ word: "basically", count: 6 });
    const fillers = section(r, "fillers");
    expect(fillers.verdict).toBe("improve");
    expect(fillers.advice).toContain("“um”");
  });

  it("tallies live cues by what they asked for", () => {
    const r = report(LONG, { wpm: 230 });
    expect(r.cues.map((c) => c.action)).toEqual(["Pause", "Slow down", "Speak up"]);
    expect(r.cues[1].count).toBeGreaterThan(0);
  });

  it("judges volume against the set level, and says so when none is set", () => {
    const words = simulateWords(TALK);
    const frames = (db: (t: number) => number): [number, number][] => {
      const out: [number, number][] = [];
      for (let t = 0; t <= words.at(-1)!.end; t += 0.05) {
        const speaking = words.some((w) => t >= w.start && t <= w.end);
        out.push([t, speaking ? db(t) : -60]);
      }
      return out;
    };
    const half = words.at(-1)!.end / 2;
    const config = { volumeTarget: { conversation: { db: -20, noiseDb: -60 } } };
    const unset = report(TALK, { extra: { levels: frames(() => -20) } });
    expect(section(unset, "volume").verdict).toBe("none");
    const steady = report(TALK, { config, extra: { levels: frames(() => -21) } });
    expect(section(steady, "volume").verdict).toBe("good");
    const trailing = report(TALK, { config, extra: { levels: frames((t) => (t > half ? -34 : -20)) } });
    expect(section(trailing, "volume").verdict).toBe("improve");
    expect(section(trailing, "volume").advice).toMatch(/^Speak up/);
  });

  it("tells a flat voice from a lively one", () => {
    const words = simulateWords(TALK);
    const frames = (hz: (k: number) => number): [number, number][] => {
      const out: [number, number][] = [];
      let k = 0;
      for (let t = 0; t <= words.at(-1)!.end; t += 0.05)
        if (words.some((w) => t >= w.start && t <= w.end)) out.push([t, hz(k++)]);
      return out;
    };
    const flat = report(TALK, { extra: { pitch: frames((k) => 120 + (k % 3)) } });
    expect(section(flat, "pitch").verdict).toBe("improve");
    const lively = report(TALK, { extra: { pitch: frames((k) => 120 * 2 ** (Math.sin(k / 6) * 0.35)) } });
    expect(section(lively, "pitch").verdict).toBe("good");
    expect(section(report(TALK), "pitch").verdict).toBe("none");
  });

  it("ignores octave slips when measuring pitch variation", () => {
    const words = simulateWords(TALK);
    const pitch: [number, number][] = [];
    let k = 0;
    for (let t = 0; t <= words.at(-1)!.end; t += 0.05)
      if (words.some((w) => t >= w.start && t <= w.end)) pitch.push([t, k++ % 25 === 0 ? 480 : 120]);
    expect(section(report(TALK, { extra: { pitch } }), "pitch").verdict).toBe("improve");
  });

  it("notices notes read word for word, even through hesitations", () => {
    const read = report(TALK.replace("The old one", "Um the old one"), { extra: { script: TALK } });
    expect(section(read, "originality").verdict).toBe("improve");
    const own = report(TALK, {
      extra: {
        script:
          "Onboarding rebuild: drop-off at step two, fewer fields, explain the why, more sign ups, fewer tickets, billing next, plan through December.",
      },
    });
    expect(section(own, "originality").verdict).toBe("good");
    expect(section(report(TALK), "originality").verdict).toBe("none");
  });

  it("lists terms to reconsider with an alternative", () => {
    const r = report(`Hey guys, thanks for coming. ${TALK} We need more manpower, guys.`);
    expect(r.inclusive.map((f) => [f.phrase, f.count])).toEqual([
      ["hey guys", 1],
      ["manpower", 1],
      ["guys", 1],
    ]);
    expect(section(r, "inclusive").verdict).toBe("improve");
    expect(section(report(TALK), "inclusive").verdict).toBe("good");
  });
});

describe("findInclusiveFlags", () => {
  it("matches whole words only", () => {
    expect(findInclusiveFlags(simulateWords("the chairmanship of the mainland group"))).toEqual([]);
    expect(findInclusiveFlags(simulateWords("our chairman said so"))[0]).toMatchObject({
      phrase: "chairman",
      instead: "chair, chairperson",
    });
  });
});

it("keeps the default config free of custom fillers", () => {
  expect(DEFAULT_CONFIG.customFillers).toEqual([]);
});
