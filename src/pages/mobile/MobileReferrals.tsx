import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { referrals } from '../../lib/api';
import type { ReferralStats } from '../../lib/api';
import { RequireAuth } from '../../components/Gates';
import { AppIcon } from '../../components/AppIcon';
import { MobileTabBar } from '../../components/MobileTabBar';

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
const mobileCopy: Record<string, { back: string; home: string; chat: string; map: string; services: string; profile: string }> = {
  en: { back: 'Back', home: 'Home', chat: 'AI Chat', map: 'Map', services: 'Services', profile: 'Profile' },
  ar: { back: 'رجوع', home: 'الرئيسية', chat: 'المساعد', map: 'الخريطة', services: 'الخدمات', profile: 'حسابي' },
  fa: { back: 'بازگشت', home: 'خانه', chat: 'دستیار', map: 'نقشه', services: 'خدمات', profile: 'پروفایل' },
  ru: { back: 'Назад', home: 'Главная', chat: 'ИИ-чат', map: 'Карта', services: 'Услуги', profile: 'Профиль' },
};

function MobileReferralsInner() {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState<ReferralStats>({ clicks: 0, signups: 0, earnedTl: 0, code: '' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) referrals.stats().then(setStats).catch(() => {});
  }, [user]);

  const link = `${window.location.origin}/r/${stats.code || user?.referralCode || ''}`;

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.en;

  const tiles = [
    ['invited', stats.clicks],
    ['signedUp', stats.signups],
    ['earned', `${stats.earnedTl.toLocaleString()} ${t('common.tl')}`],
  ] as const;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className="pb-[calc(env(safe-area-inset-bottom)+88px)]">
        {/* ── Standard content-page header ── */}
        <header className="relative overflow-hidden rounded-b-[28px] bg-navy px-5 pb-[26px] pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <span
            aria-hidden="true"
            className="pointer-events-none select-none absolute -bottom-[52px] -end-3.5 text-[10rem] font-bold leading-none text-white/5"
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
          <div className="relative mt-3.5 animate-fade-up">
            <h1 className="text-[25px] font-extrabold leading-tight text-white">{t('referrals.title')}</h1>
            <p className="mt-1.5 text-sm leading-snug text-white/70">{t('referrals.subtitle')}</p>
          </div>
        </header>

        <div className="flex flex-col gap-4 px-5 pt-5">
          {/* ── Link + stats card ── */}
          <section className="card animate-fade-up p-5">
            <p className="text-xs font-bold text-navy/70">{t('referrals.yourLink')}</p>
            <code
              dir="ltr"
              className="mt-2 flex h-12 items-center overflow-x-auto whitespace-nowrap rounded-btn border border-cream-dark bg-cream px-3.5 font-mono text-[13px] text-navy [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {link}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className={`mt-2.5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-btn text-[14.5px] font-bold text-white transition-colors ${
                copied ? 'bg-green-700' : 'bg-navy'
              }`}
            >
              {copied ? t('common.copied') : t('common.copy')}
            </button>

            <div className="mt-5 grid grid-cols-3 gap-2.5 text-center">
              {tiles.map(([k, v]) => (
                <div key={k} className="min-w-0 rounded-xl bg-cream px-2 py-4">
                  <p className="break-words text-xl font-extrabold text-navy" dir="ltr">
                    {v}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-tight text-navy/60">{t(`referrals.${k}`)}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── How it works ── */}
          <section className="card animate-fade-up p-5">
            <h2 className="text-[15px] font-extrabold text-navy">{t('referrals.how.title')}</h2>
            <ol className="mt-4 flex flex-col gap-3.5">
              {(['step1', 'step2', 'step3'] as const).map((s, i) => (
                <li key={s} className="flex items-start gap-3">
                  <span className="icon-chip !h-8 !w-8 text-[13px] font-extrabold">{i + 1}</span>
                  <p className="pt-1.5 text-[13.5px] leading-snug text-navy/80">{t(`referrals.how.${s}`)}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* ── Terms ── */}
          <section className="card animate-fade-up p-5">
            <h2 className="text-[15px] font-extrabold text-navy">{t('referrals.terms.title')}</h2>
            <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-navy/70">{t('referrals.terms.body')}</p>
          </section>
        </div>
      </div>

      <MobileTabBar />
    </div>
  );
}

export function MobileReferrals() {
  return (
    <RequireAuth>
      <MobileReferralsInner />
    </RequireAuth>
  );
}
