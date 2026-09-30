/**
 * The assistant's private memory of each signed-in visitor.
 *
 * Two kinds of knowledge, both stored in public.assistant_memory and readable
 * only by the server (service role) and by admins — never by the visitor:
 *
 *   facts  what the person told us: who they are, where they are in the move to
 *          Turkey, what they want, what they asked about.
 *   style  how they communicate in the chat (hurried, anxious, chatty, only
 *          passing time…) and how serious they look, for the admin to read.
 *
 * The style read is built on published work on language and behaviour:
 *   - function words (pronouns, hedges, certainty words) say HOW a person is
 *     communicating and feeling, while content words say what they talk about
 *     (Pennebaker / LIWC);
 *   - purchase-intent research on live chat (Good et al., 2025, "MINITS"):
 *     mode of contact, immediacy, stated need, interest, time spent and
 *     specificity separate people who will act from people who are browsing;
 *   - the four social styles (driver, analytical, expressive, amiable), which
 *     read as short-and-direct, precise-and-sceptical, fast-and-enthusiastic,
 *     warm-and-slow.
 * It describes behaviour in THIS conversation with a confidence level — it is
 * never a diagnosis, and it never infers health, religion, ethnicity, politics
 * or anything else sensitive.
 *
 * Every function here degrades to "no memory": if the table is missing (the
 * migration is pasted by hand) or Supabase is unreachable, the chat carries on
 * exactly as it did before memory existed.
 */

import { extractJson } from './gemini.js';

// ---------- types ------------------------------------------------------------

import {
  CONFIDENCES,
  DETAIL_PREFS,
  MESSAGE_LENGTHS,
  SERIOUSNESS,
  SOCIAL_STYLES,
  TEMPOS,
  TONE_TAGS,
  URGENCIES,
  VISITOR_TYPES,
  type MemoryFacts,
  type MemoryStyle,
} from '../../src/lib/assistantMemoryTypes.js';

export interface MemoryRow {
  facts: MemoryFacts;
  style: MemoryStyle;
  message_count: number;
  last_analyzed_at: string | null;
}

// ---------- environment + Supabase access -----------------------------------

function env(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  return undefined;
}

export interface SupabaseAccess {
  url: string;
  serviceKey: string;
}

/** Returns null when the server is not configured for memory (no service key). */
export function supabaseAccess(): SupabaseAccess | null {
  const url = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  return url && serviceKey ? { url, serviceKey } : null;
}

/**
 * Who is calling? Verifies the visitor's access token with Supabase Auth and
 * returns their user id. Null for a missing, malformed or expired token — the
 * caller then simply runs without memory.
 */
