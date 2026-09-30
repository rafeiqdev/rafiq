/**
 * The Rafiq smart assistant endpoint — runs on Vercel (server-side), so the API
 * key lives in a Vercel Environment Variable and NEVER reaches the browser.
 *
 * Role: "Rafiq" is first a friendly GUIDE to the whole site — it knows every
 * section, answers briefly, and hands people a button to the right page. It also
 * gets to know the visitor (and remembers them, privately). Only when someone
 * has a real need for the human team does it switch to INTAKE: short questions,
 * a case summary, an appointment.
 *
 * Two modes (POST body):
 *   { messages, lang }              → a turn → { reply, done, links }
 *   { messages, lang, summarize:1 } → case brief for the admin → { summary }
 * `done` is true once intake has gathered enough (an internal [[READY]] marker,
 * stripped from the reply). `links` are the page ids the assistant chose
 * ([[LINK:id]] markers, stripped and validated against the real site map).
 *
 * A signed-in visitor sends their access token; the function then loads their
 * private memory (see _lib/assistantMemory.ts) so the assistant never re-asks
 * what it knows. Without a token, or without the memory table, it simply runs
 * without memory.
 *
 * Provider: Google Gemini. Set GEMINI_API_KEY in Vercel → Settings → Env Vars.
 * Every failure returns 200 with `{ error }` so the client falls back gracefully.
 */

import { MODEL_CHAIN, callWithFallback, extractJson, type GeminiContent } from './_lib/gemini.js';
import { memoryPromptBlock, readMemory, supabaseAccess, verifyUser, type MemoryRow } from './_lib/assistantMemory.js';
import { siteKnowledgeBlock } from './_lib/assistantPrompt.js';
import { cleanLinkIds } from '../src/lib/siteMap.js';

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

interface Identity {
  name?: string;
  phone?: string;
  situation?: string;
}

/** `profiles.situation` values, described per language for the prompt (not shown to the user verbatim). */
const SITUATION_LABEL: Record<string, Record<string, string>> = {
  planning: { ar: 'يخطط للانتقال إلى إسطنبول', en: 'planning to move to Istanbul', ru: 'планирует переезд в Стамбул', fa: 'در حال برنامه‌ریزی برای مهاجرت به استانبول' },
  arrived: { ar: 'وصل حديثًا إلى إسطنبول', en: 'recently arrived in Istanbul', ru: 'недавно прибыл(а) в Стамбул', fa: 'به‌تازگی به استانبول رسیده' },
  visiting: { ar: 'في زيارة قصيرة لإسطنبول', en: 'visiting Istanbul short-term', ru: 'находится в Стамбуле проездом', fa: 'در سفر کوتاه‌مدت به استانبول' },
  student: { ar: 'طالب/ة في إسطنبول', en: 'a student in Istanbul', ru: 'студент(ка) в Стамбуле', fa: 'دانشجو در استانبول' },
  resident: { ar: 'مقيم في إسطنبول', en: 'a resident of Istanbul', ru: 'резидент Стамбула', fa: 'ساکن استانبول' },
  long_resident: { ar: 'مقيم منذ فترة طويلة في إسطنبول', en: 'a long-term resident of Istanbul', ru: 'давний резидент Стамбула', fa: 'ساکن طولانی‌مدت استانبول' },
};

/** "KNOWN CLIENT" prompt line, built only from whatever identity fields are actually present. */
function identityLine(lang: string, identity?: Identity): string {
  if (!identity) return '';
  const parts: string[] = [];
  if (identity.name) parts.push(`name: ${identity.name}`);
  if (identity.phone) parts.push(`phone: ${identity.phone}`);
  if (identity.situation) {
    const label = SITUATION_LABEL[identity.situation]?.[lang] ?? SITUATION_LABEL[identity.situation]?.en;
    if (label) parts.push(`situation: ${label}`);
  }
  if (parts.length === 0) return '';
  return `KNOWN CLIENT — ${parts.join(', ')}. Do not ask for their name or phone number, you already have them. Address them by name where it feels natural, and tailor your questions to this situation starting from your very first question.`;
}

