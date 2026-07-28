import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { news } from '../../lib/api';
import type { NewsPost } from '../../lib/api';
import { AppIcon, DirArrow } from '../AppIcon';

/**
 * Latest news on the public home page — the on-site mirror of the owner's
 * Telegram channel, authored in /admin (NewsFeedManager). Renders NOTHING
 * until there is at least one post: an empty marketing block sells nothing,
 * and a fetch failure on the guest home page must degrade to absence, not an
 * error box (same rule as the places overlay).
 */
export function NewsSection({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [channel, setChannel] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([news.latest(4), news.telegramChannel()]).then(
      ([p, c]) => {
        if (!live) return;
        setPosts(p);
        setChannel(c);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);

  if (posts.length === 0) return null;

  const follow = channel && (
    <a
      href={channel}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-secondary h-10 px-4 text-sm shrink-0"
    >
      <AppIcon name="send" className="w-4 h-4" />
      {t('home.news.follow')}
    </a>
  );

  const date = (p: NewsPost) => new Date(p.createdAt).toLocaleDateString(i18n.language, { dateStyle: 'medium' });

  // Telegram CDN photo; a broken/expired URL degrades to a text card, never
  // to a broken-image glyph.
  const photo = (p: NewsPost, className: string) =>
    p.imageUrl && (
      <img
        src={p.imageUrl}
        alt=""
        loading="lazy"
        className={className}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );

  if (compact) {
    return (
      <section className="px-5 mt-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">{t('home.news.eyebrow')}</p>
            <h2 className="section-title">{t('home.news.title')}</h2>
          </div>
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {posts.map((p) => (
            <li key={p.id} className="card overflow-hidden p-4">
              {photo(p, '-mx-4 -mt-4 mb-3 h-40 w-[calc(100%+2rem)] max-w-none object-cover')}
              <p className="text-xs text-gray-500">{date(p)}</p>
              <h3 className="mt-1 font-bold text-navy break-words">{p.title}</h3>
              {p.body && <p className="mt-1 text-sm text-navy/70 break-words line-clamp-3">{p.body}</p>}
              {p.url && (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-navy underline-offset-2 hover:underline"
                >
                  {t('home.news.readMore')}
                  <DirArrow className="w-3.5 h-3.5" />
                </a>
              )}
            </li>
          ))}
        </ul>
        {follow && <div className="mt-4">{follow}</div>}
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
        {follow}
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <article key={p.id} className="card overflow-hidden p-5 flex flex-col">
            {photo(p, '-mx-5 -mt-5 mb-4 h-36 w-[calc(100%+2.5rem)] max-w-none object-cover')}
            <p className="text-xs text-gray-500">{date(p)}</p>
            <h3 className="mt-1.5 font-bold text-navy break-words">{p.title}</h3>
            {p.body && <p className="mt-1.5 text-sm text-navy/70 break-words line-clamp-4">{p.body}</p>}
            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto pt-3 inline-flex items-center gap-1 text-sm font-bold text-navy underline-offset-2 hover:underline"
              >
                {t('home.news.readMore')}
                <DirArrow className="w-3.5 h-3.5" />
              </a>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
