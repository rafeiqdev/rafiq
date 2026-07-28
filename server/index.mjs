/**
 * Rafiq Istanbul API server.
 *
 * Source of truth for identity, authorization, subscriptions, payments,
 * bookings, notifications, documents, leads and referrals. The client's
 * src/lib/api.ts only talks to these endpoints — it holds no trust decisions.
 */
import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, uid, now } from './db.mjs';
import { SYSTEM_PROMPT, fallbackRespond, fallbackSummary, policyTriggers, detectTopic } from './ai-policy.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- config

export function loadConfig(env = process.env) {
  // The primary admin account is auto-provisioned with these fixed credentials
  // on every startup, so there is no "forgot password" problem — the password
  // is always whatever ADMIN_PASSWORD says (default 'admin').
  const adminEmail = (env.ADMIN_EMAIL ?? 'rafeiq.dev@gmail.com').trim().toLowerCase();
  const adminEmails = (env.ADMIN_EMAILS ?? 'rafeiq.dev@gmail.com,admin@rafiq.ist')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!adminEmails.includes(adminEmail)) adminEmails.push(adminEmail);
  return {
    // API_PORT (not PORT) so dev harnesses that export PORT for the web app don't collide
    port: Number(env.API_PORT ?? 8787),
    appUrl: env.APP_URL ?? 'http://localhost:5173',
    adminEmail,
    adminPassword: env.ADMIN_PASSWORD ?? 'admin',
    adminEmails,
    webhookSecret: env.PAYMENT_WEBHOOK_SECRET ?? 'dev-webhook-secret-change-me',
    sessionTtlDays: Number(env.SESSION_TTL_DAYS ?? 30),
    bankIban: env.BANK_IBAN ?? 'TR12 0006 4000 0011 2345 6789 01',
    bankHolder: env.BANK_HOLDER ?? 'Rafiq Istanbul Danışmanlık Ltd. Şti.',
    cryptoWallet: env.CRYPTO_WALLET ?? 'TQrY8mFkD2vXjW3pZsN6bHcL9aGtE5uRw1',
    cryptoNetwork: env.CRYPTO_NETWORK ?? 'TRC-20 (USDT/USDC)',
    anthropicKey: env.ANTHROPIC_API_KEY ?? '',
    anthropicModel: env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    googleClientId: env.GOOGLE_CLIENT_ID ?? '',
    freeChatMessages: Number(env.FREE_CHAT_MESSAGES ?? 3),
    ratesUrl: env.RATES_URL ?? 'https://open.er-api.com/v6/latest/USD',
    uploadsDir: env.UPLOADS_DIR ?? join(__dirname, 'uploads'),
    secureCookies: env.NODE_ENV === 'production',
  };
}

const PLAN_PRICES = { light: 799, pro: 1599, elite: 3199 };
const LANG_CODES = ['ar', 'en', 'ru', 'fa'];

// ---------------------------------------------------------------- app factory

// Seed content shown to all visitors; admins edit it live from the dashboard.
const LP = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=70`;
const SEED_LISTINGS = [
  { district: 'Kadıköy', rooms: '2+1', m2: 95, price_usd: 210000, citizenship: 0, image: LP('1502672260266-1c1ef2d93688') },
  { district: 'Beşiktaş', rooms: '3+1', m2: 140, price_usd: 460000, citizenship: 1, image: LP('1545324418-cc1a3fa10c00') },
  { district: 'Başakşehir', rooms: '2+1', m2: 110, price_usd: 185000, citizenship: 0, image: LP('1512917774080-9991f1c4c750') },
  { district: 'Sarıyer', rooms: '4+1', m2: 220, price_usd: 690000, citizenship: 1, image: LP('1560448204-e02f11c3d0e2') },
  { district: 'Beylikdüzü', rooms: '1+1', m2: 65, price_usd: 95000, citizenship: 0, image: LP('1493809842364-78817add7ffb') },
  { district: 'Üsküdar', rooms: '3+1', m2: 150, price_usd: 420000, citizenship: 1, image: LP('1568605114967-8130f3a36994') },
];

const SEED_PLACES = [
  { name: 'Çiya Sofrası (Kadıköy)', category: 'dining', lat: 40.9905, lng: 29.0253, address: 'Caferağa, Kadıköy' },
  { name: 'Karaköy Lokantası', category: 'dining', lat: 41.0223, lng: 28.9744, address: 'Kemankeş, Beyoğlu' },
  { name: 'Pera Palace Hotel', category: 'hotels', lat: 41.0316, lng: 28.9751, address: 'Tepebaşı, Beyoğlu' },
  { name: 'Sultanahmet Boutique Hotels', category: 'hotels', lat: 41.0054, lng: 28.9768, address: 'Sultanahmet, Fatih' },
  { name: 'Beyoğlu 25. Noter', category: 'notary', lat: 41.0335, lng: 28.9772, address: 'İstiklal Cd., Beyoğlu' },
  { name: 'Kadıköy 7. Noter', category: 'notary', lat: 40.9889, lng: 29.0273, address: 'Söğütlüçeşme, Kadıköy' },
  { name: 'Acıbadem Hospital (Kadıköy)', category: 'hospitals', lat: 40.9991, lng: 29.0407, address: 'Acıbadem, Kadıköy' },
  { name: 'Memorial Şişli Hospital', category: 'hospitals', lat: 41.0639, lng: 28.9852, address: 'Şişli' },
  { name: 'Göç İdaresi (Provincial Migration Office)', category: 'government', lat: 41.0167, lng: 28.9497, address: 'Fatih' },
  { name: 'Fatih Vergi Dairesi (Tax Office)', category: 'government', lat: 41.0145, lng: 28.9533, address: 'Fatih' },
  { name: 'Grand Bazaar (Kapalıçarşı)', category: 'shopping', lat: 41.0106, lng: 28.968, address: 'Beyazıt, Fatih' },
  { name: 'Zorlu Center', category: 'shopping', lat: 41.0667, lng: 29.0175, address: 'Levazım, Beşiktaş' },
];

function seedContent(db) {
  if (db.prepare('SELECT COUNT(*) AS c FROM listings').get().c === 0) {
    const stmt = db.prepare(`INSERT INTO listings (id,district,rooms,m2,price_usd,citizenship,image,sort,created_at)
                             VALUES (?,?,?,?,?,?,?,?,?)`);
    SEED_LISTINGS.forEach((l, i) =>
      stmt.run(uid('lst'), l.district, l.rooms, l.m2, l.price_usd, l.citizenship, l.image, i, now()),
    );
  }
  if (db.prepare('SELECT COUNT(*) AS c FROM places').get().c === 0) {
    const stmt = db.prepare(`INSERT INTO places (id,name,category,lat,lng,address,sort,created_at)
                             VALUES (?,?,?,?,?,?,?,?)`);
    SEED_PLACES.forEach((p, i) => stmt.run(uid('plc'), p.name, p.category, p.lat, p.lng, p.address, i, now()));
  }
}

const PLACE_CATEGORIES = ['dining', 'hotels', 'notary', 'hospitals', 'government', 'shopping'];

/**
 * Provision (or re-sync) the primary admin account from config so it can always
 * be reached with the configured email + password — no password-reset flow
 * needed. Runs on every startup; the password is kept in sync with ADMIN_PASSWORD.
 */
export function seedAdmin(db, cfg) {
  const hash = bcrypt.hashSync(cfg.adminPassword, 10);
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cfg.adminEmail);
  if (existing) {
    db.prepare("UPDATE users SET password_hash = ?, role = 'admin', provider = 'email' WHERE email = ?")
      .run(hash, cfg.adminEmail);
  } else {
    db.prepare(`INSERT INTO users (id,email,name,password_hash,provider,role,referral_code,referred_by,created_at)
                VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(uid('usr'), cfg.adminEmail, 'Admin', hash, 'email', 'admin',
        crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6), null, now());
  }
}

