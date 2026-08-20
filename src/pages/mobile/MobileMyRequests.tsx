import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon, BackArrow } from '../../components/AppIcon';
import { RafiqLoader } from '../../components/RafiqLoader';
import { RequireAuth } from '../../components/Gates';
import { MedicalRequestsPanel } from '../../components/medical/MedicalRequestsPanel';
import { RequestsFeed } from '../../components/requests/RequestsFeed';
import { SiteImage } from '../../components/SiteImage';
import { EXPLORE_PHOTOS } from '../../lib/images';
import { MobileTabBar } from '../../components/MobileTabBar';

/**
 * The phone's "طلباتي". Chrome only — the list itself, the three independent
 * loads and the loading/error/empty rules are RequestsFeed, shared with the
 * desktop page so the two can no longer disagree about what a customer owns.
 */

// See MyRequests.tsx — one implementation, re-exported from both entry points.
export { humanMessage } from '../../lib/bookingSummary';

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
const mobileCopy: Record<string, { back: string }> = {
  en: { back: 'Back' },
  ar: { back: 'رجوع' },
  fa: { back: 'بازگشت' },
  ru: { back: 'Назад' },
};

function MobileMyRequestsInner() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.en;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className="pb-[calc(env(safe-area-inset-bottom)+88px)]">
        {/* ── Sub-screen header: real photo behind heavy navy overlay ── */}
        <header className="relative animate-fade-in overflow-hidden rounded-b-[28px] px-5 pb-6 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          {/* SiteImage's root is already `relative` — position it with a wrapper. */}
          <div className="absolute inset-0">
            <SiteImage src={EXPLORE_PHOTOS['/referrals']} alt="" className="h-full w-full" />
          </div>
          <div className="absolute inset-0 bg-navy/85" aria-hidden />
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
            <BackArrow className="h-6 w-6" />
          </button>
          <div className="animate-fade-up relative mt-3.5">
            <h1 className="text-2xl font-extrabold text-white">{t('requests.title')}</h1>
            <p className="mt-1 text-[13.5px] leading-snug text-white/70">{t('requests.subtitle')}</p>
          </div>
        </header>

        <div className="px-5 pt-5">
          <RequestsFeed
            compact
            loading={<RafiqLoader size="sm" className="min-h-[50vh]" />}
            empty={
              <div className="card animate-pop p-10 text-center">
                <div className="icon-chip mx-auto">
                  <AppIcon name="inbox" className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm text-gray-500">{t('requests.empty')}</p>
                <Link to="/services" className="btn-primary mt-5 flex min-h-[50px] w-full text-[15px]">
                  {t('requests.browseServices')}
                </Link>
              </div>
            }
          />

          <MedicalRequestsPanel />
        </div>
      </div>

      <MobileTabBar />
    </div>
  );
}

export function MobileMyRequests() {
  return (
    <RequireAuth>
      <MobileMyRequestsInner />
    </RequireAuth>
  );
}
