import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { news, localizeNewsPost } from '../../lib/api';
import type { NewsPost } from '../../lib/api';
import { postRef } from '../../lib/telegramNews';
import { AppIcon, DirArrow } from '../AppIcon';

/**
 * Latest news on the public home page — the on-site mirror of the owner's
 * Telegram channel, authored in /admin (NewsFeedManager). Renders NOTHING
 * until there is at least one post: an empty marketing block sells nothing,
 * and a fetch failure on the guest home page must degrade to absence, not an
 * error box (same rule as the places overlay).
 */
export function NewsSection({
  compact = false,
  className,
}: {
  compact?: boolean;
  /** Wrapper spacing override for the compact variant — MobileHome's sections
      are full-bleed (need their own px-5), UserHome's column is already padded. */
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const [posts, setPosts] = useState<NewsPost[]>([]);

  useEffect(() => {
    let live = true;
    news.latest(3).then(
      (p) => {
        if (!live) return;
        setPosts(p);
      },
      (err) => {
        // Visitors still see nothing rather than an error box — but a silent
        // catch is why a 400 on this query went unnoticed. Log it.
        console.error('[NewsSection] news.latest failed', err);
      },
    );
    return () => {
      live = false;
    };
  }, []);

  if (posts.length === 0) return null;

  const date = (p: NewsPost) => new Date(p.createdAt).toLocaleDateString(i18n.language, { dateStyle: 'medium' });

  // Telegram's own CDN URLs expire within days, so the one stored at sync time
  // is usually dead by the time a visitor sees the card. For a synced post the
  // photo is therefore fetched through /api/news-photo, which re-resolves it
  // from the (permanent) permalink on every request. `imageUrl` is still what
  // says a post HAS a photo — it just isn't trusted as a location any more.
  // Manually-authored posts keep their admin-supplied URL, which does not expire.
  const photoSrc = (p: NewsPost): string | null => {
    if (!p.imageUrl) return null;
    const ref = p.source === 'telegram' ? postRef(p.url) : null;
    return ref ? `/api/news-photo?post=${encodeURIComponent(ref)}` : p.imageUrl;
  };

  // A broken/expired photo degrades to a text card, never to a broken-image glyph.
  const photo = (p: NewsPost, className: string) => {
    const text = localizeNewsPost(p, i18n.language);
    const src = photoSrc(p);
    return src && (
      <img
        src={src}
        alt={text.title}
        loading="lazy"
        className={className}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  };

  if (compact) {
    // Horizontal, swipeable rail instead of a stacked list — a vertical list
    // of up to 6 cards used to push everything below it off the first
    // screen, on both mobile and desktop. Scroll-snap keeps each card
    // aligned as the user swipes/drags, on touch and with a mouse alike.
    return (
      <section className={className ?? 'px-5 mt-10'}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">{t('home.news.eyebrow')}</p>
            <h2 className="section-title">{t('home.news.title')}</h2>
          </div>
          <Link to="/news" className="text-sm font-bold text-navy inline-flex items-center gap-1 shrink-0">
            {t('common.viewAll')}
            <AppIcon name="arrow-right" className="w-3.5 h-3.5 dir-arrow" />
          </Link>
        </div>
        <ul
          className="mt-4 flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scroll-px-5 -mx-5 px-5 sm:-mx-1 sm:px-1"
          style={{ scrollbarWidth: 'thin' }}
        >
          {posts.map((p) => {
            const text = localizeNewsPost(p, i18n.language);
            return (
              <li
                key={p.id}
                className="card overflow-hidden p-4 shrink-0 snap-start w-[78vw] max-w-[300px] sm:w-72 flex flex-col"
              >
                {photo(p, '-mx-4 -mt-4 mb-3 h-36 w-[calc(100%+2rem)] max-w-none object-cover')}
                <p className="text-xs text-gray-500">{date(p)}</p>
                <h3 className="mt-1 font-bold text-navy break-words line-clamp-2">{text.title}</h3>
                {text.body && <p className="mt-1 text-sm text-navy/70 break-words line-clamp-3">{text.body}</p>}
                {/* Read more stays IN the app (/news/:id) — the Telegram jump lost readers. */}
                <Link
                  to={`/news/${p.id}`}
                  className="mt-auto pt-2 inline-flex items-center gap-1 text-sm font-bold text-navy underline-offset-2 hover:underline"
                >
                  {t('home.news.readMore')}
                  <DirArrow className="w-3.5 h-3.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">{t('home.news.eyebrow')}</span>
          <h2 className="section-title mt-2">{t('home.news.title')}</h2>
        </div>
        <Link to="/news" className="text-sm font-bold text-navy inline-flex items-center gap-1">
          {t('common.viewAll')}
          <AppIcon name="arrow-right" className="w-3.5 h-3.5 dir-arrow" />
        </Link>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => {
          const text = localizeNewsPost(p, i18n.language);
          return (
            <article key={p.id} className="card overflow-hidden p-5 flex flex-col">
              {photo(p, '-mx-5 -mt-5 mb-4 h-36 w-[calc(100%+2.5rem)] max-w-none object-cover')}
              <p className="text-xs text-gray-500">{date(p)}</p>
              <h3 className="mt-1.5 font-bold text-navy break-words">{text.title}</h3>
              {text.body && <p className="mt-1.5 text-sm text-navy/70 break-words line-clamp-4">{text.body}</p>}
              <Link
                to={`/news/${p.id}`}
                className="mt-auto pt-3 inline-flex items-center gap-1 text-sm font-bold text-navy underline-offset-2 hover:underline"
              >
                {t('home.news.readMore')}
                <DirArrow className="w-3.5 h-3.5" />
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
