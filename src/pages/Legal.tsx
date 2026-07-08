import { useTranslation } from 'react-i18next';

// TODO(legal-review): legal.refund.body (src/i18n/locales/*.json) currently states
// an absolute no-refund policy. Turkey's Distance Contracts Regulation (Mesafeli
// Sözleşmeler Yönetmeliği) grants consumers a 14-day withdrawal right on remote
// digital services unless they've given explicit prior consent to lose that right
// once performance starts immediately. Have Turkish consumer-law counsel review
// this policy against that regulation before launch — do not edit the refund text
// itself without their sign-off.
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
