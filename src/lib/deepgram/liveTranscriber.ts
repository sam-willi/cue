import { normalize } from "@/lib/cue/lexicon";
import type { Word } from "@/lib/cue/types";

export interface TranscriberHandlers {
  onWords: (words: Word[], isFinal: boolean) => void;
  onUtteranceEnd: () => void;
  /** Every raw Deepgram message, for saving a session to debug later. */
  onRaw?: (msg: unknown) => void;
  onStatus: (status: "connecting" | "listening" | "stopped" | "error", detail?: string) => void;
}

interface DgWord {
  word: string;
  punctuated_word?: string;
  start: number;
  end: number;
  confidence: number;
}

const LISTEN_PARAMS = new URLSearchParams({
  model: "nova-3",
  language: "en",
  filler_words: "true", // keep "um"/"uh" — stripped by default
  interim_results: "true",
  punctuate: "true",
  endpointing: "300",
  utterance_end_ms: "1000",
  vad_events: "true",
  encoding: "linear16",
  sample_rate: "16000",
  channels: "1",
});

/** Streams the microphone to Deepgram and reports timed words. */
export class LiveTranscriber {
  private ws?: WebSocket;
  private ctx?: AudioContext;
  private stream?: MediaStream;
  private node?: AudioWorkletNode;
  private stopped = false;

  constructor(private h: TranscriberHandlers) {}

  async start() {
    this.stopped = false;
    this.h.onStatus("connecting");
    try {
      const res = await fetch("/api/deepgram-token", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not get a Deepgram token");

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.ctx = new AudioContext();
      await this.ctx.audioWorklet.addModule("/pcm-worklet.js");
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.node = new AudioWorkletNode(this.ctx, "pcm-worklet");
      src.connect(this.node);

      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${LISTEN_PARAMS}`, ["bearer", body.token]);
      ws.binaryType = "arraybuffer";
      this.ws = ws;
      ws.onopen = () => {
        this.h.onStatus("listening");
        this.node!.port.onmessage = (e) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(e.data);
        };
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        this.h.onRaw?.(msg);
        this.handleMessage(msg);
      };
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

  private handleMessage(msg: { type: string; is_final?: boolean; channel?: { alternatives: { words: DgWord[] }[] } }) {
    if (msg.type === "UtteranceEnd") return this.h.onUtteranceEnd();
    if (msg.type !== "Results") return;
    const dgWords = msg.channel?.alternatives[0]?.words ?? [];
    const words: Word[] = dgWords
      .map((w) => ({
        text: w.punctuated_word ?? w.word,
        norm: normalize(w.word),
        start: w.start,
        end: w.end,
        confidence: w.confidence,
      }))
      .filter((w) => w.norm);
    // speech_final only means a ~300 ms endpointing pause; utterance ends come from
    // UtteranceEnd (utterance_end_ms) so a "like" + pause can still see what follows.
    this.h.onWords(words, !!msg.is_final);
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
