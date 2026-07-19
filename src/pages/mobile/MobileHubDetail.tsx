import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../../components/AppIcon';
import type { IconName } from '../../components/AppIcon';
import { ServiceRequestModal } from '../../components/ServiceRequestModal';

// Kept local (not exported) — Hub.tsx stays the canonical export.
const GUIDE_SLUGS = ['istanbulkart', 'esim', 'ikamet', 'vergi', 'bank', 'districts'] as const;

const ICONS: Record<string, IconName> = {
  istanbulkart: 'bus',
  esim: 'smartphone',
  ikamet: 'id-card',
  vergi: 'receipt',
  bank: 'landmark',
  districts: 'map',
};

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
const mobileCopy: Record<string, { back: string }> = {
  en: { back: 'Back' },
  ar: { back: 'رجوع' },
  fa: { back: 'بازگشت' },
  ru: { back: 'Назад' },
};

export function MobileHubDetail() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const valid = slug && (GUIDE_SLUGS as readonly string[]).includes(slug);
  const [helping, setHelping] = useState(false);

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.en;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className={valid ? 'pb-[calc(env(safe-area-inset-bottom)+84px)]' : 'pb-10'}>
        {/* ── Plain navy header panel (no photo — the list page above has it) ── */}
        <header className="relative overflow-hidden rounded-b-[28px] bg-gradient-to-br from-navy to-navy-light px-5 pb-6 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white">
          <span
            aria-hidden="true"
            className="pointer-events-none select-none absolute -bottom-12 -end-3.5 text-[9.5rem] font-bold leading-none text-white/5"
          >
            ر
          </span>
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={mc.back}
            className="relative -ms-1 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors active:bg-white/25"
          >
            <AppIcon name="arrow-left" className={`h-6 w-6 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          {valid && (
            <div className="animate-fade-up relative mt-4 flex items-center gap-3.5">
              <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/15">
                <AppIcon name={ICONS[slug!]} className="h-[26px] w-[26px]" />
              </span>
              <h1 className="min-w-0 text-xl font-extrabold leading-snug">{t(`hub.guides.${slug}.title`)}</h1>
            </div>
          )}
        </header>

        <main className="px-5 pt-5">
          {valid ? (
            <article className="card animate-fade-up p-[22px]">
              <p className="whitespace-pre-line text-[14.5px] leading-[1.75] text-navy/85">
                {t(`hub.guides.${slug}.body`)}
              </p>
            </article>
          ) : (
            <div className="card animate-pop mt-6 p-10 text-center">
              <div className="icon-chip mx-auto">
                <AppIcon name="file-text" className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm text-gray-500">{t('common.error')}</p>
              <Link to="/hub" className="btn-primary mt-5 flex min-h-[50px] w-full text-[15px]">
                {t('nav.hub')}
              </Link>
            </div>
          )}
        </main>
      </div>

      {/* ── Sticky bottom CTA (no tab bar — sub-screen) ── */}
      {valid && (
        <div className="fixed bottom-0 inset-x-0 z-30 border-t border-cream-dark bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur">
          <button
            onClick={() => setHelping(true)}
            className="btn-primary flex min-h-[52px] w-full text-[15px] transition-transform active:scale-[0.98]"
          >
            <AppIcon name="message-circle" className="h-[18px] w-[18px]" />
            {t('common.helpMe')}
          </button>
        </div>
      )}

      {helping && (
        <ServiceRequestModal
          source={{ id: `hub:${slug}`, title: t(`hub.guides.${slug}.title`), category: 'hub', type: 'guide' }}
          onClose={() => setHelping(false)}
        />
      )}
    </div>
  );
}
