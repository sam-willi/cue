import { loadVoiceDetector } from "@/lib/audio/loadVoiceDetector";
import type { VoiceDetector } from "@/lib/audio/voiceDetector";
import { SpeechLevelMeter } from "@/lib/cue/loudness";
import { pitchHz } from "@/lib/cue/pitch";
import type { DgMessage } from "./parse";

export interface TranscriberHandlers {
  /**
   * Every Deepgram message, in order. Pass each to `feedMessage` to drive a CueSession;
   * keeping the raw stream also lets a session be saved and replayed exactly.
   */
  onMessage: (msg: DgMessage) => void;
  /** Mic level of each 50 ms chunk: Deepgram audio time (s, chunk midpoint) and K-weighted dB re full scale. */
  onLevel?: (t: number, db: number) => void;
  /** Voice pitch of each chunk that has one (Hz), for the session report. Silence and noise are skipped. */
  onPitch?: (t: number, hz: number) => void;
  /**
   * Whether each 32 ms of audio held a voice (Silero VAD), on Deepgram's audio clock. Starts a
   * moment after listening does, once the detector has loaded, and never if it can't load.
   */
  onVoice?: (t: number, voice: boolean) => void;
  /** Every 16 kHz PCM chunk sent to Deepgram, for opt-in training recordings. */
  onAudio?: (pcm: Int16Array) => void;
  onStatus: (status: "connecting" | "listening" | "stopped" | "error", detail?: string, code?: KeyProblem) => void;
  /** The microphone actually in use, by its name (e.g. "AirPods Pro"), once capture starts. */
  onMic?: (mic: { label: string; deviceId: string }) => void;
}

/** Why listening couldn't start for want of a usable Deepgram key. */
export type KeyProblem = "needs_key" | "bad_key";

class KeyError extends Error {
  constructor(
    message: string,
    readonly code: KeyProblem,
  ) {
    super(message);
  }
}

/**
 * Deepgram Flux. Measured on the same clip (22 s, 5 fillers), streaming in real time:
 *  - flux:   updates every ~0.2 s; fillers arrived 0.5–0.9 s after they ended; kept 5/5.
 *  - nova-2: updates every ~1 s; fillers arrived 0.9–2.0 s after (its speaker labels are
 *            no longer needed: the device's bone sensor hears only the wearer).
 *  - nova-3: dropped 4–5 of the 5 fillers in live streaming.
 */
const LISTEN_URL = "wss://api.deepgram.com/v2/listen";
/** Deepgram accepts up to 100 keyterms. */
const MAX_KEYTERMS = 100;

/**
 * The listen URL. `keyterms` are words Deepgram should listen for specially (its "keyterm
 * prompting"): the wearer's own filler words, which Cue can only count if they're transcribed.
 * Measured on a synthesized clip saying "lowkey" twice: without keyterms it came back as
 * "locally" and "logica"; with "lowkey" as a keyterm, one of the two was recognized.
 */
export function listenUrl(keyterms: string[] = []): string {
  const q = new URLSearchParams({ model: "flux-general-en", encoding: "linear16", sample_rate: "16000" });
  for (const term of [...new Set(keyterms.map((k) => k.trim()).filter(Boolean))].slice(0, MAX_KEYTERMS))
    q.append("keyterm", term);
  return `${LISTEN_URL}?${q}`;
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
  private vad?: VoiceDetector;
  private meter = new SpeechLevelMeter();

  constructor(private h: TranscriberHandlers) {}

  /**
   * Start listening. With `apiKey` (the visitor's own Deepgram key), the browser connects to
   * Deepgram directly and the key never reaches this app's server. Without it, the server
   * mints a short-lived token from its own DEEPGRAM_API_KEY, if it has one.
   */
  async start(opts: { apiKey?: string; deviceId?: string; keyterms?: string[] } = {}) {
    this.stopped = false;
    this.sentSec = 0;
    this.clockZero = Infinity;
    this.meter = new SpeechLevelMeter();
    this.h.onStatus("connecting");
    if (this.h.onVoice) {
      // Loads alongside the connection. If it fails, Cue carries on with word timing alone.
      loadVoiceDetector((t, voice) => this.h.onVoice?.(t, voice))
        .then((vad) => {
          if (this.stopped) vad.close();
          else this.vad = vad;
        })
        .catch(() => {});
    }
    try {
      let protocols: string[];
      if (opts.apiKey) {
        protocols = ["token", opts.apiKey];
      } else {
        const res = await fetch("/api/deepgram-token", { method: "POST" });
        const body = await res.json();
        if (!res.ok) {
          const msg = body.error ?? "Could not get a Deepgram token";
          throw body.code === "no_server_key" ? new KeyError(msg, "needs_key") : new Error(msg);
        }
        protocols = ["bearer", body.token];
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        // Gain control and noise suppression are off: they would boost quiet speech and erase the
        // room noise Cue measures for "too quiet". Deepgram copes with unprocessed audio.
        // Echo cancellation stays on so cue sounds played into headphones aren't heard back.
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
          // A chosen mic (AirPods, say). If it's gone, the browser's default is used instead.
          ...(opts.deviceId ? { deviceId: { ideal: opts.deviceId } } : {}),
        },
      });
      const track = this.stream.getAudioTracks()[0];
      if (track) this.h.onMic?.({ label: track.label, deviceId: track.getSettings().deviceId ?? "" });
      this.ctx = new AudioContext();
      await this.ctx.audioWorklet.addModule("/pcm-worklet.js");
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.node = new AudioWorkletNode(this.ctx, "pcm-worklet");
      src.connect(this.node);

      const ws = new WebSocket(listenUrl(opts.keyterms), protocols);
      ws.binaryType = "arraybuffer";
      this.ws = ws;
      let opened = false;
      ws.onopen = () => {
        opened = true;
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
          const pcm = new Int16Array(e.data);
          const mid = this.sentSec - chunkSec / 2;
          this.h.onLevel?.(mid, this.meter.level(pcm));
          if (this.h.onPitch) {
            const hz = pitchHz(pcm);
            if (hz !== null) this.h.onPitch(mid, hz);
          }
          this.vad?.push(pcm, this.sentSec - chunkSec);
          this.h.onAudio?.(pcm);
        };
      };
      ws.onmessage = (e) => this.h.onMessage(JSON.parse(e.data));
      // Browsers hide the HTTP status of a refused WebSocket, so a visitor's key that never
      // opens a connection is reported as a key problem (wrong, revoked, or out of credit).
      const refusedKey = () => !opened && !!opts.apiKey;
      ws.onerror = () => {
        if (refusedKey())
          this.h.onStatus(
            "error",
            "Deepgram didn’t accept that key. Check it, or its balance, and try again.",
            "bad_key",
          );
        else this.h.onStatus("error", "Connection to Deepgram failed");
      };
      ws.onclose = (e) => {
        if (!this.stopped && !refusedKey())
          this.h.onStatus("error", `Deepgram closed the connection (${e.code}${e.reason ? `: ${e.reason}` : ""})`);
        this.teardownAudio();
      };
    } catch (err) {
      this.teardownAudio();
      this.h.onStatus(
        "error",
        err instanceof Error ? err.message : String(err),
        err instanceof KeyError ? err.code : undefined,
      );
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
    this.vad?.close();
    this.vad = undefined;
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close().catch(() => {});
    this.node = undefined;
    this.stream = undefined;
    this.ctx = undefined;
  }
}
