import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type CueConfig } from "../config";
import { findInclusiveFlags } from "../inclusive";
import { AREA_TECHNIQUE, buildReport, talkSeconds, type ReportInput, type SectionKey } from "../report";
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

  it("quotes what was being said where the pace ran over the limit", () => {
    const calm = simulateWords(TALK, { wpm: 150 });
    const dash = simulateWords(
      "and then we shipped it to everybody and the numbers went up and we kept on adding things",
      {
        wpm: 280,
        startAt: calm.at(-1)!.end + 0.3,
      },
    );
    const after = simulateWords(TALK, { wpm: 150, startAt: dash.at(-1)!.end + 1 });
    const words = [...calm, ...dash, ...after];
    const s = new CueSession();
    s.ingest(words, true);
    s.endUtterance();
    const r = buildReport({
      words,
      history: s.history,
      taps: s.engineTaps(),
      levels: [],
      pitch: [],
      config: s.config,
      paceLimit: s.config.paceThreshold,
    });
    expect(r.rushed).toHaveLength(1);
    expect(r.rushed[0].text).toContain("we shipped it to everybody");
    expect(r.rushed[0].text).not.toContain("onboarding");
    expect(r.rushed[0].start).toBeGreaterThanOrEqual(dash[0].start - 1);
    expect(r.rushed[0].end).toBeLessThanOrEqual(dash.at(-1)!.end);
    expect(r.rushed[0].wpm).toBeGreaterThan(220);
    expect(r.startSec).toBe(0);
    // A steady talk has nothing to quote.
    expect(report(LONG, { wpm: 150 }).rushed).toEqual([]);
  });

  it("says what to do differently next time, the costliest thing first", () => {
    // Rushed and full of fillers: both lose points.
    const text =
      "Um so we basically rebuilt it. Um the old one was um slow. Um nobody liked it. Um and uh we started over. " +
      "Um it took a while. Um but it works. Um so that is where we are. Um any questions.";
    const r = report(`${text} ${text} ${text}`, { wpm: 230 });
    expect(r.next.length).toBeGreaterThanOrEqual(2);
    const lost = r.next.map((n) => {
      const part = r.score!.parts.find((p) => p.key === n.key)!;
      return part.max - part.earned;
    });
    expect([...lost].sort((a, b) => b - a)).toEqual(lost);
    const pace = r.next.find((n) => n.key === "pace")!;
    expect(pace.action).toBe("Slow down");
    expect(pace.how).toMatch(/^Finish the last word/);
    expect(pace.why).toBe(section(r, "pace").headline);
    expect(r.focusKeys).toEqual(r.next.map((n) => n.key));
    // Nothing to change after a steady talk.
    expect(report(LONG, { wpm: 150 }).next).toEqual([]);
  });

  it("gives a technique to practise for what needs work, and none for what doesn't", () => {
    const fast = report(LONG, { wpm: 230 });
    expect(section(fast, "pace").technique?.name).toBe("Land the last word");
    expect(section(fast, "pace").technique?.how).toMatch(/To practise/);
    const steady = report(LONG, { wpm: 150 });
    expect(steady.sections.filter((s) => s.technique)).toEqual([]);
    // Even then, every area has a technique the report can offer.
    for (const s of steady.sections) expect(AREA_TECHNIQUE[s.key].how).toMatch(/\w/);
  });

  it("flags a long stretch without a pause", () => {
    const noStops = TALK.replace(/[.,]/g, "");
    const r = report(`${noStops} ${noStops}`, { wpm: 150 });
    const pauses = section(r, "pauses");
    expect(pauses.verdict).toBe("improve");
    expect(r.focus[0]).toMatch(/^Pause more/);
    // Each thing to work on names its area, so the report can show that area's icon and color.
    expect(r.focusKeys[0]).toBe("pauses");
    expect(r.focusKeys).toHaveLength(r.focus.length);
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
    // The contour is one point a second, in semitones around the typical pitch.
    expect(lively.pitchContour.length).toBeGreaterThan(20);
    expect(Math.max(...lively.pitchContour.map((p) => Math.abs(p.st)))).toBeLessThan(6);
    expect(report(TALK).pitchContour).toEqual([]);
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

  it("leaves everyday words and family words alone", () => {
    const text =
      "My mother and her brother just moved. He is a special guy, a master of the simple things, and she is depressed.";
    expect(findInclusiveFlags(simulateWords(text))).toEqual([]);
  });

  it("uses the open list for terms Cue didn't write itself", () => {
    const flags = findInclusiveFlags(simulateWords("The policemen were handicapped by the blacklist."));
    expect(flags.map((f) => f.phrase).sort()).toEqual(["blacklist", "handicapped", "policemen"]);
  });
});

