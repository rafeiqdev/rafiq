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
import { readMetric } from './metrics/service';
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
  InvestmentRecord,
  InvestmentInput,
  InvestmentContact,
  LocalizedText,
  MedicalRequest,
  MedicalRequestFile,
  MedicalRequestStatus,
  MedicalOptionalService,
  MedicalOptionalServiceType,
  MedicalOffer,
  MedicalOfferCenter,
  MedicalPayment,
  MedicalPaymentStatus,
  MedicalSpecialty,
  MedicalService,
  MedicalLandingCard,
  MedicalHeroSlide,
  MedicalFaq,
  MedicalTestimonial,
  MedicalPageSection,
  AdminMedicalRequest,
  ServiceOffer,
  ServiceOfferStatus,
  ServicePayment,
  ServicePaymentStatus,
} from './types';
import { COMPANY_PLAN_PRICE } from './types';
import { classifyError, isSchemaUnavailable, logDiagnostic } from './errors';
import { PLACEHOLDER_CHECKOUT, isHttpsUrl, isRealIban, isRealWallet } from './checkoutValidation';
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
  try {
    const { data, error } = await sb().auth.getUser();
    if (!error && data?.user) return data.user;
  } catch {
    // fallback to getSession if offline or error
  }
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
  // Raised by trg_service_requests_rate_limit. Distinguishable so the form can
  // say "we already have your request" instead of a generic failure, which
  // would invite exactly the retry the limit is refusing.
  if (msg.includes('service_request_rate_limit')) throw new ApiError('rate_limited', 429);
  // Supabase Auth throttles recovery/confirmation emails ("you can only
  // request this once every 60 seconds" / "email rate limit exceeded").
  if (msg.includes('rate limit') || msg.includes('once every')) throw new ApiError('rate_limited', 429);
  // The recovery session expired before the new password was submitted.
  if (msg.includes('auth session missing')) throw new ApiError('reset_expired', 401);
  if (msg.includes('not_admin')) throw new ApiError('forbidden', 403);
  if (msg.includes('not_authenticated') || msg.includes('jwt') || msg.includes('token is expired') || msg.includes('expired')) {
    throw new ApiError('not_authenticated', 401);
  }
  throw new ApiError(fallback, status);
}

/**
 * Best-effort general admin audit log — never blocks or fails the action it
 * accompanies. Mirrors logMedicalAudit (medical_audit_log_write) but for the
 * rest of the admin surface (tier/role changes, payment resolve, PII reveal,
 * content deletes, news publish). See supabase/migrations/20260813_admin_audit_log.sql.
 */
async function logAdminAudit(action: string, targetType: string, targetId: string | null, meta: Record<string, unknown> = {}): Promise<void> {
  await sb().rpc('admin_audit_log_write', { p_action: action, p_target_type: targetType, p_target_id: targetId, p_meta: meta });
}

/** Log a PII reveal from RevealField.tsx — the one call site UI components need directly. */
export function logPiiReveal(targetType: string, targetId: string): void {
  logAdminAudit('pii_reveal', targetType, targetId);
}

// ---------- row mappers ------------------------------------------------------

interface ListingRow {
  id: string; district: string; rooms: string; m2: number; price_usd: number; citizenship: boolean;
  image: string | null; description: string | null; bathrooms: number | null; furnished: boolean; images: string[] | null;
  // Optional columns (real-estate revamp). Absent on databases that have not
  // run the migration yet — every reader must treat them as possibly undefined.
  listing_type?: string | null; floor?: number | null; total_floors?: number | null;
  build_status?: string | null; yield_pct?: number | null; amenities?: string[] | null;
  updated_at?: string | null;
  translations?: Listing['translations'] | null;
}
const toListing = (r: ListingRow): Listing => ({
  id: r.id, district: r.district, rooms: r.rooms, m2: r.m2, priceUsd: r.price_usd, citizenship: r.citizenship,
  image: r.image, description: r.description, bathrooms: r.bathrooms, furnished: r.furnished, images: r.images ?? [],
  // Columns below ship with the real-estate revamp. They are read defensively
  // so the page keeps working against a database that has not run the
  // migration yet — `select('*')` just returns undefined for them.
  listingType: (r.listing_type as Listing['listingType']) ?? 'sale',
  floor: r.floor ?? null,
  totalFloors: r.total_floors ?? null,
  buildStatus: (r.build_status as Listing['buildStatus']) ?? null,
  yieldPct: r.yield_pct ?? null,
  amenities: Array.isArray(r.amenities) ? r.amenities : [],
  updatedAt: r.updated_at ?? null,
  translations: r.translations ?? undefined,
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

  /**
   * Looks up an email before the auth form commits to a mode: whether it's
   * already registered, and which sign-in providers it uses. Backed by the
   * check_email_providers() SECURITY DEFINER function (20260805 migration) —
   * on a database that hasn't run it yet, the RPC 404s and the caller should
   * fall back to letting the user pick sign-in/register manually.
   */
  async checkEmail(email: string): Promise<{ exists: boolean; providers: string[] }> {
    const { data, error } = await sb().rpc('check_email_providers', { p_email: email });
    if (error) fail(error);
    const result = data as { exists?: boolean; providers?: string[] } | null;
    return { exists: !!result?.exists, providers: Array.isArray(result?.providers) ? result.providers : [] };
  },

  /**
   * Emails a recovery link that lands on /reset-password. Supabase answers
   * 200 whether or not the address has an account, so this cannot be used to
   * enumerate customers; only rate-limit/config errors surface.
   */
  async requestPasswordReset(email: string): Promise<{ ok: true }> {
    const { error } = await sb().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) fail(error);
    return { ok: true };
  },

  /** Sets a new password for the recovery session created by the email link. */
  async updatePassword(password: string): Promise<{ ok: true }> {
    const { error } = await sb().auth.updateUser({ password });
    if (error) fail(error);
    return { ok: true };
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
    if (!prof) {
      /**
       * The session is VALID but the profile row is unreadable.
       *
       * Returning `{ user: null }` here — as this used to — makes an
       * authenticated user look like a guest: sign-in resolves without error,
       * the UI shows the sign-in wall, the user signs in again, and loops
       * forever with nothing to explain it. Throwing turns that silent dead end
       * into a message the caller can render.
       *
       * Two different faults produce this, and they are NOT distinguishable
       * from the client: maybeSingle() returns data:null with error:null both
       * when the row is genuinely absent (handle_new_user() never fired) and
       * when RLS refuses it (the "profiles read own/admin" policy is missing or
       * wrong) — PostgREST reports an RLS-filtered row as an empty result, not
       * as an error. Any client-side probe hits the same policy, so it would
       * report the same thing in both cases. The uid is logged so the cause can
       * be settled with one query against the database.
       */
      // Deliberately a direct console.warn rather than logDiagnostic(): that
      // helper is DEV-only and strips user ids on purpose, and this is exactly
      // the case where the uid — the user's own, in their own browser — is the
      // one piece of information that makes the fault diagnosable in production.
      // eslint-disable-next-line no-console
      console.warn(
        '[rafiq:auth] profile_missing — the session is valid but profiles row is unreadable.\n' +
          `  uid:   ${u.id}\n` +
          `  email: ${u.email ?? '(none)'}\n` +
          '  Run BOTH to tell the two causes apart:\n' +
          '    select id, role from public.profiles where id = \'' + u.id + '\';\n' +
          '    select policyname, cmd from pg_policies where tablename = \'profiles\';\n' +
          '  No row  -> handle_new_user() never fired for this signup.\n' +
          '  Row exists but was invisible here -> the RLS select policy is at fault.',
      );
      throw new ApiError('profile_missing', 409);
    }

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
      isMedicalCoordinator: role === 'medical_coordinator',
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

const DEFAULT_CHECKOUT = PLACEHOLDER_CHECKOUT;

/**
 * A hosted checkout link. PUBLIC PARTS ONLY.
 *
 * `settings` is anon-readable (`settings public read`, using (true)), so this
 * type deliberately has no field for an API key, secret or private token —
 * anyone with the publishable anon key can read every row. A gateway that needs
 * a secret must keep it in a server-side env var on Vercel; only the public
 * checkout URL belongs here.
 */
export interface CheckoutGateway {
  id: string;
  label: string;
  url: string;
  enabled: boolean;
}

/** The editable shape behind /admin → Payment settings. */
export interface CheckoutSettings {
  bank: { enabled: boolean; iban: string; holder: string; bankName: string };
  crypto: { enabled: boolean; network: string; wallet: string };
  gateways: CheckoutGateway[];
}

export interface CheckoutConfig {
  iban: string;
  holder: string;
  bankName: string;
  wallet: string;
  network: string;
  /** Bank transfer may be offered — enabled AND a real IBAN is on file. */
  bankConfigured: boolean;
  /** Crypto may be offered — enabled AND a real wallet is on file. */
  cryptoConfigured: boolean;
  /** Only gateways that are enabled and have an https URL. */
  gateways: CheckoutGateway[];
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/**
 * Normalise whatever is in the settings row into CheckoutSettings.
 *
 * Two shapes are accepted forever:
 *   - NEW: { bank: {...}, crypto: {...}, gateways: [...] }
 *   - OLD: { iban, holder, wallet, network } — rows written by hand before the
 *     admin editor existed. Those had no enabled flag, and the only reason to
 *     write one was to use it, so a legacy rail counts as enabled.
 *
 * Anything unrecognised degrades to disabled-and-empty rather than throwing;
 * a malformed row must not take the checkout page down.
 */
export function toCheckoutSettings(raw: unknown): CheckoutSettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  const bankRaw = (r.bank ?? {}) as Record<string, unknown>;
  const cryptoRaw = (r.crypto ?? {}) as Record<string, unknown>;
  const isLegacy = r.bank === undefined && r.crypto === undefined;

  const gateways = Array.isArray(r.gateways)
    ? (r.gateways as unknown[]).map((g, i) => {
        const o = (g ?? {}) as Record<string, unknown>;
        return {
          id: str(o.id, `g${i}`),
          label: str(o.label),
          url: str(o.url),
          enabled: bool(o.enabled, false),
        };
      })
    : [];

  return {
    bank: {
      enabled: bool(bankRaw.enabled, isLegacy && str(r.iban) !== ''),
      iban: str(bankRaw.iban, str(r.iban)),
      holder: str(bankRaw.holder, str(r.holder)),
      bankName: str(bankRaw.bankName),
    },
    crypto: {
      enabled: bool(cryptoRaw.enabled, isLegacy && str(r.wallet) !== ''),
      network: str(cryptoRaw.network, str(r.network)),
      wallet: str(cryptoRaw.wallet, str(r.wallet)),
    },
    gateways,
  };
}

/**
 * The persisted JSON: the new nested shape PLUS the legacy flat keys.
 *
 * The mirror is not redundancy for its own sake — an older deployed bundle
 * still reads iban/holder/wallet/network off the top level, and a row saved
 * from the new admin UI must not break it mid-rollout.
 */
export function toCheckoutRow(s: CheckoutSettings): Record<string, unknown> {
  return {
    bank: s.bank,
    crypto: s.crypto,
    gateways: s.gateways,
    // legacy mirror — do not remove without checking what is deployed
    iban: s.bank.iban,
    holder: s.bank.holder,
    wallet: s.crypto.wallet,
    network: s.crypto.network,
  };
}

/**
 * What a customer may actually be shown.
 *
 * A rail is visible only when it is BOTH switched on and complete. The toggle
 * is not permission to display garbage: an enabled rail holding a placeholder
 * stays hidden, which is the whole point of the original fix.
 */
export function toCheckoutConfig(s: CheckoutSettings): CheckoutConfig {
  return {
    iban: s.bank.iban || DEFAULT_CHECKOUT.iban,
    holder: s.bank.holder || DEFAULT_CHECKOUT.holder,
    bankName: s.bank.bankName,
    wallet: s.crypto.wallet || DEFAULT_CHECKOUT.wallet,
    network: s.crypto.network || DEFAULT_CHECKOUT.network,
    bankConfigured: s.bank.enabled && isRealIban(s.bank.iban) && s.bank.holder.trim() !== '',
    cryptoConfigured: s.crypto.enabled && isRealWallet(s.crypto.wallet) && s.crypto.network.trim() !== '',
    gateways: s.gateways.filter((g) => g.enabled && g.label.trim() !== '' && isHttpsUrl(g.url)),
  };
}

function planAmount(tier: PlanTier, billing: Billing): number {
  const monthly: Record<string, number> = { light: 799, pro: 1599, elite: 3199 };
  return (monthly[tier] ?? 0) * (billing === 'annual' ? 10 : 1);
}

export const checkout = {
  /**
   * Manual-payment details, plus whether each rail is actually usable.
   *
   * This used to spread DEFAULT_CHECKOUT and return it as if it were real, so a
   * missing settings row meant the customer was shown IBAN "TR00 0000…" and
   * wallet "TXXXX…" as genuine payment instructions. The caller now gets
   * bankConfigured/cryptoConfigured and must hide the rails that are false.
   */
  async config(): Promise<CheckoutConfig> {
    const { data } = await sb().from('settings').select('value').eq('key', 'checkout').maybeSingle();
    return toCheckoutConfig(toCheckoutSettings(data?.value ?? null));
  },

  /** Admin editor: the raw editable shape, including disabled rails. */
  async adminSettings(): Promise<CheckoutSettings> {
    const { data, error } = await sb().from('settings').select('value').eq('key', 'checkout').maybeSingle();
    if (error) fail(error);
    return toCheckoutSettings(data?.value ?? null);
  },

  /**
   * Admin editor: upsert the row. Gated by the "settings admin write" RLS
   * policy (for all, using is_admin()), so a non-admin cannot reach this even
   * with a crafted request.
   */
  async adminSave(settings: CheckoutSettings): Promise<{ ok: true }> {
    const { error } = await sb()
      .from('settings')
      .upsert({ key: 'checkout', value: toCheckoutRow(settings) }, { onConflict: 'key' });
    if (error) fail(error);
    return { ok: true };
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
      if (up.error) {
        /**
         * The customer attached proof of payment and it did not store. Swallowing
         * this — as this used to — created the payment row anyway with
         * receipt_path null: the customer saw "submitted, awaiting verification"
         * while the admin saw a claim with no evidence, and neither knew. A
         * missing `receipts` bucket or a storage RLS change would have made every
         * receipt vanish silently.
         *
         * Fail before the insert, so no unbacked claim is recorded at all.
         */
        logDiagnostic('checkout.receiptUpload', up.error, classifyError(up.error));
        throw new ApiError('receipt_upload_failed', 502);
      }
      receiptPath = path;
      receiptName = receipt.name;
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
    // Class B guard: without this, a read fired before the session attaches
    // returns [] under RLS with HTTP 200 — no error, so no catch fires, and
    // "you have no bookings" is asserted to someone who does. The session must
    // be confirmed BEFORE the question is asked, not inferred from the answer.
    await requireUid();
    const { data, error } = await sb().from('bookings').select('*').order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as BookingRow[]).map(toBooking);
  },
  async adminList(): Promise<Booking[]> {
    const { data, error } = await sb().from('bookings').select('*').order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as BookingRow[]).map(toBooking);
  },
  /** Admin badge. Delegates to the shared metrics service (METRICS.bookingsNew); 0 on any failure. */
  async newCount(): Promise<number> {
    const { value } = await readMetric('bookingsNew');
    return value ?? 0;
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
  /** Just the badge number — cheap enough to poll while the app is open. */
  async unreadCount(): Promise<number> {
    const uid = await requireUid();
    const c = sb();
    const [{ data: notifs }, { data: reads }] = await Promise.all([
      c.from('notifications').select('id'),
      c.from('notification_reads').select('notification_id').eq('user_id', uid),
    ]);
    const readSet = new Set((reads ?? []).map((r: { notification_id: string }) => r.notification_id));
    return (notifs ?? []).filter((n: { id: string }) => !readSet.has(n.id)).length;
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
    // Class B guard — see bookings.mine(). The earlier audit miscounted this
    // one as gated (upload() is; list() was not): an empty document locker
    // asserted to someone whose residence papers are in it.
    await requireUid();
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
    // Class B guard — see bookings.mine().
    await requireUid();
    const { data, error } = await sb().from('leads').select('*').order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as LeadRow[]).map(toLead);
  },
  async adminList(): Promise<Lead[]> {
    const { data, error } = await sb().from('leads').select('*').order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as LeadRow[]).map(toLead);
  },
  /**
   * Admin badge: leads nobody has picked up yet. Delegates to the shared
   * metrics service (METRICS.leadsNew); 0 on any failure — a broken count
   * must never break the chrome it is rendered in.
   */
  async newCount(): Promise<number> {
    const { value } = await readMetric('leadsNew');
    return value ?? 0;
  },
};

