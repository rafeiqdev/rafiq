/**
 * Learning endpoint — after each visitor turn the chat page posts the recent
 * conversation here, and a second model call updates the visitor's private
 * memory (what they told us + how they communicate). The visitor never sees the
 * result; the admin reads it from the Users tab.
 *
 * POST { messages, lang }   Authorization: Bearer <visitor access token>
 *   → { ok: true }                       memory updated
 *   → { ok: true, skipped: 'recent' }    analysed moments ago, nothing to do
 *   → { error }                          anything else — always HTTP 200/401, never
 *                                        a failure the visitor could notice
 *
 * It is deliberately separate from /api/ai-chat: a slow or failing analysis
 * must never delay or break a reply.
 */

import { MODEL_CHAIN, callWithFallback, type GeminiContent } from './_lib/gemini.js';
import {
  analystPrompt,
  mergeMemory,
  parseAnalysis,
  readMemory,
  supabaseAccess,
  verifyUser,
  writeMemory,
} from './_lib/assistantMemory.js';

export const config = { runtime: 'edge' };

/** Enough recent turns to read tone and context; older ones are already in the memory. */
const MAX_MESSAGES = 14;
/** Two analyses inside this window are the same burst of typing — skip the second. */
const MIN_GAP_MS = 12_000;
/** Cap per message so one pasted essay cannot run up the bill. */
const MAX_CHARS = 1200;

interface InMessage {
  role: 'user' | 'assistant';
  text: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: 'no_key' });

  const access = supabaseAccess();
  if (!access) return json({ error: 'no_memory_store' });

  const userId = await verifyUser(access, req.headers.get('authorization'));
  if (!userId) return json({ error: 'unauthorized' }, 401);

  let payload: { messages?: InMessage[] };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const messages = (Array.isArray(payload.messages) ? payload.messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text.trim())
    .slice(-MAX_MESSAGES);
  if (!messages.some((m) => m.role === 'user')) return json({ error: 'empty_input' });

  const prev = await readMemory(access, userId);
  if (prev?.last_analyzed_at && Date.now() - Date.parse(prev.last_analyzed_at) < MIN_GAP_MS) {
    return json({ ok: true, skipped: 'recent' });
  }

  const transcript = messages
    .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'Visitor'}: ${m.text.slice(0, MAX_CHARS)}`)
    .join('\n');
  const contents: GeminiContent[] = [
    {
      role: 'user',
      parts: [{ text: `Conversation so far (oldest first). Judge the visitor's style ONLY from the "Visitor:" lines.\n\n${transcript}` }],
    },
  ];

  try {
    const model = process.env.GEMINI_MODEL || MODEL_CHAIN[0];
    const res = await callWithFallback(key, model, analystPrompt(prev), contents, { json: true, temperature: 0.2, maxOutputTokens: 1500 });
    if (!res.text) return json({ error: 'upstream_error', status: res.failStatus });

    const analysis = parseAnalysis(res.text);
    if (!analysis) return json({ error: 'unparseable' });

    const saved = await writeMemory(access, userId, mergeMemory(prev, analysis.facts, analysis.style));
    return json(saved ? { ok: true } : { error: 'store_failed' });
  } catch (e) {
    return json({ error: 'fetch_failed', detail: String(e).slice(0, 200) });
  }
}
