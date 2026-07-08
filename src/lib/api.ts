/**
 * Typed API layer — now backed by Supabase (Auth + Postgres + Storage).
 *
 * The public surface (function names, arguments, return types) is unchanged from
 * the old Express client, so every page keeps working. All trust decisions live
 * in Postgres Row-Level-Security + SECURITY DEFINER functions; this module only
 * transports data. Errors surface as ApiError with a machine-readable `code`.
 */
import { supabase as sbClient } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ServiceItem } from '../data/services';
import { fallbackRespond } from './ai-fallback';
import type {
  AdminUser,
  AppConfig,
  AppNotification,
  Billing,
  Booking,
  BookingStatus,
  ChatMessage,
  Company,
  CompanyDoc,
  CompanyInput,
  CompanyLead,
  CompanyPayMethod,
  CompanyPayment,
  CompanyPublic,
  CompanyResponse,
  CompanyStatus,
  CustomerRequest,
  Lead,
  Listing,
  MeResponse,
  PayMethod,
  PaymentRequest,
  Place,
  PlanTier,
  Profile,
  Review,
  StoredDocument,
  Subscription,
  User,
} from './types';
import { COMPANY_PLAN_PRICE } from './types';

/** Listing/place fields the admin form submits (no id). */
export type ListingInput = Omit<Listing, 'id'>;
export type PlaceInput = Omit<Place, 'id'>;

export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

const FREE_CHAT_MESSAGES = 3;

function sb(): SupabaseClient {
  if (!sbClient) throw new ApiError('supabase_not_configured', 503);
  return sbClient;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sessionUser() {
  const { data } = await sb().auth.getSession();
  return data.session?.user ?? null;
}

async function requireUid(): Promise<string> {
  const u = await sessionUser();
  if (!u) throw new ApiError('not_authenticated', 401);
  return u.id;
}

/** Translate a Supabase/PostgREST error into a stable ApiError code. */
function fail(error: { message?: string } | null, fallback = 'server_error', status = 500): never {
  const msg = (error?.message ?? '').toLowerCase();
  if (msg.includes('invalid login')) throw new ApiError('wrong_password', 400);
  if (msg.includes('already registered') || msg.includes('already been registered')) throw new ApiError('email_exists', 400);
  if (msg.includes('password should be') || msg.includes('weak')) throw new ApiError('weak_password', 400);
  if (msg.includes('unable to validate email') || msg.includes('invalid email')) throw new ApiError('bad_email', 400);
  if (msg.includes('not_admin')) throw new ApiError('forbidden', 403);
  if (msg.includes('not_authenticated')) throw new ApiError('not_authenticated', 401);
  throw new ApiError(fallback, status);
}

// ---------- row mappers ------------------------------------------------------

interface ListingRow {
  id: string; district: string; rooms: string; m2: number; price_usd: number; citizenship: boolean;
  image: string | null; description: string | null; bathrooms: number | null; furnished: boolean; images: string[] | null;
}
const toListing = (r: ListingRow): Listing => ({
  id: r.id, district: r.district, rooms: r.rooms, m2: r.m2, priceUsd: r.price_usd, citizenship: r.citizenship,
  image: r.image, description: r.description, bathrooms: r.bathrooms, furnished: r.furnished, images: r.images ?? [],
});
const fromListing = (l: ListingInput) => ({
  district: l.district, rooms: l.rooms, m2: l.m2, price_usd: l.priceUsd, citizenship: l.citizenship,
  image: l.image || null, description: l.description || null, bathrooms: l.bathrooms ?? null,
  furnished: l.furnished ?? false, images: l.images ?? [],
});

interface PlaceRow { id: string; name: string; category: string; lat: number; lng: number; address: string | null; }
const toPlace = (r: PlaceRow): Place => ({ id: r.id, name: r.name, category: r.category, lat: r.lat, lng: r.lng, address: r.address });
const fromPlace = (p: PlaceInput) => ({ name: p.name, category: p.category, lat: p.lat, lng: p.lng, address: p.address || null });

interface BookingRow {
  id: string; user_id: string; user_email: string | null; problem_summary: string; transcript: ChatMessage[];
  preferred_datetime: string; preferred_language: string; status: BookingStatus; internal_note: string | null; created_at: string;
}
const toBooking = (r: BookingRow): Booking => ({
  id: r.id, userId: r.user_id, userEmail: r.user_email ?? '', problemSummary: r.problem_summary,
  transcript: Array.isArray(r.transcript) ? r.transcript : [], preferredDatetime: r.preferred_datetime,
  preferredLanguage: r.preferred_language as Booking['preferredLanguage'], status: r.status,
  internalNote: r.internal_note ?? undefined, createdAt: r.created_at,
});

interface LeadRow { id: string; user_email: string | null; kind: string; item: string; status: string; created_at: string; }
const toLead = (r: LeadRow): Lead => ({
  id: r.id, userEmail: r.user_email ?? undefined, kind: r.kind as Lead['kind'], item: r.item, status: r.status, createdAt: r.created_at,
});

// ---------- entitlement helpers ---------------------------------------------

interface SubRow { tier: PlanTier; billing: Billing; status: Subscription['status']; started_at: string; expires_at: string; cancel_reason: string | null; cancel_comment: string | null; }

function entitledTier(sub: SubRow | null): PlanTier {
  if (!sub) return 'free';
  const active = (sub.status === 'active' || sub.status === 'cancelled') && new Date(sub.expires_at) > new Date();
  return active ? sub.tier : 'free';
}

async function isProOrAdmin(uid: string): Promise<boolean> {
  const c = sb();
  const { data: prof } = await c.from('profiles').select('role').eq('id', uid).maybeSingle();
  if (prof?.role === 'admin') return true;
  const { data: sub } = await c.from('subscriptions').select('tier,billing,status,started_at,expires_at,cancel_reason,cancel_comment').eq('user_id', uid).maybeSingle();
  const tier = entitledTier(sub as SubRow | null);
  return tier === 'pro' || tier === 'elite';
}

// ---------- config / session -------------------------------------------------

export const config = {
  // Google sign-in is handled by Supabase OAuth (no client id needed in the browser).
  get: async (): Promise<AppConfig> => ({ googleClientId: null, freeChatMessages: FREE_CHAT_MESSAGES }),
};

export const auth = {
  async register(email: string, password: string, name: string, refCode?: string): Promise<{ user: User | null; needsConfirmation: boolean }> {
    const { data, error } = await sb().auth.signUp({
      email,
      password,
      options: { data: { name, ref_code: refCode ?? '' }, emailRedirectTo: window.location.origin },
    });
    if (error) fail(error);
    if (data.session) {
      const me = await auth.me();
      return { user: me.user, needsConfirmation: false };
    }
    // email confirmation is enabled → no session yet
    return { user: null, needsConfirmation: true };
  },

  async login(email: string, password: string): Promise<{ user: User | null }> {
    const { error } = await sb().auth.signInWithPassword({ email, password });
    if (error) fail(error);
    const me = await auth.me();
    return { user: me.user };
  },

  /** Google via Supabase OAuth — full-page redirect; session is detected on return. */
  async loginGoogle(): Promise<void> {
    const { error } = await sb().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) fail(error);
  },

  async logout(): Promise<{ ok: true }> {
    await sb().auth.signOut();
    return { ok: true };
  },

  async me(): Promise<MeResponse> {
    const u = await sessionUser();
    if (!u) return { user: null };
    const c = sb();
    const [{ data: prof }, { data: sub }] = await Promise.all([
      c.from('profiles').select('id,email,name,role,referral_code,onboarding,created_at').eq('id', u.id).maybeSingle(),
      c.from('subscriptions').select('tier,billing,status,started_at,expires_at,cancel_reason,cancel_comment').eq('user_id', u.id).maybeSingle(),
    ]);
    if (!prof) return { user: null };

    const subRow = (sub as SubRow | null) ?? null;
    const tier = entitledTier(subRow);
    const providerRaw = (u.app_metadata?.provider as string) ?? 'email';
    const role = (prof.role as User['role']) ?? 'user';
    const user: User = {
      id: prof.id,
      email: prof.email ?? u.email ?? '',
      name: prof.name ?? (prof.email ?? '').split('@')[0],
      provider: providerRaw === 'google' ? 'google' : 'email',
      isAdmin: role === 'admin',
      role,
      isCompany: role === 'company',
      referralCode: prof.referral_code ?? '',
      createdAt: prof.created_at,
    };
    const subscription: Subscription | null = subRow
      ? {
          userId: u.id, tier: subRow.tier, billing: subRow.billing, status: subRow.status,
          startedAt: subRow.started_at, expiresAt: subRow.expires_at,
          cancelReason: subRow.cancel_reason ?? undefined, cancelComment: subRow.cancel_comment ?? undefined,
        }
      : null;

    // unread notifications = visible − read
    const [{ data: notifs }, { data: reads }] = await Promise.all([
      c.from('notifications').select('id'),
      c.from('notification_reads').select('notification_id').eq('user_id', u.id),
    ]);
    const readSet = new Set((reads ?? []).map((r: { notification_id: string }) => r.notification_id));
    const unread = (notifs ?? []).filter((n: { id: string }) => !readSet.has(n.id)).length;

    const profile = (prof.onboarding as Profile | null) ?? null;
    return { user, subscription, tier, unread, profile };
  },
};