// ---------- referrals & wallet ------------------------------------------------

export type CommissionStatus = 'pending' | 'available' | 'paid' | 'reversed' | 'failed' | 'cancelled';
export type PayoutStatus = 'draft' | 'under_review' | 'approved' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'reversed';

export interface CurrencyBalance {
  total: number;
  pending: number;
  available: number;
  paid: number;
}

export interface ReferralStats {
  clicks: number;
  signups: number;
  code: string;
  totalCommissions: number;
  pending: number;
  available: number;
  paid: number;
  primaryCurrency: string;
  currencies: Record<string, CurrencyBalance>;
  /** Backward-compatible alias for existing callers */
  earnedTl: number;
}

export interface WalletTransaction {
  id: string;
  date: string;
  orderId: string | null;
  paymentId: string | null;
  serviceType: string;
  serviceName: string;
  transactionAmount: number;
  currency: string;
  commissionRate: number; // 0.05
  commissionAmount: number;
  status: CommissionStatus;
  availableAt: string | null;
  paidAt: string | null;
  reversalOfId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface PayoutRequest {
  id: string;
  amount: number;
  currency: string;
  payoutMethod: string;
  payoutDetails: {
    iban?: string;
    accountHolder?: string;
    bankName?: string;
    walletAddress?: string;
    notes?: string;
  };
  status: PayoutStatus;
  adminNotes?: string | null;
  processedAt?: string | null;
  createdAt: string;
}

export interface WalletSummary {
  totalCommissions: number;
  pending: number;
  available: number;
  paid: number;
  primaryCurrency: string;
  currencies: Record<string, CurrencyBalance>;
  totalCount: number;
}

/** Pure 5% commission calculation: transactionAmount * 0.05 */
export function calculateCommission(amount: number, rate: number = 0.05): number {
  if (isNaN(amount) || amount <= 0) return 0;
  return Math.round(amount * rate * 100) / 100;
}

export const referrals = {
  async stats(): Promise<ReferralStats> {
    const c = sb();
    const { data: userData } = await c.auth.getUser();
    const uid = userData?.user?.id;

    let clicks = 0;
    let signups = 0;
    let code = '';

    if (uid) {
      const { data: prof } = await c.from('profiles').select('referral_code').eq('id', uid).maybeSingle();
      code = prof?.referral_code ?? '';

      if (code) {
        const { count: clickCount } = await c
          .from('referral_clicks')
          .select('id', { count: 'exact', head: true })
          .eq('code', code.toUpperCase());
        clicks = clickCount ?? 0;
      }

      const { count: signupCount } = await c
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('referred_by', uid);
      signups = signupCount ?? 0;
    }

    const walletSummary = await wallet.getSummary();

    return {
      clicks,
      signups,
      code,
      totalCommissions: walletSummary.totalCommissions,
      pending: walletSummary.pending,
      available: walletSummary.available,
      paid: walletSummary.paid,
      primaryCurrency: walletSummary.primaryCurrency,
      currencies: walletSummary.currencies,
      earnedTl: walletSummary.currencies.TRY?.total ?? walletSummary.totalCommissions,
    };
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

export const wallet = {
  async getSummary(): Promise<WalletSummary> {
    const c = sb();
    const { data: userData } = await c.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) {
      return {
        totalCommissions: 0,
        pending: 0,
        available: 0,
        paid: 0,
        primaryCurrency: 'USD',
        currencies: {},
        totalCount: 0,
      };
    }

    // Try RPC first
    try {
      const { data: rpcData, error: rpcErr } = await c.rpc('my_wallet_summary');
      if (!rpcErr && rpcData) {
        const r = rpcData as {
          total_commissions?: number;
          pending?: number;
          available?: number;
          paid?: number;
          currencies?: Record<string, CurrencyBalance>;
          total_count?: number;
        };
        const currencies = r.currencies ?? {};
        const primaryCurrency = Object.keys(currencies)[0] || 'USD';
        return {
          totalCommissions: Number(r.total_commissions ?? 0),
          pending: Number(r.pending ?? 0),
          available: Number(r.available ?? 0),
          paid: Number(r.paid ?? 0),
          primaryCurrency,
          currencies,
          totalCount: Number(r.total_count ?? 0),
        };
      }
    } catch {
      // fallback to direct table query
    }

    // Fallback: direct query on referral_commissions
    try {
      const { data, error } = await c
        .from('referral_commissions')
        .select('*')
        .eq('referrer_id', uid);

      if (error || !data) {
        return {
          totalCommissions: 0,
          pending: 0,
          available: 0,
          paid: 0,
          primaryCurrency: 'USD',
          currencies: {},
          totalCount: 0,
        };
      }

      const currencies: Record<string, CurrencyBalance> = {};
      let totalCommissions = 0;
      let pending = 0;
      let available = 0;
      let paid = 0;
      let validCount = 0;

      for (const row of data) {
        const curr = (row.currency as string) || 'USD';
        if (!currencies[curr]) {
          currencies[curr] = { total: 0, pending: 0, available: 0, paid: 0 };
        }
        const amt = Number(row.commission_amount || 0);
        const status = row.status as CommissionStatus;

        if (status === 'pending' || status === 'available' || status === 'paid') {
          currencies[curr].total += amt;
          totalCommissions += amt;
          validCount++;
        }
        if (status === 'pending') {
          currencies[curr].pending += amt;
          pending += amt;
        } else if (status === 'available') {
          currencies[curr].available += amt;
          available += amt;
        } else if (status === 'paid') {
          currencies[curr].paid += amt;
          paid += amt;
        }
      }

      const primaryCurrency = Object.keys(currencies)[0] || 'USD';

      return {
        totalCommissions: Math.round(totalCommissions * 100) / 100,
        pending: Math.round(pending * 100) / 100,
        available: Math.round(available * 100) / 100,
        paid: Math.round(paid * 100) / 100,
        primaryCurrency,
        currencies,
        totalCount: validCount,
      };
    } catch {
      return {
        totalCommissions: 0,
        pending: 0,
        available: 0,
        paid: 0,
        primaryCurrency: 'USD',
        currencies: {},
        totalCount: 0,
      };
    }
  },

  async getTransactions(): Promise<WalletTransaction[]> {
    const c = sb();
    const { data: userData } = await c.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return [];

    try {
      const { data, error } = await c
        .from('referral_commissions')
        .select('*')
        .eq('referrer_id', uid)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map((r) => ({
        id: r.id,
        date: r.created_at,
        orderId: r.order_id ?? null,
        paymentId: r.payment_id ?? null,
        serviceType: r.service_type ?? 'service',
        serviceName: r.service_name ?? 'Rafiq Service',
        transactionAmount: Number(r.transaction_amount ?? 0),
        currency: r.currency ?? 'USD',
        commissionRate: Number(r.commission_rate ?? 0.05),
        commissionAmount: Number(r.commission_amount ?? 0),
        status: (r.status as CommissionStatus) ?? 'pending',
        availableAt: r.available_at ?? null,
        paidAt: r.paid_at ?? null,
        reversalOfId: r.reversal_of_id ?? null,
        notes: r.notes ?? null,
        createdAt: r.created_at,
      }));
    } catch {
      return [];
    }
  },

  async getPayoutRequests(): Promise<PayoutRequest[]> {
    const c = sb();
    const { data: userData } = await c.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return [];

    try {
      const { data, error } = await c
        .from('payout_requests')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map((r) => ({
        id: r.id,
        amount: Number(r.amount ?? 0),
        currency: r.currency ?? 'USD',
        payoutMethod: r.payout_method ?? 'bank_transfer',
        payoutDetails: (r.payout_details as PayoutRequest['payoutDetails']) ?? {},
        status: (r.status as PayoutStatus) ?? 'under_review',
        adminNotes: r.admin_notes ?? null,
        processedAt: r.processed_at ?? null,
        createdAt: r.created_at,
      }));
    } catch {
      return [];
    }
  },

  async requestPayout(input: {
    amount: number;
    currency: string;
    payoutMethod: string;
    payoutDetails: PayoutRequest['payoutDetails'];
  }): Promise<{ ok: boolean; id?: string; error?: string }> {
    const c = sb();
    const { data: userData } = await c.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return { ok: false, error: 'auth_required' };

    if (!input.amount || input.amount <= 0) {
      return { ok: false, error: 'invalid_amount' };
    }

    try {
      const { data, error } = await c
        .from('payout_requests')
        .insert({
          user_id: uid,
          amount: input.amount,
          currency: input.currency || 'USD',
          payout_method: input.payoutMethod || 'bank_transfer',
          payout_details: input.payoutDetails || {},
          status: 'under_review',
        })
        .select('id')
        .single();

      if (error) return { ok: false, error: error.message };
      return { ok: true, id: data?.id };
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : 'request_failed' };
    }
  },
};

// ---------- news (public feed, mirrors the Telegram channel) -----------------

/** Machine-translated title/body for one non-Arabic language. */
export interface NewsTranslation {
  title: string;
  body: string;
}

export interface NewsPost {
  id: string;
  title: string;
  body: string | null;
  /** "Read more" target — usually the t.me link of the original post. */
  url: string | null;
  /** The post's photo (Telegram CDN URL for synced posts). */
  imageUrl: string | null;
  /** 'telegram' when written by the channel sync, 'manual' from the form. */
  source: 'manual' | 'telegram';
  published: boolean;
  createdAt: string;
  /** Machine translations keyed by language code (e.g. 'en', 'ru', 'fa'). The
      Arabic original lives in title/body, never in here. Empty when the sync
      hasn't translated this post yet (or it's a manual admin post). */
  translations: Record<string, NewsTranslation>;
}

interface NewsRow {
  id: string; title: string; body: string | null; url: string | null; image_url: string | null;
  source: string; published: boolean; created_at: string; translations: Record<string, NewsTranslation> | null;
}

const NEWS_COLS = 'id,title,body,url,image_url,source,published,created_at,translations';

const toNewsPost = (r: NewsRow): NewsPost => ({
  id: r.id, title: r.title, body: r.body, url: r.url, imageUrl: r.image_url,
  source: r.source === 'telegram' ? 'telegram' : 'manual', published: r.published, createdAt: r.created_at,
  translations: r.translations ?? {},
});

/**
 * The post's title/body in the given UI language — the machine translation
 * when one exists, otherwise the Arabic original (source of truth; also the
 * behavior for manual admin posts, which are never translated).
 */
export function localizeNewsPost(post: NewsPost, lang: string): { title: string; body: string | null } {
  const t = post.translations?.[lang];
  return t ? { title: t.title, body: t.body || null } : { title: post.title, body: post.body };
}

/**
 * Telegram offers no supported way for a browser to read a channel's history,
 * so the feed is authored in /admin (the owner posts to Telegram, then adds
 * the same item here) and the channel URL — stored under the public-readable
 * settings key 'telegram' — powers the "follow us" button.
 */
export const news = {
  /** Latest published posts, newest first — the public home section. */
  async latest(limit = 5): Promise<NewsPost[]> {
    const { data, error } = await sb()
      .from('news_posts')
      .select(NEWS_COLS)
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) fail(error);
    return (data as NewsRow[]).map(toNewsPost);
  },

