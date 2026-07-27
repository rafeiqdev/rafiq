import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { pickText, normalizeSearch, keywordsFor } from '../../data/services';
import type { ServiceItem, ServiceType } from '../../data/services';
import { useCatalog } from '../../data/catalogStore';
import { useApp } from '../../context/AppContext';
import { AppIcon } from '../../components/AppIcon';
import { ServiceActionModal } from '../../components/ServiceActionModal';
import { usePageMeta } from '../../lib/seo';
import { track } from '../../lib/analytics';

// Same trimmed landing set as the desktop catalog: only these 6 categories show
// by default; a search or an explicit category pick reveals the full set.
const POPULAR_CATEGORY_IDS = ['residency', 'realestate', 'health', 'banking', 'translation', 'tourism'];

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
const mobileCopy: Record<string, { home: string; chat: string; map: string; services: string; profile: string }> = {
  en: { home: 'Home', chat: 'AI Chat', map: 'Map', services: 'Services', profile: 'Profile' },
  ar: { home: 'الرئيسية', chat: 'المساعد', map: 'الخريطة', services: 'الخدمات', profile: 'حسابي' },
  fa: { home: 'خانه', chat: 'دستیار', map: 'نقشه', services: 'خدمات', profile: 'پروفایل' },
  ru: { home: 'Главная', chat: 'ИИ-чат', map: 'Карта', services: 'Услуги', profile: 'Профиль' },
};

function TypeBadge({ type }: { type: ServiceType }) {
  const { t } = useTranslation();
  if (type === 'partner') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft text-gold-dark text-[10px] font-bold px-2 py-0.5">
        <AppIcon name="shield-check" className="w-3 h-3" />
        {t('services.partnerBadge')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-blue text-navy text-[10px] font-bold px-2 py-0.5">
      <AppIcon name="check" className="w-3 h-3" />
      {t('services.directBadge')}
    </span>
  );
}

/** Full-width, single-column touch card. Whole card is the tap target; the
 *  bottom "help me" bar is decorative (pointer-events-none), as on desktop. */
function ServiceCard({ service, onOpen }: { service: ServiceItem; onOpen: () => void }) {
  const { t, i18n } = useTranslation();
  return (
    <button onClick={onOpen} className="card card-hover flex w-full flex-col p-4 text-start">
      <div className="flex items-start gap-3">
        <span className="icon-chip shrink-0">
          <AppIcon name={service.icon} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14.5px] font-bold leading-snug text-navy">{pickText(service.title, i18n.language)}</h3>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-500">{pickText(service.desc, i18n.language)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TypeBadge type={service.type} />
        {service.onRequest && (
          <span className="inline-flex items-center gap-1 rounded-full bg-cream-dark text-navy/70 text-[10px] font-bold px-2 py-0.5">
            <AppIcon name="clock" className="w-3 h-3" />
            {t('services.onRequest')}
          </span>
        )}
      </div>
      <span className="btn-primary pointer-events-none mt-3.5 h-[42px] w-full text-xs">
        <AppIcon name="message-circle" className="w-4 h-4" />
        {t('common.helpMe')}
      </span>
    </button>
  );
}