export const profileApi = {
  async save(data: Profile): Promise<{ ok: true }> {
    const uid = await requireUid();
    const { error } = await sb().from('profiles').update({ onboarding: data }).eq('id', uid);
    if (error) fail(error);
    return { ok: true };
  },
};

// ---------- subscriptions / payments ----------------------------------------

export const subscriptions = {
  async cancel(reason: string, comment: string): Promise<{ subscription: unknown }> {
    const { error } = await sb().rpc('cancel_my_subscription', { p_reason: reason, p_comment: comment });
    if (error) fail(error);
    return { subscription: null };
  },
};

const DEFAULT_CHECKOUT = {
  iban: 'TR00 0000 0000 0000 0000 0000 00',
  holder: 'Rafiq Istanbul',
  wallet: 'TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  network: 'TRC20 (USDT)',
};

function planAmount(tier: PlanTier, billing: Billing): number {
  const monthly: Record<string, number> = { light: 799, pro: 1599, elite: 3199 };
  return (monthly[tier] ?? 0) * (billing === 'annual' ? 10 : 1);
}

export const checkout = {
  async config(): Promise<{ iban: string; holder: string; wallet: string; network: string }> {
    const { data } = await sb().from('settings').select('value').eq('key', 'checkout').maybeSingle();
    return { ...DEFAULT_CHECKOUT, ...((data?.value as object) ?? {}) };
  },

  async manual(tier: PlanTier, billing: Billing, method: PayMethod, receipt?: File): Promise<{ id: string; status: string }> {
    const uid = await requireUid();
    const c = sb();
    const { data: prof } = await c.from('profiles').select('email').eq('id', uid).maybeSingle();
    let receiptPath: string | null = null;
    let receiptName: string | null = null;
    if (receipt) {
      const path = `${uid}/${Date.now()}-${receipt.name}`;
      const up = await c.storage.from('receipts').upload(path, receipt, { upsert: false });
      if (!up.error) {
        receiptPath = path;
        receiptName = receipt.name;
      }
    }
    const { data, error } = await c
      .from('payments')
      .insert({
        user_id: uid, email: prof?.email ?? null, tier, billing, method,
        amount: planAmount(tier, billing), status: 'pending', receipt_path: receiptPath, receipt_name: receiptName,
      })
      .select('id,status')
      .single();
    if (error) fail(error);
    return { id: data!.id, status: data!.status };
  },

  async paymentStatus(id: string): Promise<{ id: string; status: string; tier: PlanTier; billing: Billing; amount: number }> {
    const { data, error } = await sb().from('payments').select('id,status,tier,billing,amount').eq('id', id).maybeSingle();
    if (error || !data) throw new ApiError('not_found', 404);
    return { id: data.id, status: data.status, tier: data.tier, billing: data.billing, amount: data.amount };
  },
};

// ---------- bookings ---------------------------------------------------------

export const bookings = {
  async create(input: { problemSummary: string; transcript: ChatMessage[]; preferredDatetime: string; preferredLanguage: string }): Promise<{ id: string }> {
    const uid = await requireUid();
    const c = sb();
    const dt = new Date(input.preferredDatetime);
    if (Number.isNaN(dt.getTime()) || dt <= new Date()) throw new ApiError('past_datetime', 400);
    const { data: prof } = await c.from('profiles').select('email').eq('id', uid).maybeSingle();
    const { data, error } = await c
      .from('bookings')
      .insert({
        user_id: uid, user_email: prof?.email ?? null, problem_summary: input.problemSummary,
        transcript: input.transcript, preferred_datetime: dt.toISOString(), preferred_language: input.preferredLanguage,
      })
      .select('id')
      .single();
    if (error) fail(error);
    return { id: data!.id };
  },
  async mine(): Promise<Booking[]> {
    const { data, error } = await sb().from('bookings').select('*').order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as BookingRow[]).map(toBooking);
  },
  async adminList(): Promise<Booking[]> {
    const { data, error } = await sb().from('bookings').select('*').order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as BookingRow[]).map(toBooking);
  },
  async newCount(): Promise<number> {
    const { count, error } = await sb().from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'new');
    if (error) return 0;
    return count ?? 0;
  },
  async setStatus(id: string, status: BookingStatus): Promise<{ ok: true }> {
    const { error } = await sb().from('bookings').update({ status }).eq('id', id);
    if (error) fail(error);
    return { ok: true };
  },
  async setNote(id: string, note: string): Promise<{ ok: true }> {
    const { error } = await sb().from('bookings').update({ internal_note: note }).eq('id', id);
    if (error) fail(error);
    return { ok: true };
  },
};

