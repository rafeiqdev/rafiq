import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { news, localizeNewsPost } from '../lib/api';
import type { NewsPost } from '../lib/api';
import { postRef } from '../lib/telegramNews';
import { AppIcon, DirArrow } from '../components/AppIcon';
import { usePageMeta } from '../lib/seo';

/**
 * Full news listing (/news) — the destination behind the home page's "view
 * all" link. Desktop only: phones render MobileNews instead (see App.tsx).
 *
 * Magazine layout: one large featured post (left) beside a "Latest" rail of the
 * next three (right), then every remaining post in a three-up grid below.
 */
export function News() {
  const { t, i18n } = useTranslation();
  const [posts, setPosts] = useState<NewsPost[] | null>(null);

  useEffect(() => {
    let live = true;
    news.latest(60).then(
      (p) => live && setPosts(p),
      (err) => {
        console.error('[News] news.latest failed', err);
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

  const dateRow = (p: NewsPost) => (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <AppIcon name="calendar" className="w-3.5 h-3.5 text-brand-red" />
      {date(p)}
    </span>
  );

  const readMore = (
    <span className="inline-flex items-center gap-1 text-sm font-bold text-navy underline-offset-2 group-hover:underline">
      {t('home.news.readMore')}
      <DirArrow className="w-3.5 h-3.5" />
    </span>
  );

  // The lead card is the newest post that actually HAS a photo — a text-only
  // post blown up to hero size is the same "empty big block" the grid avoids.
  // Everything else keeps its chronological order below.
  const featured = posts && posts.length > 0 ? (posts.find((p) => photoSrc(p)) ?? posts[0]) : null;
  const remaining = posts ? posts.filter((p) => p !== featured) : [];
  const rail = remaining.slice(0, 3);
  const grid = remaining.slice(3);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <span className="eyebrow text-brand-red">{t('home.news.eyebrow')}</span>

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

      {featured && (
        <div className="mt-2 grid gap-6 lg:grid-cols-3">
          {/* ===== featured (left, 2 cols) ===== */}
          <div className="lg:col-span-2">
            <h1 className="section-title">{t('home.news.title')}</h1>
            <Link
              to={`/news/${featured.id}`}
              className="group mt-5 block card overflow-hidden card-hover"
            >
              {photoSrc(featured) && (
                <img
                  src={photoSrc(featured)!}
                  alt=""
                  loading="lazy"
                  className="h-72 w-full object-cover xl:h-80"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <div className="p-6">
                {dateRow(featured)}
                <h2 className="mt-2 text-3xl font-extrabold leading-tight text-navy break-words">
                  {localizeNewsPost(featured, i18n.language).title}
                </h2>
                <div className="mt-4 flex justify-end">{readMore}</div>
              </div>
            </Link>
          </div>

          {/* ===== "Latest" rail (right) ===== */}
          <div>
            <h2 className="section-title">{t('home.news.latest')}</h2>
            {rail.length > 0 && (
              <ul className="mt-5 card divide-y divide-cream-dark overflow-hidden">
                {rail.map((p) => {
                  const text = localizeNewsPost(p, i18n.language);
                  const src = photoSrc(p);
                  return (
                    <li key={p.id}>
                      <Link to={`/news/${p.id}`} className="group flex gap-3 p-3">
                        {src && (
                          <img
                            src={src}
                            alt=""
                            loading="lazy"
                            className="h-24 w-24 shrink-0 rounded-xl object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold leading-snug text-navy break-words line-clamp-2">
                            {text.title}
                          </h3>
                          <div className="mt-1.5">{dateRow(p)}</div>
                          <div className="mt-2">{readMore}</div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ===== remaining posts, three-up =====
          Posts WITH a photo fill a normal square cell. Photo-less posts (the
          channel's "عاجل"/"Trending" text blurbs) would otherwise sit in a
          square as an empty-topped card that reads as broken — instead they
          span the full row as a short landscape strip. `grid-flow-row-dense`
          lets the following square cards backfill any gap a strip leaves. */}
      {grid.length > 0 && (
        <div className="mt-6 grid grid-flow-row-dense gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {grid.map((p) => {
            const text = localizeNewsPost(p, i18n.language);
            const src = photoSrc(p);

            if (!src) {
              return (
                <Link
                  key={p.id}
                  to={`/news/${p.id}`}
                  className="group card card-hover flex items-center justify-between gap-4 p-5 sm:col-span-2 lg:col-span-3"
                >
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold leading-snug text-navy break-words line-clamp-2">
                      {text.title}
                    </h3>
                    <div className="mt-1.5">{dateRow(p)}</div>
                  </div>
                  <div className="shrink-0">{readMore}</div>
                </Link>
              );
            }

            return (
              <Link
                key={p.id}
                to={`/news/${p.id}`}
                className="group card overflow-hidden card-hover flex flex-col"
              >
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  className="h-44 w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-lg font-bold leading-snug text-navy break-words line-clamp-2">
                    {text.title}
                  </h3>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                    {dateRow(p)}
                    {readMore}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
