import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../../components/AppIcon';
import { Modal } from '../../components/Modal';
import { useApp } from '../../context/AppContext';
import { subscriptions } from '../../lib/api';
import { PLAN_PRICES } from '../../lib/types';
import type { Billing, PlanTier } from '../../lib/types';
import { usePageMeta } from '../../lib/seo';

const TIERS: Exclude<PlanTier, 'free'>[] = ['light', 'pro', 'elite'];
const ORDER: Record<PlanTier, number> = { free: 0, light: 1, pro: 2, elite: 3 };
const CANCEL_REASONS = ['tooExpensive', 'notUsing', 'missingFeatures', 'movedAway', 'other'] as const;

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
type MobileCopy = {
  back: string;
  tabHome: string;
  tabChat: string;
  tabMap: string;
  tabServices: string;
  tabProfile: string;
};

const mobileCopy: Record<string, MobileCopy> = {
  en: { back: 'Back', tabHome: 'Home', tabChat: 'AI Chat', tabMap: 'Map', tabServices: 'Services', tabProfile: 'Profile' },
  ar: { back: 'رجوع', tabHome: 'الرئيسية', tabChat: 'المساعد', tabMap: 'الخريطة', tabServices: 'الخدمات', tabProfile: 'حسابي' },
  fa: { back: 'بازگشت', tabHome: 'خانه', tabChat: 'دستیار', tabMap: 'نقشه', tabServices: 'خدمات', tabProfile: 'پروفایل' },
  ru: { back: 'Назад', tabHome: 'Главная', tabChat: 'ИИ-чат', tabMap: 'Карта', tabServices: 'Услуги', tabProfile: 'Профиль' },
};