// ---------- notifications ----------------------------------------------------

interface NotifRow { id: string; audience: string; user_id: string | null; key: string; custom_text: string | null; created_at: string; }

export const notifications = {
  async list(): Promise<AppNotification[]> {
    const uid = await requireUid();
    const c = sb();
    const [{ data: notifs, error }, { data: reads }] = await Promise.all([
      c.from('notifications').select('id,audience,user_id,key,custom_text,created_at').order('created_at', { ascending: false }),
      c.from('notification_reads').select('notification_id').eq('user_id', uid),
    ]);
    if (error) fail(error);
    const readSet = new Set((reads ?? []).map((r: { notification_id: string }) => r.notification_id));
    return (notifs as NotifRow[]).map((n) => ({
      id: n.id, userId: n.user_id, key: n.key, customText: n.custom_text ?? undefined,
      read: readSet.has(n.id), createdAt: n.created_at,
    }));
  },
  async markAllRead(): Promise<{ ok: true }> {
    const uid = await requireUid();
    const c = sb();
    const [{ data: notifs }, { data: reads }] = await Promise.all([
      c.from('notifications').select('id'),
      c.from('notification_reads').select('notification_id').eq('user_id', uid),
    ]);
    const readSet = new Set((reads ?? []).map((r: { notification_id: string }) => r.notification_id));
    const rows = (notifs ?? [])
      .filter((n: { id: string }) => !readSet.has(n.id))
      .map((n: { id: string }) => ({ notification_id: n.id, user_id: uid }));
    if (rows.length) {
      const { error } = await c.from('notification_reads').upsert(rows, { onConflict: 'notification_id,user_id' });
      if (error) fail(error);
    }
    return { ok: true };
  },
  async publish(text: string): Promise<{ ok: true }> {
    const { error } = await sb().from('notifications').insert({ audience: 'all', key: 'custom', custom_text: text });
    if (error) fail(error);
    return { ok: true };
  },
  async broadcasts(): Promise<{ id: string; customText: string; createdAt: string }[]> {
    const { data, error } = await sb()
      .from('notifications')
      .select('id,custom_text,created_at')
      .eq('key', 'custom')
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as { id: string; custom_text: string | null; created_at: string }[]).map((b) => ({
      id: b.id, customText: b.custom_text ?? '', createdAt: b.created_at,
    }));
  },
};

// ---------- documents (Supabase Storage, private bucket) --------------------

interface DocRow { id: string; name: string; storage_path: string; mime: string | null; size: number | null; created_at: string; }

export const documents = {
  async list(): Promise<StoredDocument[]> {
    const { data, error } = await sb().from('documents').select('id,name,storage_path,mime,size,created_at').order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as DocRow[]).map((d) => ({ id: d.id, name: d.name, mime: d.mime ?? undefined, size: d.size ?? undefined, uploadedAt: d.created_at }));
  },
  async upload(file: File): Promise<{ id: string }> {
    const uid = await requireUid();
    const c = sb();
    const path = `${uid}/${Date.now()}-${file.name}`;
    const up = await c.storage.from('documents').upload(path, file, { upsert: false });
    if (up.error) fail(up.error);
    const { data, error } = await c
      .from('documents')
      .insert({ user_id: uid, name: file.name, storage_path: path, mime: file.type || null, size: file.size })
      .select('id')
      .single();
    if (error) fail(error);
    return { id: data!.id };
  },
  /** Open a private document in a new tab via a short-lived signed URL. */
  async open(id: string): Promise<void> {
    const c = sb();
    const { data: row } = await c.from('documents').select('storage_path').eq('id', id).maybeSingle();
    if (!row) return;
    const { data } = await c.storage.from('documents').createSignedUrl(row.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  },
  async remove(id: string): Promise<{ ok: true }> {
    const c = sb();
    const { data: row } = await c.from('documents').select('storage_path').eq('id', id).maybeSingle();
    if (row?.storage_path) await c.storage.from('documents').remove([row.storage_path]);
    const { error } = await c.from('documents').delete().eq('id', id);
    if (error) fail(error);
    return { ok: true };
  },
};

// ---------- leads ------------------------------------------------------------

export const leads = {
  async create(kind: 'realestate' | 'health', item: string): Promise<{ id: string }> {
    const uid = await requireUid();
    const c = sb();
    const { data: prof } = await c.from('profiles').select('email').eq('id', uid).maybeSingle();
    const { data, error } = await c.from('leads').insert({ user_id: uid, user_email: prof?.email ?? null, kind, item }).select('id').single();
    if (error) fail(error);
    return { id: data!.id };
  },
  async mine(): Promise<Lead[]> {
    const { data, error } = await sb().from('leads').select('*').order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as LeadRow[]).map(toLead);
  },
  async adminList(): Promise<Lead[]> {
    const { data, error } = await sb().from('leads').select('*').order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as LeadRow[]).map(toLead);
  },
};

// ---------- referrals --------------------------------------------------------

export interface ReferralStats {
  clicks: number;
  signups: number;
  earnedTl: number;
  code: string;
}

export const referrals = {
  async stats(): Promise<ReferralStats> {
    const { data, error } = await sb().rpc('my_referral_stats');
    if (error) fail(error);
    const row = (Array.isArray(data) ? data[0] : data) as { clicks: number; signups: number; earned_tl: number; code: string } | undefined;
    return { clicks: row?.clicks ?? 0, signups: row?.signups ?? 0, earnedTl: row?.earned_tl ?? 0, code: row?.code ?? '' };
  },
  async click(code: string): Promise<{ ok: true }> {
    const { error } = await sb().from('referral_clicks').insert({ code: code.toUpperCase() });
    if (error) fail(error);
    return { ok: true };
  },
  /** Attribute a stored referral code to the current user once (post-signup). */
  async attributeSelf(code: string): Promise<void> {
    await sb().rpc('attribute_referral', { p_code: code });
  },
};

