/**
 * Curated Istanbul/Turkey photography — now self-hosted as local WebP under
 * /public/img (generated from the originals, resized + compressed). All usages
 * go through <SiteImage> which lazy-loads and falls back to an on-brand gradient
 * if a photo fails — so the UI never breaks. The width arg is kept for call-site
 * compatibility but ignored (each id maps to one optimized WebP file).
 */
const U = (id: string, _w = 0) => `/img/${id}.webp`;

/** Home hero background slideshow — Istanbul / Turkey scenery (all verified). */
export const CAROUSEL = [
  U('1524231757912-21f4fe3a7200'), // Hagia Sophia / old city
  U('1527838832700-5059252407fa'), // Bosphorus & Galata
  U('1541432901042-2d8bd64b4a9b'), // Blue Mosque
  U('1518105779142-d975f22f1b0a'), // Bosphorus bridge
];

/** Per-page photo banners (verified Istanbul scenery). */
export const BANNERS = {
  residency: U('1541432901042-2d8bd64b4a9b'),
  tricks: U('1518105779142-d975f22f1b0a'),
  realEstate: U('1524231757912-21f4fe3a7200'),
};

/** Real-estate listing fallback photos (modern apartments / buildings). */
export const LISTING_PHOTOS = [
  U('1502672260266-1c1ef2d93688', 800),
  U('1545324418-cc1a3fa10c00', 800),
  U('1512917774080-9991f1c4c750', 800),
  U('1560448204-e02f11c3d0e2', 800),
  U('1493809842364-78817add7ffb', 800),
  U('1568605114967-8130f3a36994', 800),
];

export const ISTANBUL = {
  hero: CAROUSEL[0],
  bosphorus: U('1527838832700-5059252407fa', 1200),
  mosque: U('1541432901042-2d8bd64b4a9b', 1000),
};

/** Wide photo banner for the services catalog hero (real Istanbul / Bosphorus). */
export const SERVICES_HERO = U('1518105779142-d975f22f1b0a');

/** Big photo per onboarding option (themed). Cards fall back to a gradient if a photo fails. */
export const ONBOARDING_PHOTOS: Record<string, string> = {
  // Q1 — journey stage
  planning: U('1488646953014-85cb44e25828', 600), // travel planning: map + camera
  arrived: U('1436491865332-7a61a109cc05', 600), // airplane window / arrival
  living: U('1524231757912-21f4fe3a7200', 600), // Istanbul skyline
  browsing: U('1498050108023-c5249f4df085', 600), // laptop / browsing
  // Q2 — reason
  tourism: U('1541432901042-2d8bd64b4a9b', 600), // Blue Mosque
  visiting: U('1521737604893-d14cc237f11d', 600), // people / friends
  live: U('1512917774080-9991f1c4c750', 600), // home interior
  work: U('1497366216548-37526070297c', 600), // office
  study: U('1523580494863-6f3031224c94', 600), // graduation / university
  // Q4 — family
  family_yes: U('1511895426328-dc8714191300', 600), // family
  family_no: U('1488998427799-e3362cec87c3', 600), // solo traveler
};

/** Background photo per "Explore" card, themed to its subject (keyed by route). */
export const EXPLORE_PHOTOS: Record<string, string> = {
  '/tricks': U('1524231757912-21f4fe3a7200', 800), // Istanbul old city
  '/residency': U('1450101499163-c8848c66ca85', 800), // documents / desk
  '/real-estate': U('1545324418-cc1a3fa10c00', 800), // apartment building
  '/health-tourism': U('1538108149393-fbbd81895907', 800), // hospital
  '/map': U('1527838832700-5059252407fa', 800), // Bosphorus
  '/hub': U('1532012197267-da84d127e765', 800), // books / guides
  '/referrals': U('1521737604893-d14cc237f11d', 800), // people / meeting
};

