import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { checkout } from '../../lib/api';
import { PLAN_PRICES } from '../../lib/types';
import type { Billing, PayMethod, PlanTier } from '../../lib/types';
import { RequireAuth } from '../../components/Gates';
import { Modal } from '../../components/Modal';
import { AppIcon } from '../../components/AppIcon';

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
const mobileCopy: Record<string, { back: string; methods: string; sending: string }> = {
  en: { back: 'Back', methods: 'Payment method', sending: 'Sending your request…' },
  ar: { back: 'رجوع', methods: 'طريقة الدفع', sending: 'جارٍ إرسال طلبك…' },
  fa: { back: 'بازگشت', methods: 'روش پرداخت', sending: 'در حال ارسال درخواست…' },
  ru: { back: 'Назад', methods: 'Способ оплаты', sending: 'Отправляем запрос…' },
};

type PageState = 'idle' | 'redirecting' | 'pendingManual' | 'checking' | 'success' | 'failed';

/** Touch-sized copy-to-clipboard field (mobile take on desktop CopyField). */
function CopyField({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3.5">
      <p className="text-[13px] font-bold text-navy">{label}</p>
      <div className="mt-1.5 flex gap-2">
        <code
          dir="ltr"
          className="input h-auto min-h-[48px] min-w-0 flex-1 items-center overflow-x-auto whitespace-nowrap py-2 font-mono text-[12.5px] flex"
        >
          {value}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="btn-secondary min-h-[48px] shrink-0 px-4 text-[13px]"
        >
          {copied ? t('common.copied') : t('common.copy')}
        </button>
      </div>
    </div>
  );
}

