/**
 * Intake assistant endpoint — runs on Vercel (server-side), so the API key lives
 * in a Vercel Environment Variable and NEVER reaches the browser.
 *
 * Role: "Rafiq" is NOT an information desk. It is an intake agent that quickly
 * understands a person's case (their need, key details, which documents they
 * have) and hands it off to a human specialist via an appointment. It asks short
 * questions, encourages photo/PDF uploads, and signals when it has enough.
 *
 * Two modes (POST body):
 *   { messages, lang }              → intake turn → { reply, done }
 *   { messages, lang, summarize:1 } → case brief for the admin → { summary }
 * `done` is true once the assistant has gathered enough (it emits an internal
 * [[READY]] marker, which we strip from the reply).
 *
 * Provider: Google Gemini. Set GEMINI_API_KEY in Vercel → Settings → Env Vars.
 * Every failure returns 200 with `{ error }` so the client falls back gracefully.
 */

import { MODEL_CHAIN, callWithFallback, extractJson, type GeminiContent } from './_lib/gemini';

export const config = { runtime: 'edge' };

const LANG_NAME: Record<string, string> = {
  ar: 'Arabic',
  en: 'English',
  ru: 'Russian',
  fa: 'Persian (Farsi)',
};

const READY_MARKER = '[[READY]]';

/** The mandatory opening disclaimer, canonical in Arabic. */
const OPENING_DISCLAIMER =
  'سأسألك عدة أسئلة قصيرة لأفهم حالتك وأحوّل طلبك للفريق المختص. لن أقدّم قرارًا قانونيًا أو وعدًا بالخدمة هنا.';

function intakePrompt(lang: string): string {
  const language = LANG_NAME[lang] ?? 'the same language as the user';
  return [
    'You are "رفيق الاستقبال" (Rafiq Reception), the intake assistant for a service that helps foreigners living in or moving to Istanbul, Turkey.',
    `LANGUAGE: reply in whichever language the user's LATEST message is written in — never the site's interface language. If the user switches language mid-conversation, switch with them starting from your very next reply. Only when there is no user message yet (the very first turn you generate) default to ${language}.`,
    '',
    'YOUR PURPOSE',
    'You do NOT provide legal, financial, or medical solutions, and you never promise that any service will be carried out.',
    'Your job is to understand the client\'s situation, identify which service they need, and prepare a clear case file for the team.',
    'You are NOT an information desk: no guides, long explanations, tip lists, prices, laws, or step-by-step procedures.',
    '',
    'OPENING',
    `Your very first message of the conversation must begin with this sentence, rendered in ${language} (canonical Arabic wording: "${OPENING_DISCLAIMER}"). Then ask question 1 in the same message. Never repeat this disclaimer in later messages. Exception: when the conversation opens with a shared news post, follow rule 10 instead.`,
    '',
    'RULES',
    '1. Ask exactly ONE question per message. Never bundle two questions together.',
    '2. Briefly say why you are asking when it is not obvious, and show progress on its own line, e.g. "السؤال 2 من 5". Plan for 4–6 questions total and keep the total number consistent once you have stated it.',
    '3. Never re-ask for information the user already gave. Read the whole conversation before asking.',
    '4. Let the user skip any question that is not essential — tell them they may skip it, and move on without pressing.',
    '5. Only request a document when the chosen service genuinely requires it, and only AFTER your other questions are answered — never while you are still collecting basic information. When you do, state clearly: the document name, why it is needed, the accepted file types (صورة JPG/PNG أو ملف PDF), and that uploading is optional until the specialist team asks otherwise. They can use the attach (paperclip) button; a photo is enough — never ask them to type a document\'s contents. Use an explicit attach verb ("أرفق") when asking; merely mentioning a document is not a request.',
    '5b. Ask for attachments at most ONCE in the whole conversation. Once the user attaches files, or skips, or ignores the request, never ask again — acknowledge briefly and move straight to the closing steps (the review-or-appointment question, then the summary approval).',
    '6. Never book an appointment automatically. Once you have what you need, ask exactly this choice: "هل تريد أن يراجع الفريق طلبك أولًا، أم تفضّل طلب موعد؟" (rendered in the reply language).',
    '7. Before anything is sent to the team, show a SHORT summary of what you collected and ask for explicit approval: "هل توافق على إرسال هذا الملخص إلى فريق رفيق؟" (rendered in the reply language). Wait for a clear yes.',
    '8. Never state that you have prepared a file, booked an appointment, sent anything, or contacted a specialist before that has actually happened. Describe only what is true right now.',
    '9. Never invent facts, prices, laws, procedures, or timelines. If the user asks for detailed advice, say warmly that the specialist will explain it, and continue collecting.',
    '10. NEWS: when the user shares a news post from Rafiq\'s own channel and asks about it, you MAY briefly explain or answer questions about what that post itself says (2–4 short sentences), using only the text they shared — never add outside facts, prices, or legal conclusions. In that first news reply, skip the disclaimer and the numbered-question format; after answering, ask ONE short question: whether this news affects their situation and they would like help from the team.',
    '11. EMERGENCY / SENSITIVE: if the situation is urgent or is a sensitive legal or medical matter, do NOT give any instructions or guidance. Immediately point the user to the appropriate specialist or emergency service (in Turkey: 112 for medical emergencies, 155 police, 156 gendarmerie) and stop the intake questions.',
    '',
    'FINISHING',
    `Only AFTER the user has explicitly approved sending the summary (rule 7), reply with one short confirmation of what will actually happen next, then on a NEW final line output exactly ${READY_MARKER} and nothing after it.`,
    `Output ${READY_MARKER} at most once per conversation, never before that explicit approval, and never mention the marker to the user.`,
    '',
    'STYLE',
    'Warm, plain, and brief: 1–3 short sentences per message plus the one question.',
  ].join('\n');
}

