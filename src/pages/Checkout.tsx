import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { ApiError, checkout } from '../lib/api';
import type { CheckoutConfig } from '../lib/api';
import { PLAN_PRICES } from '../lib/types';
import type { Billing, PayMethod, PlanTier } from '../lib/types';
import { RequireAuth } from '../components/Gates';
import { Modal } from '../components/Modal';
import { AppIcon } from '../components/AppIcon';
import { track } from '../lib/analytics';

function CopyField({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-navy/70">{label}</p>
      <div className="mt-1 flex gap-2">
        <code dir="ltr" className="flex-1 min-w-0 input flex items-center text-xs overflow-x-auto">{value}</code>
        <button
          className="btn-secondary px-3 shrink-0"
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? t('common.copied') : t('common.copy')}
        </button>
      </div>
    </div>
  );
}

type PageState = 'idle' | 'redirecting' | 'pendingManual' | 'checking' | 'success' | 'failed';

function CheckoutInner() {
  const { t } = useTranslation();
  const { refresh } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const plan = (params.get('plan') ?? 'pro') as Exclude<PlanTier, 'free'>;
  const billing = (params.get('billing') ?? 'monthly') as Billing;

  const [tab, setTab] = useState<PayMethod>('card');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [state, setState] = useState<PageState>('idle');
  // Which copy the 'failed' card shows. The default says "no charge was made",
  // which would be a lie when the payment went through and only the receipt
  // upload failed.
  const [failKey, setFailKey] = useState('checkout.result.failed');
  const [bank, setBank] = useState<CheckoutConfig | null>(null);

  // Only rails with real details on file may be offered. Until the config
  // loads, nothing manual is shown — better a card-only page for a moment than
  // a placeholder IBAN presented as somewhere to send money. Memoised because
  // the fallback effect below depends on identity, not just contents.
  const methods = useMemo<PayMethod[]>(
    () => [
      'card',
      ...(bank?.bankConfigured ? (['bank'] as PayMethod[]) : []),
      ...(bank?.cryptoConfigured ? (['crypto'] as PayMethod[]) : []),
    ],
    [bank?.bankConfigured, bank?.cryptoConfigured],
  );

  const monthly = PLAN_PRICES[plan] ?? PLAN_PRICES.pro;
  const total = billing === 'annual' ? monthly * 10 : monthly;
  const fmt = (n: number) => n.toLocaleString();

  // bank/crypto details come from server config — nothing hardcoded client-side
  useEffect(() => {
    checkout.config().then(setBank).catch(() => {});
  }, []);

  useEffect(() => {
    track('checkout_opened', { target: plan, meta: { billing } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the selected rail turns out to be unconfigured, fall back to card rather
  // than leaving the customer on a tab whose panel has nothing to show.
  useEffect(() => {
    if (!methods.includes(tab)) setTab('card');
  }, [methods, tab]);

  // returning from the payment gateway: ?result=success|failed&payment=ID
  useEffect(() => {
    const result = params.get('result');
    const paymentId = params.get('payment');
    if (!result || !paymentId) return;
    if (result === 'failed') {
      setState('failed');
      return;
    }
    setState('checking');
    let tries = 0;
    const poll = async () => {
      tries += 1;
      try {
        const p = await checkout.paymentStatus(paymentId);
        if (p.status === 'verified') {
          await refresh();
          setState('success');
          return;
        }
        if (p.status === 'rejected') {
          setState('failed');
          return;
        }
      } catch {
        /* keep polling */
      }
      if (tries < 10) setTimeout(poll, 1500);
      else setState('pendingManual');
    };
    poll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No live card gateway yet: a card request is recorded as PENDING and only the
  // admin can activate it (admin_resolve_payment) — never auto-granted.
  const payByCard = async () => {
    setState('redirecting');
    try {
      await checkout.manual(plan, billing, 'card');
      track('payment_submitted', { target: 'card', meta: { tier: plan, billing } });
      await refresh();
      setState('pendingManual');
    } catch {
      setState('failed');
    }
  };

  const confirmManualPaid = async () => {
    try {
      await checkout.manual(plan, billing, tab, receipt ?? undefined);
      track('payment_submitted', { target: tab, meta: { tier: plan, billing } });
      await refresh();
      setVerifyOpen(false);
      setState('pendingManual');
    } catch (e) {
      setFailKey(
        e instanceof ApiError && e.code === 'receipt_upload_failed'
          ? 'checkout.result.receiptFailed'
          : 'checkout.result.failed',
      );
      setVerifyOpen(false);
      setState('failed');
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-extrabold text-navy">{t('checkout.title')}</h1>

      {/* order summary */}
      <div className="card p-5 mt-6">
        <h2 className="font-bold text-navy">{t('checkout.summary')}</h2>
        <dl className="mt-3 text-sm flex flex-col gap-2">
          <div className="flex justify-between">
            <dt className="text-gray-500">{t('checkout.plan')}</dt>
            <dd className="font-semibold text-navy">{t(`pricing.${plan}.name`)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">{t('checkout.billing')}</dt>
            <dd className="font-semibold text-navy">{t(`common.${billing}`)}</dd>
          </div>
          <div className="flex justify-between border-t border-cream-dark pt-2">
            <dt className="font-bold text-navy">{t('checkout.total')}</dt>
            <dd className="text-end">
              <span className="font-extrabold text-navy" dir="ltr">
                {billing === 'annual' ? t('checkout.perYear', { price: fmt(total) }) : `${fmt(total)} ${t('common.tl')}`}
              </span>
              {billing === 'annual' && (
                <span className="block text-xs text-gray-500" dir="ltr">
                  {t('checkout.approxMonthly', { price: fmt(Math.round(total / 12)) })}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      {state === 'success' && (
        <div className="card p-8 mt-6 text-center">
          <div className="icon-chip mx-auto">
            <AppIcon name="check-circle" className="w-6 h-6" />
          </div>
          <p className="mt-4 font-semibold text-navy">{t('checkout.success')}</p>
          <button onClick={() => navigate('/')} className="btn-primary mt-6">
            {t('nav.home')}
          </button>
        </div>
      )}

      {state === 'checking' && (
        <div className="card p-8 mt-6 text-center">
          <div className="icon-chip mx-auto animate-pulse">
            <AppIcon name="hourglass" className="w-6 h-6" />
          </div>
          <p className="mt-4 font-semibold text-navy">{t('checkout.result.checking')}</p>
        </div>
      )}

      {state === 'pendingManual' && (
        <div className="card p-8 mt-6 text-center">
          <div className="icon-chip mx-auto">
            <AppIcon name="hourglass" className="w-6 h-6" />
          </div>
          <p className="mt-4 font-semibold text-navy">{t('checkout.pending')}</p>
          <button onClick={() => navigate('/')} className="btn-primary mt-6">
            {t('nav.home')}
          </button>
        </div>
      )}

      {state === 'failed' && (
        <div className="card p-8 mt-6 text-center">
          <div className="icon-chip mx-auto">
            <AppIcon name="x-circle" className="w-6 h-6" />
          </div>
          <p className="mt-4 font-semibold text-navy">{t(failKey)}</p>
          <button onClick={() => setState('idle')} className="btn-primary mt-6">
            {t('chat.retry')}
          </button>
        </div>
      )}

      {(state === 'idle' || state === 'redirecting') && (
        <div className="card mt-6 overflow-hidden">
          {/* payment tabs */}
          <div className="flex border-b border-cream-dark" role="tablist">
            {methods.map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={tab === m}
                onClick={() => setTab(m)}
                className={`flex-1 min-w-0 h-12 text-xs sm:text-sm font-semibold transition-colors ${
                  tab === m ? 'bg-brand-blue text-navy border-b-2 border-navy' : 'text-navy/70 hover:text-navy'
                }`}
              >
                {t(`checkout.tabs.${m}`)}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === 'card' && (
              <div>
                <p className="text-sm text-gray-500">{t('checkout.card.note')}</p>
                <button onClick={payByCard} disabled={state === 'redirecting'} className="btn-primary w-full mt-5 disabled:opacity-60">
                  <AppIcon name="credit-card" className="w-4 h-4" />
                  {t('checkout.card.pay')}
                </button>
              </div>
            )}

            {tab === 'bank' && (
              <div>
                <h3 className="font-bold text-navy text-sm">{t('checkout.bank.title')}</h3>
                <CopyField label={t('checkout.bank.iban')} value={bank?.iban ?? '…'} />
                <CopyField label={t('checkout.bank.holder')} value={bank?.holder ?? '…'} />
                <label className="btn-secondary w-full mt-4 cursor-pointer flex items-center min-w-0">
                  <AppIcon name="paperclip" className="w-4 h-4 shrink-0" />
                  {receipt ? <span className="truncate min-w-0">{`${t('checkout.bank.uploaded')}: ${receipt.name}`}</span> : t('checkout.bank.upload')}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
                  />
                </label>
                <button onClick={() => setVerifyOpen(true)} className="btn-primary w-full mt-3">
                  {t('checkout.paid')}
                </button>
              </div>
            )}

            {tab === 'crypto' && (
              <div>
                <h3 className="font-bold text-navy text-sm">{t('checkout.crypto.title')}</h3>
                <CopyField label={`${t('checkout.crypto.network')} — ${bank?.network ?? '…'}`} value={bank?.wallet ?? '…'} />
                <button onClick={() => setVerifyOpen(true)} className="btn-primary w-full mt-4">
                  {t('checkout.paid')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {verifyOpen && (
        <Modal onClose={() => setVerifyOpen(false)} labelId="verify-title" maxWidth="max-w-sm">
          <div className="card p-6 text-center">
            <div className="icon-chip mx-auto">
              <AppIcon name="shield-check" className="w-6 h-6" />
            </div>
            <h2 id="verify-title" className="mt-3 text-lg font-extrabold text-navy">
              {t('checkout.verify.title')}
            </h2>
            <p className="mt-2 text-sm text-gray-500">{t('checkout.verify.body')}</p>
            <div className="mt-5 flex flex-col gap-2">
              <button onClick={confirmManualPaid} className="btn-primary w-full">
                {t('checkout.verify.confirm')}
              </button>
              <button onClick={() => setVerifyOpen(false)} className="btn-secondary w-full">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function Checkout() {
  return (
    <RequireAuth>
      <CheckoutInner />
    </RequireAuth>
  );
}
