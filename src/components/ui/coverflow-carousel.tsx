"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useSpring,
  useVelocity,
  animate,
  type MotionValue,
} from "framer-motion";
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

// One shared buttery spring for every positional change (slide change, snap).
// stiffness/damping tuned to settle in ~0.6s with no bounce — Apple-style easeOutExpo feel.
const BUTTER_SPRING = { type: "spring", stiffness: 210, damping: 30, mass: 0.9 } as const;
const DRAG_RELEASE_SPRING = { type: "spring", stiffness: 420, damping: 38, mass: 0.8 } as const;
const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Single coverflow card.
 *
 * Two nested motion layers so finger-drag and slide-change never fight:
 * - OUTER layer: springs to its slot (x / rotateY / scale / opacity) when
 *   `currentIndex` changes. Pure transform+opacity, GPU-composited.
 * - INNER layer: follows the finger 1:1 via the shared `dragX` MotionValue —
 *   updates hit the compositor directly with ZERO React re-renders, which is
 *   what makes the drag feel glued to the finger instead of laggy.
 */
const CoverflowSlide = React.memo(function CoverflowSlide({
  slide,
  stepNumber,
  isCenter,
  isNear,
  isRtl,
  baseX,
  translateZ,
  rotateY,
  rotateZ,
  scale,
  opacity,
  zIndex,
  dragX,
  tilt,
  reducedMotion,
  goToSlide,
  index,
  onRequestService,
  requestServiceLabel,
}: {
  slide: ServiceSlide;
  stepNumber: string;
  isCenter: boolean;
  isNear: boolean;
  isRtl: boolean;
  baseX: number;
  translateZ: number;
  rotateY: number;
  rotateZ: number;
  scale: number;
  opacity: number;
  zIndex: number;
  dragX: MotionValue<number>;
  tilt: MotionValue<number>;
  reducedMotion: boolean;
  goToSlide: (index: number) => void;
  index: number;
  onRequestService: (slide: ServiceSlide) => void;
  requestServiceLabel: string;
}) {
  // Live finger offset — no re-render, compositor only.
  const dragShift = useTransform(dragX, (v) => (reducedMotion ? 0 : v * 0.9));
  // Subtle image parallax for depth while swiping.
  const imgShift = useTransform(dragX, (v) =>
    reducedMotion ? 0 : Math.max(-14, Math.min(14, v * -0.05))
  );

  return (
    <motion.div
      aria-hidden={!isCenter}
      className="absolute flex items-center justify-center"
      style={{
        zIndex,
        transformStyle: "preserve-3d",
        backfaceVisibility: "hidden",
        // Only the visible cards get their own GPU layer — permanent
        // will-change on every card wastes memory and hurts scrolling.
        willChange: isNear ? "transform" : "auto",
        pointerEvents: isNear ? "auto" : "none",
      }}
      initial={false}
      animate={{
        x: baseX,
        z: reducedMotion ? 0 : translateZ,
        rotateY: reducedMotion ? 0 : rotateY,
        rotateZ: reducedMotion ? 0 : rotateZ,
        scale,
        opacity,
      }}
      transition={BUTTER_SPRING}
    >
      {/* Finger-follow layer */}
      <motion.div style={reducedMotion ? undefined : { x: dragShift, rotate: isCenter ? tilt : 0 }} className="relative">
        {/* Soft glow that breathes behind the centered card */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-[radial-gradient(closest-side,rgba(96,165,250,0.35),transparent)] blur-2xl"
          initial={false}
          animate={{ opacity: isCenter && !reducedMotion ? 1 : 0, scale: isCenter ? 1 : 0.85 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
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
        <motion.div
          role="group"
          aria-label={`Service ${slide.title}: ${slide.description}`}
          onPointerUp={() => {
            // A real drag just ended — don't steal it as a "pick this card" tap.
            if (Math.abs(dragX.get()) > 6) return;
            if (!isCenter) goToSlide(index);
          }}
          className={cn(
            "group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-3xl border bg-white shadow-xl",
            isRtl ? "text-right" : "text-left",
            "w-[290px] sm:w-[330px] md:w-[360px] lg:w-[320px] p-5 sm:p-6 lg:p-5",
            isCenter
              ? "border-[#1A3A6B]/50 shadow-2xl shadow-[#12294D]/25 ring-2 ring-[#1A3A6B]/30"
              : "border-[#EFEADB] shadow-md hover:border-[#1A3A6B]/30",
            // Shadow/border fade only (transform is owned by framer-motion,
            // so no Tailwind translate here — it would be dead code).
            "transition-[box-shadow,border-color] duration-300 ease-out"
          )}
          // Gentle infinite float on the centered card only.
          animate={isCenter && !reducedMotion ? { y: [0, -7, 0] } : { y: 0 }}
          transition={
            isCenter && !reducedMotion
              ? { duration: 5, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.35, ease: "easeOut" }
          }
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

            {/* Expansive Full-Bleed Image Container with parallax + shine sweep.
                Parallax lives on a wrapper so the <img> keeps its pure-CSS
                hover zoom (framer's inline transform would override it). */}
            <div className="relative mb-4 h-44 sm:h-52 w-full overflow-hidden rounded-2xl bg-[#1A3A6B]/5 border border-[#EFEADB]">
              <motion.div style={reducedMotion ? undefined : { x: imgShift }} className="h-full w-full">
                <img
                  src={slide.src}
                  alt={slide.alt}
                  loading={isNear ? "eager" : "lazy"}
                  decoding="async"
                  draggable={false}
                  className="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-108"
                />
              </motion.div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#12294D]/15 via-transparent to-transparent pointer-events-none" />
              {/* Shine sweep across the centered card */}
              {!reducedMotion && isCenter && (
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent"
                  initial={{ x: "-120%" }}
                  animate={{ x: ["-120%", "420%"] }}
                  transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 4.2, ease: "easeInOut" }}
                />
              )}
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
                // A drag ending here is a swipe, not a tap: let it bubble to
                // the container so the slide still advances — only real taps
                // navigate. (Stopping propagation unconditionally used to eat
                // swipes that started on the button: no slide change AND no
                // navigation — a dead gesture.)
                if (Math.abs(dragX.get()) > 6) return;
                e.stopPropagation();
                onRequestService(slide);
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
              aria-label={`${requestServiceLabel}: ${slide.title}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1A3A6B] px-4 py-3 text-xs sm:text-sm font-black text-white shadow-md transition-[background-color,box-shadow,transform] duration-200 group-hover:bg-[#12294D] group-hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1A3A6B] focus-visible:ring-offset-2"
            >
              <span>{requestServiceLabel}</span>
              {isRtl ? (
                <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" aria-hidden="true" />
              ) : (
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
              )}
            </a>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
});

/**
 * 3D Coverflow Carousel for Rafiq Services with Oceanic Glow Gradient Background
 * Dynamically adapts 3D physics, gestures, and typography for Arabic, English, Persian, and Russian.
 *
 * Motion model (buttery rewrite): slide positions spring with shared physics,
 * finger drag writes straight into a MotionValue (no React re-render per pixel),
 * release snaps back with a spring and flick velocity can skip slides.
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
  const [viewportW, setViewportW] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const startXRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const isPointerDownRef = useRef<boolean>(false);
  const dragDistanceRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const latestXRef = useRef<number>(0);
  const samplesRef = useRef<Array<{ x: number; t: number }>>([]);
  const lastInteractRef = useRef<number>(0);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalSlides = activeSlides.length;

  // Shared finger-drag value: updated per-frame WITHOUT React re-renders.
  const dragX = useMotionValue(0);
  const dragVelocity = useVelocity(dragX);
  const smoothVelocity = useSpring(dragVelocity, { stiffness: 300, damping: 40 });
  // Bank the centered card slightly into fast swipes (clamped ±4deg).
  const tilt = useTransform(smoothVelocity, [-1400, 0, 1400], [4, 0, -4]);

  const spacing = viewportW < 640 ? 150 : 230;

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
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

  // "Request Service" navigation through the router (same page transition as
  // every <Link>) — a full reload flashed white and re-fetched the whole app;
  // href stays as the keyboard fallback. Ignores drags so a swipe that ends
  // on the button never navigates by accident.
  const handleRequestService = useCallback(
    (slide: ServiceSlide) => {
      if (isDraggingRef.current || dragDistanceRef.current > 6) return;
      lastInteractRef.current = Date.now();
      const internal = routePathFromHref(slide.href);
      if (internal) navigate(internal.path + internal.url.search + internal.url.hash);
      else window.location.href = slide.href;
    },
    [navigate]
  );

  // Smart Auto-Scroll: pauses on hover/focus/drag, for a cooldown after any
  // manual interaction, and while the tab is hidden.
  useEffect(() => {
    if (!autoScroll || isPaused || reducedMotion || isPointerDown) return;

    const timer = setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - lastInteractRef.current < 2500) return;
      nextSlide();
    }, autoScrollInterval);

    return () => clearInterval(timer);
  }, [autoScroll, isPaused, reducedMotion, isPointerDown, nextSlide, autoScrollInterval]);

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

  // Pointer Drag adapted to direction.
  //
  // PERFORMANCE: pointermove only records the latest X and schedules ONE
  // requestAnimationFrame that writes into the `dragX` MotionValue. Motion
  // values update the compositor directly — no setState, no React re-render
  // per pixel — so the cards stay glued to the finger at 60fps.
  //
  // Pointer capture is deliberately NOT taken here on pointerdown. Capturing
  // immediately (the original behavior) makes Chromium retarget the click
  // that follows pointerup to the CAPTURING element (this container div)
  // instead of whatever was actually under the cursor — so a plain click on
  // "Request Service" never reached the <a> at all, it silently landed on
  // this wrapper div instead. Capture is taken only once real dragging is
  // confirmed (past the 6px threshold), so a simple click never captures
  // the pointer and the native click reaches the real link.
  const handlePointerDown = (e: React.PointerEvent) => {
    isPointerDownRef.current = true;
    setIsPointerDown(true);
    setIsPaused(true);
    startXRef.current = e.clientX;
    latestXRef.current = e.clientX;
    isDraggingRef.current = false;
    dragDistanceRef.current = 0;
    samplesRef.current = [{ x: e.clientX, t: performance.now() }];
    dragX.stop();
    dragX.set(0);
  };

  const applyDragFrame = useCallback(
    (pointerId: number) => {
      rafRef.current = 0;
      const deltaX = latestXRef.current - startXRef.current;
      dragDistanceRef.current = Math.abs(deltaX);

      const now = performance.now();
      const samples = samplesRef.current;
      samples.push({ x: latestXRef.current, t: now });
      if (samples.length > 6) samples.shift();

      if (dragDistanceRef.current > 6) {
        if (!isDraggingRef.current && containerRef.current) {
          try {
            if (!containerRef.current.hasPointerCapture(pointerId)) {
              containerRef.current.setPointerCapture(pointerId);
            }
          } catch {
            /* noop — capture unsupported, drag still works */
          }
        }
        isDraggingRef.current = true;
      }

      dragX.set(deltaX);
    },
    [dragX]
  );

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDownRef.current) return;
    latestXRef.current = e.clientX;
    if (rafRef.current) return;
    const pointerId = e.pointerId;
    rafRef.current = requestAnimationFrame(() => applyDragFrame(pointerId));
  };

  const finishDrag = useCallback(
    (pointerId: number | null) => {
      if (!isPointerDownRef.current) return;
      isPointerDownRef.current = false;
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

      const deltaX = latestXRef.current - startXRef.current;

      // Flick velocity from the last samples (px/ms), fell back to 0.
      let velocity = 0;
      const samples = samplesRef.current;
      if (samples.length >= 2) {
        const first = samples[0];
        const last = samples[samples.length - 1];
        const dt = last.t - first.t;
        if (dt > 0) velocity = (last.x - first.x) / dt;
      }

      const threshold = 45;
      // Positive `forward` always means "go to next".
      const forward = isRtl ? deltaX : -deltaX;
      const forwardVelocity = isRtl ? velocity : -velocity;

      let jump = 0;
      if (forward > threshold || forwardVelocity > 0.45) jump = 1;
      else if (forward < -threshold || forwardVelocity < -0.45) jump = -1;
      // A long hard fling skips two cards — feels physical, not sticky.
      if (Math.abs(forward) > spacing * 1.4 && Math.abs(forwardVelocity) > 0.3) {
        jump = (forward > 0 ? 1 : -1) * 2;
      }

      // Spring the finger layer back to rest, then advance the slot so the
      // card glides (instead of jumping) to its new position.
      animate(dragX, 0, DRAG_RELEASE_SPRING);
      if (jump !== 0) {
        goToSlide(currentIndex + jump);
      } else {
        lastInteractRef.current = Date.now();
      }

      // Brief cooldown before autoplay resumes — no instant yank after a drag.
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = setTimeout(() => setIsPaused(false), 1200);

      setTimeout(() => {
        isDraggingRef.current = false;
      }, 50);
    },
    [currentIndex, dragX, goToSlide, isRtl, spacing]
  );

  const handlePointerUp = (e: React.PointerEvent) => {
    finishDrag(e.pointerId);
  };

  const handlePointerCancel = () => {
    finishDrag(null);
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
      onMouseLeave={() => { if (!isPointerDownRef.current) setIsPaused(false); }}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      className={cn(
        "relative w-full overflow-hidden pt-16 sm:pt-32 lg:pt-24 pb-14 sm:pb-32 lg:pb-20 text-[#12294D] font-sans outline-none select-none",
        className
      )}
      {...props}
    >
      {/* Static gradient in its own composited layer: GPU-cached once, never
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
        {/* Section Header — soft rise-in on scroll into view */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
          className="mx-auto mb-8 sm:mb-18 max-w-4xl text-center pointer-events-auto"
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
        </motion.div>

        {/* 3D Coverflow Container */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 40, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.8, delay: 0.12, ease: EASE_OUT_EXPO }}
          className="relative w-full max-w-5xl mx-auto"
        >
          {/* Floating Navigation Controls */}
          <div className="pointer-events-none absolute -inset-x-3 sm:-inset-x-8 inset-y-0 flex items-center justify-between z-40">
            {/* First Button (Left side of screen) */}
            <motion.button
              type="button"
              whileHover={reducedMotion ? undefined : { scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              onClick={(e) => {
                e.stopPropagation();
                if (isRtl) {
                  nextSlide();
                } else {
                  prevSlide();
                }
              }}
              aria-label={isRtl ? "Next service" : "Previous service"}
              className="pointer-events-auto flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white border border-white/40 shadow-xl backdrop-blur-md transition-colors duration-200 hover:shadow-2xl cursor-pointer"
            >
              <ChevronLeft className="h-6 w-6 stroke-[2.5]" />
            </motion.button>

            {/* Second Button (Right side of screen) */}
            <motion.button
              type="button"
              whileHover={reducedMotion ? undefined : { scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              onClick={(e) => {
                e.stopPropagation();
                if (isRtl) {
                  prevSlide();
                } else {
                  nextSlide();
                }
              }}
              aria-label={isRtl ? "Previous service" : "Next service"}
              className="pointer-events-auto flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white border border-white/40 shadow-xl backdrop-blur-md transition-colors duration-200 hover:shadow-2xl cursor-pointer"
            >
              <ChevronRight className="h-6 w-6 stroke-[2.5]" />
            </motion.button>
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
              const isNear = Math.abs(diff) <= 1;

              // Slot position for this card — the outer layer springs here.
              const baseX = isRtl ? -diff * spacing : diff * spacing;
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
                <CoverflowSlide
                  key={slide.id}
                  slide={slide}
                  index={index}
                  stepNumber={stepNumber}
                  isCenter={isCenter}
                  isNear={isNear}
                  isRtl={isRtl}
                  baseX={baseX}
                  translateZ={translateZ}
                  rotateY={rotateY}
                  rotateZ={rotateZ}
                  scale={scale}
                  opacity={opacity}
                  zIndex={zIndex}
                  dragX={dragX}
                  tilt={tilt}
                  reducedMotion={reducedMotion}
                  goToSlide={goToSlide}
                  onRequestService={handleRequestService}
                  requestServiceLabel={t.common.requestService}
                />
              );
            })}
          </div>

          {/* Smooth Interactive Pagination Dots — width springs via layout */}
          <div className="mt-4 sm:mt-6 flex items-center justify-center gap-2 z-30">
            {activeSlides.map((slide, dotIndex) => {
              const isActive = dotIndex === currentIndex;
              return (
                <motion.button
                  key={slide.id}
                  type="button"
                  layout
                  initial={false}
                  animate={{ width: isActive ? 32 : 10, opacity: isActive ? 1 : 0.55 }}
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                  onClick={() => goToSlide(dotIndex)}
                  aria-label={`Go to slide ${dotIndex + 1}`}
                  className={cn(
                    "h-2.5 rounded-full cursor-pointer",
                    isActive
                      ? "bg-[#60A5FA] shadow-md shadow-blue-500/50"
                      : "bg-white/35 hover:bg-white/70"
                  )}
                />
              );
            })}
          </div>
        </motion.div>
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
