import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { news } from '../lib/api';
import type { NewsPost } from '../lib/api';
import { AppIcon, DirArrow } from '../components/AppIcon';
import { usePageMeta } from '../lib/seo';

/**
 * The in-app reading page for one news post (/news/:id). "Read more" used to
 * jump straight to the Telegram channel — readers now stay on the site, see
 * the full text, and can hand the post to the assistant with one tap
 * (/premium?news=<id> seeds the chat with it, see Premium/MobilePremium).
 *
 * One component for phones and desktop: it is a single column of text either
 * way, so a Mobile* twin would only be drift waiting to happen.
 */
export function NewsArticle() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const [post, setPost] = useState<NewsPost | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let live = true;
    if (!id) {
      setState('missing');
      return;
    }
    setState('loading');
    news.byId(id).then(
      (p) => {
        if (!live) return;
        setPost(p);
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

  usePageMeta({
    title: post ? `${post.title} — Rafiq` : `${t('home.news.title')} — Rafiq`,
    description: post?.body?.slice(0, 160) ?? t('home.news.title'),
    image: post?.imageUrl ?? undefined,
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline">
        <DirArrow className="w-4 h-4 rotate-180" />
        {t('common.back')}
      </Link>

      {state === 'loading' && (
        <p className="mt-8 text-sm text-gray-500" aria-busy="true">
          {t('common.loading')}
        </p>
      )}

      {state === 'missing' && (
        <div className="card mt-6 p-8 text-center">
          <p className="font-bold text-navy">{t('home.news.notFound')}</p>
          <Link to="/" className="btn-secondary mt-5 inline-flex">
            {t('common.back')}
          </Link>
        </div>
      )}

      {state === 'ready' && post && (
        <article className="card mt-6 overflow-hidden">
          {post.imageUrl && (
            <img
              src={post.imageUrl}
              alt=""
              className="h-56 w-full object-cover sm:h-72"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <div className="p-5 sm:p-7">
            <p className="text-xs text-gray-500">
              {new Date(post.createdAt).toLocaleDateString(i18n.language, { dateStyle: 'medium' })}
            </p>
            <h1 className="mt-2 text-xl font-extrabold text-navy break-words sm:text-2xl">{post.title}</h1>
            {post.body && (
              <p className="mt-4 text-[15px] leading-relaxed text-navy/85 whitespace-pre-line break-words">
                {post.body}
              </p>
            )}
            <Link to={`/premium?news=${post.id}`} className="btn-primary mt-6 w-full sm:w-auto sm:px-6">
              <AppIcon name="message-circle" className="w-4 h-4" />
              {t('home.news.askAi')}
            </Link>
          </div>
        </article>
      )}
    </div>
  );
}
