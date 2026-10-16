// Product cut-outs for the preorder page, from the owner's studio renders: each sheet shows the
// three colorways side by side (graphite, silver, champagne, one per third). Every product is
// lifted onto a transparent background with the subject cut-out built into macOS
// (scripts/cutout.swift, macOS 14+), trimmed, and saved to public/preorder/cutout/:
//   node scripts/colorway-cutouts.mjs
//
//   assets/product/cue-colorways-renders.webp → <color>-render.webp (three-quarter view)
//   assets/product/cue-colorways-side.webp    → <color>-side.webp   (side view, touch area)
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const COLORS = ["graphite", "silver", "champagne"];
const SHEETS = {
  render: "assets/product/cue-colorways-renders.webp",
  side: "assets/product/cue-colorways-side.webp",
};
const OUT = "public/preorder/cutout";

await mkdir(OUT, { recursive: true });
const work = await mkdtemp(join(tmpdir(), "cue-cutout-"));
try {
  const jobs = [];
  for (const [view, file] of Object.entries(SHEETS)) {
    const sheet = await sharp(file).metadata();
    const third = Math.floor(sheet.width / 3);
    for (const [i, color] of COLORS.entries()) {
      const crop = join(work, `${color}-${view}.png`);
      await sharp(file)
        .extract({ left: i * third, top: 0, width: third, height: sheet.height })
        .png()
        .toFile(crop);
      jobs.push({ crop, cut: join(work, `${color}-${view}-cut.png`), out: `${OUT}/${color}-${view}.webp` });
    }
  }
  execFileSync("swift", ["scripts/cutout.swift", ...jobs.flatMap((j) => [j.crop, j.cut])], { stdio: "inherit" });
  for (const j of jobs) {
    // Trim to the product with a little air, so every cut-out's box is the product's own.
    await sharp(j.cut)
      .trim({ threshold: 1 })
      .extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90, alphaQuality: 100 })
      .toFile(j.out);
    const m = await sharp(j.out).metadata();
    console.log(`${j.out} ${m.width}×${m.height}`);
  }
} finally {
  await rm(work, { recursive: true, force: true });
}
