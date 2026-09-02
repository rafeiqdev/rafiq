import { LanguageProvider, useLanguage } from '../i18n/LanguageContext';
import { TopRatesBar } from '../components/TopRatesBar';
import { RafiqHero } from '../components/RafiqHero';
import { MobileHomeHero } from '../components/MobileHomeHero';
import { useIsMobile } from '../hooks/useIsMobile';
import { LogoCloudSection } from '../components/ui/logo-cloud-section';
import { HowItWorks } from '../components/ui/how-it-works';
import { CoverflowCarousel } from '../components/ui/coverflow-carousel';
import { RafiqMarqueeDivider } from '../components/ui/rafiq-marquee-divider';
import { RafiqConnectionAnimationSection } from '../components/ui/rafiq-connection-animation-section';
import { HabitFaqScroller } from '../components/ui/habit-faq-scroller';
import { RafiqCinematicFooter } from '../components/ui/rafiq-cinematic-footer';
import { LocalBusinessSchema } from '../components/LocalBusinessSchema';
import { usePageMeta } from '../lib/seo';

/**
 * Guest homepage — ported 2026-08-22 from the standalone Antigravity design
 * ("جاهز للانتقال إلى Cloud.md" / the "rafiq hero" project). A full replacement
 * of the previous marketing layout, not an addition next to it.
 *
 * The mockup was built as a self-contained page with its own header and
 * footer (RafiqHero's top nav, RafiqCinematicFooter) — Layout's own ticker +
 * nav bar are suppressed for this route in components/Layout.tsx (hideChrome)
 * so the two headers don't stack, but the informational SiteFooter still
 * renders underneath the new cinematic footer (see the SiteFooter comment in
 * Layout.tsx), and the currency ticker (TopRatesBar) is re-added here,
 * pinned above RafiqHero's own fixed nav via --rafiq-topnav-offset. See
 * HomeGate in App.tsx: this component now serves both desktop and mobile
 * guests.
 *
 * Internal links inside the ported components were rewritten from the
 * mockup's placeholder anchors/absolute rafiq.ist URLs to the site's real,
 * language-prefixed routes (e.g. `/${language}/services`) — everything else
 * (copy, layout, colors, section order) is a literal port.
 */
function HomeContent() {
  const { language, dir, t } = useLanguage();
  // Phones get the framed-photo hero (see MobileHomeHero): the desktop hero's
  // landscape video and its text/button placement don't survive a portrait
  // screen. Everything below the hero is shared.
  const isMobile = useIsMobile();

  usePageMeta({
    title: `${t.common.brandName} — ${t.common.tagline}`,
    description: t.hero.supportingText,
  });

  return (
    <div
      id="rafiq-home-v2"
      dir={dir}
      lang={language}
      className="relative w-full min-h-screen bg-[#FAF8F0] text-[#12294D] font-sans selection:bg-[#1A3A6B]/15 overflow-x-hidden"
      style={{ ['--rafiq-topnav-offset' as string]: '2.25rem' }}
    >
      <div className="fixed inset-x-0 top-0 z-[110]">
        <TopRatesBar />
      </div>
      <LocalBusinessSchema />
      <main className="relative z-10 w-full bg-[#FAF8F0] shadow-2xl">
        {isMobile ? <MobileHomeHero /> : <RafiqHero />}
        <LogoCloudSection />
        <HowItWorks />
        <CoverflowCarousel />
        <RafiqMarqueeDivider />
        <RafiqConnectionAnimationSection />
        <HabitFaqScroller />
      </main>
      <RafiqCinematicFooter />
    </div>
  );
}

export function Home() {
  return (
    <LanguageProvider>
      <HomeContent />
    </LanguageProvider>
  );
}

export default Home;
