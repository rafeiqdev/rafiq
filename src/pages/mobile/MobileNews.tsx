import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { news, localizeNewsPost } from '../../lib/api';
import type { NewsPost } from '../../lib/api';
import { postRef } from '../../lib/telegramNews';
import { AppIcon, DirArrow } from '../../components/AppIcon';
import { Logo } from '../../components/Logo';
import { TopRatesBar } from '../../components/TopRatesBar';
import { MobileTabBar } from '../../components/MobileTabBar';
import { MobileNewsWelcome } from './MobileNewsWelcome';
import { useApp } from '../../context/AppContext';
import { usePageMeta } from '../../lib/seo';

const WELCOME_SEEN_KEY = 'rafiq_news_welcome_seen';

/**
 * Phone-only /news screen — a magazine-style feed (one large featured post,
 * then a stack of horizontal list cards) instead of the shared desktop grid in
 * News.tsx. It owns its full mobile chrome: the FX ticker, a slim brand header,
 * and the bottom tab bar. `/news` is therefore added to Layout's
 * MOBILE_CHROME_FREE_ROUTES so the desktop ticker+header+footer aren't stacked
 * on top of this one.
 */
export function MobileNews() {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const [posts, setPosts] = useState<NewsPost[] | null>(null);

  // First-run welcome splash — shown once per device on the reader's very first
  // visit to /news. Guarded in a lazy initializer so it never flashes for repeat
  // visitors; localStorage may throw in private mode, hence the try/catch.
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

  const date = (p: NewsPost) => new Date(p.createdAt).toLocaleDateString(i18n.language, { dateStyle: 'medium' });

  // Telegram CDN URLs expire within days, so a synced post's photo is fetched
  // through /api/news-photo, which re-resolves it from the permanent permalink
  // on every request (same rule as NewsSection). Manual posts keep their URL.
  const photoSrc = (p: NewsPost): string | null => {
    if (!p.imageUrl) return null;
    const ref = p.source === 'telegram' ? postRef(p.url) : null;
    return ref ? `/api/news-photo?post=${encodeURIComponent(ref)}` : p.imageUrl;
  };

  // Lead card = newest post that has a photo, so the hero is never an empty
  // block; the text-only posts flow into the list below as plain rows.
  const featured = posts && posts.length > 0 ? (posts.find((p) => photoSrc(p)) ?? posts[0]) : null;
  const rest = posts ? posts.filter((p) => p !== featured) : [];

  const dateRow = (p: NewsPost) => (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <AppIcon name="calendar" className="w-3.5 h-3.5 text-amber-500" />
      {date(p)}
    </span>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream flex flex-col">
      {showWelcome && <MobileNewsWelcome onContinue={dismissWelcome} />}

      <TopRatesBar />

      {/* slim brand header — wordmark + circular profile button */}
      <header className="sticky top-0 z-30 border-b border-cream-dark bg-white/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-5">
          <Link to="/" aria-label={t('common.appName')} className="flex items-center">
            <Logo size={26} />
          </Link>
          <Link
            to={user ? '/profile' : '/auth'}
            aria-label={t('nav.profile')}
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-navy text-navy active:scale-95 transition-transform"
          >
            <AppIcon name="user" className="w-5 h-5" />
          </Link>
        </div>
      </header>

      {/* clears the fixed tab bar */}
      <main className="flex-1 px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+88px)]">
        <div>
          <h1 className="section-title">{t('home.news.title')}</h1>
          <span className="mt-2 block h-1 w-12 rounded-full bg-amber-400" aria-hidden />
        </div>

        {posts === null && (
          <p className="mt-10 text-center text-sm text-gray-500" aria-busy="true">
            {t('common.loading')}
          </p>
        )}

        {posts !== null && posts.length === 0 && (
          <div className="card mt-8 p-10 text-center">
            <p className="text-sm text-gray-500">{t('home.news.empty')}</p>
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
                className="h-52 w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div className="p-4">
              {dateRow(featured)}
              <h2 className="mt-2 text-[22px] font-extrabold leading-snug text-navy break-words">
                {localizeNewsPost(featured, i18n.language).title}
              </h2>
            </div>
          </Link>
        )}

        {/* ===== list ===== */}
        {rest.length > 0 && (
          <ul className="mt-4 space-y-4">
            {rest.map((p) => {
              const text = localizeNewsPost(p, i18n.language);
              const src = photoSrc(p);
              return (
                <li key={p.id}>
                  <Link to={`/news/${p.id}`} className="flex gap-3 card overflow-hidden p-3 card-hover">
                    {src && (
                      <img
                        src={src}
                        alt=""
                        loading="lazy"
                        className="h-28 w-28 shrink-0 rounded-xl object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      {dateRow(p)}
                      <h3 className="mt-1 font-bold leading-snug text-navy break-words line-clamp-3">
                        {text.title}
                      </h3>
                      <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[#2f6fed]">
                        {t('home.news.readMore')}
                        <DirArrow className="w-3.5 h-3.5" />
                      </span>
                    </div>
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
