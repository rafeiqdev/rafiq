"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { HelpCircle } from "lucide-react";
import { GradientBackground } from "@/components/ui/oceanic-shimmer";
import { useLanguage } from "@/i18n/LanguageContext";
import { VerifiedBadge } from "@/components/ui/verified-badge";

export interface FaqItem {
  id: string | number;
  question: string;
  answer: string;
  category?: string;
}

export interface FaqCardProps {
  item: FaqItem;
  className?: string;
  isRtl?: boolean;
  verifiedLabel?: string;
}

/**
 * Reusable FAQ Card customized for Rafiq Istanbul
 */
export const FaqCard: React.FC<FaqCardProps> = ({
  item,
  className,
  isRtl = false,
  verifiedLabel = "Verified Answer by Rafiq",
}) => {
  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between w-[290px] sm:w-[340px] md:w-[380px] lg:w-[330px] shrink-0 rounded-2xl sm:rounded-3xl border border-[#EFEADB] bg-[#FFFDF7] p-5 sm:p-6 shadow-md transition-all duration-300",
        isRtl ? "text-right" : "text-left",
        "hover:-translate-y-1 hover:border-[#1A3A6B]/40 hover:shadow-xl hover:shadow-[#12294D]/15",
        "focus-within:ring-2 focus-within:ring-[#1A3A6B] focus-within:ring-offset-2 focus-within:ring-offset-[#FAF8F0]",
        className
      )}
      tabIndex={0}
      role="article"
      aria-label={`Question: ${item.question}`}
    >
      <div>
        {/* Top Eyebrow with Category Tag & Icon */}
        <div className={cn("mb-3 flex items-center justify-between", isRtl && "flex-row-reverse")}>
          {item.category && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E2D9C5] bg-[#FAF8F0] px-2.5 py-0.5 text-[11px] font-bold text-[#1A3A6B]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1A3A6B]" aria-hidden="true" />
              <span>{item.category}</span>
            </span>
          )}
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FAF8F0] border border-[#EFEADB] text-[#1A3A6B] transition-transform duration-200 group-hover:scale-110">
            <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>

        {/* Question Heading */}
        <h3 className="mb-2 text-base sm:text-lg lg:text-base font-black tracking-tight text-[#12294D] transition-colors duration-200 group-hover:text-[#1A3A6B] leading-snug">
          {item.question}
        </h3>

        {/* Answer Text */}
        <p className="text-xs sm:text-sm text-[#4A5F7D] leading-relaxed line-clamp-4">
          {item.answer}
        </p>
      </div>

      {/* Subtle Bottom Accent Indicator */}
      <div className={cn("mt-4 pt-3 border-t border-[#EFEADB]/60 flex items-center justify-between text-[11px] font-semibold text-[#1A3A6B]/80 group-hover:text-[#1A3A6B]", isRtl && "flex-row-reverse")}>
        <span className="inline-flex items-center gap-1.5">
          <VerifiedBadge variant="shimmer" size={13} />
          <span>{verifiedLabel}</span>
        </span>
        <span className={cn("inline-block transition-transform duration-200", isRtl ? "group-hover:-translate-x-1" : "group-hover:translate-x-1")}>
          {isRtl ? "←" : "→"}
        </span>
      </div>
    </div>
  );
};

export interface HorizontalScrollerProps {
  items: FaqItem[];
  direction?: "left" | "right";
  speed?: number; // duration in seconds
  pauseOnHover?: boolean;
  className?: string;
  isRtl?: boolean;
  verifiedLabel?: string;
}

/**
 * Continuous Smooth Horizontal Scroller with duplicated loop and soft fade mask
 */
