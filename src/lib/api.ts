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
  BookingMedia,
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
  FavoritePlace,
  GooglePlaceResult,
  JourneyItem,
  JourneyStatus,
  Lead,
  Listing,
  MeResponse,
  PayMethod,
  PaymentRequest,
  Place,
  PlaceOverlay,
  PlanTier,
  Profile,
  Review,
  StoredDocument,
  Subscription,
  User,
} from './types';
import { COMPANY_PLAN_PRICE } from './types';
import { classifyError, isSchemaUnavailable, logDiagnostic } from './errors';
import { familyStatusColumn, resolveOnboarding } from './onboardingSource';

/** Listing/place fields the admin form submits (no id). */
export type ListingInput = Omit<Listing, 'id'>;
export type PlaceInput = Omit<Place, 'id'>;

export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    /** optional structured extras, e.g. { resetAt } for a rate limit */
    public details?: Record<string, unknown>,
  ) {
    super(code);
  }
}

const FREE_CHAT_MESSAGES = 3;

/**
 * TEMPORARY FREE PERIOD for the AI assistant.
 *
 * While true the assistant is open to everyone: no sign-in wall, no 3-message
 * preview limit, no Pro paywall, and no `ai_usage` metering — so it also works
 * while the database schema is still being built. Replies come from the local
 * deterministic responder (ai-fallback.ts) unless the Gemini Edge Function is
 * deployed, so there is no API cost.
 *
 * TO END THE PROMO: set this to false. That single change restores the original
 * behaviour (sign-in required + 3 free messages + Pro paywall). Nothing else.
 */