describe("findInclusiveFlags", () => {
  it("matches whole words only", () => {
    expect(findInclusiveFlags(simulateWords("the chairmanship of the mainland group"))).toEqual([]);
    expect(findInclusiveFlags(simulateWords("our chairman said so"))[0]).toMatchObject({
      phrase: "chairman",
      instead: "chair, head, chairperson",
    });
  });

  it("lays the session out as stretches of talking with pauses between", () => {
    const r = report(LONG, { wpm: 150 });
    // Eighteen sentences, each followed by a real pause.
    expect(r.stretches).toHaveLength(18);
    expect(r.stretches.every((x, k) => x.end > x.start && (k === 0 || x.start > r.stretches[k - 1].end))).toBe(true);
    expect(r.stretchLimitSec).toBe(30);
    expect(report("I like tofu.").stretches).toEqual([]);
  });
});

describe("Speak score", () => {
  const parts = (r: ReturnType<typeof report>) => Object.fromEntries(r.score!.parts.map((p) => [p.key, p]));

  it("needs enough speech to judge pace, pauses and fillers", () => {
    expect(report("I like tofu.").score).toBeNull();
  });

  it("is out of 100, scaled from what could be measured", () => {
    const r = report(LONG, { wpm: 150 });
    // No microphone: volume and pitch are left out and the other three share the 100 points.
    expect(r.score!.parts.map((p) => p.key)).toEqual(["pauses", "pace", "fillers"]);
    expect(r.score!.parts.reduce((n, p) => n + p.max, 0)).toBe(100);
    expect(r.score!.missing).toEqual(["Volume", "Pitch and tone"]);
    expect(r.score!.total).toBe(100);
    expect(r.score!.level).toBe("Very high");
  });

  it("takes points off the area that went wrong, and only that one", () => {
    const fast = report(LONG, { wpm: 230 });
    expect(parts(fast).pace.earned).toBeLessThan(parts(fast).pace.max);
    expect(parts(fast).fillers.earned).toBe(parts(fast).fillers.max);
    expect(fast.score!.total).toBe(fast.score!.parts.reduce((n, p) => n + p.earned, 0));
    expect(fast.score!.total).toBeLessThan(100);
  });

  it("doesn't reward saying no fillers at all: a couple a minute still score full points", () => {
    // Two fillers in about 50 seconds of talking.
    const r = report(`${TALK} Um that is the plan. ${TALK} Uh any questions.`);
    expect(section(r, "fillers").stats[0].value).toBe("2");
    expect(parts(r).fillers.earned).toBe(parts(r).fillers.max);
  });

  it("counts volume and pitch when a microphone measured them", () => {
    const words = simulateWords(LONG);
    const frames = (value: (t: number) => number): [number, number][] => {
      const out: [number, number][] = [];
      for (let t = 0; t <= words.at(-1)!.end; t += 0.05)
        if (words.some((w) => t >= w.start && t <= w.end)) out.push([t, value(t)]);
      return out;
    };
    const r = report(LONG, {
      config: { volumeTarget: { conversation: { db: -20, noiseDb: -60 } } },
      extra: { levels: frames(() => -21), pitch: frames((t) => 120 * 2 ** (Math.sin(t * 3) * 0.35)) },
    });
    expect(r.score!.parts.map((p) => [p.key, p.max])).toEqual([
      ["pauses", 25],
      ["pace", 30],
      ["volume", 10],
      ["fillers", 25],
      ["pitch", 10],
    ]);
    expect(r.score!.missing).toEqual([]);
  });
});

it("keeps the default config free of custom fillers", () => {
  expect(DEFAULT_CONFIG.customFillers).toEqual([]);
});
