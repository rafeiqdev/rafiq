import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { news, localizeNewsPost } from '../lib/api';
import type { NewsPost } from '../lib/api';
import { DirArrow } from '../components/AppIcon';
import { usePageMeta } from '../lib/seo';

/**
 * Full news listing (/news) — the destination behind the home page's "view
 * all" link. The home/dashboard section only ever shows the latest 3 posts;
 * before this page existed there was no way to reach anything past those 3
 * except opening one and clicking "back".
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="text-center">
        <span className="eyebrow">{t('home.news.eyebrow')}</span>
        <h1 className="section-title mt-2">{t('home.news.title')}</h1>
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

      {posts !== null && posts.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => {
            const text = localizeNewsPost(p, i18n.language);
            return (
              <article key={p.id} className="card overflow-hidden p-5 flex flex-col">
                {p.imageUrl && (
                  <img
                    src={p.imageUrl}
                    alt=""
                    loading="lazy"
                    className="-mx-5 -mt-5 mb-4 h-36 w-[calc(100%+2.5rem)] max-w-none object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
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
      )}
    </div>
  );
}
