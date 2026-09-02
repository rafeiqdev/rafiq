import React, { useRef, useState, useEffect } from 'react';
import styles from './RafiqHero.module.css';
import {
  HomeIcon,
  AiAssistantIcon,
  MapIcon,
  ServicesGridIcon,
  ChevronDownIcon,
  TrekIcon,
  RealEstateIcon,
  HealthTourismIcon,
  ResidenceIcon,
  InviteEarnIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from './icons';
import type { RafiqHeroProps, HeroCtaButton, TopNavItem, TopNavSubItem } from './types';
import { TypingAnimation } from '@/registry/magicui/typing-animation';
import { WordRotate } from '@/registry/magicui/word-rotate';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { RafiqBrandLogo } from '@/components/ui/rafiq-brand-logo';

// Default asset paths
const DEFAULT_POSTER = new URL('./assets/istanbul-poster.jpg', import.meta.url).href;
const DEFAULT_VIDEO = new URL('./assets/istanbul-video.mp4', import.meta.url).href;

/**
 * Show the poster only (no video request at all) when the visitor asked for
 * reduced motion, is on a phone-sized viewport, or has data saver on. The
 * clip is the single heaviest download on the home page and on a small
 * screen it is mostly hidden behind the copy anyway.
 */
function shouldSkipVideo(): boolean {
  if (typeof window === 'undefined') return false;
  const saveData = Boolean(
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData,
  );
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    window.matchMedia('(max-width: 767px)').matches ||
    saveData
  );
}
const DEFAULT_LOGO = new URL('./assets/rafiq-logo.svg', import.meta.url).href;

/**
 * RafiqHero Component
 * 
 * Multilingual Hero section supporting Arabic, English, Persian, and Russian.
 * Features official Rafiq logo, glassmorphic Language Switcher, dynamic Services dropdown,
 * cinematic video background, and localized CTA buttons.
 */
