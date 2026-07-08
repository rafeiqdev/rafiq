import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Logo } from '../components/Logo';
import { DirArrow } from '../components/AppIcon';

/** P2-2: a real 404 instead of silently rendering the home page. */
export function NotFound() {
  const { t } = useTranslation();
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
