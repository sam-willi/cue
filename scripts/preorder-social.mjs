// The link preview for /preorder: a 1200 × 630 still (public/preorder/social.png) and a 3-second
// loop of the tap (public/preorder/social.mp4) for the apps that play one, after lilguy's video
// preview. Uses the graphite render cut-out from scripts/colorway-cutouts.mjs, and ffmpeg for the loop:
//   node scripts/preorder-social.mjs
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const W = 1200;
const H = 630;
const BONE = "#f7f4ee";
const INK = "#111111";
// The page's accent: deep satin gold (preorder.module.css, --cue on .page).
const GOLD = "#a47a47";
const FPS = 30;
const SECONDS = 3;

// The device, tilted into the top-left corner as on the page.
const DEVICE = { file: "public/preorder/cutout/graphite-render.webp", width: 300, angle: 22, left: -20, top: -30 };
// Where the motor is on the cut-out, as fractions of it (Cutout.tsx, MOTOR.render).
const MOTOR = { x: 0.8, y: 0.57 };
// The loop: one tap, then the slow steps, in the page's rhythm (ms from the start, pulse length).
const PULSES = [
  { at: 300, long: false },
  { at: 1300, long: false },
  { at: 1650, long: false },
  { at: 2000, long: false },
];

const text = `
  <style>
    .h { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-weight: 700; fill: ${INK}; letter-spacing: -6px; }
    .s { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-weight: 500; fill: #5f5b56; font-size: 26px; }
    .p { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-weight: 700; fill: ${INK}; font-size: 30px; }
  </style>
  <text class="h" x="${W - 64}" y="300" text-anchor="end" font-size="138">you suck</text>
  <text class="h" x="${W - 64}" y="420" text-anchor="end" font-size="138">at speaking.</text>
  <text class="s" x="64" y="${H - 58}">Cue taps you, privately, when a speaking habit shows up.</text>
  <text class="p" x="${W - 64}" y="${H - 56}" text-anchor="end">$110 · Premium for life</text>`;

async function device() {
  const resized = await sharp(DEVICE.file).resize({ width: DEVICE.width }).toBuffer();
  const meta = await sharp(resized).metadata();
  const rotated = await sharp(resized)
    .rotate(DEVICE.angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  const r = await sharp(rotated).metadata();
  // The motor's spot after the rotation, about the image's center.
  const a = (DEVICE.angle * Math.PI) / 180;
  const dx = (MOTOR.x - 0.5) * meta.width;
  const dy = (MOTOR.y - 0.5) * meta.height;
  const motor = {
    x: DEVICE.left + r.width / 2 + dx * Math.cos(a) - dy * Math.sin(a),
    y: DEVICE.top + r.height / 2 + dx * Math.sin(a) + dy * Math.cos(a),
  };
  return { image: rotated, motor };
}

/** The rings on screen at time t (ms): each pulse's ring grows and fades over 1.1 s. */
function rings(t, motor) {
  let out = "";
  for (const p of PULSES) {
    const k = (t - p.at) / 1100;
    if (k < 0 || k > 1) continue;
    const ease = 1 - Math.pow(1 - k, 3);
    const r = 6 + ease * 58;
    const opacity = 0.9 * (1 - k);
    out += `<circle cx="${motor.x}" cy="${motor.y}" r="${r}" fill="none" stroke="${GOLD}" stroke-width="3" opacity="${opacity}"/>`;
  }
  const driving = PULSES.some((p) => t >= p.at && t < p.at + 110);
  if (driving) out += `<circle cx="${motor.x}" cy="${motor.y}" r="6" fill="${GOLD}"/>`;
  return out;
}

const frame = (svgExtra, dev) =>
  sharp({ create: { width: W, height: H, channels: 4, background: BONE } }).composite([
    { input: dev.image, left: DEVICE.left, top: DEVICE.top },
    {
      input: Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${text}${svgExtra}</svg>`),
    },
  ]);

const dev = await device();
await frame(rings(450, dev.motor), dev).png().toFile("public/preorder/social.png");
console.log("public/preorder/social.png");

const work = await mkdtemp(join(tmpdir(), "cue-social-"));
try {
  for (let i = 0; i < FPS * SECONDS; i++) {
    await frame(rings((i / FPS) * 1000, dev.motor), dev)
      .png()
      .toFile(join(work, `f${String(i).padStart(3, "0")}.png`));
  }
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-framerate",
      String(FPS),
      "-i",
      join(work, "f%03d.png"),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "24",
      "-movflags",
      "+faststart",
      "public/preorder/social.mp4",
    ],
    { stdio: "inherit" },
  );
  console.log("public/preorder/social.mp4");
} finally {
  await rm(work, { recursive: true, force: true });
}
