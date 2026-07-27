export type Lang = 'ar' | 'en' | 'ru' | 'fa';

export const LANGS: { code: Lang; native: string; dir: 'rtl' | 'ltr' }[] = [
  { code: 'ar', native: 'العربية', dir: 'rtl' },
  { code: 'en', native: 'English', dir: 'ltr' },
  { code: 'ru', native: 'Русский', dir: 'ltr' },
  { code: 'fa', native: 'فارسی', dir: 'rtl' },
];

export type JourneyPath = 'planning' | 'arrived' | 'living' | 'browsing';
export type Reason = 'tourism' | 'visiting' | 'live' | 'work' | 'study';

/** Richer onboarding "current situation" answer (maps down to JourneyPath). */
export type Situation = 'planning' | 'arrived' | 'visiting' | 'student' | 'resident' | 'long_resident';

export const SITUATIONS: Situation[] = ['planning', 'arrived', 'visiting', 'student', 'resident', 'long_resident'];

/**
 * Situation → the legacy JourneyPath consumed by blocks/registry.ts, so the
 * existing recommendation engine keeps working unchanged.
 */
export const SITUATION_TO_PATH: Record<Situation, JourneyPath> = {
  planning: 'planning',
  arrived: 'arrived',
  visiting: 'browsing',
  student: 'arrived',
  resident: 'living',
  long_resident: 'living',
};

/** Situations that imply a reason we can pre-fill (others stay null). */
export const SITUATION_TO_REASON: Partial<Record<Situation, Reason>> = {
  student: 'study',
  visiting: 'visiting',
  resident: 'live',
  long_resident: 'live',
};

export interface Profile {
  path: JourneyPath | null;
  reason: Reason | null;
  has: {
    turkishPhone: boolean;
    taxNumber: boolean;
    residencePermit: boolean;
    bankAccount: boolean;
  };
  family: 'yes' | 'no' | null;
  /** ids of checklist blocks the user marked complete */
  completed: Record<string, boolean>;
  /** renewal dates: ISO strings */
  renewals: { residence?: string; insurance?: string; passport?: string };
  /** onboarding slice: richer situation + city (mirrored to profile columns) */
  situation?: Situation | null;
  city?: string | null;
}

export const EMPTY_PROFILE: Profile = {
  path: null,
  reason: null,
  has: { turkishPhone: false, taxNumber: false, residencePermit: false, bankAccount: false },
  family: null,
  completed: {},
  renewals: {},
  situation: null,
  city: null,
};

// ---------- "مسيرتي" journey -------------------------------------------------

/** Stable task keys — these mirror Profile.has so onboarding seeds completion. */
export const JOURNEY_TASK_KEYS = ['turkishPhone', 'taxNumber', 'residencePermit', 'bankAccount'] as const;
export type JourneyTaskKey = (typeof JOURNEY_TASK_KEYS)[number];

export type JourneyStatus = 'todo' | 'done';

export interface JourneyItem {
  id: string;
  taskKey: string;
  /** Arabic title stored on the row (display falls back to it when no i18n key) */
  titleAr: string;
  descriptionAr?: string | null;
  status: JourneyStatus;
  sort: number;
  relatedRoute?: string | null;
  relatedServiceId?: string | null;
  completedAt?: string | null;
}

/** Progress derived ONLY from the user's assigned journey items. */
export interface JourneyProgress {
  total: number;
  done: number;
  remaining: number;
  /** integer 0–100; 0 when there are no items (never NaN) */
  percent: number;
}

