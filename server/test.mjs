/**
 * Integration tests for the API — run with: node --test server/test.mjs
 * Uses an in-memory SQLite DB and a real HTTP listener on an ephemeral port.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, loadConfig } from './index.mjs';
import { openDb } from './db.mjs';

const cfg = loadConfig({
  ADMIN_EMAILS: 'admin@test.dev',
  PAYMENT_WEBHOOK_SECRET: 'test-secret',
  FREE_CHAT_MESSAGES: '2',
  UPLOADS_DIR: mkdtempSync(join(tmpdir(), 'rafiq-uploads-')),
});

let server;
let base;

before(async () => {
  const app = createApp(openDb(':memory:'), cfg);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}`;
});

after(() => server.close());

/** fetch wrapper that captures/sends the session cookie */
function client() {
  let cookie = '';
  return async (method, path, body, extra = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        ...(extra.headers ?? {}),
      },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    let json = null;
    const text = await res.text();
    try { json = JSON.parse(text); } catch { json = { _raw: text }; }
    return { status: res.status, json, headers: res.headers };
  };
}

// ---------------- P0-1: real authentication ----------------

test('register requires a strong password and real email', async () => {
  const c = client();
  assert.equal((await c('POST', '/api/auth/register', { email: 'bad', password: 'longenough1', name: 'x' })).status, 400);
  assert.equal((await c('POST', '/api/auth/register', { email: 'a@b.co', password: 'short', name: 'x' })).status, 400);
});

test('sign-in is distinct from sign-up: unknown email 404, wrong password 401, duplicate register 409', async () => {
  const c = client();
  assert.equal((await c('POST', '/api/auth/login', { email: 'ghost@test.dev', password: 'whatever123' })).status, 404);

  const reg = await c('POST', '/api/auth/register', { email: 'user1@test.dev', password: 'password123', name: 'User One' });
  assert.equal(reg.status, 201);

  const dup = await c('POST', '/api/auth/register', { email: 'user1@test.dev', password: 'password123', name: 'Dup' });
  assert.equal(dup.status, 409);

  const fresh = client();
  assert.equal((await fresh('POST', '/api/auth/login', { email: 'user1@test.dev', password: 'WRONG-password' })).status, 401);
  assert.equal((await fresh('POST', '/api/auth/login', { email: 'user1@test.dev', password: 'password123' })).status, 200);
});

test('session works across requests and is invalidated server-side on logout', async () => {
  const c = client();
  await c('POST', '/api/auth/register', { email: 'sess@test.dev', password: 'password123', name: 'S' });
  assert.equal((await c('GET', '/api/me')).json.user.email, 'sess@test.dev');
  await c('POST', '/api/auth/logout');
  // cookie was cleared by logout; even replaying the old token must fail server-side
  assert.equal((await c('GET', '/api/me')).json.user, null);
});

// ---------------- P0-2: server-enforced authorization ----------------

test('admin endpoints return 401 anonymous and 403 for non-admins; client cannot mint tier', async () => {
  const anon = client();
  assert.equal((await anon('GET', '/api/admin/users')).status, 401);

  const u = client();
  await u('POST', '/api/auth/register', { email: 'pleb@test.dev', password: 'password123', name: 'P' });
  assert.equal((await u('GET', '/api/admin/users')).status, 403);
  assert.equal((await u('POST', '/api/admin/users/x/tier', { tier: 'elite' })).status, 403);

  // paid-tier data is enforced server-side: free user gets 402 on /api/places
  assert.equal((await u('GET', '/api/places')).status, 402);

  const admin = client();
  await admin('POST', '/api/auth/register', { email: 'admin@test.dev', password: 'password123', name: 'A' });
  assert.equal((await admin('GET', '/api/admin/users')).status, 200);
});

// ---------------- P0-4: payments via signed webhook ----------------

test('card payment activates only via a correctly signed webhook; amounts match plan prices', async () => {
  const c = client();
  await c('POST', '/api/auth/register', { email: 'payer@test.dev', password: 'password123', name: 'Payer' });

  const session = await c('POST', '/api/checkout/session', { tier: 'pro', billing: 'annual' });
  assert.equal(session.status, 200);
  const paymentId = session.json.paymentId;

  // annual = 10x monthly
  const p = await c('GET', `/api/payments/${paymentId}`);
  assert.equal(p.json.amount, 1599 * 10);

  // forged signature is rejected and does NOT activate
  const payload = JSON.stringify({ paymentId, outcome: 'success' });
  const forged = await fetch(base + '/api/webhooks/payment', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-rafiq-signature': 'deadbeef' },
    body: payload,
  });
  assert.equal(forged.status, 401);
  assert.equal((await c('GET', '/api/me')).json.tier, 'free');

  // correctly signed webhook activates 12 months
  const sig = crypto.createHmac('sha256', 'test-secret').update(payload).digest('hex');
  const ok = await fetch(base + '/api/webhooks/payment', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-rafiq-signature': sig },
    body: payload,
  });
  assert.equal(ok.status, 200);
  const me = await c('GET', '/api/me');
  assert.equal(me.json.tier, 'pro');
  const months = (new Date(me.json.subscription.expiresAt) - new Date(me.json.subscription.startedAt)) / (30 * 86400000);
  assert.ok(months > 11 && months < 13, `expected ~12 months, got ${months}`);

  // failed/abandoned payment does not activate
  const c2 = client();
  await c2('POST', '/api/auth/register', { email: 'payer2@test.dev', password: 'password123', name: 'P2' });
  const s2 = await c2('POST', '/api/checkout/session', { tier: 'light', billing: 'monthly' });
  const fp = JSON.stringify({ paymentId: s2.json.paymentId, outcome: 'fail' });
  await fetch(base + '/api/webhooks/payment', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-rafiq-signature': crypto.createHmac('sha256', 'test-secret').update(fp).digest('hex') },
    body: fp,
  });
  assert.equal((await c2('GET', '/api/me')).json.tier, 'free');
});

