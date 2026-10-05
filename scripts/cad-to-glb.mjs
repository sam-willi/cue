/**
 * Convert the cuff CAD (cad/democad.step, a zoo.dev export) into a web model:
 * public/cad/cue-cuff.glb, which the page renders with three.js.
 *
 * Each STEP solid becomes one glTF mesh with its CAD color. The LRA haptic motor (BOM M1:
 * Vybronics VG0832013D, 8 mm coin, pressed toward the skin) is found by its footprint and
 * its parts are named "motor-*". The scene's extras record where the vibration leaves the
 * device (the motor's skin-side face) so the page can draw the haptics coming out of it.
 *
 * Run: node scripts/cad-to-glb.mjs [in.step] [out.glb]   (re-run whenever the CAD changes)
 */
import fs from "node:fs";
import path from "node:path";
import occtImport from "occt-import-js";

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const IN = process.argv[2] ?? path.join(ROOT, "cad/democad.step");
const OUT = process.argv[3] ?? path.join(ROOT, "public/cad/cue-cuff.glb");

/** The motor: an ~8 mm round part. Its center in the CAD's XY plane (mm). */
const MOTOR_DIAMETER = [7, 10];

const occt = await occtImport();
const result = occt.ReadStepFile(new Uint8Array(fs.readFileSync(IN)), {
  linearUnit: "millimeter",
  linearDeflectionType: "absolute_value",
  linearDeflection: 0.05,
  angularDeflection: 0.2,
});
if (!result.success) throw new Error(`Could not read ${IN}`);

const bounds = (p) => {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p[i + k]);
      max[k] = Math.max(max[k], p[i + k]);
    }
  return { min, max, size: max.map((v, k) => v - min[k]), center: max.map((v, k) => (v + min[k]) / 2) };
};

const parts = result.meshes.map((m) => ({
  positions: Float32Array.from(m.attributes.position.array),
  normals: Float32Array.from(m.attributes.normal.array),
  indices: m.index.array,
  color: m.color ?? [0.6, 0.6, 0.6],
  box: bounds(m.attributes.position.array),
}));

// The motor's housing is the largest round part in the motor size range; everything centered
// on the same axis and no wider belongs to it (rotor, cap, ring).
const isRound = (b) => Math.abs(b.size[0] - b.size[1]) < 0.3;
const inRange = (b) => b.size[0] >= MOTOR_DIAMETER[0] && b.size[0] <= MOTOR_DIAMETER[1];
const housing = parts.filter((p) => isRound(p.box) && inRange(p.box)).sort((a, b) => b.box.size[0] - a.box.size[0])[0];
if (!housing) throw new Error("Couldn't find the 8 mm haptic motor in the CAD");
const axis = housing.box.center;
const motorParts = parts.filter(
  (p) =>
    isRound(p.box) &&
    Math.hypot(p.box.center[0] - axis[0], p.box.center[1] - axis[1]) < 0.5 &&
    p.box.size[0] <= housing.box.size[0] + 0.01,
);
const motorMin = Math.min(...motorParts.map((p) => p.box.min[2]));
const all = bounds(Float32Array.from(parts.flatMap((p) => [...p.box.min, ...p.box.max])));
// Skin side is the side of the shell the motor is pressed toward.
const skinSide = Math.sign(axis[2] - all.center[2]) || -1;
const motor = {
  center: [axis[0], axis[1], skinSide < 0 ? motorMin : Math.max(...motorParts.map((p) => p.box.max[2]))],
  normal: [0, 0, skinSide],
  diameter: housing.box.size[0],
};

// --- Write a GLB (glTF 2.0 binary) ---
const chunks = [];
let byteLength = 0;
const bufferViews = [];
const accessors = [];
const pushView = (typed, target) => {
  const pad = (4 - (byteLength % 4)) % 4;
  if (pad) {
    chunks.push(Buffer.alloc(pad));
    byteLength += pad;
  }
  const buf = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
  bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: buf.length, target });
  chunks.push(buf);
  byteLength += buf.length;
  return bufferViews.length - 1;
};

const meshes = [];
const materials = [];
const nodes = [];
parts.forEach((p, i) => {
  const isMotor = motorParts.includes(p);
  const large = Math.max(...p.box.size) > 15; // shell and ear clip: the finished metal surfaces
  materials.push({
    name: isMotor ? `motor-${i}` : `part-${i}`,
    pbrMetallicRoughness: {
      baseColorFactor: [...p.color, 1],
      metallicFactor: large ? 0.55 : 0.15,
      roughnessFactor: large ? 0.38 : 0.6,
    },
  });
  const pos = pushView(p.positions, 34962);
  accessors.push({
    bufferView: pos,
    componentType: 5126,
    count: p.positions.length / 3,
    type: "VEC3",
    min: p.box.min,
    max: p.box.max,
  });
  const nrm = pushView(p.normals, 34962);
  accessors.push({ bufferView: nrm, componentType: 5126, count: p.normals.length / 3, type: "VEC3" });
  const small = p.positions.length / 3 < 65536;
  const idx = pushView(small ? Uint16Array.from(p.indices) : Uint32Array.from(p.indices), 34963);
  accessors.push({ bufferView: idx, componentType: small ? 5123 : 5125, count: p.indices.length, type: "SCALAR" });
  meshes.push({
    name: materials[i].name,
    primitives: [
      {
        attributes: { POSITION: accessors.length - 3, NORMAL: accessors.length - 2 },
        indices: accessors.length - 1,
        material: i,
      },
    ],
  });
  nodes.push({ name: materials[i].name, mesh: i });
});

const gltf = {
  asset: { version: "2.0", generator: "cue scripts/cad-to-glb.mjs", extras: { source: path.relative(ROOT, IN) } },
  scene: 0,
  scenes: [{ nodes: nodes.map((_, i) => i), extras: { units: "mm", motor } }],
  nodes,
  meshes,
  materials,
  accessors,
  bufferViews,
  buffers: [{ byteLength }],
};

const bin = Buffer.concat(chunks);
let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const binPadded = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); // "glTF"
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + json.length + 8 + binPadded.length, 8);
const chunkHeader = (len, type) => {
  const b = Buffer.alloc(8);
  b.writeUInt32LE(len, 0);
  b.writeUInt32LE(type, 4);
  return b;
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  Buffer.concat([
    header,
    chunkHeader(json.length, 0x4e4f534a),
    json,
    chunkHeader(binPadded.length, 0x004e4942),
    binPadded,
  ]),
);
console.log(
  `${parts.length} parts, ${parts.reduce((n, p) => n + p.indices.length / 3, 0)} triangles → ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`,
);
console.log(
  `motor: ${motorParts.length} parts, ${motor.diameter.toFixed(1)} mm, face at ${motor.center.map((v) => v.toFixed(1)).join(", ")}`,
);
