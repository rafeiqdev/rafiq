import { useLanguage } from '../i18n/LanguageContext';
import { LanguageSwitcher } from './RafiqHero/LanguageSwitcher';
import { RafiqBrandLogo } from './ui/rafiq-brand-logo';
import { AppIcon } from './AppIcon';

/**
 * The guest homepage hero for PHONES — the owner's own brief (2026-09-02):
 * the desktop RafiqHero's landscape video is cropped to nothing on a portrait
 * screen, and its text and buttons land in the wrong places. So on phones the
 * hero is the same card the /services page opens with on desktop — a photo in
 * a rounded frame with the soft curved bottom edge and the copy centred on
 * it — but with a portrait photo and copy written for this spot. Desktop is
 * untouched; Home.tsx picks this component only under the mobile breakpoint.
 *
 * The photo is the Blue Mosque at dusk (public/img, already shipped for the
 * onboarding/journey cards) — a portrait image, so it fills the frame without
 * the crop the video needed. Copy lives here, not in the locale JSON, the same
 * way the cinematic footer keeps its own: the hero is four short strings that
 * belong to this layout alone.
 */
const COPY: Record<
  string,
  { title: string; subtitle: string; trust: string }
> = {
  ar: {
    title: 'رفيقك في إسطنبول',
    subtitle: 'الإقامة، السكن، الصحة والمعاملات — نرتّبها لك بلغتك ومع شركاء موثوقين.',
    trust: 'خدمة مباشرة + شركاء موثوقون',
  },
  en: {
    title: 'Your companion in Istanbul',
    subtitle: 'Residency, housing, health and paperwork — arranged for you in your language, with trusted partners.',
    trust: 'Direct service + trusted partners',
  },
  ru: {
    title: 'Ваш спутник в Стамбуле',
    subtitle: 'ВНЖ, жильё, здоровье и документы — организуем на вашем языке с проверенными партнёрами.',
    trust: 'Прямой сервис + проверенные партнёры',
  },
  fa: {
    title: 'همراه شما در استانبول',
    subtitle: 'اقامت، مسکن، سلامت و امور اداری — به زبان خودتان و با شرکای مطمئن برایتان ترتیب می‌دهیم.',
    trust: 'خدمات مستقیم + شرکای مطمئن',
  },
};

const PHOTO = '/img/1527838832700-5059252407fa.webp';

export function MobileHomeHero() {
  const { language, dir, isRtl, t } = useLanguage();
  const c = COPY[language] ?? COPY.ar;

  return (
    <section dir={dir} lang={language} aria-label={c.title} className="w-full bg-[#FAF8F0]">
      {/* Compact header: logo, language, sign-in. Sits under the currency
          ticker, which Home.tsx pins to the top of the viewport. */}
      <header
        className="sticky z-[100] flex h-14 items-center justify-between border-b border-[#EFEADB] bg-white/95 px-3 backdrop-blur"
        style={{ top: 'var(--rafiq-topnav-offset, 0px)' }}
      >
        <a href={`/${language}`} aria-label={t.common.brandName} className="inline-flex items-center">
          <RafiqBrandLogo size="sm" variant="dark" className="h-7 w-auto" />
        </a>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <a
            href={`/${language}/auth`}
            className="inline-flex items-center rounded-full bg-[#1A3A6B] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm"
          >
            {t.common.signIn}
          </a>
        </div>
      </header>

      {/* The framed photo with the curved bottom edge — the /services card. */}
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="mobileHomeHeroCurve" clipPathUnits="objectBoundingBox">
            <path d="M0,0 H1 V0.95 C0.77,0.95 0.63,1 0.46,1 C0.29,1 0.17,0.955 0,0.95 Z" />
          </clipPath>
        </defs>
      </svg>
      <div className="px-3 pt-3">
        <div
          className="relative overflow-hidden rounded-[28px] bg-[#1A3A6B] shadow-lg shadow-[#1A3A6B]/15"
          style={{ clipPath: 'url(#mobileHomeHeroCurve)' }}
        >
          <img
            src={PHOTO}
            alt=""
            aria-hidden="true"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover object-[50%_35%]"
          />
          {/* the dusk sky stays untouched up top; the bottom half darkens so
              the copy and buttons stay legible */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent from-30% via-[#0A1832]/45 via-60% to-[#0A1832]/90" />

          <div className="relative flex min-h-[520px] flex-col items-center justify-end px-5 pb-14 pt-24 text-center text-white">
            <h1 className="text-[1.9rem] font-extrabold leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
              {c.title}
            </h1>
            <p className="mt-3 max-w-[18rem] text-[0.95rem] leading-relaxed text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
              {c.subtitle}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-[#1A3A6B] shadow-sm ring-1 ring-[#1A3A6B]/10 backdrop-blur">
              <AppIcon name="shield-check" className="h-4 w-4" />
              {c.trust}
            </div>

            {/* Both actions full-width, stacked, thumb-height. */}
            <div className="mt-6 flex w-full max-w-xs flex-col gap-2.5">
              <a
                href={`/${language}/auth`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white text-[0.95rem] font-bold text-[#1A3A6B] shadow-xl shadow-black/20"
              >
                {t.hero.primaryCta}
                <AppIcon name={isRtl ? 'arrow-left' : 'arrow-right'} className="h-4 w-4" />
              </a>
              <a
                href={`/${language}/services`}
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/50 bg-white/15 text-[0.95rem] font-bold text-white backdrop-blur"
              >
                {t.hero.secondaryCta}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default MobileHomeHero;
