import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import {
  Share2,
  Copy,
  Check,
  Wallet,
  ArrowUpRight,
  Calculator,
  ShieldCheck,
  HelpCircle,
  ChevronDown,
  Users,
  MousePointerClick,
  Clock,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { referrals } from '../lib/api';
import type { ReferralStats } from '../lib/api';
import { NumberTicker } from '../components/ui/NumberTicker';
import { InteractiveCommissionCalculator } from '../components/ui/InteractiveCommissionCalculator';

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const formatted = amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  if (currency === 'USD') return `$${formatted}`;
  if (currency === 'EUR') return `€${formatted}`;
  if (currency === 'TRY') return `${formatted} TL`;
  return `${formatted} ${currency}`;
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

export function Referrals() {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const [stats, setStats] = useState<ReferralStats>({
    clicks: 0,
    signups: 0,
    code: '',
    totalCommissions: 0,
    pending: 0,
    available: 0,
    paid: 0,
    primaryCurrency: 'USD',
    currencies: {},
    earnedTl: 0,
  });
  const [copied, setCopied] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const lang = (i18n.language || 'ar').split('-')[0];
  const isRtl = lang === 'ar' || lang === 'fa';

  useEffect(() => {
    if (user) {
      referrals.stats().then(setStats).catch(() => {});
    }
  }, [user]);

  const referralCode = stats.code || user?.referralCode || '';
  const link = referralCode ? `${window.location.origin}/r/${referralCode}` : `${window.location.origin}/r/`;

  const handleCopy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const shareData = {
      title: t('referrals.title'),
      text: t('referrals.shareText'),
      url: link,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const steps = [
    { title: t('referrals.how.step1') },
    { title: t('referrals.how.step2') },
    { title: t('referrals.how.step3') },
    { title: t('referrals.how.step4') },
    { title: t('referrals.how.step5') },
  ];

  const faqs = [
    { q: t('referrals.faq.q1'), a: t('referrals.faq.a1') },
    { q: t('referrals.faq.q2'), a: t('referrals.faq.a2') },
    { q: t('referrals.faq.q3'), a: t('referrals.faq.a3') },
    { q: t('referrals.faq.q4'), a: t('referrals.faq.a4') },
    { q: t('referrals.faq.q5'), a: t('referrals.faq.a5') },
    { q: t('referrals.faq.q6'), a: t('referrals.faq.a6') },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="mx-auto max-w-4xl px-4 py-6 sm:py-10"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* ── Top Tabs: Referrals & Wallet Switcher ── */}
      <motion.div variants={itemVariants} className="flex items-center justify-between gap-4 mb-6">
        <div className="inline-flex items-center p-1 bg-cream rounded-2xl border border-cream-dark shadow-2xs">
          <Link
            to="/referrals"
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-navy text-white shadow-xs transition-colors"
          >
            {t('referrals.tabReferrals')}
          </Link>
          <Link
            to="/wallet"
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-navy/70 hover:text-navy hover:bg-white/60 transition-colors inline-flex items-center gap-1.5"
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>{t('referrals.tabWallet')}</span>
          </Link>
        </div>

        <Link
          to="/wallet"
          className="btn btn-secondary text-xs sm:text-sm px-4 py-2 rounded-xl font-bold inline-flex items-center gap-2"
        >
          <Wallet className="h-4 w-4" />
          <span>{t('referrals.viewWallet')}</span>
          <ArrowUpRight className="h-3.5 w-3.5 rtl:rotate-180" />
        </Link>
      </motion.div>

      {/* ── Simple, Calm, Text-Focused Header ── */}
      <motion.div
        variants={itemVariants}
        className="rounded-3xl bg-navy p-6 sm:p-8 text-white shadow-md"
      >
        <div className="max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug">
            {t('referrals.title')}
          </h1>
          <p className="mt-2 text-xs sm:text-sm leading-relaxed text-white/80">
            {t('referrals.subtitle')}
          </p>
        </div>
      </motion.div>

      {/* ── Referral Link Sharing Box ── */}
      <motion.div variants={itemVariants} className="card p-6 mt-6 shadow-sm border border-cream-dark">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-base font-bold text-navy flex items-center gap-2">
              <Share2 className="h-4 w-4 text-navy/70" />
              <span>{t('referrals.yourLink')}</span>
            </h2>
            <p className="text-xs text-navy/60 mt-0.5">
              {t('referrals.how.step1')}
            </p>
          </div>
          {referralCode && (
            <span className="text-xs font-mono font-bold bg-cream-dark/50 px-2.5 py-1 rounded-md text-navy self-start sm:self-auto border border-cream-dark">
              ID: {referralCode}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <div className="relative flex-1">
            <input
              type="text"
              readOnly
              value={link}
              dir="ltr"
              className="input w-full font-mono text-xs sm:text-sm h-11 bg-cream border-cream-dark text-navy select-all px-3"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleCopy}
              className={`btn flex-1 sm:flex-initial h-11 px-5 font-bold inline-flex items-center justify-center gap-2 rounded-xl transition-colors shadow-2xs ${
                copied ? 'bg-green-600 text-white' : 'btn-primary'
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>{t('referrals.copied')}</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>{t('referrals.copy')}</span>
                </>
              )}
            </button>
            <button
              onClick={handleShare}
              className="btn btn-secondary h-11 px-4 font-bold inline-flex items-center justify-center gap-2 rounded-xl shadow-2xs"
              title={t('referrals.share')}
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t('referrals.share')}</span>
            </button>
          </div>
        </div>

        {/* ── Key Statistics Cards ── */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-2xl bg-cream p-4 text-center border border-cream-dark/60 flex flex-col justify-center">
            <div className="mx-auto w-8 h-8 rounded-full bg-navy/5 flex items-center justify-center mb-1 text-navy">
              <MousePointerClick className="h-4 w-4" />
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-navy font-mono" dir="ltr">
              <NumberTicker value={stats.clicks} />
            </p>
            <p className="text-xs text-navy/60 font-medium mt-0.5">
              {t('referrals.invited')}
            </p>
          </div>

          <div className="rounded-2xl bg-cream p-4 text-center border border-cream-dark/60 flex flex-col justify-center">
            <div className="mx-auto w-8 h-8 rounded-full bg-navy/5 flex items-center justify-center mb-1 text-navy">
              <Users className="h-4 w-4" />
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-navy font-mono" dir="ltr">
              <NumberTicker value={stats.signups} />
            </p>
            <p className="text-xs text-navy/60 font-medium mt-0.5">
              {t('referrals.signedUp')}
            </p>
          </div>

          <div className="rounded-2xl bg-cream p-4 text-center border border-cream-dark/60 flex flex-col justify-center">
            <div className="mx-auto w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center mb-1 text-amber-700">
              <Clock className="h-4 w-4" />
            </div>
            <p className="text-lg sm:text-xl font-extrabold text-navy font-mono" dir="ltr">
              <NumberTicker
                value={stats.pending}
                prefix={stats.primaryCurrency === 'USD' ? '$' : stats.primaryCurrency === 'EUR' ? '€' : ''}
                suffix={stats.primaryCurrency === 'TRY' ? ' TL' : ''}
                decimalPlaces={stats.pending % 1 !== 0 ? 2 : 0}
              />
            </p>
            <p className="text-xs text-navy/60 font-medium mt-0.5">
              {t('referrals.pending')}
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4 text-center border border-emerald-200 flex flex-col justify-center">
            <div className="mx-auto w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mb-1 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <p className="text-lg sm:text-xl font-extrabold text-emerald-800 font-mono" dir="ltr">
              <NumberTicker
                value={stats.available}
                prefix={stats.primaryCurrency === 'USD' ? '$' : stats.primaryCurrency === 'EUR' ? '€' : ''}
                suffix={stats.primaryCurrency === 'TRY' ? ' TL' : ''}
                decimalPlaces={stats.available % 1 !== 0 ? 2 : 0}
              />
            </p>
            <p className="text-xs text-emerald-700 font-medium mt-0.5">
              {t('referrals.available')}
            </p>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-2xl bg-cream p-4 text-center border border-cream-dark/60 flex flex-col justify-center">
            <div className="mx-auto w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center mb-1 text-navy">
              <DollarSign className="h-4 w-4" />
            </div>
            <p className="text-lg sm:text-xl font-extrabold text-navy font-mono" dir="ltr">
              <NumberTicker
                value={stats.paid}
                prefix={stats.primaryCurrency === 'USD' ? '$' : stats.primaryCurrency === 'EUR' ? '€' : ''}
                suffix={stats.primaryCurrency === 'TRY' ? ' TL' : ''}
                decimalPlaces={stats.paid % 1 !== 0 ? 2 : 0}
              />
            </p>
            <p className="text-xs text-navy/60 font-medium mt-0.5">
              {t('referrals.paid')}
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Interactive Commission Calculator ── */}
      <motion.div variants={itemVariants} className="mt-6">
        <InteractiveCommissionCalculator
          currency={stats.primaryCurrency === 'USD' ? '$' : stats.primaryCurrency === 'EUR' ? '€' : stats.primaryCurrency === 'TRY' ? 'TL ' : '$'}
        />
      </motion.div>

      {/* ── 5-Step Workflow ── */}
      <motion.div variants={itemVariants} className="card p-6 sm:p-8 mt-6 shadow-sm border border-cream-dark">
        <h2 className="text-base font-extrabold text-navy flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy text-white text-[11px] font-bold">✓</span>
          <span>{t('referrals.how.title')}</span>
        </h2>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-5 gap-3.5">
          {steps.map((step, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center p-4 rounded-2xl bg-cream border border-cream-dark/50"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-white font-extrabold text-xs mb-2.5">
                {index + 1}
              </span>
              <p className="text-xs font-semibold text-navy/90 leading-snug">
                {step.title}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Commission Calculation Examples Card ── */}
      <motion.div
        variants={itemVariants}
        className="card p-6 sm:p-8 mt-6 shadow-sm border border-cream-dark bg-white"
      >
        <div className="flex items-center gap-2.5">
          <Calculator className="h-5 w-5 text-navy" />
          <div>
            <h2 className="text-base font-extrabold text-navy">
              {t('referrals.calc.title')}
            </h2>
            <p className="text-xs text-navy/70 mt-0.5">
              {t('referrals.calc.subtitle')}
            </p>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-cream-dark bg-white shadow-xs">
          <table className="w-full text-start text-xs sm:text-sm">
            <thead className="bg-navy text-white font-bold">
              <tr>
                <th className="p-3.5 text-start">{t('referrals.calc.colValue')}</th>
                <th className="p-3.5 text-center">{t('referrals.calc.colCalc')}</th>
                <th className="p-3.5 text-end text-sand">{t('referrals.calc.colEarn')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-dark">
              <tr className="hover:bg-cream/40 transition-colors">
                <td className="p-3.5 font-bold text-navy font-mono" dir="ltr">{t('referrals.calc.ex1Value')}</td>
                <td className="p-3.5 text-center text-navy/70 font-mono" dir="ltr">{t('referrals.calc.ex1Calc')}</td>
                <td className="p-3.5 text-end font-extrabold text-green-700 font-mono text-sm sm:text-base" dir="ltr">{t('referrals.calc.ex1Earn')}</td>
              </tr>
              <tr className="hover:bg-cream/40 transition-colors bg-cream/20">
                <td className="p-3.5 font-bold text-navy font-mono" dir="ltr">{t('referrals.calc.ex2Value')}</td>
                <td className="p-3.5 text-center text-navy/70 font-mono" dir="ltr">{t('referrals.calc.ex2Calc')}</td>
                <td className="p-3.5 text-end font-extrabold text-green-700 font-mono text-sm sm:text-base" dir="ltr">{t('referrals.calc.ex2Earn')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ── FAQs Section ── */}
      <motion.div variants={itemVariants} className="card p-6 sm:p-8 mt-6 shadow-sm border border-cream-dark">
        <h2 className="text-base font-extrabold text-navy flex items-center gap-2 mb-4">
          <HelpCircle className="h-5 w-5 text-navy/70" />
          <span>{t('referrals.faq.title')}</span>
        </h2>

        <div className="space-y-2.5">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl border border-cream-dark/80 bg-white overflow-hidden"
            >
              <button
                type="button"
                aria-expanded={openFaq === i}
                onClick={() => toggleFaq(i)}
                className="w-full p-4 text-start font-bold text-xs sm:text-sm text-navy flex items-center justify-between gap-3 hover:bg-cream/50 transition-colors focus:outline-hidden"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-navy/60 transition-transform duration-200 ${
                    openFaq === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 pb-4 pt-1 text-xs sm:text-sm text-navy/80 leading-relaxed border-t border-cream-dark/40 bg-cream/20 overflow-hidden"
                  >
                    {faq.a}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Terms & Guidelines ── */}
      <motion.div variants={itemVariants} className="card p-6 sm:p-8 mt-6 shadow-sm border border-cream-dark bg-cream/20">
        <h2 className="text-sm font-bold text-navy flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-navy/70" />
          <span>{t('referrals.terms.title')}</span>
        </h2>
        <p className="mt-2.5 text-xs text-navy/70 leading-relaxed whitespace-pre-line">
          {t('referrals.terms.body')}
        </p>
      </motion.div>
    </motion.div>
  );
}
