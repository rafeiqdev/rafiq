/**
 * Hero photo per category, shared by the service pages and the category guides.
 *
 * On a service page it is only a fallback: each service normally shows its OWN
 * admin-set photo (`service.image`). On a guide page there is no per-page photo
 * at all, so this map is what puts a picture at the top instead of a bare blue
 * header. A category missing here simply falls back to the plain gradient.
 *
 * All files are self-hosted WebP under /public (never hotlinked).
 */
export const CATEGORY_HERO_IMAGE: Record<string, string> = {
  // Categories that have their own Türkiye-specific photography.
  residency: '/images/services/official/residence.webp',
  realestate: '/images/services/official/real-estate.webp',
  tourism: '/images/services/official/tourism.webp',
  translation: '/images/services/official/translation.webp',
  banking: '/images/services/official/banking.webp',
  health: '/images/services/official/health.webp',
  // The rest borrow a themed shot from the curated library in /public/img.
  accounting: '/img/1450101499163-c8848c66ca85.webp', // signing paperwork at a desk
  business: '/img/1497366216548-37526070297c.webp', // office interior
  legal: '/img/1532012197267-da84d127e765.webp', // shelves of law-library books
  education: '/img/1523580494863-6f3031224c94.webp', // lecture hall / seminar
  telecom: '/img/1518105779142-d975f22f1b0a.webp', // Bosphorus bridge / city
  daily: '/img/1524231757912-21f4fe3a7200.webp', // Istanbul old city
};