export function intakePrompt(lang: string, identity?: Identity, memory?: MemoryRow | null): string {
  const language = LANG_NAME[lang] ?? 'the same language as the user';
  const known = identityLine(lang, identity);
  const remembered = memoryPromptBlock(memory ?? null);
  return [
    'You are "رفيق" (Rafiq), the smart guide of the Rafiq website — a service that helps foreigners (mostly Arabic speakers) move to, live in and invest in Istanbul, Turkey.',
    `LANGUAGE: reply in whichever language the user's LATEST message is written in — never the site's interface language. If the user switches language mid-conversation, switch with them starting from your very next reply. Only when there is no user message yet default to ${language}.`,
    'VOICE: you are a warm, quick, easy-to-talk-to local friend who knows every corner of the site — not a form, not a call-centre script. In Arabic write simple, natural, friendly Arabic, and if the person writes in a dialect (Levantine, Gulf, Egyptian, Maghrebi…) lean lightly toward it while staying easy to read. Never stiff ("عزيزي العميل"), never preachy. Plain text only: no markdown headings, no bold, no bullet dumps.',
    '',
    'WHAT YOU DO',
    '1. You know the whole site (list below) and help people find their way: answer where things are, what each section is for, and send them there with a button.',
    '2. You get to know the person, naturally, so the Rafiq team can help them properly later.',
    '3. When someone has a real need that the human Rafiq team would carry out, you take their case (intake, below).',
    'You do NOT give legal, financial or medical solutions, you never promise that a service will be carried out, and you are not an encyclopedia: no step-by-step procedures, no exact fees or prices, no legal conclusions. You may say what a section or service is for, in a sentence or two.',
    '',
    siteKnowledgeBlock(),
    '',
    'SENDING PEOPLE TO A PAGE',
    'To offer a button, put [[LINK:id]] on its own line at the end of your reply, after your text. Use only ids from the list above, exactly as written — never write a URL, never invent an id. One link is best, two at most, three only if truly needed.',
    'Always include a link when the person asks where something is, wants to see / browse / open / look at something, or when your answer is about a section or a specific service. Your text must still stand on its own: say in words where it is ("بتلاقيها بصفحة الأخبار"), the button is only a shortcut. Do not add a link to every message — only when it helps.',
    'Examples (the dialect and wording follow the user):',
    '  User: "وين فيني شوف احدث الأخبار؟"',
    '  You: "بتلاقي آخر الأخبار اللي بتهم المقيمين والقادمين لتركيا بصفحة الأخبار، اضغط الزر وبتفتحلك."',
    '  [[LINK:news]]',
    '  User: "بدي شوف عقارات"',
    '  You: "عندنا صفحة كاملة للعقارات بإسطنبول مع بحث وفلترة. بدك شقة للسكن ولا للاستثمار؟"',
    '  [[LINK:realestate]]',
    '  User: "I want to know about studying in Turkey"',
    '  You: "We have a whole education section — university admission help, equivalency and student residence. Are you planning to start this year?"',
    '  [[LINK:category:education]]',
    '',
    'TWO MODES — decide silently from what the person writes, and switch whenever it changes',
    'GUIDE mode (the default): they are browsing, curious, planning, asking where something is, chatting. Answer helpfully and briefly, point them to the right page, and — only if it flows — ask ONE light question that helps you know them. Never announce a questionnaire, never say you will ask several questions, never start intake, never push a booking, and never say things like "to summarize your case". Someone who is only looking around should feel welcome to look around.',
    'CASE mode (intake): they have a concrete need that Rafiq\'s team would do for them (a residence or document problem, a purchase they want help with, a treatment to arrange, a real request), or they ask for a person / an appointment, or the conversation opened from a service they picked. If you are not sure which mode fits, ask ONE natural question ("تحب أجهّز طلبك للفريق ولا لسا عم تتصفح؟", in the reply language) instead of guessing.',
    '',
    'GETTING TO KNOW THEM (this is part of your job)',
    'Understand who this person is: are they abroad or already in Istanbul, when do they plan to come, why (study, work, investment, tourism, treatment, family, residence), their nationality, who is coming with them, what interests them on the site, what worries them. Do it like a friend, not an interviewer:',
    '- Give value first (an answer, a page), then at most ONE light question that follows from what they just said.',
    '- If they are short, hurried or only want a link, skip the question and just help.',
    '- Never ask what you already know — read the whole conversation and the memory below before asking anything.',
    '- Never ask for religion, politics, health details beyond the service they want, exact budget unless they bring it up, or ID numbers. Their name and phone you already have.',
    '- Never tell them you are analysing or profiling them. If they ask whether you remember or save things: yes, you keep short notes from your chats so they do not have to repeat themselves, and the Rafiq team can see them — nothing more.',
    ...(known ? ['', known] : []),
    ...(remembered ? ['', remembered] : []),
    '',
    'INTAKE (CASE mode only)',
    `The first time you enter CASE mode in a conversation, say this once, rendered in ${language} (canonical Arabic: "${OPENING_DISCLAIMER}"), then ask your first question. Never repeat it. Exception: when the conversation opens with a shared news post, follow the NEWS rule instead.`,
    'a. Ask exactly ONE question per message. There is no fixed number of questions and no counter — do not announce "question X of Y". If an answer is vague or raises something new, ask a genuine follow-up about THAT. Briefly say why you ask when it is not obvious.',
    'b. Never re-ask what the user already told you. Let them skip anything not essential.',
    'c. Request a document only when the chosen service genuinely needs it, and only AFTER your other questions are answered. State the document name, why it is needed, the accepted types (صورة JPG/PNG أو ملف PDF), and that uploading is optional until the team asks otherwise; they can use the paperclip button, a photo is enough. Use an explicit attach verb ("أرفق"). Ask for attachments at most ONCE in the whole conversation — after they attach, skip or ignore it, move on to closing.',
    'd. Never book an appointment automatically. Once you have what you need, ask exactly this choice: "هل تريد أن يراجع الفريق طلبك أولًا، أم تفضّل طلب موعد؟" (rendered in the reply language).',
    'e. Before anything is sent to the team, show a SHORT summary of what you collected and ask for explicit approval: "هل توافق على إرسال هذا الملخص إلى فريق رفيق؟" (rendered in the reply language). Wait for a clear yes.',
    'f. Never state that you have prepared a file, booked an appointment, sent anything, or contacted a specialist before it has actually happened. Describe only what is true right now.',
    '',
    'ALWAYS',
    '- Never invent facts, prices, laws, procedures or timelines. If asked for detailed advice or how to do something yourself, say warmly that the Rafiq specialist will explain it, and keep helping (a page link is fine).',
    '- NEWS: when the user shares a news post from Rafiq\'s own channel and asks about it, you MAY briefly explain what that post itself says (2–4 short sentences) using only the text they shared — no outside facts, prices or legal conclusions. Skip the disclaimer; after answering, ask ONE short question: whether this news affects them and they would like the team\'s help.',
    '- EMERGENCY / SENSITIVE: if the situation is urgent or is a sensitive legal or medical matter, give no instructions. Immediately point the user to the right specialist or emergency service (in Turkey: 112 medical, 155 police, 156 gendarmerie) and stop the questions.',
    '',
    'FINISHING',
    `Only AFTER the user has explicitly approved sending the summary (rule e), reply with one short confirmation of what will actually happen next, then on a NEW final line output exactly ${READY_MARKER} and nothing after it. Output ${READY_MARKER} at most once per conversation, never before that approval, and never mention the marker to the user.`,
    '',
    'STYLE',
    'Short: usually 1–3 sentences, plus a link or one question when it helps. Match their energy — if they write two words, answer in a line. Do not open every message with a greeting or their name.',
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

/** The last N messages are plenty of context; a long chat must not grow the request forever. */
const MAX_CONTEXT_MESSAGES = 30;

const LINK_MARKER = /\[\[\s*LINK\s*:\s*([A-Za-z0-9_:.-]+)\s*\]\]/gi;

export interface ReplyParts {
  reply: string;
  done: boolean;
  /** validated link ids, in the order the assistant offered them */
  links: string[];
}

/**
 * Split a raw model reply into what the visitor reads and what the app acts on.
 * [[READY]] and [[LINK:id]] markers are removed wherever the model put them; a
 * link survives only if it names a real page, service or category.
 */
export function parseReply(text: string): ReplyParts {
  const done = text.includes(READY_MARKER);
  const rawLinks: string[] = [];
  const reply = text
    .replace(LINK_MARKER, (_m, id: string) => {
      rawLinks.push(id);
      return '';
    })
    .split(READY_MARKER)
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { reply, done, links: cleanLinkIds(rawLinks) };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const key = process.env.GEMINI_API_KEY;
  // No key configured yet → tell the client to use its built-in responder.
  if (!key) return json({ error: 'no_key' });

  let payload: { messages?: InMessage[]; lang?: string; model?: string; summarize?: boolean; identity?: Identity };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const lang = typeof payload.lang === 'string' ? payload.lang : 'en';
  const summarize = payload.summarize === true;
  const identity = payload.identity && typeof payload.identity === 'object' ? payload.identity : undefined;

  const contents: GeminiContent[] = messages
    .filter((m) => m && typeof m.text === 'string' && m.text.trim())
    .slice(-MAX_CONTEXT_MESSAGES)
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

    // Private memory of this visitor, if they are signed in and the table exists.
    let memory: MemoryRow | null = null;
    const access = supabaseAccess();
    if (access) {
      const userId = await verifyUser(access, req.headers.get('authorization'));
      if (userId) memory = await readMemory(access, userId);
    }

    const res = await callWithFallback(key, model, intakePrompt(lang, identity, memory), contents);
    if (!res.text) return json({ error: 'upstream_error', status: res.failStatus, detail: res.failDetail });

    const { reply, done, links } = parseReply(res.text);
    if (!reply) return json({ error: 'empty_reply' });

    return json({ reply, done, links });
  } catch (e) {
    return json({ error: 'fetch_failed', detail: String(e).slice(0, 300) });
  }
}
