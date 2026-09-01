/**
 * Reads the chat assistant's replies aloud with a real (non-robotic) voice.
 *
 * Why this exists: the browser's built-in Web Speech API only speaks with
 * whatever voice is installed on the visitor's OS — on many Windows/Android
 * setups that's a single harsh legacy voice per language (or none at all for
 * Arabic). Gemini's native TTS models generate natural speech server-side, so
 * every visitor hears the same good voice regardless of their device.
 *
 * Uses the SAME GEMINI_API_KEY already configured for api/ai-chat.ts — no
 * separate account or key to set up. Runs on Vercel (server-side), so the key
 * never reaches the browser.
 *
 * POST body: { text } → { audio: <base64 WAV>, mime: 'audio/wav' }
 * Every failure returns 200 with `{ error }` so the client falls back to the
 * browser's own voice instead of breaking voice mode entirely.
 */

import { pcmToWavBase64, sampleRateFromMime } from './_lib/wav.js';

export const config = { runtime: 'edge' };

// Try the lighter TTS model first, then the pro one if it's unavailable
// (retired/renamed/rate-limited) — mirrors api/_lib/gemini.ts's MODEL_CHAIN
// fallback pattern for the chat models.
const TTS_MODEL_CHAIN = ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'];
// "Kore": a clear, warm, gender-neutral-leaning voice — Google's own quickstart
// default. Gemini TTS voices are multilingual; the model reads the input text
// in whatever language it's actually written in, no per-language config needed.
const VOICE_NAME = 'Kore';

// Chat replies are already constrained to a couple of short sentences
// (api/ai-chat.ts's prompt rules) — this cap is just a defensive ceiling
// against abuse, not a real-world limit.
const MAX_CHARS = 800;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: 'no_key' });

  let payload: { text?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const text = typeof payload.text === 'string' ? payload.text.trim().slice(0, MAX_CHARS) : '';
  if (!text) return json({ error: 'empty_input' });

  let lastStatus = 500;
  let lastDetail = 'no_models';
  for (const model of TTS_MODEL_CHAIN) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } } },
          },
        }),
      });
      if (!upstream.ok) {
        lastStatus = upstream.status;
        lastDetail = (await upstream.text()).slice(0, 300);
        // Only worth retrying the next model on quota/retired/bad-model errors.
        if (lastStatus === 429 || lastStatus === 404 || lastStatus === 400) continue;
        return json({ error: 'upstream_error', status: lastStatus, detail: lastDetail });
      }

      const data = (await upstream.json()) as {
        candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
      };
      const inline = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!inline?.data) return json({ error: 'empty_audio' });

      const sampleRate = sampleRateFromMime(inline.mimeType);
      const audio = pcmToWavBase64(inline.data, sampleRate);
      return json({ audio, mime: 'audio/wav' });
    } catch (e) {
      return json({ error: 'fetch_failed', detail: String(e).slice(0, 300) });
    }
  }
  return json({ error: 'upstream_error', status: lastStatus, detail: lastDetail });
}
