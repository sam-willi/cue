// Product cut-outs for the preorder page: each colorway's studio panels (from
// scripts/colorway-images.mjs) lifted onto a transparent background, trimmed to the product, and
// saved to public/preorder/cutout/. Needs a Mac (macOS 14+) for scripts/cutout.swift:
//   node scripts/colorway-images.mjs && node scripts/colorway-cutouts.mjs
// The panels are small, so each is enlarged 2× (Lanczos) before the cut, which keeps the edge of
// the mask smooth at the sizes the page shows them.
//
// It also cuts the larger studio renders (assets/product/cue-colorways-renders.webp: the three
// colorways side by side, one per third) into ${color}-render.webp, which the hero and the cue
// section use. The colorway cards and the detail view keep the sheet's panels.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const COLORS = ["graphite", "silver", "champagne"];
const VIEWS = ["device", "three-quarter", "side", "front", "back", "case"];
const OUT = "public/preorder/cutout";
const RENDERS = "assets/product/cue-colorways-renders.webp";

await mkdir(OUT, { recursive: true });
const work = await mkdtemp(join(tmpdir(), "cue-cutout-"));
try {
  const jobs = [];
  for (const color of COLORS) {
    for (const view of VIEWS) {
      const src = `public/preorder/${color}-${view}.webp`;
      const big = join(work, `${color}-${view}.png`);
      const { width } = await sharp(src).metadata();
      await sharp(src)
        .resize({ width: width * 2, kernel: "lanczos3" })
        .png()
        .toFile(big);
      jobs.push({ big, cut: join(work, `${color}-${view}-cut.png`), out: `${OUT}/${color}-${view}.webp` });
    }
  }
  // The renders: one colorway per third of the sheet, already large enough to cut as they are.
  const sheet = await sharp(RENDERS).metadata();
  const third = Math.floor(sheet.width / 3);
  for (const [i, color] of COLORS.entries()) {
    const crop = join(work, `${color}-render.png`);
    await sharp(RENDERS)
      .extract({ left: i * third, top: 0, width: third, height: sheet.height })
      .png()
      .toFile(crop);
    jobs.push({ big: crop, cut: join(work, `${color}-render-cut.png`), out: `${OUT}/${color}-render.webp` });
  }
  execFileSync("swift", ["scripts/cutout.swift", ...jobs.flatMap((j) => [j.big, j.cut])], { stdio: "inherit" });
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
