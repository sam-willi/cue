import { pcmDbfs } from "@/lib/cue/loudness";
import type { DgMessage } from "./parse";

export interface TranscriberHandlers {
  /**
   * Every Deepgram message, in order. Pass each to `feedMessage` to drive a CueSession;
   * keeping the raw stream also lets a session be saved and replayed exactly.
   */
  onMessage: (msg: DgMessage) => void;
  /** Mic level of each 50 ms chunk: Deepgram audio time (s, chunk midpoint) and dBFS. */
  onLevel?: (t: number, db: number) => void;
  onStatus: (status: "connecting" | "listening" | "stopped" | "error", detail?: string) => void;
}

export type Engine = "flux" | "nova-2";

const AUDIO = { encoding: "linear16", sample_rate: "16000" };

/**
 * Deepgram endpoints. Measured on the same clip (22 s, 5 fillers):
 *  - flux:   updates every ~0.2 s; fillers arrived 0.5–0.9 s after they ended; no speaker labels.
 *  - nova-2: updates every ~1 s; fillers arrived 0.9–2.0 s after; speaker labels (diarize).
 *  - nova-3 isn't offered: in live streaming it dropped 4–5 of the 5 fillers.
 */
function listenUrl(engine: Engine): string {
  if (engine === "flux")
    return `wss://api.deepgram.com/v2/listen?${new URLSearchParams({ model: "flux-general-en", ...AUDIO })}`;
  const params = new URLSearchParams({
    model: "nova-2",
    language: "en",
    filler_words: "true", // keep "um"/"uh" — stripped by default
    diarize: "true", // speaker labels per word, used to coach only the wearer
    interim_results: "true",
    punctuate: "true",
    endpointing: "300",
    // Utterance ends come from UtteranceEnd, not speech_final: a ~300 ms endpointing pause
    // after "like" is evidence of a filler, so we keep listening for what follows.
    utterance_end_ms: "1000",
    vad_events: "true",
    channels: "1",
    ...AUDIO,
  });
  return `wss://api.deepgram.com/v1/listen?${params}`;
}

/** Streams the microphone to Deepgram and reports its messages. */
export class LiveTranscriber {
  private ws?: WebSocket;
  private ctx?: AudioContext;
  private stream?: MediaStream;
  private node?: AudioWorkletNode;
  private stopped = false;
  private sentSec = 0;
  private clockZero = Infinity;

  constructor(
    private h: TranscriberHandlers,
    private engine: Engine = "flux",
  ) {}

  async start() {
    this.stopped = false;
    this.sentSec = 0;
    this.clockZero = Infinity;
    this.h.onStatus("connecting");
    try {
      const res = await fetch("/api/deepgram-token", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not get a Deepgram token");

      this.stream = await navigator.mediaDevices.getUserMedia({
        // Gain control and noise suppression are off: they would boost quiet speech and erase the
        // room noise Cue measures for "too quiet". Deepgram copes with unprocessed audio.
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: false },
      });
      this.ctx = new AudioContext();
      await this.ctx.audioWorklet.addModule("/pcm-worklet.js");
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.node = new AudioWorkletNode(this.ctx, "pcm-worklet");
      src.connect(this.node);

      const ws = new WebSocket(listenUrl(this.engine), ["bearer", body.token]);
      ws.binaryType = "arraybuffer";
      this.ws = ws;
      ws.onopen = () => {
        this.h.onStatus("listening");
        this.node!.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          ws.send(e.data);
          // Deepgram timestamps count from the first audio sample sent. Each chunk is sent
          // right after it's captured, so the earliest (now − audio sent so far) estimates
          // when audio time 0 happened on this page's clock.
          const chunkSec = e.data.byteLength / 2 / 16000;
          this.sentSec += chunkSec;
          this.clockZero = Math.min(this.clockZero, performance.now() - this.sentSec * 1000);
          this.h.onLevel?.(this.sentSec - chunkSec / 2, pcmDbfs(new Int16Array(e.data)));
        };
      };
      ws.onmessage = (e) => this.h.onMessage(JSON.parse(e.data));
      ws.onerror = () => this.h.onStatus("error", "Connection to Deepgram failed");
      ws.onclose = (e) => {
        if (!this.stopped)
          this.h.onStatus("error", `Deepgram closed the connection (${e.code}${e.reason ? `: ${e.reason}` : ""})`);
        this.teardownAudio();
      };
    } catch (err) {
      this.teardownAudio();
      this.h.onStatus("error", err instanceof Error ? err.message : String(err));
    }
  }

  stop() {
    this.stopped = true;
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: "CloseStream" }));
    this.ws?.close();
    this.teardownAudio();
    this.h.onStatus("stopped");
  }

  /** Page time (performance.now()) of a Deepgram audio timestamp, or null before audio flows. */
  audioToPageTime(t: number): number | null {
    return Number.isFinite(this.clockZero) ? this.clockZero + t * 1000 : null;
  }

  /** Deepgram audio time (s) of a page time, or null before audio flows. */
  pageToAudioTime(ms: number): number | null {
    return Number.isFinite(this.clockZero) ? (ms - this.clockZero) / 1000 : null;
  }

  private teardownAudio() {
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close().catch(() => {});
    this.node = undefined;
    this.stream = undefined;
    this.ctx = undefined;
  }
}
