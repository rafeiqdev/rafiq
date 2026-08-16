import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet as WalletIcon,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  DollarSign,
  Share2,
  ChevronDown,
  AlertCircle,
  Building2,
  Send,
  X,
  CreditCard,
  LogIn
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { wallet } from '../../lib/api';
import type { WalletSummary, WalletTransaction, PayoutRequest, CommissionStatus, PayoutStatus } from '../../lib/api';
import { BackArrow } from '../../components/AppIcon';
import { MobileTabBar } from '../../components/MobileTabBar';
import { NumberTicker } from '../../components/ui/NumberTicker';

const mobileCopy: Record<string, { back: string; referrals: string; wallet: string }> = {
  en: { back: 'Back', referrals: 'Referrals', wallet: 'Wallet' },
  ar: { back: 'رجوع', referrals: 'الإحالات', wallet: 'المحفظة' },
  fa: { back: 'بازگشت', referrals: 'دعوت‌ها', wallet: 'کیف پول' },
  ru: { back: 'Назад', referrals: 'Рефералы', wallet: 'Кошелек' },
};

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const formatted = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (currency === 'USD') return `$${formatted}`;
  if (currency === 'EUR') return `€${formatted}`;
  if (currency === 'TRY') return `${formatted} TL`;
  return `${formatted} ${currency}`;
}

function formatDate(isoStr: string | null | undefined): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return isoStr;
  }
}

