import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Share2, Copy, Check, Wallet, ArrowUpRight, LogIn } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { referrals } from '../lib/api';
import type { ReferralStats } from '../lib/api';
import { NumberTicker } from '../components/ui/NumberTicker';

/**
 * Invite & earn.
 *
 * This page used to be seven stacked blocks — a hero, a link box, five stat
 * tiles, a five-step grid, a worked "5% of $50,000" table, a six-question FAQ
 * accordion and a terms panel — all saying the same thing: share your link,
 * get 5%. The one thing a visitor comes here to DO (copy the link) was the
 * third block down, competing with a table of hypothetical earnings.
 *
 * Now: the link IS the hero, three numbers that matter, three steps, one line
 * of small print. Everything that was cut was either a repeat of the headline
 * or belongs on /wallet, which is one tap away.
 *
 * The signed-out state used to render the whole dashboard with zeros and a
 * link ending in a bare "/r/" — the origin with an empty code, a dead URL
 * which the copy button happily copied. There is no referral code before
 * sign-in, so there is no link to show: it asks them to sign in instead.
 */

const container: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } },
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

export function Referrals() {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const [stats, setStats] = useState<ReferralStats>(EMPTY);
  const [copied, setCopied] = useState(false);

  const lang = (i18n.language || 'ar').split('-')[0];
  const isRtl = lang === 'ar' || lang === 'fa';

  useEffect(() => {
    if (user) referrals.stats().then(setStats).catch(() => {});
  }, [user]);

  const code = stats.code || user?.referralCode || '';
  const link = code ? `${window.location.origin}/r/${code}` : '';

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

  const cur = stats.primaryCurrency;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={container}
      className="mx-auto max-w-3xl px-4 py-6 sm:py-10"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* ── The offer, and the link that delivers it, in one block ── */}
      <motion.section variants={item} className="rounded-3xl bg-navy p-6 sm:p-8 text-white shadow-md">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug">
          {t('referrals.title')}
        </h1>
        <p className="mt-2 text-sm text-white/75 leading-relaxed max-w-xl">{t('referrals.lead')}</p>

        {link ? (
          <div className="mt-6">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                readOnly
                value={link}
                dir="ltr"
                onFocus={(e) => e.currentTarget.select()}
                aria-label={t('referrals.yourLink')}
                className="flex-1 h-12 rounded-xl bg-white/10 border border-white/20 px-3 font-mono text-sm text-white select-all focus:outline-hidden focus:ring-2 focus:ring-white/40"
              />
              <div className="flex gap-2">
                <button
                  onClick={copy}
                  className={`h-12 px-5 rounded-xl font-bold text-sm inline-flex items-center justify-center gap-2 flex-1 sm:flex-initial transition-colors ${
                    copied ? 'bg-emerald-500 text-white' : 'bg-white text-navy hover:bg-white/90'
                  }`}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copied ? t('referrals.copied') : t('referrals.copy')}</span>
                </button>
                <button
                  onClick={share}
                  aria-label={t('referrals.share')}
                  className="h-12 px-4 rounded-xl font-bold text-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <Share2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('referrals.share')}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* No code exists until they have an account — so no link is shown. */
          <Link
            to="/auth"
            className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-white text-navy font-bold text-sm hover:bg-white/90 transition-colors"
          >
            <LogIn className="h-4 w-4" />
            {t('referrals.signedOutCta')}
          </Link>
        )}
      </motion.section>

      {/* ── Only the numbers that change behaviour; the rest lives in /wallet ── */}
      {link && (
        <motion.section variants={item} className="mt-4 grid grid-cols-3 gap-3">
          <Stat label={t('referrals.signedUp')} value={<NumberTicker value={stats.signups} />} />
          <Stat
            label={t('referrals.pending')}
            value={<span className="font-mono">{money(stats.pending, cur)}</span>}
          />
          <Stat
            label={t('referrals.available')}
            tone="emerald"
            value={<span className="font-mono">{money(stats.available, cur)}</span>}
          />
        </motion.section>
      )}

      {/* ── Three steps, one line each ── */}
      <motion.section variants={item} className="card mt-4 p-6">
        <ol className="grid gap-4 sm:grid-cols-3">
          {(['a', 'b', 'c'] as const).map((key, i) => (
            <li key={key} className="flex gap-3 sm:flex-col sm:gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-white text-xs font-extrabold">
                {i + 1}
              </span>
              <p className="text-sm text-navy/85 leading-relaxed">{t(`referrals.steps.${key}`)}</p>
            </li>
          ))}
        </ol>
      </motion.section>

      {/* ── Where the money is actually managed ── */}
      <motion.div variants={item} className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-navy/55 leading-relaxed max-w-md">{t('referrals.fine')}</p>
        <Link
          to="/wallet"
          className="btn-secondary text-sm px-4 py-2.5 rounded-xl font-bold inline-flex items-center gap-2 shrink-0"
        >
          <Wallet className="h-4 w-4" />
          {t('referrals.viewWallet')}
          <ArrowUpRight className="h-3.5 w-3.5 rtl:rotate-180" />
        </Link>
      </motion.div>
    </motion.div>
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
      className={`rounded-2xl border p-4 text-center ${
        emerald ? 'bg-emerald-50 border-emerald-200' : 'bg-cream border-cream-dark/60'
      }`}
    >
      <p
        className={`text-lg sm:text-xl font-extrabold ${emerald ? 'text-emerald-800' : 'text-navy'}`}
        dir="ltr"
      >
        {value}
      </p>
      <p className={`mt-0.5 text-xs font-medium ${emerald ? 'text-emerald-700' : 'text-navy/60'}`}>
        {label}
      </p>
    </div>
  );
}