// ---------- admin: users -----------------------------------------------------

interface OverviewRow {
  id: string; email: string | null; name: string | null; provider: string; is_admin: boolean;
  referral_code: string | null; created_at: string; tier: PlanTier;
  clicks: number; signups: number; earned_tl: number; bookings: number; leads: number; payments: number;
}

export const adminUsers = {
  async list(): Promise<AdminUser[]> {
    const { data, error } = await sb().rpc('admin_users_overview');
    if (error) fail(error);
    return (data as OverviewRow[]).map((r) => ({
      id: r.id, email: r.email ?? '', name: r.name ?? (r.email ?? '').split('@')[0],
      provider: r.provider === 'google' ? 'google' : 'email', isAdmin: r.is_admin,
      role: r.is_admin ? 'admin' : 'user', isCompany: false,
      referralCode: r.referral_code ?? '', createdAt: r.created_at, tier: r.tier,
      clicks: r.clicks, signups: r.signups, earnedTl: r.earned_tl, bookings: r.bookings, leads: r.leads, payments: r.payments,
    }));
  },
  async setTier(id: string, tier: PlanTier): Promise<{ ok: true }> {
    const { error } = await sb().rpc('admin_set_tier', { p_user: id, p_tier: tier });
    if (error) fail(error);
    return { ok: true };
  },
  /** Cancelled subscriptions with the reason/comment the user left when cancelling. */
  async cancellations(): Promise<{ userId: string; tier: string; reason: string | null; comment: string | null; expiresAt: string }[]> {
    const { data, error } = await sb().from('subscriptions')
      .select('user_id,tier,status,expires_at,cancel_reason,cancel_comment')
      .eq('status','cancelled').order('expires_at',{ascending:false});
    if (error) fail(error);
    return (data ?? []).map((r:any) => ({ userId: r.user_id, tier: r.tier, reason: r.cancel_reason ?? null, comment: r.cancel_comment ?? null, expiresAt: r.expires_at }));
  },
  /** Full per-user detail for the admin: onboarding profile + their activity. */
  async detail(userId: string): Promise<{ onboarding: Profile | null; bookings: Booking[]; leads: Lead[] }> {
    const c = sb();
    const [{ data: prof }, { data: bk }, { data: ld }] = await Promise.all([
      c.from('profiles').select('onboarding').eq('id', userId).maybeSingle(),
      c.from('bookings').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      c.from('leads').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ]);
    return {
      onboarding: (prof?.onboarding as Profile | null) ?? null,
      bookings: ((bk as BookingRow[]) ?? []).map(toBooking),
      leads: ((ld as LeadRow[]) ?? []).map(toLead),
    };
  },
};

// ---------- real-estate listings (public read, admin write) -----------------

export const listings = {
  async list(): Promise<Listing[]> {
    const { data, error } = await sb().from('listings').select('*').order('sort', { ascending: true });
    if (error) fail(error);
    return (data as ListingRow[]).map(toListing);
  },
  async adminList(): Promise<Listing[]> {
    return listings.list();
  },
  /** Admin: upload a listing photo to the public 'listings' bucket → public URL. */
  async uploadImage(file: File): Promise<string> {
    const c = sb();
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const up = await c.storage.from('listings').upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (up.error) fail(up.error);
    return c.storage.from('listings').getPublicUrl(path).data.publicUrl;
  },
  async create(input: ListingInput): Promise<{ id: string }> {
    const { data, error } = await sb().from('listings').insert(fromListing(input)).select('id').single();
    if (error) fail(error);
    return { id: data!.id };
  },
  async update(id: string, input: ListingInput): Promise<{ ok: true }> {
    const { error } = await sb().from('listings').update(fromListing(input)).eq('id', id);
    if (error) fail(error);
    return { ok: true };
  },
  async remove(id: string): Promise<{ ok: true }> {
    const { error } = await sb().from('listings').delete().eq('id', id);
    if (error) fail(error);
    return { ok: true };
  },
};

// ---------- admin: currency rates override ----------------------------------

interface RatesValue { usdtry: number; eurtry: number; sypusd?: number; updatedAt: string; }

export const adminRates = {
  async get(): Promise<{ usdtry: number | null; eurtry: number | null; sypusd: number | null; updatedAt: string | null }> {
    const { data } = await sb().from('settings').select('value').eq('key', 'rates').maybeSingle();
    const v = data?.value as RatesValue | undefined;
    return { usdtry: v?.usdtry ?? null, eurtry: v?.eurtry ?? null, sypusd: v?.sypusd ?? null, updatedAt: v?.updatedAt ?? null };
  },
  async set(usdtry: number, eurtry: number, sypusd?: number): Promise<{ ok: true }> {
    const value: RatesValue = { usdtry, eurtry, sypusd: sypusd && sypusd > 0 ? sypusd : undefined, updatedAt: new Date().toISOString() };
    const { error } = await sb().from('settings').upsert({ key: 'rates', value }, { onConflict: 'key' });
    if (error) fail(error);
    return { ok: true };
  },
  async clear(): Promise<{ ok: true }> {
    const { error } = await sb().from('settings').delete().eq('key', 'rates');
    if (error) fail(error);
    return { ok: true };
  },
};

// ── Admin-editable service catalog (stored in settings.service_catalog) ──────
// Overrides layer on top of the static catalog: edit text, hide, or add services.
export interface CatalogOverrides {
  edits?: Record<string, Partial<Pick<ServiceItem, 'title' | 'desc' | 'category' | 'type' | 'icon' | 'onRequest'>>>;
  hidden?: string[];
  added?: ServiceItem[];
}

export async function fetchCatalogOverrides(): Promise<CatalogOverrides | null> {
  const { data } = await sb().from('settings').select('value').eq('key', 'service_catalog').maybeSingle();
  return (data?.value as CatalogOverrides | undefined) ?? null;
}

export const adminCatalog = {
  async get(): Promise<CatalogOverrides> {
    return (await fetchCatalogOverrides()) ?? {};
  },
  async save(value: CatalogOverrides): Promise<{ ok: true }> {
    const { error } = await sb().from('settings').upsert({ key: 'service_catalog', value }, { onConflict: 'key' });
    if (error) fail(error);
    return { ok: true };
  },
};

// ---------- map services / places (admin-managed) ---------------------------

