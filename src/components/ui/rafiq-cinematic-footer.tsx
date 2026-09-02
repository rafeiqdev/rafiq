"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { NavyShimmerBackground } from "@/components/ui/oceanic-shimmer-navy";

// Register ScrollTrigger safely in React / browser environment
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// -------------------------------------------------------------------------
// 1. RAFIQ THEMED INLINE STYLES (Luxury Navy — calm, uncluttered)
//    The previous version layered a giant "RAFIQ.IST" watermark, a rotated
//    scrolling marquee, a breathing aurora blob and a golden glow all on top
//    of the heading, which read as messy overlapping text. This keeps only a
//    single soft ambient glow plus the glass pills and metallic heading.
// -------------------------------------------------------------------------
const RAFIQ_FOOTER_STYLES = `
/* Soft ambient glow behind the call to action */
.rafiq-footer-aurora {
  background: radial-gradient(
    circle at 50% 45%,
    rgba(26, 58, 107, 0.55) 0%,
    rgba(44, 79, 138, 0.28) 38%,
    transparent 70%
  );
}

/* Glass Pill Buttons for Rafiq */
.rafiq-glass-pill {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%);
  box-shadow:
      0 12px 30px -10px rgba(0, 0, 0, 0.6),
      inset 0 1px 1px rgba(255, 255, 255, 0.2),
      inset 0 -1px 2px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.rafiq-glass-pill:hover {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.06) 100%);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow:
      0 20px 40px -10px rgba(0, 0, 0, 0.7),
      inset 0 1px 1px rgba(255, 255, 255, 0.35);
  transform: translateY(-2px);
}

.rafiq-glass-pill-primary {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 245, 255, 0.85) 100%);
  color: #0A1C38 !important;
  box-shadow:
      0 14px 35px -8px rgba(0, 0, 0, 0.5),
      0 0 25px rgba(255, 255, 255, 0.2),
      inset 0 1px 2px rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.8);
}

.rafiq-glass-pill-primary:hover {
  background: #FFFFFF;
  color: #051024 !important;
  box-shadow:
      0 20px 45px -8px rgba(0, 0, 0, 0.7),
      0 0 35px rgba(255, 255, 255, 0.35),
      inset 0 1px 2px rgba(255, 255, 255, 1);
  transform: translateY(-2px) scale(1.02);
}

/* Metallic Header Text Glow */
.rafiq-text-glow {
  background: linear-gradient(180deg, #FFFFFF 0%, #E6EEF8 50%, rgba(200, 218, 245, 0.75) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0px 4px 25px rgba(255, 255, 255, 0.18));
}
`;

// -------------------------------------------------------------------------
// 2. MAGNETIC BUTTON PRIMITIVE
//    Softened: a gentle follow with no 3D tilt/rotation, so the pills no
//    longer wobble and skew under the cursor.
// -------------------------------------------------------------------------
export type MagneticButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    as?: React.ElementType;
  };

