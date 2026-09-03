import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { news, localizeNewsPost } from '../../lib/api';
import type { NewsPost } from '../../lib/api';
import { postRef } from '../../lib/telegramNews';
import { AppIcon } from '../../components/AppIcon';
import type { IconName } from '../../components/AppIcon';
import { MobileTabBar } from '../../components/MobileTabBar';
import { MobileNewsWelcome } from './MobileNewsWelcome';
import { usePageMeta } from '../../lib/seo';

const WELCOME_SEEN_KEY = 'rafiq_news_welcome_seen';

/**
 * Phone-only /news screen — a magazine-style feed rebuilt from the owner's
 * mockup: a "Welcome to Rafiq News" masthead with an Istanbul Edition seal, a
 * scrollable row of category chips, then one large featured post over a stack of
 * list cards (image on the trailing edge). It owns its full mobile chrome and is
 * listed in Layout's MOBILE_CHROME_FREE_ROUTES so the desktop header/footer
 * aren't stacked on top of it.
 *
 * WHY THE CHIPS FILTER BY KEYWORD, NOT A COLUMN
 * News posts have no `category` field — they arrive from the Telegram sync or a
 * manual admin post, untagged. Rather than a migration, each chip carries a
 * multilingual keyword set (CATEGORIES) matched against the post's Arabic
 * original *and* its machine translations, so the filter works whatever language
 * the reader is in. "All" is the default and always shows the full feed.
 */

type CatKey = 'all' | 'istanbul' | 'residency' | 'business' | 'lifestyle';

// Icons per chip. "All" opens the full feed; the rest map to the mockup's four.
const CATEGORIES: { key: CatKey; icon: IconName }[] = [
  { key: 'all', icon: 'newspaper' },
  { key: 'istanbul', icon: 'landmark' },
  { key: 'residency', icon: 'id-card' },
  { key: 'business', icon: 'briefcase' },
  { key: 'lifestyle', icon: 'utensils-crossed' },
];

// Keyword sets, deliberately broad and multilingual (Arabic original + English /
// Turkish / Russian, since a synced post may already carry translations). Case is
// folded before matching; Arabic is unaffected by lowercasing.
const CATEGORY_RE: Record<Exclude<CatKey, 'all'>, RegExp> = {
  istanbul:
    /istanbul|إسطنبول|اسطنبول|استانبول|стамбул|kadıköy|kadikoy|taksim|تقسيم|beyoğlu|beyoglu|üsküdar|uskudar|البوسفور|bosphorus|bosphor|بلدية|belediye/i,
  residency:
    /ikamet|residence|residency|\bpermit\b|إقامة|الإقامة|الاقامة|اقامة|اقامت|kimlik|oturum|تصريح|resident|вид на жительство|внж/i,
  business:
    /business|çalışma|calisma|work\s?permit|\biş\b|عمل|تجارة|تجاري|شركة|شركات|اقتصاد|econom|dolar|dollar|دولار|lira|ليرة|\bbank|بنك|بورصة|وظيفة|invest|استثمار|بیزنس|бизнес|эконом|инвест/i,
  lifestyle:
    /restaurant|مطعم|مطاعم|cafe|kahve|قهوة|سياحة|tourism|tourist|سياح|ثقاف|culture|مهرجان|festival|فعالية|\bevent|سفر|travel|طعام|أكل|حياة|lifestyle|\bart\b|فن|موسيقى|music|رياضة|sport/i,
};

// One lowercased blob per post (title + body + every translation) to match against.
function haystack(p: NewsPost): string {
  let s = `${p.title ?? ''} ${p.body ?? ''}`;
  for (const tr of Object.values(p.translations ?? {})) s += ` ${tr.title ?? ''} ${tr.body ?? ''}`;
  return s.toLowerCase();
}

// First category a post falls into — used for the coloured eyebrow so a run of
// text-only cards each reads with its own label instead of looking identical.
function categoryOf(p: NewsPost): Exclude<CatKey, 'all'> | null {
  const h = haystack(p);
  for (const key of ['istanbul', 'residency', 'business', 'lifestyle'] as const) {
    if (CATEGORY_RE[key].test(h)) return key;
  }
  return null;
}

