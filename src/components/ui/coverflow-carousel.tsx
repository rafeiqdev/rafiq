"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  FileCheck2,
  Building2,
  Compass,
  Languages,
  WalletCards,
  HeartPulse,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { GradientBackground } from "@/components/ui/oceanic-glow";
import { useLanguage } from "@/i18n/LanguageContext";
import { VerifiedBadge } from "@/components/ui/verified-badge";

export interface ServiceSlide {
  id: string;
  src: string;
  alt: string;
  title: string;
  description: string;
  category: string;
  badge: string;
  badgeType: "partner" | "direct";
  href: string;
  icon?: React.ReactNode;
}

export interface CoverflowCarouselProps extends React.HTMLAttributes<HTMLElement> {
  slides?: ServiceSlide[];
  eyebrow?: string;
  heading?: string;
  description?: string;
  showCaption?: boolean;
  showPagination?: boolean;
  showNavigation?: boolean;
  loop?: boolean;
  autoScroll?: boolean;
  autoScrollInterval?: number;
  cardWidth?: string;
  gap?: number;
  label?: string;
}

const SERVICE_IMAGES: Record<string, string> = {
  residence: "/images/services/official/residence.webp",
  'real-estate': "/images/services/official/real-estate.webp",
  tourism: "/images/services/official/tourism.webp",
  translation: "/images/services/official/translation.webp",
  banking: "/images/services/official/banking.webp",
  health: "/images/services/official/health.webp",
};

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  residence: <FileCheck2 className="h-4 w-4" aria-hidden="true" />,
  'real-estate': <Building2 className="h-4 w-4" aria-hidden="true" />,
  tourism: <Compass className="h-4 w-4" aria-hidden="true" />,
  translation: <Languages className="h-4 w-4" aria-hidden="true" />,
  banking: <WalletCards className="h-4 w-4" aria-hidden="true" />,
  health: <HeartPulse className="h-4 w-4" aria-hidden="true" />,
};

/**
 * 3D Coverflow Carousel for Rafiq Services with Oceanic Glow Gradient Background
 * Dynamically adapts 3D physics, gestures, and typography for Arabic, English, Persian, and Russian.
 */
