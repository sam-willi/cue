// Downsamples mic audio to 16 kHz mono 16-bit PCM and posts ~100 ms chunks.
class PcmWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.pos = 0;
    this.buf = new Int16Array(1600);
    this.len = 0;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    // Simple decimation with averaging over each output sample's span.
    while (this.pos < ch.length) {
      const startIdx = Math.floor(this.pos);
      const endIdx = Math.min(ch.length, Math.floor(this.pos + this.ratio));
      let sum = 0;
      let n = 0;
      for (let k = startIdx; k < Math.max(endIdx, startIdx + 1); k++) {
        sum += ch[k];
        n++;
      }
      const s = Math.max(-1, Math.min(1, sum / n));
      this.buf[this.len++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.len === this.buf.length) {
        this.port.postMessage(this.buf.buffer, [this.buf.buffer]);
        this.buf = new Int16Array(1600);
        this.len = 0;
      }
      this.pos += this.ratio;
    }
    this.pos -= ch.length;
    return true;
  }
}

registerProcessor("pcm-worklet", PcmWorklet);