export const AI_FREE_PERIOD = true;

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
  phone?: string | null; media?: BookingMedia[] | null;
}
const toBooking = (r: BookingRow): Booking => ({
  id: r.id, userId: r.user_id, userEmail: r.user_email ?? '', problemSummary: r.problem_summary,
  transcript: Array.isArray(r.transcript) ? r.transcript : [], preferredDatetime: r.preferred_datetime,
  preferredLanguage: r.preferred_language as Booking['preferredLanguage'], status: r.status,
  internalNote: r.internal_note ?? undefined, createdAt: r.created_at,
  phone: r.phone ?? undefined, media: Array.isArray(r.media) ? r.media : [],
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

// ---------- profile row (migration-tolerant) ---------------------------------

interface ProfileRow {
  id: string; email: string | null; name: string | null; role: string | null;
  referral_code: string | null; onboarding: unknown; created_at: string;
  avatar_url?: string | null; city?: string | null; situation?: string | null;
  family_status?: string | null; onboarding_completed?: boolean | null; phone?: string | null;
}

const PROFILE_BASE_COLS = 'id,email,name,role,referral_code,onboarding,created_at';
const PROFILE_EXT_COLS = `${PROFILE_BASE_COLS},avatar_url,city,situation,family_status,onboarding_completed,phone`;

/**
 * Reads the profile row. Tolerates ONLY a confirmed missing-schema error (the
 * 20260718_user_journey migration not applied yet) by retrying with the legacy
 * column set. Any other failure (auth, RLS, network, server) is re-thrown so it
 * can't be silently hidden.
 */
async function fetchProfileRow(c: SupabaseClient, uid: string): Promise<ProfileRow | null> {
  const ext = await c.from('profiles').select(PROFILE_EXT_COLS).eq('id', uid).maybeSingle();
  if (!ext.error) return (ext.data as ProfileRow | null) ?? null;

  if (!isSchemaUnavailable(ext.error)) {
    logDiagnostic('profile.read', ext.error, classifyError(ext.error));
    throw new ApiError(classifyError(ext.error), 500);
  }
  logDiagnostic('profile.read', ext.error, 'schema_unavailable');
  const base = await c.from('profiles').select(PROFILE_BASE_COLS).eq('id', uid).maybeSingle();
  if (base.error) throw new ApiError(classifyError(base.error), 500);
  return (base.data as ProfileRow | null) ?? null;
}

// ---------- config / session -------------------------------------------------

export const config = {
  // Google sign-in is handled by Supabase OAuth (no client id needed in the browser).
  get: async (): Promise<AppConfig> => ({
    googleClientId: null,
    freeChatMessages: FREE_CHAT_MESSAGES,
    aiFreePeriod: AI_FREE_PERIOD,
  }),
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
    const [prof, { data: sub }] = await Promise.all([
      fetchProfileRow(c, u.id),
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
      // new columns are absent until the journey migration runs → default safely
      onboardingCompleted: Boolean(prof.onboarding_completed),
      avatarUrl: (prof.avatar_url as string | null) ?? (u.user_metadata?.avatar_url as string | undefined) ?? null,
      city: (prof.city as string | null) ?? null,
      situation: (prof.situation as User['situation']) ?? null,
      phone: (prof as { phone?: string | null }).phone ?? null,
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

    // Structured columns are canonical; the jsonb fills any gap (see onboardingSource.ts)
    const profile = resolveOnboarding(prof.onboarding as Partial<Profile> | null, {
      city: prof.city,
      situation: prof.situation,
      family_status: (prof as { family_status?: string | null }).family_status,
      onboarding_completed: prof.onboarding_completed,
    });
    return { user, subscription, tier, unread, profile };
  },
};

export const profileApi = {
  /**
   * Persist the onboarding profile. The `onboarding` jsonb stays the source of
   * truth for the recommendation engine; key answers are mirrored into real
   * columns when the journey migration has been applied. Pass
   * `{ completed: true }` to mark onboarding finished.
   */
  async save(data: Profile, opts?: { completed?: boolean }): Promise<{ ok: true }> {
    const uid = await requireUid();
    const c = sb();
    const extended: Record<string, unknown> = {
      onboarding: data,
      city: data.city ?? null,
      situation: data.situation ?? null,
      family_status: familyStatusColumn(data.family),
      updated_at: new Date().toISOString(),
    };
    if (opts?.completed !== undefined) extended.onboarding_completed = opts.completed;

    // One statement writes BOTH representations, so they can never drift.
    const ext = await c.from('profiles').update(extended).eq('id', uid);
    if (!ext.error) return { ok: true };

    // ONLY a confirmed missing-schema error may degrade to a jsonb-only write
    // (pre-migration). Once the columns exist, failing to write them is a real
    // error and must surface — never a silent partial save.
    if (!isSchemaUnavailable(ext.error)) {
      logDiagnostic('profile.save', ext.error, classifyError(ext.error));
      throw new ApiError(classifyError(ext.error), 500);
    }
    logDiagnostic('profile.save', ext.error, 'schema_unavailable');
    const { error } = await c.from('profiles').update({ onboarding: data }).eq('id', uid);
    if (error) fail(error);
    return { ok: true };
  },

  /** Attach a phone number to the account (asked once during intake if missing). */
  async setPhone(phone: string): Promise<{ ok: true }> {
    const uid = await requireUid();
    const { error } = await sb().from('profiles').update({ phone: phone.trim() }).eq('id', uid);
    if (error) fail(error);
    return { ok: true };
  },
};

// ---------- "مسيرتي" journey -------------------------------------------------

interface JourneyRow {
  id: string; task_key: string; title_ar: string; description_ar: string | null;
  status: JourneyStatus; sort: number; related_route: string | null;
  related_service_id: string | null; completed_at: string | null;
}

const toJourneyItem = (r: JourneyRow): JourneyItem => ({
  id: r.id, taskKey: r.task_key, titleAr: r.title_ar, descriptionAr: r.description_ar,
  status: r.status, sort: r.sort, relatedRoute: r.related_route,
  relatedServiceId: r.related_service_id, completedAt: r.completed_at,
});

/**
 * Turns a Supabase failure into a typed ApiError whose `code` is the error
 * CATEGORY (schema_unavailable | unauthenticated | forbidden | network_error |
 * server_error | unknown_error). The UI maps the category to safe Arabic copy;
 * raw Supabase details never leave this module.
 */
function journeyFail(scope: string, error: unknown): never {
  const category = classifyError(error);
  logDiagnostic(scope, error, category);
  const status =
    category === 'unauthenticated' ? 401 : category === 'forbidden' ? 403 : category === 'schema_unavailable' ? 503 : 500;
  throw new ApiError(category, status);
}

export const journey = {
  /**
   * Idempotently create/sync the caller's default tasks (server-side, SECURITY
   * DEFINER). Tasks reported during onboarding start completed; re-running only
   * upgrades todo → done and never reverts manual progress.
   */
  async ensure(): Promise<void> {
    const { error } = await sb().rpc('ensure_my_journey');
    if (error) journeyFail('journey.ensure', error);
  },

  async mine(): Promise<JourneyItem[]> {
    const uid = await requireUid();
    const { data, error } = await sb()
      .from('user_journey_items')
      .select('id,task_key,title_ar,description_ar,status,sort,related_route,related_service_id,completed_at')
      .eq('user_id', uid)
      .order('sort', { ascending: true });
    if (error) journeyFail('journey.mine', error);
    return ((data ?? []) as JourneyRow[]).map(toJourneyItem);
  },

  /** Flip a task. RLS (user_id = auth.uid()) blocks touching anyone else's row. */
  async setStatus(id: string, status: JourneyStatus): Promise<{ ok: true }> {
    const { error } = await sb().from('user_journey_items').update({ status }).eq('id', id);
    if (error) journeyFail('journey.setStatus', error);
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
  async create(input: {
    problemSummary: string; transcript: ChatMessage[]; preferredDatetime: string; preferredLanguage: string;
    phone?: string | null; media?: BookingMedia[];
  }): Promise<{ id: string }> {
    const uid = await requireUid();
    const c = sb();
    const dt = new Date(input.preferredDatetime);
    if (Number.isNaN(dt.getTime()) || dt <= new Date()) throw new ApiError('past_datetime', 400);
    const { data: prof } = await c.from('profiles').select('email').eq('id', uid).maybeSingle();
    const core = {
      user_id: uid, user_email: prof?.email ?? null, problem_summary: input.problemSummary,
      transcript: input.transcript, preferred_datetime: dt.toISOString(),
      preferred_language: input.preferredLanguage,
    };
    const full = { ...core, phone: input.phone ?? null, media: input.media ?? [] };

    const first = await c.from('bookings').insert(full).select('id').single();
    if (!first.error) return { id: first.data!.id };

    // `phone` / `media` may not exist yet (storage+booking migration pending).
    // Saving the appointment matters far more than the extras, so fall back to
    // the core columns instead of failing the whole booking.
    if (!isSchemaUnavailable(first.error)) fail(first.error);
    logDiagnostic('bookings.create', first.error, 'schema_unavailable');
    const retry = await c.from('bookings').insert(core).select('id').single();
    if (retry.error) fail(retry.error);
    return { id: retry.data!.id };
  },
  /** Upload one intake file to the private booking-media bucket → its metadata. */
  async uploadMedia(file: File): Promise<BookingMedia> {
    const uid = await requireUid();
    const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
    const path = `${uid}/${Date.now()}-${safe}`;
    const up = await sb().storage.from('booking-media').upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (up.error) {
      // The bucket may not exist yet (storage migration not applied). Say so
      // precisely instead of a generic "try again" the user can't act on.
      const msg = String((up.error as { message?: string }).message ?? '').toLowerCase();
      logDiagnostic('bookings.uploadMedia', up.error, classifyError(up.error));
      if (msg.includes('bucket') || msg.includes('not found')) {
        throw new ApiError('attachments_unavailable', 503);
      }
      fail(up.error);
    }
    return { path, name: file.name, mime: file.type || undefined, size: file.size };
  },
  /** Owner/admin: short-lived signed URL to view an uploaded intake file. */
  async mediaUrl(path: string): Promise<string | null> {
    const { data } = await sb().storage.from('booking-media').createSignedUrl(path, 120);
    return data?.signedUrl ?? null;
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
  /** Admin badge: leads nobody has picked up yet. 0 on any failure — a broken
   *  count must never break the chrome it is rendered in. */
  async newCount(): Promise<number> {
    const { count, error } = await sb().from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new');
    if (error) return 0;
    return count ?? 0;
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
      role: r.is_admin ? 'admin' : 'user', isCompany: false, onboardingCompleted: false,
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

  /**
   * Rafiq's editorial layer for a batch of Google results, keyed by place id.
   * Fetched in ONE query per result page rather than per card — the map renders
   * up to 20 results and a query each would be 20 round-trips.
   *
   * Returns an empty map on failure: a missing overlay must degrade to "no
   * badge", never to a blank map.
   */
  async overlay(googlePlaceIds: string[]): Promise<Map<string, PlaceOverlay>> {
    const ids = [...new Set(googlePlaceIds.filter(Boolean))];
    if (ids.length === 0) return new Map();
    const { data, error } = await sb()
      .from('places')
      .select('google_place_id,verified_status,recommended,recommendation_reason,last_reviewed_at')
      .in('google_place_id', ids);
    if (error) return new Map();
    const out = new Map<string, PlaceOverlay>();
    for (const r of (data ?? []) as PlaceOverlayRow[]) {
      if (!r.google_place_id) continue;
      out.set(r.google_place_id, {
        googlePlaceId: r.google_place_id,
        verifiedStatus: (r.verified_status as PlaceOverlay['verifiedStatus']) ?? 'unverified',
        recommended: Boolean(r.recommended),
        recommendationReason: r.recommendation_reason ?? null,
        lastReviewedAt: r.last_reviewed_at ?? null,
      });
    }
    return out;
  },
};

interface PlaceOverlayRow {
  google_place_id: string | null;
  verified_status: string | null;
  recommended: boolean | null;
  recommendation_reason: string | null;
  last_reviewed_at: string | null;
}

// ---------- Google Places search (via our own server function) ---------------

export type PlaceSearchError = 'no_key' | 'key_rejected' | 'upstream_error' | 'network' | 'bad_request';

export interface PlaceSearchResult {
  places: GooglePlaceResult[];
  error?: PlaceSearchError;
  /** For text search: what the user typed, and what we actually sent to Google. */
  query?: string;
  translatedQuery?: string;
}

/**
 * The endpoint answers 200 with `{ error }` on every failure (matching
 * api/ai-chat.ts), so callers branch on the body, never on the HTTP status.
 */
interface PlacesResponse {
  places?: GooglePlaceResult[];
  place?: GooglePlaceResult;
  error?: PlaceSearchError;
  query?: string;
  translatedQuery?: string;
}

async function postPlaces(body: Record<string, unknown>): Promise<PlacesResponse> {
  try {
    const res = await fetch('/api/places-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { error: 'upstream_error' };
    return (await res.json()) as PlacesResponse;
  } catch {
    return { error: 'network' };
  }
}

export const placeSearch = {
  /** Category chip → Nearby Search (or Text, for categories Google has no type for). */
  async nearby(category: string, lat: number, lng: number, radius: number, lang: string): Promise<PlaceSearchResult> {
    const d = await postPlaces({ mode: 'nearby', category, lat, lng, radius, lang });
    if (d.error) return { places: [], error: d.error };
    return { places: d.places ?? [] };
  },

  /** Free-text query → Text Search, biased to the current viewport. */
  async text(query: string, lat: number, lng: number, radius: number, lang: string): Promise<PlaceSearchResult> {
    const d = await postPlaces({ mode: 'text', query, lat, lng, radius, lang });
    if (d.error) return { places: [], error: d.error };
    return { places: d.places ?? [], query: d.query, translatedQuery: d.translatedQuery };
  },

  /** Rich fields for the one place the user opened. */
  async details(placeId: string, lang: string): Promise<GooglePlaceResult | null> {
    const d = await postPlaces({ mode: 'details', placeId, lang });
    return d.error || !d.place ? null : d.place;
  },

  /** Photo bytes stream through our proxy so no key reaches the browser. */
  photoUrl(photoRef: string | null, width = 800): string | null {
    return photoRef ? `/api/place-photo?ref=${encodeURIComponent(photoRef)}&w=${width}` : null;
  },
};

// ---------- saved places ------------------------------------------------------

interface FavoriteRow {
  id: string;
  google_place_id: string;
  name: string;
  category: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

const toFavorite = (r: FavoriteRow): FavoritePlace => ({
  id: r.id,
  googlePlaceId: r.google_place_id,
  name: r.name,
  category: r.category,
  address: r.address,
  lat: r.lat,
  lng: r.lng,
  createdAt: r.created_at,
});

export const placeFavorites = {
  async list(): Promise<FavoritePlace[]> {
    const { data, error } = await sb()
      .from('place_favorites')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return ((data ?? []) as FavoriteRow[]).map(toFavorite);
  },

  /** Idempotent: saving an already-saved place is a no-op, not an error. */
  async add(p: GooglePlaceResult, category: string | null): Promise<{ ok: true }> {
    const uid = await requireUid();
    const { error } = await sb()
      .from('place_favorites')
      .upsert(
        {
          user_id: uid,
          google_place_id: p.placeId,
          name: p.name,
          category,
          address: p.address,
          lat: p.lat,
          lng: p.lng,
        },
        { onConflict: 'user_id,google_place_id' },
      );
    if (error) fail(error);
    return { ok: true };
  },

  async remove(googlePlaceId: string): Promise<{ ok: true }> {
    const uid = await requireUid();
    const { error } = await sb()
      .from('place_favorites')
      .delete()
      .eq('user_id', uid)
      .eq('google_place_id', googlePlaceId);
    if (error) fail(error);
    return { ok: true };
  },
};

// ---------- service requests (new services catalog → leads) -----------------

export interface ServiceRequestInput {
  name: string;
  phone: string;
  email?: string;
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
  async create(input: ServiceRequestInput): Promise<{ ok: true; id: string | null }> {
    const payload = {
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      message: input.message ?? null,
      service_id: input.serviceId,
      service_title: input.serviceTitle,
      category: input.category,
      service_type: input.serviceType,
      lang: input.lang,
      area: input.area ?? null,
      broadcast: input.broadcast ?? false,
      // customer_id is stamped server-side via the column DEFAULT auth.uid()
    };

    // Columns that exist even before the 20260719 migration.
    const legacy = {
      name: payload.name,
      phone: payload.phone,
      message: payload.message,
      service_id: payload.service_id,
      service_title: payload.service_title,
      category: payload.category,
      service_type: payload.service_type,
      lang: payload.lang,
    };

    const insert = (body: Record<string, unknown>) => sb().from('service_requests').insert(body);

    // Insert WITHOUT a read-back first, so a blocked select can never cause a
    // duplicate row. If the new columns aren't in the database yet, retry with
    // the legacy shape — the form keeps working, it just can't be tracked live.
    const first = await insert(payload);
    if (first.error) {
      if (!isSchemaUnavailable(first.error)) fail(first.error);
      logDiagnostic('serviceRequests.create', first.error, 'schema_unavailable');
      const retry = await insert(legacy);
      if (retry.error) fail(retry.error);
      return { ok: true, id: null };
    }

    // Best-effort: a signed-in customer owns the row (RLS "sr customer read
    // own"), so fetch its id to drive the live status screen. Null is fine.
    const uid = (await sessionUser())?.id ?? null;
    if (!uid) return { ok: true, id: null };
    const { data } = await sb()
      .from('service_requests')
      .select('id')
      .eq('customer_id', uid)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return { ok: true, id: (data?.id as string | undefined) ?? null };
  },

  /** Live status of the caller's own request (null when not readable). */
  async status(id: string): Promise<{ status: string; adminNote: string | null } | null> {
    const { data, error } = await sb()
      .from('service_requests')
      .select('status,admin_note')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return { status: (data.status as string) ?? 'new', adminNote: (data.admin_note as string | null) ?? null };
  },

  /** Admin: move a request through the workflow. */
  async adminSetStatus(id: string, status: 'accepted' | 'done' | 'rejected'): Promise<{ ok: true }> {
    const { error } = await sb().from('service_requests').update({ status }).eq('id', id);
    if (error) fail(error);
    return { ok: true };
  },
  /**
   * Admin badge: requests still awaiting a first response.
   *
   * Both 'new' and 'pending' count as unhandled — 'new' is what rows created
   * before the 20260719 status workflow use, and the two are interchangeable
   * until an admin accepts or rejects. 0 on any failure, so a count that cannot
   * load never breaks the chrome it is rendered in.
   */
  async newCount(): Promise<number> {
    const { count, error } = await sb()
      .from('service_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['new', 'pending']);
    if (error) return 0;
    return count ?? 0;
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
  /** the assistant has gathered enough → the UI offers to confirm an appointment */
  done: boolean;
}

export interface ChatSummary {
  /** plain prose, safe to show the user in the booking confirmation */
  summary: string;
  /** structured intake record for the team; undefined if the AI was unavailable */
  caseFile?: Record<string, unknown>;
}

export const ai = {
  async chat(messages: ChatMessage[], lang: string, onDelta: (text: string) => void): Promise<ChatResult> {
    const last = messages[messages.length - 1]?.text ?? '';
    const history = messages.slice(0, -1).map((m) => ({ role: m.role, text: m.text }));
    // The deterministic responder is only a safety net for when the AI service
    // is unreachable, so the chat still says something useful.
    const fb = fallbackRespond(history, last, lang);

    let reply = fb.reply;
    let done = false;

    // Real AI (intake agent) via our own server function (/api/ai-chat on Vercel).
    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages.map((m) => ({ role: m.role, text: m.text })), lang }),
      });
      if (res.ok) {
        const d = (await res.json()) as { reply?: string; done?: boolean; error?: string };
        if (d?.reply && d.reply.trim()) reply = d.reply.trim();
        done = d?.done === true;
      }
    } catch {
      /* offline or function unavailable — keep the fallback reply */
    }

    // simulate token streaming so the UI animates like the old SSE endpoint
    const words = reply.split(' ');
    let acc = '';
    for (let i = 0; i < words.length; i++) {
      acc += (i ? ' ' : '') + words[i];
      onDelta(acc);
      if (i % 2 === 1) await sleep(16);
    }

    return { reply, done };
  },

  /**
   * Ask the AI for the case file. `summary` is the human-readable brief shown
   * to the user before they confirm; `caseFile` is the structured record for
   * the team (absent when the service is unavailable or returned no JSON).
   * Falls back to a trimmed transcript snippet so booking never blocks on AI.
   */
  async summarize(messages: ChatMessage[], lang: string): Promise<ChatSummary> {
    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages.map((m) => ({ role: m.role, text: m.text })), lang, summarize: true }),
      });
      if (res.ok) {
        const d = (await res.json()) as { summary?: string; case?: Record<string, unknown> };
        if (d?.summary && d.summary.trim()) return { summary: d.summary.trim(), caseFile: d.case };
      }
    } catch {
      /* ignore — fall through to a local summary */
    }
    const firstUser = messages.find((m) => m.role === 'user')?.text ?? '';
    return { summary: firstUser.slice(0, 200) };
  },
};

