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
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { routePathFromHref } from "@/lib/routePreload";
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

// Card photo box is landscape (~312×208 desktop, 250×176 phone, object-cover
// centre), so supply 1200×800 (3:2) images. health.webp is the owner's clinic
// photo; the rest are still the original portrait stock shots awaiting his
// replacements (2026-09-02).
const SERVICE_IMAGES: Record<string, string> = {
  residence: "/images/services/official/residence.webp",
  'real-estate': "/images/services/official/real-estate.webp",
  tourism: "/images/services/official/tourism.webp",
  translation: "/images/services/official/translation.webp",
  banking: "/images/services/official/banking.webp",
  health: "/images/services/official/health.webp",
};

// Card id -> catalog category id (src/data/services.ts) for the services page filter.
const SERVICE_CATEGORY: Record<string, string> = {
  residence: 'residency',
  'real-estate': 'realestate',
  tourism: 'tourism',
  translation: 'translation',
  banking: 'banking',
  health: 'health',
};

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  residence: <FileCheck2 className="h-4 w-4" aria-hidden="true" />,
  'real-estate': <Building2 className="h-4 w-4" aria-hidden="true" />,
  tourism: <Compass className="h-4 w-4" aria-hidden="true" />,
  translation: <Languages className="h-4 w-4" aria-hidden="true" />,
  banking: <WalletCards className="h-4 w-4" aria-hidden="true" />,
  health: <HeartPulse className="h-4 w-4" aria-hidden="true" />,
};

// The ONLY transition in the carousel: transform + opacity (both GPU-composited,
// zero main-thread work per frame). Deliberately no spring library, no infinite
// animations, no animated blurs — those kept low-end phones janky.
// Calm glide (retune 2026-09-11): 0.45s expo-out — short enough that the
// section feels settled instead of constantly floating, long enough to stay silky.
const SLOT_TRANSITION =
  "transform 0.45s cubic-bezier(0.16,1,0.3,1), opacity 0.45s ease";

/** Everything paintCards needs — captured once at pointerdown so drag frames
 *  never read stale closures and never trigger React renders. */
interface GestureSnap {
  index: number;
  spacing: number;
  isRtl: boolean;
  total: number;
  loop: boolean;
  startX: number;
  pointerId: number;
}

function diffFor(i: number, index: number, total: number, loop: boolean): number {
  let d = i - index;
  if (loop) {
    if (d > total / 2) d -= total;
    if (d < -total / 2) d += total;
  }
  return d;
}

type PaintMode = "animated" | "instant" | "drag" | "snap";

/**
 * Writes slot transforms STRAIGHT to the DOM (no setState, no re-render).
 * Called from rAF during drags and from an effect on index change.
 * - `animated`: clears the inline transition so the CSS value from render
 *   takes over (the long silky glide between slots).
 * - `snap`: short distance-proportional transition for release-without-jump,
 *   so a tiny offset snaps back quickly instead of floating for 0.7s.
 * - `instant`/`drag`: transition pinned to none (mount, finger-follow).
 */
function paintCards(
  els: Array<HTMLDivElement | null>,
  snap: Pick<GestureSnap, "index" | "spacing" | "isRtl" | "total" | "loop">,
  mode: PaintMode,
  drag = 0,
  snapDuration = 0.3,
) {
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    if (!el) continue;
    const diff = diffFor(i, snap.index, snap.total, snap.loop);
    const ad = Math.abs(diff);
    const center = diff === 0;
    const baseX = snap.isRtl ? -diff * snap.spacing : diff * snap.spacing;
    const x = baseX + (mode === "drag" ? drag * 0.9 : 0);
    // Gentle depth: side cards step back without leaning hard. rotateZ is
    // gone entirely (it made text look broken/crooked) and rotateY is halved
    // (12deg) so side cards stay readable instead of edge-on.
    const s = center ? 1 : Math.max(0.7, 1 - ad * 0.15);
    const rY = center ? 0 : snap.isRtl ? (diff > 0 ? 12 : -12) : diff > 0 ? -12 : 12;
    const rZ = 0;
    el.style.transition =
      mode === "animated"
        ? ""
        : mode === "snap"
          ? `transform ${snapDuration}s cubic-bezier(0.16,1,0.3,1), opacity ${snapDuration}s ease`
          : "none";
    el.style.transform = `translateX(${x}px) scale(${s}) rotateY(${rY}deg) rotateZ(${rZ}deg)`;
  }
}