export function MobileServices() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useApp();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [category, setCategory] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ServiceType>('all');
  const [active, setActive] = useState<ServiceItem | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const { services, categories } = useCatalog();

  usePageMeta({
    title: `${t('services.title')} — ${t('common.appName')}`,
    description: t('services.subtitle'),
  });

  const langCode = (lang || 'en').split('-')[0];
  const isRTL = langCode === 'ar' || langCode === 'fa';
  const mc = mobileCopy[langCode] ?? mobileCopy.en;

  const matches = useMemo(() => {
    const nq = normalizeSearch(query);
    const tokens = nq.split(' ').filter((tk) => tk.length >= 2);
    return services.filter((s) => {
      if (category !== 'all' && s.category !== category) return false;
      if (typeFilter !== 'all' && s.type !== typeFilter) return false;
      if (!nq) return true;
      const hay = normalizeSearch(
        [s.title.ar, s.title.en, s.title.tr, s.desc.ar, s.desc.en, s.desc.tr, keywordsFor(s.id)].join(' '),
      );
      return hay.includes(nq) || tokens.some((tk) => hay.includes(tk));
    });
  }, [query, category, typeFilter, services]);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const id = setTimeout(() => {
      track('search_performed', { meta: { query_len: q.length, result_count: matches.length } });
    }, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const trimToPopular = category === 'all' && !query.trim() && !showAllCategories;
  const chipCategories = trimToPopular ? categories.filter((c) => POPULAR_CATEGORY_IDS.includes(c.id)) : categories;
  const visibleCategories = (trimToPopular ? chipCategories : categories).filter((c) =>
    matches.some((s) => s.category === c.id),
  );

  const tabs = [
    { to: '/', icon: 'home', label: mc.home },
    { to: '/premium', icon: 'message-circle', label: mc.chat },
    { to: '/map', icon: 'map', label: mc.map },
    { to: '/services', icon: 'layers', label: mc.services },
    { to: user ? '/profile' : '/auth', icon: 'user', label: mc.profile },
  ] as const;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className="pb-[calc(env(safe-area-inset-bottom)+88px)]">
        {/* ── Tab-root header (no back button, like Home) ── */}
        <header className="relative overflow-hidden rounded-b-[28px] bg-navy px-5 pb-6 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <span
            aria-hidden="true"
            className="pointer-events-none select-none absolute -bottom-12 -end-3.5 text-[9.5rem] font-bold leading-none text-white/5"
          >
            ر
          </span>
          <div className="relative animate-fade-up">
            <h1 className="text-2xl font-extrabold leading-tight text-white">{t('services.title')}</h1>
            <p className="mt-1 text-[13.5px] leading-snug text-white/70">{t('services.subtitle')}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/90">
              <AppIcon name="shield-check" className="h-3 w-3" />
              {t('services.trustNote')}
            </span>
          </div>
        </header>

        <div className="px-5 pt-5">
          {/* ── Search ── */}
          <div className="animate-fade-up relative">
            <span className="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-navy/40">
              <AppIcon name="search" className="h-4.5 w-4.5" />
            </span>
            <input
              className="input h-[50px] w-full ps-11 text-base"
              placeholder={t('services.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* ── Type filter (3 pills, one row) ── */}
          <div className="mt-3.5 flex gap-2">
            {(['all', 'direct', 'partner'] as const).map((tp) => (
              <button
                key={tp}
                onClick={() => setTypeFilter(tp)}
                aria-pressed={typeFilter === tp}
                className={`h-11 flex-1 rounded-full text-[12.5px] font-bold transition-colors ${
                  typeFilter === tp ? 'bg-navy text-white' : 'bg-white border border-cream-dark text-navy/70'
                }`}
              >
                {t(`services.type.${tp}`)}
              </button>
            ))}
          </div>

          {/* ── Category chips (horizontal scroll, hidden scrollbar) ── */}
          <div className="mt-3.5 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setCategory('all')}
              aria-pressed={category === 'all'}
              className={`h-10 shrink-0 rounded-full px-4 text-[12.5px] font-bold transition-colors ${
                category === 'all' ? 'bg-gold text-white' : 'bg-white border border-cream-dark text-navy/70'
              }`}
            >
              {t('services.allCategories')}
            </button>
            {chipCategories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                aria-pressed={category === c.id}
                className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-bold transition-colors ${
                  category === c.id ? 'bg-gold text-white' : 'bg-white border border-cream-dark text-navy/70'
                }`}
              >
                <AppIcon name={c.icon} className="h-3.5 w-3.5" />
                {pickText(c.title, lang)}
              </button>
            ))}
            {trimToPopular ? (
              <button
                onClick={() => setShowAllCategories(true)}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-navy/30 px-4 text-[12.5px] font-bold text-navy/70 transition-colors"
              >
                {t('services.allCategories')} +
              </button>
            ) : (
              !query.trim() &&
              category === 'all' && (
                <button
                  onClick={() => setShowAllCategories(false)}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-navy/30 px-4 text-[12.5px] font-bold text-navy/70 transition-colors"
                >
                  {t('common.showLess')}
                </button>
              )
            )}
          </div>

          {/* ── Results ── */}
          {visibleCategories.length === 0 ? (
            <div className="card animate-pop mt-5 p-10 text-center">
              <div className="icon-chip mx-auto">
                <AppIcon name="search" className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm text-gray-500">{t('services.noResults')}</p>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-7">
              {visibleCategories.map((c) => {
                const items = matches.filter((s) => s.category === c.id);
                return (
                  <section key={c.id} className="animate-fade-up">
                    <div className="flex items-center gap-2.5">
                      <span className="icon-chip !h-[34px] !w-[34px]">
                        <AppIcon name={c.icon} className="h-4 w-4" />
                      </span>
                      <h2 className="min-w-0 flex-1 text-[17px] font-extrabold text-navy">{pickText(c.title, lang)}</h2>
                      <span className="shrink-0 text-xs text-navy/50">({items.length})</span>
                    </div>
                    <div className="mt-3.5 flex flex-col gap-3">
                      {items.map((s) => (
                        <ServiceCard
                          key={s.id}
                          service={s}
                          onOpen={() => {
                            track('service_click', { target: s.id, meta: { category: s.category } });
                            setActive(s);
                          }}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom tab bar — verbatim from MobileHome.tsx; Services active ── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-cream-dark pb-[env(safe-area-inset-bottom,0px)]">
        <div className="grid grid-cols-5">
          {tabs.map((tab) => {
            const isActive =
              tab.to === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.icon}
                to={tab.to}
                className={`flex flex-col items-center justify-center gap-1 min-h-[56px] pt-2 pb-1.5 ${
                  isActive ? 'text-navy' : 'text-navy/40'
                }`}
              >
                <AppIcon name={tab.icon} className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-none">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {active && <ServiceActionModal service={active} onClose={() => setActive(null)} />}
    </div>
  );
}
