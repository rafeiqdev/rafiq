import { useTranslation } from 'react-i18next';

export function Legal({ doc }: { doc: 'terms' | 'privacy' | 'refund' }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="card p-8">
        <h1 className="text-2xl font-extrabold text-navy">{t(`legal.${doc}.title`)}</h1>
        <p className="mt-1 text-sm text-navy/50">{t('legal.updated')}</p>
        <div className="mt-5 text-navy/80 leading-relaxed whitespace-pre-line text-sm sm:text-base">{t(`legal.${doc}.body`)}</div>
      </div>
    </div>
  );
}
