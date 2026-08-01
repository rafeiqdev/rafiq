/**
 * Shared Gemini call helpers for the Vercel edge functions (api/ai-chat.ts,
 * api/cron/telegram-sync.ts). One `generateContent` request shape, one model
 * fallback chain — kept in one place so both endpoints degrade the same way
 * when a model is rate-limited (429) or retired (404).
 */

export interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface GeminiResult {
  text: string;
  /** set when the call failed (text is '' then) */
  failStatus?: number;
  failDetail?: string;
}

// Free-tier quotas differ a LOT per model (the flagship flash allows only ~20
// requests/day; the lite models allow 1000+). So we DEFAULT to a lite model and
// fall through this chain whenever one is rate-limited (429) or retired (404).
export const MODEL_CHAIN = [
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
];

/** One Gemini generateContent call. Never throws on HTTP errors. */
export async function callGemini(key: string, model: string, systemText: string, contents: GeminiContent[]): Promise<GeminiResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const upstream = await fetch(url, {
    method: 'POST',
    // The key goes in the x-goog-api-key header — the method Google recommends
    // and the one that works for the new "AQ." auth-key format (Jul 2026).
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents,
      generationConfig: {
        temperature: 0.6,
        // Generous cap so the answer is never cut short. Gemini 3.x "thinking"
        // tokens also count against this limit, so keep it comfortably high.
        maxOutputTokens: 2048,
        // Practical intake, not puzzles — turn thinking off for faster, cheaper,
        // complete replies. (Ignored by models without it.)
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  if (!upstream.ok) return { text: '', failStatus: upstream.status, failDetail: (await upstream.text()).slice(0, 500) };
  const data = (await upstream.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text ?? '').join('').trim() ?? '';
  return { text };
}

/** Try the preferred model, then walk the chain past quota/retirement errors. */
export async function callWithFallback(key: string, preferred: string, systemText: string, contents: GeminiContent[]): Promise<GeminiResult> {
  const chain = [preferred, ...MODEL_CHAIN.filter((m) => m !== preferred)];
  let last: GeminiResult = { text: '', failStatus: 500, failDetail: 'no_models' };
  for (const model of chain) {
    last = await callGemini(key, model, systemText, contents);
    if (last.text) return last;
    // only quota (429) and gone-model (404/400) errors are worth retrying
    if (last.failStatus !== 429 && last.failStatus !== 404 && last.failStatus !== 400) return last;
  }
  return last;
}

/** Pull the first JSON object out of a model reply, tolerating stray fences/prose. */
export function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(fenced.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
