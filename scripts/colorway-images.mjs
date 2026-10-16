// Cuts the colorway concept sheet (assets/product/cue-colorways-sheet.webp, 1536 × 1024) into the
// panels the preorder page shows (public/preorder/). Run it again after replacing the sheet:
//   node scripts/colorway-images.mjs
// The sheet has one column per colorway and the same five rows in each: worn on the ear, the
// device, four angles, three details, and the case with the box. The on-ear crop stops above the
// sheet's printed color label, which uses an old name ("space grey" is now graphite).
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const SHEET = "assets/product/cue-colorways-sheet.webp";
const OUT = "public/preorder";

// Left edge and width of each colorway's column, inside the white gutters.
const COLUMNS = {
  graphite: { left: 0, width: 509 },
  silver: { left: 515, width: 507 },
  champagne: { left: 1027, width: 509 },
};

// Panels as [left offset in the column, top, width (null = to the column's edge), height].
const PANELS = {
  "on-ear": [0, 0, null, 298],
  device: [0, 351, null, 209],
  side: [0, 562, 116, 137],
  "three-quarter": [120, 562, 171, 137],
  front: [295, 562, 97, 137],
  back: [396, 562, null, 137],
  button: [0, 701, 186, 128],
  curve: [190, 701, 130, 128],
  port: [323, 701, null, 128],
  case: [0, 831, 304, 193],
  box: [310, 831, null, 193],
};

await mkdir(OUT, { recursive: true });
for (const [color, column] of Object.entries(COLUMNS)) {
  for (const [name, [x, top, w, height]] of Object.entries(PANELS)) {
    const box = { left: column.left + x, top, width: w ?? column.width - x, height };
    await sharp(SHEET).extract(box).webp({ quality: 92 }).toFile(`${OUT}/${color}-${name}.webp`);
    console.log(`${OUT}/${color}-${name}.webp`);
  }
}