export function createApp(db = openDb(), cfg = loadConfig()) {
  const app = express();
  mkdirSync(cfg.uploadsDir, { recursive: true });
  seedContent(db);

  const rowToListing = (l) => ({
    id: l.id,
    district: l.district,
    rooms: l.rooms,
    m2: l.m2,
    priceUsd: l.price_usd,
    citizenship: !!l.citizenship,
    image: l.image ?? null,
  });
  const rowToPlace = (p) => ({ id: p.id, name: p.name, category: p.category, lat: p.lat, lng: p.lng, address: p.address ?? null });

  const upload = multer({
    storage: multer.diskStorage({
      destination: cfg.uploadsDir,
      filename: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase().slice(0, 8);
        cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(file.mimetype);
      cb(ok ? null : new Error('bad_file_type'), ok);
    },
  });

  // ---- helpers -----------------------------------------------------------

  const fail = (res, status, code) => res.status(status).json({ error: code });

  function parseCookies(req) {
    const out = {};
    for (const part of (req.headers.cookie ?? '').split(';')) {
      const i = part.indexOf('=');
      if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
    return out;
  }

  function setSessionCookie(res, token) {
    const maxAge = cfg.sessionTtlDays * 86400;
    res.setHeader(
      'Set-Cookie',
      `rafiq_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${cfg.secureCookies ? '; Secure' : ''}`,
    );
  }

  function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', 'rafiq_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  }

  function createSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + cfg.sessionTtlDays * 86400000).toISOString();
    db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)').run(
      token, userId, now(), expires,
    );
    return token;
  }

  function publicUser(u) {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      provider: u.provider,
      isAdmin: u.role === 'admin',
      referralCode: u.referral_code,
      createdAt: u.created_at,
    };
  }

  /** P2-4: persist 'expired' instead of leaving stale 'active' rows. */
  function getSubscription(userId) {
    const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId);
    if (!sub) return null;
    if (new Date(sub.expires_at) < new Date() && sub.status !== 'expired') {
      db.prepare("UPDATE subscriptions SET status = 'expired' WHERE user_id = ?").run(userId);
      sub.status = 'expired';
    }
    return {
      userId: sub.user_id,
      tier: sub.tier,
      billing: sub.billing,
      status: sub.status,
      startedAt: sub.started_at,
      expiresAt: sub.expires_at,
      cancelReason: sub.cancel_reason ?? undefined,
      cancelComment: sub.cancel_comment ?? undefined,
    };
  }

  function getTier(userId) {
    const sub = getSubscription(userId);
    return sub && (sub.status === 'active' || sub.status === 'cancelled') ? sub.tier : 'free';
  }

  function notify(audience, userId, key, customText = null) {
    db.prepare('INSERT INTO notifications (id, audience, user_id, key, custom_text, created_at) VALUES (?,?,?,?,?,?)')
      .run(uid('ntf'), audience, userId, key, customText, now());
  }

  function activateSubscription(userId, tier, billing) {
    const start = new Date();
    const expires = new Date(start);
    expires.setMonth(expires.getMonth() + (billing === 'annual' ? 12 : 1));
    db.prepare(`
      INSERT INTO subscriptions (user_id, tier, billing, status, started_at, expires_at, cancel_reason, cancel_comment)
      VALUES (?,?,?,?,?,?,NULL,NULL)
      ON CONFLICT(user_id) DO UPDATE SET
        tier=excluded.tier, billing=excluded.billing, status='active',
        started_at=excluded.started_at, expires_at=excluded.expires_at,
        cancel_reason=NULL, cancel_comment=NULL
    `).run(userId, tier, billing, 'active', start.toISOString(), expires.toISOString());
  }

  /** Single activation path used by both the webhook and manual admin verification. */
  function settleVerifiedPayment(payment) {
    if (payment.status === 'verified') return; // idempotent
    db.prepare("UPDATE payments SET status = 'verified' WHERE id = ?").run(payment.id);
    activateSubscription(payment.user_id, payment.tier, payment.billing);
    notify('user', payment.user_id, 'paymentVerified');
    // referral commission: 30% of every payment, credited once per payment
    const payer = db.prepare('SELECT referred_by FROM users WHERE id = ?').get(payment.user_id);
    if (payer?.referred_by) {
      db.prepare('INSERT OR IGNORE INTO referral_credits (id, referrer_id, payment_id, amount_tl, created_at) VALUES (?,?,?,?,?)')
        .run(uid('cr'), payer.referred_by, payment.id, Math.round(payment.amount * 0.3), now());
    }
  }

  // ---- middleware ---------------------------------------------------------

  function attachUser(req, _res, next) {
    req.user = null;
    const token = parseCookies(req).rafiq_session;
    if (token) {
      const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
      if (session && new Date(session.expires_at) > new Date()) {
        const u = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
        if (u) {
          req.user = u;
          req.sessionToken = token;
        }
      }
    }
    next();
  }

  const requireAuth = (req, res, next) => (req.user ? next() : fail(res, 401, 'unauthorized'));
  const requireAdmin = (req, res, next) =>
    req.user?.role === 'admin' ? next() : fail(res, req.user ? 403 : 401, req.user ? 'forbidden' : 'unauthorized');
  const requirePro = (req, res, next) => {
    const tier = getTier(req.user.id);
    return tier === 'pro' || tier === 'elite' ? next() : fail(res, 402, 'upgrade_required');
  };

  // webhook needs the raw body for signature verification — mount before json
  app.post('/api/webhooks/payment', express.raw({ type: '*/*' }), (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
    const expected = Buffer.from(crypto.createHmac('sha256', cfg.webhookSecret).update(raw).digest('hex'), 'utf8');
    const got = Buffer.from(String(req.headers['x-rafiq-signature'] ?? ''), 'utf8');
    if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) {
      return fail(res, 401, 'bad_signature');
    }
    let payload;
    try {
      payload = JSON.parse(raw.toString('utf8'));
    } catch {
      return fail(res, 400, 'bad_payload');
    }
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(payload.paymentId);
    if (!payment) return fail(res, 404, 'payment_not_found');
    if (payload.outcome === 'success') settleVerifiedPayment(payment);
    else db.prepare("UPDATE payments SET status = 'rejected' WHERE id = ? AND status != 'verified'").run(payment.id);
    res.json({ ok: true });
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(attachUser);

  // ---- public config & rates ---------------------------------------------

  app.get('/api/config', (_req, res) => {
    res.json({ googleClientId: cfg.googleClientId || null, freeChatMessages: cfg.freeChatMessages });
  });

  const getSetting = (key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? null;
  const setSetting = (key, value) =>
    db.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value);

  function adminRatesOverride() {
    const raw = getSetting('rates_override');
    if (!raw) return null;
    try {
      const o = JSON.parse(raw);
      if (typeof o.usdtry === 'number' && typeof o.eurtry === 'number') {
        return { usdtry: o.usdtry, eurtry: o.eurtry, live: false, source: 'admin', updatedAt: o.updatedAt ?? null };
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  let ratesCache = { at: 0, data: null };
  app.get('/api/rates', async (_req, res) => {
    // an admin-set rate always wins over the live feed
    const override = adminRatesOverride();
    if (override) return res.json(override);
    if (ratesCache.data && Date.now() - ratesCache.at < 5 * 60 * 1000) return res.json(ratesCache.data);
    try {
      const r = await fetch(cfg.ratesUrl, { signal: AbortSignal.timeout(6000) });
      const data = await r.json();
      const usdtry = data?.rates?.TRY;
      const eur = data?.rates?.EUR;
      if (typeof usdtry === 'number' && typeof eur === 'number') {
        ratesCache = { at: Date.now(), data: { usdtry, eurtry: usdtry / eur, live: true, source: 'live' } };
        return res.json(ratesCache.data);
      }
    } catch {
      /* fall through to cached/static */
    }
    res.json(ratesCache.data ? { ...ratesCache.data, live: false } : { usdtry: 41.2, eurtry: 44.8, live: false, source: 'fallback' });
  });

  // ---- auth ---------------------------------------------------------------

  app.post('/api/auth/register', async (req, res) => {
    const { email, password, name, refCode } = req.body ?? {};
    if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(res, 400, 'bad_email');
    if (typeof password !== 'string' || password.length < 8) return fail(res, 400, 'weak_password');
    const lower = email.toLowerCase();
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(lower)) return fail(res, 409, 'email_exists');

    const referrer = refCode
      ? db.prepare('SELECT id FROM users WHERE referral_code = ?').get(String(refCode).toUpperCase())
      : null;
    const user = {
      id: uid('usr'),
      email: lower,
      name: (typeof name === 'string' && name.trim()) || lower.split('@')[0],
      password_hash: await bcrypt.hash(password, 10),
      provider: 'email',
      role: cfg.adminEmails.includes(lower) ? 'admin' : 'user',
      referral_code: crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6),
      referred_by: referrer?.id ?? null,
      created_at: now(),
    };
    db.prepare(`INSERT INTO users (id,email,name,password_hash,provider,role,referral_code,referred_by,created_at)
                VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(user.id, user.email, user.name, user.password_hash, user.provider, user.role, user.referral_code, user.referred_by, user.created_at);
    notify('user', user.id, 'welcome');
    setSessionCookie(res, createSession(user.id));
    res.status(201).json({ user: publicUser(user) });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body ?? {};
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email ?? '').toLowerCase());
    if (!u) return fail(res, 404, 'user_not_found');
    if (!u.password_hash || !(await bcrypt.compare(String(password ?? ''), u.password_hash))) {
      return fail(res, 401, 'wrong_password');
    }
    setSessionCookie(res, createSession(u.id));
    res.json({ user: publicUser(u) });
  });

  app.post('/api/auth/google', async (req, res) => {
    if (!cfg.googleClientId) return fail(res, 501, 'google_disabled');
    const { credential, refCode } = req.body ?? {};
    let info;
    try {
      const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(String(credential ?? ''))}`);
      if (!r.ok) return fail(res, 401, 'bad_google_token');
      info = await r.json();
    } catch {
      return fail(res, 502, 'google_unreachable');
    }
    if (info.aud !== cfg.googleClientId || info.email_verified !== 'true') return fail(res, 401, 'bad_google_token');
    const lower = info.email.toLowerCase();
    let u = db.prepare('SELECT * FROM users WHERE email = ?').get(lower);
    if (!u) {
      const referrer = refCode
        ? db.prepare('SELECT id FROM users WHERE referral_code = ?').get(String(refCode).toUpperCase())
        : null;
      u = {
        id: uid('usr'),
        email: lower,
        name: info.name || lower.split('@')[0],
        password_hash: null,
        provider: 'google',
        role: cfg.adminEmails.includes(lower) ? 'admin' : 'user',
        referral_code: crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6),
        referred_by: referrer?.id ?? null,
        created_at: now(),
      };
      db.prepare(`INSERT INTO users (id,email,name,password_hash,provider,role,referral_code,referred_by,created_at)
                  VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(u.id, u.email, u.name, u.password_hash, u.provider, u.role, u.referral_code, u.referred_by, u.created_at);
      notify('user', u.id, 'welcome');
    }
    setSessionCookie(res, createSession(u.id));
    res.json({ user: publicUser(u) });
  });

  // Dev-only "Continue with Google" — active ONLY when no real GOOGLE_CLIENT_ID
  // is configured, so production (with a client id) uses the verified flow above.
  app.post('/api/auth/google-dev', (req, res) => {
    if (cfg.googleClientId) return fail(res, 404, 'not_found');
    const { email, name, refCode } = req.body ?? {};
    const lower = String(email ?? '').toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lower)) return fail(res, 400, 'bad_email');
    let u = db.prepare('SELECT * FROM users WHERE email = ?').get(lower);
    if (!u) {
      const referrer = refCode
        ? db.prepare('SELECT id FROM users WHERE referral_code = ?').get(String(refCode).toUpperCase())
        : null;
      u = {
        id: uid('usr'),
        email: lower,
        name: (typeof name === 'string' && name.trim()) || lower.split('@')[0],
        password_hash: null,
        provider: 'google',
        role: cfg.adminEmails.includes(lower) ? 'admin' : 'user',
        referral_code: crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6),
        referred_by: referrer?.id ?? null,
        created_at: now(),
      };
      db.prepare(`INSERT INTO users (id,email,name,password_hash,provider,role,referral_code,referred_by,created_at)
                  VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(u.id, u.email, u.name, u.password_hash, u.provider, u.role, u.referral_code, u.referred_by, u.created_at);
      notify('user', u.id, 'welcome');
    }
    setSessionCookie(res, createSession(u.id));
    res.json({ user: publicUser(u) });
  });

  app.post('/api/auth/logout', (req, res) => {
    if (req.sessionToken) db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sessionToken);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/me', (req, res) => {
    if (!req.user) return res.json({ user: null });
    const profileRow = db.prepare('SELECT data FROM profiles WHERE user_id = ?').get(req.user.id);
    res.json({
      user: publicUser(req.user),
      subscription: getSubscription(req.user.id),
      tier: getTier(req.user.id),
      unread: countUnread(req.user),
      profile: profileRow ? JSON.parse(profileRow.data) : null,
    });
  });

  app.put('/api/profile', requireAuth, (req, res) => {
    const data = req.body?.data;
    if (typeof data !== 'object' || data === null) return fail(res, 400, 'bad_profile');
    db.prepare('INSERT INTO profiles (user_id, data) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data')
      .run(req.user.id, JSON.stringify(data));
    res.json({ ok: true });
  });

  // ---- subscriptions ------------------------------------------------------

  app.post('/api/subscriptions/cancel', requireAuth, (req, res) => {
    const { reason, comment } = req.body ?? {};
    db.prepare("UPDATE subscriptions SET status = 'cancelled', cancel_reason = ?, cancel_comment = ? WHERE user_id = ? AND status = 'active'")
      .run(String(reason ?? ''), String(comment ?? ''), req.user.id);
    res.json({ subscription: getSubscription(req.user.id) });
  });

  // ---- payments & checkout ------------------------------------------------

  app.get('/api/checkout/config', requireAuth, (_req, res) => {
    res.json({ iban: cfg.bankIban, holder: cfg.bankHolder, wallet: cfg.cryptoWallet, network: cfg.cryptoNetwork });
  });

  function priceFor(tier, billing) {
    const monthly = PLAN_PRICES[tier];
    if (!monthly) return null;
    return billing === 'annual' ? monthly * 10 : monthly;
  }

  app.post('/api/checkout/session', requireAuth, (req, res) => {
    const { tier, billing } = req.body ?? {};
    const amount = priceFor(tier, billing);
    if (amount === null || !['monthly', 'annual'].includes(billing)) return fail(res, 400, 'bad_plan');
    const session = crypto.randomBytes(16).toString('hex');
    const id = uid('pay');
    db.prepare(`INSERT INTO payments (id,user_id,email,tier,billing,method,amount,status,gateway_session,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(id, req.user.id, req.user.email, tier, billing, 'card', amount, 'pending', session, now());
    // Dev gateway simulator stands in for the real hosted checkout page.
    // With a real gateway (Stripe/iyzico/Whop), create the session via its SDK
    // here and return its hosted URL — the webhook contract stays the same.
    res.json({ url: `/api/pay/${session}`, paymentId: id });
  });

  app.get('/api/payments/:id', requireAuth, (req, res) => {
    const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
    if (!p || p.user_id !== req.user.id) return fail(res, 404, 'payment_not_found');
    res.json({ id: p.id, status: p.status, tier: p.tier, billing: p.billing, amount: p.amount });
  });

  app.post('/api/payments/manual', requireAuth, upload.single('receipt'), (req, res) => {
    const { tier, billing, method } = req.body ?? {};
    const amount = priceFor(tier, billing);
    if (amount === null || !['bank', 'crypto'].includes(method) || !['monthly', 'annual'].includes(billing)) {
      return fail(res, 400, 'bad_plan');
    }
    const id = uid('pay');
    db.prepare(`INSERT INTO payments (id,user_id,email,tier,billing,method,amount,status,receipt_path,receipt_name,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, req.user.id, req.user.email, tier, billing, method, amount, 'pending',
        req.file?.filename ?? null, req.file?.originalname ?? null, now());
    notify('user', req.user.id, 'paymentPending');
    notify('admins', null, 'adminNewPayment');
    res.status(201).json({ id, status: 'pending' });
  });

  // dev gateway simulator (hosted-checkout stand-in)
  app.get('/api/pay/:session', (req, res) => {
    const p = db.prepare('SELECT * FROM payments WHERE gateway_session = ?').get(req.params.session);
    if (!p) return res.status(404).send('Unknown session');
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Rafiq Pay (dev gateway)</title>
<style>body{font-family:system-ui;background:#1a3a6b;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#fff;color:#1a3a6b;border-radius:16px;padding:32px;max-width:380px;text-align:center}
button{height:44px;border-radius:12px;border:0;font-weight:600;width:100%;margin-top:10px;cursor:pointer}
.ok{background:#1a3a6b;color:#fff}.no{background:#eee;color:#666}</style></head>
<body><div class="card"><h2>Dev payment gateway</h2>
<p>${p.tier.toUpperCase()} / ${p.billing} — <b>${p.amount.toLocaleString()} TL</b></p>
<p style="font-size:12px;color:#888">This page simulates the hosted card checkout. Activation happens only via the signed webhook.</p>
<form method="post" action="/api/pay/${req.params.session}/complete"><input type="hidden" name="outcome" value="success">
<button class="ok" type="submit">Pay ${p.amount.toLocaleString()} TL</button></form>
<form method="post" action="/api/pay/${req.params.session}/complete"><input type="hidden" name="outcome" value="fail">
<button class="no" type="submit">Cancel / fail payment</button></form></div></body></html>`);
  });

  app.post('/api/pay/:session/complete', express.urlencoded({ extended: false }), async (req, res) => {
    const p = db.prepare('SELECT * FROM payments WHERE gateway_session = ?').get(req.params.session);
    if (!p) return res.status(404).send('Unknown session');
    const outcome = req.body?.outcome === 'success' ? 'success' : 'fail';
    // deliver the signed webhook exactly like a real gateway would
    const payload = JSON.stringify({ paymentId: p.id, outcome });
    const signature = crypto.createHmac('sha256', cfg.webhookSecret).update(payload).digest('hex');
    try {
      await fetch(`http://${req.get('host')}/api/webhooks/payment`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-rafiq-signature': signature },
        body: payload,
      });
    } catch {
      /* webhook delivery failure leaves the payment pending */
    }
    res.redirect(`${cfg.appUrl}/checkout?result=${outcome === 'success' ? 'success' : 'failed'}&payment=${p.id}`);
  });

  // ---- documents (locker) -------------------------------------------------

  app.get('/api/documents', requireAuth, (req, res) => {
    const rows = db.prepare('SELECT id, name, mime, size, created_at FROM documents WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json({ documents: rows.map((d) => ({ id: d.id, name: d.name, mime: d.mime, size: d.size, uploadedAt: d.created_at })) });
  });

  app.post('/api/documents', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) return fail(res, 400, 'no_file');
    const id = uid('doc');
    db.prepare('INSERT INTO documents (id,user_id,name,path,mime,size,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, req.user.id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, now());
    res.status(201).json({ id });
  });

  app.get('/api/documents/:id/file', requireAuth, (req, res) => {
    const d = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    if (!d || d.user_id !== req.user.id) return fail(res, 404, 'not_found');
    const file = join(cfg.uploadsDir, d.path);
    if (!existsSync(file)) return fail(res, 404, 'not_found');
    res.type(d.mime);
    res.sendFile(file);
  });

  app.delete('/api/documents/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM documents WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ ok: true });
  });

  // ---- bookings -----------------------------------------------------------

  app.post('/api/bookings', requireAuth, (req, res) => {
    const { problemSummary, transcript, preferredDatetime, preferredLanguage } = req.body ?? {};
    if (typeof problemSummary !== 'string' || !problemSummary.trim()) return fail(res, 400, 'bad_summary');
    if (!Array.isArray(transcript)) return fail(res, 400, 'bad_transcript');
    if (!LANG_CODES.includes(preferredLanguage)) return fail(res, 400, 'bad_language');
    const when = new Date(String(preferredDatetime ?? ''));
    if (Number.isNaN(when.getTime()) || when <= new Date()) return fail(res, 400, 'past_datetime'); // P2-3
    const id = uid('bkg');
    db.prepare(`INSERT INTO bookings (id,user_id,user_email,problem_summary,transcript,preferred_datetime,preferred_language,status,created_at)
                VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(id, req.user.id, req.user.email, problemSummary.slice(0, 500), JSON.stringify(transcript), when.toISOString(), preferredLanguage, 'new', now());
    notify('user', req.user.id, 'bookingNew');
    notify('admins', null, 'adminNewBooking'); // P1-4: queued, not per-existing-admin
    res.status(201).json({ id });
  });

  app.get('/api/bookings/mine', requireAuth, (req, res) => {
    const rows = db.prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json({ bookings: rows.map(rowToBooking) });
  });

  function rowToBooking(b) {
    return {
      id: b.id,
      userId: b.user_id,
      userEmail: b.user_email,
      problemSummary: b.problem_summary,
      transcript: JSON.parse(b.transcript),
      preferredDatetime: b.preferred_datetime,
      preferredLanguage: b.preferred_language,
      status: b.status,
      internalNote: b.internal_note ?? undefined,
      createdAt: b.created_at,
    };
  }

  // ---- notifications (per-user read state, P1-4) --------------------------

  function visibleNotifications(user) {
    const isAdmin = user.role === 'admin';
    return db.prepare(`
      SELECT n.*, CASE WHEN r.user_id IS NULL THEN 0 ELSE 1 END AS is_read
      FROM notifications n
      LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = ?
      WHERE (n.audience = 'user' AND n.user_id = ?)
         OR n.audience = 'all'
         OR (n.audience = 'admins' AND ? = 1)
      ORDER BY n.created_at DESC
      LIMIT 200
    `).all(user.id, user.id, isAdmin ? 1 : 0);
  }

  function countUnread(user) {
    return visibleNotifications(user).filter((n) => !n.is_read).length;
  }

  app.get('/api/notifications', requireAuth, (req, res) => {
    res.json({
      notifications: visibleNotifications(req.user).map((n) => ({
        id: n.id,
        userId: n.user_id,
        key: n.key,
        customText: n.custom_text ?? undefined,
        read: !!n.is_read,
        createdAt: n.created_at,
      })),
    });
  });

  app.post('/api/notifications/read-all', requireAuth, (req, res) => {
    const stmt = db.prepare('INSERT OR IGNORE INTO notification_reads (notification_id, user_id) VALUES (?,?)');
    for (const n of visibleNotifications(req.user)) stmt.run(n.id, req.user.id);
    res.json({ ok: true });
  });

  // ---- leads (P1-3) -------------------------------------------------------

  app.post('/api/leads', requireAuth, (req, res) => {
    const { kind, item } = req.body ?? {};
    if (!['realestate', 'health'].includes(kind) || typeof item !== 'string' || !item.trim()) {
      return fail(res, 400, 'bad_lead');
    }
    const id = uid('lead');
    db.prepare('INSERT INTO leads (id,user_id,user_email,kind,item,status,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, req.user.id, req.user.email, kind, item.slice(0, 200), 'new', now());
    notify('user', req.user.id, 'leadReceived');
    notify('admins', null, 'adminNewLead');
    res.status(201).json({ id });
  });

  app.get('/api/leads/mine', requireAuth, (req, res) => {
    const rows = db.prepare('SELECT * FROM leads WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json({ leads: rows.map((l) => ({ id: l.id, kind: l.kind, item: l.item, status: l.status, createdAt: l.created_at })) });
  });

  // ---- referrals (P1-2) ---------------------------------------------------

  app.post('/api/referrals/click', (req, res) => {
    const code = String(req.body?.code ?? '').toUpperCase().slice(0, 12);
    if (code && db.prepare('SELECT 1 FROM users WHERE referral_code = ?').get(code)) {
      db.prepare('INSERT INTO referral_clicks (id, code, created_at) VALUES (?,?,?)').run(uid('rc'), code, now());
    }
    res.json({ ok: true });
  });

  app.get('/api/referrals/stats', requireAuth, (req, res) => {
    const code = req.user.referral_code;
    const clicks = db.prepare('SELECT COUNT(*) AS c FROM referral_clicks WHERE code = ?').get(code).c;
    const signups = db.prepare('SELECT COUNT(*) AS c FROM users WHERE referred_by = ?').get(req.user.id).c;
    const earned = db.prepare('SELECT COALESCE(SUM(amount_tl),0) AS s FROM referral_credits WHERE referrer_id = ?').get(req.user.id).s;
    res.json({ clicks, signups, earnedTl: earned, code });
  });

  // ---- listings (public real-estate catalogue, admin-managed) -------------

  app.get('/api/listings', (_req, res) => {
    const rows = db.prepare('SELECT * FROM listings ORDER BY sort ASC, created_at ASC').all();
    res.json({ listings: rows.map(rowToListing) });
  });

  // ---- places (server-enforced map data, admin-managed) -------------------

  app.get('/api/places', requireAuth, requirePro, (_req, res) => {
    const rows = db.prepare('SELECT * FROM places ORDER BY sort ASC, created_at ASC').all();
    res.json({ places: rows.map(rowToPlace) });
  });

  // ---- AI chat (P1-1) -----------------------------------------------------

  app.post('/api/ai/chat', requireAuth, async (req, res) => {
    const { messages, lang } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0) return fail(res, 400, 'bad_messages');
    const language = LANG_CODES.includes(lang) ? lang : 'en';
    const history = messages.slice(0, -1).filter((m) => m && typeof m.text === 'string');
    const userText = String(messages[messages.length - 1]?.text ?? '').slice(0, 4000);
    if (!userText.trim()) return fail(res, 400, 'bad_messages');

    // tier enforcement with a limited free preview (P3-5)
    const tier = getTier(req.user.id);
    let remaining = null;
    if (tier !== 'pro' && tier !== 'elite') {
      const used = db.prepare('SELECT count FROM ai_usage WHERE user_id = ?').get(req.user.id)?.count ?? 0;
      if (used >= cfg.freeChatMessages) return fail(res, 402, 'upgrade_required');
      db.prepare('INSERT INTO ai_usage (user_id, count) VALUES (?,1) ON CONFLICT(user_id) DO UPDATE SET count = count + 1')
        .run(req.user.id);
      remaining = cfg.freeChatMessages - used - 1;
    }

    let turn;
    if (cfg.anthropicKey) {
      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': cfg.anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: cfg.anthropicModel,
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: messages.slice(-20).map((m) => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: String(m.text ?? ''),
            })),
          }),
          signal: AbortSignal.timeout(30000),
        });
        if (!r.ok) throw new Error(`anthropic_${r.status}`);
        const data = await r.json();
        const text = data?.content?.find((c) => c.type === 'text')?.text ?? '';
        try {
          const parsed = JSON.parse(text.replace(/^```json?\s*|\s*```$/g, ''));
          turn = {
            reply: String(parsed.reply ?? text),
            offerBooking: !!parsed.offerBooking,
            problemSummary: String(parsed.problemSummary ?? ''),
          };
        } catch {
          turn = { reply: text, offerBooking: false, problemSummary: '' };
        }
      } catch {
        return fail(res, 503, 'ai_unavailable'); // client shows retry (P1-1)
      }
    } else {
      // deterministic dev fallback (no ANTHROPIC_API_KEY configured)
      turn = fallbackRespond(history, userText, language);
    }

    // server-side safety net per SYSTEM_PROMPT policy
    const triggers = policyTriggers(history, userText);
    const offerBooking = turn.offerBooking || triggers.asksHuman || triggers.isStuck;
    const problemSummary = turn.problemSummary || fallbackSummary(language, detectTopic(userText), userText);

    // basic streaming: SSE with text deltas, then a final metadata event
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders?.();
    const chunks = turn.reply.match(/.{1,40}/gs) ?? [turn.reply];
    for (const chunk of chunks) {
      res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
      await new Promise((r) => setTimeout(r, cfg.anthropicKey ? 0 : 25));
    }
    res.write(`data: ${JSON.stringify({ done: true, offerBooking, problemSummary, remaining })}\n\n`);
    res.end();
  });

  // ---- admin --------------------------------------------------------------

  app.get('/api/admin/users', requireAuth, requireAdmin, (_req, res) => {
    const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    const clicksOf = db.prepare('SELECT COUNT(*) AS c FROM referral_clicks WHERE code = ?');
    const signupsOf = db.prepare('SELECT COUNT(*) AS c FROM users WHERE referred_by = ?');
    const earnedOf = db.prepare('SELECT COALESCE(SUM(amount_tl),0) AS s FROM referral_credits WHERE referrer_id = ?');
    const bookingsOf = db.prepare('SELECT COUNT(*) AS c FROM bookings WHERE user_id = ?');
    const leadsOf = db.prepare('SELECT COUNT(*) AS c FROM leads WHERE user_id = ?');
    const paymentsOf = db.prepare("SELECT COUNT(*) AS c FROM payments WHERE user_id = ? AND status = 'verified'");
    res.json({
      users: users.map((u) => ({
        ...publicUser(u),
        tier: getTier(u.id),
        clicks: clicksOf.get(u.referral_code).c,
        signups: signupsOf.get(u.id).c,
        earnedTl: earnedOf.get(u.id).s,
        bookings: bookingsOf.get(u.id).c,
        leads: leadsOf.get(u.id).c,
        payments: paymentsOf.get(u.id).c,
      })),
    });
  });

  app.post('/api/admin/users/:id/tier', requireAuth, requireAdmin, (req, res) => {
    const { tier } = req.body ?? {};
    if (!['free', 'light', 'pro', 'elite'].includes(tier)) return fail(res, 400, 'bad_tier');
    // Answering ok for a made-up id created an orphan subscription row.
    const target = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!target) return fail(res, 404, 'user_not_found');
    if (tier === 'free') db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(target.id);
    else activateSubscription(target.id, tier, 'monthly');
    res.json({ ok: true, tier });
  });

  // History, not just the queue: ?status=pending|verified|rejected|all
  // (default pending, so the existing admin queue keeps its behaviour) plus
  // optional ?from/?to ISO date bounds, and the verified revenue of the slice.
  app.get('/api/admin/payments', requireAuth, requireAdmin, (req, res) => {
    const status = String(req.query.status ?? 'pending');
    if (!['pending', 'verified', 'rejected', 'all'].includes(status)) return fail(res, 400, 'bad_status');
    const clauses = [];
    const args = [];
    if (status !== 'all') {
      clauses.push('status = ?');
      args.push(status);
    }
    for (const [param, op] of [['from', '>='], ['to', '<=']]) {
      const value = req.query[param];
      if (value !== undefined) {
        if (Number.isNaN(Date.parse(String(value)))) return fail(res, 400, `bad_${param}`);
        clauses.push(`created_at ${op} ?`);
        args.push(new Date(String(value)).toISOString());
      }
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db.prepare(`SELECT * FROM payments ${where} ORDER BY created_at DESC`).all(...args);
    res.json({
      payments: rows.map((p) => ({
        id: p.id, email: p.email, tier: p.tier, billing: p.billing, method: p.method,
        amount: p.amount, status: p.status, hasReceipt: !!p.receipt_path,
        receiptName: p.receipt_name ?? undefined, createdAt: p.created_at,
      })),
      totalVerifiedTl: rows.filter((p) => p.status === 'verified').reduce((sum, p) => sum + p.amount, 0),
    });
  });

  app.post('/api/admin/payments/:id/resolve', requireAuth, requireAdmin, (req, res) => {
    // Explicit allow-list. The old code treated ANY unrecognised body as a
    // rejection and still answered 200 {ok:true} — {"action":"approve"}
    // silently rejected a real payment.
    const { status } = req.body ?? {};
    if (!['verified', 'rejected'].includes(status)) return fail(res, 400, 'bad_status');
    const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
    if (!p) return fail(res, 404, 'payment_not_found');
    if (status === 'verified') settleVerifiedPayment(p);
    else db.prepare("UPDATE payments SET status = 'rejected' WHERE id = ? AND status != 'verified'").run(p.id);
    const resolved = db.prepare('SELECT status FROM payments WHERE id = ?').get(p.id);
    res.json({ ok: true, status: resolved.status });
  });

  app.get('/api/admin/payments/:id/receipt', requireAuth, requireAdmin, (req, res) => {
    const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
    if (!p?.receipt_path) return fail(res, 404, 'not_found');
    const file = join(cfg.uploadsDir, p.receipt_path);
    if (!existsSync(file)) return fail(res, 404, 'not_found');
    res.sendFile(file);
  });

  app.get('/api/admin/bookings', requireAuth, requireAdmin, (_req, res) => {
    const rows = db.prepare('SELECT * FROM bookings ORDER BY created_at DESC').all();
    res.json({ bookings: rows.map(rowToBooking) });
  });

  app.get('/api/admin/bookings/new-count', requireAuth, requireAdmin, (_req, res) => {
    res.json({ count: db.prepare("SELECT COUNT(*) AS c FROM bookings WHERE status = 'new'").get().c });
  });

  app.post('/api/admin/bookings/:id/status', requireAuth, requireAdmin, (req, res) => {
    const { status } = req.body ?? {};
    if (!['new', 'confirmed', 'done', 'cancelled'].includes(status)) return fail(res, 400, 'bad_status');
    const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!b) return fail(res, 404, 'not_found');
    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, b.id);
    if (status === 'confirmed') notify('user', b.user_id, 'bookingConfirmed');
    res.json({ ok: true });
  });

  app.post('/api/admin/bookings/:id/note', requireAuth, requireAdmin, (req, res) => {
    db.prepare('UPDATE bookings SET internal_note = ? WHERE id = ?').run(String(req.body?.note ?? ''), req.params.id);
    res.json({ ok: true });
  });

  app.post('/api/admin/news', requireAuth, requireAdmin, (req, res) => {
    const text = String(req.body?.text ?? '').trim();
    if (!text) return fail(res, 400, 'bad_text');
    notify('all', null, 'custom', text.slice(0, 500));
    res.status(201).json({ ok: true });
  });

  app.get('/api/admin/news', requireAuth, requireAdmin, (_req, res) => {
    const rows = db.prepare("SELECT * FROM notifications WHERE audience = 'all' ORDER BY created_at DESC LIMIT 50").all();
    res.json({ broadcasts: rows.map((n) => ({ id: n.id, customText: n.custom_text, createdAt: n.created_at })) });
  });

  // ---- admin: currency rates override ------------------------------------

  app.get('/api/admin/rates', requireAuth, requireAdmin, (_req, res) => {
    const o = adminRatesOverride();
    res.json({ override: o, usdtry: o?.usdtry ?? null, eurtry: o?.eurtry ?? null, updatedAt: o?.updatedAt ?? null });
  });

  app.post('/api/admin/rates', requireAuth, requireAdmin, (req, res) => {
    const usdtry = Number(req.body?.usdtry);
    const eurtry = Number(req.body?.eurtry);
    if (!Number.isFinite(usdtry) || usdtry <= 0 || !Number.isFinite(eurtry) || eurtry <= 0) {
      return fail(res, 400, 'bad_rates');
    }
    setSetting('rates_override', JSON.stringify({ usdtry, eurtry, updatedAt: now() }));
    res.status(201).json({ ok: true });
  });

  app.delete('/api/admin/rates', requireAuth, requireAdmin, (_req, res) => {
    db.prepare("DELETE FROM settings WHERE key = 'rates_override'").run();
    res.json({ ok: true });
  });

  app.get('/api/admin/leads', requireAuth, requireAdmin, (_req, res) => {
    const rows = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
    res.json({
      leads: rows.map((l) => ({
        id: l.id, userEmail: l.user_email, kind: l.kind, item: l.item, status: l.status, createdAt: l.created_at,
      })),
    });
  });

  // ---- admin: real-estate listings CRUD -----------------------------------

  function parseListingBody(body) {
    const district = String(body?.district ?? '').trim();
    const rooms = String(body?.rooms ?? '').trim();
    const m2 = Math.round(Number(body?.m2));
    const priceUsd = Math.round(Number(body?.priceUsd));
    if (!district || !rooms || !Number.isFinite(m2) || m2 <= 0 || !Number.isFinite(priceUsd) || priceUsd <= 0) {
      return null;
    }
    const image = body?.image ? String(body.image).trim().slice(0, 500) : null;
    return { district: district.slice(0, 80), rooms: rooms.slice(0, 20), m2, priceUsd, citizenship: body?.citizenship ? 1 : 0, image };
  }

  app.get('/api/admin/listings', requireAuth, requireAdmin, (_req, res) => {
    const rows = db.prepare('SELECT * FROM listings ORDER BY sort ASC, created_at ASC').all();
    res.json({ listings: rows.map(rowToListing) });
  });

  app.post('/api/admin/listings', requireAuth, requireAdmin, (req, res) => {
    const v = parseListingBody(req.body);
    if (!v) return fail(res, 400, 'bad_listing');
    const id = uid('lst');
    const sort = (db.prepare('SELECT COALESCE(MAX(sort),0) AS m FROM listings').get().m ?? 0) + 1;
    db.prepare(`INSERT INTO listings (id,district,rooms,m2,price_usd,citizenship,image,sort,created_at)
                VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(id, v.district, v.rooms, v.m2, v.priceUsd, v.citizenship, v.image, sort, now());
    res.status(201).json({ id });
  });

  app.put('/api/admin/listings/:id', requireAuth, requireAdmin, (req, res) => {
    if (!db.prepare('SELECT 1 FROM listings WHERE id = ?').get(req.params.id)) return fail(res, 404, 'not_found');
    const v = parseListingBody(req.body);
    if (!v) return fail(res, 400, 'bad_listing');
    db.prepare('UPDATE listings SET district=?, rooms=?, m2=?, price_usd=?, citizenship=?, image=? WHERE id=?')
      .run(v.district, v.rooms, v.m2, v.priceUsd, v.citizenship, v.image, req.params.id);
    res.json({ ok: true });
  });

  app.delete('/api/admin/listings/:id', requireAuth, requireAdmin, (req, res) => {
    db.prepare('DELETE FROM listings WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ---- admin: map services (places) CRUD ----------------------------------

  function parsePlaceBody(body) {
    const name = String(body?.name ?? '').trim();
    const category = String(body?.category ?? '');
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    if (!name || !PLACE_CATEGORIES.includes(category)) return null;
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
    const address = body?.address ? String(body.address).trim().slice(0, 160) : null;
    return { name: name.slice(0, 120), category, lat, lng, address };
  }

  app.get('/api/admin/places', requireAuth, requireAdmin, (_req, res) => {
    const rows = db.prepare('SELECT * FROM places ORDER BY sort ASC, created_at ASC').all();
    res.json({ places: rows.map(rowToPlace) });
  });

  app.post('/api/admin/places', requireAuth, requireAdmin, (req, res) => {
    const v = parsePlaceBody(req.body);
    if (!v) return fail(res, 400, 'bad_place');
    const id = uid('plc');
    const sort = (db.prepare('SELECT COALESCE(MAX(sort),0) AS m FROM places').get().m ?? 0) + 1;
    db.prepare('INSERT INTO places (id,name,category,lat,lng,address,sort,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, v.name, v.category, v.lat, v.lng, v.address, sort, now());
    res.status(201).json({ id });
  });

  app.put('/api/admin/places/:id', requireAuth, requireAdmin, (req, res) => {
    if (!db.prepare('SELECT 1 FROM places WHERE id = ?').get(req.params.id)) return fail(res, 404, 'not_found');
    const v = parsePlaceBody(req.body);
    if (!v) return fail(res, 400, 'bad_place');
    db.prepare('UPDATE places SET name=?, category=?, lat=?, lng=?, address=? WHERE id=?')
      .run(v.name, v.category, v.lat, v.lng, v.address, req.params.id);
    res.json({ ok: true });
  });

  app.delete('/api/admin/places/:id', requireAuth, requireAdmin, (req, res) => {
    db.prepare('DELETE FROM places WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ---- error handler ------------------------------------------------------

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.message === 'bad_file_type') return fail(res, 400, 'bad_file_type');
    if (err?.code === 'LIMIT_FILE_SIZE') return fail(res, 400, 'file_too_large');
    console.error(err);
    fail(res, 500, 'server_error');
  });

  return app;
}

// ---------------------------------------------------------------- entry

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const cfg = loadConfig();
  if (cfg.webhookSecret === 'dev-webhook-secret-change-me') {
    console.warn('[rafiq] WARNING: using the default PAYMENT_WEBHOOK_SECRET — set it in .env for production.');
  }
  if (!cfg.anthropicKey) {
    console.warn('[rafiq] No ANTHROPIC_API_KEY set — AI chat uses the deterministic dev fallback.');
  }
  const db = openDb();
  seedAdmin(db, cfg);
  console.log(`[rafiq] Admin account ready — email: ${cfg.adminEmail} · password: ${cfg.adminPassword} (set ADMIN_PASSWORD to change)`);
  const app = createApp(db, cfg);
  app.listen(cfg.port, () => console.log(`[rafiq] API listening on http://localhost:${cfg.port}`));
}
