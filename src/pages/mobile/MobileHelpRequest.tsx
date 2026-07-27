import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { AppIcon, DirArrow } from '../../components/AppIcon';
import { AdvisorScene } from '../../components/AdvisorScene';
import { BookingModal } from '../../components/BookingModal';
import { MobileTabBar } from '../../components/MobileTabBar';

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
const mobileCopy: Record<string, { back: string; home: string; chat: string; map: string; services: string; profile: string }> = {
  en: { back: 'Back', home: 'Home', chat: 'AI Chat', map: 'Map', services: 'Services', profile: 'Profile' },
  ar: { back: 'رجوع', home: 'الرئيسية', chat: 'المساعد', map: 'الخريطة', services: 'الخدمات', profile: 'حسابي' },
  fa: { back: 'بازگشت', home: 'خانه', chat: 'دستیار', map: 'نقشه', services: 'خدمات', profile: 'پروفایل' },
  ru: { back: 'Назад', home: 'Главная', chat: 'ИИ-чат', map: 'Карта', services: 'Услуги', profile: 'Профиль' },
};

/**
 * Mobile "help is on the way" landing reached from every "Help me with this"
 * CTA. Shows the looping advisor scene, then offers three ranked paths.
 */
function MobileHelpRequestInner() {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const topic = params.get('topic') ?? '';
  const [booking, setBooking] = useState(false);

  // internal bookkeeping label sent with the booking — intentionally not translated
  const summary = topic ? `Help request — ${topic}` : 'Help request';

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.en;

  const wantHelp = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    setBooking(true);
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className="pb-[calc(env(safe-area-inset-bottom)+88px)]">
        {/* ── Standard content-page header (back button only — hero copy lives below) ── */}
        <header className="relative overflow-hidden rounded-b-[28px] bg-navy px-5 pb-5 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
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
        </header>

        <main className="px-5 pt-6">
          {/* ── Hero copy (centered, big-friendly-moment) ── */}
          <div className="animate-fade-up text-center">
            <span className="eyebrow">{t('help.eyebrow')}</span>
            <h1 className="section-title mt-2 text-balance">{t('help.title')}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-navy/70 text-pretty">{t('help.body')}</p>
          </div>

          {/* ── Three ranked CTAs, stacked full-width ── */}
          <div className="animate-fade-up mt-6 flex flex-col gap-3">
            <button onClick={() => navigate('/services')} className="btn-secondary btn-lg min-h-[54px] w-full text-[15px]">
              <AppIcon name="file-text" className="h-5 w-5 shrink-0" />
              {t('help.selfGuide')}
            </button>
            <button onClick={() => navigate('/premium')} className="btn-primary btn-lg min-h-[54px] w-full text-[15px]">
              <AppIcon name="message-circle" className="h-5 w-5 shrink-0" />
              {t('help.askAi')}
            </button>
            <button onClick={wantHelp} className="btn-gold btn-lg min-h-[54px] w-full text-[15px]">
              <AppIcon name="users" className="h-5 w-5 shrink-0" />
              {t('help.yes')}
              <DirArrow className="h-4 w-4 shrink-0" />
            </button>
          </div>
          <p className="mt-4 text-center text-xs text-navy/50">{t('help.note')}</p>

          {/* ── Advisor scene ── */}
          <div className="animate-fade-in mt-7 flex flex-col items-center">
            <AdvisorScene />
            <p className="mt-3 text-center text-sm text-navy/60">{t('help.sceneCaption')}</p>
          </div>
        </main>
      </div>

      <MobileTabBar />

      {booking && <BookingModal problemSummary={summary} transcript={[]} onClose={() => setBooking(false)} />}
    </div>
  );
}

export function MobileHelpRequest() {
  return <MobileHelpRequestInner />;
}
