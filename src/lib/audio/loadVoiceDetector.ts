import { VoiceDetector, type OrtLike } from "./voiceDetector";

/** Where `scripts/copy-vad-assets.mjs` puts onnxruntime-web's WebAssembly build and the Silero model. */
const ASSETS = "/vad/";

/**
 * Load the voice detector in the browser. The runtime is about 14 MB of WebAssembly, so it is
 * fetched only when listening starts, straight from this site (not bundled, and no third party).
 * Rejects if anything can't be loaded; Cue then falls back to word timing alone.
 */
export async function loadVoiceDetector(
  onFrame: (t: number, voice: boolean, probability: number) => void,
): Promise<VoiceDetector> {
  const runtime = `${ASSETS}ort.wasm.bundle.min.mjs`;
  const ort = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ runtime)) as OrtLike & {
    env: { wasm: { wasmPaths: string; numThreads: number } };
  };
  ort.env.wasm.wasmPaths = ASSETS;
  // One thread: more would need cross-origin isolation headers, and a frame takes under a millisecond.
  ort.env.wasm.numThreads = 1;
  const res = await fetch(`${ASSETS}silero_vad_v5.onnx`);
  if (!res.ok) throw new Error(`Voice model not found (${res.status})`);
  return VoiceDetector.create(ort, await res.arrayBuffer(), onFrame);
}