/** Small red Istanbul tower — the seal's centre and the masthead mark. */
function TowerGlyph({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="2.6" r="1.15" fill="currentColor" />
      <path d="M12 3.4 6.6 9.2h10.8L12 3.4Z" fill="currentColor" />
      <rect x="7.4" y="9.2" width="9.2" height="11.4" rx="1.2" fill="currentColor" />
      <rect x="10.9" y="12.4" width="2.2" height="8.2" rx="1.1" fill="#ffffff" fillOpacity="0.9" />
      <rect x="6" y="20.4" width="12" height="1.8" rx="0.9" fill="currentColor" />
    </svg>
  );
}

/** The circular "Istanbul · Edition" seal shown top-right of the masthead. */
function IstanbulSeal({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="shrink-0">
      <defs>
        <path id="seal-top" d="M18,50 A32,32 0 0 1 82,50" fill="none" />
        <path id="seal-bottom" d="M20,52 A30,30 0 0 0 80,52" fill="none" />
      </defs>
      <text
        fill="#12294d"
        fontSize="12.5"
        fontWeight={800}
        letterSpacing="2.2"
        style={{ fontFamily: 'inherit' }}
      >
        <textPath href="#seal-top" startOffset="50%" textAnchor="middle">
          ISTANBUL
        </textPath>
      </text>
      <text
        fill="#12294d"
        fontSize="12.5"
        fontWeight={800}
        letterSpacing="3"
        style={{ fontFamily: 'inherit' }}
      >
        <textPath href="#seal-bottom" startOffset="50%" textAnchor="middle">
          EDITION
        </textPath>
      </text>
      <circle cx="14" cy="50" r="2.1" fill="#c0392b" />
      <circle cx="86" cy="50" r="2.1" fill="#c0392b" />
      {/* centre tower — drawn inline (not a nested <svg>) so it stays sized */}
      <g transform="translate(34.4 34.4) scale(1.3)">
        <circle cx="12" cy="2.6" r="1.15" fill="#c0392b" />
        <path d="M12 3.4 6.6 9.2h10.8L12 3.4Z" fill="#c0392b" />
        <rect x="7.4" y="9.2" width="9.2" height="11.4" rx="1.2" fill="#c0392b" />
        <rect x="10.9" y="12.4" width="2.2" height="8.2" rx="1.1" fill="#ffffff" />
        <rect x="6" y="20.4" width="12" height="1.8" rx="0.9" fill="#c0392b" />
      </g>
    </svg>
  );
}

