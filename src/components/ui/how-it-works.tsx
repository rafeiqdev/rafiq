"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type React from "react";
import { useLanguage } from "@/i18n/LanguageContext";

// The main props for the HowItWorks component
interface HowItWorksProps extends React.HTMLAttributes<HTMLElement> {}

interface StepCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  benefits: string[];
  stepNumber: string;
  isRtl: boolean;
}

/**
 * Step 1: Precision Focus / Discovery Compass Icon
 */
const Step1Icon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="transition-transform duration-300 group-hover:scale-110"
    aria-hidden="true"
  >
    <circle cx="16" cy="16" r="12" stroke="#1A3A6B" strokeWidth="1.75" strokeDasharray="3 3" opacity="0.35" />
    <circle cx="16" cy="16" r="7.5" fill="#E8F0FB" stroke="#1A3A6B" strokeWidth="1.75" />
    <circle cx="16" cy="16" r="2.5" fill="#1A3A6B" />
    <path d="M16 2v4M16 26v4M2 16h4M26 16h4" stroke="#1A3A6B" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/**
 * Step 2: Clear Insights / Layered Knowledge Guide Icon
 */
const Step2Icon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="transition-transform duration-300 group-hover:scale-110"
    aria-hidden="true"
  >
    <rect x="5" y="4" width="22" height="24" rx="4" fill="#E8F0FB" fillOpacity="0.5" stroke="#1A3A6B" strokeWidth="1.75" />
    <path d="M9 10h14M9 15h10M9 20h6" stroke="#1A3A6B" strokeWidth="1.85" strokeLinecap="round" />
    <circle cx="21" cy="21" r="5" fill="#FAF8F0" stroke="#1A3A6B" strokeWidth="1.85" />
    <path d="m24.5 24.5 3 3" stroke="#1A3A6B" strokeWidth="2" strokeLinecap="round" />
    <circle cx="21" cy="21" r="1.5" fill="#1A3A6B" />
  </svg>
);

/**
 * Step 3: Verified Confidence / Trusted Shield Execution Icon
 */
const Step3Icon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="transition-transform duration-300 group-hover:scale-110"
    aria-hidden="true"
  >
    <path
      d="M16 3l10 4.5v7.5c0 6.5-4.5 12-10 14-5.5-2-10-7.5-10-14V7.5L16 3z"
      fill="#E8F0FB"
      fillOpacity="0.6"
      stroke="#1A3A6B"
      strokeWidth="1.85"
      strokeLinejoin="round"
    />
    <path
      d="m11.5 15.5 3 3 6-6"
      stroke="#1A3A6B"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * A single enlarged step card within the "How It Works" section.
 */