export async function verifyUser(access: SupabaseAccess, authHeader: string | null): Promise<string | null> {
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return null;
  try {
    const res = await fetch(`${access.url}/auth/v1/user`, {
      headers: { apikey: access.serviceKey, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string };
    return typeof user?.id === 'string' && /^[0-9a-f-]{36}$/i.test(user.id) ? user.id : null;
  } catch {
    return null;
  }
}

function restHeaders(access: SupabaseAccess, extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: access.serviceKey, Authorization: `Bearer ${access.serviceKey}`, ...extra };
}

/** The stored memory, or null when there is none yet / the table is missing. */
export async function readMemory(access: SupabaseAccess, userId: string): Promise<MemoryRow | null> {
  try {
    const res = await fetch(
      `${access.url}/rest/v1/assistant_memory?user_id=eq.${encodeURIComponent(userId)}&select=facts,style,message_count,last_analyzed_at`,
      { headers: restHeaders(access) },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Partial<MemoryRow>[];
    const row = rows[0];
    if (!row) return null;
    return {
      facts: isPlainObject(row.facts) ? (row.facts as MemoryFacts) : {},
      style: isPlainObject(row.style) ? (row.style as MemoryStyle) : {},
      message_count: typeof row.message_count === 'number' ? row.message_count : 0,
      last_analyzed_at: typeof row.last_analyzed_at === 'string' ? row.last_analyzed_at : null,
    };
  } catch {
    return null;
  }
}

export async function writeMemory(access: SupabaseAccess, userId: string, row: MemoryRow): Promise<boolean> {
  try {
    const res = await fetch(`${access.url}/rest/v1/assistant_memory?on_conflict=user_id`, {
      method: 'POST',
      headers: restHeaders(access, { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({
        user_id: userId,
        facts: row.facts,
        style: row.style,
        message_count: row.message_count,
        last_analyzed_at: row.last_analyzed_at,
        updated_at: new Date().toISOString(),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------- sanitising model output -----------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function clip(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : undefined;
}

function clipList(v: unknown, maxItems: number, maxLen: number): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const x of v) {
    const t = clip(x, maxLen);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= maxItems) break;
  }
  return out;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

/**
 * Words that mean the model strayed into sensitive territory. The analyst is
 * told not to go there; this is the belt to that pair of braces — a free-text
 * field mentioning any of these is dropped, not stored.
 */
const SENSITIVE_AR = [
  'دين', 'الدين', 'مسلم', 'مسلمه', 'مسيحي', 'مسيحيه', 'يهودي', 'ملحد', 'طايفه', 'طائفه', 'مذهب', 'سني', 'شيعي', 'علماني',
  'سياسه', 'سياسي', 'حزب', 'انتخابات', 'مثلي', 'مثليه', 'ميول جنسيه', 'اكتئاب', 'انتحار', 'مرض نفسي', 'اضطراب نفسي',
];
const SENSITIVE_OTHER =
  /(?<![\p{L}\p{N}])(?:religio\p{L}*|muslim|christian|jewish|atheis\p{L}*|politic\p{L}*|vote|sexual orientation|gay|lesbian|depress\p{L}*|suicid\p{L}*|mental (?:health|illness)|diagnos\p{L}*|ethnic\p{L}*|racial|религи\p{L}*|политик\p{L}*|депресс\p{L}*|суицид\p{L}*|этнич\p{L}*)(?![\p{L}\p{N}])/iu;

/** Whole-word only: "مدينة" (city) must not trip on "دين" (religion). */
function isSensitive(text: string): boolean {
  if (SENSITIVE_OTHER.test(text)) return true;
  const plain = text
    .replace(/[ً-ٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
  return SENSITIVE_AR.some((w) => new RegExp(`(?<![\\u0600-\\u06FF])(?:ال)?${w}(?![\\u0600-\\u06FF])`, 'u').test(plain));
}

function safeText(v: unknown, max: number): string | undefined {
  const t = clip(v, max);
  return t && !isSensitive(t) ? t : undefined;
}

function safeList(v: unknown, maxItems: number, maxLen: number): string[] | undefined {
  const list = clipList(v, maxItems, maxLen);
  return list?.filter((t) => !isSensitive(t));
}

export function sanitizeFacts(raw: unknown): MemoryFacts {
  if (!isPlainObject(raw)) return {};
  const f: MemoryFacts = {};
  const visitor = oneOf(raw.visitor_type, VISITOR_TYPES);
  if (visitor) f.visitor_type = visitor;
  const summary = safeText(raw.summary, 400);
  if (summary) f.summary = summary;
  for (const key of ['nationality', 'current_city', 'arrival_timeframe', 'purpose', 'family', 'budget_note', 'next_best_action'] as const) {
    const v = safeText(raw[key], 160);
    if (v) f[key] = v;
  }
  if (typeof raw.in_turkey_now === 'boolean') f.in_turkey_now = raw.in_turkey_now;
  const languages = safeList(raw.languages, 6, 30);
  if (languages?.length) f.languages = languages;
  const interests = safeList(raw.interests, 10, 60);
  if (interests?.length) f.interests = interests;
  const services = safeList(raw.services_of_interest, 10, 60);
  if (services?.length) f.services_of_interest = services;
  const open = safeList(raw.open_questions, 6, 140);
  if (open?.length) f.open_questions = open;
  const notes = safeList(raw.notes, 12, 160);
  if (notes?.length) f.notes = notes;
  return f;
}

export function sanitizeStyle(raw: unknown): MemoryStyle {
  if (!isPlainObject(raw)) return {};
  const s: MemoryStyle = {};
  const tempo = oneOf(raw.tempo, TEMPOS);
  if (tempo) s.tempo = tempo;
  const urgency = oneOf(raw.urgency, URGENCIES);
  if (urgency) s.urgency = urgency;
  const len = oneOf(raw.message_length, MESSAGE_LENGTHS);
  if (len) s.message_length = len;
  const social = oneOf(raw.social_style, SOCIAL_STYLES);
  if (social) s.social_style = social;
  const serious = oneOf(raw.seriousness, SERIOUSNESS);
  if (serious) s.seriousness = serious;
  const detail = oneOf(raw.detail_preference, DETAIL_PREFS);
  if (detail) s.detail_preference = detail;
  const conf = oneOf(raw.confidence, CONFIDENCES);
  if (conf) s.confidence = conf;
  if (Array.isArray(raw.tone)) {
    const tone = raw.tone.filter((t): t is (typeof TONE_TAGS)[number] => (TONE_TAGS as readonly string[]).includes(t as string));
    if (tone.length) s.tone = [...new Set(tone)].slice(0, 4);
  }
  if (typeof raw.intent_score === 'number' && Number.isFinite(raw.intent_score)) {
    s.intent_score = Math.max(0, Math.min(100, Math.round(raw.intent_score)));
  }
  const signals = safeList(raw.signals, 6, 140);
  if (signals?.length) s.signals = signals;
  const how = safeText(raw.how_to_talk, 300);
  if (how) s.how_to_talk = how;
  return s;
}

/**
 * New knowledge wins over old, but a field the analyst left out keeps its old
 * value — a turn that says nothing about the city must not wipe the city.
 * Lists are replaced wholesale: the analyst sees the old list and returns the
 * complete, updated one.
 */
export function mergeMemory(prev: MemoryRow | null, nextFacts: MemoryFacts, nextStyle: MemoryStyle): MemoryRow {
  return {
    facts: { ...(prev?.facts ?? {}), ...nextFacts },
    style: { ...(prev?.style ?? {}), ...nextStyle },
    // One analysis per visitor turn, so this counts how many turns we have read.
    message_count: (prev?.message_count ?? 0) + 1,
    last_analyzed_at: new Date().toISOString(),
  };
}

// ---------- prompt blocks for the chat model --------------------------------

/**
 * What the chat assistant is told about a returning visitor. It is context for
 * the assistant's own thinking: it must use it to skip questions it already
 * has the answer to and to sound like it knows the person, but never to recite
 * it back like a file, and never to reveal the style read.
 */
export function memoryPromptBlock(mem: MemoryRow | null): string {
  if (!mem) return '';
  const f = mem.facts;
  const lines: string[] = [];
  const add = (label: string, v: string | string[] | boolean | undefined) => {
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return;
    lines.push(`- ${label}: ${Array.isArray(v) ? v.join('; ') : String(v)}`);
  };
  add('Stage', f.visitor_type);
  add('Summary', f.summary);
  add('Nationality', f.nationality);
  add('City', f.current_city);
  add('Already in Turkey', f.in_turkey_now);
  add('Arrival timeframe', f.arrival_timeframe);
  add('Purpose', f.purpose);
  add('Family', f.family);
  add('Interests', f.interests);
  add('Services of interest', f.services_of_interest);
  add('Questions they asked that are still open', f.open_questions);
  add('Other notes', f.notes);
  const hint = styleHint(mem.style);
  if (lines.length === 0 && !hint) return '';
  return [
    'WHAT YOU REMEMBER ABOUT THIS PERSON (private memory from earlier chats — use it so you never re-ask what you already know and so you sound like you know them; never read it back like a file, and never mention that you keep notes):',
    ...lines,
    ...(hint ? ['', hint] : []),
  ].join('\n');
}

/** A short instruction on HOW to talk to this person — never shown to them. */
export function styleHint(style: MemoryStyle): string {
  const parts: string[] = [];
  if (style.tempo === 'hurried' || style.urgency === 'high' || style.urgency === 'critical' || style.message_length === 'very_short') {
    parts.push('They are in a hurry: answer in one or two short sentences, lead with the answer, no small talk.');
  }
  if (style.tone?.includes('anxious') || style.tone?.includes('pressured') || style.tone?.includes('frustrated')) {
    parts.push('They sound tense: acknowledge that briefly and calmly, then give the clearest next step.');
  }
  if (style.social_style === 'analytical' || style.detail_preference === 'detailed') {
    parts.push('They like precision: be specific and orderly, and answer exactly what was asked.');
  }
  if (style.social_style === 'expressive' || style.tone?.includes('chatty') || style.tone?.includes('playful')) {
    parts.push('They are sociable and chatty: a warmer, lighter tone is welcome.');
  }
  if (style.social_style === 'amiable') {
    parts.push('They respond to warmth and reassurance: be gentle and patient, no pressure.');
  }
  if (style.seriousness === 'passing_time' || style.seriousness === 'low') {
    parts.push('They are mostly browsing or passing time: stay light, never push a form or a booking, just make the site easy to explore.');
  }
  return parts.length ? `HOW TO TALK TO THEM (from how they write; never mention this): ${parts.join(' ')}` : '';
}

// ---------- the analyst ------------------------------------------------------

/** The prompt for the second model call that updates the memory after a turn. */
export function analystPrompt(prev: MemoryRow | null): string {
  return [
    'You are the private analyst behind a chat assistant for Rafiq, a service that helps foreigners move to and live in Istanbul, Turkey.',
    'You read a conversation between the assistant and a visitor and update two records about the visitor. The visitor never sees these records; the Rafiq admin does.',
    'Output ONLY a single valid JSON object — no markdown fences, no commentary — with exactly two keys: "facts" and "style".',
    '',
    '1) "facts" — what the visitor has actually told us. Keys (omit or use null when unknown, NEVER guess):',
    `   visitor_type: one of ${VISITOR_TYPES.join(' | ')} — just_browsing (looking around, no stated goal), exploring (curious about a topic), planning_move (intends to come to Turkey), needs_service (has a concrete need we can serve), ready_to_act (wants to start now).`,
    '   summary: 1–2 short lines, plain prose, in Arabic, saying who this is and what they want.',
    '   nationality, current_city, arrival_timeframe (e.g. "بعد شهرين"), purpose (study / work / investment / tourism / medical / family / residency …), family (e.g. "مع زوجته وطفلين"), budget_note (only if they volunteered it), next_best_action (what the Rafiq team should do next, one line).',
    '   in_turkey_now: true / false only when clearly stated. languages: array. interests: array of short topics or site sections. services_of_interest: array of short service names. open_questions: array of things they asked that were not fully settled. notes: array of other useful, explicitly stated details (max 12 items).',
    '   Keep every earlier fact unless the visitor contradicts it. Return the complete, updated lists.',
    '',
    '2) "style" — HOW the visitor communicates in this chat, for the admin. Read behaviour, not character:',
    `   tempo: ${TEMPOS.join(' | ')}. urgency: ${URGENCIES.join(' | ')}. message_length: ${MESSAGE_LENGTHS.join(' | ')}. seriousness: ${SERIOUSNESS.join(' | ')} (passing_time = just chatting or killing time). detail_preference: ${DETAIL_PREFS.join(' | ')}.`,
    `   social_style: ${SOCIAL_STYLES.join(' | ')} — driver (short, direct, wants the answer now), analytical (precise, many detailed questions, sceptical tone), expressive (fast, enthusiastic, big-picture, chatty), amiable (warm, slow, needs reassurance).`,
    `   tone: up to 4 of ${TONE_TAGS.join(' | ')}.`,
    '   intent_score: 0–100, how likely this person is to actually use a Rafiq service soon. Raise it for: a stated concrete need, urgency, a specific date or deadline, specific details (documents, district, budget), more time and effort spent in the chat, asking how to start or what happens next. Lower it for: vague curiosity, one-word replies with no need, only asking where pages are, jokes and small talk.',
    '   signals: up to 6 short Arabic observations that justify the read, each tied to something visible ("يكتب جملًا من كلمتين فقط", "ذكر موعد سفر محددًا", "يكرر نفس السؤال بقلق").',
    '   how_to_talk: one or two Arabic sentences telling the admin how to approach this person ("اجعل الرد قصيرًا ومباشرًا، لا تشرح كثيرًا").',
    '   confidence: low | medium | high — low with only one or two short messages; raise it only as evidence accumulates.',
    '   Useful cues from language research: many first-person singular words and worry words suggest self-focus or distress; hedges like "maybe / perhaps / I think" suggest uncertainty, certainty words suggest conviction; very short fragments suggest haste or low engagement; long detailed messages suggest engagement and effort; stated needs, deadlines and specifics predict acting, small talk does not.',
    '',
    'HARD LIMITS',
    '- Describe communication behaviour in THIS conversation only. Never diagnose, never use clinical labels, never call anyone a bad or difficult person.',
    '- Never infer or record health conditions, religion, ethnicity, sexual orientation, political views, or any other sensitive trait. Record a health or legal matter only when the visitor stated it AND it is the reason they want a Rafiq service.',
    '- Do not record the visitor\'s name, phone number, email, or document numbers.',
    '- Write free-text values in Arabic. Keep everything short.',
    '',
    prev
      ? `WHAT IS ALREADY RECORDED (update it, do not discard it):\n${JSON.stringify({ facts: prev.facts, style: prev.style })}`
      : 'NOTHING IS RECORDED YET — this is the first look at this visitor.',
  ].join('\n');
}

export interface Analysis {
  facts: MemoryFacts;
  style: MemoryStyle;
}

/** Parse + sanitise the analyst's JSON. Null when the reply held nothing usable. */
export function parseAnalysis(text: string): Analysis | null {
  const obj = extractJson(text);
  if (!obj) return null;
  const facts = sanitizeFacts(obj.facts);
  const style = sanitizeStyle(obj.style);
  if (Object.keys(facts).length === 0 && Object.keys(style).length === 0) return null;
  return { facts, style };
}