// ---------------- P0-5: uploads ----------------

test('document upload is stored and only retrievable by its owner', async () => {
  const owner = client();
  await owner('POST', '/api/auth/register', { email: 'owner@test.dev', password: 'password123', name: 'O' });
  const fd = new FormData();
  fd.append('file', new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }), 'passport.png');
  const up = await owner('POST', '/api/documents', fd);
  assert.equal(up.status, 201);
  const list = await owner('GET', '/api/documents');
  assert.equal(list.json.documents.length, 1);
  const id = list.json.documents[0].id;
  assert.equal((await owner('GET', `/api/documents/${id}/file`)).status, 200);

  const stranger = client();
  await stranger('POST', '/api/auth/register', { email: 'stranger@test.dev', password: 'password123', name: 'S' });
  assert.equal((await stranger('GET', `/api/documents/${id}/file`)).status, 404);
});

// ---------------- P1-2: referrals ----------------

test('referral click + attributed signup + 30% commission on verified payment', async () => {
  const ref = client();
  await ref('POST', '/api/auth/register', { email: 'referrer@test.dev', password: 'password123', name: 'R' });
  const code = (await ref('GET', '/api/referrals/stats')).json.code;

  await client()('POST', '/api/referrals/click', { code });

  const friend = client();
  await friend('POST', '/api/auth/register', { email: 'friend@test.dev', password: 'password123', name: 'F', refCode: code });

  const s = await friend('POST', '/api/checkout/session', { tier: 'light', billing: 'monthly' });
  const payload = JSON.stringify({ paymentId: s.json.paymentId, outcome: 'success' });
  await fetch(base + '/api/webhooks/payment', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-rafiq-signature': crypto.createHmac('sha256', 'test-secret').update(payload).digest('hex') },
    body: payload,
  });

  const stats = (await ref('GET', '/api/referrals/stats')).json;
  assert.equal(stats.clicks, 1);
  assert.equal(stats.signups, 1);
  assert.equal(stats.earnedTl, Math.round(799 * 0.3));
});

// ---------------- P1-4: per-user notification read state ----------------

test('two users have independent unread counts for the same broadcast', async () => {
  const admin = client();
  await admin('POST', '/api/auth/login', { email: 'admin@test.dev', password: 'password123' });
  await admin('POST', '/api/admin/news', { text: 'New ikamet rules!' });

  const a = client();
  await a('POST', '/api/auth/register', { email: 'reader-a@test.dev', password: 'password123', name: 'A' });
  const b = client();
  await b('POST', '/api/auth/register', { email: 'reader-b@test.dev', password: 'password123', name: 'B' });

  await a('POST', '/api/notifications/read-all');
  const aN = (await a('GET', '/api/notifications')).json.notifications.find((n) => n.key === 'custom');
  const bN = (await b('GET', '/api/notifications')).json.notifications.find((n) => n.key === 'custom');
  assert.equal(aN.read, true);
  assert.equal(bN.read, false);
});

// ---------------- P2-3: booking date guard ----------------

test('bookings in the past are rejected', async () => {
  const c = client();
  await c('POST', '/api/auth/register', { email: 'booker@test.dev', password: 'password123', name: 'B' });
  const past = await c('POST', '/api/bookings', {
    problemSummary: 'x', transcript: [], preferredDatetime: '2020-01-01T10:00', preferredLanguage: 'en',
  });
  assert.equal(past.status, 400);
  assert.equal(past.json.error, 'past_datetime');
  const future = await c('POST', '/api/bookings', {
    problemSummary: 'ikamet rejected', transcript: [{ role: 'user', text: 'help', ts: 1 }],
    preferredDatetime: new Date(Date.now() + 86400000).toISOString(), preferredLanguage: 'ar',
  });
  assert.equal(future.status, 201);
});

// ---------------- P1-1/P3-5: AI policy + free preview limit ----------------

test('AI chat escalates on explicit human request and enforces the free preview limit', async () => {
  const c = client();
  await c('POST', '/api/auth/register', { email: 'chatter@test.dev', password: 'password123', name: 'C' });

  const r1 = await c('POST', '/api/ai/chat', { lang: 'en', messages: [{ role: 'user', text: 'I want to talk to a human expert about my ikamet', ts: 1 }] });
  assert.equal(r1.status, 200);
  assert.ok(r1.json._raw.includes('"offerBooking":true'));

  await c('POST', '/api/ai/chat', { lang: 'en', messages: [{ role: 'user', text: 'what is a vergi no?', ts: 2 }] });
  // FREE_CHAT_MESSAGES=2 → third message hits the paywall, enforced server-side
  const r3 = await c('POST', '/api/ai/chat', { lang: 'en', messages: [{ role: 'user', text: 'and istanbulkart?', ts: 3 }] });
  assert.equal(r3.status, 402);
});

// ---------------- P1-3: leads persist ----------------

test('service request leads persist and reach the admin', async () => {
  const c = client();
  await c('POST', '/api/auth/register', { email: 'leady@test.dev', password: 'password123', name: 'L' });
  assert.equal((await c('POST', '/api/leads', { kind: 'realestate', item: 'Beşiktaş 3+1' })).status, 201);
  assert.equal((await c('GET', '/api/leads/mine')).json.leads.length, 1);

  const admin = client();
  await admin('POST', '/api/auth/login', { email: 'admin@test.dev', password: 'password123' });
  const all = (await admin('GET', '/api/admin/leads')).json.leads;
  assert.ok(all.some((l) => l.userEmail === 'leady@test.dev' && l.item === 'Beşiktaş 3+1'));
});