const StepCard: React.FC<StepCardProps> = ({
  icon,
  title,
  description,
  benefits,
  stepNumber,
  isRtl,
}) => {
  return (
    <div
      className={cn(
        "group relative flex flex-col justify-start overflow-hidden rounded-2xl sm:rounded-3xl border border-[#EFEADB] bg-[#FFFFFF] p-5 sm:p-7 shadow-sm transition-all duration-300 ease-out",
        // phone: one swipe-row card; desktop: a grid cell (see the row in HowItWorks)
        // an explicit width, not min-width: a flex-row item sizes to its
        // text otherwise, and the one-line description then never wraps
        "w-[80%] max-w-[80%] shrink-0 snap-center md:w-auto md:max-w-none md:shrink",
        isRtl ? "text-right" : "text-left",
        "before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-transparent before:via-[#1A3A6B] before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300",
        "hover:-translate-y-1.5 hover:border-[#1A3A6B]/35 hover:shadow-xl hover:shadow-[#1A3A6B]/10",
        "active:scale-[0.99] active:transition-transform active:duration-100",
        "focus-within:ring-2 focus-within:ring-[#1A3A6B] focus-within:ring-offset-4 focus-within:ring-offset-[#FAF8F0]"
      )}
      tabIndex={0}
      role="article"
      aria-label={title}
    >
      {/* Faint Oversized Step Watermark in Background */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none select-none absolute -top-3 font-black text-7xl sm:text-8xl text-[#1A3A6B]/[0.035] transition-transform duration-500 ease-out group-hover:scale-105 group-hover:text-[#1A3A6B]/[0.06]",
          isRtl ? "-left-2" : "-right-2"
        )}
      >
        {stepNumber}
      </span>

      <div className="relative z-10">
        {/* Top Header: Icon Badge */}
        <div className="mb-4 sm:mb-5 flex items-center">
          <div
            className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFFFFF] via-[#FAF8F0] to-[#E8F0FB] border border-[#D0E0F5] shadow-sm shadow-[#1A3A6B]/8 group-hover:border-[#1A3A6B]/40 group-hover:shadow-md group-hover:shadow-[#1A3A6B]/15 transition-all duration-300"
          >
            {icon}
          </div>
        </div>

        {/* Step Title & Description */}
        <h3 className="mb-2 text-lg sm:text-2xl font-black tracking-tight text-[#12294D] transition-colors duration-200 group-hover:text-[#1A3A6B] leading-tight">
          {title}
        </h3>
        <p className="text-xs sm:text-sm leading-relaxed text-[#4A5F7D]">
          {description}
        </p>
      </div>

      {/* Benefits List — desktop only; on phones the card is title + one line */}
      <div className="relative z-10 mt-5 hidden border-t border-[#EFEADB]/80 pt-4 md:block">
        <ul className="space-y-2.5">
          {benefits.map((benefit, index) => (
            <li key={index} className={cn("flex items-start gap-2.5", isRtl ? "text-right" : "text-left")}>
              <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-[#1A3A6B]/10 text-[#1A3A6B] transition-colors group-hover:bg-[#1A3A6B] group-hover:text-white">
                <Check className="h-2.5 w-2.5 stroke-[3]" aria-hidden="true" />
              </span>
              <span className="text-xs sm:text-sm font-semibold text-[#3A4F6D] leading-relaxed">
                {benefit}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export const HowItWorks: React.FC<HowItWorksProps> = ({
  className,
  ...props
}) => {
  const { language, dir, isRtl, t } = useLanguage();

  const stepIcons = [<Step1Icon key="1" />, <Step2Icon key="2" />, <Step3Icon key="3" />];

  return (
    <section
      id="how-it-works"
      dir={dir}
      lang={language}
      className={cn(
        "relative w-full overflow-hidden bg-[#FAF8F0] pt-8 sm:pt-16 lg:pt-20 pb-0 text-[#12294D] font-sans selection:bg-[#1A3A6B]/15",
        className
      )}
      {...props}
    >
      {/* Soft Ambient Radial Glow Layer */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 30%, #FFF991 0%, transparent 65%),
            radial-gradient(circle at 50% 85%, #EFEADB 0%, transparent 70%)
          `,
          opacity: 0.4,
          mixBlendMode: "multiply",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 container mx-auto max-w-6xl xl:max-w-7xl px-4 sm:px-6 lg:px-8 pb-6 sm:pb-16 lg:pb-20">
        {/* Section Header */}
        <div className="mx-auto mb-6 sm:mb-12 max-w-3xl text-center">
          <div className="mb-3 inline-flex items-center gap-2.5">
            <span className="h-px w-6 sm:w-10 bg-[#1A3A6B]/30" aria-hidden="true" />
            <span className="text-xs sm:text-sm font-black tracking-widest text-[#1A3A6B] uppercase">
              {t.howItWorks.eyebrow}
            </span>
            <span className="h-px w-6 sm:w-10 bg-[#1A3A6B]/30" aria-hidden="true" />
          </div>
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#12294D] leading-tight">
            {t.howItWorks.heading}
          </h2>
          <p className="mt-3.5 hidden text-base sm:block sm:text-lg leading-relaxed text-[#4A5F7D] max-w-2xl mx-auto">
            {t.howItWorks.description}
          </p>
        </div>

        {/* 3-Column Steps Grid on desktop. On phones the three cards stacked
            into a screen and a half of reading, so there they become one
            horizontal, swipeable row: each card is ~80% of the viewport wide
            with the next one peeking in, and the bullet list is dropped
            (StepCard hides it under md) so a card is a title and one line. */}
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-none md:mx-0 md:grid md:grid-cols-3 md:gap-7 md:overflow-visible md:px-0 md:pb-0 lg:gap-8">
          {t.howItWorks.steps.map((step, index) => (
            <StepCard
              key={index}
              stepNumber={step.stepNumber}
              icon={stepIcons[index] || stepIcons[0]}
              title={step.title}
              description={step.description}
              benefits={step.benefits}
              isRtl={isRtl}
            />
          ))}
        </div>
      </div>

      {/* Gentle Organic Wave Transition into Section 3 (Services Carousel) */}
      <div className="relative w-full overflow-hidden leading-none z-10 pointer-events-none -mb-1">
        <svg
          className="w-full h-10 sm:h-16 text-[#FAF5E8]"
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

export default HowItWorks;