// ---------- FX rates (server-synced, read-only from the client) --------------

export interface FxRate {
  pair: string;
  rate: number;
  source: 'provider' | 'manual';
  providerName: string | null;
  validationStatus: 'ok' | 'suspect' | 'stale';
  updatedAt: string;
  overrideReason: string | null;
}

export interface FxSyncRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'success' | 'partial' | 'failed';
  providerName: string | null;
  pairsUpdated: number;
  pairsRejected: number;
  error: string | null;
  localTime: string | null;
}

export interface FxAuditEntry {
  id: string;
  pair: string;
  oldRate: number | null;
  newRate: number | null;
  source: string;
  reason: string | null;
  createdAt: string;
}

interface FxRateRow {
  pair: string; rate: string | number; source: string; provider_name: string | null;
  validation_status: string; updated_at: string; override_reason: string | null;
}

/**
 * The whole ticker in one query. Nothing here calls an exchange-rate provider:
 * the browser reads only what the daily cron wrote, so no third-party endpoint
 * ever sees our users and no API key can leak into the bundle.
 */
export const fx = {
  async list(): Promise<FxRate[]> {
    const { data, error } = await sb().from('fx_rates').select('*');
    if (error) return [];
    return ((data ?? []) as FxRateRow[]).map((r) => ({
      pair: r.pair,
      rate: Number(r.rate),
      source: (r.source as FxRate['source']) ?? 'provider',
      providerName: r.provider_name,
      validationStatus: (r.validation_status as FxRate['validationStatus']) ?? 'ok',
      updatedAt: r.updated_at,
      overrideReason: r.override_reason,
    }));
  },

  /** Admin: the run log, newest first — the source of "last successful update". */
  async runs(limit = 10): Promise<FxSyncRun[]> {
    const { data, error } = await sb()
      .from('fx_sync_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) fail(error);
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      startedAt: r.started_at as string,
      finishedAt: (r.finished_at as string) ?? null,
      status: r.status as FxSyncRun['status'],
      providerName: (r.provider_name as string) ?? null,
      pairsUpdated: Number(r.pairs_updated ?? 0),
      pairsRejected: Number(r.pairs_rejected ?? 0),
      error: (r.error as string) ?? null,
      localTime: (r.local_time as string) ?? null,
    }));
  },

  async audit(limit = 30): Promise<FxAuditEntry[]> {
    const { data, error } = await sb()
      .from('fx_rate_audit')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) fail(error);
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      pair: r.pair as string,
      oldRate: r.old_rate === null ? null : Number(r.old_rate),
      newRate: r.new_rate === null ? null : Number(r.new_rate),
      source: r.source as string,
      reason: (r.reason as string) ?? null,
      createdAt: r.created_at as string,
    }));
  },

  /** Admin override. The reason is enforced by the RPC, not just the form. */
  async setOverride(pair: string, rate: number, reason: string): Promise<{ ok: true }> {
    const { error } = await sb().rpc('set_fx_override', { p_pair: pair, p_rate: rate, p_reason: reason });
    if (error) fail(error);
    return { ok: true };
  },

  async clearOverride(pair: string, reason: string): Promise<{ ok: true }> {
    const { error } = await sb().rpc('clear_fx_override', { p_pair: pair, p_reason: reason });
    if (error) fail(error);
    return { ok: true };
  },
};

// The old browser-side rate fetching (fetchRates / fetchTicker / FALLBACK_RATES)
// lived here. It called open.er-api.com and coingecko directly from the user's
// page. Removed with the daily server-side sync: see the `fx` module above and
// api/cron/rates-sync.ts. Do not reintroduce a client-side price fetch.

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
