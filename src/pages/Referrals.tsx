import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { referrals } from '../lib/api';
import type { ReferralStats } from '../lib/api';
import { RequireAuth } from '../components/Gates';

function ReferralsInner() {
  const { t } = useTranslation();
  const { user } = useApp();
  const [stats, setStats] = useState<ReferralStats>({ clicks: 0, signups: 0, earnedTl: 0, code: '' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) referrals.stats().then(setStats).catch(() => {});
  }, [user]);

  const link = `${window.location.origin}/r/${stats.code || user?.referralCode || ''}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-extrabold text-navy">{t('referrals.title')}</h1>
      <p className="mt-1 text-navy/60">{t('referrals.subtitle')}</p>

      <div className="card p-6 mt-6">
        <p className="text-xs font-semibold text-navy/70">{t('referrals.yourLink')}</p>
        <div className="mt-2 flex gap-2">
          <code dir="ltr" className="input flex items-center text-xs flex-1 min-w-0 overflow-x-auto">{link}</code>
          <button
            className="btn-primary px-4 shrink-0"
            onClick={() => {
              navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? t('common.copied') : t('common.copy')}
          </button>
        </div>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
          {([
            ['invited', stats.clicks],
            ['signedUp', stats.signups],
            ['earned', `${stats.earnedTl.toLocaleString()} ${t('common.tl')}`],
          ] as const).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-cream px-3 py-4 min-w-0">
              <p className="text-lg sm:text-xl font-extrabold text-navy break-words" dir="ltr">{v}</p>
              <p className="mt-1 text-xs text-navy/60">{t(`referrals.${k}`)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6 mt-5">
        <h2 className="font-bold text-navy">{t('referrals.how.title')}</h2>
        <ol className="mt-4 flex flex-col gap-3">
          {(['step1', 'step2', 'step3'] as const).map((s, i) => (
            <li key={s} className="flex items-start gap-3">
              <span className="icon-chip !w-8 !h-8 text-sm font-extrabold">{i + 1}</span>
              <p className="text-sm text-navy/80 pt-1.5">{t(`referrals.how.${s}`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function Referrals() {
  return (
    <RequireAuth>
      <ReferralsInner />
    </RequireAuth>
  );
}
