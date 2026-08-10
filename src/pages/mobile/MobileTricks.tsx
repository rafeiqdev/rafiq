import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon, BackArrow, DirArrow } from '../../components/AppIcon';
import { PageHero } from '../../components/PageHero';
import { IstanbulApps } from '../../components/IstanbulApps';
import { BANNERS } from '../../lib/images';
import { useApp } from '../../context/AppContext';
import { MobileTabBar } from '../../components/MobileTabBar';
import { TRICK_SLUGS, TRICK_ICONS } from '../Tricks';
import type { TrickSlug } from '../Tricks';

// Cycles through three accent tints for visual rhythm across the 12 cards.
const ACCENTS = ['navy-light', 'navy', 'brand-red'] as const;
type Accent = (typeof ACCENTS)[number];

const ACCENT: Record<Accent, { chip: string; bar: string }> = {
  'navy-light': { chip: 'bg-navy-light/10 text-navy-light', bar: 'bg-navy-light' },
  navy: { chip: 'bg-navy/10 text-navy', bar: 'bg-navy' },
  'brand-red': { chip: 'bg-brand-red/10 text-brand-red', bar: 'bg-brand-red' },
};

// New mobile-only UI copy (not existing i18n keys), keyed by language code.
const mobileCopy: Record<string, { back: string; home: string; chat: string; map: string; services: string; profile: string }> = {
  en: { back: 'Back', home: 'Home', chat: 'AI Chat', map: 'Map', services: 'Services', profile: 'Profile' },
  ar: { back: 'رجوع', home: 'الرئيسية', chat: 'المساعد', map: 'الخريطة', services: 'الخدمات', profile: 'حسابي' },
  fa: { back: 'بازگشت', home: 'خانه', chat: 'دستیار', map: 'نقشه', services: 'خدمات', profile: 'پروفایل' },
  ru: { back: 'Назад', home: 'Главная', chat: 'ИИ-чат', map: 'Карта', services: 'Услуги', profile: 'Профиль' },
};

function TrickCard({ id, index }: { id: TrickSlug; index: number }) {
  const { t } = useTranslation();
  const a = ACCENT[ACCENTS[index % ACCENTS.length]];
  return (
    <article
      className="card card-hover relative flex flex-col overflow-hidden p-[18px]"
      style={{ '--i': index } as React.CSSProperties}
    >
      <span aria-hidden className={`absolute start-0 top-0 h-full w-1 ${a.bar}`} />
      <div className="flex items-start gap-3.5">
        <span className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px] ${a.chip}`}>
          <AppIcon name={TRICK_ICONS[id]} className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15.5px] font-extrabold text-navy">{t(`tricks.items.${id}.title`)}</h3>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800">
              {t('tricks.tipBadge')}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">{t(`tricks.items.${id}.body`)}</p>
        </div>
      </div>
      <Link
        to={`/tricks/${id}`}
        className="btn-primary mt-3.5 flex min-h-[48px] w-full transition-transform active:scale-[0.98]"
      >
        {t('tricks.readMore')}
        <DirArrow />
      </Link>
    </article>
  );
}

export function MobileTricks() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useApp();

  const lang = (i18n.language || 'en').split('-')[0];
  const isRTL = lang === 'ar' || lang === 'fa';
  const mc = mobileCopy[lang] ?? mobileCopy.en;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-cream">
      <div className="pb-[calc(env(safe-area-inset-bottom)+88px)]">
        {/* ── Photo-hero header (editorial variant, no fake status bar) ── */}
        <div className="relative animate-fade-in overflow-hidden rounded-b-[28px]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={mc.back}
            className="absolute start-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition-colors active:bg-white/30"
          >
            <BackArrow className="h-6 w-6" />
          </button>
          <PageHero
            image={BANNERS.tricks}
            title={t('tricks.title')}
            subtitle={t('tricks.subtitle')}
            height="min-h-[14rem] pt-[calc(env(safe-area-inset-top)+3.75rem)]"
          />
        </div>

        <div className="flex flex-col gap-6 px-5 pt-5">
          {/* ── Trick cards (single column, polished) ── */}
          <div className="stagger flex flex-col gap-3.5">
            {TRICK_SLUGS.map((id, i) => (
              <TrickCard key={id} id={id} index={i} />
            ))}
          </div>

          {/* ── Essential Istanbul apps directory (reused, unchanged) ── */}
          <IstanbulApps />

          {/* ── Closing CTA ── */}
          <section className="card animate-fade-up flex flex-col rounded-[18px] bg-navy p-[22px] text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white/15">
                <AppIcon name="message-circle" className="h-[22px] w-[22px]" />
              </span>
              <h2 className="text-[17px] font-extrabold">{t('tricks.ctaTitle')}</h2>
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-white/80">{t('tricks.ctaBody')}</p>
            <Link
              to="/premium"
              className="mt-4 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-btn bg-white text-[15px] font-bold text-navy transition-transform active:scale-[0.98]"
            >
              {t('tricks.ctaButton')}
              <DirArrow />
            </Link>
          </section>
        </div>
      </div>

      <MobileTabBar />
    </div>
  );
}