export function MobileNews() {
  const { t, i18n } = useTranslation();
  const [posts, setPosts] = useState<NewsPost[] | null>(null);
  const [cat, setCat] = useState<CatKey>('all');

  // First-run welcome splash — shown once per device on the reader's very first
  // visit. Guarded in a lazy initializer so it never flashes for repeat visitors;
  // localStorage may throw in private mode, hence the try/catch.
  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      return localStorage.getItem(WELCOME_SEEN_KEY) !== 'true';
    } catch {
      return false;
    }
  });

  const dismissWelcome = () => {
    try {
      localStorage.setItem(WELCOME_SEEN_KEY, 'true');
    } catch {
      /* ignore private-mode failures */
    }
    setShowWelcome(false);
  };

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';

  useEffect(() => {
    let live = true;
    news.latest(60).then(
      (p) => live && setPosts(p),
      (err) => {
        console.error('[MobileNews] news.latest failed', err);
        if (live) setPosts([]);
      },
    );
    return () => {
      live = false;
    };
  }, []);

  usePageMeta({
    title: `${t('home.news.title')} — ${t('common.appName')}`,
    description: t('home.news.eyebrow'),
  });

  // Localised relative time ("42 minutes ago"), falling back to an absolute date
  // for anything older than a week. Intl handles all four interface languages.
  const rtf = useMemo(() => {
    try {
      return new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' });
    } catch {
      return null;
    }
  }, [i18n.language]);

  const timeAgo = (p: NewsPost): string => {
    const diff = Date.parse(p.createdAt) - Date.now();
    const abs = Math.abs(diff);
    const MIN = 60_000;
    const HOUR = 60 * MIN;
    const DAY = 24 * HOUR;
    if (rtf) {
      if (abs < HOUR) return rtf.format(Math.round(diff / MIN) || -1, 'minute');
      if (abs < DAY) return rtf.format(Math.round(diff / HOUR), 'hour');
      if (abs < 7 * DAY) return rtf.format(Math.round(diff / DAY), 'day');
    }
    return new Date(p.createdAt).toLocaleDateString(i18n.language, { dateStyle: 'medium' });
  };

  const catLabel = (key: Exclude<CatKey, 'all'> | null): string =>
    key ? t(`home.news.cat.${key}`) : t('home.news.welcome.heading2');

  // Telegram CDN URLs expire within days, so a synced post's photo is fetched
  // through /api/news-photo, which re-resolves it from the permanent permalink on
  // every request (same rule as NewsSection). Manual posts keep their URL.
  const photoSrc = (p: NewsPost): string | null => {
    if (!p.imageUrl) return null;
    const ref = p.source === 'telegram' ? postRef(p.url) : null;
    return ref ? `/api/news-photo?post=${encodeURIComponent(ref)}` : p.imageUrl;
  };

  const filtered = useMemo(() => {
    if (!posts) return posts;
    if (cat === 'all') return posts;
    const re = CATEGORY_RE[cat];
    return posts.filter((p) => re.test(haystack(p)));
  }, [posts, cat]);

  // Lead card = newest post in the current filter that has a photo, so the hero is
  // never an empty block; text-only posts flow into the list below.
  const featured =
    filtered && filtered.length > 0 ? (filtered.find((p) => photoSrc(p)) ?? filtered[0]) : null;
  const rest = filtered ? filtered.filter((p) => p !== featured) : [];

  const metaRow = (p: NewsPost) => (
    <div className="mt-3 flex items-center gap-2 text-[13px] text-gray-500">
      <span>{timeAgo(p)}</span>
      <span aria-hidden>·</span>
      <span className="truncate">{t('home.news.byline')}</span>
      <span aria-hidden className="ms-auto flex items-center gap-[3px] text-gray-300">
        <span className="h-[3px] w-[3px] rounded-full bg-current" />
        <span className="h-[3px] w-[3px] rounded-full bg-current" />
        <span className="h-[3px] w-[3px] rounded-full bg-current" />
      </span>
    </div>
  );

  const eyebrow = (p: NewsPost, big = false) => (
    <span
      className={`inline-flex items-center gap-1.5 font-extrabold uppercase tracking-wide text-brand-red ${
        big ? 'text-sm' : 'text-xs'
      }`}
    >
      {big && <TowerGlyph className="h-4 w-4 text-brand-red" />}
      {catLabel(categoryOf(p))}
    </span>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream flex flex-col">
      {showWelcome && <MobileNewsWelcome onContinue={dismissWelcome} />}

      {/* pt clears the shared floating language switcher pinned to the top-right
          corner on chrome-free routes, so the Istanbul seal never sits under it */}
      <main className="flex-1 px-5 pt-[calc(env(safe-area-inset-top)+3.5rem)] pb-[calc(env(safe-area-inset-bottom)+88px)]">
        {/* ===== masthead ===== */}
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[26px] font-extrabold leading-tight text-slate-400">
              {t('home.news.welcome.heading1')}
            </p>
            <div className="mt-0.5 flex items-center gap-2">
              <TowerGlyph className="h-8 w-8 shrink-0 text-brand-red" />
              <h1 className="text-[32px] font-extrabold leading-tight text-navy">
                {t('home.news.welcome.heading2')}
              </h1>
            </div>
          </div>
          <IstanbulSeal size={72} />
        </header>

        {/* ===== category chips ===== */}
        <nav
          aria-label={t('home.news.eyebrow')}
          className="scrollbar-none -mx-5 mt-6 flex gap-2.5 overflow-x-auto px-5"
        >
          {CATEGORIES.map(({ key, icon }) => {
            const active = cat === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCat(key)}
                aria-pressed={active}
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-[15px] font-bold transition-colors ${
                  active
                    ? 'bg-navy text-white shadow-card'
                    : 'bg-white text-navy shadow-card border border-cream-dark'
                }`}
                style={{ borderWidth: active ? undefined : '0.5px' }}
              >
                <AppIcon name={icon} className={`h-4 w-4 ${active ? 'text-white' : 'text-navy'}`} />
                {t(`home.news.cat.${key}`)}
              </button>
            );
          })}
        </nav>

        {/* ===== section title ===== */}
        <h2 className="section-title mt-7 font-extrabold text-brand-red">
          {t('home.news.latestNews')}
        </h2>

        {posts === null && (
          <p className="mt-10 text-center text-sm text-gray-500" aria-busy="true">
            {t('common.loading')}
          </p>
        )}

        {posts !== null && posts.length === 0 && (
          <div className="card mt-6 p-10 text-center">
            <p className="text-sm text-gray-500">{t('home.news.empty')}</p>
          </div>
        )}

        {/* posts exist, but none in the chosen category */}
        {posts !== null && posts.length > 0 && filtered !== null && filtered.length === 0 && (
          <div className="card mt-6 p-10 text-center">
            <p className="text-sm text-gray-500">{t('home.news.noCategory')}</p>
          </div>
        )}

        {/* ===== featured post ===== */}
        {featured && (
          <Link to={`/news/${featured.id}`} className="mt-5 block card overflow-hidden card-hover">
            {photoSrc(featured) && (
              <img
                src={photoSrc(featured)!}
                alt=""
                loading="lazy"
                className="h-56 w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div className="p-4">
              {eyebrow(featured, true)}
              <h3 className="mt-2 text-[22px] font-extrabold leading-snug text-navy break-words">
                {localizeNewsPost(featured, i18n.language).title}
              </h3>
              {metaRow(featured)}
            </div>
          </Link>
        )}

        {/* ===== list ===== */}
        {rest.length > 0 && (
          <ul className="mt-4 space-y-4">
            {rest.map((p) => {
              const text = localizeNewsPost(p, i18n.language);
              const src = photoSrc(p);

              // Text-only card: a compact single column with a leading red accent
              // rail, so a run of image-less posts each reads as its own item
              // instead of a monotonous stack of identical text blocks.
              if (!src) {
                return (
                  <li key={p.id}>
                    <Link
                      to={`/news/${p.id}`}
                      className="flex gap-3 card overflow-hidden p-4 card-hover"
                    >
                      <span aria-hidden className="w-1 shrink-0 rounded-full bg-brand-red/80" />
                      <div className="min-w-0 flex-1">
                        {eyebrow(p)}
                        <h3 className="mt-1.5 font-bold leading-snug text-navy break-words line-clamp-3">
                          {text.title}
                        </h3>
                        {metaRow(p)}
                      </div>
                    </Link>
                  </li>
                );
              }

              // Standard card from the mockup: text on the leading edge, a rounded
              // thumbnail on the trailing edge.
              return (
                <li key={p.id}>
                  <Link to={`/news/${p.id}`} className="flex gap-3 card overflow-hidden p-3 card-hover">
                    <div className="min-w-0 flex-1">
                      {eyebrow(p)}
                      <h3 className="mt-1.5 font-bold leading-snug text-navy break-words line-clamp-3">
                        {text.title}
                      </h3>
                      {metaRow(p)}
                    </div>
                    <img
                      src={src}
                      alt=""
                      loading="lazy"
                      className="h-28 w-28 shrink-0 self-center rounded-xl object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <MobileTabBar />
    </div>
  );
}
