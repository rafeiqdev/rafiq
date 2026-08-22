import { LanguageProvider, useLanguage } from '../i18n/LanguageContext';
import { RafiqHero } from '../components/RafiqHero';
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
 * footer (RafiqHero's top nav, RafiqCinematicFooter) — Layout's own
 * header/ticker/footer are suppressed for this route in components/Layout.tsx
 * (hideChrome) so the two chromes don't stack. See HomeGate in App.tsx: this
 * component now serves both desktop and mobile guests.
 *
 * Internal links inside the ported components were rewritten from the
 * mockup's placeholder anchors/absolute rafiq.ist URLs to the site's real,
 * language-prefixed routes (e.g. `/${language}/services`) — everything else
 * (copy, layout, colors, section order) is a literal port.
 */
function HomeContent() {
  const { language, dir, t } = useLanguage();

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
    >
      <LocalBusinessSchema />
      <main className="relative z-10 w-full bg-[#FAF8F0] shadow-2xl">
        <RafiqHero />
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
