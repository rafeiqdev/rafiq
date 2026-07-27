import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon, DirArrow } from '../../components/AppIcon';
import type { IconName } from '../../components/AppIcon';
import { PageHero } from '../../components/PageHero';
import { BANNERS } from '../../lib/images';
import { IkametCard } from '../../components/IkametCard';
import { useApp } from '../../context/AppContext';
import { SITE_URL, usePageMeta } from '../../lib/seo';
import { MobileTabBar } from '../../components/MobileTabBar';

// Pure static data — label strings are baked into the IkametCard SVG, not i18n.
const TYPES: { id: string; icon: IconName; accent: string; label: string }[] = [
  { id: 'shortTerm', icon: 'id-card', accent: '#1d5f9e', label: 'SHORT-TERM' },
  { id: 'family', icon: 'users', accent: '#2f7fc4', label: 'FAMILY' },
  { id: 'student', icon: 'graduation-cap', accent: '#3d63a5', label: 'STUDENT' },
  { id: 'longTerm', icon: 'landmark', accent: '#163f6b', label: 'LONG-TERM' },
];

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
const mobileCopy: Record<string, { back: string; home: string; chat: string; map: string; services: string; profile: string }> = {
  en: { back: 'Back', home: 'Home', chat: 'AI Chat', map: 'Map', services: 'Services', profile: 'Profile' },
  ar: { back: 'رجوع', home: 'الرئيسية', chat: 'المساعد', map: 'الخريطة', services: 'الخدمات', profile: 'حسابي' },
  fa: { back: 'بازگشت', home: 'خانه', chat: 'دستیار', map: 'نقشه', services: 'خدمات', profile: 'پروفایل' },
  ru: { back: 'Назад', home: 'Главная', chat: 'ИИ-чат', map: 'Карта', services: 'Услуги', profile: 'Профиль' },
};

export function MobileResidency() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useApp();

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.en;

  usePageMeta({
    title: `${t('residency.title')} — ${t('common.appName')}`,
    description: t('residency.subtitle'),
    image: `${SITE_URL}${BANNERS.residency}`,
  });

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className="pb-[calc(env(safe-area-inset-bottom)+88px)]">
        {/* ── Photo-hero header (editorial-content variant) ── */}
        <div className="relative animate-fade-in overflow-hidden rounded-b-[28px]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={mc.back}
            className="absolute start-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition-colors active:bg-white/30"
          >
            <AppIcon name="arrow-left" className={`h-6 w-6 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <PageHero
            image={BANNERS.residency}
            title={t('residency.title')}
            subtitle={t('residency.subtitle')}
            height="min-h-[13rem] pt-[calc(env(safe-area-inset-top)+3.75rem)]"
          />
        </div>

        <div className="flex flex-col gap-4 px-5 pt-5">
          {/* ── Warning ── */}
          <div className="amber-note flex animate-fade-up items-start gap-2.5 text-[12.5px]">
            <AppIcon name="alert-triangle" className="mt-0.5 h-[17px] w-[17px] shrink-0" />
            <span>{t('residency.warning')}</span>
          </div>

          {/* ── 4 permit-type cards (single column) ── */}
          <div className="stagger flex flex-col gap-4">
            {TYPES.map((x, i) => (
              <div
                key={x.id}
                className="card card-hover flex animate-fade-up flex-col overflow-hidden"
                style={{ '--i': i } as React.CSSProperties}
              >
                {/* İkamet illustration (always LTR so it never mirrors) */}
                <div
                  dir="ltr"
                  className="flex items-center justify-center p-5"
                  style={{ background: `${x.accent}14` }}
                >
                  <IkametCard label={x.label} accent={x.accent} />
                </div>
                <div className="flex flex-col p-[18px]">
                  <div className="flex items-center gap-3">
                    <span className="icon-chip">
                      <AppIcon name={x.icon} />
                    </span>
                    <h2 className="text-base font-extrabold text-navy">{t(`residency.types.${x.id}.title`)}</h2>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed text-gray-500">
                    {t(`residency.types.${x.id}.body`)}
                  </p>
                  <Link to={`/help?topic=residency-${x.id}`} className="btn-primary mt-4 flex min-h-[50px] w-full text-[14.5px]">
                    {t('common.helpMe')}
                    <DirArrow />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* ── Application flow ── */}
          <section className="card animate-fade-up p-5">
            <h2 className="text-[15px] font-extrabold text-navy">{t('residency.steps.title')}</h2>
            <ol className="mt-4 flex flex-col gap-3.5">
              {(['s1', 's2', 's3', 's4'] as const).map((s, i) => (
                <li key={s} className="flex items-start gap-3">
                  <span className="icon-chip !h-8 !w-8 text-[13px] font-extrabold">{i + 1}</span>
                  <p className="pt-1.5 text-[13.5px] leading-snug text-navy/80">{t(`residency.steps.${s}`)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <MobileTabBar />
    </div>
  );
}
