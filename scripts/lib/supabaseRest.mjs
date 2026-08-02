/**
 * Minimal Supabase REST + Storage client for one-off Node scripts (no
 * @supabase/supabase-js needed for this — same raw-fetch pattern already used
 * by api/cron/rates-sync.ts). Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 * from process.env (populated by `import 'dotenv/config'` from .env), so
 * every script here must never log these values.
 */

export function requireSupabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be set in .env to run this script.',
    );
  }
  return { url: url.replace(/\/$/, ''), key };
}

export async function restFetch({ url, key }, path, init = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase REST ${init.method ?? 'GET'} ${path} -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res;
}

/** Uploads a Buffer to Supabase Storage; returns its public URL. Overwrites on conflict. */
export async function uploadToStorage({ url, key }, bucket, path, buffer, contentType) {
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) {
    throw new Error(`Supabase Storage upload ${bucket}/${path} -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return `${url}/storage/v1/object/public/${bucket}/${path}`;
}