export const adminPlaces = {
  async list(): Promise<Place[]> {
    const { data, error } = await sb().from('places').select('*').order('sort', { ascending: true });
    if (error) fail(error);
    return (data as PlaceRow[]).map(toPlace);
  },
  async create(input: PlaceInput): Promise<{ id: string }> {
    const { data, error } = await sb().from('places').insert(fromPlace(input)).select('id').single();
    if (error) fail(error);
    return { id: data!.id };
  },
  async update(id: string, input: PlaceInput): Promise<{ ok: true }> {
    const { error } = await sb().from('places').update(fromPlace(input)).eq('id', id);
    if (error) fail(error);
    return { ok: true };
  },
  async remove(id: string): Promise<{ ok: true }> {
    const { error } = await sb().from('places').delete().eq('id', id);
    if (error) fail(error);
    return { ok: true };
  },
};

// ---------- admin: payments --------------------------------------------------

interface PaymentRow {
  id: string; email: string | null; tier: PlanTier; billing: Billing; method: PayMethod; amount: number;
  status: PaymentRequest['status']; receipt_path: string | null; receipt_name: string | null; created_at: string;
}

export const adminPayments = {
  async pending(): Promise<PaymentRequest[]> {
    const { data, error } = await sb()
      .from('payments')
      .select('id,email,tier,billing,method,amount,status,receipt_path,receipt_name,created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as PaymentRow[]).map((p) => ({
      id: p.id, email: p.email ?? '', tier: p.tier, billing: p.billing, method: p.method, amount: p.amount,
      status: p.status, hasReceipt: !!p.receipt_path, receiptName: p.receipt_name ?? undefined, createdAt: p.created_at,
    }));
  },
  async resolve(id: string, status: 'verified' | 'rejected'): Promise<{ ok: true }> {
    const { error } = await sb().rpc('admin_resolve_payment', { p_id: id, p_status: status });
    if (error) fail(error);
    return { ok: true };
  },
  /** Open a payment receipt via a short-lived signed URL (admin). */
  async openReceipt(id: string): Promise<void> {
    const c = sb();
    const { data: row } = await c.from('payments').select('receipt_path').eq('id', id).maybeSingle();
    if (!row?.receipt_path) return;
    const { data } = await c.storage.from('receipts').createSignedUrl(row.receipt_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  },
};

// ---------- places (Pro/Elite, enforced by RLS) -----------------------------

export const places = {
  async list(): Promise<Place[]> {
    const uid = await requireUid();
    if (!(await isProOrAdmin(uid))) throw new ApiError('payment_required', 402);
    const { data, error } = await sb().from('places').select('*').order('sort', { ascending: true });
    if (error) fail(error);
    return (data as PlaceRow[]).map(toPlace);
  },
};

// ---------- service requests (new services catalog → leads) -----------------

export interface ServiceRequestInput {
  name: string;
  phone: string;
  message?: string;
  serviceId: string;
  serviceTitle: string;
  category: string;
  serviceType: string;
  lang: string;
  /** customer's Istanbul district id — used to match broadcast companies */
  area?: string;
  /** when true (partner service + logged-in customer) the request fans out to
   *  every matching active company. customer_id auto-stamps via a column default. */
  broadcast?: boolean;
}

export interface ServiceRequest {
  id: string;
  name: string;
  phone: string;
  message?: string;
  serviceTitle: string;
  category: string;
  serviceType: string;
  status: string;
  createdAt: string;
}

interface ServiceRequestRow {
  id: string; name: string; phone: string; message: string | null;
  service_title: string | null; category: string | null; service_type: string | null;
  status: string; created_at: string;
}

export const serviceRequests = {
  /**
   * Anyone (even logged-out visitors) can submit — RLS allows anonymous insert.
   * No `.select()` read-back: reads are admin-only (keeps names/phones private),
   * and a read-back would fail RLS for the anonymous/non-admin submitter.
   */
  async create(input: ServiceRequestInput): Promise<{ ok: true }> {
    const { error } = await sb()
      .from('service_requests')
      .insert({
        name: input.name,
        phone: input.phone,
        message: input.message ?? null,
        service_id: input.serviceId,
        service_title: input.serviceTitle,
        category: input.category,
        service_type: input.serviceType,
        lang: input.lang,
        area: input.area ?? null,
        broadcast: input.broadcast ?? false,
        // customer_id is stamped server-side via the column DEFAULT auth.uid()
      });
    if (error) fail(error);
    return { ok: true };
  },
  async adminList(): Promise<ServiceRequest[]> {
    const { data, error } = await sb()
      .from('service_requests')
      .select('id,name,phone,message,service_title,category,service_type,status,created_at')
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as ServiceRequestRow[]).map((r) => ({
      id: r.id, name: r.name, phone: r.phone, message: r.message ?? undefined,
      serviceTitle: r.service_title ?? '', category: r.category ?? '', serviceType: r.service_type ?? '',
      status: r.status, createdAt: r.created_at,
    }));
  },
};

// ---------- Pro self-help guides (server-gated content) ---------------------

export interface GuideContent {
  problem?: string;
  steps?: string[];
  documents?: string[];
  where?: string[];
  links?: { label: string; url: string }[];
  cost?: string;
  duration?: string;
  mistakes?: string[];
  whenGetHelp?: string;
}
export interface GuideResult {
  found: boolean;
  locked?: boolean;
  slug?: string;
  lang?: string;
  diyLevel?: 'yes' | 'partial' | 'expert';
  content?: GuideContent;
}

export const guides = {
  /** Full guide for pro/elite/admin, else a first-step preview — decided server-side. */
  async get(slug: string, lang: string): Promise<GuideResult> {
    const { data, error } = await sb().rpc('get_guide', { p_slug: slug, p_lang: lang });
    if (error) fail(error);
    return (data ?? { found: false }) as GuideResult;
  },
  /** Slugs that have a published guide (for showing a "guide available" hint). */
  async publishedSlugs(): Promise<Set<string>> {
    const { data, error } = await sb().rpc('published_guide_slugs');
    if (error) return new Set();
    return new Set(((data ?? []) as { service_slug: string }[]).map((r) => r.service_slug));
  },
};

// ---------- AI chat (client-side policy, simulated streaming) ----------------

export interface ChatResult {
  reply: string;
  offerBooking: boolean;
  problemSummary: string;
  remaining: number | null;
}

