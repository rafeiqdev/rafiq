import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
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
import { useApp } from '../../context/AppContext';
import { referrals } from '../../lib/api';
import type { ReferralStats } from '../../lib/api';
import { BackArrow } from '../../components/AppIcon';
import { MobileTabBar } from '../../components/MobileTabBar';
import { NumberTicker } from '../../components/ui/NumberTicker';

const mobileCopy: Record<string, { back: string; home: string; chat: string; map: string; services: string; profile: string; wallet: string; referrals: string }> = {
  en: { back: 'Back', home: 'Home', chat: 'AI Chat', map: 'Map', services: 'Services', profile: 'Profile', wallet: 'Wallet', referrals: 'Referrals' },
  ar: { back: 'رجوع', home: 'الرئيسية', chat: 'المساعد', map: 'الخريطة', services: 'الخدمات', profile: 'حسابي', wallet: 'المحفظة', referrals: 'الإحالات' },
  fa: { back: 'بازگشت', home: 'خانه', chat: 'دستیار', map: 'نقشه', services: 'خدمات', profile: 'پروفایل', wallet: 'کیف پول', referrals: 'دعوت‌ها' },
  ru: { back: 'Назад', home: 'Главная', chat: 'ИИ-чат', map: 'Карта', services: 'Услуги', profile: 'Профиль', wallet: 'Кошелек', referrals: 'Рефералы' },
};

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const formatted = amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  if (currency === 'USD') return `$${formatted}`;
  if (currency === 'EUR') return `€${formatted}`;
  if (currency === 'TRY') return `${formatted} TL`;
  return `${formatted} ${currency}`;
}

