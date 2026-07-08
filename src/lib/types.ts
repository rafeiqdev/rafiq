export type Lang = 'ar' | 'en' | 'ru' | 'fa';

export const LANGS: { code: Lang; native: string; dir: 'rtl' | 'ltr' }[] = [
  { code: 'ar', native: 'العربية', dir: 'rtl' },
  { code: 'en', native: 'English', dir: 'ltr' },
  { code: 'ru', native: 'Русский', dir: 'ltr' },
  { code: 'fa', native: 'فارسی', dir: 'rtl' },
];

export type JourneyPath = 'planning' | 'arrived' | 'living' | 'browsing';
export type Reason = 'tourism' | 'visiting' | 'live' | 'work' | 'study';

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
}

export const EMPTY_PROFILE: Profile = {
  path: null,
  reason: null,
  has: { turkishPhone: false, taxNumber: false, residencePermit: false, bankAccount: false },
  family: null,
  completed: {},
  renewals: {},
};

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
  clicks: number;
  signups: number;
  earnedTl: number;
  bookings: number;
  leads: number;
  payments: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

export type BookingStatus = 'new' | 'confirmed' | 'done' | 'cancelled';

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
  status: string;
  createdAt: string;
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
