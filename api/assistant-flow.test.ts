/**
 * The whole server side of the smart assistant, end to end, with Gemini and
 * Supabase faked at the network edge:
 *   /api/ai-chat   reads the visitor's private memory, asks the model, returns
 *                  the reply with validated link ids;
 *   /api/ai-memory updates that memory from the conversation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import chat from './ai-chat';
import learn from './ai-memory';

const USER_ID = '11111111-2222-3333-4444-555555555555';
const SUPA = 'https://proj.supabase.co';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

let calls: Call[];
let storedMemory: Record<string, unknown> | null;
let geminiText: string;
let tokenValid: boolean;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function installFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>));
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ url, method: init?.method ?? 'GET', headers, body });

      if (url.startsWith(`${SUPA}/auth/v1/user`)) {
        return tokenValid ? json({ id: USER_ID }) : json({ msg: 'bad jwt' }, 401);
      }
      if (url.startsWith(`${SUPA}/rest/v1/assistant_memory`)) {
        if ((init?.method ?? 'GET') === 'GET') return json(storedMemory ? [storedMemory] : []);
        storedMemory = body as Record<string, unknown>;
        return new Response(null, { status: 201 });
      }
      if (url.includes('generativelanguage.googleapis.com')) {
        return json({ candidates: [{ content: { parts: [{ text: geminiText }] } }] });
      }
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
}

const post = (path: string, body: unknown, token?: string) =>
  new Request(`https://test.invalid${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

const geminiCalls = () => calls.filter((c) => c.url.includes('generativelanguage'));

beforeEach(() => {
  calls = [];
  storedMemory = null;
  tokenValid = true;
  geminiText = 'ok';
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.SUPABASE_URL = SUPA;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  installFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe('/api/ai-chat', () => {
  const ask = (text: string, token?: string) =>
    chat(post('/api/ai-chat', { lang: 'ar', messages: [{ role: 'user', text }] }, token));

  it('answers "where can I see the news" with a real link, stripped from the text', async () => {
    geminiText = 'بتلاقي آخر الأخبار بصفحة الأخبار.\n[[LINK:news]]';
    const res = await (await ask('وين فيني شوف احدث الاخبار')).json();
    expect(res).toEqual({ reply: 'بتلاقي آخر الأخبار بصفحة الأخبار.', done: false, links: ['news'] });
  });

  it('never passes on a page the model invented', async () => {
    geminiText = 'تفضل\n[[LINK:secret-admin]]\n[[LINK:realestate]]';
    const res = await (await ask('عقارات')).json();
    expect(res.links).toEqual(['realestate']);
  });

  it('puts the site map and both modes in the prompt the model receives', async () => {
    await ask('مرحبا');
    const sent = geminiCalls()[0].body as { systemInstruction: { parts: { text: string }[] } };
    const system = sent.systemInstruction.parts[0].text;
    expect(system).toContain('GUIDE mode');
    expect(system).toContain('news —');
    expect(system).toContain('service:res-tourist');
  });

  it('loads the signed-in visitor\'s memory and tells the model what it knows', async () => {
    storedMemory = {
      facts: { nationality: 'سوري', arrival_timeframe: 'بعد شهرين' },
      style: { tempo: 'hurried' },
      message_count: 3,
      last_analyzed_at: null,
    };
    await ask('مرحبا', 'good-token');

    const authCall = calls.find((c) => c.url.includes('/auth/v1/user'))!;
    expect(authCall.headers.Authorization).toBe('Bearer good-token');
    const memRead = calls.find((c) => c.url.includes('/rest/v1/assistant_memory'))!;
    expect(memRead.url).toContain(`user_id=eq.${USER_ID}`);
    expect(memRead.headers.apikey).toBe('service-key');

    const system = (geminiCalls()[0].body as { systemInstruction: { parts: { text: string }[] } }).systemInstruction.parts[0].text;
    expect(system).toContain('WHAT YOU REMEMBER');
    expect(system).toContain('بعد شهرين');
    expect(system).toContain('in a hurry');
  });

  it('runs without memory for a signed-out visitor, and never touches the table', async () => {
    const res = await (await ask('مرحبا')).json();
    expect(res.reply).toBe('ok');
    expect(calls.some((c) => c.url.includes('assistant_memory'))).toBe(false);
  });

  it('runs without memory when the token is bad', async () => {
    tokenValid = false;
    const res = await (await ask('مرحبا', 'stale')).json();
    expect(res.reply).toBe('ok');
    expect(calls.some((c) => c.url.includes('rest/v1/assistant_memory'))).toBe(false);
  });

  it('still answers when the memory table does not exist yet', async () => {
    const real = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/rest/v1/assistant_memory')) return json({ code: 'PGRST205' }, 404);
      return real(input, init);
    }));
    const res = await (await ask('مرحبا', 'good-token')).json();
    expect(res.reply).toBe('ok');
  });
});

describe('/api/ai-memory', () => {
  const convo = [
    { role: 'user', text: 'مرحبا' },
    { role: 'assistant', text: 'أهلًا' },
    { role: 'user', text: 'أنا سوري وقادم بعد شهرين' },
  ];

  const analysis = {
    facts: { visitor_type: 'planning_move', nationality: 'سوري', arrival_timeframe: 'بعد شهرين' },
    style: { tempo: 'relaxed', seriousness: 'medium', intent_score: 55, confidence: 'low' },
  };

  it('rejects a request with no valid sign-in', async () => {
    const noToken = await learn(post('/api/ai-memory', { messages: convo }));
    expect(noToken.status).toBe(401);
    tokenValid = false;
    const badToken = await learn(post('/api/ai-memory', { messages: convo }, 'stale'));
    expect(badToken.status).toBe(401);
    expect(geminiCalls()).toHaveLength(0);
  });

  it('reads the conversation and saves facts + style for that visitor', async () => {
    geminiText = JSON.stringify(analysis);
    const res = await (await learn(post('/api/ai-memory', { messages: convo }, 'good-token'))).json();
    expect(res).toEqual({ ok: true });

    const write = calls.find((c) => c.method === 'POST' && c.url.includes('/rest/v1/assistant_memory'))!;
    expect(write.headers.Prefer).toContain('merge-duplicates');
    expect(write.body).toMatchObject({
      user_id: USER_ID,
      facts: analysis.facts,
      style: { tempo: 'relaxed', seriousness: 'medium', intent_score: 55, confidence: 'low' },
      message_count: 1,
    });

    // the analyst is asked for JSON and told to judge style from the visitor's lines only
    const sent = geminiCalls()[0].body as { generationConfig: { responseMimeType: string }; contents: { parts: { text: string }[] }[] };
    expect(sent.generationConfig.responseMimeType).toBe('application/json');
    expect(sent.contents[0].parts[0].text).toContain('Visitor: أنا سوري وقادم بعد شهرين');
  });

  it('keeps what it already knew and adds to it', async () => {
    storedMemory = { facts: { current_city: 'حلب' }, style: {}, message_count: 2, last_analyzed_at: '2020-01-01T00:00:00Z' };
    geminiText = JSON.stringify(analysis);
    await learn(post('/api/ai-memory', { messages: convo }, 'good-token'));
    const saved = storedMemory as { facts: Record<string, unknown>; message_count: number };
    expect(saved.facts).toMatchObject({ current_city: 'حلب', nationality: 'سوري' });
    expect(saved.message_count).toBe(3);
  });

  it('skips a second analysis that arrives moments after the first', async () => {
    storedMemory = { facts: {}, style: {}, message_count: 1, last_analyzed_at: new Date().toISOString() };
    const res = await (await learn(post('/api/ai-memory', { messages: convo }, 'good-token'))).json();
    expect(res).toEqual({ ok: true, skipped: 'recent' });
    expect(geminiCalls()).toHaveLength(0);
  });

  it('refuses to store a sensitive trait the model slipped in', async () => {
    geminiText = JSON.stringify({ facts: { nationality: 'سوري', notes: ['ديانته مسلم', 'يريد شقة'] }, style: { tempo: 'normal' } });
    await learn(post('/api/ai-memory', { messages: convo }, 'good-token'));
    const saved = storedMemory as { facts: { notes?: string[] } };
    expect(saved.facts.notes).toEqual(['يريد شقة']);
  });

  it('does not store anything when the model returns nonsense', async () => {
    geminiText = 'sorry, I cannot do that';
    const res = await (await learn(post('/api/ai-memory', { messages: convo }, 'good-token'))).json();
    expect(res.error).toBe('unparseable');
    expect(storedMemory).toBeNull();
  });
});

describe('when the first model is overloaded', () => {
  it('walks on to the next model instead of giving up on a 503', async () => {
    const real = globalThis.fetch;
    let gemini = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('generativelanguage')) {
        gemini += 1;
        if (gemini === 1) return json({ error: { code: 503, status: 'UNAVAILABLE' } }, 503);
        return json({ candidates: [{ content: { parts: [{ text: 'ok من النموذج الثاني' }] } }] });
      }
      return real(input, init);
    }));
    const res = await (await chat(post('/api/ai-chat', { lang: 'ar', messages: [{ role: 'user', text: 'مرحبا' }] }))).json();
    expect(res.reply).toBe('ok من النموذج الثاني');
    expect(gemini).toBe(2);
  });
});
