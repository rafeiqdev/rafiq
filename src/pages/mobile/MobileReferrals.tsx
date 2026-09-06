import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Share2, Copy, Check, Wallet, ArrowUpRight, LogIn } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { referrals } from '../../lib/api';
import type { ReferralStats } from '../../lib/api';
import { BackArrow } from '../../components/AppIcon';
import { MobileTabBar } from '../../components/MobileTabBar';
import { NumberTicker } from '../../components/ui/NumberTicker';

/**
 * Phone version of "invite & earn" — see the note on ../Referrals.tsx for why
 * the FAQ, the worked commission table, the five-step grid and the terms
 * panel are gone. On a phone that stack was seven full screens of scrolling
 * to reach one Copy button.
 */

// New mobile-only chrome copy (not existing i18n keys), keyed by language.
const mobileCopy: Record<string, { back: string }> = {
  en: { back: 'Back' },
  ar: { back: 'رجوع' },
  fa: { back: 'بازگشت' },
  ru: { back: 'Назад' },
};

function money(amount: number, currency: string): string {
  const n = amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  if (currency === 'USD') return `$${n}`;
  if (currency === 'EUR') return `€${n}`;
  if (currency === 'TRY') return `${n} TL`;
  return `${n} ${currency}`;
}

const EMPTY: ReferralStats = {
  clicks: 0, signups: 0, code: '', totalCommissions: 0, pending: 0,
  available: 0, paid: 0, primaryCurrency: 'USD', currencies: {}, earnedTl: 0,
};

export function MobileReferrals() {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const navigate = useNavigate();
  const [stats, setStats] = useState<ReferralStats>(EMPTY);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) referrals.stats().then(setStats).catch(() => {});
  }, [user]);

  const code = stats.code || user?.referralCode || '';
  const link = code ? `${window.location.origin}/r/${code}` : '';

  const lang = (i18n.language || 'ar').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.ar;
  const cur = stats.primaryCurrency;

  const copy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: t('referrals.title'), text: t('referrals.shareText'), url: link });
        return;
      } catch {
        /* dismissed — fall through to copying */
      }
    }
    copy();
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className="pb-[calc(env(safe-area-inset-bottom)+80px)]">
        <header className="bg-navy px-4 pb-5 pt-[calc(env(safe-area-inset-top)+0.6rem)] text-white">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label={mc.back}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20 shrink-0"
            >
              <BackArrow className="h-3.5 w-3.5" />
            </button>

            <div className="inline-flex items-center p-0.5 bg-white/10 rounded-xl border border-white/15">
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-navy">
                {t('referrals.tabReferrals')}
              </span>
              <Link
                to="/wallet"
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white/80 active:bg-white/10 inline-flex items-center gap-1"
              >
                <Wallet className="h-2.5 w-2.5" />
                <span>{t('referrals.tabWallet')}</span>
              </Link>
            </div>
          </div>

          <h1 className="mt-4 text-lg font-extrabold leading-snug">{t('referrals.title')}</h1>
          <p className="mt-1 text-xs leading-relaxed text-white/75">{t('referrals.lead')}</p>

          {link ? (
            <div className="mt-4">
              <input
                type="text"
                readOnly
                value={link}
                dir="ltr"
                onFocus={(e) => e.currentTarget.select()}
                aria-label={t('referrals.yourLink')}
                className="w-full h-11 rounded-xl bg-white/10 border border-white/20 px-3 font-mono text-xs text-white select-all focus:outline-hidden focus:ring-2 focus:ring-white/40"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={copy}
                  className={`flex-1 h-11 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors ${
                    copied ? 'bg-emerald-500 text-white' : 'bg-white text-navy'
                  }`}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copied ? t('referrals.copied') : t('referrals.copy')}</span>
                </button>
                <button
                  onClick={share}
                  aria-label={t('referrals.share')}
                  className="h-11 px-4 rounded-xl bg-white/10 border border-white/20 text-white inline-flex items-center justify-center"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            /* No account, no referral code — so there is no link to show. */
            <Link
              to="/auth"
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-navy text-sm font-bold"
            >
              <LogIn className="h-4 w-4" />
              {t('referrals.signedOutCta')}
            </Link>
          )}
        </header>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col gap-3 px-3 pt-3"
        >
          {link && (
            <section className="grid grid-cols-3 gap-2">
              <Stat label={t('referrals.signedUp')} value={<NumberTicker value={stats.signups} />} />
              <Stat label={t('referrals.pending')} value={money(stats.pending, cur)} />
              <Stat label={t('referrals.available')} value={money(stats.available, cur)} tone="emerald" />
            </section>
          )}

          <section className="card p-4 rounded-2xl">
            <ol className="space-y-3">
              {(['a', 'b', 'c'] as const).map((key, i) => (
                <li key={key} className="flex gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-white text-[11px] font-extrabold">
                    {i + 1}
                  </span>
                  <p className="text-xs leading-relaxed text-navy/85 pt-0.5">
                    {t(`referrals.steps.${key}`)}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <p className="px-1 text-[11px] leading-relaxed text-navy/55">{t('referrals.fine')}</p>

          <Link
            to="/wallet"
            className="btn-secondary flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold"
          >
            <Wallet className="h-4 w-4" />
            {t('referrals.viewWallet')}
            <ArrowUpRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
        </motion.div>
      </div>

      <MobileTabBar />
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'plain',
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'plain' | 'emerald';
}) {
  const emerald = tone === 'emerald';
  return (
    <div
      className={`rounded-2xl border p-3 text-center ${
        emerald ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-cream-dark'
      }`}
    >
      <p
        className={`text-sm font-extrabold font-mono ${emerald ? 'text-emerald-800' : 'text-navy'}`}
        dir="ltr"
      >
        {value}
      </p>
      <p className={`mt-0.5 text-[10px] font-medium ${emerald ? 'text-emerald-700' : 'text-navy/60'}`}>
        {label}
      </p>
    </div>
  );
}
