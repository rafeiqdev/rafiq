import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { news, localizeNewsPost } from '../../lib/api';
import type { NewsPost } from '../../lib/api';
import { postRef } from '../../lib/telegramNews';
import { parseNewsBody } from '../../lib/newsBody';
import { AppIcon, BackArrow, DirArrow } from '../../components/AppIcon';
import { Logo } from '../../components/Logo';
import { TopRatesBar } from '../../components/TopRatesBar';
import { MobileTabBar } from '../../components/MobileTabBar';
import { useApp } from '../../context/AppContext';
import { usePageMeta } from '../../lib/seo';

/**
 * Phone reading page for one news post (/news/:id) — the full mobile chrome
 * (FX ticker, brand header, bottom tab bar) wrapped around the article, with a
 * "Related news" rail beneath it. Desktop renders NewsArticle instead.
 */
export function MobileNewsArticle() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const [post, setPost] = useState<NewsPost | null>(null);
  const [more, setMore] = useState<NewsPost[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';

  useEffect(() => {
    let live = true;
    if (!id) {
      setState('missing');
      return;
    }
    setState('loading');
    setPost(null);
    window.scrollTo(0, 0);
    Promise.all([news.byId(id), news.latest(9).catch(() => [])]).then(
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

  const photoSrc = (p: NewsPost): string | null => {
    if (!p.imageUrl) return null;
    const ref = p.source === 'telegram' ? postRef(p.url) : null;
    return ref ? `/api/news-photo?post=${encodeURIComponent(ref)}` : p.imageUrl;
  };

  const date = (p: NewsPost) => new Date(p.createdAt).toLocaleDateString(i18n.language, { dateStyle: 'medium' });
  const dateRow = (p: NewsPost) => (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <AppIcon name="calendar" className="w-3.5 h-3.5 text-amber-500" />
      {date(p)}
    </span>
  );

  const related = more.slice(0, 4);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream flex flex-col">
      <TopRatesBar />

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

      <main className="flex-1 px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+88px)]">
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
            <article className="mt-5">
              <span className="eyebrow text-brand-red">{t('home.news.category')}</span>
              <div className="mt-2">{dateRow(post)}</div>
              <h1 className="mt-2 text-[26px] font-extrabold leading-tight text-navy break-words">{text.title}</h1>

              {photoSrc(post) && (
                <img
                  src={photoSrc(post)!}
                  alt=""
                  className="mt-4 w-full rounded-2xl object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}

              {parsed.lead && (
                <p className="mt-4 text-[15px] font-semibold leading-relaxed text-navy/90 whitespace-pre-line break-words">
                  {parsed.lead}
                </p>
              )}

              {parsed.bullets.length > 0 && (
                <ul className="mt-4 space-y-3 border-t border-cream-dark pt-4">
                  {parsed.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-navy/85 break-words">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-red" aria-hidden />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}

              {parsed.source && (
                <p className="mt-5 border-t border-cream-dark pt-4 text-sm text-navy/60">
                  <span className="font-bold text-navy/80">{t('home.news.source')}:</span> {parsed.source}
                </p>
              )}

              <Link to={`/premium?news=${post.id}`} className="btn-primary mt-5 w-full">
                <AppIcon name="message-circle" className="w-4 h-4" />
                {t('home.news.askAi')}
              </Link>
            </article>

            {/* ===== related news ===== */}
            {related.length > 0 && (
              <section className="mt-10">
                <h2 className="section-title">{t('home.news.related')}</h2>
                <ul className="mt-4 space-y-4">
                  {related.map((p) => {
                    const rt = localizeNewsPost(p, i18n.language);
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
                              {rt.title}
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
              </section>
            )}
          </>
        )}
      </main>

      <MobileTabBar />
    </div>
  );
}