  /** One published post, for the in-app article page. Null when unpublished/gone. */
  async byId(id: string): Promise<NewsPost | null> {
    const { data, error } = await sb()
      .from('news_posts')
      .select(NEWS_COLS)
      .eq('id', id)
      .eq('published', true)
      .maybeSingle();
    if (error) fail(error);
    return data ? toNewsPost(data as NewsRow) : null;
  },

  /** The channel URL, validated to actually be a Telegram link, or null. */
  async telegramChannel(): Promise<string | null> {
    const { data } = await sb().from('settings').select('value').eq('key', 'telegram').maybeSingle();
    const url = (data?.value as { channel?: string } | null)?.channel ?? null;
    return url && /^https:\/\/(t\.me|telegram\.me)\/[A-Za-z0-9_+/-]+$/.test(url) ? url : null;
  },

  // ---- admin ----

  async adminList(): Promise<NewsPost[]> {
    const { data, error } = await sb()
      .from('news_posts')
      .select(NEWS_COLS)
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return (data as NewsRow[]).map(toNewsPost);
  },

  /**
   * Ask the server to pull the channel's latest posts right now (the daily
   * cron does the same on schedule). Sends the admin's own session token;
   * the function verifies it against profiles.role before touching anything.
   */
  async syncNow(): Promise<{ synced: number }> {
    const { data } = await sb().auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new ApiError('not_authenticated', 401);
    const res = await fetch('/api/cron/telegram-sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json().catch(() => ({}))) as { synced?: number; error?: string };
    if (!res.ok) throw new ApiError(body.error ?? 'sync_failed', res.status);
    return { synced: body.synced ?? 0 };
  },

  async create(input: { title: string; body?: string; url?: string }): Promise<{ ok: true }> {
    const { error } = await sb().from('news_posts').insert({
      title: input.title.trim(),
      body: input.body?.trim() || null,
      url: input.url?.trim() || null,
    });
    if (error) fail(error);
    return { ok: true };
  },

  async remove(id: string): Promise<{ ok: true }> {
    const { error } = await sb().from('news_posts').delete().eq('id', id);
    if (error) fail(error);
    await logAdminAudit('news_delete', 'news_post', id);
    return { ok: true };
  },

  /** Draft/review gate for Telegram-synced posts — see telegram-sync.ts. */
  async setPublished(id: string, published: boolean): Promise<{ ok: true }> {
    const { error } = await sb().from('news_posts').update({ published }).eq('id', id);
    if (error) fail(error);
    await logAdminAudit(published ? 'news_publish' : 'news_unpublish', 'news_post', id);
    return { ok: true };
  },

  /**
   * Flips every draft to published in one round-trip. The owner reviews each
   * item on the sidebar; when he trusts the batch, one click ships them all
   * instead of clicking Publish on every row.
   */
  async publishAllDrafts(): Promise<{ count: number }> {
    const c = sb();
    const { data, error } = await c
      .from('news_posts')
      .update({ published: true })
      .eq('published', false)
      .select('id');
    if (error) fail(error);
    const ids = ((data as { id: string }[] | null) ?? []).map((r) => r.id);
    for (const id of ids) await logAdminAudit('news_publish', 'news_post', id);
    return { count: ids.length };
  },

  async setTelegramChannel(url: string): Promise<{ ok: true }> {
    const value = url.trim() ? { channel: url.trim() } : {};
    const { error } = await sb().from('settings').upsert({ key: 'telegram', value }, { onConflict: 'key' });
    if (error) fail(error);
    return { ok: true };
  },
};

// ---------- admin: users -----------------------------------------------------

interface OverviewRow {
  id: string; email: string | null; name: string | null; provider: string; is_admin: boolean;
  referral_code: string | null; created_at: string; tier: PlanTier;
  clicks: number; signups: number; earned_tl: number; bookings: number; leads: number; payments: number;
}

export const adminUsers = {
  /**
   * Built from tables the admin already reads elsewhere on this page, NOT from
   * an RPC.
   *
   * This used to call admin_users_overview(). That function was never committed
   * to schema.sql or to any migration — it only ever existed as a hand-made
   * object in the dashboard — and it is absent from the live database, so the
   * users table had been dead. Every RPC we depend on is another object that can
   * go missing without the app noticing; `profiles` cannot.
   *
   * Not N+1: a fixed five queries regardless of how many users there are.
   *
   * `profiles` is the identity spine — if that read fails, the section failed
   * and says so. The four aggregate reads are best-effort and their counts go
   * NULL (rendered "—") rather than 0 when unreadable, because a silent zero is
   * the same lie in miniature.
   */
  async list(): Promise<AdminUser[]> {
    const c = sb();
    const { data: profs, error } = await c
      .from('profiles')
      .select('id,email,name,role,referral_code,created_at')
      .order('created_at', { ascending: false });
    if (error) fail(error);

    const [subs, bk, ld, pay] = await Promise.allSettled([
      c.from('subscriptions').select('user_id,tier,status'),
      c.from('bookings').select('user_id'),
      c.from('leads').select('user_id'),
      c.from('payments').select('user_id'),
    ]);

    /** user_id -> count, or null when that table could not be read at all. */
    const tally = (r: PromiseSettledResult<{ data: unknown; error: unknown }>): Map<string, number> | null => {
      if (r.status !== 'fulfilled' || r.value.error) return null;
      const m = new Map<string, number>();
      for (const row of (r.value.data as { user_id: string | null }[]) ?? []) {
        if (row.user_id) m.set(row.user_id, (m.get(row.user_id) ?? 0) + 1);
      }
      return m;
    };
    const bookingsBy = tally(bk);
    const leadsBy = tally(ld);
    const paymentsBy = tally(pay);

    const tierBy = new Map<string, PlanTier>();
    if (subs.status === 'fulfilled' && !subs.value.error) {
      for (const s of (subs.value.data as { user_id: string; tier: PlanTier; status: string }[]) ?? []) {
        if (s.status === 'active') tierBy.set(s.user_id, s.tier);
      }
    }

    interface ProfileListRow { id: string; email: string | null; name: string | null; role: string | null; referral_code: string | null; created_at: string }
    return ((profs ?? []) as ProfileListRow[]).map((p) => ({
      id: p.id,
      email: p.email ?? '',
      name: p.name ?? (p.email ?? '').split('@')[0],
      // Sign-in provider lives on auth.users, which is not reachable from the
      // browser at all. It was never rendered; it is no longer invented.
      provider: 'email' as const,
      isAdmin: p.role === 'admin',
      role: p.role === 'admin' ? 'admin' : p.role === 'medical_coordinator' ? 'medical_coordinator' : 'user',
      isCompany: p.role === 'company',
      isMedicalCoordinator: p.role === 'medical_coordinator',
      onboardingCompleted: false,
      referralCode: p.referral_code ?? '',
      createdAt: p.created_at,
      tier: tierBy.get(p.id) ?? 'free',
      bookings: bookingsBy ? (bookingsBy.get(p.id) ?? 0) : null,
      leads: leadsBy ? (leadsBy.get(p.id) ?? 0) : null,
      payments: paymentsBy ? (paymentsBy.get(p.id) ?? 0) : null,
    }));
  },
  async setTier(id: string, tier: PlanTier): Promise<{ ok: true }> {
    const { error } = await sb().rpc('admin_set_tier', { p_user: id, p_tier: tier });
    if (error) fail(error);
    await logAdminAudit('tier_change', 'profile', id, { tier });
    return { ok: true };
  },
  /**
   * Promote/demote to 'medical_coordinator' (admin-only in both directions).
   * No RPC needed: `profiles` RLS lets an admin update any row, and
   * guard_profile_role() only blocks a NON-admin from changing role — an
   * admin session writing another user's role passes both.
   */
  async setRole(id: string, role: 'user' | 'medical_coordinator'): Promise<{ ok: true }> {
    const { error } = await sb().from('profiles').update({ role }).eq('id', id);
    if (error) fail(error);
    await logAdminAudit('role_change', 'profile', id, { role });
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
  /**
   * Full per-user detail for the admin: onboarding profile + their activity.
   *
   * Now includes their service requests. Without them the link between a
   * customer and what they actually asked for existed in neither direction —
   * the queue did not name the account, and the account did not list the
   * requests.
   */
  async detail(userId: string): Promise<{ onboarding: Profile | null; bookings: Booking[]; leads: Lead[]; requests: ServiceRequest[] }> {
    const c = sb();
    const [{ data: prof }, { data: bk }, { data: ld }, { data: sr }] = await Promise.all([
      c.from('profiles').select('onboarding').eq('id', userId).maybeSingle(),
      c.from('bookings').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      c.from('leads').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      c.from('service_requests')
        .select('id,name,phone,message,service_id,service_title,category,service_type,status,customer_id,created_at')
        .eq('customer_id', userId).order('created_at', { ascending: false }),
    ]);
    return {
      onboarding: (prof?.onboarding as Profile | null) ?? null,
      bookings: ((bk as BookingRow[]) ?? []).map(toBooking),
      leads: ((ld as LeadRow[]) ?? []).map(toLead),
      requests: ((sr ?? []) as (ServiceRequestRow & { customer_id: string | null })[]).map((r) => ({
        id: r.id, name: r.name, phone: r.phone, message: r.message ?? undefined,
        serviceId: r.service_id ?? null,
        serviceTitle: r.service_title ?? '', category: r.category ?? '', serviceType: r.service_type ?? '',
        status: r.status, createdAt: r.created_at, customerId: r.customer_id ?? null,
      })),
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
    await logAdminAudit('listing_delete', 'listing', id);
    return { ok: true };
  },
};

// ---------- investment opportunities (public read, admin write) --------------

/**
 * Opportunities live in the database so the admin can edit them without a
 * deploy. The built-in catalogue in `src/data/investments.ts` stays as the
 * seed and as the fallback: if the table is missing or empty — which is the
 * case until the migration runs — the public pages keep rendering the eleven
 * files rather than showing an empty section.
 */
interface InvestmentRow {
  id: string; slug: string; brand: string; name: LocalizedText; district: LocalizedText;
  type: LocalizedText; summary: LocalizedText; developer: string; side: string;
  min_usd: number; max_usd: number | null; pros: LocalizedText[]; cons: LocalizedText[];
  extra_facts: { key: string; value: string | LocalizedText }[] | null;
  images: string[] | null; source: { label: string; url: string } | null;
  sort: number; published: boolean;
}

const toInvestment = (r: InvestmentRow): InvestmentRecord => ({
  id: r.id, slug: r.slug, brand: r.brand, name: r.name, district: r.district, type: r.type,
  summary: r.summary, developer: r.developer, side: r.side === 'asian' ? 'asian' : 'european',
  minUsd: Number(r.min_usd), maxUsd: r.max_usd === null ? null : Number(r.max_usd),
  pros: Array.isArray(r.pros) ? r.pros : [], cons: Array.isArray(r.cons) ? r.cons : [],
  extraFacts: Array.isArray(r.extra_facts) ? r.extra_facts : [],
  images: Array.isArray(r.images) ? r.images : [],
  source: r.source ?? { label: '', url: '' },
  sort: r.sort, published: r.published,
});

const fromInvestment = (i: InvestmentInput) => ({
  slug: i.slug, brand: i.brand, name: i.name, district: i.district, type: i.type,
  summary: i.summary, developer: i.developer, side: i.side, min_usd: i.minUsd,
  max_usd: i.maxUsd, pros: i.pros, cons: i.cons, extra_facts: i.extraFacts,
  images: i.images, source: i.source, sort: i.sort, published: i.published,
});

export const investments = {
  /** Public list. Returns [] on any failure so callers can fall back. */
  async list(): Promise<InvestmentRecord[]> {
    const { data, error } = await sb()
      .from('investment_opportunities')
      .select('*')
      .eq('published', true)
      .order('sort', { ascending: true });
    if (error) return [];
    return (data as InvestmentRow[]).map(toInvestment);
  },
  /** Admin list — includes unpublished rows. Throws, so admin fails loud. */
  async adminList(): Promise<InvestmentRecord[]> {
    const { data, error } = await sb()
      .from('investment_opportunities')
      .select('*')
      .order('sort', { ascending: true });
    if (error) fail(error);
    return (data as InvestmentRow[]).map(toInvestment);
  },
  async create(input: InvestmentInput): Promise<{ id: string }> {
    const { data, error } = await sb().from('investment_opportunities').insert(fromInvestment(input)).select('id').single();
    if (error) fail(error);
    return { id: data!.id };
  },
  async update(id: string, input: InvestmentInput): Promise<{ ok: true }> {
    const { error } = await sb().from('investment_opportunities').update(fromInvestment(input)).eq('id', id);
    if (error) fail(error);
    return { ok: true };
  },
  async remove(id: string): Promise<{ ok: true }> {
    const { error } = await sb().from('investment_opportunities').delete().eq('id', id);
    if (error) fail(error);
    await logAdminAudit('investment_delete', 'investment_opportunity', id);
    return { ok: true };
  },
  /** Reuses the public `listings` bucket — no second bucket to police. */
  uploadImage(file: File): Promise<string> {
    return listings.uploadImage(file);
  },
};

/**
 * Sales-office contact details. INTERNAL ONLY.
 *
 * These are the numbers our team calls to request a photo pack. They belong to
 * partner companies, are not ours to publish, and the public pages never import
 * this object. RLS denies anon at the table level as a second line of defence.
 */
export const investmentContacts = {
  async get(opportunityId: string): Promise<InvestmentContact | null> {
    const { data, error } = await sb()
      .from('investment_contacts')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .maybeSingle();
    if (error) fail(error);
    if (!data) return null;
    const r = data as Record<string, string>;
    return {
      opportunityId: r.opportunity_id, salesEmail: r.sales_email ?? '', salesPhone: r.sales_phone ?? '',
      whatsapp: r.whatsapp ?? '', officialUrl: r.official_url ?? '', pressUrl: r.press_url ?? '',
      permission: (r.permission as InvestmentContact['permission']) ?? 'none', notes: r.notes ?? '',
    };
  },
  async save(c: InvestmentContact): Promise<{ ok: true }> {
    const { error } = await sb().from('investment_contacts').upsert({
      opportunity_id: c.opportunityId, sales_email: c.salesEmail, sales_phone: c.salesPhone,
      whatsapp: c.whatsapp, official_url: c.officialUrl, press_url: c.pressUrl,
      permission: c.permission, notes: c.notes,
    });
    if (error) fail(error);
    return { ok: true };
  },
};

// ── Admin-editable service catalog (stored in settings.service_catalog) ──────
// Overrides layer on top of the static catalog: edit text, hide, or add services.
export interface CatalogOverrides {
  edits?: Record<string, Partial<Pick<ServiceItem, 'title' | 'desc' | 'category' | 'type' | 'icon' | 'onRequest' | 'image'>>>;
  hidden?: string[];
  added?: ServiceItem[];
}

export async function fetchCatalogOverrides(): Promise<CatalogOverrides | null> {
  const { data } = await sb().from('settings').select('value').eq('key', 'service_catalog').maybeSingle();
  return (data?.value as CatalogOverrides | undefined) ?? null;
}

export const adminCatalog = {
  /**
   * Admin read — deliberately NOT fetchCatalogOverrides().
   *
   * That function drops the error object on the floor (`const { data } = ...`)
   * and returns null, which is right for the customer-facing catalogStore: a
   * visitor should still see the catalog if the overrides row can't be read.
   * For the admin it is wrong in a way nothing on screen reveals — the panel
   * renders the bundled catalog WITHOUT their edits, hidden flags and added
   * services, so a hidden service looks live and the next toggle is computed
   * from `{}` and saved over the real overrides.
   *
   * So this one surfaces the error and the panel refuses to render a catalog
   * it cannot prove is current.
   */
  async get(): Promise<CatalogOverrides> {
    const { data, error } = await sb()
      .from('settings')
      .select('value')
      .eq('key', 'service_catalog')
      .maybeSingle();
    if (error) fail(error);
    return (data?.value as CatalogOverrides | undefined) ?? {};
  },
  async save(value: CatalogOverrides): Promise<{ ok: true }> {
    const { error } = await sb().from('settings').upsert({ key: 'service_catalog', value }, { onConflict: 'key' });
    if (error) fail(error);
    return { ok: true };
  },
  /** Reuses the public `listings` bucket — no second bucket to police. */
  uploadImage(file: File): Promise<string> {
    return listings.uploadImage(file);
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
    await logAdminAudit('place_delete', 'place', id);
    return { ok: true };
  },
};

// ---------- admin: payments --------------------------------------------------

interface PaymentRow {
  id: string; email: string | null; tier: PlanTier; billing: Billing; method: PayMethod; amount: number;
  status: PaymentRequest['status']; receipt_path: string | null; receipt_name: string | null; created_at: string;
}

export type PaymentStatusFilter = 'pending' | 'verified' | 'rejected' | 'all';

export interface PaymentHistory {
  payments: PaymentRequest[];
  /** Verified revenue of the returned slice, in TL. */
  totalVerifiedTl: number;
}

export const adminPayments = {
  /**
   * Payments history. Defaults to the pending verification queue; 'verified',
   * 'rejected' and 'all' (plus ISO date bounds) exist because the queue alone
   * left no way to see revenue, review a dispute, or trace a commission.
   */
  async list(
    filter: { status?: PaymentStatusFilter; from?: string; to?: string } = {},
  ): Promise<PaymentHistory> {
    const status = filter.status ?? 'pending';
    let q = sb()
      .from('payments')
      .select('id,email,tier,billing,method,amount,status,receipt_path,receipt_name,created_at')
      .order('created_at', { ascending: false });
    if (status !== 'all') q = q.eq('status', status);
    if (filter.from) q = q.gte('created_at', filter.from);
    if (filter.to) q = q.lte('created_at', `${filter.to}T23:59:59.999Z`);
    const { data, error } = await q;
    if (error) fail(error);
    const rows = data as PaymentRow[];
    return {
      payments: rows.map((p) => ({
        id: p.id, email: p.email ?? '', tier: p.tier, billing: p.billing, method: p.method, amount: p.amount,
        status: p.status, hasReceipt: !!p.receipt_path, receiptName: p.receipt_name ?? undefined, createdAt: p.created_at,
      })),
      totalVerifiedTl: rows.filter((p) => p.status === 'verified').reduce((sum, p) => sum + p.amount, 0),
    };
  },

  async pending(): Promise<PaymentRequest[]> {
    return (await adminPayments.list({ status: 'pending' })).payments;
  },
  async resolve(id: string, status: 'verified' | 'rejected'): Promise<{ ok: true }> {
    const { error } = await sb().rpc('admin_resolve_payment', { p_id: id, p_status: status });
    if (error) fail(error);
    await logAdminAudit('payment_resolve', 'payment', id, { status });
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
    // Class B guard — see bookings.mine(). A saved place silently reading as
    // unsaved is how a favorite gets "lost" with nothing ever failing.
    await requireUid();
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
  /** Catalog id (src/data/services.ts), null on rows predating this column. */
  serviceId: string | null;
  serviceTitle: string;
  category: string;
  serviceType: string;
  status: string;
  createdAt: string;
  /** The account that submitted it — null for a logged-out submission. */
  customerId?: string | null;
  /**
   * Owning profile, when the join resolved. null means either no account or a
   * profile lookup that failed; the row falls back to the typed name, which is
   * the only identity an anonymous submission ever has.
   */
  ownerName?: string | null;
  ownerEmail?: string | null;
}

interface ServiceRequestRow {
  id: string; name: string; phone: string; message: string | null;
  service_id: string | null; service_title: string | null; category: string | null; service_type: string | null;
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

  /**
   * Admin: move a request through the workflow. The RPC enforces the same
   * legal-transition map as the UI (src/lib/statusTransitions.ts) server-side
   * and logs to admin_audit_log — see 20260813_status_guardrails.sql.
   */
  async adminSetStatus(id: string, status: 'accepted' | 'done' | 'rejected'): Promise<{ ok: true }> {
    const { error } = await sb().rpc('set_service_request_status', { p_id: id, p_status: status });
    if (error) fail(error);
    return { ok: true };
  },
  /**
   * Admin badge: requests still awaiting a first response.
   *
   * Both 'new' and 'pending' count as unhandled — 'new' is what rows created
   * before the 20260719 status workflow use, and the two are interchangeable
   * until an admin accepts or rejects. Delegates to the shared metrics service
   * (METRICS.serviceRequestsUnhandled — also what AdminNewRequests mirrors).
   * 0 on any failure, so a count that cannot load never breaks the chrome it
   * is rendered in.
   */
  async newCount(): Promise<number> {
    const { value } = await readMetric('serviceRequestsUnhandled');
    return value ?? 0;
  },
  /**
   * Admin queue, with the owning account attached.
   *
   * customer_id was stored and populated but never selected, so two requests
   * from one signed-in customer were two unrelated strangers in the dashboard:
   * no way to see that the person asking about a tax number is the same person
   * who asked about a bank account last week.
   *
   * Joined client-side rather than with a PostgREST embed, exactly like the
   * users-overview rebuild: two queries regardless of row count, and it does
   * not depend on the FK being introspectable. The profile lookup is
   * best-effort — if it fails the requests still render with the name typed
   * into the form, because a queue that will not load is worse than a queue
   * without account links.
   */
  async adminList(): Promise<ServiceRequest[]> {
    const c = sb();
    const { data, error } = await c
      .from('service_requests')
      .select('id,name,phone,message,service_id,service_title,category,service_type,status,customer_id,created_at')
      .order('created_at', { ascending: false });
    if (error) fail(error);

    const rows = (data ?? []) as (ServiceRequestRow & { customer_id: string | null })[];
    const ids = [...new Set(rows.map((r) => r.customer_id).filter((v): v is string => !!v))];

    const owners = new Map<string, { name: string | null; email: string | null }>();
    if (ids.length > 0) {
      const prof = await c.from('profiles').select('id,name,email').in('id', ids);
      if (!prof.error) {
        for (const p of (prof.data ?? []) as { id: string; name: string | null; email: string | null }[]) {
          owners.set(p.id, { name: p.name, email: p.email });
        }
      }
    }

    return rows.map((r) => {
      const owner = r.customer_id ? owners.get(r.customer_id) : undefined;
      return {
        id: r.id, name: r.name, phone: r.phone, message: r.message ?? undefined,
        serviceId: r.service_id ?? null,
        serviceTitle: r.service_title ?? '', category: r.category ?? '', serviceType: r.service_type ?? '',
        status: r.status, createdAt: r.created_at,
        customerId: r.customer_id ?? null,
        ownerName: owner?.name ?? null,
        ownerEmail: owner?.email ?? null,
      };
    });
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

export interface ChatIdentity {
  name?: string | null;
  phone?: string | null;
  situation?: string | null;
}

export const ai = {
  /**
   * `onReply`, if given, fires the instant the full reply text is known —
   * BEFORE the word-by-word streaming animation below plays it out. Voice
   * mode hooks into this to start TTS generation (the slowest step) while
   * the text is still animating on screen, instead of only after, which
   * used to stack the two delays back to back.
   */
  async chat(
    messages: ChatMessage[],
    lang: string,
    onDelta: (text: string) => void,
    identity?: ChatIdentity,
    onReply?: (text: string) => void,
  ): Promise<ChatResult> {
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
        body: JSON.stringify({ messages: messages.map((m) => ({ role: m.role, text: m.text })), lang, identity }),
      });
      if (res.ok) {
        const d = (await res.json()) as { reply?: string; done?: boolean; error?: string };
        if (d?.reply && d.reply.trim()) reply = d.reply.trim();
        done = d?.done === true;
      }
    } catch {
      /* offline or function unavailable — keep the fallback reply */
    }

    onReply?.(reply);

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

  /**
   * Real (non-robotic) speech for voice mode, via /api/tts (Gemini TTS —
   * same key as chat). Returns a playable data: URL. Throws if unavailable
   * (no key, quota, network) — the caller falls back to the browser's own
   * voice rather than going silent.
   */
  async speak(text: string): Promise<string> {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error('tts_unavailable');
    const d = (await res.json()) as { audio?: string; mime?: string; error?: string };
    if (!d?.audio) throw new Error(d?.error ?? 'tts_unavailable');
    return `data:${d.mime ?? 'audio/wav'};base64,${d.audio}`;
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

export interface AdminAuditEntry {
  id: string;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

/** Read-only view onto admin_audit_log — writes only ever happen via logAdminAudit()/logPiiReveal() above. */
export const adminAuditLog = {
  async list(limit = 100): Promise<AdminAuditEntry[]> {
    const { data, error } = await sb()
      .from('admin_audit_log')
      .select('id,action,target_type,target_id,meta,created_at,actor:profiles(name)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) fail(error);
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      actorName: (r.actor as { name?: string } | null)?.name ?? null,
      action: r.action as string,
      targetType: r.target_type as string,
      targetId: (r.target_id as string) ?? null,
      meta: (r.meta as Record<string, unknown>) ?? {},
      createdAt: r.created_at as string,
    }));
  },
};

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
  /**
   * EVERY request this customer owns — no filter beyond ownership.
   *
   * This was `mine()`, and it also carried `.eq('broadcast', true)`. That name
   * is the actual root cause of a long investigation: "mine" reads as "all of
   * mine", so nothing about the call site suggested that a direct request —
   * correctly stored, correctly owned, readable under RLS — was being discarded
   * by the client. A customer submitted a request and was shown a page saying
   * he had never made one.
   *
   * The rename is the fix; dropping the .eq() is only the symptom. If a
   * broadcast-only read is ever needed it gets its own explicitly named
   * function, never this one with a filter smuggled inside.
   */
  async allMine(): Promise<CustomerRequest[]> {
    const uid = await requireUid();
    const { data, error } = await sb().from('service_requests')
      .select('id,service_title,category,service_type,area,message,status,broadcast,created_at')
      .eq('customer_id', uid).order('created_at', { ascending: false });
    if (error) fail(error);
    interface Row { id: string; service_title: string | null; category: string | null; service_type: string | null; area: string | null; message: string | null; status: string; broadcast: boolean | null; created_at: string; }
    return ((data ?? []) as Row[]).map((r) => ({
      id: r.id, serviceTitle: r.service_title ?? '', category: r.category ?? '', area: r.area ?? null,
      message: r.message ?? null, status: r.status, createdAt: r.created_at,
      // Carried for behaviour (whether to poll for offers), never for display:
      // the customer must never see a partner/direct or broadcast distinction.
      serviceType: r.service_type ?? '', broadcast: r.broadcast === true,
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
  /** Single request by ID for the owning customer */
  async byId(id: string): Promise<CustomerRequest | null> {
    await requireUid();
    const { data, error } = await sb().from('service_requests')
      .select('id,service_title,category,service_type,area,message,status,broadcast,created_at')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    interface Row { id: string; service_title: string | null; category: string | null; service_type: string | null; area: string | null; message: string | null; status: string; broadcast: boolean | null; created_at: string; }
    const r = data as Row;
    return {
      id: r.id, serviceTitle: r.service_title ?? '', category: r.category ?? '', area: r.area ?? null,
      message: r.message ?? null, status: r.status, createdAt: r.created_at,
      serviceType: r.service_type ?? '', broadcast: r.broadcast === true,
    };
  },
};

interface ServiceOfferRow {
  id: string; request_id: string; price: number; currency: string; details: string;
  image_paths: string[]; expires_at: string | null; status: string; created_at: string;
}
function toServiceOffer(r: ServiceOfferRow): ServiceOffer {
  return {
    id: r.id, requestId: r.request_id, price: r.price, currency: r.currency, details: r.details,
    imagePaths: r.image_paths ?? [], expiresAt: r.expires_at, status: r.status as ServiceOfferStatus,
    createdAt: r.created_at,
  };
}

/**
 * The customer side of the "admin sends one price offer per request" flow —
 * sibling of medicalOffers/medicalPayments, deliberately kept separate (see
 * supabase/migrations/20260812_service_offers.sql header for why).
 */
export const serviceOffers = {
  /** Full offer history for one of the caller's own requests, newest first. */
  async listForRequest(requestId: string): Promise<ServiceOffer[]> {
    const { data, error } = await sb()
      .from('service_offers')
      .select('id,request_id,price,currency,details,image_paths,expires_at,status,created_at')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return ((data ?? []) as ServiceOfferRow[]).map(toServiceOffer);
  },
  /** Reject a sent offer — the request stays open; admin can send a new one. */
  async reject(offerId: string): Promise<{ ok: true }> {
    const { error } = await sb().rpc('customer_reject_service_offer', { p_offer_id: offerId });
    if (error) fail(error);
    return { ok: true };
  },
};

interface ServicePaymentRow {
  id: string; request_id: string; offer_id: string; amount: number; currency: string;
  status: string; created_at: string; verified_at: string | null; gateway_session_id?: string | null;
}
function toServicePayment(r: ServicePaymentRow): ServicePayment {
  return {
    id: r.id, requestId: r.request_id, offerId: r.offer_id, amount: r.amount, currency: r.currency,
    status: r.status as ServicePaymentStatus, createdAt: r.created_at, verifiedAt: r.verified_at,
    gatewaySessionId: r.gateway_session_id ?? null,
  };
}

export const servicePayments = {
  /**
   * Creates the pending payment row with a server-computed amount (RPC reads
   * the live offer row; the client never supplies price), and mints an
   * opaque `gatewaySessionId`. `payUrl` is the checkout redirect — a hosted-
   * checkout stand-in (api/payments/service-pay.ts) until a real Whop
   * checkout session replaces it; see that file's header.
   */
  async createSession(offerId: string): Promise<{ paymentId: string; amount: number; currency: string; payUrl: string }> {
    const { data, error } = await sb().rpc('create_service_payment_session', { p_offer_id: offerId });
    if (error) fail(error);
    const row = (data as unknown[])?.[0] as
      | { payment_id: string; amount: number; currency: string; gateway_session_id: string }
      | undefined;
    if (!row) throw new ApiError('server_error', 500);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return {
      paymentId: row.payment_id,
      amount: row.amount,
      currency: row.currency,
      payUrl: `${origin}/api/payments/service-pay?session=${encodeURIComponent(row.gateway_session_id)}`,
    };
  },

  async forRequest(requestId: string): Promise<ServicePayment[]> {
    const { data, error } = await sb()
      .from('service_payments')
      .select('id,request_id,offer_id,amount,currency,status,created_at,verified_at,gateway_session_id')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return ((data ?? []) as ServicePaymentRow[]).map(toServicePayment);
  },

  /** Rebuild the checkout redirect for an existing pending payment (resume, no new session minted). */
  resumeUrl(payment: ServicePayment, returnPath: string): string | null {
    if (payment.status !== 'pending' || !payment.gatewaySessionId) return null;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/api/payments/service-pay?session=${encodeURIComponent(payment.gatewaySessionId)}&return=${encodeURIComponent(returnPath)}`;
  },
};

export const adminServiceOffers = {
  /** Admin: every offer + payment on one request — feeds the "send offer" panel. */
  async detail(requestId: string): Promise<{ offers: ServiceOffer[]; payments: ServicePayment[] }> {
    const [offersRes, paymentsRes] = await Promise.all([
      sb().from('service_offers').select('id,request_id,price,currency,details,image_paths,expires_at,status,created_at').eq('request_id', requestId).order('created_at', { ascending: false }),
      sb().from('service_payments').select('id,request_id,offer_id,amount,currency,status,created_at,verified_at').eq('request_id', requestId).order('created_at', { ascending: false }),
    ]);
    if (offersRes.error) fail(offersRes.error);
    if (paymentsRes.error) fail(paymentsRes.error);
    return {
      offers: ((offersRes.data ?? []) as ServiceOfferRow[]).map(toServiceOffer),
      payments: ((paymentsRes.data ?? []) as ServicePaymentRow[]).map(toServicePayment),
    };
  },

  async createOffer(requestId: string, input: {
    price: number; currency: string; details: string; imagePaths: string[]; expiresAt?: string | null;
  }): Promise<{ id: string }> {
    const uid = await requireUid();
    const { data, error } = await sb().from('service_offers').insert({
      request_id: requestId, price: input.price, currency: input.currency, details: input.details,
      image_paths: input.imagePaths, expires_at: input.expiresAt ?? null, status: 'sent', created_by: uid,
    }).select('id').single();
    if (error) fail(error);
    return { id: data!.id };
  },

  /** Admin: upload an offer photo to the public 'service-offer-media' bucket → public URL. */
  async uploadImage(file: File): Promise<string> {
    const c = sb();
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const up = await c.storage.from('service-offer-media').upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (up.error) fail(up.error);
    return c.storage.from('service-offer-media').getPublicUrl(path).data.publicUrl;
  },

  /** Reject an abandoned/failed pending payment. Same "no verify path" invariant as medical. */
  async resolvePayment(id: string): Promise<{ ok: true }> {
    const { error } = await sb().rpc('admin_set_service_payment_status', { p_id: id, p_status: 'rejected' });
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

// ---------- competitor ads (Meta Ads Library imports, per catalog service) --

interface CompetitorAdImportRow {
  id: string; service_id: string; file_name: string | null; row_count: number;
  imported_by: string | null; imported_at: string;
}
interface CompetitorAdRowDb {
  id: string; import_id: string; service_id: string; ad_library_id: string; advertiser_name: string;
  status: string | null; started_on: string | null; platforms: string | null; content_type: string | null;
  ad_text: string | null; ad_url: string | null; amount_spent: string | null;
  search_language: string | null; search_keyword: string | null;
  seen_in_previous_import: boolean; created_at: string;
}

export interface CompetitorAdImport {
  id: string;
  serviceId: string;
  fileName: string | null;
  rowCount: number;
  importedBy: string | null;
  importedAt: string;
}

export interface CompetitorAd {
  id: string;
  importId: string;
  serviceId: string;
  adLibraryId: string;
  advertiserName: string;
  status: string | null;
  startedOn: string | null;
  platforms: string | null;
  contentType: string | null;
  adText: string | null;
  adUrl: string | null;
  amountSpent: string | null;
  searchLanguage: string | null;
  searchKeyword: string | null;
  seenInPreviousImport: boolean;
  createdAt: string;
}

/** One row parsed from an uploaded .xlsx, before it's tied to an import batch. */
export interface CompetitorAdRow {
  adLibraryId: string;
  advertiserName: string;
  status: string | null;
  startedOn: string | null;
  platforms: string | null;
  contentType: string | null;
  adText: string | null;
  adUrl: string | null;
  amountSpent: string | null;
  searchLanguage: string | null;
  searchKeyword: string | null;
}

function toCompetitorAdImport(r: CompetitorAdImportRow): CompetitorAdImport {
  return {
    id: r.id, serviceId: r.service_id, fileName: r.file_name, rowCount: r.row_count,
    importedBy: r.imported_by, importedAt: r.imported_at,
  };
}

function toCompetitorAd(r: CompetitorAdRowDb): CompetitorAd {
  return {
    id: r.id, importId: r.import_id, serviceId: r.service_id, adLibraryId: r.ad_library_id,
    advertiserName: r.advertiser_name, status: r.status, startedOn: r.started_on, platforms: r.platforms,
    contentType: r.content_type, adText: r.ad_text, adUrl: r.ad_url, amountSpent: r.amount_spent,
    searchLanguage: r.search_language, searchKeyword: r.search_keyword,
    seenInPreviousImport: r.seen_in_previous_import, createdAt: r.created_at,
  };
}

export const adminCompetitorAds = {
  /** All imports for a service, newest first — drives the "previous versions" list. */
  async listImports(serviceId: string): Promise<CompetitorAdImport[]> {
    const { data, error } = await sb()
      .from('competitor_ad_imports')
      .select('id,service_id,file_name,row_count,imported_by,imported_at')
      .eq('service_id', serviceId)
      .order('imported_at', { ascending: false });
    if (error) fail(error);
    return ((data ?? []) as CompetitorAdImportRow[]).map(toCompetitorAdImport);
  },

  /** The import the manager tab shows by default — null when nothing's been imported yet. */
  async latestImport(serviceId: string): Promise<CompetitorAdImport | null> {
    const rows = await adminCompetitorAds.listImports(serviceId);
    return rows.length ? rows[0] : null;
  },

  /** Every ad belonging to one import batch (current or a past "previous version"). */
  async listAds(importId: string): Promise<CompetitorAd[]> {
    const { data, error } = await sb()
      .from('competitor_ads')
      .select(
        'id,import_id,service_id,ad_library_id,advertiser_name,status,started_on,platforms,content_type,ad_text,ad_url,amount_spent,search_language,search_keyword,seen_in_previous_import,created_at',
      )
      .eq('import_id', importId)
      .order('advertiser_name', { ascending: true });
    if (error) fail(error);
    return ((data ?? []) as CompetitorAdRowDb[]).map(toCompetitorAd);
  },

  /**
   * Records a new import batch and its ads. Never touches earlier imports —
   * they stay exactly as they were, browsable via listImports(). Each row is
   * flagged seenInPreviousImport when its ad_library_id already exists among
   * this service's PRIOR ads, so staff can tell a persistent competitor ad
   * from a brand-new one at a glance.
   */
  async importRows(serviceId: string, fileName: string, rows: CompetitorAdRow[]): Promise<CompetitorAdImport> {
    if (rows.length === 0) throw new ApiError('empty_import', 400);

    const existing = await sb().from('competitor_ads').select('ad_library_id').eq('service_id', serviceId);
    if (existing.error) fail(existing.error);
    const seenIds = new Set(((existing.data ?? []) as { ad_library_id: string }[]).map((r) => r.ad_library_id));

    const importedBy = (await sessionUser())?.id ?? null;
    const importInsert = await sb()
      .from('competitor_ad_imports')
      .insert([{ service_id: serviceId, file_name: fileName, row_count: rows.length, imported_by: importedBy }])
      .select()
      .single();
    if (importInsert.error) fail(importInsert.error);
    const importRow = importInsert.data as CompetitorAdImportRow;

    const adsPayload = rows.map((r) => ({
      import_id: importRow.id,
      service_id: serviceId,
      ad_library_id: r.adLibraryId,
      advertiser_name: r.advertiserName,
      status: r.status,
      started_on: r.startedOn,
      platforms: r.platforms,
      content_type: r.contentType,
      ad_text: r.adText,
      ad_url: r.adUrl,
      amount_spent: r.amountSpent,
      search_language: r.searchLanguage,
      search_keyword: r.searchKeyword,
      seen_in_previous_import: seenIds.has(r.adLibraryId),
    }));
    const adsInsert = await sb().from('competitor_ads').insert(adsPayload);
    if (adsInsert.error) fail(adsInsert.error);

    return toCompetitorAdImport(importRow);
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

// ---------- medical tourism ---------------------------------------------------

const MEDICAL_FILE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']);
const MEDICAL_FILE_MAX_BYTES = 10 * 1024 * 1024;

/** Strip path separators/traversal and control chars; keep it short. */
function sanitizeMedicalFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  return base.replace(/[^\w.\- ]+/g, '_').slice(-150) || 'file';
}

interface MedicalRequestRow {
  id: string; specialty: string; description: string; expected_travel_date: string | null;
  budget_estimate: number | null; notes: string | null; status: string; customer_note: string | null;
  internal_note?: string | null; created_at: string; updated_at: string;
}
function toMedicalRequest(r: MedicalRequestRow): MedicalRequest {
  return {
    id: r.id, specialty: r.specialty, description: r.description,
    expectedTravelDate: r.expected_travel_date, budgetEstimate: r.budget_estimate,
    notes: r.notes, status: r.status as MedicalRequestStatus, customerNote: r.customer_note,
    internalNote: r.internal_note ?? null, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

interface MedicalFileRow {
  id: string; storage_path: string; original_filename: string; mime_type: string; size_bytes: number; created_at: string;
}
function toMedicalFile(r: MedicalFileRow): MedicalRequestFile & { storagePath: string } {
  return { id: r.id, originalFilename: r.original_filename, mimeType: r.mime_type, sizeBytes: r.size_bytes, createdAt: r.created_at, storagePath: r.storage_path };
}

interface MedicalOfferRow {
  id: string; request_id: string; treatment_plan: string; total_price: number; currency: string;
  included: string[] | null; excluded: string[] | null; sessions_or_days: string | null;
  expires_at: string | null; booking_percentage: number; status: string; created_at: string;
}
function toMedicalOffer(r: MedicalOfferRow): MedicalOffer {
  return {
    id: r.id, requestId: r.request_id, treatmentPlan: r.treatment_plan, totalPrice: r.total_price,
    currency: r.currency, included: r.included ?? [], excluded: r.excluded ?? [],
    sessionsOrDays: r.sessions_or_days, expiresAt: r.expires_at, bookingPercentage: r.booking_percentage,
    status: r.status as MedicalOffer['status'], createdAt: r.created_at,
  };
}

/** Best-effort audit log write — never blocks or fails the action it accompanies. */
async function logMedicalAudit(c: SupabaseClient, action: string, targetType: string, targetId: string, meta: Record<string, unknown> = {}): Promise<void> {
  await c.rpc('medical_audit_log_write', { p_action: action, p_target_type: targetType, p_target_id: targetId, p_meta: meta });
}

export const medicalRequests = {
  /** Submit a new case. `consentAt` is stamped here, not trusted from a stale form state. */
  async create(input: {
    specialty: string; description: string; expectedTravelDate?: string | null;
    budgetEstimate?: number | null; notes?: string | null;
  }): Promise<{ id: string }> {
    const uid = await requireUid();
    const { data, error } = await sb()
      .from('medical_requests')
      .insert({
        user_id: uid, specialty: input.specialty, description: input.description,
        expected_travel_date: input.expectedTravelDate ?? null,
        budget_estimate: input.budgetEstimate ?? null, notes: input.notes ?? null,
        consent_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) fail(error);
    return { id: data!.id };
  },

  async mine(): Promise<MedicalRequest[]> {
    await requireUid();
    const { data, error } = await sb()
      .from('medical_requests')
      .select('id,specialty,description,expected_travel_date,budget_estimate,notes,status,customer_note,created_at,updated_at')
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return ((data ?? []) as MedicalRequestRow[]).map(toMedicalRequest);
  },

  /** One request with its files (RLS: owner or medical staff only). */
  async detail(id: string): Promise<MedicalRequest | null> {
    const { data, error } = await sb()
      .from('medical_requests')
      .select('id,specialty,description,expected_travel_date,budget_estimate,notes,status,customer_note,internal_note,created_at,updated_at')
      .eq('id', id)
      .maybeSingle();
    if (error) fail(error);
    if (!data) return null;
    const req = toMedicalRequest(data as MedicalRequestRow);
    req.files = await medicalRequests.files(id);
    return req;
  },

  async files(requestId: string): Promise<MedicalRequestFile[]> {
    const { data, error } = await sb()
      .from('medical_request_files')
      .select('id,storage_path,original_filename,mime_type,size_bytes,created_at')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });
    if (error) fail(error);
    return ((data ?? []) as MedicalFileRow[]).map(toMedicalFile);
  },

  /** Client-side validation mirrors the server-side bucket/table checks — both must pass. */
  async uploadFile(requestId: string, file: File): Promise<MedicalRequestFile> {
    const uid = await requireUid();
    if (!MEDICAL_FILE_TYPES.has(file.type)) throw new ApiError('unsupported_file_type', 400);
    if (file.size > MEDICAL_FILE_MAX_BYTES) throw new ApiError('file_too_large', 400);
    const c = sb();
    const safe = sanitizeMedicalFilename(file.name);
    const path = `${uid}/${requestId}/${Date.now()}-${safe}`;
    const up = await c.storage.from('medical-files').upload(path, file, { upsert: false });
    if (up.error) {
      logDiagnostic('medicalRequests.uploadFile', up.error, classifyError(up.error));
      throw new ApiError('file_upload_failed', 502);
    }
    const { data, error } = await c
      .from('medical_request_files')
      .insert({ request_id: requestId, storage_path: path, original_filename: safe, mime_type: file.type, size_bytes: file.size })
      .select('id,storage_path,original_filename,mime_type,size_bytes,created_at')
      .single();
    if (error) fail(error);
    return toMedicalFile(data as MedicalFileRow);
  },

  /** Open one of the caller's own files via a short-lived signed URL. */
  async openFile(fileId: string): Promise<void> {
    const c = sb();
    const { data: row } = await c.from('medical_request_files').select('storage_path').eq('id', fileId).maybeSingle();
    if (!row) return;
    const { data } = await c.storage.from('medical-files').createSignedUrl(row.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  },

  async requestOptionalService(requestId: string, serviceType: MedicalOptionalServiceType, notes?: string): Promise<{ ok: true }> {
    const { error } = await sb().from('medical_optional_services').insert({ request_id: requestId, service_type: serviceType, notes: notes ?? null });
    if (error) fail(error);
    return { ok: true };
  },

  async optionalServices(requestId: string): Promise<MedicalOptionalService[]> {
    const { data, error } = await sb()
      .from('medical_optional_services')
      .select('id,request_id,service_type,status,notes,created_at')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });
    if (error) fail(error);
    interface Row { id: string; request_id: string; service_type: string; status: string; notes: string | null; created_at: string; }
    return ((data ?? []) as Row[]).map((r) => ({
      id: r.id, requestId: r.request_id, serviceType: r.service_type as MedicalOptionalServiceType,
      status: r.status as MedicalOptionalService['status'], notes: r.notes, createdAt: r.created_at,
    }));
  },
};

export const medicalOffers = {
  /** Public-safe offer fields only — the table structurally has no center columns. */
  async listForRequest(requestId: string): Promise<MedicalOffer[]> {
    const { data, error } = await sb()
      .from('medical_offers')
      .select('id,request_id,treatment_plan,total_price,currency,included,excluded,sessions_or_days,expires_at,booking_percentage,status,created_at')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return ((data ?? []) as MedicalOfferRow[]).map(toMedicalOffer);
  },

  /** Returns null until a verified payment exists for this offer — enforced server-side. */
  async getCenter(offerId: string): Promise<MedicalOfferCenter | null> {
    const { data, error } = await sb().rpc('get_offer_center', { p_offer_id: offerId });
    if (error) fail(error);
    const row = (data as unknown[])?.[0] as
      | { center_name: string; doctor_name: string; address: string; phone: string; website: string; map_url: string; image_paths: string[]; appointment_details: string }
      | undefined;
    if (!row) return null;
    return {
      centerName: row.center_name, doctorName: row.doctor_name, address: row.address, phone: row.phone,
      website: row.website, mapUrl: row.map_url, imagePaths: row.image_paths ?? [], appointmentDetails: row.appointment_details,
    };
  },
};

interface MedicalPaymentRow {
  id: string; request_id: string; offer_id: string; amount: number; currency: string;
  booking_percentage_snapshot: number; status: string; created_at: string; verified_at: string | null;
  gateway_session_id?: string | null;
}
function toMedicalPayment(r: MedicalPaymentRow): MedicalPayment {
  return {
    id: r.id, requestId: r.request_id, offerId: r.offer_id, amount: r.amount, currency: r.currency,
    bookingPercentageSnapshot: r.booking_percentage_snapshot, status: r.status as MedicalPaymentStatus,
    createdAt: r.created_at, verifiedAt: r.verified_at, gatewaySessionId: r.gateway_session_id ?? null,
  };
}

export const medicalPayments = {
  /**
   * Creates the pending payment row with a server-computed amount (RPC reads
   * the live offer row; the client never supplies price or percentage), and
   * mints an opaque `gatewaySessionId`. `payUrl` is the checkout redirect —
   * a hosted-checkout stand-in (api/payments/medical-pay.ts) that completes
   * ONLY by delivering the same signed webhook a real gateway would
   * (api/payments/medical-webhook.ts). There is no client-side path to
   * "verified" — this call never returns one.
   */
  async createSession(offerId: string): Promise<{ paymentId: string; amount: number; currency: string; payUrl: string }> {
    const { data, error } = await sb().rpc('create_medical_payment_session', { p_offer_id: offerId });
    if (error) fail(error);
    const row = (data as unknown[])?.[0] as
      | { payment_id: string; amount: number; currency: string; gateway_session_id: string }
      | undefined;
    if (!row) throw new ApiError('server_error', 500);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return {
      paymentId: row.payment_id,
      amount: row.amount,
      currency: row.currency,
      payUrl: `${origin}/api/payments/medical-pay?session=${encodeURIComponent(row.gateway_session_id)}`,
    };
  },

  async forRequest(requestId: string): Promise<MedicalPayment[]> {
    const { data, error } = await sb()
      .from('medical_payments')
      .select('id,request_id,offer_id,amount,currency,booking_percentage_snapshot,status,created_at,verified_at,gateway_session_id')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });
    if (error) fail(error);
    return ((data ?? []) as MedicalPaymentRow[]).map(toMedicalPayment);
  },

  /** Rebuild the checkout redirect for an existing pending payment (resume, no new session minted). */
  resumeUrl(payment: MedicalPayment, returnPath: string): string | null {
    if (payment.status !== 'pending' || !payment.gatewaySessionId) return null;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/api/payments/medical-pay?session=${encodeURIComponent(payment.gatewaySessionId)}&return=${encodeURIComponent(returnPath)}`;
  },

  /** Customer asks for a refund on their own verified payment — status flip only. */
  async requestRefund(paymentId: string): Promise<{ ok: true }> {
    const { error } = await sb().from('medical_payments').update({ status: 'refund_requested' }).eq('id', paymentId);
    if (error) fail(error);
    return { ok: true };
  },
};

type LocalizedRow = { ar?: string; en?: string; fa?: string; ru?: string } | null;
function toLocalized(v: LocalizedRow): LocalizedText {
  return { ar: v?.ar ?? '', en: v?.en ?? '', fa: v?.fa ?? '', ru: v?.ru ?? '' };
}

/**
 * A raw error from these calls used to reach SectionState's error branch on
 * the PUBLIC medical-tourism page — "Supporting services — something went
 * wrong, retry" in front of a visitor who did nothing wrong, whether the
 * cause was a genuinely empty (or not-yet-migrated) table or a real outage.
 * Marketing content is never worth that: any failure here resolves to an
 * empty list (which the page renders as a clean empty state or hides the
 * section entirely) instead of throwing, and is logged for diagnosis via the
 * same dev-only logDiagnostic() every other migration-tolerant read in this
 * file already uses — never surfaced to the visitor either way.
 */
async function loadMedicalContent<T>(scope: string, run: () => PromiseLike<{ data: unknown; error: unknown }>, map: (rows: unknown[]) => T[]): Promise<T[]> {
  try {
    const { data, error } = await run();
    if (error) {
      logDiagnostic(scope, error, classifyError(error));
      return [];
    }
    return map((data as unknown[]) ?? []);
  } catch (e) {
    logDiagnostic(scope, e, classifyError(e));
    return [];
  }
}

export const medicalContent = {
  async specialties(): Promise<MedicalSpecialty[]> {
    interface Row { id: string; slug: string; name: LocalizedRow; description: LocalizedRow; icon: string | null; sort: number; visible: boolean; }
    return loadMedicalContent(
      'medicalContent.specialties',
      () => sb().from('medical_specialties').select('id,slug,name,description,icon,sort,visible').order('sort', { ascending: true }),
      (rows) => (rows as Row[]).map((r) => ({ id: r.id, slug: r.slug, name: toLocalized(r.name), description: toLocalized(r.description), icon: r.icon, sort: r.sort, visible: r.visible })),
    );
  },
  async services(): Promise<MedicalService[]> {
    interface Row { id: string; slug: string; name: LocalizedRow; description: LocalizedRow; icon: string | null; sort: number; visible: boolean; }
    return loadMedicalContent(
      'medicalContent.services',
      () => sb().from('medical_services').select('id,slug,name,description,icon,sort,visible').order('sort', { ascending: true }),
      (rows) => (rows as Row[]).map((r) => ({ id: r.id, slug: r.slug, name: toLocalized(r.name), description: toLocalized(r.description), icon: r.icon, sort: r.sort, visible: r.visible })),
    );
  },
  /** Landing-page showcase cards (/health-tourism "specialties" carousel) — visible only, ordered. */
  async landingCards(): Promise<MedicalLandingCard[]> {
    interface Row { id: string; slug: string; title: LocalizedRow; description: LocalizedRow; image_url: string | null; sort: number; visible: boolean; }
    return loadMedicalContent(
      'medicalContent.landingCards',
      () => sb().from('medical_landing_cards').select('id,slug,title,description,image_url,sort,visible').eq('visible', true).order('sort', { ascending: true }),
      (rows) => (rows as Row[]).map((r) => ({ id: r.id, slug: r.slug, title: toLocalized(r.title), description: toLocalized(r.description), imageUrl: r.image_url, sort: r.sort, visible: r.visible })),
    );
  },
  /** Hero before/after carousel slides — visible only, ordered. */
  async heroSlides(): Promise<MedicalHeroSlide[]> {
    interface Row { id: string; image_url: string; caption: LocalizedRow; sort: number; visible: boolean; }
    return loadMedicalContent(
      'medicalContent.heroSlides',
      () => sb().from('medical_hero_slides').select('id,image_url,caption,sort,visible').eq('visible', true).order('sort', { ascending: true }),
      (rows) => (rows as Row[]).map((r) => ({ id: r.id, imageUrl: r.image_url, caption: toLocalized(r.caption), sort: r.sort, visible: r.visible })),
    );
  },
  async faqs(): Promise<MedicalFaq[]> {
    interface Row { id: string; question: LocalizedRow; answer: LocalizedRow; sort: number; visible: boolean; }
    return loadMedicalContent(
      'medicalContent.faqs',
      () => sb().from('medical_faqs').select('id,question,answer,sort,visible').order('sort', { ascending: true }),
      (rows) => (rows as Row[]).map((r) => ({ id: r.id, question: toLocalized(r.question), answer: toLocalized(r.answer), sort: r.sort, visible: r.visible })),
    );
  },
  /** Published testimonials only — draft rows never reach a visitor (RLS-enforced too). */
  async testimonials(): Promise<MedicalTestimonial[]> {
    interface Row { id: string; author_name: string; quote: LocalizedRow; image_path: string | null; status: string; consent_given: boolean; sort: number; }
    return loadMedicalContent(
      'medicalContent.testimonials',
      () => sb().from('medical_testimonials').select('id,author_name,quote,image_path,status,consent_given,sort').eq('status', 'published').order('sort', { ascending: true }),
      (rows) => (rows as Row[]).map((r) => ({ id: r.id, authorName: r.author_name, quote: toLocalized(r.quote), imagePath: r.image_path, status: r.status as 'draft' | 'published', consentGiven: r.consent_given, sort: r.sort })),
    );
  },
  async sections(): Promise<MedicalPageSection[]> {
    interface Row { section_key: string; visible: boolean; sort: number; }
    return loadMedicalContent(
      'medicalContent.sections',
      () => sb().from('medical_page_sections').select('section_key,visible,sort').order('sort', { ascending: true }),
      (rows) => (rows as Row[]).map((r) => ({ sectionKey: r.section_key, visible: r.visible, sort: r.sort })),
    );
  },
};

export const adminMedical = {
  /** Medical Tourism queue badge. Delegates to the shared metrics service (METRICS.medicalPendingReview); 0 on any failure. */
  async newCount(): Promise<number> {
    const { value } = await readMetric('medicalPendingReview');
    return value ?? 0;
  },

  async list(filter: { status?: string; specialty?: string; from?: string; to?: string; search?: string } = {}): Promise<AdminMedicalRequest[]> {
    const c = sb();
    let q = c.from('medical_requests')
      .select('id,user_id,specialty,description,expected_travel_date,budget_estimate,notes,status,customer_note,internal_note,created_at,updated_at')
      .order('created_at', { ascending: false });
    if (filter.status) q = q.eq('status', filter.status);
    if (filter.specialty) q = q.eq('specialty', filter.specialty);
    if (filter.from) q = q.gte('created_at', filter.from);
    if (filter.to) q = q.lte('created_at', `${filter.to}T23:59:59.999Z`);
    if (filter.search) q = q.ilike('description', `%${filter.search}%`);
    const { data, error } = await q;
    if (error) fail(error);
    const rows = (data ?? []) as (MedicalRequestRow & { user_id: string })[];

    const ids = [...new Set(rows.map((r) => r.user_id))];
    const owners = new Map<string, { name: string | null; email: string | null }>();
    if (ids.length > 0) {
      const prof = await c.from('profiles').select('id,name,email').in('id', ids);
      if (!prof.error) for (const p of (prof.data ?? []) as { id: string; name: string | null; email: string | null }[]) owners.set(p.id, { name: p.name, email: p.email });
    }

    const offerCounts = new Map<string, number>();
    if (rows.length > 0) {
      const offers = await c.from('medical_offers').select('request_id').in('request_id', rows.map((r) => r.id));
      if (!offers.error) for (const o of (offers.data ?? []) as { request_id: string }[]) offerCounts.set(o.request_id, (offerCounts.get(o.request_id) ?? 0) + 1);
    }

    return rows.map((r) => {
      const owner = owners.get(r.user_id);
      return { ...toMedicalRequest(r), userId: r.user_id, ownerName: owner?.name ?? null, ownerEmail: owner?.email ?? null, offersCount: offerCounts.get(r.id) ?? 0 };
    });
  },

  async detail(id: string): Promise<{ request: AdminMedicalRequest; files: (MedicalRequestFile & { storagePath: string })[]; offers: MedicalOffer[]; optionalServices: MedicalOptionalService[]; payments: MedicalPayment[] } | null> {
    const c = sb();
    const { data, error } = await c.from('medical_requests')
      .select('id,user_id,specialty,description,expected_travel_date,budget_estimate,notes,status,customer_note,internal_note,created_at,updated_at')
      .eq('id', id).maybeSingle();
    if (error) fail(error);
    if (!data) return null;
    const row = data as MedicalRequestRow & { user_id: string };
    const { data: prof } = await c.from('profiles').select('name,email').eq('id', row.user_id).maybeSingle();

    const [filesRes, offersRes, optRes, payRes] = await Promise.all([
      c.from('medical_request_files').select('id,storage_path,original_filename,mime_type,size_bytes,created_at').eq('request_id', id).order('created_at', { ascending: true }),
      c.from('medical_offers').select('id,request_id,treatment_plan,total_price,currency,included,excluded,sessions_or_days,expires_at,booking_percentage,status,created_at').eq('request_id', id).order('created_at', { ascending: false }),
      medicalRequests.optionalServices(id),
      c.from('medical_payments').select('id,request_id,offer_id,amount,currency,booking_percentage_snapshot,status,created_at,verified_at').eq('request_id', id).order('created_at', { ascending: false }),
    ]);
    if (filesRes.error) fail(filesRes.error);
    if (offersRes.error) fail(offersRes.error);
    if (payRes.error) fail(payRes.error);

    await logMedicalAudit(sb(), 'file_access', 'medical_request', id);

    return {
      request: { ...toMedicalRequest(row), userId: row.user_id, ownerName: prof?.name ?? null, ownerEmail: prof?.email ?? null, offersCount: (offersRes.data ?? []).length },
      files: ((filesRes.data ?? []) as MedicalFileRow[]).map(toMedicalFile),
      offers: ((offersRes.data ?? []) as MedicalOfferRow[]).map(toMedicalOffer),
      optionalServices: optRes,
      payments: ((payRes.data ?? []) as MedicalPaymentRow[]).map(toMedicalPayment),
    };
  },

  /** Open a patient file (staff) via signed URL — logged, since this is the sensitive read the audit log exists for. */
  async openFile(fileId: string, requestId: string): Promise<void> {
    const c = sb();
    const { data: row } = await c.from('medical_request_files').select('storage_path').eq('id', fileId).maybeSingle();
    if (!row) return;
    await logMedicalAudit(c, 'file_access', 'medical_request_file', fileId, { request_id: requestId });
    const { data } = await c.storage.from('medical-files').createSignedUrl(row.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  },

  /**
   * The RPC enforces the same legal-transition map as the UI
   * (src/lib/statusTransitions.ts) server-side and logs to admin_audit_log —
   * see 20260813_status_guardrails.sql. Replaces the old direct .update() +
   * logMedicalAudit pair, which accepted any status value.
   */
  async setStatus(id: string, status: MedicalRequestStatus): Promise<{ ok: true }> {
    const { error } = await sb().rpc('set_medical_request_status', { p_id: id, p_status: status });
    if (error) fail(error);
    return { ok: true };
  },

  async setNotes(id: string, notes: { internalNote?: string; customerNote?: string }): Promise<{ ok: true }> {
    const patch: Record<string, string> = {};
    if (notes.internalNote !== undefined) patch.internal_note = notes.internalNote;
    if (notes.customerNote !== undefined) patch.customer_note = notes.customerNote;
    const { error } = await sb().from('medical_requests').update(patch).eq('id', id);
    if (error) fail(error);
    return { ok: true };
  },

  async createOffer(requestId: string, input: {
    treatmentPlan: string; totalPrice: number; currency: string; included: string[]; excluded: string[];
    sessionsOrDays?: string; expiresAt?: string | null; bookingPercentage: number;
  }): Promise<{ id: string }> {
    const uid = await requireUid();
    const { data, error } = await sb().from('medical_offers').insert({
      request_id: requestId, treatment_plan: input.treatmentPlan, total_price: input.totalPrice, currency: input.currency,
      included: input.included, excluded: input.excluded, sessions_or_days: input.sessionsOrDays ?? null,
      expires_at: input.expiresAt ?? null, booking_percentage: input.bookingPercentage, status: 'sent', created_by: uid,
    }).select('id').single();
    if (error) fail(error);
    await logMedicalAudit(sb(), 'offer_edit', 'medical_offer', data!.id, { created: true });
    await sb().from('medical_requests').update({ status: 'offers_available' }).eq('id', requestId).in('status', ['pending_review', 'under_review', 'collecting_offers']);
    return { id: data!.id };
  },

  async updateOffer(offerId: string, patch: Partial<{
    treatmentPlan: string; totalPrice: number; currency: string; included: string[]; excluded: string[];
    sessionsOrDays: string | null; expiresAt: string | null; bookingPercentage: number; status: 'draft' | 'sent' | 'expired';
  }>): Promise<{ ok: true }> {
    const row: Record<string, unknown> = {};
    if (patch.treatmentPlan !== undefined) row.treatment_plan = patch.treatmentPlan;
    if (patch.totalPrice !== undefined) row.total_price = patch.totalPrice;
    if (patch.currency !== undefined) row.currency = patch.currency;
    if (patch.included !== undefined) row.included = patch.included;
    if (patch.excluded !== undefined) row.excluded = patch.excluded;
    if (patch.sessionsOrDays !== undefined) row.sessions_or_days = patch.sessionsOrDays;
    if (patch.expiresAt !== undefined) row.expires_at = patch.expiresAt;
    if (patch.bookingPercentage !== undefined) row.booking_percentage = patch.bookingPercentage;
    if (patch.status !== undefined) row.status = patch.status;
    const { error } = await sb().from('medical_offers').update(row).eq('id', offerId);
    if (error) fail(error);
    const action = patch.bookingPercentage !== undefined ? 'percentage_change' : 'offer_edit';
    await logMedicalAudit(sb(), action, 'medical_offer', offerId, patch as Record<string, unknown>);
    return { ok: true };
  },

  async getCenter(offerId: string): Promise<MedicalOfferCenter | null> {
    const { data, error } = await sb().from('medical_offer_centers')
      .select('center_name,doctor_name,address,phone,website,map_url,image_paths,appointment_details')
      .eq('offer_id', offerId).maybeSingle();
    if (error) fail(error);
    if (!data) return null;
    return {
      centerName: data.center_name, doctorName: data.doctor_name, address: data.address, phone: data.phone,
      website: data.website, mapUrl: data.map_url, imagePaths: (data.image_paths as string[]) ?? [], appointmentDetails: data.appointment_details,
    };
  },

  async setCenter(offerId: string, center: {
    centerName: string; doctorName: string; address: string; phone: string; website?: string; mapUrl?: string; appointmentDetails?: string;
  }): Promise<{ ok: true }> {
    const { error } = await sb().from('medical_offer_centers').upsert({
      offer_id: offerId, center_name: center.centerName, doctor_name: center.doctorName, address: center.address,
      phone: center.phone, website: center.website ?? '', map_url: center.mapUrl ?? '', appointment_details: center.appointmentDetails ?? '',
    }, { onConflict: 'offer_id' });
    if (error) fail(error);
    await logMedicalAudit(sb(), 'offer_edit', 'medical_offer', offerId, { center_set: true });
    return { ok: true };
  },

  async optionalServices(status?: string): Promise<(MedicalOptionalService & { requestSpecialty?: string })[]> {
    let q = sb().from('medical_optional_services').select('id,request_id,service_type,status,notes,created_at').order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) fail(error);
    interface Row { id: string; request_id: string; service_type: string; status: string; notes: string | null; created_at: string; }
    return ((data ?? []) as Row[]).map((r) => ({ id: r.id, requestId: r.request_id, serviceType: r.service_type as MedicalOptionalServiceType, status: r.status as MedicalOptionalService['status'], notes: r.notes, createdAt: r.created_at }));
  },
  async setOptionalServiceStatus(id: string, status: 'confirmed' | 'declined' | 'cancelled'): Promise<{ ok: true }> {
    const { error } = await sb().from('medical_optional_services').update({ status }).eq('id', id);
    if (error) fail(error);
    return { ok: true };
  },

  /**
   * Reject an abandoned/failed pending payment, or mark an already-verified
   * payment refunded. Deliberately excludes 'verified' — the RPC itself
   * rejects that value, so this is belt-and-suspenders: staff has no path,
   * client or server, to mark a booking paid. Only the signed webhook can.
   */
  async resolvePayment(id: string, status: 'rejected' | 'refunded'): Promise<{ ok: true }> {
    const { error } = await sb().rpc('admin_set_medical_payment_status', { p_id: id, p_status: status });
    if (error) fail(error);
    return { ok: true };
  },
};

export const adminMedicalContent = {
  async saveSpecialty(input: Partial<MedicalSpecialty> & { slug: string }): Promise<{ ok: true }> {
    const { error } = await sb().from('medical_specialties').upsert({
      id: input.id, slug: input.slug, name: input.name, description: input.description,
      icon: input.icon ?? null, sort: input.sort ?? 0, visible: input.visible ?? true,
    }, { onConflict: 'slug' });
    if (error) fail(error);
    return { ok: true };
  },
  async deleteSpecialty(id: string): Promise<{ ok: true }> {
    const { error } = await sb().from('medical_specialties').delete().eq('id', id);
    if (error) fail(error);
    return { ok: true };
  },
  async saveService(input: Partial<MedicalService> & { slug: string }): Promise<{ ok: true }> {
    const { error } = await sb().from('medical_services').upsert({
      id: input.id, slug: input.slug, name: input.name, description: input.description,
      icon: input.icon ?? null, sort: input.sort ?? 0, visible: input.visible ?? true,
    }, { onConflict: 'slug' });
    if (error) fail(error);
    return { ok: true };
  },
  async deleteService(id: string): Promise<{ ok: true }> {
    const { error } = await sb().from('medical_services').delete().eq('id', id);
    if (error) fail(error);
    return { ok: true };
  },
  async listAllLandingCards(): Promise<MedicalLandingCard[]> {
    const { data, error } = await sb().from('medical_landing_cards').select('id,slug,title,description,image_url,sort,visible').order('sort', { ascending: true });
    if (error) fail(error);
    interface Row { id: string; slug: string; title: LocalizedRow; description: LocalizedRow; image_url: string | null; sort: number; visible: boolean; }
    return ((data ?? []) as Row[]).map((r) => ({ id: r.id, slug: r.slug, title: toLocalized(r.title), description: toLocalized(r.description), imageUrl: r.image_url, sort: r.sort, visible: r.visible }));
  },
  async saveLandingCard(input: Partial<MedicalLandingCard> & { slug: string }): Promise<{ ok: true }> {
    const { error } = await sb().from('medical_landing_cards').upsert({
      id: input.id, slug: input.slug, title: input.title, description: input.description,
      image_url: input.imageUrl ?? null, sort: input.sort ?? 0, visible: input.visible ?? true,
    }, { onConflict: 'slug' });
    if (error) fail(error);
    return { ok: true };
  },
  async deleteLandingCard(id: string): Promise<{ ok: true }> {
    const { error } = await sb().from('medical_landing_cards').delete().eq('id', id);
    if (error) fail(error);
    return { ok: true };
  },
  async listAllHeroSlides(): Promise<MedicalHeroSlide[]> {
    const { data, error } = await sb().from('medical_hero_slides').select('id,image_url,caption,sort,visible').order('sort', { ascending: true });
    if (error) fail(error);
    interface Row { id: string; image_url: string; caption: LocalizedRow; sort: number; visible: boolean; }
    return ((data ?? []) as Row[]).map((r) => ({ id: r.id, imageUrl: r.image_url, caption: toLocalized(r.caption), sort: r.sort, visible: r.visible }));
  },
  async saveHeroSlide(input: Partial<MedicalHeroSlide> & { imageUrl: string }): Promise<{ ok: true }> {
    const { error } = await sb().from('medical_hero_slides').upsert({
      id: input.id, image_url: input.imageUrl, caption: input.caption, sort: input.sort ?? 0, visible: input.visible ?? true,
    });
    if (error) fail(error);
    return { ok: true };
  },
  async deleteHeroSlide(id: string): Promise<{ ok: true }> {
    const { error } = await sb().from('medical_hero_slides').delete().eq('id', id);
    if (error) fail(error);
    return { ok: true };
  },
  /**
   * Type it once in one language, get the other 3 back. `fields` is e.g.
   * { title: '...', description: '...' } in `sourceLang`; the return value
   * has one entry per OTHER language with the same keys translated.
   * Never throws on a translation failure (rate-limited/misconfigured
   * Gemini key) — callers should treat an empty result as "fill in the
   * rest yourself", not as a hard error.
   */
  async translateFields(sourceLang: 'ar' | 'en' | 'ru' | 'fa', fields: Record<string, string>): Promise<Partial<Record<'ar' | 'en' | 'ru' | 'fa', Record<string, string>>>> {
    const { data } = await sb().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return {};
    try {
      const res = await fetch('/api/admin/medical-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sourceLang, fields }),
      });
      if (!res.ok) return {};
      return (await res.json()) as Partial<Record<'ar' | 'en' | 'ru' | 'fa', Record<string, string>>>;
    } catch {
      return {};
    }
  },
  /** Admin: upload a landing-page image (specialty card, hero slide) to the public 'medical-media' bucket → public URL. */
  async uploadImage(file: File): Promise<string> {
    const c = sb();
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const up = await c.storage.from('medical-media').upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (up.error) fail(up.error);
    return c.storage.from('medical-media').getPublicUrl(path).data.publicUrl;
  },
  async saveFaq(input: Partial<MedicalFaq>): Promise<{ ok: true }> {
    const { error } = await sb().from('medical_faqs').upsert({ id: input.id, question: input.question, answer: input.answer, sort: input.sort ?? 0, visible: input.visible ?? true });
    if (error) fail(error);
    return { ok: true };
  },
  async deleteFaq(id: string): Promise<{ ok: true }> {
    const { error } = await sb().from('medical_faqs').delete().eq('id', id);
    if (error) fail(error);
    return { ok: true };
  },
  async saveTestimonial(input: Partial<MedicalTestimonial> & { authorName: string }): Promise<{ ok: true }> {
    const { error } = await sb().from('medical_testimonials').upsert({
      id: input.id, author_name: input.authorName, quote: input.quote, image_path: input.imagePath ?? null,
      status: input.status ?? 'draft', consent_given: input.consentGiven ?? false, sort: input.sort ?? 0,
    });
    if (error) fail(error);
    return { ok: true };
  },
  async deleteTestimonial(id: string): Promise<{ ok: true }> {
    const { error } = await sb().from('medical_testimonials').delete().eq('id', id);
    if (error) fail(error);
    return { ok: true };
  },
  async listAllTestimonials(): Promise<MedicalTestimonial[]> {
    const { data, error } = await sb().from('medical_testimonials').select('id,author_name,quote,image_path,status,consent_given,sort').order('sort', { ascending: true });
    if (error) fail(error);
    interface Row { id: string; author_name: string; quote: LocalizedRow; image_path: string | null; status: string; consent_given: boolean; sort: number; }
    return ((data ?? []) as Row[]).map((r) => ({ id: r.id, authorName: r.author_name, quote: toLocalized(r.quote), imagePath: r.image_path, status: r.status as 'draft' | 'published', consentGiven: r.consent_given, sort: r.sort }));
  },
  async setSectionVisibility(sectionKey: string, visible: boolean, sort?: number): Promise<{ ok: true }> {
    const patch: Record<string, unknown> = { section_key: sectionKey, visible };
    if (sort !== undefined) patch.sort = sort;
    const { error } = await sb().from('medical_page_sections').upsert(patch, { onConflict: 'section_key' });
    if (error) fail(error);
    return { ok: true };
  },
};
