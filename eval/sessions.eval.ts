// Scoreboard over real sessions: `npm run eval`.
// Put files from the app's "Download session" button in ./sessions (git-ignored).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { evaluateSession, scoreLabels, type SessionFile } from "@/lib/cue/evaluate";

const DIR = join(__dirname, "..", "sessions");
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".json")) : [];

it("scores saved sessions against their corrections", () => {
  if (files.length === 0) {
    process.stdout.write(`\nNo sessions found. Save sessions from the app into ${DIR}\n`);
    return;
  }
  let minutes = 0;
  let labeledFb = 0;
  let stillFb = 0;
  let labeledMiss = 0;
  let stillMiss = 0;
  const rows: string[] = [];
  for (const f of files) {
    const file = JSON.parse(readFileSync(join(DIR, f), "utf8")) as SessionFile;
    expect(file.version, `${f}: unsupported session file version`).toBe(2);
    const s = evaluateSession(file);
    minutes += s.speakingMinutes;
    labeledFb += s.falseBuzzes.labeled;
    stillFb += s.falseBuzzes.stillFiring.length;
    labeledMiss += s.misses.labeled;
    stillMiss += s.misses.stillMissed.length;
    rows.push(
      `${f}\n  ${s.speakingMinutes.toFixed(1)} min speaking · ${s.detections} detections` +
        `\n  false buzzes still firing: ${s.falseBuzzes.stillFiring.length}/${s.falseBuzzes.labeled}` +
        s.falseBuzzes.stillFiring.map((c) => `\n    - "${c.word}" at ${c.start.toFixed(1)}s`).join("") +
        `\n  misses still missed: ${s.misses.stillMissed.length}/${s.misses.labeled}` +
        s.misses.stillMissed.map((c) => `\n    - "${c.word}" at ${c.start.toFixed(1)}s`).join(""),
    );
  }
  const perHour = minutes > 0 ? (stillFb / minutes) * 60 : 0;
  process.stdout.write(
    [
      ...rows,
      "",
      `TOTAL ${files.length} session(s), ${minutes.toFixed(1)} speaking min`,
      `  false buzzes still firing: ${stillFb}/${labeledFb} (${perHour.toFixed(1)} per speaking hour)`,
      `  misses still missed: ${stillMiss}/${labeledMiss}`,
      "  (unlabeled detections are assumed correct)",
    ].join("\n") + "\n",
  );
});

// Labeled training recordings (Training section → "Save to training set"): ./training/<id>/session.json
const TRAINING = join(__dirname, "..", "training");
const trainingDirs = existsSync(TRAINING)
  ? readdirSync(TRAINING).filter((d) => existsSync(join(TRAINING, d, "session.json")))
  : [];

it("scores labeled training recordings (precision / recall per session)", () => {
  if (trainingDirs.length === 0) {
    process.stdout.write(`\nNo training recordings yet. Record one in the app's Training section.\n`);
    return;
  }
  let caught = 0;
  let missed = 0;
  let wrong = 0;
  const rows: string[] = [];
  for (const d of trainingDirs) {
    const file = JSON.parse(readFileSync(join(TRAINING, d, "session.json"), "utf8")) as SessionFile;
    const s = scoreLabels(file);
    if (!s) continue;
    caught += s.caught;
    missed += s.missed.length;
    wrong += s.wrong.length;
    rows.push(
      `${d}\n  caught ${s.caught}, missed ${s.missed.length}, wrong ${s.wrong.length}` +
        `  (precision ${(s.precision * 100).toFixed(0)}%, recall ${(s.recall * 100).toFixed(0)}%)` +
        s.missed.map((m) => `\n    missed "${m.word}" at ${m.start.toFixed(1)}s`).join("") +
        s.wrong.map((m) => `\n    wrong  "${m.word}" at ${m.start.toFixed(1)}s`).join(""),
    );
  }
  const p = caught + wrong ? caught / (caught + wrong) : 1;
  const r = caught + missed ? caught / (caught + missed) : 1;
  process.stdout.write(
    [
      "",
      ...rows,
      "",
      `TRAINING TOTAL ${rows.length} recording(s): caught ${caught}, missed ${missed}, wrong ${wrong}`,
      `  precision ${(p * 100).toFixed(0)}%  recall ${(r * 100).toFixed(0)}%`,
    ].join("\n") + "\n",
  );
});
