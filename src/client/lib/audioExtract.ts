// Pull the sound out of a recording as a small 16 kHz mono WAV, on the device.
// iPhone video files are often too big to upload (the host's limit is about 4 MB);
// the speech alone is about 32 KB a second, so a two-minute take is under 4 MB.

const RATE = 16000;

export async function toWav16k(blob: Blob): Promise<Blob | null> {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const Offline = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    if (!Ctx || !Offline) return null;
    const ctx = new Ctx();
    let decoded: AudioBuffer;
    try {
      const buf = await blob.arrayBuffer();
      decoded = await new Promise<AudioBuffer>((resolve, reject) => {
        // Callback form for older Safari; the promise form is used when available.
        const p = ctx.decodeAudioData(buf, resolve, reject) as unknown as Promise<AudioBuffer> | undefined;
        if (p && typeof p.then === "function") p.then(resolve, reject);
      });
    } finally {
      void ctx.close().catch(() => undefined);
    }
    if (!decoded.length) return null;
    const frames = Math.ceil(decoded.duration * RATE);
    const off = new Offline(1, frames, RATE);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const rendered = await off.startRendering();
    return encodeWav(rendered.getChannelData(0), RATE);
  } catch {
    return null;
  }
}

function encodeWav(samples: Float32Array, rate: number): Blob {
  const bytes = 44 + samples.length * 2;
  const view = new DataView(new ArrayBuffer(bytes));
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, bytes - 8, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++, o += 2) {
    const v = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Blob([view], { type: "audio/wav" });
}
