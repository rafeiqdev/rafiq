"use client";

import React from "react";
import { MarqueeAnimation } from "./marquee-effect";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

export interface RafiqMarqueeDividerProps extends React.HTMLAttributes<HTMLDivElement> {
  speed?: number;
}

export const RafiqMarqueeDivider: React.FC<RafiqMarqueeDividerProps> = ({
  className,
  speed = 0.55,
  ...props
}) => {
  const { isRtl, t } = useLanguage();

  const row1Items = t.marquee?.row1 || [
    "مساعدك الموثوق في تركيا",
    "مساعدك في إسطنبول",
    "كل ما تحتاجه في مكان واحد",
    "خدمات معتمدة واستشارات واضحة",
    "رفيق معك في كل خطوة",
  ];

  const row2Items = t.marquee?.row2 || [
    "هل بياناتك آمنة؟ بياناتك آمنة هنا",
    "رفيق يمكنه مساعدتك في كل شيء في إسطنبول",
    "رفيق يوصلك إلى الدليل أو الخدمة المناسبة",
    "نوصلك بشركاء مرخصين وموثوقين في تركيا",
  ];

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-[#FAF8F0] py-4 sm:py-6 select-none z-20",
        className
      )}
      {...props}
    >
      {/* Edge Gradients for Smooth Fade */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-32 bg-gradient-to-r from-[#FAF8F0] via-[#FAF8F0]/70 to-transparent z-30" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-32 bg-gradient-to-l from-[#FAF8F0] via-[#FAF8F0]/70 to-transparent z-30" />

      <div className="flex flex-col gap-3 sm:gap-3.5">
        {/* Ribbon 1: Minimal Cream & Rafiq Navy */}
        <div className="overflow-hidden border-y border-[#EFEADB] bg-white/70 backdrop-blur-sm py-3 sm:py-3.5 shadow-sm">
          <MarqueeAnimation
            direction="left"
            baseVelocity={speed}
            className="text-lg sm:text-xl md:text-2xl font-black text-[#12294D] tracking-tight"
          >
            <div
              dir={isRtl ? "rtl" : "ltr"}
              className="inline-flex items-center shrink-0"
            >
              {row1Items.map((text, idx) => (
                <span key={idx} className="inline-flex items-center shrink-0">
                  <span className="text-[#12294D] whitespace-nowrap">{text}</span>
                  <span className="mx-5 sm:mx-8 text-[#1A3A6B]/35 font-normal select-none">•</span>
                </span>
              ))}
            </div>
          </MarqueeAnimation>
        </div>

        {/* Ribbon 2: Minimal Deep Rafiq Navy & Warm White */}
        <div className="overflow-hidden border-y border-[#1A3A6B]/50 bg-[#12294D] text-[#FAF8F0] py-3 sm:py-3.5 shadow-sm">
          <MarqueeAnimation
            direction="right"
            baseVelocity={speed}
            className="text-lg sm:text-xl md:text-2xl font-black text-[#FAF8F0] tracking-tight"
          >
            <div
              dir={isRtl ? "rtl" : "ltr"}
              className="inline-flex items-center shrink-0"
            >
              {row2Items.map((text, idx) => (
                <span key={idx} className="inline-flex items-center shrink-0">
                  <span className="text-[#FAF8F0] whitespace-nowrap">{text}</span>
                  <span className="mx-5 sm:mx-8 text-[#60A5FA]/50 font-normal select-none">•</span>
                </span>
              ))}
            </div>
          </MarqueeAnimation>
        </div>
      </div>
    </div>
  );
};

export default RafiqMarqueeDivider;
