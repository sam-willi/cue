// Copies the voice detector's runtime (onnxruntime-web, MIT) and model (Silero VAD, MIT, from
// @ricky0123/vad-web) into public/vad/, where the app fetches them when listening starts.
// Runs before `npm run dev` and `npm run build`; public/vad/ is not committed.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ort = dirname(require.resolve("onnxruntime-web"));
const vad = dirname(require.resolve("@ricky0123/vad-web"));
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "vad");
mkdirSync(out, { recursive: true });
for (const [dir, file] of [
  [ort, "ort.wasm.bundle.min.mjs"],
  [ort, "ort-wasm-simd-threaded.mjs"],
  [ort, "ort-wasm-simd-threaded.wasm"],
  [vad, "silero_vad_v5.onnx"],
])
  copyFileSync(join(dir, file), join(out, file));