export const ai = {
  async chat(messages: ChatMessage[], lang: string, onDelta: (text: string) => void): Promise<ChatResult> {
    const uid = await requireUid();
    const c = sb();

    let remaining: number | null = null;
    if (!(await isProOrAdmin(uid))) {
      const { data: usage } = await c.from('ai_usage').select('count').eq('user_id', uid).maybeSingle();
      const used = usage?.count ?? 0;
      if (used >= FREE_CHAT_MESSAGES) throw new ApiError('payment_required', 402);
      const next = used + 1;
      await c.from('ai_usage').upsert({ user_id: uid, count: next }, { onConflict: 'user_id' });
      remaining = Math.max(0, FREE_CHAT_MESSAGES - next);
    }

    // Real AI via the Gemini-backed Edge Function; gracefully fall back to the
    // deterministic responder if it's unavailable (no key / quota / network).
    let reply = '';
    let offerBooking = false;
    let problemSummary = '';
    try {
      const { data, error } = await c.functions.invoke('ai-chat', {
        body: { messages: messages.map((m) => ({ role: m.role, text: m.text })), lang },
      });
      const d = data as { reply?: string; offerBooking?: boolean; problemSummary?: string; error?: string } | null;
      if (error || !d || d.error || !d.reply) throw new Error('ai_unavailable');
      reply = d.reply;
      offerBooking = !!d.offerBooking;
      problemSummary = d.problemSummary ?? '';
    } catch {
      const last = messages[messages.length - 1]?.text ?? '';
      const history = messages.slice(0, -1).map((m) => ({ role: m.role, text: m.text }));
      const fb = fallbackRespond(history, last, lang);
      reply = fb.reply;
      offerBooking = fb.offerBooking;
      problemSummary = fb.problemSummary;
    }

    // simulate token streaming so the UI animates like the old SSE endpoint
    const words = reply.split(' ');
    let acc = '';
    for (let i = 0; i < words.length; i++) {
      acc += (i ? ' ' : '') + words[i];
      onDelta(acc);
      if (i % 2 === 1) await sleep(16);
    }

    return { reply, offerBooking, problemSummary, remaining };
  },
};

// ---------- exchange rates ---------------------------------------------------

export interface Rates {
  usdtry: number;
  eurtry: number;
  live: boolean;
  source?: 'live' | 'admin' | 'fallback';
  updatedAt?: string | null;
}

const FALLBACK_RATES: Rates = { usdtry: 32.5, eurtry: 35.2, live: false, source: 'fallback' };

export async function fetchRates(): Promise<Rates> {
  // 1) admin override wins
  try {
    const { data } = await sb().from('settings').select('value').eq('key', 'rates').maybeSingle();
    const v = data?.value as RatesValue | undefined;
    if (v && v.usdtry > 0 && v.eurtry > 0) {
      return { usdtry: v.usdtry, eurtry: v.eurtry, live: false, source: 'admin', updatedAt: v.updatedAt };
    }
  } catch {
    /* ignore — fall through to live */
  }
  // 2) live (free, no key)
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (res.ok) {
      const j = await res.json();
      const try_ = Number(j?.rates?.TRY);
      const eur = Number(j?.rates?.EUR);
      if (try_ > 0 && eur > 0) {
        return { usdtry: try_, eurtry: try_ / eur, live: true, source: 'live', updatedAt: j?.time_last_update_utc ?? null };
      }
    }
  } catch {
    /* ignore — fall through to fallback */
  }
  // 3) fallback constants
  return FALLBACK_RATES;
}

// ---------- multi-currency ticker (scrolling marquee) -----------------------

export interface TickerItem { label: string; value: string }

/**
 * Rich ticker: TRY crosses + Gulf currencies + Syrian Lira (admin-set, since
 * free APIs report a wrong/stale SYP) + Bitcoin/Ethereum. Fails soft per source.
 */
export async function fetchTicker(): Promise<{ items: TickerItem[]; live: boolean }> {
  let fx: Record<string, number> = {};
  let live = false;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (res.ok) {
      const j = await res.json();
      fx = (j?.rates as Record<string, number>) ?? {};
      live = true;
    }
  } catch {
    /* ignore */
  }

  // admin overrides (settings 'rates'): authoritative USD/TRY, EUR/TRY, and the Syrian rate
  let adminUsdTry: number | undefined;
  let adminEurTry: number | undefined;
  let sypusd: number | undefined;
  try {
    const { data } = await sb().from('settings').select('value').eq('key', 'rates').maybeSingle();
    const v = data?.value as RatesValue | undefined;
    if (v?.usdtry) adminUsdTry = v.usdtry;
    if (v?.eurtry) adminEurTry = v.eurtry;
    if (v?.sypusd) sypusd = v.sypusd;
  } catch {
    /* ignore */
  }

  // crypto (CoinGecko, free, no key)
  let btc = 0;
  let eth = 0;
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
    if (res.ok) {
      const j = await res.json();
      btc = Number(j?.bitcoin?.usd) || 0;
      eth = Number(j?.ethereum?.usd) || 0;
    }
  } catch {
    /* ignore */
  }

  const fmt2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt0 = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const usdtry = adminUsdTry || fx.TRY || 0;
  const items: TickerItem[] = [];
  if (usdtry) items.push({ label: 'USD/TRY', value: fmt2(usdtry) });
  if (adminEurTry || (fx.TRY && fx.EUR)) items.push({ label: 'EUR/TRY', value: fmt2(adminEurTry || fx.TRY / fx.EUR) });
  if (fx.TRY && fx.GBP) items.push({ label: 'GBP/TRY', value: fmt2(fx.TRY / fx.GBP) });
  if (fx.TRY && fx.SAR) items.push({ label: 'SAR/TRY', value: fmt2(fx.TRY / fx.SAR) });
  if (fx.TRY && fx.AED) items.push({ label: 'AED/TRY', value: fmt2(fx.TRY / fx.AED) });
  // Syrian Lira — admin-set only (free APIs are unreliable for SYP)
  if (sypusd) {
    items.push({ label: 'USD/SYP', value: fmt0(sypusd) });
    if (usdtry) items.push({ label: 'TRY/SYP', value: fmt0(sypusd / usdtry) });
  }
  if (btc) items.push({ label: 'BTC/USD', value: '$' + fmt0(btc) });
  if (eth) items.push({ label: 'ETH/USD', value: '$' + fmt0(eth) });
  return { items, live };
}

// ============================================================================
// B2B Companies system — companies, billing, leads/responses, reviews, admin.
// Trust lives in Postgres RLS + SECURITY DEFINER RPCs (see migration). This
// layer only transports data, mirroring the conventions above.
// ============================================================================

