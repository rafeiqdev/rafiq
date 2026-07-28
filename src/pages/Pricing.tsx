import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { subscriptions } from '../lib/api';
import { PLAN_PRICES } from '../lib/types';
import type { Billing, PlanTier } from '../lib/types';
import { Modal } from '../components/Modal';
import { Check, Gift } from 'lucide-react';
import { usePageMeta } from '../lib/seo';

const TIERS: Exclude<PlanTier, 'free'>[] = ['light', 'pro', 'elite'];
const ORDER: Record<PlanTier, number> = { free: 0, light: 1, pro: 2, elite: 3 };
const CANCEL_REASONS = ['tooExpensive', 'notUsing', 'missingFeatures', 'movedAway', 'other'] as const;

export function Pricing() {
  const { t, i18n } = useTranslation();
  const { user, tier, subscription, refresh } = useApp();
  const navigate = useNavigate();
  const [billing, setBilling] = useState<Billing>('monthly');
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState<string>('tooExpensive');
  const [comment, setComment] = useState('');
  const [cancelDone, setCancelDone] = useState(false);

  usePageMeta({
    title: `${t('pricing.title')} — ${t('common.appName')}`,
    description: t('pricing.subtitle'),
  });

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-extrabold text-navy text-center">{t('pricing.title')}</h1>
      <p className="mt-2 text-navy/60 text-center">{t('pricing.subtitle')}</p>

      {/* active subscription dashboard */}
      {subscription && tier !== 'free' && (
        <div className="card p-6 mt-8 max-w-xl mx-auto">
          <h2 className="font-extrabold text-navy">{t('pricing.active.title')}</h2>
          <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm text-gray-500">
                {t('pricing.active.plan')}: <span className="font-bold text-navy">{t(`pricing.${tier}.name`)}</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {t('pricing.active.renews', {
                  date: new Date(subscription.expiresAt).toLocaleDateString(i18n.language),
                })}
              </p>
            </div>
            <span className="rounded-full bg-brand-blue text-navy text-sm font-bold px-4 py-2">
              {t('pricing.active.daysRemaining', { count: daysRemaining })}
            </span>
          </div>
          {subscription.status === 'cancelled' || cancelDone ? (
            <div className="amber-note mt-4">{t('pricing.cancelFlow.done')}</div>
          ) : (
            <button onClick={() => setCancelling(true)} className="btn-secondary mt-4 text-brand-red">
              {t('pricing.active.cancelBtn')}
            </button>
          )}
        </div>
      )}

      {/* billing toggle */}
      <div className="mt-10 flex flex-col items-center gap-2">
        <div className="inline-flex rounded-xl bg-white border border-cream-dark p-1">
          {(['monthly', 'annual'] as Billing[]).map((b) => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className={`px-5 h-9 rounded-lg text-sm font-semibold transition-colors ${
                billing === b ? 'bg-navy text-white' : 'text-navy/85 hover:text-navy'
              }`}
            >
              {t(`common.${b}`)}
            </button>
          ))}
        </div>
        {billing === 'annual' && (
          <p className="text-xs font-semibold text-green-700 flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5" strokeWidth={1.8} aria-hidden />
            {t('pricing.annualNote')}
          </p>
        )}
      </div>

      {/* plans */}
      <div className="mt-8 grid gap-5 md:grid-cols-3 items-stretch">
        {TIERS.map((plan) => {
          const monthly = PLAN_PRICES[plan];
          const price = billing === 'annual' ? Math.round((monthly * 10) / 12) : monthly;
          const isCurrent = ORDER[tier] === ORDER[plan];
          const isUpgrade = ORDER[plan] > ORDER[tier];
          const recommended = plan === 'pro';
          const features = t(`pricing.${plan}.features`, { returnObjects: true }) as string[];
          return (
            <div
              key={plan}
              className={`card card-hover flex flex-col p-6 relative ${recommended ? 'ring-2 ring-navy border-navy' : ''}`}
            >
              {recommended && (
                <span className="absolute -top-3 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 rounded-full bg-brand-red text-white text-xs font-bold px-3 py-1">
                  {t('common.recommended')}
                </span>
              )}
              <h3 className="text-lg font-extrabold text-navy">{t(`pricing.${plan}.name`)}</h3>
              <p className="text-sm text-gray-500">{t(`pricing.${plan}.desc`)}</p>
              <p className="mt-4">
                <span className="text-3xl font-extrabold text-navy" dir="ltr">
                  {price.toLocaleString()} {t('common.tl')}
                </span>
                <span className="text-sm text-gray-500"> {t('common.perMonth')}</span>
                {billing === 'annual' && (
                  <span className="block mt-1 text-xs font-semibold text-navy/70" dir="ltr">
                    {t('checkout.perYear', { price: (monthly * 10).toLocaleString() })}
                  </span>
                )}
              </p>
              <ul className="mt-4 flex flex-col gap-2 text-sm text-navy/80 flex-1">
                {features.map((f) => (
                  <li key={f} className="flex gap-2 items-start">
                    <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" strokeWidth={2} aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => choose(plan)}
                disabled={isCurrent}
                className={`w-full mt-6 ${recommended ? 'btn-primary' : 'btn-secondary'} ${isCurrent ? 'opacity-50 cursor-default' : ''}`}
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

      {/* cancel flow modal */}
      {cancelling && (
        <Modal onClose={() => setCancelling(false)} labelId="cancel-title">
          <div className="card p-6 w-full">
            <h2 id="cancel-title" className="text-lg font-extrabold text-navy">{t('pricing.cancelFlow.title')}</h2>
            <p className="mt-3 text-sm font-semibold text-navy/70">{t('pricing.cancelFlow.reasonLabel')}</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {CANCEL_REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm text-navy cursor-pointer">
                  <input type="radio" name="cancelReason" checked={reason === r} onChange={() => setReason(r)} />
                  {t(`pricing.cancelFlow.${r}`)}
                </label>
              ))}
            </div>
            <textarea
              className="input mt-4 h-20 py-2"
              placeholder={t('pricing.cancelFlow.comments')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="mt-4 flex gap-3">
              <button onClick={() => setCancelling(false)} className="btn-primary flex-1">
                {t('pricing.cancelFlow.keep')}
              </button>
              <button onClick={confirmCancel} className="btn-danger flex-1">
                {t('pricing.cancelFlow.confirm')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
