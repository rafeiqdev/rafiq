import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { blocksFor } from '../blocks/registry';
import { AppIcon, DirArrow } from '../components/AppIcon';

/** Smart Consultation: diagnostics dashboard derived from the profile. */
export function Smart() {
  const { t } = useTranslation();
  const { profile } = useApp();

  const hasItems = [
    ['turkishPhone', profile.has.turkishPhone],
    ['taxNumber', profile.has.taxNumber],
    ['residencePermit', profile.has.residencePermit],
    ['bankAccount', profile.has.bankAccount],
  ] as const;

  const owned = hasItems.filter(([, v]) => v).length;
  const pct = Math.round((owned / hasItems.length) * 100);
  const missing = hasItems.filter(([, v]) => !v);
  const nextBlocks = blocksFor(profile).slice(0, 4);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-extrabold text-navy">{t('smart.title')}</h1>
      <p className="mt-1 text-navy/70">{t('smart.subtitle')}</p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {/* completeness */}
        <div className="card p-6">
          <h2 className="font-bold text-navy">{t('smart.completeness')}</h2>
          <div className="mt-4 flex items-center gap-4">
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#efeadb" strokeWidth="3.5" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  stroke="#1a3a6b"
                  strokeWidth="3.5"
                  strokeDasharray={`${pct} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-extrabold text-navy">{pct}%</span>
            </div>
            <ul className="text-sm flex flex-col gap-1.5">
              {hasItems.map(([k, v]) => (
                <li key={k} className={`flex items-center gap-1.5 ${v ? 'text-green-700' : 'text-navy/60'}`}>
                  <AppIcon name={v ? 'check' : 'circle'} className="w-3.5 h-3.5" />
                  {t(`onboarding.q3.${k}.title`)}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* missing */}
        <div className="card p-6">
          <h2 className="font-bold text-navy">{t('smart.missing')}</h2>
          {missing.length === 0 ? (
            <p className="mt-4 text-sm text-green-700 font-semibold flex items-center gap-1.5">
              <AppIcon name="check-circle" className="w-4 h-4" />
              {t('smart.noMissing')}
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {missing.map(([k]) => (
                <li key={k} className="amber-note flex items-center gap-2">
                  <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
                  {t(`onboarding.q3.${k}.title`)}
                </li>
              ))}
            </ul>
          )}
          <Link to="/premium" className="btn-primary w-full mt-5">
            <AppIcon name="message-circle" className="w-4 h-4" />
            {t('smart.askAi')}
          </Link>
        </div>
      </div>

      {/* next steps */}
      <div className="card p-6 mt-5">
        <h2 className="font-bold text-navy">{t('smart.nextSteps')}</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {nextBlocks.map((b, i) => (
            <li key={b.id}>
              <Link to={b.ctaTo} className="card card-hover flex items-center gap-3 p-3">
                <span className="icon-chip !w-9 !h-9 text-sm font-extrabold">{i + 1}</span>
                <div>
                  <p className="text-sm font-semibold text-navy">{t(`blocks.${b.id}.title`)}</p>
                </div>
                <span className="ms-auto text-navy/60">
                  <DirArrow />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
