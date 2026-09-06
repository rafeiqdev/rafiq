import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
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
import { useApp } from '../context/AppContext';
import { wallet } from '../lib/api';
import type { WalletSummary, WalletTransaction, PayoutRequest, CommissionStatus, PayoutStatus } from '../lib/api';
import { NumberTicker } from '../components/ui/NumberTicker';

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
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return isoStr;
  }
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 30,
    },
  },
};

export function Wallet() {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
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

  // Expanded transaction accordion rows
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Payout Modal state
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutCurrency, setPayoutCurrency] = useState('USD');
  const [payoutMethod, setPayoutMethod] = useState<'bank_transfer' | 'crypto'>('bank_transfer');
  const [accountHolder, setAccountHolder] = useState(user?.name || '');
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSuccess, setPayoutSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lang = (i18n.language || 'ar').split('-')[0];
  const isRtl = lang === 'ar' || lang === 'fa';

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
    setIsPayoutModalOpen(true);
  };

  const handleClosePayoutModal = () => {
    setIsPayoutModalOpen(false);
    setPayoutError(null);
  };

  const handleSubmitPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutError(null);

    if (maxAvailableForCurrency <= 0) {
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-xs font-bold border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {t(`wallet.statuses.${status}`)}
          </span>
        );
      case 'pending':
      case 'under_review':
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2.5 py-0.5 text-xs font-bold border border-amber-200">
            <Clock className="h-3 w-3" />
            {t(`wallet.statuses.${status}`)}
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 px-2.5 py-0.5 text-xs font-bold border border-blue-200">
            <DollarSign className="h-3 w-3" />
            {t(`wallet.statuses.${status}`)}
          </span>
        );
      case 'reversed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 px-2.5 py-0.5 text-xs font-bold border border-rose-200">
            <AlertCircle className="h-3 w-3" />
            {t(`wallet.statuses.${status}`)}
          </span>
        );
      case 'failed':
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 px-2.5 py-0.5 text-xs font-medium">
            {t(`wallet.statuses.${status}`)}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-800 px-2.5 py-0.5 text-xs font-medium">
            {status}
          </span>
        );
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="mx-auto max-w-5xl px-4 py-8 sm:py-10"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* ── Top Tabs: Referrals & Wallet Switcher ── */}
      <motion.div variants={itemVariants} className="flex items-center justify-between gap-4 mb-6">
        <div className="inline-flex items-center p-1 bg-cream rounded-2xl border border-cream-dark shadow-2xs">
          <Link
            to="/referrals"
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-navy/70 hover:text-navy hover:bg-white/60 transition-colors"
          >
            {t('referrals.tabReferrals')}
          </Link>
          <Link
            to="/wallet"
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-navy text-white shadow-xs transition-colors inline-flex items-center gap-1.5"
          >
            <WalletIcon className="h-3.5 w-3.5" />
            <span>{t('referrals.tabWallet')}</span>
          </Link>
        </div>

        <Link
          to="/referrals"
          className="btn btn-secondary text-xs sm:text-sm px-4 py-2 rounded-xl font-bold inline-flex items-center gap-2"
        >
          <Share2 className="h-4 w-4" />
          <span>{t('wallet.backToReferrals')}</span>
        </Link>
      </motion.div>

      {/* ── Clean, Calm Desktop Header ── */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-cream-dark"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy tracking-tight">
            {t('wallet.title')}
          </h1>
          <p className="text-xs sm:text-sm text-navy/70 mt-1">
            {t('wallet.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <button
              onClick={handleOpenPayoutModal}
              disabled={summary.available <= 0}
              className={`btn text-xs sm:text-sm px-5 py-2.5 rounded-xl font-bold inline-flex items-center gap-2 shadow-xs transition-all ${
                summary.available > 0
                  ? 'btn-primary bg-emerald-700 hover:bg-emerald-800 text-white'
                  : 'bg-cream-dark/60 text-navy/40 cursor-not-allowed'
              }`}
            >
              <ArrowUpRight className="h-4 w-4 rtl:rotate-180" />
              <span>{t('wallet.payout.requestBtn')}</span>
            </button>
          ) : (
            <Link
              to="/auth"
              className="btn btn-primary text-xs sm:text-sm px-5 py-2.5 rounded-xl font-bold inline-flex items-center gap-2"
            >
              <LogIn className="h-4 w-4" />
              <span>{t('common.signIn')}</span>
            </Link>
          )}
        </div>
      </motion.div>

      {/* ── Guest Banner if not signed in ── */}
      {!user && (
        <motion.div
          variants={itemVariants}
          className="mt-6 p-4 rounded-2xl bg-sand/15 border border-sand/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-navy"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy text-white">
              <WalletIcon className="h-5 w-5 text-sand" />
            </div>
            <div>
              <p className="text-sm font-bold text-navy">{t('wallet.emptyStateTitle')}</p>
              <p className="text-xs text-navy/70 mt-0.5">
                {t('wallet.emptyStateBody')}
              </p>
            </div>
          </div>
          <Link
            to="/auth"
            className="btn btn-primary text-xs px-4 py-2 rounded-xl font-bold shrink-0 inline-flex items-center gap-1.5"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>{t('common.signIn')}</span>
          </Link>
        </motion.div>
      )}

      {/* ── Calm, Balanced Metric Grid ── */}
      <motion.div variants={itemVariants} className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Available to Withdraw */}
        <div className="card p-5 border border-emerald-200 bg-emerald-50/40 rounded-2xl">
          <div className="flex items-center justify-between text-emerald-800 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">{t('wallet.stats.available')}</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-800 font-mono tracking-tight" dir="ltr">
            <NumberTicker
              value={summary.available}
              prefix={summary.primaryCurrency === 'USD' ? '$' : summary.primaryCurrency === 'EUR' ? '€' : ''}
              suffix={summary.primaryCurrency === 'TRY' ? ' TL' : ''}
              decimalPlaces={2}
            />
          </p>
          <p className="text-[11px] text-emerald-700/80 mt-1 font-medium">
            {t('wallet.statuses.available')}
          </p>
        </div>

        {/* Pending Verification */}
        <div className="card p-5 border border-cream-dark bg-white rounded-2xl">
          <div className="flex items-center justify-between text-navy/70 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">{t('wallet.stats.pending')}</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-navy font-mono tracking-tight" dir="ltr">
            <NumberTicker
              value={summary.pending}
              prefix={summary.primaryCurrency === 'USD' ? '$' : summary.primaryCurrency === 'EUR' ? '€' : ''}
              suffix={summary.primaryCurrency === 'TRY' ? ' TL' : ''}
              decimalPlaces={2}
            />
          </p>
          <p className="text-[11px] text-navy/50 mt-1 font-medium">
            {t('wallet.statuses.pending')}
          </p>
        </div>

        {/* Paid Out */}
        <div className="card p-5 border border-cream-dark bg-white rounded-2xl">
          <div className="flex items-center justify-between text-navy/70 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">{t('wallet.stats.paid')}</span>
            <ArrowDownLeft className="h-4 w-4 text-navy/50" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-navy font-mono tracking-tight" dir="ltr">
            <NumberTicker
              value={summary.paid}
              prefix={summary.primaryCurrency === 'USD' ? '$' : summary.primaryCurrency === 'EUR' ? '€' : ''}
              suffix={summary.primaryCurrency === 'TRY' ? ' TL' : ''}
              decimalPlaces={2}
            />
          </p>
          <p className="text-[11px] text-navy/50 mt-1 font-medium">
            {t('wallet.statuses.paid')}
          </p>
        </div>

        {/* Total Commissions */}
        <div className="card p-5 border border-cream-dark bg-white rounded-2xl">
          <div className="flex items-center justify-between text-navy/70 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">{t('wallet.stats.total')}</span>
            <DollarSign className="h-4 w-4 text-navy/50" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-navy font-mono tracking-tight" dir="ltr">
            <NumberTicker
              value={summary.totalCommissions}
              prefix={summary.primaryCurrency === 'USD' ? '$' : summary.primaryCurrency === 'EUR' ? '€' : ''}
              suffix={summary.primaryCurrency === 'TRY' ? ' TL' : ''}
              decimalPlaces={2}
            />
          </p>
          <p className="text-[11px] text-navy/50 mt-1 font-medium">
            5% {t('wallet.transactions.commission')}
          </p>
        </div>
      </motion.div>

      {/* ── Main Content: Transactions Ledger ── */}
      <motion.div variants={itemVariants} className="mt-8 card p-6 shadow-sm border border-cream-dark">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-extrabold text-navy flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-navy/70" />
            <span>{t('wallet.transactions.title')}</span>
          </h2>
          <span className="text-xs font-bold text-navy/70 bg-cream border border-cream-dark px-3 py-1 rounded-full">
            5% {t('wallet.transactions.commission')}
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-navy/60">
            <div className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-navy border-t-transparent mb-2" />
            <p className="text-xs font-medium">{t('common.loading')}</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-danger mb-2" />
            <p className="text-sm text-danger font-bold">{error}</p>
            <button onClick={loadData} className="mt-3 btn btn-secondary text-xs px-4 py-2">
              {t('common.retry')}
            </button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-14 text-center px-4 max-w-md mx-auto">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-cream flex items-center justify-center text-navy/50 mb-3 border border-cream-dark">
              <WalletIcon className="h-6 w-6 text-navy/70" />
            </div>
            <h3 className="text-base font-bold text-navy mb-1.5">
              {t('wallet.emptyStateTitle')}
            </h3>
            <p className="text-xs text-navy/70 leading-relaxed mb-5">
              {t('wallet.emptyStateBody')}
            </p>
            <Link
              to="/referrals"
              className="btn btn-primary inline-flex items-center gap-2 text-xs px-5 py-2.5 rounded-xl shadow-xs"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>{t('wallet.backToReferrals')}</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-start text-xs sm:text-sm">
              <thead className="bg-cream text-navy/70 border-y border-cream-dark font-bold text-xs uppercase">
                <tr>
                  <th className="py-3 px-4 text-start">{t('wallet.transactions.date')}</th>
                  <th className="py-3 px-4 text-start">{t('wallet.transactions.service')}</th>
                  <th className="py-3 px-4 text-end">{t('wallet.transactions.txAmount')}</th>
                  <th className="py-3 px-4 text-center">{t('wallet.transactions.rate')}</th>
                  <th className="py-3 px-4 text-end">{t('wallet.transactions.commission')}</th>
                  <th className="py-3 px-4 text-center">{t('wallet.transactions.status')}</th>
                  <th className="py-3 px-4 text-center w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-dark">
                {transactions.map((tx) => {
                  const isExpanded = expandedId === tx.id;
                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-cream/40 transition-colors ${
                        tx.status === 'reversed' ? 'bg-rose-500/5' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-medium text-navy/70 whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-navy">{tx.serviceName}</div>
                        {tx.orderId && (
                          <div className="text-[11px] font-mono text-navy/50">
                            #{tx.orderId.slice(0, 8)}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-end font-mono font-semibold text-navy whitespace-nowrap" dir="ltr">
                        {formatCurrency(tx.transactionAmount, tx.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-navy/60">
                        {Math.round(tx.commissionRate * 100)}%
                      </td>
                      <td
                        className={`py-3.5 px-4 text-end font-mono font-extrabold whitespace-nowrap ${
                          tx.status === 'reversed'
                            ? 'text-rose-700'
                            : 'text-emerald-700'
                        }`}
                        dir="ltr"
                      >
                        {formatCurrency(tx.commissionAmount, tx.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {getStatusBadge(tx.status)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                          aria-label={t('wallet.transactions.details')}
                          className="p-1.5 rounded-lg text-navy/50 hover:bg-cream-dark/60 transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-navy"
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Expandable Details Box */}
            <AnimatePresence>
              {expandedId && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-cream/60 p-4 border-t border-cream-dark text-xs sm:text-sm text-navy overflow-hidden"
                >
                  {(() => {
                    const tx = transactions.find((t) => t.id === expandedId);
                    if (!tx) return null;
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <span className="font-bold text-navy/60 block">{t('wallet.transactions.orderId')}:</span>
                          <span className="font-mono text-navy">{tx.orderId || '—'}</span>
                        </div>
                        <div>
                          <span className="font-bold text-navy/60 block">{t('wallet.transactions.availableDate')}:</span>
                          <span>{formatDate(tx.availableAt)}</span>
                        </div>
                        {tx.notes && (
                          <div className="sm:col-span-3 bg-white p-3 rounded-xl border border-cream-dark mt-1">
                            <span className="font-bold text-navy/70 block mb-1">
                              {t('wallet.transactions.reversalNote')}:
                            </span>
                            <p className="text-navy/80">{tx.notes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* ── Recent Payout Requests ── */}
      {payoutRequests.length > 0 && (
        <motion.div variants={itemVariants} className="mt-8 card p-6 shadow-sm border border-cream-dark">
          <h2 className="text-base font-extrabold text-navy flex items-center gap-2 mb-4">
            <Building2 className="h-4 w-4 text-navy/70" />
            <span>{t('wallet.payout.recentRequestsTitle')}</span>
          </h2>
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-start text-xs sm:text-sm">
              <thead className="bg-cream text-navy/70 border-y border-cream-dark font-bold text-xs uppercase">
                <tr>
                  <th className="py-2.5 px-4 text-start">{t('wallet.payout.requestDate')}</th>
                  <th className="py-2.5 px-4 text-start">{t('wallet.payout.method')}</th>
                  <th className="py-2.5 px-4 text-end">{t('wallet.payout.requestedAmount')}</th>
                  <th className="py-2.5 px-4 text-center">{t('wallet.payout.requestStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-dark">
                {payoutRequests.map((req) => (
                  <tr key={req.id}>
                    <td className="py-3 px-4 font-medium text-navy/70">{formatDate(req.createdAt)}</td>
                    <td className="py-3 px-4 text-navy">
                      {req.payoutMethod === 'crypto'
                        ? t('wallet.payout.methodCrypto')
                        : t('wallet.payout.methodBank')}
                    </td>
                    <td className="py-3 px-4 text-end font-mono font-bold text-navy" dir="ltr">
                      {formatCurrency(req.amount, req.currency)}
                    </td>
                    <td className="py-3 px-4 text-center">{getStatusBadge(req.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── Payout Request Modal ── */}
      <AnimatePresence>
        {isPayoutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClosePayoutModal}
              className="fixed inset-0 bg-navy/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-cream-dark z-10"
            >
              <button
                onClick={handleClosePayoutModal}
                className="absolute top-5 end-5 p-2 rounded-full text-navy/60 hover:bg-cream transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white shadow-sm">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-navy">
                    {t('wallet.payout.modalTitle')}
                  </h3>
                  <p className="text-xs text-navy/60 mt-0.5">
                    {t('wallet.payout.modalSubtitle')}
                  </p>
                </div>
              </div>

              {payoutSuccess ? (
                <div className="py-8 text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center mb-3">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h4 className="text-base font-bold text-navy mb-1">
                    {t('wallet.payout.successTitle')}
                  </h4>
                  <p className="text-xs sm:text-sm text-navy/70">
                    {t('wallet.payout.successMessage')}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitPayout} className="space-y-4">
                  {payoutError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{payoutError}</span>
                    </div>
                  )}

                  {/*
                    A withdrawal is always the WHOLE available balance of one
                    currency — the server computes it from the ledger and
                    attaches the exact commissions it settles. A typed amount
                    would have to split a commission row across two payouts,
                    which is how a hand-run ledger stops adding up.
                  */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-navy mb-1">
                        {t('wallet.payout.selectCurrency')}
                      </label>
                      <select
                        value={payoutCurrency}
                        onChange={(e) => setPayoutCurrency(e.target.value)}
                        className="input w-full h-11 text-xs font-mono font-bold"
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
                      <label className="block text-xs font-bold text-navy mb-1">
                        {t('wallet.payout.amount')}
                      </label>
                      <div
                        className="input w-full h-11 text-sm font-mono font-extrabold text-emerald-700 flex items-center bg-emerald-50/60 border-emerald-200"
                        dir="ltr"
                      >
                        {formatCurrency(maxAvailableForCurrency, payoutCurrency)}
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-navy/60 font-medium">
                    {t('wallet.payout.fullBalanceNote')}
                  </p>

                  <div>
                    <label className="block text-xs font-bold text-navy mb-1">
                      {t('wallet.payout.method')}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPayoutMethod('bank_transfer')}
                        className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          payoutMethod === 'bank_transfer'
                            ? 'border-navy bg-navy/5 text-navy font-extrabold'
                            : 'border-cream-dark bg-white text-navy/60'
                        }`}
                      >
                        <Building2 className="h-4 w-4" />
                        <span>{t('wallet.payout.methodBank')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayoutMethod('crypto')}
                        className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          payoutMethod === 'crypto'
                            ? 'border-navy bg-navy/5 text-navy font-extrabold'
                            : 'border-cream-dark bg-white text-navy/60'
                        }`}
                      >
                        <DollarSign className="h-4 w-4" />
                        <span>{t('wallet.payout.methodCrypto')}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-navy mb-1">
                      {t('wallet.payout.accountHolder')}
                    </label>
                    <input
                      type="text"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      className="input w-full h-11 text-xs"
                      placeholder="Full Legal Name"
                      required
                    />
                  </div>

                  {payoutMethod === 'bank_transfer' && (
                    <div>
                      <label className="block text-xs font-bold text-navy mb-1">
                        {t('wallet.payout.bankName')}
                      </label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="input w-full h-11 text-xs"
                        placeholder="e.g. Ziraat Bankası, Garanti BBVA, etc."
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-navy mb-1">
                      {t('wallet.payout.iban')}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={iban}
                      onChange={(e) => setIban(e.target.value)}
                      className="input w-full h-11 text-xs font-mono"
                      placeholder={payoutMethod === 'crypto' ? 'T...' : 'TR00 0000 0000 0000 0000 0000 00'}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-navy mb-1">
                      {t('wallet.payout.notes')}
                    </label>
                    <input
                      type="text"
                      value={payoutNotes}
                      onChange={(e) => setPayoutNotes(e.target.value)}
                      className="input w-full h-11 text-xs"
                      placeholder="Swift code, branch code, etc."
                    />
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={handleClosePayoutModal}
                      className="btn btn-secondary flex-1 h-11 rounded-xl font-bold text-xs"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn btn-primary flex-1 h-11 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <span>{t('wallet.payout.submitting')}</span>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
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
    </motion.div>
  );
}