interface CompanyRow {
  id: string; owner_user_id: string; name: string; description: string | null; logo: string | null;
  contact: Company['contact'] | null; categories: string[] | null; services: string[] | null; areas: string[] | null;
  documents: CompanyDoc[] | null; admin_note: string | null; status: Company['status'];
  subscription_status: Company['subscriptionStatus']; subscription_expires_at: string | null; created_at: string;
}
const toCompany = (r: CompanyRow): Company => ({
  id: r.id, ownerUserId: r.owner_user_id, name: r.name, description: r.description, logo: r.logo,
  contact: r.contact ?? {}, categories: r.categories ?? [], services: r.services ?? [], areas: r.areas ?? [],
  documents: Array.isArray(r.documents) ? r.documents : [], adminNote: r.admin_note,
  status: r.status, subscriptionStatus: r.subscription_status, subscriptionExpiresAt: r.subscription_expires_at,
  createdAt: r.created_at,
});

/** Normalize a PostgREST to-one embed (object or 1-element array) to a field. */
function embed<T>(x: unknown): T | undefined {
  if (Array.isArray(x)) return x[0] as T | undefined;
  return (x as T | undefined) ?? undefined;
}

export const companies = {
  /** Create (or refresh, while still pending) the caller's company → status=pending. */
  async register(input: CompanyInput): Promise<{ id: string }> {
    const { data, error } = await sb().rpc('register_company', {
      p_name: input.name,
      p_description: input.description ?? null,
      p_contact: input.contact ?? {},
      p_categories: input.categories ?? [],
      p_services: input.services ?? [],
      p_areas: input.areas ?? [],
      p_documents: input.documents ?? [],
    });
    if (error) fail(error);
    return { id: (data as string) ?? '' };
  },
  /** The company owned by the current user (or null). */
  async mine(): Promise<Company | null> {
    const uid = await requireUid();
    const { data, error } = await sb().from('companies').select('*').eq('owner_user_id', uid).maybeSingle();
    if (error) fail(error);
    return data ? toCompany(data as CompanyRow) : null;
  },
  /** Owner edits profile fields. Privileged fields are stripped server-side. */
  async update(patch: CompanyInput): Promise<{ ok: true }> {
    const uid = await requireUid();
    const { error } = await sb().from('companies').update({
      name: patch.name,
      description: patch.description ?? null,
      logo: patch.logo ?? null,
      contact: patch.contact ?? {},
      categories: patch.categories ?? [],
      services: patch.services ?? [],
      areas: patch.areas ?? [],
      ...(patch.documents ? { documents: patch.documents } : {}),
    }).eq('owner_user_id', uid);
    if (error) fail(error);
    return { ok: true };
  },
  /** Upload a company logo → public URL (company-logos bucket). */
  async uploadLogo(file: File): Promise<string> {
    const uid = await requireUid();
    const c = sb();
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'png';
    const path = `${uid}/${Date.now()}.${ext}`;
    const up = await c.storage.from('company-logos').upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (up.error) fail(up.error);
    return c.storage.from('company-logos').getPublicUrl(path).data.publicUrl;
  },
  /** Upload a verification document → private (company-docs bucket). */
  async uploadDoc(file: File): Promise<CompanyDoc> {
    const uid = await requireUid();
    const path = `${uid}/${Date.now()}-${file.name}`;
    const up = await sb().storage.from('company-docs').upload(path, file, { upsert: false });
    if (up.error) fail(up.error);
    return { name: file.name, path };
  },
  /** Broadcast leads matching the caller's ACTIVE company (phone redacted). */
  async leads(): Promise<CompanyLead[]> {
    const { data, error } = await sb().rpc('company_leads');
    if (error) fail(error);
    interface Row { id: string; service_title: string | null; category: string | null; area: string | null; message: string | null; customer_name: string | null; created_at: string; responded: boolean; }
    return ((data ?? []) as Row[]).map((r) => ({
      id: r.id, serviceTitle: r.service_title ?? '', category: r.category ?? '', area: r.area ?? null,
      message: r.message ?? null, customerName: r.customer_name ?? '', createdAt: r.created_at, responded: !!r.responded,
    }));
  },
  /** Send an offer on a lead. RLS requires the company be approved + active. */
  async respond(companyId: string, leadId: string, quote: number | null, message: string): Promise<{ ok: true }> {
    const { error } = await sb().from('company_responses').insert({
      company_id: companyId, lead_id: leadId, quote, message: message || null,
    });
    if (error) fail(error);
    return { ok: true };
  },
  /** Public profile of an approved + active company (+ aggregate rating). */
  async byId(id: string): Promise<CompanyPublic | null> {
    const c = sb();
    const { data } = await c.from('companies').select('id,name,description,logo,categories,services,areas').eq('id', id).maybeSingle();
    if (!data) return null;
    const { data: rv } = await c.from('reviews').select('rating').eq('company_id', id);
    const ratings = (rv ?? []) as { rating: number }[];
    const count = ratings.length;
    const avg = count ? ratings.reduce((s, x) => s + x.rating, 0) / count : 0;
    return {
      id: data.id, name: data.name, description: data.description, logo: data.logo,
      categories: data.categories ?? [], services: data.services ?? [], areas: data.areas ?? [],
      rating: Math.round(avg * 100) / 100, reviewsCount: count,
    };
  },
  async reviewsFor(companyId: string): Promise<Review[]> {
    const { data, error } = await sb().from('reviews')
      .select('id,company_id,rating,text,created_at').eq('company_id', companyId).order('created_at', { ascending: false });
    if (error) fail(error);
    interface Row { id: string; company_id: string; rating: number; text: string | null; created_at: string; }
    return ((data ?? []) as Row[]).map((r) => ({ id: r.id, companyId: r.company_id, rating: r.rating, text: r.text ?? null, createdAt: r.created_at }));
  },
};

export const companyBilling = {
  async config(): Promise<{ monthly: number; currency: string }> {
    const { data } = await sb().from('settings').select('value').eq('key', 'company_plan').maybeSingle();
    const v = (data?.value as { monthly?: number; currency?: string } | undefined) ?? {};
    return { monthly: v.monthly ?? COMPANY_PLAN_PRICE, currency: v.currency ?? 'TL' };
  },
  /** Create a PENDING company payment (admin confirms → activates 1 month). */
  async pay(method: CompanyPayMethod, receipt?: File): Promise<{ id: string }> {
    const uid = await requireUid();
    const c = sb();
    const { data: company } = await c.from('companies').select('id').eq('owner_user_id', uid).maybeSingle();
    if (!company) throw new ApiError('no_company', 400);
    const cfg = await companyBilling.config();
    let receiptPath: string | null = null;
    let receiptName: string | null = null;
    if (receipt) {
      const path = `${uid}/${Date.now()}-${receipt.name}`;
      const up = await c.storage.from('receipts').upload(path, receipt, { upsert: false });
      if (!up.error) { receiptPath = path; receiptName = receipt.name; }
    }
    const { data, error } = await c.from('company_payments').insert({
      company_id: company.id, plan: 'monthly', method, amount: cfg.monthly, status: 'pending',
      receipt_path: receiptPath, receipt_name: receiptName,
    }).select('id').single();
    if (error) fail(error);
    return { id: data!.id };
  },
};

