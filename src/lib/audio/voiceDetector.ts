import type { InferenceSession, Tensor, TypedTensor } from "onnxruntime-common";

/**
 * Voice activity from the microphone audio itself, using the Silero VAD model (MIT). Cue uses it
 * to hear real pauses: word timestamps from the transcript drift by up to a second, so a gap
 * between two words doesn't always mean silence, and a real pause doesn't always show as a gap.
 *
 * The model takes 512-sample frames (32 ms at 16 kHz), each prefixed with the last 64 samples
 * of the frame before it, and carries its own state from frame to frame.
 */
export const VAD_FRAME = 512;
const CONTEXT = 64;
const SAMPLE_RATE = 16000;
/** A frame at or above this probability is voice. */
const VOICE_THRESHOLD = 0.5;

/** The parts of onnxruntime this needs, so it can be given the web build or a test double. */
export interface OrtLike {
  InferenceSession: { create(model: ArrayBuffer | Uint8Array): Promise<InferenceSession> };
  Tensor: new (type: "float32" | "int64", data: Float32Array | BigInt64Array, dims: number[]) => Tensor;
}

export class VoiceDetector {
  private pending = new Int16Array(0);
  private context = new Float32Array(CONTEXT);
  private state: Tensor;
  private readonly sr: Tensor;
  /** Audio time (s) of the first sample in `pending`. */
  private pendingStart = 0;
  private queue: Promise<void> = Promise.resolve();
  private closed = false;
  private started = false;

  private constructor(
    private ort: OrtLike,
    private session: InferenceSession,
    private onFrame: (t: number, voice: boolean, probability: number) => void,
  ) {
    this.state = new ort.Tensor("float32", new Float32Array(2 * 128), [2, 1, 128]);
    this.sr = new ort.Tensor("int64", BigInt64Array.from([BigInt(SAMPLE_RATE)]), []);
  }

  /** `onFrame` gets each 32 ms frame's midpoint on the audio clock and whether it held a voice. */
  static async create(
    ort: OrtLike,
    model: ArrayBuffer | Uint8Array,
    onFrame: (t: number, voice: boolean, probability: number) => void,
  ): Promise<VoiceDetector> {
    return new VoiceDetector(ort, await ort.InferenceSession.create(model), onFrame);
  }

  /**
   * Add the next chunk of 16 kHz audio. Chunks must arrive in order with no gaps; `startTime` is
   * the audio-clock time of the first chunk's first sample (ignored after that).
   */
  push(pcm: Int16Array, startTime = 0) {
    if (this.closed) return;
    if (!this.started) {
      this.started = true;
      this.pendingStart = startTime;
    }
    const joined = new Int16Array(this.pending.length + pcm.length);
    joined.set(this.pending);
    joined.set(pcm, this.pending.length);
    let offset = 0;
    while (joined.length - offset >= VAD_FRAME) {
      const frame = new Float32Array(VAD_FRAME);
      for (let k = 0; k < VAD_FRAME; k++) frame[k] = joined[offset + k] / 32768;
      const mid = this.pendingStart + (offset + VAD_FRAME / 2) / SAMPLE_RATE;
      // The model's state depends on the frame before, so frames run strictly one at a time.
      this.queue = this.queue.then(() => this.run(frame, mid)).catch(() => this.close());
      offset += VAD_FRAME;
    }
    this.pending = joined.slice(offset);
    this.pendingStart += offset / SAMPLE_RATE;
  }

  /** Resolves once every frame pushed so far has been judged. */
  flush(): Promise<void> {
    return this.queue;
  }

  close() {
    this.closed = true;
  }

  private async run(frame: Float32Array, mid: number) {
    if (this.closed) return;
    const input = new Float32Array(CONTEXT + VAD_FRAME);
    input.set(this.context);
    input.set(frame, CONTEXT);
    this.context = frame.slice(-CONTEXT);
    const out = await this.session.run({
      input: new this.ort.Tensor("float32", input, [1, input.length]),
      state: this.state,
      sr: this.sr,
    });
    this.state = out.stateN;
    const p = (out.output as TypedTensor<"float32">).data[0];
    if (!this.closed) this.onFrame(mid, p >= VOICE_THRESHOLD, p);
  }
}
