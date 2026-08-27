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
  /**
   * Student-only follow-up answers. Persisted in the `onboarding` jsonb only
   * (no dedicated columns, no migration needed), so they are always optional
   * and default to null for everyone who is not a student. They refine which
   * of the catalog services we surface first — see data/serviceRecommend.ts.
   */
  studentStage?: StudentStage | null;
  studentResidency?: StudentResidency | null;
  studentHousing?: StudentHousing | null;
  /** Newcomer-only follow-up answers (jsonb only, no migration; null otherwise). */
  arrivedReason?: ArrivedReason | null;
  arrivedHousing?: ArrivedHousing | null;
  /** Visitor-only follow-up answers (jsonb only, no migration; null otherwise). */
  visitorTrip?: VisitorTrip | null;
  visitorService?: VisitorService | null;
  /** Resident-only follow-up answers (jsonb only, no migration; null otherwise). */
  residentType?: ResidentType | null;
  residentPlan?: ResidentPlan | null;
}

/** Where a student is in their study journey — drives service priority order. */
export type StudentStage = 'coming' | 'arrived' | 'settled';
export const STUDENT_STAGES: StudentStage[] = ['coming', 'arrived', 'settled'];

/** A student's residence-permit status. */
export type StudentResidency = 'have' | 'applied' | 'none' | 'other' | 'unsure';
export const STUDENT_RESIDENCY: StudentResidency[] = ['have', 'applied', 'none', 'other', 'unsure'];

/** A student's housing status. */
export type StudentHousing = 'dorm' | 'private' | 'temporary' | 'none';
export const STUDENT_HOUSING: StudentHousing[] = ['dorm', 'private', 'temporary', 'none'];

/**
 * Why a newcomer ("arrived") came — the single biggest driver of which
 * services fit them, so it branches the dashboard's top three. Student-persona
 * users answer their own questions instead; a newcomer who picks `study` here
 * just gets an education-leaning bundle.
 */
export type ArrivedReason = 'work' | 'living' | 'family' | 'business' | 'study' | 'short' | 'other';
export const ARRIVED_REASONS: ArrivedReason[] = ['work', 'living', 'family', 'business', 'study', 'short', 'other'];

/** A newcomer's housing status. */
export type ArrivedHousing = 'temporary' | 'rented' | 'withRelative' | 'owned' | 'none';
export const ARRIVED_HOUSING: ArrivedHousing[] = ['temporary', 'rented', 'withRelative', 'owned', 'none'];

/**
 * What a visitor/tourist wants to DO — the biggest driver of which tourism
 * services fit them, so it branches the dashboard's top three.
 */
export type VisitorTrip = 'sights' | 'shopping' | 'nature' | 'multicity' | 'medical' | 'family' | 'mix';
export const VISITOR_TRIPS: VisitorTrip[] = ['sights', 'shopping', 'nature', 'multicity', 'medical', 'family', 'mix'];

/** The service level a visitor prefers — VIP promotes the private/premium services. */
export type VisitorService = 'standard' | 'comfort' | 'vip' | 'unsure';
export const VISITOR_SERVICES: VisitorService[] = ['standard', 'comfort', 'vip', 'unsure'];

/**
 * The nature of someone's residence — the biggest driver of which ongoing
 * services fit them, so it branches the dashboard's top three.
 */
export type ResidentType = 'employee' | 'business' | 'family' | 'retired' | 'investor' | 'student' | 'unsure';
export const RESIDENT_TYPES: ResidentType[] = ['employee', 'business', 'family', 'retired', 'investor', 'student', 'unsure'];

/** A resident's plan for the coming period — promotes the matching "development" services. */
export type ResidentPlan = 'maintain' | 'job' | 'business' | 'property' | 'citizenship' | 'family' | 'explore';
export const RESIDENT_PLANS: ResidentPlan[] = ['maintain', 'job', 'business', 'property', 'citizenship', 'family', 'explore'];

