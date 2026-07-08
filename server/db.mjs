/**
 * SQLite persistence via the built-in node:sqlite module (no native deps).
 * The DB file lives in server/data/rafiq.db; tests can pass ':memory:'.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function openDb(file = join(__dirname, 'data', 'rafiq.db')) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      password_hash TEXT,
      provider      TEXT NOT NULL DEFAULT 'email',
      role          TEXT NOT NULL DEFAULT 'user',
      referral_code TEXT NOT NULL UNIQUE,
      referred_by   TEXT,
      created_at    TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY,
      data    TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      user_id        TEXT PRIMARY KEY,
      tier           TEXT NOT NULL,
      billing        TEXT NOT NULL,
      status         TEXT NOT NULL,
      started_at     TEXT NOT NULL,
      expires_at     TEXT NOT NULL,
      cancel_reason  TEXT,
      cancel_comment TEXT
    );
    CREATE TABLE IF NOT EXISTS payments (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      email           TEXT NOT NULL,
      tier            TEXT NOT NULL,
      billing         TEXT NOT NULL,
      method          TEXT NOT NULL,
      amount          INTEGER NOT NULL,
      status          TEXT NOT NULL,
      receipt_path    TEXT,
      receipt_name    TEXT,
      gateway_session TEXT,
      created_at      TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id                 TEXT PRIMARY KEY,
      user_id            TEXT NOT NULL,
      user_email         TEXT NOT NULL,
      problem_summary    TEXT NOT NULL,
      transcript         TEXT NOT NULL,
      preferred_datetime TEXT NOT NULL,
      preferred_language TEXT NOT NULL,
      status             TEXT NOT NULL DEFAULT 'new',
      internal_note      TEXT,
      created_at         TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id          TEXT PRIMARY KEY,
      audience    TEXT NOT NULL,            -- 'user' | 'all' | 'admins'
      user_id     TEXT,
      key         TEXT NOT NULL,
      custom_text TEXT,
      created_at  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notification_reads (
      notification_id TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      PRIMARY KEY (notification_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS documents (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      name       TEXT NOT NULL,
      path       TEXT NOT NULL,
      mime       TEXT NOT NULL,
      size       INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS leads (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      user_email TEXT NOT NULL,
      kind       TEXT NOT NULL,             -- 'realestate' | 'health'
      item       TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS referral_clicks (
      id         TEXT PRIMARY KEY,
      code       TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS referral_credits (
      id          TEXT PRIMARY KEY,
      referrer_id TEXT NOT NULL,
      payment_id  TEXT NOT NULL UNIQUE,
      amount_tl   INTEGER NOT NULL,
      created_at  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_usage (
      user_id TEXT PRIMARY KEY,
      count   INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS listings (
      id          TEXT PRIMARY KEY,
      district    TEXT NOT NULL,
      rooms       TEXT NOT NULL,
      m2          INTEGER NOT NULL,
      price_usd   INTEGER NOT NULL,
      citizenship INTEGER NOT NULL DEFAULT 0,
      image       TEXT,
      sort        INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS places (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      category   TEXT NOT NULL,
      lat        REAL NOT NULL,
      lng        REAL NOT NULL,
      address    TEXT,
      sort       INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return db;
}

export function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const now = () => new Date().toISOString();