export function MobilePricing() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, tier, subscription, refresh } = useApp();

  // ----- state (mirrors desktop Pricing.tsx exactly) -----
  const [billing, setBilling] = useState<Billing>('monthly');
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState<string>('tooExpensive');
  const [comment, setComment] = useState('');
  const [cancelDone, setCancelDone] = useState(false);

  usePageMeta({
    title: `${t('pricing.title')} — ${t('common.appName')}`,
    description: t('pricing.subtitle'),
  });

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.en;

  const choose = (plan: Exclude<PlanTier, 'free'>) => {
    navigate(`/checkout?plan=${plan}&billing=${billing}`);
  };

  const confirmCancel = async () => {
    if (!user) return;
    await subscriptions.cancel(reason, comment);
    await refresh();
    setCancelling(false);
    setCancelDone(true);
  };

  const daysRemaining = subscription
    ? Math.max(0, Math.ceil((new Date(subscription.expiresAt).getTime() - Date.now()) / 86400000))
    : 0;

  // ----- bottom tab bar (verbatim from MobileHome.tsx — none active on /pricing) -----
  const tabs = [
    { to: '/', icon: 'home', label: mc.tabHome },
    { to: '/premium', icon: 'message-circle', label: mc.tabChat },
    { to: '/map', icon: 'map', label: mc.tabMap },
    { to: '/services', icon: 'layers', label: mc.tabServices },
    { to: user ? '/profile' : '/auth', icon: 'user', label: mc.tabProfile },
  ] as const;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      {/* clears the fixed tab bar */}
      <div className="pb-[calc(env(safe-area-inset-bottom)+88px)]">
        {/* ================= STANDARD CONTENT-PAGE HEADER ================= */}
        <header className="relative overflow-hidden rounded-b-[28px] bg-navy px-5 pb-8 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <span
            aria-hidden="true"
            className="pointer-events-none select-none absolute -bottom-14 -end-4 text-[11.5rem] font-bold leading-none text-white/5"
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
          <div className="relative mt-4 animate-fade-up">
            <h1 className="text-[26px] font-extrabold leading-tight text-white">{t('pricing.title')}</h1>
            <p className="mt-1.5 text-[15px] leading-relaxed text-white/70">{t('pricing.subtitle')}</p>
          </div>
        </header>

        {/* ================= ACTIVE SUBSCRIPTION ================= */}
        {subscription && tier !== 'free' && (
          <section className="card animate-fade-up mx-5 mt-5 p-5">
            <h2 className="text-[16px] font-extrabold text-navy">{t('pricing.active.title')}</h2>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] text-gray-500">
                  {t('pricing.active.plan')}:{' '}
                  <span className="font-bold text-navy">{t(`pricing.${tier}.name`)}</span>
                </p>
                <p className="mt-1 text-[13px] text-gray-500">
                  {t('pricing.active.renews', {
                    date: new Date(subscription.expiresAt).toLocaleDateString(i18n.language),
                  })}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-brand-blue px-3.5 py-2 text-[13px] font-bold text-navy">
                {t('pricing.active.daysRemaining', { count: daysRemaining })}
              </span>
            </div>
            {subscription.status === 'cancelled' || cancelDone ? (
              <div className="amber-note mt-4">{t('pricing.cancelFlow.done')}</div>
            ) : (
              <button
                type="button"
                onClick={() => setCancelling(true)}
                className="btn-secondary mt-4 min-h-[48px] w-full text-brand-red"
              >
                {t('pricing.active.cancelBtn')}
              </button>
            )}
          </section>
        )}

        {/* ================= BILLING TOGGLE (MobileAuth segmented pattern) ================= */}
        <div className="mx-5 mt-6">
          <div role="tablist" className="flex gap-1 rounded-btn bg-cream-dark p-1">
            {(['monthly', 'annual'] as Billing[]).map((b) => (
              <button
                key={b}
                type="button"
                role="tab"
                aria-selected={billing === b}
                onClick={() => setBilling(b)}
                className={`h-[46px] flex-1 rounded-[9px] text-[15px] font-bold transition-all ${
                  billing === b ? 'bg-white text-navy shadow-sm' : 'text-navy/50'
                }`}
              >
                {t(`common.${b}`)}
              </button>
            ))}
          </div>
          {billing === 'annual' && (
            <p className="animate-pop mt-2.5 flex items-center gap-1.5 px-0.5 text-[13px] font-semibold text-green-700">
              <AppIcon name="gift" className="h-4 w-4 shrink-0" />
              {t('pricing.annualNote')}
            </p>
          )}
        </div>

        {/* ================= PLAN CARDS (stacked, full width) ================= */}
        <div className="stagger mx-5 mt-5 flex flex-col gap-4">
          {TIERS.map((plan, i) => {
            const monthly = PLAN_PRICES[plan];
            const price = billing === 'annual' ? Math.round((monthly * 10) / 12) : monthly;
            const isCurrent = ORDER[tier] === ORDER[plan];
            const isUpgrade = ORDER[plan] > ORDER[tier];
            const recommended = plan === 'pro';
            const features = t(`pricing.${plan}.features`, { returnObjects: true }) as string[];
            return (
              <div
                key={plan}
                style={{ '--i': i } as CSSProperties}
                className={`card relative flex flex-col p-5 ${recommended ? 'border-navy ring-2 ring-navy' : ''}`}
              >
                {recommended && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-red px-3 py-1 text-xs font-bold text-white">
                    {t('common.recommended')}
                  </span>
                )}
                <h3 className="text-lg font-extrabold text-navy">{t(`pricing.${plan}.name`)}</h3>
                <p className="text-sm text-gray-500">{t(`pricing.${plan}.desc`)}</p>
                <p className="mt-3.5">
                  <span className="text-3xl font-extrabold text-navy" dir="ltr">
                    {price.toLocaleString()} {t('common.tl')}
                  </span>
                  <span className="text-sm text-gray-500"> {t('common.perMonth')}</span>
                  {billing === 'annual' && (
                    <span className="mt-1 block text-xs font-semibold text-navy/70" dir="ltr">
                      {t('checkout.perYear', { price: (monthly * 10).toLocaleString() })}
                    </span>
                  )}
                </p>
                <ul className="mt-4 flex flex-col gap-2.5 text-[14px] text-navy/80">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <AppIcon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => choose(plan)}
                  disabled={isCurrent}
                  className={`mt-5 min-h-[52px] w-full ${recommended ? 'btn-primary' : 'btn-secondary'} ${
                    isCurrent ? 'cursor-default opacity-50' : ''
                  }`}
                >
                  {isCurrent
                    ? t('pricing.current')
                    : isUpgrade
                      ? t('pricing.upgrade', { plan: t(`pricing.${plan}.name`) })
                      : t('pricing.downgrade', { plan: t(`pricing.${plan}.name`) })}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= CANCEL FLOW MODAL (touch-sized contents) ================= */}
      {cancelling && (
        <Modal onClose={() => setCancelling(false)} labelId="cancel-title">
          <div className="card w-full p-5">
            <h2 id="cancel-title" className="pe-8 text-lg font-extrabold text-navy">
              {t('pricing.cancelFlow.title')}
            </h2>
            <p className="mt-3 text-sm font-semibold text-navy/70">{t('pricing.cancelFlow.reasonLabel')}</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {CANCEL_REASONS.map((r) => {
                const selected = reason === r;
                return (
                  <label
                    key={r}
                    className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-btn border px-3 text-[14.5px] text-navy transition-colors ${
                      selected ? 'border-navy bg-brand-blue font-semibold' : 'border-cream-dark'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancelReason"
                      checked={selected}
                      onChange={() => setReason(r)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={`h-[22px] w-[22px] shrink-0 rounded-full bg-white ${
                        selected ? 'border-[6.5px] border-navy' : 'border border-navy/30'
                      }`}
                    />
                    {t(`pricing.cancelFlow.${r}`)}
                  </label>
                );
              })}
            </div>
            <textarea
              className="input mt-4 h-24 py-2.5"
              placeholder={t('pricing.cancelFlow.comments')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="mt-4 flex flex-col gap-2.5">
              <button type="button" onClick={() => setCancelling(false)} className="btn-primary min-h-[52px] w-full">
                {t('pricing.cancelFlow.keep')}
              </button>
              <button type="button" onClick={confirmCancel} className="btn-danger min-h-[52px] w-full">
                {t('pricing.cancelFlow.confirm')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ================= BOTTOM TAB BAR — copied verbatim from MobileHome.tsx ================= */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-cream-dark pb-[env(safe-area-inset-bottom,0px)]">
        <div className="grid grid-cols-5">
          {tabs.map((tab) => {
            const active =
              tab.to === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.icon}
                to={tab.to}
                className={`flex flex-col items-center justify-center gap-1 min-h-[56px] pt-2 pb-1.5 ${
                  active ? 'text-navy' : 'text-navy/40'
                }`}
              >
                <AppIcon name={tab.icon} className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-none">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