export const RafiqHero: React.FC<RafiqHeroProps> = ({
  videoSrc = DEFAULT_VIDEO,
  posterSrc = DEFAULT_POSTER,
  logoSrc = DEFAULT_LOGO,
  headline,
  headlineWords,
  animationType = 'rotate',
  rotateDuration = 2500,
  enableTypingAnimation = true,
  typeSpeed = 30,
  deleteSpeed = 20,
  pauseDelay = 1400,
  loop = true,
  supportingText,
  primaryCta,
  secondaryCta,
  topNavItems,
  className = '',
  style,
  autoPlay = true,
  onVideoError,
}) => {
  const { language, dir, isRtl, t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [videoLoaded, setVideoLoaded] = useState<boolean>(false);
  // Initialised synchronously (not in the effect below) so the <video> is
  // never mounted on the first paint of a phone: mounting it even briefly
  // starts the download before the effect can unmount it.
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => shouldSkipVideo());
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Dynamic Navigation Items based on active language.
  // hrefs point at the site's real routes (language-prefixed, matching the
  // router's basename) rather than the mockup's placeholder anchors/absolute
  // rafiq.ist URLs — see PORT_NOTES in this file's sibling components.
  const defaultSubItems: TopNavSubItem[] = [
    {
      id: 'all-services',
      label: t.nav.subItems.allServices.label,
      description: t.nav.subItems.allServices.desc,
      href: `/${language}/services`,
      icon: <ServicesGridIcon size={20} />,
    },
    {
      id: 'istanbul-trek',
      label: t.nav.subItems.guide.label,
      description: t.nav.subItems.guide.desc,
      href: `/${language}/map`,
      icon: <TrekIcon size={20} />,
    },
    {
      id: 'residence-procedures',
      label: t.nav.subItems.residence.label,
      description: t.nav.subItems.residence.desc,
      href: `/${language}/services?category=residence`,
      icon: <ResidenceIcon size={20} />,
    },
    {
      id: 'real-estate',
      label: t.nav.subItems.realEstate.label,
      description: t.nav.subItems.realEstate.desc,
      href: `/${language}/real-estate`,
      icon: <RealEstateIcon size={20} />,
    },
    {
      id: 'health-tourism',
      label: t.nav.subItems.health.label,
      description: t.nav.subItems.health.desc,
      href: `/${language}/health-tourism`,
      icon: <HealthTourismIcon size={20} />,
    },
    {
      id: 'invite-earn',
      label: t.nav.subItems.referral.label,
      description: t.nav.subItems.referral.desc,
      href: `/${language}/referrals`,
      icon: <InviteEarnIcon size={20} />,
    },
  ];

  const defaultTopNav: TopNavItem[] = [
    {
      id: 'home',
      label: t.nav.home,
      href: `/${language}`,
      icon: <HomeIcon size={17} />,
      isActive: true,
    },
    {
      id: 'services',
      label: t.nav.services,
      icon: <ServicesGridIcon size={17} />,
      subItems: defaultSubItems,
    },
    {
      id: 'map',
      label: t.nav.cityGuide,
      href: `/${language}/map`,
      icon: <MapIcon size={17} />,
    },
    {
      id: 'ai-assistant',
      label: t.nav.aiConcierge,
      href: `/${language}/premium`,
      icon: <AiAssistantIcon size={17} />,
    },
  ];

  const effectiveNavItems = topNavItems || defaultTopNav;

  // Determine the effective words to animate based on language
  const effectiveWords = headlineWords && headlineWords.length > 0
    ? headlineWords
    : t.hero.headlineWords;

  const effectiveSupportingText = supportingText || t.hero.supportingText;

  const effectivePrimaryCta: HeroCtaButton = primaryCta || {
    label: t.hero.primaryCta,
    href: `/${language}/auth`,
    ariaLabel: t.hero.primaryCta,
  };

  const effectiveSecondaryCta: HeroCtaButton = secondaryCta || {
    label: t.hero.secondaryCta,
    href: '#services-categories',
    ariaLabel: t.hero.secondaryCta,
  };

  // Keep the initial decision (see shouldSkipVideo) in sync when the visitor
  // rotates, resizes past the phone breakpoint, or toggles reduced motion.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const phoneQuery = window.matchMedia('(max-width: 767px)');
    const update = () => setReducedMotion(shouldSkipVideo());
    update();

    motionQuery.addEventListener('change', update);
    phoneQuery.addEventListener('change', update);
    return () => {
      motionQuery.removeEventListener('change', update);
      phoneQuery.removeEventListener('change', update);
    };
  }, []);

  // Safe video autoplay handling
  useEffect(() => {
    if (!videoRef.current || reducedMotion || !autoPlay) return;

    const playPromise = videoRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setVideoLoaded(true);
        })
        .catch(() => {
          setVideoLoaded(false);
          if (onVideoError) onVideoError();
        });
    }
  }, [reducedMotion, autoPlay, videoSrc, onVideoError]);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleVideoCanPlay = () => {
    setVideoLoaded(true);
  };

  const handleVideoError = () => {
    setVideoLoaded(false);
    if (onVideoError) onVideoError();
  };

  const toggleDropdown = (itemId: string) => {
    setActiveDropdown((prev) => (prev === itemId ? null : itemId));
  };

  // Helper to render accessible CTA button or link using Button component
  const renderCta = (button: HeroCtaButton, isPrimary: boolean) => {
    const btnClasses = cn(
      "font-sans font-bold transition-all duration-200 hover:-translate-y-0.5 rounded-full px-6 sm:px-8 py-2.5 sm:py-3 text-base sm:text-[1.05rem]",
      isPrimary
        ? "bg-white hover:bg-[#FAF8F0] text-[#1A3A6B] shadow-xl shadow-black/20 border border-white hover:shadow-2xl"
        : "bg-white/20 hover:bg-white/30 text-white backdrop-blur-xl border border-white/40 shadow-lg hover:border-white/60",
      button.className
    );

    if (button.href) {
      return (
        <Button
          key={button.label}
          asChild
          variant={isPrimary ? 'primary' : 'secondary'}
          size="hero"
          className={btnClasses}
        >
          <a
            href={button.href}
            onClick={button.onClick}
            target={button.target}
            rel={button.rel || (button.target === '_blank' ? 'noopener noreferrer' : undefined)}
            aria-label={button.ariaLabel || button.label}
          >
            <span>{button.label}</span>
          </a>
        </Button>
      );
    }

    return (
      <Button
        key={button.label}
        type="button"
        variant={isPrimary ? 'primary' : 'secondary'}
        size="hero"
        onClick={button.onClick}
        className={btnClasses}
        aria-label={button.ariaLabel || button.label}
      >
        <span>{button.label}</span>
      </Button>
    );
  };

  return (
    <section
      role="banner"
      aria-label="Welcome section — Rafiq Istanbul"
      dir={dir}
      lang={language}
      className={`${styles.heroRoot} ${className}`.trim()}
      style={style}
    >
      {/* Background Media Layer */}
      <div className={styles.mediaContainer}>
        {/* High-definition poster fallback */}
        <img
          src={posterSrc}
          alt=""
          aria-hidden="true"
          className={styles.bgPoster}
          style={{ opacity: videoLoaded && !reducedMotion ? 0 : 1 }}
        />

        {/* Cinematic Video Background */}
        {!reducedMotion && (
          <video
            ref={videoRef}
            src={videoSrc}
            poster={posterSrc}
            autoPlay={autoPlay}
            muted
            loop
            playsInline
            controls={false}
            preload="metadata"
            onCanPlay={handleVideoCanPlay}
            onError={handleVideoError}
            aria-hidden="true"
            tabIndex={-1}
            className={styles.bgVideo}
            style={{ opacity: videoLoaded ? 1 : 0 }}
          />
        )}
      </div>

      {/* Atmospheric Overlays for Contrast & Readability */}
      <div className={styles.overlayDirectional} aria-hidden="true" />
      <div className={styles.overlayVignette} aria-hidden="true" />

      {/* Soft Bottom Transition Gradient and Organic Curve */}
      <div className={styles.bottomTransitionGradient} aria-hidden="true" />
      <svg
        className={styles.bottomWaveTransition}
        viewBox="0 0 1440 48"
        fill="currentColor"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0,24 C360,48 720,8 1080,32 C1260,44 1380,30 1440,24 L1440,48 L0,48 Z" />
      </svg>

      {/* Top Fixed Navigation Header (Logo, Home, Service, Map, AI Assistant, Language Switcher, CTA) */}
      <header className={styles.topNavHeader} ref={dropdownRef}>
        <div className={styles.topNavContainer}>
          {/* Brand Logo */}
          <div className={styles.navBrandSlot}>
            <a href={`/${language}`} className={styles.logoLink} aria-label={t.common.brandName}>
              {logoSrc === DEFAULT_LOGO ? (
                <RafiqBrandLogo size="md" variant="dark" className="h-8 w-auto" />
              ) : (
                <img src={logoSrc} alt={t.common.brandName} className={styles.brandLogo} />
              )}
            </a>
          </div>

          {/* Navigation Links in Center */}
          <nav className={styles.navItemsContainer} aria-label="Main site navigation">
            {effectiveNavItems.map((item) => {
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const isOpen = activeDropdown === item.id;
              const btnClasses = `${styles.navButton} ${
                item.isActive ? styles.navButtonActive : ''
              }`.trim();

              if (hasSubItems) {
                return (
                  <div key={item.id} className={styles.navItemWrapper}>
                    <button
                      type="button"
                      className={btnClasses}
                      onClick={() => toggleDropdown(item.id)}
                      aria-expanded={isOpen}
                      aria-haspopup="true"
                    >
                      {item.icon && <span className={styles.navIconWrapper}>{item.icon}</span>}
                      <span>{item.label}</span>
                      <span
                        className={`${styles.chevronIcon} ${
                          isOpen ? styles.chevronIconOpen : ''
                        }`}
                      >
                        <ChevronDownIcon size={14} />
                      </span>
                    </button>

                    {/* Service Dropdown Floating Horizontal Card Grid */}
                    {isOpen && (
                      <div className={styles.dropdownMenu} role="menu" aria-label="Services Menu">
                        <div className={styles.dropdownHeader}>
                          <span className={styles.dropdownHeaderTitle}>{t.nav.featuredServicesTitle}</span>
                        </div>
                        <div className={styles.dropdownGrid}>
                          {item.subItems?.map((sub) => (
                            <a
                              key={sub.id}
                              href={sub.href || `#${sub.id}`}
                              className={styles.dropdownCard}
                              role="menuitem"
                              onClick={(e) => {
                                setActiveDropdown(null);
                                if (sub.onClick) sub.onClick(e);
                              }}
                            >
                              <div className={styles.dropdownCardIcon}>
                                {sub.icon}
                              </div>
                              <div className={styles.dropdownCardText}>
                                <div className={styles.dropdownCardTitleRow}>
                                  <span className={styles.dropdownCardTitle}>{sub.label}</span>
                                  <span className={styles.dropdownCardArrow}>
                                    {isRtl ? <ArrowLeftIcon size={13} /> : <ArrowRightIcon size={13} />}
                                  </span>
                                </div>
                                {sub.description && (
                                  <p className={styles.dropdownCardDesc}>{sub.description}</p>
                                )}
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={item.id} className={styles.navItemWrapper}>
                  <a
                    href={item.href || '#'}
                    className={btnClasses}
                    onClick={item.onClick}
                    aria-current={item.isActive ? 'page' : undefined}
                  >
                    {item.icon && <span className={styles.navIconWrapper}>{item.icon}</span>}
                    <span>{item.label}</span>
                  </a>
                </div>
              );
            })}
          </nav>

          {/* Right Action Slot: Language Switcher + Sign In / Login Button */}
          <div className={`${styles.navCtaSlot} flex items-center gap-2 sm:gap-3`}>
            <LanguageSwitcher />

            <a
              href={`/${language}/auth`}
              className={styles.navCtaButton}
            >
              {t.common.signIn}
            </a>
          </div>
        </div>
      </header>

      {/* Hero Content Container */}
      <div className={styles.contentWrapper}>
        <div className={styles.textSection}>
          {/* Main Headline with Modern Fast Fluid Animation */}
          <h1 className={styles.headline}>
            {enableTypingAnimation && !reducedMotion ? (
              animationType === 'rotate' ? (
                <WordRotate
                  key={`rotate-${language}`}
                  words={effectiveWords}
                  duration={rotateDuration}
                />
              ) : animationType === 'typing' ? (
                <TypingAnimation
                  key={`typing-${language}`}
                  words={effectiveWords}
                  typeSpeed={typeSpeed}
                  deleteSpeed={deleteSpeed}
                  pauseDelay={pauseDelay}
                  loop={loop}
                  cursorClassName={styles.typingCursor}
                />
              ) : (
                <span>{headline || effectiveWords[0]}</span>
              )
            ) : (
              <span>{headline || effectiveWords[0]}</span>
            )}
          </h1>

          {/* Supporting Text */}
          {effectiveSupportingText && (
            <p className={styles.supportingText}>{effectiveSupportingText}</p>
          )}

          {/* Cosmic Glow CTA Buttons */}
          <div className={styles.buttonGroup}>
            {renderCta(effectivePrimaryCta, true)}
            {renderCta(effectiveSecondaryCta, false)}
          </div>
        </div>
      </div>

    </section>
  );
};

export default RafiqHero;