export function journeyProgress(items: JourneyItem[]): JourneyProgress {
  const total = items.length;
  const done = items.filter((i) => i.status === 'done').length;
  return {
    total,
    done,
    remaining: Math.max(0, total - done),
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

/** The single next recommended task = lowest-sort incomplete item (or null). */
export function nextJourneyItem(items: JourneyItem[]): JourneyItem | null {
  return [...items].filter((i) => i.status === 'todo').sort((a, b) => a.sort - b.sort)[0] ?? null;
}

export type PlanTier = 'free' | 'light' | 'pro' | 'elite';
export type Billing = 'monthly' | 'annual';
export type PayMethod = 'card' | 'bank' | 'crypto';

export const PLAN_PRICES: Record<Exclude<PlanTier, 'free'>, number> = {
  light: 799,
  pro: 1599,
  elite: 3199,
};

export type UserRole = 'user' | 'admin' | 'company';

export interface User {
  id: string;
  email: string;
  name: string;
  provider: 'google' | 'email';
  isAdmin: boolean;
  /** 'user' | 'admin' | 'company' (maps from profiles.role) */
  role: UserRole;
  /** convenience flag: role === 'company' */
  isCompany: boolean;
  referralCode: string;
  createdAt: string;
  /** profiles.onboarding_completed — drives the post-login redirect */
  onboardingCompleted: boolean;
  avatarUrl?: string | null;
  city?: string | null;
  situation?: Situation | null;
  /** phone attached to the account (intake asks once if missing) */
  phone?: string | null;
}

export interface Subscription {
  userId: string;
  tier: PlanTier;
  billing: Billing;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  startedAt: string;
  expiresAt: string;
  cancelReason?: string;
  cancelComment?: string;
}

export interface PaymentRequest {
  id: string;
  email: string;
  tier: PlanTier;
  billing: Billing;
  method: PayMethod;
  amount: number;
  status: 'pending' | 'verified' | 'rejected';
  hasReceipt?: boolean;
  receiptName?: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  userEmail?: string;
  kind: 'realestate' | 'health';
  item: string;
  status: string;
  createdAt: string;
}

export interface Place {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address?: string | null;
}

/** The seven map categories, in display order. */
export const PLACE_CATEGORIES = [
  'dining',
  'hotels',
  'hospitals',
  'notary',
  'government',
  'shopping',
  'arabic',
] as const;
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

/** A live Google Places result, flattened by /api/places-search. */
export interface GooglePlaceResult {
  placeId: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  primaryType: string | null;
  rating: number | null;
  ratingCount: number | null;
  openNow: boolean | null;
  hours: string[] | null;
  phone: string | null;
  photoRef: string | null;
  mapsUri: string | null;
  websiteUri: string | null;
  businessStatus: string | null;
}

/**
 * Rafiq's editorial layer over a Google place. Absent for the vast majority of
 * results — a place is only ever "recommended" after a human review, which the
 * database enforces (places_recommendation_requires_review).
 */
export interface PlaceOverlay {
  googlePlaceId: string;
  verifiedStatus: 'unverified' | 'verified' | 'rejected';
  recommended: boolean;
  recommendationReason: string | null;
  lastReviewedAt: string | null;
}

export interface FavoritePlace {
  id: string;
  googlePlaceId: string;
  name: string;
  category: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
}

export interface Listing {
  id: string;
  district: string;
  rooms: string;
  m2: number;
  priceUsd: number;
  citizenship: boolean;
  image?: string | null;
  /** longer details shown on the listing detail view */
  description?: string | null;
  bathrooms?: number | null;
  furnished?: boolean;
  /** uploaded photo URLs (public bucket); first one is the cover */
  images?: string[];
}

/** A user row in the admin dashboard, with engagement stats. */
export interface AdminUser extends User {
  tier: PlanTier;
  /**
   * null = that table could not be read, NOT zero. Rendered as "—" so an
   * unreadable source is never reported to the admin as "this customer did
   * nothing".
   */
  bookings: number | null;
  leads: number | null;
  payments: number | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

export type BookingStatus = 'new' | 'confirmed' | 'done' | 'cancelled';

/** One file uploaded during intake, stored in the private `booking-media` bucket. */
export interface BookingMedia {
  path: string;
  name: string;
  mime?: string;
  size?: number;
}

export interface Booking {
  id: string;
  userId: string;
  userEmail: string;
  problemSummary: string;
  transcript: ChatMessage[];
  preferredDatetime: string;
  preferredLanguage: Lang;
  status: BookingStatus;
  internalNote?: string;
  createdAt: string;
  /** phone captured during intake (may differ from account default) */
  phone?: string | null;
  /** photos / videos / PDFs the user attached during intake */
  media?: BookingMedia[];
}

export interface AppNotification {
  id: string;
  /** null = global broadcast */
  userId: string | null;
  /** i18n key under notifications.*, or 'custom' */
  key: string;
  /** free text for admin-published news */
  customText?: string;
  read: boolean;
  createdAt: string;
}

export interface StoredDocument {
  id: string;
  name: string;
  mime?: string;
  size?: number;
  uploadedAt: string;
}

export interface AppConfig {
  googleClientId: string | null;
  freeChatMessages: number;
  /** Temporary promo: the AI assistant is open + unmetered (no sign-in, no limit). */
  aiFreePeriod: boolean;
}

export interface MeResponse {
  user: User | null;
  subscription?: Subscription | null;
  tier?: PlanTier;
  unread?: number;
  profile?: Profile | null;
}

// ============================================================================
// B2B Companies system
// ============================================================================

/** Default fixed monthly company subscription price (TL). Admin-configurable
 *  via settings.company_plan; this is only the fallback. */
export const COMPANY_PLAN_PRICE = 2000;

export type CompanyStatus = 'pending' | 'approved' | 'suspended';
export type CompanySubStatus = 'none' | 'active' | 'expired';
export type CompanyPayMethod = 'card' | 'bank_transfer' | 'crypto';

export interface CompanyContact {
  email?: string;
  phone?: string;
  whatsapp?: string;
}

export interface CompanyDoc {
  name: string;
  /** storage path in the private `company-docs` bucket */
  path: string;
}

export interface Company {
  id: string;
  ownerUserId: string;
  name: string;
  description?: string | null;
  logo?: string | null;
  contact: CompanyContact;
  /** service category ids (services.ts) */
  categories: string[];
  /** service item ids */
  services: string[];
  /** Istanbul district ids (istanbulAreas.ts) */
  areas: string[];
  documents: CompanyDoc[];
  adminNote?: string | null;
  status: CompanyStatus;
  subscriptionStatus: CompanySubStatus;
  subscriptionExpiresAt?: string | null;
  createdAt: string;
}

/** Fields a company owner submits on register / profile-edit. */
export interface CompanyInput {
  name: string;
  description?: string;
  logo?: string | null;
  contact: CompanyContact;
  categories: string[];
  services: string[];
  areas: string[];
  documents?: CompanyDoc[];
}

/**
 * isCompanyActive(company) = (status == approved) AND (subscriptionStatus ==
 * active) AND the subscription hasn't expired. Mirrors the SQL used in RLS/RPCs.
 */
export function isCompanyActive(c: Pick<Company, 'status' | 'subscriptionStatus' | 'subscriptionExpiresAt'>): boolean {
  if (c.status !== 'approved' || c.subscriptionStatus !== 'active') return false;
  if (c.subscriptionExpiresAt && new Date(c.subscriptionExpiresAt) <= new Date()) return false;
  return true;
}

export interface CompanyPayment {
  id: string;
  companyId: string;
  companyName?: string;
  plan: string;
  method: CompanyPayMethod;
  amount: number;
  status: 'pending' | 'confirmed' | 'rejected';
  hasReceipt?: boolean;
  receiptName?: string;
  createdAt: string;
}

/** A broadcast lead as seen by a matching company (customer phone REDACTED). */
export interface CompanyLead {
  id: string;
  serviceTitle: string;
  category: string;
  area: string | null;
  message?: string | null;
  customerName: string;
  createdAt: string;
  responded: boolean;
}

/** A company's offer on a lead, as seen by the customer (with company rating). */
export interface CompanyResponse {
  id: string;
  companyId: string;
  companyName: string;
  logo?: string | null;
  quote: number | null;
  message?: string | null;
  chosen: boolean;
  rating: number;
  reviews: number;
}

/** A customer's own broadcast request, shown on their request page. */
export interface CustomerRequest {
  id: string;
  serviceTitle: string;
  category: string;
  area: string | null;
  message?: string | null;
  /** new | pending | accepted | done | rejected — shown to the customer. */
  status: string;
  createdAt: string;
  /**
   * Behaviour only, NEVER rendered. The customer must not be able to tell a
   * broadcast request from a direct one: a request with no offers looks
   * identical either way.
   */
  serviceType: string;
  broadcast: boolean;
}

export interface Review {
  id: string;
  companyId: string;
  rating: number;
  text?: string | null;
  createdAt: string;
}

/** Public-profile view of a company (only approved + active companies). */
export interface CompanyPublic {
  id: string;
  name: string;
  description?: string | null;
  logo?: string | null;
  categories: string[];
  services: string[];
  areas: string[];
  rating: number;
  reviewsCount: number;
}