export const HorizontalScroller: React.FC<HorizontalScrollerProps> = ({
  items,
  direction = "left",
  speed = 60,
  pauseOnHover = true,
  className,
  isRtl = false,
  verifiedLabel,
}) => {
  const animationClass = direction === "left" ? "animate-scroll-left" : "animate-scroll-right";

  return (
    <div
      dir="ltr"
      className={cn(
        "relative w-full overflow-hidden py-2 select-none",
        className
      )}
      style={{
        maskImage: "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
      }}
    >
      {/* Scrolling Track */}
      <div
        className={cn(
          "flex w-max gap-4 sm:gap-6",
          animationClass,
          pauseOnHover && "pause-on-hover"
        )}
        style={{
          "--scroll-duration": `${speed}s`,
        } as React.CSSProperties}
      >
        {/* Set 1 */}
        {items.map((item, idx) => (
          <FaqCard key={`orig-${item.id || idx}`} item={item} isRtl={isRtl} verifiedLabel={verifiedLabel} />
        ))}

        {/* Set 2 (Clone) */}
        {items.map((item, idx) => (
          <div key={`clone-${item.id || idx}`} aria-hidden="true">
            <FaqCard item={item} isRtl={isRtl} verifiedLabel={verifiedLabel} />
          </div>
        ))}
      </div>
    </div>
  );
};

export interface HabitFaqScrollerProps extends React.HTMLAttributes<HTMLElement> {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}

/**
 * HabitFaqScroller Section
 * 2 rows of dynamically translated questions & answers with continuous gentle scrolling.
 */
export const HabitFaqScroller: React.FC<HabitFaqScrollerProps> = ({
  eyebrow,
  title,
  subtitle,
  className,
  ...props
}) => {
  const { language, dir, isRtl, t } = useLanguage();

  const faqRows = useMemo(() => [
    {
      title: t.faq.row1Title,
      speed: 64,
      direction: "left" as const,
      items: t.faq.row1,
    },
    {
      title: t.faq.row2Title,
      speed: 72,
      direction: "right" as const,
      items: t.faq.row2,
    },
  ], [t]);

  return (
    <section
      id="faq"
      dir={dir}
      lang={language}
      className={cn(
        "relative w-full overflow-hidden pt-16 sm:pt-24 lg:pt-20 pb-20 sm:pb-28 lg:pb-20 text-[#12294D] font-sans selection:bg-[#1A3A6B]/15",
        className
      )}
      {...props}
    >
      {/* Oceanic Shimmer Gradient Background */}
      <GradientBackground className="absolute inset-0 z-0" />

      {/* Gentle Organic Top Wave Transition from Section 4 */}
      <div className="absolute top-0 inset-x-0 overflow-hidden leading-none z-10 pointer-events-none -mt-px">
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

      <div className="relative z-10 w-full">
        {/* Header Block */}
        <div className="container mx-auto max-w-4xl px-4 text-center mb-10 sm:mb-12 lg:mb-9">
          <div className="mb-3 inline-flex items-center gap-2.5">
            <span className="h-px w-6 bg-[#1A3A6B]/30" aria-hidden="true" />
            <span className="text-xs sm:text-sm font-black tracking-widest text-[#1A3A6B] uppercase">
              {eyebrow || t.faq.eyebrow}
            </span>
            <span className="h-px w-6 bg-[#1A3A6B]/30" aria-hidden="true" />
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-4xl font-black tracking-tight text-[#12294D] leading-tight">
            {title || t.faq.title}
          </h2>

          <p className="mt-4 text-sm sm:text-base md:text-lg lg:text-base text-[#3A5070] max-w-2xl mx-auto leading-relaxed">
            {subtitle || t.faq.subtitle}
          </p>
        </div>

        {/* 2 Horizontal Scrolling Rows in Alternating Directions */}
        <div className="w-full space-y-4 sm:space-y-6 my-6">
          {faqRows.map((row, index) => (
            <div key={index} className="w-full">
              <HorizontalScroller
                items={row.items}
                direction={row.direction}
                speed={row.speed}
                pauseOnHover={true}
                isRtl={isRtl}
                verifiedLabel={t.faq.verifiedAnswerLabel}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Seamless Symmetrical Organic Bottom Wave Transition into Section 6 (Cta4) */}
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

export default HabitFaqScroller;