export function MobileReferrals() {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const navigate = useNavigate();
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

  useEffect(() => {
    if (user) {
      referrals.stats().then(setStats).catch(() => {});
    }
  }, [user]);

  const referralCode = stats.code || user?.referralCode || '';
  const link = referralCode ? `${window.location.origin}/r/${referralCode}` : `${window.location.origin}/r/`;

  const lang = (i18n.language || 'ar').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.ar;

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
    t('referrals.how.step1'),
    t('referrals.how.step2'),
    t('referrals.how.step3'),
    t('referrals.how.step4'),
    t('referrals.how.step5'),
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
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className="pb-[calc(env(safe-area-inset-bottom)+80px)]">
        {/* ── Compact Mobile Header ── */}
        <header className="relative bg-navy px-3.5 pb-4 pt-[calc(env(safe-area-inset-top)+0.6rem)] text-white shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label={mc.back}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20 shrink-0"
            >
              <BackArrow className="h-3.5 w-3.5" />
            </button>

            {/* Mobile Segmented Switcher */}
            <div className="inline-flex items-center p-0.5 bg-white/10 backdrop-blur-xs rounded-xl border border-white/15">
              <Link
                to="/referrals"
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-navy shadow-xs transition-colors"
              >
                {t('referrals.tabReferrals')}
              </Link>
              <Link
                to="/wallet"
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white/80 hover:text-white hover:bg-white/10 transition-colors inline-flex items-center gap-1"
              >
                <Wallet className="h-2.5 w-2.5" />
                <span>{t('referrals.tabWallet')}</span>
              </Link>
            </div>
          </div>

          <div className="mt-3">
            <h1 className="text-base font-extrabold leading-snug text-white">
              {t('referrals.title')}
            </h1>
            <p className="mt-0.5 text-[11px] leading-relaxed text-white/80">
              {t('referrals.subtitle')}
            </p>
          </div>
        </header>

        <div className="flex flex-col gap-2.5 px-3 pt-3">
          {/* ── Link & Actions Card (Compact) ── */}
          <section className="card p-3 rounded-2xl border border-cream-dark shadow-xs bg-white">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-bold text-navy/70">{t('referrals.yourLink')}</p>
              {referralCode && (
                <span className="text-[10px] font-mono font-bold text-navy/60 bg-cream px-1.5 py-0.5 rounded border border-cream-dark">
                  ID: {referralCode}
                </span>
              )}
            </div>

            <code
              dir="ltr"
              className="flex h-8 items-center overflow-x-auto whitespace-nowrap rounded-xl border border-cream-dark bg-cream px-2.5 font-mono text-[11px] text-navy select-all"
            >
              {link}
            </code>

            <div className="mt-2 flex gap-1.5">
              <button
                onClick={handleCopy}
                className={`flex flex-1 h-8 items-center justify-center gap-1.5 rounded-xl text-[11px] font-bold text-white transition-colors ${
                  copied ? 'bg-green-700' : 'bg-navy'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" />
                    <span>{t('referrals.copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>{t('referrals.copy')}</span>
                  </>
                )}
              </button>

              <button
                onClick={handleShare}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-cream-dark bg-cream text-navy hover:bg-cream-dark/50 shrink-0"
                title={t('referrals.share')}
              >
                <Share2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* ── Mobile Stats Grid (Compact) ── */}
            <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
              <div className="rounded-xl bg-cream p-2 border border-cream-dark/60">
                <div className="mx-auto w-4 h-4 rounded-full bg-navy/5 flex items-center justify-center mb-0.5 text-navy">
                  <MousePointerClick className="h-2.5 w-2.5" />
                </div>
                <p className="text-sm font-extrabold text-navy font-mono" dir="ltr">
                  <NumberTicker value={stats.clicks} />
                </p>
                <p className="text-[9.5px] text-navy/60 leading-tight mt-0.5">{t('referrals.invited')}</p>
              </div>

              <div className="rounded-xl bg-cream p-2 border border-cream-dark/60">
                <div className="mx-auto w-4 h-4 rounded-full bg-navy/5 flex items-center justify-center mb-0.5 text-navy">
                  <Users className="h-2.5 w-2.5" />
                </div>
                <p className="text-sm font-extrabold text-navy font-mono" dir="ltr">
                  <NumberTicker value={stats.signups} />
                </p>
                <p className="text-[9.5px] text-navy/60 leading-tight mt-0.5">{t('referrals.signedUp')}</p>
              </div>

              <div className="rounded-xl bg-cream p-2 border border-cream-dark/60">
                <div className="mx-auto w-4 h-4 rounded-full bg-amber-500/10 flex items-center justify-center mb-0.5 text-amber-700">
                  <Clock className="h-2.5 w-2.5" />
                </div>
                <p className="text-[11px] font-extrabold text-navy font-mono break-words" dir="ltr">
                  <NumberTicker
                    value={stats.pending}
                    prefix={stats.primaryCurrency === 'USD' ? '$' : stats.primaryCurrency === 'EUR' ? '€' : ''}
                    suffix={stats.primaryCurrency === 'TRY' ? ' TL' : ''}
                    decimalPlaces={stats.pending % 1 !== 0 ? 2 : 0}
                  />
                </p>
                <p className="text-[9.5px] text-navy/60 leading-tight mt-0.5">{t('referrals.pending')}</p>
              </div>

              <div className="col-span-2 rounded-xl bg-emerald-50 p-2 flex items-center justify-between px-2.5 border border-emerald-200">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-700" />
                  <span className="text-[11px] font-bold text-emerald-800">{t('referrals.available')}</span>
                </div>
                <p className="text-xs font-extrabold text-emerald-800 font-mono" dir="ltr">
                  <NumberTicker
                    value={stats.available}
                    prefix={stats.primaryCurrency === 'USD' ? '$' : stats.primaryCurrency === 'EUR' ? '€' : ''}
                    suffix={stats.primaryCurrency === 'TRY' ? ' TL' : ''}
                    decimalPlaces={stats.available % 1 !== 0 ? 2 : 0}
                  />
                </p>
              </div>

              <div className="rounded-xl bg-cream p-2 flex flex-col justify-center border border-cream-dark/60">
                <p className="text-[11px] font-extrabold text-navy font-mono" dir="ltr">
                  <NumberTicker
                    value={stats.paid}
                    prefix={stats.primaryCurrency === 'USD' ? '$' : stats.primaryCurrency === 'EUR' ? '€' : ''}
                    suffix={stats.primaryCurrency === 'TRY' ? ' TL' : ''}
                    decimalPlaces={stats.paid % 1 !== 0 ? 2 : 0}
                  />
                </p>
                <p className="text-[9.5px] text-navy/60 leading-tight mt-0.5">{t('referrals.paid')}</p>
              </div>
            </div>

            <Link
              to="/wallet"
              className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-xl bg-cream border border-cream-dark py-1.5 text-[11px] font-bold text-navy hover:bg-cream-dark/40"
            >
              <Wallet className="h-3 w-3" />
              <span>{t('referrals.viewWallet')}</span>
              <ArrowUpRight className="h-3 w-3 rtl:rotate-180" />
            </Link>
          </section>

          {/* ── 5 Steps (Compact) ── */}
          <section className="card p-3 rounded-2xl border border-cream-dark shadow-xs bg-white">
            <h2 className="text-[11.5px] font-bold text-navy mb-2">{t('referrals.how.title')}</h2>
            <ol className="flex flex-col gap-1.5">
              {steps.map((stepText, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-navy text-white text-[9px] font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-[11px] leading-snug text-navy/80">{stepText}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* ── Calculator Examples (Compact Table) ── */}
          <section className="card p-3 rounded-2xl bg-white border border-cream-dark shadow-xs">
            <div className="flex items-center gap-1.5 mb-1">
              <Calculator className="h-3.5 w-3.5 text-navy" />
              <h2 className="text-[11.5px] font-bold text-navy">{t('referrals.calc.title')}</h2>
            </div>
            <p className="text-[10.5px] text-navy/70 mb-2 leading-tight">{t('referrals.calc.subtitle')}</p>

            <div className="overflow-hidden rounded-xl border border-cream-dark bg-white">
              <table className="w-full text-start text-[10px]">
                <thead className="bg-navy text-white font-bold">
                  <tr>
                    <th className="py-1.5 px-2 text-start">{t('referrals.calc.colValue')}</th>
                    <th className="py-1.5 px-2 text-center">{t('referrals.calc.colCalc')}</th>
                    <th className="py-1.5 px-2 text-end text-sand">{t('referrals.calc.colEarn')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-dark">
                  <tr>
                    <td className="py-1.5 px-2 font-bold text-navy font-mono" dir="ltr">{t('referrals.calc.ex1Value')}</td>
                    <td className="py-1.5 px-2 text-center text-navy/70 font-mono" dir="ltr">{t('referrals.calc.ex1Calc')}</td>
                    <td className="py-1.5 px-2 text-end font-extrabold text-green-700 font-mono" dir="ltr">{t('referrals.calc.ex1Earn')}</td>
                  </tr>
                  <tr className="bg-cream/20">
                    <td className="py-1.5 px-2 font-bold text-navy font-mono" dir="ltr">{t('referrals.calc.ex2Value')}</td>
                    <td className="py-1.5 px-2 text-center text-navy/70 font-mono" dir="ltr">{t('referrals.calc.ex2Calc')}</td>
                    <td className="py-1.5 px-2 text-end font-extrabold text-green-700 font-mono" dir="ltr">{t('referrals.calc.ex2Earn')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Mobile FAQs (Compact) ── */}
          <section className="card p-3 rounded-2xl border border-cream-dark shadow-xs bg-white">
            <h2 className="text-[11.5px] font-bold text-navy flex items-center gap-1.5 mb-2">
              <HelpCircle className="h-3.5 w-3.5 text-navy/70" />
              <span>{t('referrals.faq.title')}</span>
            </h2>

            <div className="space-y-1.5">
              {faqs.map((faq, i) => (
                <div key={i} className="rounded-xl border border-cream-dark bg-white overflow-hidden">
                  <button
                    type="button"
                    aria-expanded={openFaq === i}
                    onClick={() => toggleFaq(i)}
                    className="w-full p-2.5 text-start font-bold text-[11px] text-navy flex items-center justify-between gap-2 focus:outline-hidden"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`h-3 w-3 shrink-0 text-navy/60 transition-transform duration-200 ${
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
                        className="px-2.5 pb-2.5 pt-0.5 text-[10.5px] text-navy/80 leading-relaxed border-t border-cream-dark/40 bg-cream/30 overflow-hidden"
                      >
                        {faq.a}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </section>

          {/* ── Terms (Compact) ── */}
          <section className="card p-3 rounded-2xl bg-cream/20 border border-cream-dark">
            <h2 className="text-[11px] font-bold text-navy flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-navy/70" />
              <span>{t('referrals.terms.title')}</span>
            </h2>
            <p className="mt-1.5 whitespace-pre-line text-[10px] leading-relaxed text-navy/70">
              {t('referrals.terms.body')}
            </p>
          </section>
        </div>
      </div>

      <MobileTabBar />
    </div>
  );
}
