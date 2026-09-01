/**
 * Gemini's TTS models return raw 16-bit PCM audio (no container), which
 * `<audio>`/`Audio()` on the client can't play directly. Wrap it in a minimal
 * 44-byte WAV header so the browser can decode it with zero extra libraries.
 */

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Wraps base64 mono 16-bit PCM into a base64 WAV file at the given sample rate. */
export function pcmToWavBase64(pcmBase64: string, sampleRate: number): string {
  const pcmBytes = base64ToBytes(pcmBase64);
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + pcmBytes.length, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (16-bit mono)
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, pcmBytes.length, true);

  const wavBytes = new Uint8Array(44 + pcmBytes.length);
  wavBytes.set(new Uint8Array(header), 0);
  wavBytes.set(pcmBytes, 44);
  return bytesToBase64(wavBytes);
}

/** Extracts the sample rate from a Gemini TTS mimeType like "audio/L16;codec=pcm;rate=24000". */
export function sampleRateFromMime(mime: string | undefined, fallback = 24000): number {
  const match = mime ? /rate=(\d+)/.exec(mime) : null;
  return match ? parseInt(match[1], 10) : fallback;
}
