import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Logo } from '../components/Logo';
import { DirArrow } from '../components/AppIcon';
import { usePageMeta } from '../lib/seo';

/**
 * P2-2: a real 404 instead of silently rendering the home page.
 *
 * A static SPA cannot change the HTTP status (Vercel serves index.html with
 * 200 for every route), so the soft-404 is mitigated where the client can:
 * its own <title> instead of inheriting the home page's, and a noindex robots
 * tag so a crawler that executes JS drops the URL rather than indexing the
 * shell. A true 404 status needs prerendering/SSR — tracked in the README.
 */
export function NotFound() {
  const { t } = useTranslation();
  usePageMeta({ title: `404 — ${t('notFound.title')}`, description: t('notFound.body') });
  useEffect(() => {
    const tag = document.createElement('meta');
    tag.name = 'robots';
    tag.content = 'noindex';
    document.head.appendChild(tag);
    return () => tag.remove();
  }, []);
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="card p-10">
        <div className="flex justify-center">
          <Logo size={72} />
        </div>
        <p className="mt-5 text-5xl font-extrabold text-navy" dir="ltr">
          404
        </p>
        <h1 className="mt-2 text-xl font-extrabold text-navy">{t('notFound.title')}</h1>
        <p className="mt-2 text-sm text-gray-500">{t('notFound.body')}</p>
        <Link to="/" className="btn-primary w-full mt-6">
          {t('notFound.cta')}
          <DirArrow />
        </Link>
      </div>
    </div>
  );
}