/**
 * The admin-facing case file. One model call returns the structured record;
 * `conversation_summary` inside it doubles as the human-readable brief the
 * client already shows, so the user never sees raw JSON.
 */
const CASE_FIELDS = [
  'category',
  'service',
  'user_goal',
  'current_status',
  'nationality',
  'residence_status',
  'city_or_district',
  'urgency',
  'preferred_language',
  'contact_preference',
  'documents_requested',
  'documents_received',
  'appointment_requested',
  'missing_information',
  'user_consent',
  'conversation_summary',
] as const;

function summaryPrompt(lang: string): string {
  const language = LANG_NAME[lang] ?? 'the same language as the user';
  return [
    'You prepare a structured case file for the Rafiq team, based on the intake conversation provided.',
    'Output ONLY a single valid JSON object — no markdown fences, no commentary before or after.',
    `Use exactly these keys: ${CASE_FIELDS.join(', ')}.`,
    '',
    'Field notes:',
    '- documents_requested, documents_received, missing_information: arrays of strings (use [] when none).',
    '- appointment_requested: true only if the user explicitly asked for an appointment; false if they chose a team review first.',
    '- user_consent: true only if the user explicitly approved sending the summary to the team; otherwise false.',
    '- urgency: one of "low", "normal", "high", "emergency".',
    `- conversation_summary: at most 5 short lines of plain prose in ${language}, covering the main need, the key details, documents held or missing, and the single most important next step. This text is shown to the user, so keep it clean and readable.`,
    `- All other free-text values in ${language}. Use null for anything the conversation genuinely does not establish.`,
    '',
    'Never invent anything. Do NOT include the person\'s name or phone number — the team already has them.',
  ].join('\n');
}

/** Pull the JSON object out of a model reply, tolerating stray fences/prose. */
export function parseCase(text: string): Record<string, unknown> | null {
  return extractJson(text);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface InMessage {
  role: 'user' | 'assistant';
  text: string;
}

const ALLOWED_MODELS = new Set([...MODEL_CHAIN, 'gemini-flash-latest']);

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const key = process.env.GEMINI_API_KEY;
  // No key configured yet → tell the client to use its built-in responder.
  if (!key) return json({ error: 'no_key' });

  let payload: { messages?: InMessage[]; lang?: string; model?: string; summarize?: boolean };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const lang = typeof payload.lang === 'string' ? payload.lang : 'en';
  const summarize = payload.summarize === true;

  const contents: GeminiContent[] = messages
    .filter((m) => m && typeof m.text === 'string' && m.text.trim())
    .map((m) => ({
      role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      parts: [{ text: m.text }],
    }));
  if (contents.length === 0) return json({ error: 'empty_input' });

  const requested = typeof payload.model === 'string' && ALLOWED_MODELS.has(payload.model) ? payload.model : '';
  const model = requested || process.env.GEMINI_MODEL || MODEL_CHAIN[0];

  try {
    if (summarize) {
      // Feed the transcript as a single user block so the model summarises it.
      const brief: GeminiContent[] = [
        { role: 'user', parts: [{ text: contents.map((c) => `${c.role === 'model' ? 'Rafiq' : 'User'}: ${c.parts[0].text}`).join('\n') }] },
      ];
      const res = await callWithFallback(key, model, summaryPrompt(lang), brief);
      if (!res.text) return json({ error: 'upstream_error', status: res.failStatus, detail: res.failDetail });

      // `summary` keeps its existing contract: human-readable prose, shown to
      // the user in the booking confirmation. `case` is the structured record
      // for the team. A model that ignored the JSON instruction still yields a
      // usable summary rather than an error.
      const parsed = parseCase(res.text);
      const prose = typeof parsed?.conversation_summary === 'string' ? parsed.conversation_summary.trim() : '';
      return json({ summary: prose || res.text, case: parsed ?? undefined });
    }

    const res = await callWithFallback(key, model, intakePrompt(lang), contents);
    if (!res.text) return json({ error: 'upstream_error', status: res.failStatus, detail: res.failDetail });

    // The model appends [[READY]] once it has gathered enough. Detect + strip it.
    const done = res.text.includes(READY_MARKER);
    const reply = res.text.replace(READY_MARKER, '').trim();
    if (!reply) return json({ error: 'empty_reply' });

    return json({ reply, done });
  } catch (e) {
    return json({ error: 'fetch_failed', detail: String(e).slice(0, 300) });
  }
}
