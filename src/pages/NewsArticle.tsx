import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { news, localizeNewsPost } from '../lib/api';
import type { NewsPost } from '../lib/api';
import { postRef } from '../lib/telegramNews';
import { parseNewsBody } from '../lib/newsBody';
import { AppIcon, BackArrow, DirArrow } from '../components/AppIcon';
import { usePageMeta, SITE_URL } from '../lib/seo';

/**
 * Desktop reading page for one news post (/news/:id). Two columns: the article
 * on the left, a "Latest news" rail on the right, and a "Related news" grid
 * below. Phones render MobileNewsArticle instead (see App.tsx).
 */
export function NewsArticle() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const [post, setPost] = useState<NewsPost | null>(null);
  const [more, setMore] = useState<NewsPost[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let live = true;
    if (!id) {
      setState('missing');
      return;
    }
    setState('loading');
    setPost(null);
    Promise.all([news.byId(id), news.latest(13).catch(() => [])]).then(
      ([p, latest]) => {
        if (!live) return;
        setPost(p);
        setMore(latest.filter((x) => x.id !== id));
        setState(p ? 'ready' : 'missing');
      },
      () => {
        if (live) setState('missing');
      },
    );
    return () => {
      live = false;
    };
  }, [id]);

  const text = post ? localizeNewsPost(post, i18n.language) : null;
  const parsed = text ? parseNewsBody(text.body) : null;

  usePageMeta({
    title: text ? `${text.title} — Rafiq` : `${t('home.news.title')} — Rafiq`,
    description: text?.body?.slice(0, 160) ?? t('home.news.title'),
    image: post?.imageUrl ?? undefined,
  });

  // Telegram CDN URLs expire; resolve a synced post's photo through the proxy
  // (same rule as the listing). Manual posts keep their admin-supplied URL.
  const photoSrc = (p: NewsPost): string | null => {
    if (!p.imageUrl) return null;
    const ref = p.source === 'telegram' ? postRef(p.url) : null;
    return ref ? `/api/news-photo?post=${encodeURIComponent(ref)}` : p.imageUrl;
  };

  const date = (p: NewsPost) => new Date(p.createdAt).toLocaleDateString(i18n.language, { dateStyle: 'medium' });
  const dateRow = (p: NewsPost) => (
    <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
      <AppIcon name="calendar" className="w-4 h-4 text-brand-red" />
      {date(p)}
    </span>
  );

  const sidebar = more.slice(0, 3);
  const relatedGrid = more.slice(3, 9);

  // Only Google's second-pass JS rendering (and browsers) ever see this — a
  // crawler that fetches the raw HTML gets the generic pre-rendered /news hub
  // shell instead, since these ~20 posts are Supabase rows with no build-time
  // static content to bake a per-article shell from (see the guide/service
  // pages' generate-seo-pages.mjs for that pattern, which needs data known at
  // build time). Still worth emitting: it is real signal for any client that
  // does execute JS, and costs nothing extra to compute.
  const articleJsonLd = state === 'ready' && post && text
    ? {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: text.title,
        description: text.body?.slice(0, 200) ?? undefined,
        image: post.imageUrl ?? undefined,
        datePublished: post.createdAt,
        dateModified: post.createdAt,
        inLanguage: i18n.language,
        url: `${SITE_URL}/${i18n.language}/news/${post.id}`,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        publisher: { '@id': `${SITE_URL}/#organization` },
      }
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {articleJsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
        />
      )}
      <Link to="/news" className="inline-flex items-center gap-1.5 text-sm font-bold text-navy hover:underline">
        <BackArrow className="w-4 h-4" />
        {t('home.news.backToNews')}
      </Link>

      {state === 'loading' && (
        <p className="mt-8 text-sm text-gray-500" aria-busy="true">
          {t('common.loading')}
        </p>
      )}

      {state === 'missing' && (
        <div className="card mt-6 p-8 text-center">
          <p className="font-bold text-navy">{t('home.news.notFound')}</p>
          <Link to="/news" className="btn-secondary mt-5 inline-flex">
            {t('home.news.backToNews')}
          </Link>
        </div>
      )}

      {state === 'ready' && post && text && parsed && (
        <>
          <div className="mt-6 grid gap-8 lg:grid-cols-3">
            {/* ===== article ===== */}
            <article className="lg:col-span-2">
              <span className="eyebrow text-brand-red">{t('home.news.category')}</span>
              <div className="mt-2">{dateRow(post)}</div>
              <h1 className="mt-2 text-3xl font-extrabold leading-tight text-navy break-words sm:text-4xl">
                {text.title}
              </h1>

              {photoSrc(post) && (
                <img
                  src={photoSrc(post)!}
                  alt=""
                  className="mt-6 w-full rounded-2xl object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}

              {parsed.lead && (
                <p className="mt-6 text-lg font-semibold leading-relaxed text-navy/90 whitespace-pre-line break-words">
                  {parsed.lead}
                </p>
              )}

              {parsed.bullets.length > 0 && (
                <ul className="mt-4 space-y-3 border-t border-cream-dark pt-5">
                  {parsed.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-navy/85 break-words">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red" aria-hidden />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}

              {parsed.source && (
                <p className="mt-6 border-t border-cream-dark pt-4 text-sm text-navy/60">
                  <span className="font-bold text-navy/80">{t('home.news.source')}:</span> {parsed.source}
                </p>
              )}

              <Link to={`/premium?news=${post.id}`} className="btn-primary mt-6 inline-flex px-6">
                <AppIcon name="message-circle" className="w-4 h-4" />
                {t('home.news.askAi')}
              </Link>
            </article>

            {/* ===== "Latest news" rail ===== */}
            {sidebar.length > 0 && (
              <aside>
                <h2 className="section-title">{t('home.news.latestNews')}</h2>
                <ul className="mt-5 card divide-y divide-cream-dark overflow-hidden">
                  {sidebar.map((p) => {
                    const rt = localizeNewsPost(p, i18n.language);
                    const src = photoSrc(p);
                    return (
                      <li key={p.id}>
                        <Link to={`/news/${p.id}`} className="group flex items-center gap-3 p-3">
                          {src && (
                            <img
                              src={src}
                              alt=""
                              loading="lazy"
                              className="h-20 w-24 shrink-0 rounded-xl object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold leading-snug text-navy break-words line-clamp-2">{rt.title}</h3>
                            <div className="mt-1.5">{dateRow(p)}</div>
                          </div>
                          <DirArrow className="w-4 h-4 shrink-0 text-brand-red" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </aside>
            )}
          </div>

          {/* ===== related grid ===== */}
          {relatedGrid.length > 0 && (
            <section className="mt-12">
              <h2 className="section-title">{t('home.news.related')}</h2>
              <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {relatedGrid.map((p) => {
                  const rt = localizeNewsPost(p, i18n.language);
                  const src = photoSrc(p);
                  return (
                    <Link
                      key={p.id}
                      to={`/news/${p.id}`}
                      className="group card overflow-hidden card-hover flex flex-col"
                    >
                      {src && (
                        <img
                          src={src}
                          alt=""
                          loading="lazy"
                          className="h-40 w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex flex-1 flex-col p-5">
                        <h3 className="font-bold leading-snug text-navy break-words line-clamp-2">{rt.title}</h3>
                        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                          {dateRow(p)}
                          <span className="inline-flex items-center gap-1 text-sm font-bold text-navy">
                            {t('home.news.readMore')}
                            <DirArrow className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
