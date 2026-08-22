"use client";

import React, { useRef, useEffect, useState } from "react";
import { useScroll, useTransform } from "framer-motion";
import { GoogleGeminiEffect } from "./google-gemini-effect";
import { ArrowRight, ArrowLeft, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";

export interface RafiqConnectionAnimationSectionProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  description?: string;
  pillLabel?: string;
  primaryCtaText?: string;
  secondaryCtaText?: string;
  primaryCtaHref?: string;
  secondaryCtaHref?: string;
}

/**
 * Integrated Rafiq Connection Animation Section
 * Balanced two-sided flowing network connecting User Needs to Rafiq Solutions in 4 languages.
 */
export const RafiqConnectionAnimationSection: React.FC<RafiqConnectionAnimationSectionProps> = ({
  title,
  description,
  pillLabel,
  primaryCtaText,
  secondaryCtaText,
  primaryCtaHref,
  secondaryCtaHref,
  className,
  ...props
}) => {
  const { language, dir, isRtl, t } = useLanguage();
  const effectivePrimaryCtaHref = primaryCtaHref ?? `/${language}/auth`;
  const effectiveSecondaryCtaHref = secondaryCtaHref ?? `/${language}/services`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const effectivePrimaryCta = primaryCtaText || t.connection.primaryCta;
  const effectiveSecondaryCta = secondaryCtaText || t.connection.secondaryCta;

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Track scroll naturally as user enters the section
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // 5 MotionValue Path Lengths mapped to scroll progress
  const pathLength0 = useTransform(scrollYProgress, [0.08, 0.52], [0, 1]);
  const pathLength1 = useTransform(scrollYProgress, [0.10, 0.55], [0, 1]);
  const pathLength2 = useTransform(scrollYProgress, [0.12, 0.58], [0, 1]);
  const pathLength3 = useTransform(scrollYProgress, [0.14, 0.61], [0, 1]);
  const pathLength4 = useTransform(scrollYProgress, [0.16, 0.64], [0, 1]);

  // Static fallback values for reduced motion
  const staticFull = useTransform(scrollYProgress, [0, 1], [1, 1]);
  const activePathLengths = reducedMotion
    ? [staticFull, staticFull, staticFull, staticFull, staticFull]
    : [pathLength0, pathLength1, pathLength2, pathLength3, pathLength4];

  return (
    <section
      ref={containerRef}
      id="rafiq-connection"
      dir={dir}
      lang={language}
      className={cn(
        "relative w-full overflow-hidden bg-gradient-to-b from-[#FAF8F0] via-[#FAF6ED] to-[#FAF8F0] pt-14 sm:pt-16 md:pt-20 pb-0 text-[#12294D] font-sans selection:bg-[#1A3A6B]/15",
        className
      )}
      {...props}
    >
      {/* Background Soft Rafiq Blue Glow Layer */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 35%, #B8D7FF 0%, transparent 65%),
            radial-gradient(circle at 50% 85%, #D4E5FA 0%, transparent 70%)
          `,
          opacity: 0.45,
          mixBlendMode: "multiply",
        }}
        aria-hidden="true"
      />

      <div className="container relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-10 sm:pb-14">
        {/* Animated Google Gemini Lines Canvas */}
        <GoogleGeminiEffect
          pathLengths={activePathLengths}
          title={title}
          description={description}
          pillLabel={pillLabel}
        />

        {/* Calm, Distinct Closing CTA Block */}
        <div className="relative z-30 mx-auto mt-8 sm:mt-10 md:mt-8 max-w-2xl text-center">
          <h3 className="text-xl sm:text-2xl font-black text-[#12294D] tracking-tight">
            {t.connection.ctaHeading}
          </h3>

          <p className="mt-1.5 text-xs sm:text-sm text-[#4A5F7D] max-w-lg mx-auto leading-relaxed">
            {t.connection.ctaDescription}
          </p>

          <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <a
              href={effectivePrimaryCtaHref}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#1A3A6B] px-7 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-[#1A3A6B]/20 transition-all duration-200 hover:bg-[#12294D] hover:scale-105 active:scale-98 cursor-pointer"
            >
              <span>{effectivePrimaryCta}</span>
              {isRtl ? (
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              )}
            </a>

            <a
              href={effectiveSecondaryCtaHref}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-[#E2D9C5] bg-[#FAF8F0] px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-[#1A3A6B] transition-all duration-200 hover:bg-[#EFEADB]/80 hover:border-[#1A3A6B]/30 cursor-pointer"
            >
              <span>{effectiveSecondaryCta}</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      {/* Gentle Organic Wave Transition into Section 5 (FAQ / Oceanic Shimmer) */}
      <div className="relative w-full overflow-hidden leading-none z-20 pointer-events-none -mb-1">
        <svg
          className="w-full h-10 sm:h-16 text-[#FAF8F0]"
          viewBox="0 0 1440 60"
          fill="currentColor"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0,32 C360,58 720,12 1080,42 C1260,54 1380,36 1440,28 L1440,60 L0,60 Z" />
        </svg>
      </div>
    </section>
  );
};

export default RafiqConnectionAnimationSection;
