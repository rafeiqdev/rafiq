import { describe, expect, it } from 'vitest';
import { pcmToWavBase64, sampleRateFromMime } from './wav';

describe('sampleRateFromMime', () => {
  it('extracts the rate from a Gemini TTS mimeType', () => {
    expect(sampleRateFromMime('audio/L16;codec=pcm;rate=24000')).toBe(24000);
  });

  it('falls back to 24000 when the mimeType is missing a rate', () => {
    expect(sampleRateFromMime('audio/L16')).toBe(24000);
    expect(sampleRateFromMime(undefined)).toBe(24000);
  });

  it('honors a custom fallback', () => {
    expect(sampleRateFromMime(undefined, 16000)).toBe(16000);
  });
});

describe('pcmToWavBase64', () => {
  it('produces a valid RIFF/WAVE header around the PCM bytes', () => {
    // 4 bytes of PCM = two 16-bit samples
    const pcmBytes = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const pcmBase64 = btoa(String.fromCharCode(...pcmBytes));
    const wavBase64 = pcmToWavBase64(pcmBase64, 24000);

    const wavBinary = atob(wavBase64);
    const wavBytes = new Uint8Array(wavBinary.length);
    for (let i = 0; i < wavBinary.length; i++) wavBytes[i] = wavBinary.charCodeAt(i);

    expect(wavBytes.length).toBe(44 + pcmBytes.length);
    expect(String.fromCharCode(...wavBytes.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...wavBytes.slice(8, 12))).toBe('WAVE');
    expect(String.fromCharCode(...wavBytes.slice(12, 16))).toBe('fmt ');
    expect(String.fromCharCode(...wavBytes.slice(36, 40))).toBe('data');
    // the trailing bytes are the original PCM payload, byte-for-byte
    expect(Array.from(wavBytes.slice(44))).toEqual(Array.from(pcmBytes));

    const view = new DataView(wavBytes.buffer);
    expect(view.getUint32(24, true)).toBe(24000); // sample rate
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(view.getUint32(40, true)).toBe(pcmBytes.length); // data chunk size
  });
});