export const CoverflowCarousel: React.FC<CoverflowCarouselProps> = ({
  slides: customSlides,
  eyebrow,
  heading,
  description,
  showCaption = false,
  showPagination = false,
  showNavigation = false,
  loop = true,
  autoScroll = true,
  autoScrollInterval = 3000,
  cardWidth,
  gap = 0.08,
  label,
  className,
  ...props
}) => {
  const { language, dir, isRtl, t } = useLanguage();

  const activeSlides: ServiceSlide[] = useMemo(() => {
    if (customSlides && customSlides.length > 0) return customSlides;

    return t.servicesCarousel.services.map((item) => ({
      ...item,
      src: SERVICE_IMAGES[item.id] || "/images/services/official/residence.webp",
      href: `/${language}/services?category=${item.id}`,
      icon: SERVICE_ICONS[item.id],
    }));
  }, [customSlides, t, language]);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPointerDown, setIsPointerDown] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const startXRef = useRef<number>(0);
  const currentXRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const dragDistanceRef = useRef<number>(0);

  const totalSlides = activeSlides.length;

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const goToSlide = useCallback(
    (index: number) => {
      if (loop) {
        const normalized = (index + totalSlides) % totalSlides;
        setCurrentIndex(normalized);
      } else {
        const clamped = Math.max(0, Math.min(index, totalSlides - 1));
        setCurrentIndex(clamped);
      }
    },
    [loop, totalSlides]
  );

  const nextSlide = useCallback(() => {
    goToSlide(currentIndex + 1);
  }, [goToSlide, currentIndex]);

  const prevSlide = useCallback(() => {
    goToSlide(currentIndex - 1);
  }, [goToSlide, currentIndex]);

  // Smart Auto-Scroll Timer
  useEffect(() => {
    if (!autoScroll || isPaused || reducedMotion || isPointerDown) return;

    const timer = setInterval(() => {
      nextSlide();
    }, autoScrollInterval);

    return () => clearInterval(timer);
  }, [autoScroll, isPaused, reducedMotion, isPointerDown, nextSlide, autoScrollInterval]);

  // Keyboard navigation adapted to direction
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isRtl) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          nextSlide();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          prevSlide();
        }
      } else {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          nextSlide();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          prevSlide();
        }
      }
    },
    [isRtl, nextSlide, prevSlide]
  );

  // Pointer Drag Handlers adapted to direction.
  //
  // Pointer capture is deliberately NOT taken here on pointerdown. Capturing
  // immediately (the original behavior) makes Chromium retarget the click
  // that follows pointerup to the CAPTURING element (this container div)
  // instead of whatever was actually under the cursor — so a plain click on
  // "Request Service" never reached the <a> at all, it silently landed on
  // this wrapper div instead. Capture is taken only once real dragging is
  // confirmed (handlePointerMove, past the 6px threshold), so a simple click
  // never captures the pointer and the native click reaches the real link.
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsPointerDown(true);
    setIsPaused(true);
    startXRef.current = e.clientX;
    currentXRef.current = e.clientX;
    isDraggingRef.current = false;
    dragDistanceRef.current = 0;
    setDragOffset(0);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDown) return;
    currentXRef.current = e.clientX;
    const deltaX = currentXRef.current - startXRef.current;
    dragDistanceRef.current = Math.abs(deltaX);

    if (dragDistanceRef.current > 6) {
      if (!isDraggingRef.current && containerRef.current && !containerRef.current.hasPointerCapture(e.pointerId)) {
        containerRef.current.setPointerCapture(e.pointerId);
      }
      isDraggingRef.current = true;
    }

    setDragOffset(deltaX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isPointerDown) return;
    setIsPointerDown(false);
    setIsPaused(false);

    if (containerRef.current && containerRef.current.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }

    const deltaX = currentXRef.current - startXRef.current;
    const threshold = 45;

    if (isRtl) {
      if (deltaX > threshold) {
        prevSlide();
      } else if (deltaX < -threshold) {
        nextSlide();
      }
    } else {
      if (deltaX < -threshold) {
        nextSlide();
      } else if (deltaX > threshold) {
        prevSlide();
      }
    }

    setDragOffset(0);

    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  };

  const handlePointerCancel = () => {
    setIsPointerDown(false);
    setIsPaused(false);
    setDragOffset(0);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  };

  return (
    <section
      ref={sectionRef}
      id="services-categories"
      dir={dir}
      lang={language}
      role="region"
      aria-roledescription="carousel"
      aria-label={label || t.servicesCarousel.label}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      className={cn(
        "relative w-full overflow-hidden pt-28 sm:pt-32 lg:pt-36 pb-24 sm:pb-32 text-[#12294D] font-sans outline-none select-none",
        className
      )}
      {...props}
    >
      <GradientBackground className="absolute inset-0 z-0" />

      {/* Gentle Organic Top Wave Transition */}
      <div className="absolute top-0 inset-x-0 overflow-hidden leading-none z-20 pointer-events-none -mt-px">
        <svg
          className="w-full h-10 sm:h-16 text-[#FAF8F0]"
          viewBox="0 0 1440 60"
          fill="currentColor"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0,0 L1440,0 L1440,25 Q720,55 0,25 Z" />
        </svg>
      </div>

      <div className="relative z-10 container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto mb-14 sm:mb-18 max-w-4xl text-center pointer-events-auto">
          <div className="mb-3.5 inline-flex items-center gap-2.5">
            <span className="h-px w-6 sm:w-10 bg-[#1A3A6B]/30" aria-hidden="true" />
            <span className="text-xs sm:text-sm font-black tracking-widest text-[#1A3A6B] uppercase">
              {eyebrow || t.servicesCarousel.eyebrow}
            </span>
            <span className="h-px w-6 sm:w-10 bg-[#1A3A6B]/30" aria-hidden="true" />
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white [text-shadow:_0_4px_24px_rgb(11_31_58_/_95%),_0_2px_8px_rgb(11_31_58_/_90%)] leading-tight sm:leading-tight">
            {heading || t.servicesCarousel.heading}
          </h2>

          <div className="mt-5 sm:mt-6 inline-flex items-center gap-2 px-5 py-2 sm:px-6 sm:py-2.5 rounded-full bg-[#12294D]/80 border border-[#60A5FA]/40 shadow-xl backdrop-blur-md">
            <span className="text-sm sm:text-base md:text-lg font-bold text-[#E8F0FB] tracking-wide">
              {description || t.servicesCarousel.description}
            </span>
          </div>
        </div>

        {/* 3D Coverflow Container */}
        <div className="relative w-full max-w-5xl mx-auto">
          {/* Floating Navigation Controls */}
          <div className="pointer-events-none absolute -inset-x-3 sm:-inset-x-8 inset-y-0 flex items-center justify-between z-40">
            {/* First Button (Left side of screen) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isRtl) {
                  nextSlide();
                } else {
                  prevSlide();
                }
              }}
              aria-label={isRtl ? "Next service" : "Previous service"}
              className="pointer-events-auto flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 active:scale-95 text-white border border-white/40 shadow-xl backdrop-blur-md transition-all duration-200 hover:scale-108 hover:shadow-2xl cursor-pointer"
            >
              <ChevronLeft className="h-6 w-6 stroke-[2.5]" />
            </button>

            {/* Second Button (Right side of screen) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isRtl) {
                  prevSlide();
                } else {
                  nextSlide();
                }
              }}
              aria-label={isRtl ? "Previous service" : "Next service"}
              className="pointer-events-auto flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 active:scale-95 text-white border border-white/40 shadow-xl backdrop-blur-md transition-all duration-200 hover:scale-108 hover:shadow-2xl cursor-pointer"
            >
              <ChevronRight className="h-6 w-6 stroke-[2.5]" />
            </button>
          </div>

          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            className="relative mx-auto flex h-[510px] sm:h-[550px] md:h-[590px] w-full items-center justify-center cursor-grab active:cursor-grabbing touch-pan-y"
            style={{
              perspective: "1200px",
              perspectiveOrigin: "center center",
            }}
          >
            {activeSlides.map((slide, index) => {
              let diff = index - currentIndex;
              if (loop) {
                if (diff > totalSlides / 2) diff -= totalSlides;
                if (diff < -totalSlides / 2) diff += totalSlides;
              }

              const isCenter = diff === 0;

              // Dynamic Spatial 3D Calculations based on direction
              const baseSpacing = typeof window !== "undefined" && window.innerWidth < 640 ? 150 : 230;
              const dragInfluence = isPointerDown ? dragOffset * 0.8 : 0;
              
              const translateX = isRtl
                ? -diff * baseSpacing + dragInfluence
                : diff * baseSpacing + dragInfluence;
              
              const translateZ = isCenter ? 0 : -130 * Math.abs(diff);
              
              const rotateY = isCenter
                ? 0
                : isRtl
                  ? diff > 0 ? 24 : -24
                  : diff > 0 ? -24 : 24;

              const rotateZ = isCenter
                ? 0
                : isRtl
                  ? diff > 0 ? -1.5 : 1.5
                  : diff > 0 ? 1.5 : -1.5;

              const scale = isCenter ? 1 : Math.max(0.82, 1 - Math.abs(diff) * 0.11);
              const opacity = isCenter ? 1 : Math.max(0.48, 0.88 - Math.abs(diff) * 0.2);
              const zIndex = isCenter ? 30 : 20 - Math.abs(diff);

              const stepNumber = String(index + 1).padStart(2, "0");

              return (
                <div
                  key={slide.id}
                  aria-hidden={!isCenter}
                  className={cn(
                    "absolute flex items-center justify-center",
                    isPointerDown
                      ? "transition-none"
                      : "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    reducedMotion && "transition-none"
                  )}
                  style={{
                    transform: reducedMotion
                      ? `translateX(${translateX}px)`
                      : `translate3d(${translateX}px, 0, ${translateZ}px) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg) scale(${scale})`,
                    transformStyle: "preserve-3d",
                    zIndex,
                    opacity,
                    willChange: "transform, opacity",
                    pointerEvents: isCenter || Math.abs(diff) <= 1 ? "auto" : "none",
                  }}
                >
                  {/* Official Rafiq Service Card.
                      A plain div, not an <a>: the "Request Service" pill below is
                      its own real, independent link so it always navigates,
                      centered or not — see its onPointerUp below for why
                      navigation happens there instead of via a plain href click.
                      Interaction here uses onPointerUp, not onClick, for the same
                      reason: this card sits inside a `perspective` + `transform-
                      style: preserve-3d` stack (for the coverflow 3D effect), and
                      in that setup the browser's synthesized `click` event can
                      resolve its target to the wrong element in the 3D stack
                      (verified: it was landing on the outer scroll container,
                      several ancestors up, so neither this card's nor the link's
                      onClick ever ran). pointerup hit-tests correctly regardless. */}
                  <div
                    role="group"
                    aria-label={`Service ${slide.title}: ${slide.description}`}
                    onPointerUp={() => {
                      if (isDraggingRef.current || dragDistanceRef.current > 6) return;
                      if (!isCenter) goToSlide(index);
                    }}
                    className={cn(
                      "group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-3xl border bg-white shadow-xl transition-all duration-300",
                      isRtl ? "text-right" : "text-left",
                      "w-[290px] sm:w-[330px] md:w-[360px] p-5 sm:p-6",
                      isCenter
                        ? "border-[#1A3A6B]/50 shadow-2xl shadow-[#12294D]/25 ring-2 ring-[#1A3A6B]/30"
                        : "border-[#EFEADB] shadow-md hover:border-[#1A3A6B]/30"
                    )}
                  >
                    <div>
                      {/* Top Header: Step Number & Verified Badge */}
                      <div className="mb-3.5 flex items-center justify-between">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E8F0FB] border border-[#C2D9F5] text-xs font-black text-[#1A3A6B] shadow-sm">
                          {stepNumber}
                        </span>

                        <div
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border shadow-sm",
                            slide.badgeType === "direct"
                              ? "bg-gradient-to-r from-[#E8F0FB] to-[#FAF8F0] text-[#1A3A6B] border-[#C2D9F5]"
                              : "bg-gradient-to-r from-sky-50 to-[#FAF8F0] text-[#0284c7] border-sky-200"
                          )}
                        >
                          {slide.badgeType === "direct" ? (
                            <ShieldCheck className="h-3.5 w-3.5 text-[#1A3A6B]" aria-hidden="true" />
                          ) : (
                            <VerifiedBadge variant="shimmer" size={15} />
                          )}
                          <span>{slide.badge}</span>
                        </div>
                      </div>

                      {/* Expansive Full-Bleed Image Container */}
                      <div className="relative mb-4 h-44 sm:h-52 w-full overflow-hidden rounded-2xl bg-[#1A3A6B]/5 border border-[#EFEADB]">
                        <img
                          src={slide.src}
                          alt={slide.alt}
                          loading="lazy"
                          className="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-108"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#12294D]/15 via-transparent to-transparent pointer-events-none" />
                      </div>

                      {/* Category Label */}
                      <div className="mb-2 inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#1A3A6B] bg-[#E8F0FB]/70 px-2.5 py-0.5 rounded-md border border-[#D0E0F5]">
                        {slide.icon && <span>{slide.icon}</span>}
                        <span>{slide.category}</span>
                      </div>

                      {/* Service Title */}
                      <h3 className="mb-2 text-xl sm:text-2xl font-black tracking-tight text-[#12294D] transition-colors duration-200 group-hover:text-[#1A3A6B] leading-tight">
                        {slide.title}
                      </h3>

                      {/* Description */}
                      <p className="text-xs sm:text-sm text-[#3A4F6D] font-medium leading-relaxed line-clamp-2">
                        {slide.description}
                      </p>
                    </div>

                    {/* Action Button inside card — a real, independent link so it
                        always navigates, whether or not this card is centered.
                        Navigates on pointerup (not the native href click — see
                        the card comment above for why) so it's reliable inside
                        the 3D coverflow stack; href/onClick stay as the fallback
                        for keyboard activation (Enter/Space), where no pointer
                        event fires and the browser's click targets this link
                        correctly on its own. */}
                    <div className="mt-5 border-t border-[#EFEADB] pt-3.5">
                      <a
                        href={slide.href}
                        onPointerUp={(e) => {
                          e.stopPropagation();
                          if (isDraggingRef.current || dragDistanceRef.current > 6) return;
                          e.preventDefault();
                          window.location.href = slide.href;
                        }}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`${t.common.requestService}: ${slide.title}`}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1A3A6B] px-4 py-3 text-xs sm:text-sm font-black text-white shadow-md transition-all duration-200 group-hover:bg-[#12294D] group-hover:shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1A3A6B] focus-visible:ring-offset-2"
                      >
                        <span>{t.common.requestService}</span>
                        {isRtl ? (
                          <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" aria-hidden="true" />
                        ) : (
                          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
                        )}
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Smooth Interactive Pagination Dots */}
          <div className="mt-4 sm:mt-6 flex items-center justify-center gap-2 z-30">
            {activeSlides.map((_, dotIndex) => {
              const isActive = dotIndex === currentIndex;
              return (
                <button
                  key={dotIndex}
                  type="button"
                  onClick={() => goToSlide(dotIndex)}
                  aria-label={`Go to slide ${dotIndex + 1}`}
                  className={cn(
                    "h-2.5 rounded-full transition-all duration-300 ease-out cursor-pointer",
                    isActive
                      ? "w-8 bg-[#60A5FA] shadow-md shadow-blue-500/50"
                      : "w-2.5 bg-white/35 hover:bg-white/70"
                  )}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Seamless Symmetrical Organic Bottom Wave Transition */}
      <div className="absolute bottom-0 inset-x-0 overflow-hidden leading-none z-20 pointer-events-none -mb-px">
        <svg
          className="w-full h-12 sm:h-20 text-[#FAF8F0]"
          viewBox="0 0 1440 60"
          fill="currentColor"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0,35 Q720,0 1440,35 L1440,60 L0,60 Z" />
        </svg>
      </div>
    </section>
  );
};

export default CoverflowCarousel;