export function MobileWallet() {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<WalletSummary>({
    totalCommissions: 0,
    pending: 0,
    available: 0,
    paid: 0,
    primaryCurrency: 'USD',
    currencies: {},
    totalCount: 0,
  });
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal State
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutCurrency, setPayoutCurrency] = useState('USD');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'bank_transfer' | 'crypto'>('bank_transfer');
  const [accountHolder, setAccountHolder] = useState(user?.name || '');
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSuccess, setPayoutSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lang = (i18n.language || 'ar').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.ar;

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [sum, txs, reqs] = await Promise.all([
        wallet.getSummary(),
        wallet.getTransactions(),
        wallet.getPayoutRequests(),
      ]);
      setSummary(sum);
      setTransactions(txs);
      setPayoutRequests(reqs);
      if (sum.primaryCurrency) {
        setPayoutCurrency(sum.primaryCurrency);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const maxAvailableForCurrency =
    summary.currencies[payoutCurrency]?.available ??
    (payoutCurrency === summary.primaryCurrency ? summary.available : 0);

  const handleOpenPayoutModal = () => {
    setPayoutError(null);
    setPayoutSuccess(false);
    setPayoutAmount(maxAvailableForCurrency > 0 ? String(maxAvailableForCurrency) : '');
    setIsPayoutModalOpen(true);
  };

  const handleClosePayoutModal = () => {
    setIsPayoutModalOpen(false);
    setPayoutError(null);
  };

  const handleSubmitPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutError(null);

    const amt = parseFloat(payoutAmount);
    if (isNaN(amt) || amt <= 0 || amt > maxAvailableForCurrency) {
      setPayoutError(t('wallet.payout.errorAmount'));
      return;
    }

    if (!iban.trim()) {
      setPayoutError(t('wallet.payout.errorIban'));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await wallet.requestPayout({
        amount: amt,
        currency: payoutCurrency,
        payoutMethod,
        payoutDetails: {
          accountHolder,
          bankName,
          iban,
          notes: payoutNotes,
        },
      });

      if (res.ok) {
        setPayoutSuccess(true);
        loadData();
        setTimeout(() => {
          setIsPayoutModalOpen(false);
        }, 2000);
      } else {
        setPayoutError(res.error || t('common.error'));
      }
    } catch {
      setPayoutError(t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: CommissionStatus | PayoutStatus) => {
    switch (status) {
      case 'available':
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-bold border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {t(`wallet.statuses.${status}`)}
          </span>
        );
      case 'pending':
      case 'under_review':
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[11px] font-bold border border-amber-200">
            <Clock className="h-3 w-3" />
            {t(`wallet.statuses.${status}`)}
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[11px] font-bold border border-blue-200">
            <DollarSign className="h-3 w-3" />
            {t(`wallet.statuses.${status}`)}
          </span>
        );
      case 'reversed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 px-2 py-0.5 text-[11px] font-bold border border-rose-200">
            <AlertCircle className="h-3 w-3" />
            {t(`wallet.statuses.${status}`)}
          </span>
        );
      case 'failed':
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-[11px] font-medium">
            {t(`wallet.statuses.${status}`)}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-800 px-2.5 py-0.5 text-[11px]">
            {status}
          </span>
        );
    }
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className="pb-[calc(env(safe-area-inset-bottom)+88px)]">
        {/* ── Simple, Calm Mobile Header ── */}
        <header className="relative bg-navy px-4 pb-5 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white shadow-md">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label={mc.back}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20 shrink-0"
            >
              <BackArrow className="h-4 w-4" />
            </button>

            {/* Mobile Segmented Switcher */}
            <div className="inline-flex items-center p-0.5 bg-white/10 backdrop-blur-sm rounded-xl border border-white/15">
              <Link
                to="/referrals"
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                {t('referrals.tabReferrals')}
              </Link>
              <Link
                to="/wallet"
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-navy shadow-xs transition-colors inline-flex items-center gap-1"
              >
                <WalletIcon className="h-3 w-3" />
                <span>{t('referrals.tabWallet')}</span>
              </Link>
            </div>
          </div>

          <div className="mt-4">
            <h1 className="text-lg sm:text-xl font-extrabold text-white">{t('wallet.title')}</h1>
            <p className="text-xs text-white/70 mt-1">{t('wallet.subtitle')}</p>
          </div>
        </header>

        <div className="flex flex-col gap-3.5 px-4 pt-4">
          {/* Guest notice */}
          {!user && (
            <div className="p-3.5 rounded-2xl bg-sand/15 border border-sand/40 flex items-center justify-between gap-3 text-navy">
              <div>
                <p className="text-xs font-bold text-navy">{t('wallet.emptyStateTitle')}</p>
                <p className="text-[11px] text-navy/70 mt-0.5">{t('wallet.emptyStateBody')}</p>
              </div>
              <Link
                to="/auth"
                className="btn btn-primary text-[11px] px-3 py-1.5 rounded-xl font-bold shrink-0 inline-flex items-center gap-1"
              >
                <LogIn className="h-3 w-3" />
                <span>{t('auth.login')}</span>
              </Link>
            </div>
          )}

          {/* ── Balances Card ── */}
          <section className="card p-4 border border-cream-dark shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-cream-dark">
              <div>
                <span className="text-[10.5px] font-bold text-navy/60 uppercase">{t('wallet.stats.available')}</span>
                <p className="text-2xl font-extrabold text-emerald-800 font-mono tracking-tight" dir="ltr">
                  <NumberTicker
                    value={summary.available}
                    prefix={summary.primaryCurrency === 'USD' ? '$' : summary.primaryCurrency === 'EUR' ? '€' : ''}
                    suffix={summary.primaryCurrency === 'TRY' ? ' TL' : ''}
                    decimalPlaces={2}
                  />
                </p>
              </div>

              {user && (
                <button
                  onClick={handleOpenPayoutModal}
                  disabled={summary.available <= 0}
                  className={`flex h-9 items-center gap-1.5 px-3.5 rounded-xl text-xs font-bold transition-all ${
                    summary.available > 0
                      ? 'btn-primary bg-emerald-700 hover:bg-emerald-800 text-white'
                      : 'bg-cream-dark/60 text-navy/40 cursor-not-allowed'
                  }`}
                >
                  <ArrowUpRight className="h-3.5 w-3.5 rtl:rotate-180" />
                  <span>{t('wallet.payout.requestBtn')}</span>
                </button>
              )}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-cream p-2">
                <span className="text-[10px] text-navy/60 font-medium block">{t('wallet.stats.pending')}</span>
                <p className="text-xs font-bold text-navy font-mono mt-0.5" dir="ltr">
                  <NumberTicker
                    value={summary.pending}
                    prefix={summary.primaryCurrency === 'USD' ? '$' : summary.primaryCurrency === 'EUR' ? '€' : ''}
                    suffix={summary.primaryCurrency === 'TRY' ? ' TL' : ''}
                    decimalPlaces={2}
                  />
                </p>
              </div>

              <div className="rounded-xl bg-cream p-2">
                <span className="text-[10px] text-navy/60 font-medium block">{t('wallet.stats.paid')}</span>
                <p className="text-xs font-bold text-navy font-mono mt-0.5" dir="ltr">
                  <NumberTicker
                    value={summary.paid}
                    prefix={summary.primaryCurrency === 'USD' ? '$' : summary.primaryCurrency === 'EUR' ? '€' : ''}
                    suffix={summary.primaryCurrency === 'TRY' ? ' TL' : ''}
                    decimalPlaces={2}
                  />
                </p>
              </div>

              <div className="rounded-xl bg-cream p-2">
                <span className="text-[10px] text-navy/60 font-medium block">{t('wallet.stats.total')}</span>
                <p className="text-xs font-bold text-navy font-mono mt-0.5" dir="ltr">
                  <NumberTicker
                    value={summary.totalCommissions}
                    prefix={summary.primaryCurrency === 'USD' ? '$' : summary.primaryCurrency === 'EUR' ? '€' : ''}
                    suffix={summary.primaryCurrency === 'TRY' ? ' TL' : ''}
                    decimalPlaces={2}
                  />
                </p>
              </div>
            </div>
          </section>

          {/* ── Transactions History List ── */}
          <section className="card p-4 border border-cream-dark shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-navy flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-navy/70" />
                <span>{t('wallet.transactions.title')}</span>
              </h2>
              <span className="text-[10px] font-bold text-navy/60 bg-cream px-2 py-0.5 rounded-full border border-cream-dark">
                5%
              </span>
            </div>

            {loading ? (
              <div className="py-10 text-center text-navy/60">
                <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-navy border-t-transparent mb-1.5" />
                <p className="text-xs">{t('common.loading')}</p>
              </div>
            ) : error ? (
              <div className="py-6 text-center">
                <p className="text-xs text-danger font-bold mb-2">{error}</p>
                <button onClick={loadData} className="btn btn-secondary text-xs px-3 py-1">
                  {t('common.retry')}
                </button>
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-8 text-center px-2">
                <div className="mx-auto w-12 h-12 rounded-xl bg-cream flex items-center justify-center text-navy/50 mb-2 border border-cream-dark">
                  <WalletIcon className="h-5 w-5" />
                </div>
                <h3 className="text-xs font-bold text-navy mb-1">{t('wallet.emptyStateTitle')}</h3>
                <p className="text-[11px] text-navy/70 leading-relaxed mb-3">{t('wallet.emptyStateBody')}</p>
                <Link
                  to="/referrals"
                  className="btn btn-primary inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>{t('wallet.backToReferrals')}</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => {
                  const isExpanded = expandedId === tx.id;
                  return (
                    <div
                      key={tx.id}
                      className={`rounded-xl border border-cream-dark p-3 transition-colors ${
                        tx.status === 'reversed' ? 'bg-rose-500/5' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-navy">{tx.serviceName}</p>
                          <p className="text-[10.5px] text-navy/50 font-medium mt-0.5">{formatDate(tx.date)}</p>
                        </div>
                        <div className="text-end">
                          <p
                            className={`text-xs font-extrabold font-mono ${
                              tx.status === 'reversed' ? 'text-rose-700' : 'text-emerald-700'
                            }`}
                            dir="ltr"
                          >
                            {formatCurrency(tx.commissionAmount, tx.currency)}
                          </p>
                          <div className="mt-1">{getStatusBadge(tx.status)}</div>
                        </div>
                      </div>

                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                        className="mt-2 pt-2 border-t border-cream-dark/60 w-full flex items-center justify-between text-[11px] font-bold text-navy/60 hover:text-navy focus:outline-hidden"
                      >
                        <span>{t('wallet.transactions.details')}</span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-2 pt-2 border-t border-cream-dark/40 bg-cream/40 -mx-3 -mb-3 p-3 rounded-b-xl text-[11px] space-y-1 text-navy overflow-hidden"
                          >
                            <div className="flex justify-between">
                              <span className="text-navy/60">{t('wallet.transactions.txAmount')}:</span>
                              <span className="font-mono font-bold" dir="ltr">
                                {formatCurrency(tx.transactionAmount, tx.currency)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-navy/60">{t('wallet.transactions.rate')}:</span>
                              <span className="font-mono">5%</span>
                            </div>
                            {tx.orderId && (
                              <div className="flex justify-between">
                                <span className="text-navy/60">{t('wallet.transactions.orderId')}:</span>
                                <span className="font-mono text-[10px]">#{tx.orderId.slice(0, 8)}</span>
                              </div>
                            )}
                            {tx.availableAt && (
                              <div className="flex justify-between">
                                <span className="text-navy/60">{t('wallet.transactions.availableDate')}:</span>
                                <span>{formatDate(tx.availableAt)}</span>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ── Mobile Payout Modal ── */}
      <AnimatePresence>
        {isPayoutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClosePayoutModal}
              className="fixed inset-0 bg-navy/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              className="relative w-full max-w-lg rounded-t-[24px] sm:rounded-3xl bg-white p-5 shadow-2xl border border-cream-dark max-h-[90vh] overflow-y-auto z-10"
            >
              <button
                onClick={handleClosePayoutModal}
                className="absolute top-4 end-4 p-1.5 rounded-full text-navy/60 hover:bg-cream"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-navy text-white">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-navy">{t('wallet.payout.modalTitle')}</h3>
                  <p className="text-[10.5px] text-navy/60">{t('wallet.payout.modalSubtitle')}</p>
                </div>
              </div>

              {payoutSuccess ? (
                <div className="py-6 text-center">
                  <div className="mx-auto w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center mb-2">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <h4 className="text-xs font-bold text-navy mb-1">{t('wallet.payout.successTitle')}</h4>
                  <p className="text-[11px] text-navy/70">{t('wallet.payout.successMessage')}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitPayout} className="space-y-3 pt-1">
                  {payoutError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{payoutError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-navy mb-1">
                        {t('wallet.payout.selectCurrency')}
                      </label>
                      <select
                        value={payoutCurrency}
                        onChange={(e) => {
                          setPayoutCurrency(e.target.value);
                          const max = summary.currencies[e.target.value]?.available ?? summary.available;
                          setPayoutAmount(String(max));
                        }}
                        className="input w-full h-10 text-xs font-mono font-bold"
                      >
                        {Object.keys(summary.currencies).length > 0 ? (
                          Object.keys(summary.currencies).map((curr) => (
                            <option key={curr} value={curr}>
                              {curr} ({formatCurrency(summary.currencies[curr]?.available ?? 0, curr)})
                            </option>
                          ))
                        ) : (
                          <option value="USD">USD</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-navy mb-1">
                        {t('wallet.payout.amount')}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        max={maxAvailableForCurrency}
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        className="input w-full h-10 text-xs font-mono font-bold"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-navy mb-1">
                      {t('wallet.payout.method')}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPayoutMethod('bank_transfer')}
                        className={`p-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                          payoutMethod === 'bank_transfer'
                            ? 'border-navy bg-navy/5 text-navy font-extrabold'
                            : 'border-cream-dark bg-white text-navy/60'
                        }`}
                      >
                        <Building2 className="h-3.5 w-3.5" />
                        <span>{t('wallet.payout.methodBank')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayoutMethod('crypto')}
                        className={`p-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                          payoutMethod === 'crypto'
                            ? 'border-navy bg-navy/5 text-navy font-extrabold'
                            : 'border-cream-dark bg-white text-navy/60'
                        }`}
                      >
                        <DollarSign className="h-3.5 w-3.5" />
                        <span>{t('wallet.payout.methodCrypto')}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-navy mb-1">
                      {t('wallet.payout.accountHolder')}
                    </label>
                    <input
                      type="text"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      className="input w-full h-10 text-xs"
                      placeholder="Full Legal Name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-navy mb-1">
                      {t('wallet.payout.iban')}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={iban}
                      onChange={(e) => setIban(e.target.value)}
                      className="input w-full h-10 text-xs font-mono"
                      placeholder={payoutMethod === 'crypto' ? 'T...' : 'TR00 0000 0000 0000 0000 0000 00'}
                      required
                    />
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={handleClosePayoutModal}
                      className="btn btn-secondary flex-1 h-10 rounded-xl font-bold text-xs"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn btn-primary flex-1 h-10 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-1.5"
                    >
                      {isSubmitting ? (
                        <span>{t('wallet.payout.submitting')}</span>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          <span>{t('wallet.payout.submitBtn')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <MobileTabBar />
    </div>
  );
}