interface CompanyPaymentRow {
  id: string; company_id: string; plan: string; method: CompanyPayMethod; amount: number;
  status: CompanyPayment['status']; receipt_path: string | null; receipt_name: string | null; created_at: string;
  companies?: { name: string } | { name: string }[] | null;
}

export const companyPayments = {
  async pending(): Promise<CompanyPayment[]> {
    const { data, error } = await sb().from('company_payments')
      .select('id,company_id,plan,method,amount,status,receipt_path,receipt_name,created_at,companies(name)')
      .eq('status', 'pending').order('created_at', { ascending: false });
    if (error) fail(error);
    return ((data ?? []) as CompanyPaymentRow[]).map((p) => ({
      id: p.id, companyId: p.company_id, companyName: embed<{ name: string }>(p.companies)?.name ?? '',
      plan: p.plan, method: p.method, amount: p.amount, status: p.status,
      hasReceipt: !!p.receipt_path, receiptName: p.receipt_name ?? undefined, createdAt: p.created_at,
    }));
  },
  async resolve(id: string, status: 'confirmed' | 'rejected'): Promise<{ ok: true }> {
    const { error } = await sb().rpc('admin_resolve_company_payment', { p_id: id, p_status: status });
    if (error) fail(error);
    return { ok: true };
  },
  async openReceipt(id: string): Promise<void> {
    const c = sb();
    const { data: row } = await c.from('company_payments').select('receipt_path').eq('id', id).maybeSingle();
    if (!row?.receipt_path) return;
    const { data } = await c.storage.from('receipts').createSignedUrl(row.receipt_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  },
};

export const adminCompanies = {
  async list(): Promise<Company[]> {
    const { data, error } = await sb().from('companies').select('*').order('created_at', { ascending: false });
    if (error) fail(error);
    return ((data ?? []) as CompanyRow[]).map(toCompany);
  },
  async setStatus(id: string, status: CompanyStatus): Promise<{ ok: true }> {
    const { error } = await sb().from('companies').update({ status }).eq('id', id);
    if (error) fail(error);
    return { ok: true };
  },
  async setNote(id: string, note: string): Promise<{ ok: true }> {
    const { error } = await sb().from('companies').update({ admin_note: note }).eq('id', id);
    if (error) fail(error);
    return { ok: true };
  },
  async openDoc(path: string): Promise<void> {
    const { data } = await sb().storage.from('company-docs').createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  },
};

export const customerRequests = {
  /** The current user's broadcast requests (their "request page"). */
  async mine(): Promise<CustomerRequest[]> {
    const uid = await requireUid();
    const { data, error } = await sb().from('service_requests')
      .select('id,service_title,category,area,message,status,created_at')
      .eq('customer_id', uid).eq('broadcast', true).order('created_at', { ascending: false });
    if (error) fail(error);
    interface Row { id: string; service_title: string | null; category: string | null; area: string | null; message: string | null; status: string; created_at: string; }
    return ((data ?? []) as Row[]).map((r) => ({
      id: r.id, serviceTitle: r.service_title ?? '', category: r.category ?? '', area: r.area ?? null,
      message: r.message ?? null, status: r.status, createdAt: r.created_at,
    }));
  },
  /** Top-5 responses on a lead, ranked by company rating (server-side). */
  async responses(leadId: string): Promise<CompanyResponse[]> {
    const { data, error } = await sb().rpc('lead_responses', { p_lead_id: leadId });
    if (error) fail(error);
    interface Row { id: string; company_id: string; company_name: string | null; logo: string | null; quote: number | null; message: string | null; chosen: boolean; rating: number | string; reviews: number; }
    return ((data ?? []) as Row[]).map((r) => ({
      id: r.id, companyId: r.company_id, companyName: r.company_name ?? '', logo: r.logo ?? null,
      quote: r.quote ?? null, message: r.message ?? null, chosen: !!r.chosen,
      rating: Number(r.rating) || 0, reviews: r.reviews ?? 0,
    }));
  },
  /** Pick one offer (sets chosen, clears siblings) — must own the lead. */
  async choose(responseId: string): Promise<{ ok: true }> {
    const { error } = await sb().rpc('choose_response', { p_response_id: responseId });
    if (error) fail(error);
    return { ok: true };
  },
};

export const reviews = {
  /** Leave a review for a company you transacted with (chosen response required). */
  async create(input: { companyId: string; rating: number; text?: string; leadId: string }): Promise<{ ok: true }> {
    const uid = await requireUid();
    const { error } = await sb().from('reviews').insert({
      company_id: input.companyId, customer_id: uid, rating: input.rating,
      text: input.text ?? null, linked_lead_id: input.leadId,
    });
    if (error) fail(error);
    return { ok: true };
  },
};

interface BroadcastRespRow {
  id: string; quote: number | null; message: string | null; chosen: boolean; created_at: string;
  companies?: { name: string } | { name: string }[] | null;
  service_requests?: { service_title: string } | { service_title: string }[] | null;
}

export const adminBroadcast = {
  async requests(): Promise<{ id: string; serviceTitle: string; category: string; area: string | null; createdAt: string }[]> {
    const { data, error } = await sb().from('service_requests')
      .select('id,service_title,category,area,created_at').eq('broadcast', true).order('created_at', { ascending: false });
    if (error) fail(error);
    interface Row { id: string; service_title: string | null; category: string | null; area: string | null; created_at: string; }
    return ((data ?? []) as Row[]).map((r) => ({ id: r.id, serviceTitle: r.service_title ?? '', category: r.category ?? '', area: r.area ?? null, createdAt: r.created_at }));
  },
  async responses(): Promise<{ id: string; companyName: string; serviceTitle: string; quote: number | null; message: string | null; chosen: boolean; createdAt: string }[]> {
    const { data, error } = await sb().from('company_responses')
      .select('id,quote,message,chosen,created_at,companies(name),service_requests(service_title)')
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return ((data ?? []) as BroadcastRespRow[]).map((r) => ({
      id: r.id, companyName: embed<{ name: string }>(r.companies)?.name ?? '',
      serviceTitle: embed<{ service_title: string }>(r.service_requests)?.service_title ?? '',
      quote: r.quote ?? null, message: r.message ?? null, chosen: !!r.chosen, createdAt: r.created_at,
    }));
  },
};
