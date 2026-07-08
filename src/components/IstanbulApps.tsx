import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_CATEGORIES, ISTANBUL_APPS, pickAppText } from '../data/istanbulApps';
import type { AppLinks } from '../data/istanbulApps';
import { AppIcon } from './AppIcon';
import type { IconName } from './AppIcon';

const LINK_META: { key: keyof AppLinks; icon: IconName; label: string }[] = [
  { key: 'web', icon: 'globe', label: 'tricksApps.web' },
  { key: 'android', icon: 'smartphone', label: 'tricksApps.android' },
  { key: 'ios', icon: 'smartphone', label: 'tricksApps.ios' },
];

/** "Install as app" button — only shown when the browser allows installation. */
function useInstallable() {
  const w = window as unknown as { __rafiqInstall?: { prompt: () => void; userChoice: Promise<unknown> } };
  const [canInstall, setCanInstall] = useState(!!w.__rafiqInstall);
  useEffect(() => {
    const on = () => setCanInstall(true);
    window.addEventListener('rafiq-installable', on);
    return () => window.removeEventListener('rafiq-installable', on);
  }, []);
  const install = async () => {
    const p = w.__rafiqInstall;
    if (!p) return;
    p.prompt();
    await p.userChoice;
    w.__rafiqInstall = undefined;
    setCanInstall(false);
  };
  return { canInstall, install };
}

export function IstanbulApps() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const rtl = lang === 'ar' || lang === 'fa';
  const [query, setQuery] = useState('');
  const { canInstall, install } = useInstallable();

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return APP_CATEGORIES.map((cat) => {
      const apps = ISTANBUL_APPS.filter((a) => a.cat === cat.id).filter((a) => {
        if (!q) return true;
        return (
          a.name.toLowerCase().includes(q) ||
          pickAppText(a.desc, lang).toLowerCase().includes(q) ||
          pickAppText(cat.name, lang).toLowerCase().includes(q)
        );
      });
      return { cat, apps };
    }).filter((g) => g.apps.length > 0);
  }, [query, lang]);

  return (
    <section id="istanbul-apps" dir={rtl ? 'rtl' : 'ltr'} className="mt-10 scroll-mt-20">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="section-title">{t('tricksApps.title')}</h2>
        {canInstall && (
          <button onClick={install} className="btn-gold h-10 text-sm">
            <AppIcon name="download" className="w-4 h-4" />
            {t('tricksApps.install')}
          </button>
        )}
      </div>

      <div className="relative mt-4 max-w-md">
        <span className="absolute inset-y-0 start-0 flex items-center ps-3 text-navy/40">
          <AppIcon name="search" className="w-4 h-4" />
        </span>
        <input
          className="input ps-9"
          placeholder={t('tricksApps.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t('tricksApps.search')}
        />
      </div>

      {groups.length === 0 ? (
        <p className="mt-6 text-center text-sm text-navy/50">{t('tricksApps.empty')}</p>
      ) : (
        <div className="mt-6 flex flex-col gap-7">
          {groups.map(({ cat, apps }) => (
            <div key={cat.id}>
              <h3 className="font-extrabold text-navy inline-flex items-center gap-2">
                <span className="text-xl" aria-hidden="true">
                  {cat.icon}
                </span>
                {pickAppText(cat.name, lang)}
              </h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {apps.map((app) => (
                  <article key={app.name} className="card flex flex-col p-5">
                    <h4 className="font-bold text-navy" dir="ltr">
                      {app.name}
                    </h4>
                    <p className="mt-1 text-sm text-gray-500 leading-relaxed flex-1">{pickAppText(app.desc, lang)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {LINK_META.map(({ key, icon, label }) =>
                        app.links[key] ? (
                          <a
                            key={key}
                            href={app.links[key]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary !h-9 text-xs"
                          >
                            <AppIcon name={icon} className="w-3.5 h-3.5" />
                            {t(label)}
                          </a>
                        ) : null,
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
