// Cuts the product concept sheet (assets/product/cue-concept-sheet.webp, 1536 × 1024) into the
// panels the landing pages show (public/landing/). Run it again after replacing the sheet:
//   node scripts/landing-images.mjs
// sharp is installed with Next.js, so there is nothing extra to add.
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const SHEET = "assets/product/cue-concept-sheet.webp";
const OUT = "public/landing";

// One box per panel, inside the sheet's white gutters.
const PANELS = {
  "cue-concept-on-ear": { left: 0, top: 0, width: 794, height: 1024 },
  "cue-concept-device": { left: 803, top: 0, width: 733, height: 419 },
  "cue-concept-angles": { left: 803, top: 428, width: 733, height: 265 },
  "cue-concept-detail-button": { left: 803, top: 700, width: 345, height: 324 },
  "cue-concept-detail-inner": { left: 1158, top: 700, width: 378, height: 324 },
};

await mkdir(OUT, { recursive: true });
for (const [name, box] of Object.entries(PANELS)) {
  await sharp(SHEET).extract(box).webp({ quality: 92 }).toFile(`${OUT}/${name}.webp`);
  console.log(`${OUT}/${name}.webp`);
}