/**
 * 3D Coverflow Carousel for Rafiq Services with Oceanic Glow Gradient Background
 * Dynamically adapts gestures and typography for Arabic, English, Persian, and Russian.
 *
 * CALM motion model (retune 2026-09-11): the spring-physics version janked on
 * low-end phones, and the first LITE pass still felt busy (0.7s glides, 3s
 * autoplay, 24deg side tilt, double-skip flings, shimmer + hover scales).
 * Now: 0.45s glides, 6s autoplay, 12deg tilt with no crooked rotateZ, one
 * card max per gesture, static verified badge, no hover zooms — same design
 * and same coverflow idea, just settled.
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
  autoScrollInterval = 6000,
  cardWidth,
  gap = 0.08,
  label,
  className,
  ...props
}) => {
  const { language, dir, isRtl, t } = useLanguage();
  const navigate = useNavigate();

  const activeSlides: ServiceSlide[] = useMemo(() => {
    if (customSlides && customSlides.length > 0) return customSlides;

    return t.servicesCarousel.services.map((item) => ({
      ...item,
      src: SERVICE_IMAGES[item.id] || "/images/services/official/residence.webp",
      href: `/${language}/services?category=${SERVICE_CATEGORY[item.id] ?? item.id}`,
      icon: SERVICE_ICONS[item.id],
    }));
  }, [customSlides, t, language]);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPointerDown, setIsPointerDown] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [revealed, setRevealed] = useState<boolean>(false);
  const [viewportW, setViewportW] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const gestureRef = useRef<GestureSnap | null>(null);
  const latestXRef = useRef<number>(0);
  const dragDeltaRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const samplesRef = useRef<Array<{ x: number; t: number }>>([]);
  const lastInteractRef = useRef<number>(0);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number>(0);
  const mountedRef = useRef<boolean>(false);

  const totalSlides = activeSlides.length;
  // Wider gaps so side cards overlap less and their text stays readable.
  // Mobile cards are 290px wide -> 200px spacing; desktop 320px -> 270px.
  const spacing = viewportW < 640 ? 200 : 270;

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // One-shot scroll reveal (a single state flip, then pure CSS).
  // Light by design (owner 2026-09-11): fires early — while the section is
  // still approaching — so visitors never see an empty background waiting
  // for its content.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting)) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { rootMargin: "120px 0px 120px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Track viewport width for card spacing (mobile vs desktop).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setViewportW(window.innerWidth);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const goToSlide = useCallback(
    (index: number) => {
      lastInteractRef.current = Date.now();
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

  // Autoplay advance — deliberately does NOT touch lastInteractRef. The old
  // code routed autoplay through goToSlide (which stamps every advance as a
  // "manual interaction"), so each auto step re-armed its own cooldown and
  // the carousel stalled after the first step whenever the interval was
  // shorter than the cooldown. Manual input stamps the cooldown; auto steps
  // only read it.
  const advanceAuto = useCallback(() => {
    if (loop) {
      setCurrentIndex((prev) => (prev + 1) % totalSlides);
    } else {
      setCurrentIndex((prev) => Math.min(prev + 1, totalSlides - 1));
    }
  }, [loop, totalSlides]);

  // Paint slot transforms after every index/spacing change. First paint is
  // instant (no fly-in on page load); everything after glides via CSS.
  // With prefers-reduced-motion there is never a glide — always instant.
  useEffect(() => {
    const snap = { index: currentIndex, spacing, isRtl, total: totalSlides, loop };
    paintCards(
      cardRefs.current,
      snap,
      !mountedRef.current || reducedMotion ? "instant" : "animated"
    );
    mountedRef.current = true;
  }, [currentIndex, spacing, isRtl, totalSlides, loop, activeSlides.length, reducedMotion]);

  // Smart Auto-Scroll: pauses on hover/focus/drag, for a cooldown after any
  // manual interaction, and while the tab is hidden.
  useEffect(() => {
    if (!autoScroll || isPaused || reducedMotion || isPointerDown) return;

    const timer = setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - lastInteractRef.current < 4000) return;
      advanceAuto();
    }, autoScrollInterval);

    return () => clearInterval(timer);
  }, [autoScroll, isPaused, reducedMotion, isPointerDown, advanceAuto, autoScrollInterval]);

  // Pause autoplay while the tab is hidden so it never jumps on return.
  useEffect(() => {
    const onVis = () => setIsPaused(document.hidden ? true : false);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  // "Request Service" navigation through the router (same page transition as
  // every <Link>) — a full reload flashed white and re-fetched the whole app;
  // href stays as the keyboard fallback. Ignores drags so a swipe that ends
  // on the button never navigates by accident.
  const handleRequestService = useCallback(
    (slide: ServiceSlide) => {
      if (isDraggingRef.current || Math.abs(dragDeltaRef.current) > 10) return;
      lastInteractRef.current = Date.now();
      const internal = routePathFromHref(slide.href);
      if (internal) navigate(internal.path + internal.url.search + internal.url.hash);
      else window.location.href = slide.href;
    },
    [navigate]
  );

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

  const endGesturePause = useCallback(() => {
    // Longer cooldown before autoplay resumes — the section stays settled
    // after a drag instead of yanking away instantly.
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => setIsPaused(false), 2500);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  }, []);

  const finishGesture = useCallback(
    (pointerId: number | null) => {
      const snap = gestureRef.current;
      if (!snap) return;
      gestureRef.current = null;
      setIsPointerDown(false);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }

      if (pointerId !== null && containerRef.current) {
        try {
          if (containerRef.current.hasPointerCapture(pointerId)) {
            containerRef.current.releasePointerCapture(pointerId);
          }
        } catch {
          /* noop */
        }
      }

      const deltaX = latestXRef.current - snap.startX;

      // Flick velocity from the last samples (px/ms), fell back to 0.
      let velocity = 0;
      const samples = samplesRef.current;
      if (samples.length >= 2) {
        const first = samples[0];
        const last = samples[samples.length - 1];
        const dt = last.t - first.t;
        if (dt > 0) velocity = (last.x - first.x) / dt;
      }

      const threshold = 60;
      // Positive `forward` always means "go to next".
      const forward = snap.isRtl ? deltaX : -deltaX;
      const forwardVelocity = snap.isRtl ? velocity : -velocity;

      // One card max per gesture — the old double-skip (jump * 2 on a hard
      // fling) disoriented visitors, they lost track of where they were.
      let jump = 0;
      if (forward > threshold || forwardVelocity > 0.6) jump = 1;
      else if (forward < -threshold || forwardVelocity < -0.6) jump = -1;

      if (jump !== 0) {
        goToSlide(snap.index + jump);
      } else {
        lastInteractRef.current = Date.now();
        // No index change → no re-render → glide back manually, with a
        // duration proportional to the offset: tiny wiggles snap instantly,
        // long drags glide home. Still pure CSS, zero per-frame JS.
        // Reduced-motion: no glide at all, jump straight home.
        const dur = Math.min(0.22 + Math.abs(deltaX) / 1200, 0.5);
        paintCards(
          cardRefs.current,
          snap,
          reducedMotion ? "instant" : "snap",
          0,
          Number(dur.toFixed(3))
        );
      }

      endGesturePause();
    },
    [goToSlide, endGesturePause, reducedMotion]
  );

  // Pointer Drag adapted to direction.
  //
  // PERFORMANCE: pointermove only records the latest X and schedules ONE
  // requestAnimationFrame that writes transforms straight to the DOM.
  // No setState, no React re-render, no JS animation library per pixel —
  // the cards stay glued to the finger on the compositor thread alone.
  //
  // Pointer capture is deliberately NOT taken here on pointerdown. Capturing
  // immediately (the original behavior) makes Chromium retarget the click
  // that follows pointerup to the CAPTURING element (this container div)
  // instead of whatever was actually under the cursor — so a plain click on
  // "Request Service" never reached the <a> at all, it silently landed on
  // this wrapper div instead. Capture is taken only once real dragging is
  // confirmed (past the 10px threshold), so a simple click never captures
  // the pointer and the native click reaches the real link.
  const handlePointerDown = (e: React.PointerEvent) => {
    gestureRef.current = {
      index: currentIndex,
      spacing,
      isRtl,
      total: totalSlides,
      loop,
      startX: e.clientX,
      pointerId: e.pointerId,
    };
    latestXRef.current = e.clientX;
    dragDeltaRef.current = 0;
    isDraggingRef.current = false;
    samplesRef.current = [{ x: e.clientX, t: performance.now() }];
    setIsPointerDown(true);
    setIsPaused(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const snap = gestureRef.current;
    if (!snap) return;
    latestXRef.current = e.clientX;
    // Synchronous mirror so tap guards stay exact even if a rAF is pending.
    dragDeltaRef.current = e.clientX - snap.startX;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const s = gestureRef.current;
      if (!s) return;
      const delta = latestXRef.current - s.startX;

      const now = performance.now();
      const samples = samplesRef.current;
      samples.push({ x: latestXRef.current, t: now });
      if (samples.length > 6) samples.shift();

      if (Math.abs(delta) > 10) {
        if (!isDraggingRef.current && containerRef.current) {
          try {
            if (!containerRef.current.hasPointerCapture(s.pointerId)) {
              containerRef.current.setPointerCapture(s.pointerId);
            }
          } catch {
            /* noop — capture unsupported, drag still works */
          }
        }
        isDraggingRef.current = true;
      }

      paintCards(cardRefs.current, s, "drag", delta);
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    finishGesture(e.pointerId);
  };

  const handlePointerCancel = () => {
    finishGesture(null);
  };

  const showContent = revealed || reducedMotion;

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
      onMouseLeave={() => { if (!gestureRef.current) setIsPaused(false); }}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      className={cn(
        "relative w-full overflow-hidden pt-16 sm:pt-32 lg:pt-24 pb-14 sm:pb-32 lg:pb-20 text-[#12294D] font-sans outline-none select-none",
        className
      )}
      {...props}
    >
      {/* Static gradient in its own composited layer: painted once, never
          repainted while cards animate above it. */}
      <div className="absolute inset-0 z-0 [transform:translateZ(0)]">
        <GradientBackground className="absolute inset-0" />
      </div>

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
        {/* Section Header — one-shot CSS rise-in on scroll into view */}
        <div
          className={cn(
            "mx-auto mb-8 sm:mb-18 max-w-4xl text-center pointer-events-auto transition-[opacity,transform] duration-500 ease-out",
            showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          <div className="mb-3.5 inline-flex items-center gap-2.5">
            <span className="h-px w-6 sm:w-10 bg-[#1A3A6B]/30" aria-hidden="true" />
            <span className="text-xs sm:text-sm font-black tracking-widest text-[#1A3A6B] uppercase">
              {eyebrow || t.servicesCarousel.eyebrow}
            </span>
            <span className="h-px w-6 sm:w-10 bg-[#1A3A6B]/30" aria-hidden="true" />
          </div>

          <h2 className="text-2xl sm:text-5xl lg:text-5xl font-black tracking-tight text-white [text-shadow:_0_4px_24px_rgb(11_31_58_/_95%),_0_2px_8px_rgb(11_31_58_/_90%)] leading-snug sm:leading-tight">
            {heading || t.servicesCarousel.heading}
          </h2>

          <div className="mt-3.5 sm:mt-6 inline-flex items-center gap-2 px-4 py-1.5 sm:px-6 sm:py-2.5 rounded-full bg-[#12294D]/80 border border-[#60A5FA]/40 shadow-xl backdrop-blur-md">
            <span className="text-xs sm:text-base md:text-lg lg:text-base font-bold text-[#E8F0FB] tracking-wide">
              {description || t.servicesCarousel.description}
            </span>
          </div>
        </div>

        {/* 3D Coverflow Container */}
        <div
          className={cn(
            "relative w-full max-w-5xl mx-auto transition-[opacity,transform] duration-500 ease-out",
            showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          {/* Floating Navigation Controls (solid fill — no backdrop-blur here:
              blur regions above animating cards re-blur every frame) */}
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
              className="pointer-events-auto flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white border border-white/40 shadow-xl transition-[background-color,box-shadow] duration-200 hover:shadow-2xl cursor-pointer"
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
              className="pointer-events-auto flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white border border-white/40 shadow-xl transition-[background-color,box-shadow] duration-200 hover:shadow-2xl cursor-pointer"
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
            className={cn(
              "relative mx-auto flex h-[510px] sm:h-[550px] md:h-[590px] lg:h-[520px] w-full items-center justify-center touch-pan-y",
              isPointerDown ? "cursor-grabbing" : "cursor-grab"
            )}
            style={{
              // Flat per-card 3D (cheap) — deliberately NO preserve-3d scene,
              // which forced costly 3D compositing and flickered on some GPUs.
              perspective: "1200px",
              perspectiveOrigin: "center center",
            }}
          >
            {activeSlides.map((slide, index) => {
              const diff = diffFor(index, currentIndex, totalSlides, loop);

              const isCenter = diff === 0;
              const isNear = Math.abs(diff) <= 1;

              const opacity = isCenter ? 1 : Math.max(0.35, 0.9 - Math.abs(diff) * 0.25);
              const zIndex = isCenter ? 30 : 20 - Math.abs(diff);

              const stepNumber = String(index + 1).padStart(2, "0");

              return (
                <div
                  key={slide.id}
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                  aria-hidden={!isCenter}
                  className="absolute flex items-center justify-center"
                  style={{
                    zIndex,
                    opacity,
                    pointerEvents: isNear ? "auto" : "none",
                    transition: reducedMotion ? "none" : SLOT_TRANSITION,
                  }}
                >
                  {/* Official Rafiq Service Card.
                      A plain div, not an <a>: the "Request Service" pill below is
                      its own real, independent link so it always navigates,
                      centered or not — see its onPointerUp below for why
                      navigation happens there instead of via a plain href click.
                      Interaction here uses onPointerUp, not onClick, for the same
                      reason: this card sits inside a `perspective` stack (for the
                      coverflow 3D effect), and in that setup the browser's
                      synthesized `click` event can resolve its target to the wrong
                      element in the 3D stack (verified: it was landing on the outer
                      scroll container, several ancestors up, so neither this card's
                      nor the link's onClick ever ran). pointerup hit-tests
                      correctly regardless. */}
                  <div
                    role="group"
                    aria-label={`Service ${slide.title}: ${slide.description}`}
                    onPointerUp={() => {
                      // A real drag just ended — don't steal it as a tap.
                      if (Math.abs(dragDeltaRef.current) > 10) return;
                      if (!isCenter) goToSlide(index);
                    }}
                    className={cn(
                      "group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-3xl border bg-white shadow-xl",
                      isRtl ? "text-right" : "text-left",
                      "w-[290px] sm:w-[330px] md:w-[360px] lg:w-[320px] p-5 sm:p-6 lg:p-5",
                      isCenter
                        ? "border-[#1A3A6B]/50 shadow-2xl shadow-[#12294D]/25 ring-2 ring-[#1A3A6B]/30"
                        : "border-[#EFEADB] shadow-md hover:border-[#1A3A6B]/30",
                      // Shadow/border fade only — the slot transform is owned by
                      // paintCards (inline style), never by CSS classes.
                      "transition-[box-shadow,border-color] duration-300 ease-out"
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
                            <VerifiedBadge variant="static" size={15} />
                          )}
                          <span>{slide.badge}</span>
                        </div>
                      </div>

                      {/* Expansive Full-Bleed Image Container */}
                      <div className="relative mb-4 h-44 sm:h-52 w-full overflow-hidden rounded-2xl bg-[#1A3A6B]/5 border border-[#EFEADB]">
                        <img
                          src={slide.src}
                          alt={slide.alt}
                          loading={isNear ? "eager" : "lazy"}
                          decoding="async"
                          draggable={false}
                          className="h-full w-full object-cover object-center"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#12294D]/15 via-transparent to-transparent pointer-events-none" />
                      </div>

                      {/* Category Label */}
                      <div className="mb-2 inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#1A3A6B] bg-[#E8F0FB]/70 px-2.5 py-0.5 rounded-md border border-[#D0E0F5]">
                        {slide.icon && <span>{slide.icon}</span>}
                        <span>{slide.category}</span>
                      </div>

                      {/* Service Title */}
                      <h3 className="mb-2 text-xl sm:text-2xl lg:text-xl font-black tracking-tight text-[#12294D] transition-colors duration-200 group-hover:text-[#1A3A6B] leading-tight">
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
                          // A drag ending here is a swipe, not a tap: let it
                          // bubble to the container so the slide still advances
                          // — only real taps navigate. (Stopping propagation
                          // unconditionally used to eat swipes that started on
                          // the button: no slide change AND no navigation.)
                          if (Math.abs(dragDeltaRef.current) > 10) return;
                          e.stopPropagation();
                          handleRequestService(slide);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        aria-label={`${t.common.requestService}: ${slide.title}`}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1A3A6B] px-4 py-3 text-xs sm:text-sm font-black text-white shadow-md transition-[background-color,box-shadow] duration-200 group-hover:bg-[#12294D] group-hover:shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1A3A6B] focus-visible:ring-offset-2"
                      >
                        <span>{t.common.requestService}</span>
                        {isRtl ? (
                          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        )}
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Dots — tiny width transition only */}
          <div className="mt-4 sm:mt-6 flex items-center justify-center gap-2 z-30">
            {activeSlides.map((slide, dotIndex) => {
              const isActive = dotIndex === currentIndex;
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => goToSlide(dotIndex)}
                  aria-label={`Go to slide ${dotIndex + 1}`}
                  style={{ width: isActive ? 32 : 10 }}
                  className={cn(
                    "h-2.5 rounded-full cursor-pointer transition-[width,background-color,opacity] duration-300 ease-out",
                    isActive
                      ? "bg-[#60A5FA] shadow-md shadow-blue-500/50"
                      : "bg-white/35 hover:bg-white/70"
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
