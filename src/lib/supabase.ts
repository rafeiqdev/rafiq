import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client — reads the public project URL + anon key from env.
 * Guarded: if the keys aren't set yet, `supabase` is null and `supabaseEnabled`
 * is false, so the app keeps building/running until you paste your credentials.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