export const EMPTY_PROFILE: Profile = {
  path: null,
  reason: null,
  has: { turkishPhone: false, taxNumber: false, residencePermit: false, bankAccount: false },
  family: null,
  completed: {},
  renewals: {},
  situation: null,
  city: null,
  studentStage: null,
  studentResidency: null,
  studentHousing: null,
  arrivedReason: null,
  arrivedHousing: null,
  visitorTrip: null,
  visitorService: null,
  residentType: null,
  residentPlan: null,
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

export type UserRole = 'user' | 'admin' | 'company' | 'medical_coordinator';

export interface User {
  id: string;
  email: string;
  name: string;
  provider: 'google' | 'email';
  isAdmin: boolean;
  /** 'user' | 'admin' | 'company' | 'medical_coordinator' (maps from profiles.role) */
  role: UserRole;
  /** convenience flag: role === 'company' */
  isCompany: boolean;
  /** convenience flag: role === 'medical_coordinator' (admins may also access medical staff surfaces) */
  isMedicalCoordinator: boolean;
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

/**
 * Every category the backend can search and the database may already hold.
 * The paperwork ones (hotels/hospitals/notary/government) are no longer offered
 * on the map — see PLACE_CATEGORY_FILTERS — but they stay in the union because
 * saved favourites and admin overlays created before that change still carry
 * them, and narrowing the type would make that stored data unrepresentable.
 */
export const PLACE_CATEGORIES = [
  'dining',
  'attractions',
  'shopping',
  'arabic',
  'hotels',
  'hospitals',
  'notary',
  'government',
] as const;
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

/**
 * What the map actually offers, in display order: the leisure side of the city.
 * Kept short on purpose — the chip row scrolls horizontally on a phone, and a
 * row of eight meant the visitor never saw the last ones.
 */
export const PLACE_CATEGORY_FILTERS = ['dining', 'attractions', 'shopping', 'arabic'] as const;

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

  // ── Optional columns added by the real-estate revamp ──
  // Every one of these is optional on purpose: rows written before the
  // migration simply do not carry them, and the UI falls back to a safe
  // default instead of rendering an empty card.
  /** sale (default) | rent | commercial — drives the top tabs */
  listingType?: ListingType;
  /** floor number, e.g. 4 */
  floor?: number | null;
  /** total floors in the building, e.g. 12 */
  totalFloors?: number | null;
  /** ready | under-construction — unknown when absent */
  buildStatus?: BuildStatus | null;
  /** expected annual rental yield in percent, e.g. 7 */
  yieldPct?: number | null;
  /** free-form amenity keys: 'parking' | 'elevator' | 'security' | ... */
  amenities?: string[];
  /** ISO date of the last time this listing was refreshed from its source */
  updatedAt?: string | null;
  /**
   * Per-locale translations of the (condensed) title/description, keyed by
   * language code ('ar' | 'en' | 'fa' | 'ru'). Produced once at import time —
   * never in a component or hook, since that would re-translate on every
   * render. Absent or missing a locale means that row has not been
   * translated yet; the UI falls back to the raw `description`.
   */
  translations?: Partial<Record<'ar' | 'en' | 'fa' | 'ru', { title?: string; description?: string }>>;
}

export type ListingType = 'sale' | 'rent' | 'commercial';
export type BuildStatus = 'ready' | 'under-construction';

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

/**
 * A single admin-sent price offer on a regular ("طلباتي") service request —
 * price, details and photos, one at a time. Deliberately NOT the same shape
 * as MedicalOffer: no booking-percentage deposit (the customer pays the full
 * price or not at all), and no separate hidden-identity table, because a
 * regular service has nothing analogous to a medical center to protect.
 */
export type ServiceOfferStatus = 'sent' | 'rejected' | 'expired' | 'superseded';

export interface ServiceOffer {
  id: string;
  requestId: string;
  price: number;
  currency: string;
  details: string;
  imagePaths: string[];
  expiresAt: string | null;
  status: ServiceOfferStatus;
  createdAt: string;
}

export type ServicePaymentStatus = 'pending' | 'verified' | 'rejected';

export interface ServicePayment {
  id: string;
  requestId: string;
  offerId: string;
  amount: number;
  currency: string;
  status: ServicePaymentStatus;
  createdAt: string;
  verifiedAt: string | null;
  /** Only present while status is 'pending' — used to resume an unfinished checkout redirect. */
  gatewaySessionId?: string | null;
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

// ── investment opportunities ────────────────────────────────────────────────

export interface LocalizedText { ar: string; en: string; fa: string; ru: string }

/** A row of `investment_opportunities` — everything the public pages render. */
export interface InvestmentRecord {
  id: string;
  slug: string;
  brand: string;
  name: LocalizedText;
  district: LocalizedText;
  type: LocalizedText;
  summary: LocalizedText;
  developer: string;
  side: 'european' | 'asian';
  minUsd: number;
  maxUsd: number | null;
  pros: LocalizedText[];
  cons: LocalizedText[];
  extraFacts: { key: string; value: string | LocalizedText }[];
  images: string[];
  source: { label: string; url: string };
  sort: number;
  published: boolean;
}

export type InvestmentInput = Omit<InvestmentRecord, 'id'>;

/**
 * Sales-office contact details for one opportunity — INTERNAL ONLY.
 *
 * Deliberately a separate type from `InvestmentRecord` so it is impossible to
 * spread one into a public component by accident. Nothing under src/pages that
 * renders to a visitor may import this.
 */
export interface InvestmentContact {
  opportunityId: string;
  salesEmail: string;
  salesPhone: string;
  whatsapp: string;
  officialUrl: string;
  pressUrl: string;
  /** where the photo-permission request stands */
  permission: 'none' | 'requested' | 'granted' | 'refused';
  notes: string;
}

// ── medical tourism ─────────────────────────────────────────────────────────

export type MedicalRequestStatus =
  | 'pending_review' | 'under_review' | 'collecting_offers' | 'offers_available'
  | 'awaiting_payment' | 'paid' | 'booked' | 'cancelled';

export interface MedicalRequestFile {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface MedicalRequest {
  id: string;
  specialty: string;
  description: string;
  expectedTravelDate: string | null;
  budgetEstimate: number | null;
  notes: string | null;
  status: MedicalRequestStatus;
  customerNote: string | null;
  internalNote?: string | null;
  createdAt: string;
  updatedAt: string;
  files?: MedicalRequestFile[];
}

export type MedicalOptionalServiceType = 'transport' | 'interpreter' | 'accommodation' | 'companion' | 'nursing';

export interface MedicalOptionalService {
  id: string;
  requestId: string;
  serviceType: MedicalOptionalServiceType;
  status: 'requested' | 'confirmed' | 'declined' | 'cancelled';
  notes: string | null;
  createdAt: string;
}

/** Pre-payment-safe offer shape — never carries center identity, by design. */
export interface MedicalOffer {
  id: string;
  requestId: string;
  treatmentPlan: string;
  totalPrice: number;
  currency: string;
  included: string[];
  excluded: string[];
  sessionsOrDays: string | null;
  expiresAt: string | null;
  bookingPercentage: number;
  status: 'draft' | 'sent' | 'expired';
  createdAt: string;
}

/** Only reachable post-verified-payment via get_offer_center(). */
export interface MedicalOfferCenter {
  centerName: string;
  doctorName: string;
  address: string;
  phone: string;
  website: string;
  mapUrl: string;
  imagePaths: string[];
  appointmentDetails: string;
}

export type MedicalPaymentStatus = 'pending' | 'verified' | 'rejected' | 'refund_requested' | 'refunded';

export interface MedicalPayment {
  id: string;
  requestId: string;
  offerId: string;
  amount: number;
  currency: string;
  bookingPercentageSnapshot: number;
  status: MedicalPaymentStatus;
  createdAt: string;
  verifiedAt: string | null;
  /** Only present while status is 'pending' — used to resume an unfinished checkout redirect. */
  gatewaySessionId?: string | null;
}

export interface MedicalSpecialty {
  id: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  icon: string | null;
  sort: number;
  visible: boolean;
}

export interface MedicalService {
  id: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  icon: string | null;
  sort: number;
  visible: boolean;
}

/** A landing-page showcase card (/health-tourism "specialties" carousel) — distinct from MedicalSpecialty, which feeds the request-form dropdown. */
export interface MedicalLandingCard {
  id: string;
  slug: string;
  title: LocalizedText;
  description: LocalizedText;
  imageUrl: string | null;
  sort: number;
  visible: boolean;
}

export interface MedicalHeroSlide {
  id: string;
  imageUrl: string;
  caption: LocalizedText;
  sort: number;
  visible: boolean;
}

export interface MedicalFaq {
  id: string;
  question: LocalizedText;
  answer: LocalizedText;
  sort: number;
  visible: boolean;
}

export interface MedicalTestimonial {
  id: string;
  authorName: string;
  quote: LocalizedText;
  imagePath: string | null;
  status: 'draft' | 'published';
  consentGiven: boolean;
  sort: number;
}

export interface MedicalPageSection {
  sectionKey: string;
  visible: boolean;
  sort: number;
}

/** Admin queue row — includes fields a customer never sees. */
export interface AdminMedicalRequest extends MedicalRequest {
  userId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  offersCount: number;
}
