/** Encode 16-bit mono PCM chunks as a WAV file (for training recordings). */
export function encodeWav(chunks: Int16Array[], sampleRate = 16000): Blob {
  const samples = chunks.reduce((n, c) => n + c.length, 0);
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const str = (o: number, t: string) => [...t].forEach((ch, k) => v.setUint8(o + k, ch.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  str(36, "data");
  v.setUint32(40, samples * 2, true);
  let o = 44;
  for (const c of chunks) for (let k = 0; k < c.length; k++, o += 2) v.setInt16(o, c[k], true);
  return new Blob([buf], { type: "audio/wav" });
}
