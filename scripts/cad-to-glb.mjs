/**
 * Convert the behind-the-ear (BTE) device's CAD into the web model the page renders with
 * three.js: public/cad/cue-bte.glb. The source is a zoo.dev export, GLB or STEP, on the
 * hardware-rev0 branch (hardware/rev0/democad.step); by default this reads it from there with git.
 *
 * Each CAD solid becomes one glTF mesh with its CAD color, in millimeters, in the CAD's own
 * frame (Z out of the shell's faces). Zoo's GLB is in meters and Y-up, and carries its B-rep
 * data, which the page doesn't need; this drops it. The LRA haptic motor (BOM M1:
 * Vybronics VG0832013D, 8 mm coin, pressed toward the skin) is found by its footprint and
 * its parts are named "motor-*". The scene's extras record where the vibration leaves the
 * device (the motor's skin-side face) so the page can draw the haptics coming out of it.
 *
 * Run: npm run cad   or   node scripts/cad-to-glb.mjs [in.glb|in.step] [out.glb]   (re-run whenever the CAD changes)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import occtImport from "occt-import-js";

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const CAD_REF = "origin/hardware-rev0:hardware/rev0/democad.step";
const IN = process.argv[2] ?? CAD_REF;
const OUT = process.argv[3] ?? path.join(ROOT, "public/cad/cue-bte.glb");

/** The motor: an ~8 mm round part. Its center in the CAD's XY plane (mm). */
const MOTOR_DIAMETER = [7, 10];

const source = process.argv[2]
  ? fs.readFileSync(IN)
  : execFileSync("git", ["show", CAD_REF], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
const isGlb = source.readUInt32LE(0) === 0x46546c67; // "glTF"

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

/** sRGB → linear. Zoo writes CAD colors into baseColorFactor as sRGB; glTF expects linear. */
const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Parts from a zoo.dev GLB: meters → mm, glTF Y-up → the CAD frame (x, −z, y). */
function readGlb(buf) {
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString());
  const binStart = 20 + jsonLen + 8;
  if (gltf.nodes.some((n) => n.matrix || n.translation || n.rotation || n.scale))
    throw new Error("GLB nodes carry transforms; export without them or extend readGlb");
  // A float VEC3 accessor, honoring interleaving (Zoo stores position and normal in one view).
  const read = (i) => {
    const a = gltf.accessors[i];
    const v = gltf.bufferViews[a.bufferView];
    const stride = v.byteStride ?? 12;
    const start = binStart + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const out = new Float32Array(a.count * 3);
    for (let k = 0; k < a.count; k++)
      for (let c = 0; c < 3; c++) out[k * 3 + c] = buf.readFloatLE(start + k * stride + c * 4);
    return out;
  };
  const toCad = (src, scale) => {
    const out = new Float32Array(src.length);
    for (let i = 0; i < src.length; i += 3) {
      out[i] = src[i] * scale;
      out[i + 1] = -src[i + 2] * scale;
      out[i + 2] = src[i + 1] * scale;
    }
    return out;
  };
  return gltf.meshes.map((mesh) => {
    const pos = [];
    const nrm = [];
    for (const prim of mesh.primitives) {
      if ((prim.mode ?? 4) !== 4 || prim.indices !== undefined)
        throw new Error("Expected non-indexed triangles, as zoo.dev exports");
      pos.push(...toCad(read(prim.attributes.POSITION), 1000));
      nrm.push(...toCad(read(prim.attributes.NORMAL), 1));
    }
    // Zoo repeats every corner per triangle; share corners with the same position and normal.
    const seen = new Map();
    const positions = [];
    const normals = [];
    const indices = new Uint32Array(pos.length / 3);
    for (let i = 0; i < pos.length; i += 3) {
      const key = [pos[i], pos[i + 1], pos[i + 2], nrm[i], nrm[i + 1], nrm[i + 2]].map((x) => x.toFixed(4)).join();
      let k = seen.get(key);
      if (k === undefined) {
        k = positions.length / 3;
        seen.set(key, k);
        positions.push(pos[i], pos[i + 1], pos[i + 2]);
        normals.push(nrm[i], nrm[i + 1], nrm[i + 2]);
      }
      indices[i / 3] = k;
    }
    const base = gltf.materials[mesh.primitives[0].material]?.pbrMetallicRoughness?.baseColorFactor ?? [0.6, 0.6, 0.6];
    return {
      positions: Float32Array.from(positions),
      normals: Float32Array.from(normals),
      indices,
      color: base.slice(0, 3).map(linear),
      box: bounds(positions),
    };
  });
}

async function readStep(buf) {
  const occt = await occtImport();
  const result = occt.ReadStepFile(new Uint8Array(buf), {
    linearUnit: "millimeter",
    linearDeflectionType: "absolute_value",
    linearDeflection: 0.05,
    angularDeflection: 0.2,
  });
  if (!result.success) throw new Error(`Could not read ${IN}`);
  return result.meshes.map((m) => ({
    positions: Float32Array.from(m.attributes.position.array),
    normals: Float32Array.from(m.attributes.normal.array),
    indices: m.index.array,
    color: m.color ?? [0.6, 0.6, 0.6],
    box: bounds(m.attributes.position.array),
  }));
}

const parts = isGlb ? readGlb(source) : await readStep(source);

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

// The visible finish (CUE_CONTEXT.md §26, decision 8): an opaque matte body in a hair-matched
// tone and a frosted translucent ear hook. The outer shells are the large parts over the body;
// the hook is the large part that reaches out past it. Internals keep their CAD colors.
const hex = (h) => [1, 3, 5].map((k) => linear(parseInt(h.slice(k, k + 2), 16) / 255));
const BODY = hex("#1C1C1C"); // matte black
const HOOK = hex("#D8D3CB"); // light warm gray, seen through a frosted sleeve
const bodyBox = all;
const roleOf = (p) => {
  if (Math.max(...p.box.size) <= 15) return null;
  const outside = p.box.center[0] < bodyBox.min[0] + 0.25 * bodyBox.size[0] || p.box.center[1] > 0.6 * bodyBox.max[1];
  if (outside) return "ear-hook";
  return p.box.size[2] > 4 ? "body-shell" : null; // the shell halves, not the frame or board inside
};

const meshes = [];
const materials = [];
const nodes = [];
let usesTransmission = false;
parts.forEach((p, i) => {
  const isMotor = motorParts.includes(p);
  const role = roleOf(p);
  const name = isMotor ? `motor-${i}` : role ? `${role}-${i}` : `part-${i}`;
  if (role === "ear-hook") {
    usesTransmission = true;
    materials.push({
      name,
      pbrMetallicRoughness: { baseColorFactor: [...HOOK, 1], metallicFactor: 0, roughnessFactor: 0.6 },
      extensions: { KHR_materials_transmission: { transmissionFactor: 0.55 } },
    });
  } else {
    materials.push({
      name,
      pbrMetallicRoughness: {
        baseColorFactor: [...(role === "body-shell" ? BODY : p.color), 1],
        metallicFactor: role ? 0 : 0.15,
        roughnessFactor: role ? 0.75 : 0.6,
      },
    });
  }
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
  ...(usesTransmission ? { extensionsUsed: ["KHR_materials_transmission"] } : {}),
  asset: {
    version: "2.0",
    generator: "cue scripts/cad-to-glb.mjs",
    extras: { source: process.argv[2] ? path.relative(ROOT, IN) : CAD_REF },
  },
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