function MobileCheckoutInner() {
  const { t, i18n } = useTranslation();
  const { refresh } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const plan = (params.get('plan') ?? 'pro') as Exclude<PlanTier, 'free'>;
  const billing = (params.get('billing') ?? 'monthly') as Billing;

  const [tab, setTab] = useState<PayMethod>('card');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [state, setState] = useState<PageState>('idle');
  const [bank, setBank] = useState<{ iban: string; holder: string; wallet: string; network: string } | null>(null);

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.en;

  const monthly = PLAN_PRICES[plan] ?? PLAN_PRICES.pro;
  const total = billing === 'annual' ? monthly * 10 : monthly;
  const fmt = (n: number) => n.toLocaleString();

  // bank/crypto details come from server config — nothing hardcoded client-side
  useEffect(() => {
    checkout.config().then(setBank).catch(() => {});
  }, []);

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
      await refresh();
      setState('pendingManual');
    } catch {
      setState('failed');
    }
  };

  const confirmManualPaid = async () => {
    try {
      await checkout.manual(plan, billing, tab, receipt ?? undefined);
      await refresh();
      setVerifyOpen(false);
      setState('pendingManual');
    } catch {
      setVerifyOpen(false);
      setState('failed');
    }
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="flex min-h-dvh flex-col bg-cream">
      {/* ── Standard content-page header (compact: title inline with back) ── */}
      <header className="relative shrink-0 overflow-hidden rounded-b-[28px] bg-navy px-5 pb-7 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <span
          aria-hidden="true"
          className="pointer-events-none select-none absolute -bottom-14 -end-4 text-[11.5rem] font-bold leading-none text-white/5"
        >
          ر
        </span>
        <div className="relative flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={mc.back}
            className="relative -ms-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors active:bg-white/25"
          >
            <AppIcon name="arrow-left" className={`h-6 w-6 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <h1 className="animate-fade-up text-[22px] font-extrabold leading-tight text-white">
            {t('checkout.title')}
          </h1>
        </div>
      </header>

      <main className="flex flex-1 flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-5">
        {/* ── Order summary — stays visible above the state-dependent area ── */}
        <section className="card animate-fade-up p-5">
          <h2 className="text-[15px] font-extrabold text-navy">{t('checkout.summary')}</h2>
          <dl className="mt-3 flex flex-col gap-2 text-[13.5px]">
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">{t('checkout.plan')}</dt>
              <dd className="font-semibold text-navy">{t(`pricing.${plan}.name`)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">{t('checkout.billing')}</dt>
              <dd className="font-semibold text-navy">{t(`common.${billing}`)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-cream-dark pt-2">
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
        </section>

        {/* ── Result states ── */}
        {state === 'success' && (
          <section className="card animate-pop mt-5 p-7 text-center">
            <div className="icon-chip mx-auto">
              <AppIcon name="check-circle" className="h-6 w-6" />
            </div>
            <p className="mt-4 text-[15px] font-semibold text-navy">{t('checkout.success')}</p>
            <button type="button" onClick={() => navigate('/')} className="btn-primary mt-6 min-h-[52px] w-full text-[15px]">
              {t('nav.home')}
            </button>
          </section>
        )}

        {state === 'checking' && (
          <section className="card animate-pop mt-5 p-7 text-center">
            <div className="icon-chip mx-auto animate-pulse">
              <AppIcon name="hourglass" className="h-6 w-6" />
            </div>
            <p className="mt-4 text-[15px] font-semibold text-navy">{t('checkout.result.checking')}</p>
          </section>
        )}

        {state === 'pendingManual' && (
          <section className="card animate-pop mt-5 p-7 text-center">
            <div className="icon-chip mx-auto">
              <AppIcon name="hourglass" className="h-6 w-6" />
            </div>
            <p className="mt-4 text-[15px] font-semibold leading-relaxed text-navy">{t('checkout.pending')}</p>
            <button type="button" onClick={() => navigate('/')} className="btn-primary mt-6 min-h-[52px] w-full text-[15px]">
              {t('nav.home')}
            </button>
          </section>
        )}

        {state === 'failed' && (
          <section className="card animate-pop mt-5 p-7 text-center">
            <div className="icon-chip mx-auto">
              <AppIcon name="x-circle" className="h-6 w-6" />
            </div>
            <p className="mt-4 text-[15px] font-semibold leading-relaxed text-navy">{t('checkout.result.failed')}</p>
            <button type="button" onClick={() => setState('idle')} className="btn-primary mt-6 min-h-[52px] w-full text-[15px]">
              {t('chat.retry')}
            </button>
          </section>
        )}

        {/* ── Payment method tabs + panel ── */}
        {(state === 'idle' || state === 'redirecting') && (
          <>
            <p className="mt-6 px-1 text-[13px] font-bold text-navy/70">{mc.methods}</p>
            <div role="tablist" aria-label={mc.methods} className="mt-2 flex gap-1 rounded-btn bg-cream-dark p-1">
              {(['card', 'bank', 'crypto'] as PayMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={tab === m}
                  onClick={() => setTab(m)}
                  className={`h-[48px] min-w-0 flex-1 rounded-[9px] px-1 text-[13.5px] font-bold transition-all ${
                    tab === m ? 'bg-white text-navy shadow-sm' : 'text-navy/50'
                  }`}
                >
                  {t(`checkout.tabs.${m}`)}
                </button>
              ))}
            </div>

            <section key={tab} className="card animate-fade-up mt-4 p-5">
              {tab === 'card' && (
                <div>
                  <p className="text-[13.5px] leading-relaxed text-gray-500">{t('checkout.card.note')}</p>
                  <button
                    type="button"
                    onClick={payByCard}
                    disabled={state === 'redirecting'}
                    className="btn-primary mt-5 min-h-[52px] w-full text-[15px] disabled:opacity-60"
                  >
                    <AppIcon name="credit-card" className="h-5 w-5 shrink-0" />
                    {state === 'redirecting' ? mc.sending : t('checkout.card.pay')}
                  </button>
                </div>
              )}

              {tab === 'bank' && (
                <div>
                  <h3 className="text-[15px] font-extrabold text-navy">{t('checkout.bank.title')}</h3>
                  <CopyField label={t('checkout.bank.iban')} value={bank?.iban ?? '…'} />
                  <CopyField label={t('checkout.bank.holder')} value={bank?.holder ?? '…'} />
                  <label className="btn-secondary mt-4 flex min-h-[52px] w-full min-w-0 cursor-pointer items-center justify-center gap-2.5 px-4 text-[13.5px]">
                    <AppIcon name="paperclip" className="h-5 w-5 shrink-0" />
                    {receipt ? (
                      <span className="min-w-0 truncate">{`${t('checkout.bank.uploaded')}: ${receipt.name}`}</span>
                    ) : (
                      t('checkout.bank.upload')
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <button type="button" onClick={() => setVerifyOpen(true)} className="btn-primary mt-3 min-h-[52px] w-full text-[15px]">
                    {t('checkout.paid')}
                  </button>
                </div>
              )}

              {tab === 'crypto' && (
                <div>
                  <h3 className="text-[15px] font-extrabold text-navy">{t('checkout.crypto.title')}</h3>
                  <CopyField label={`${t('checkout.crypto.network')} — ${bank?.network ?? '…'}`} value={bank?.wallet ?? '…'} />
                  <button type="button" onClick={() => setVerifyOpen(true)} className="btn-primary mt-4 min-h-[52px] w-full text-[15px]">
                    {t('checkout.paid')}
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* ── Verify modal (touch-sized contents) ── */}
      {verifyOpen && (
        <Modal onClose={() => setVerifyOpen(false)} labelId="verify-title" maxWidth="max-w-sm">
          <div className="card w-full p-6 text-center">
            <div className="icon-chip mx-auto">
              <AppIcon name="shield-check" className="h-6 w-6" />
            </div>
            <h2 id="verify-title" className="mt-3 text-lg font-extrabold text-navy">
              {t('checkout.verify.title')}
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-gray-500">{t('checkout.verify.body')}</p>
            <div className="mt-5 flex flex-col gap-2.5">
              <button type="button" onClick={confirmManualPaid} className="btn-primary min-h-[52px] w-full text-[15px]">
                {t('checkout.verify.confirm')}
              </button>
              <button type="button" onClick={() => setVerifyOpen(false)} className="btn-secondary min-h-[52px] w-full text-[15px]">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function MobileCheckout() {
  return (
    <RequireAuth>
      <MobileCheckoutInner />
    </RequireAuth>
  );
}