export const MagneticButton = React.forwardRef<HTMLElement, MagneticButtonProps>(
  ({ className, children, as: Component = "button", ...props }, forwardedRef) => {
    const localRef = useRef<HTMLElement>(null);

    useEffect(() => {
      if (typeof window === "undefined") return;
      const element = localRef.current;
      if (!element) return;

      const ctx = gsap.context(() => {
        const handleMouseMove = (e: MouseEvent) => {
          const rect = element.getBoundingClientRect();
          const x = e.clientX - rect.left - rect.width / 2;
          const y = e.clientY - rect.top - rect.height / 2;

          gsap.to(element, {
            x: x * 0.15,
            y: y * 0.15,
            ease: "power2.out",
            duration: 0.4,
          });
        };

        const handleMouseLeave = () => {
          gsap.to(element, {
            x: 0,
            y: 0,
            ease: "power3.out",
            duration: 0.6,
          });
        };

        element.addEventListener("mousemove", handleMouseMove as any);
        element.addEventListener("mouseleave", handleMouseLeave);

        return () => {
          element.removeEventListener("mousemove", handleMouseMove as any);
          element.removeEventListener("mouseleave", handleMouseLeave);
        };
      }, element);

      return () => ctx.revert();
    }, []);

    return (
      <Component
        ref={(node: HTMLElement) => {
          (localRef as any).current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) (forwardedRef as any).current = node;
        }}
        className={cn("cursor-pointer select-none transition-transform", className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
MagneticButton.displayName = "MagneticButton";

// -------------------------------------------------------------------------
// 3. RAFIQ CINEMATIC FOOTER COMPONENT
// -------------------------------------------------------------------------
export interface RafiqCinematicFooterProps {
  primaryCtaHref?: string;
  secondaryCtaHref?: string;
  className?: string;
}

export function RafiqCinematicFooter({
  primaryCtaHref,
  secondaryCtaHref,
  className,
}: RafiqCinematicFooterProps) {
  const { language, dir, isRtl, t } = useLanguage();
  const effectivePrimaryCtaHref = primaryCtaHref ?? `/${language}/auth`;
  const effectiveSecondaryCtaHref = secondaryCtaHref ?? `/${language}/services`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!wrapperRef.current) return;

    // React strict mode compatible GSAP context cleanup
    const ctx = gsap.context(() => {
      // Staggered Content Reveal on heading and action pills
      gsap.fromTo(
        [headingRef.current, linksRef.current],
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.15,
          ease: "power3.out",
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: "top 45%",
            end: "bottom bottom",
            scrub: 1,
          },
        }
      );
    }, wrapperRef);

    return () => ctx.revert();
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: RAFIQ_FOOTER_STYLES }} />

      {/*
        The "Curtain Reveal" Wrapper:
        Attached seamlessly below the previous section with clipPath.
      */}
      <div
        ref={wrapperRef}
        dir={dir}
        lang={language}
        className={cn(
          // Phones get a plain in-flow footer (max-md:*): the desktop "curtain"
          // keeps a position:fixed full-screen footer behind a clip-path
          // wrapper, and mobile Safari/Chrome compositing lets that fixed
          // layer bleed over the page mid-scroll — a dark block flashing over
          // the content, which the owner reported as a scrambled screen.
          "relative w-full h-screen min-h-[560px] max-h-[760px] overflow-hidden max-md:h-auto max-md:min-h-0 max-md:max-h-none",
          className
        )}
        style={{ clipPath: "polygon(0% 0, 100% 0%, 100% 100%, 0 100%)" }}
      >
        {/* The actual footer is fixed behind and reveals on scroll (desktop only) */}
        <footer className="fixed bottom-0 left-0 flex h-screen min-h-[560px] max-h-[760px] w-full flex-col justify-center overflow-hidden bg-navy text-white selection:bg-[#FAF8F0]/20 max-md:relative max-md:h-auto max-md:min-h-0 max-md:max-h-none">

          {/* 1. Calm atmospheric background: the site-navy "Oceanic Shimmer"
              gradient (grain + soft radial glows) + one gentle glow */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <NavyShimmerBackground className="h-full w-full" />
          </div>
          <div className="rafiq-footer-aurora absolute left-1/2 top-1/2 h-[60vh] w-[70vw] -translate-x-1/2 -translate-y-1/2 rounded-[50%] blur-[100px] pointer-events-none z-0" />

          {/* 2. Main Center Content: Title & Action Buttons */}
          <div className="relative z-10 flex flex-col items-center justify-center px-4 sm:px-6 py-16 w-full max-w-4xl mx-auto text-center">

            {/* Main Heading with Metallic Glow */}
            <h2
              ref={headingRef}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-5xl font-black rafiq-text-glow tracking-tight mb-8 sm:mb-10 lg:mb-8 max-w-3xl leading-[1.15]"
            >
              {language === "ar"
                ? "جاهز لترتيب معاملتك؟"
                : language === "en"
                ? "Ready to begin?"
                : language === "fa"
                ? "آماده شروع هستید؟"
                : "Готовы начать?"}
            </h2>

            {/* Action Pills Layout */}
            <div ref={linksRef} className="flex flex-col items-center gap-5 w-full">

              {/* Primary Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3.5 sm:gap-5 w-full">

                {/* 1. Primary CTA: Login / Get Started */}
                <MagneticButton
                  as="a"
                  href={effectivePrimaryCtaHref}
                  className="rafiq-glass-pill-primary px-8 sm:px-10 py-4 rounded-full font-bold text-sm sm:text-base flex items-center gap-3 transition-transform"
                >
                  <span>{t.cta.primaryCta || "سجل دخولك الآن"}</span>
                  {isRtl ? (
                    <ArrowLeft className="w-4 h-4 transition-transform duration-200" />
                  ) : (
                    <ArrowRight className="w-4 h-4 transition-transform duration-200" />
                  )}
                </MagneticButton>

                {/* 2. Secondary CTA: Browse Services */}
                <MagneticButton
                  as="a"
                  href={effectiveSecondaryCtaHref}
                  className="rafiq-glass-pill px-7 sm:px-9 py-4 rounded-full text-white font-bold text-sm sm:text-base flex items-center gap-2.5 hover:text-[#FAF8F0]"
                >
                  <span>{t.cta.secondaryCta || "استكشف كافة الخدمات"}</span>
                  <ExternalLink className="w-4 h-4 text-white/70" />
                </MagneticButton>
              </div>

              {/* Secondary Navigation Links */}
              <div className="flex flex-wrap justify-center gap-2 sm:gap-4 w-full mt-3">
                <MagneticButton
                  as="a"
                  href={`/${language}/services`}
                  className="rafiq-glass-pill px-4 sm:px-5 py-2.5 rounded-full text-white/75 font-medium text-xs sm:text-sm hover:text-white"
                >
                  {t.nav.services || "الخدمات"}
                </MagneticButton>

                <MagneticButton
                  as="a"
                  href={`#faq`}
                  className="rafiq-glass-pill px-4 sm:px-5 py-2.5 rounded-full text-white/75 font-medium text-xs sm:text-sm hover:text-white"
                >
                  {t.common.faq || "الأسئلة الشائعة"}
                </MagneticButton>

                <MagneticButton
                  as="a"
                  href={`/${language}/map`}
                  className="rafiq-glass-pill px-4 sm:px-5 py-2.5 rounded-full text-white/75 font-medium text-xs sm:text-sm hover:text-white"
                >
                  {t.nav.cityGuide || "دليل إسطنبول"}
                </MagneticButton>

                <MagneticButton
                  as="a"
                  href={`/${language}/help`}
                  className="rafiq-glass-pill px-4 sm:px-5 py-2.5 rounded-full text-white/75 font-medium text-xs sm:text-sm hover:text-white"
                >
                  {t.common.contactUs || "تواصل معنا"}
                </MagneticButton>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

export default RafiqCinematicFooter;
