"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { RafiqBrandLogo } from "@/components/ui/rafiq-brand-logo";
import { ArrowLeft, ArrowRight, ExternalLink, ArrowUp } from "lucide-react";

// Register ScrollTrigger safely in React / browser environment
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// -------------------------------------------------------------------------
// 1. RAFIQ THEMED INLINE STYLES (Luxury Navy & Deep Oceanic Aurora)
// -------------------------------------------------------------------------
const RAFIQ_FOOTER_STYLES = `
@keyframes rafiq-footer-breathe {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 0.55; }
  100% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.85; }
}

@keyframes rafiq-footer-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

.animate-rafiq-footer-breathe {
  animation: rafiq-footer-breathe 8s ease-in-out infinite alternate;
}

.animate-rafiq-footer-marquee {
  animation: rafiq-footer-marquee 35s linear infinite;
}

/* Deep Oceanic Aurora Ambient Glow */
.rafiq-footer-aurora {
  background: radial-gradient(
    circle at 50% 50%, 
    rgba(26, 58, 107, 0.65) 0%, 
    rgba(44, 79, 138, 0.35) 35%, 
    rgba(14, 28, 54, 0.15) 60%, 
    transparent 75%
  );
}

.rafiq-footer-golden-glow {
  background: radial-gradient(
    circle at 80% 70%, 
    rgba(217, 180, 110, 0.14) 0%, 
    transparent 55%
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

/* Giant Background Text Masking */
.rafiq-giant-bg-text {
  font-size: clamp(3.5rem, 16vw, 17rem);
  line-height: 0.75;
  font-weight: 900;
  letter-spacing: -0.03em;
  color: transparent;
  -webkit-text-stroke: 1.5px rgba(255, 255, 255, 0.16);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.05) 65%, transparent 100%);
  -webkit-background-clip: text;
  background-clip: text;
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
          const h = rect.width / 2;
          const w = rect.height / 2;
          const x = e.clientX - rect.left - h;
          const y = e.clientY - rect.top - w;

          gsap.to(element, {
            x: x * 0.35,
            y: y * 0.35,
            rotationX: -y * 0.1,
            rotationY: x * 0.1,
            scale: 1.04,
            ease: "power2.out",
            duration: 0.35,
          });
        };

        const handleMouseLeave = () => {
          gsap.to(element, {
            x: 0,
            y: 0,
            rotationX: 0,
            rotationY: 0,
            scale: 1,
            ease: "elastic.out(1, 0.35)",
            duration: 1.1,
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
  const giantTextRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);

  // Marquee item contents localized
  const marqueeItems = useMemo(() => {
    if (t.marquee && t.marquee.row1 && t.marquee.row1.length > 0) {
      return t.marquee.row1;
    }
    return [
      "مساعدك الموثوق في إسطنبول",
      "خدمات معتمدة واستشارات واضحة",
      "رفيق معك في كل خطوة",
      "أمان وشفافية وسرعة",
    ];
  }, [t]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!wrapperRef.current) return;

    // React strict mode compatible GSAP context cleanup
    const ctx = gsap.context(() => {
      // Parallax animation on background giant text
      gsap.fromTo(
        giantTextRef.current,
        { y: "12vh", scale: 0.85, opacity: 0 },
        {
          y: "0vh",
          scale: 1,
          opacity: 1,
          ease: "power1.out",
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: "top 85%",
            end: "bottom bottom",
            scrub: 1,
          },
        }
      );

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

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

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
          "relative w-full h-screen min-h-[640px] max-h-[1080px] overflow-hidden",
          className
        )}
        style={{ clipPath: "polygon(0% 0, 100% 0%, 100% 100%, 0 100%)" }}
      >
        {/* The actual footer is fixed behind and reveals on scroll */}
        <footer className="fixed bottom-0 left-0 flex h-screen min-h-[640px] max-h-[1080px] w-full flex-col justify-between overflow-hidden bg-[#0A1832] text-white selection:bg-[#FAF8F0]/20">
          
          {/* 1. Deep Atmospheric Gradient Layers (No Grids) */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0B1A36] via-[#09152B] to-[#050C1B] z-0 pointer-events-none" />
          <div className="rafiq-footer-aurora absolute left-1/2 top-1/2 h-[75vh] w-[85vw] -translate-x-1/2 -translate-y-1/2 animate-rafiq-footer-breathe rounded-[50%] blur-[90px] pointer-events-none z-0" />
          <div className="rafiq-footer-golden-glow absolute right-0 bottom-0 h-[50vh] w-[50vw] blur-[100px] pointer-events-none z-0" />

          {/* 2. Giant Background Outline Text */}
          <div
            ref={giantTextRef}
            className="rafiq-giant-bg-text absolute bottom-[6vh] left-[47%] -translate-x-1/2 whitespace-nowrap z-0 pointer-events-none select-none font-black tracking-tight"
          >
            RAFIQ.IST
          </div>

          {/* 3. Diagonal Sleek Marquee (Angled on tilt & lowered down with clean text only) */}
          <div className="absolute top-14 sm:top-16 md:top-20 left-0 w-full overflow-hidden border-y border-white/10 bg-[#0B1A36]/80 backdrop-blur-md py-3.5 sm:py-4 z-10 -rotate-2 scale-110 shadow-2xl">
            <div className="flex w-max animate-rafiq-footer-marquee text-xs sm:text-sm font-bold tracking-[0.25em] text-white/75 uppercase">
              <div className="flex items-center space-x-12 px-6">
                {marqueeItems.map((phrase, idx) => (
                  <span key={`m1-${idx}`} className="mx-8 select-none whitespace-nowrap">
                    {phrase}
                  </span>
                ))}
              </div>
              <div className="flex items-center space-x-12 px-6">
                {marqueeItems.map((phrase, idx) => (
                  <span key={`m2-${idx}`} className="mx-8 select-none whitespace-nowrap">
                    {phrase}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Main Center Content: Grand Title & Action Buttons */}
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 sm:px-6 pt-16 pb-4 w-full max-w-5xl mx-auto text-center">
            
            {/* Main Heading with Metallic Glow */}
            <h2
              ref={headingRef}
              className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black rafiq-text-glow tracking-tight mb-8 sm:mb-10 max-w-4xl leading-[1.15]"
            >
              {language === "ar"
                ? "جاهز لترتيب معاملتك؟"
                : language === "en"
                ? "Ready to begin?"
                : language === "fa"
                ? "آماده شروع هستید؟"
                : "Готовы начать?"}
            </h2>

            {/* Interactive Magnetic Action Pills Layout */}
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

          {/* 5. Bottom Bar: Brand Logo, Copyright & Back to Top */}
          <div className="relative z-20 w-full pb-8 sm:pb-10 px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/15 bg-[#060F22]/75 backdrop-blur-lg pt-5">
            
            {/* Logo and Brand */}
            <div className="flex items-center gap-3 order-1">
              <a href={`/${language}`} className="inline-block transition-transform hover:scale-105" aria-label={t.common.brandName}>
                <RafiqBrandLogo size="sm" variant="light" className="h-7 w-auto opacity-100 drop-shadow-sm" />
              </a>
              <span className="text-white/90 text-xs sm:text-sm font-semibold tracking-wide">
                — {t.common.tagline || "دليلك وخدماتك الموثوقة في إسطنبول"}
              </span>
            </div>

            {/* Copyright */}
            <div className="text-white/70 text-[11px] sm:text-xs font-medium tracking-wide order-2">
              © {new Date().getFullYear()} {t.common.brandName || "رفيق إسطنبول"} — {t.common.allRightsReserved || "جميع الحقوق محفوظة."}
            </div>

            {/* Back to top Button */}
            <MagneticButton
              as="button"
              onClick={scrollToTop}
              aria-label="Scroll to top"
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full rafiq-glass-pill flex items-center justify-center text-white hover:text-white group order-3 shadow-md"
            >
              <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5 transform group-hover:-translate-y-1 transition-transform duration-300" />
            </MagneticButton>

          </div>
        </footer>
      </div>
    </>
  );
}

export default RafiqCinematicFooter;
