"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { motion, MotionValue, Transition } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import { RafiqBrandLogo } from "./rafiq-brand-logo";

const pathTransition: Transition = {
  duration: 0,
  ease: "linear",
};

export interface GoogleGeminiEffectProps {
  pathLengths: MotionValue<number>[];
  title?: string;
  description?: string;
  pillLabel?: string;
  className?: string;
}

// 5 Desktop Aceternity Path Geometries
const DESKTOP_PATHS = [
  "M0 663C145.5 663 191 666.265 269 647C326.5 630 339.5 621 397.5 566C439 531.5 455 529.5 490 523C509.664 519.348 521 503.736 538 504.236C553.591 504.236 562.429 514.739 584.66 522.749C592.042 525.408 600.2 526.237 607.356 523.019C624.755 515.195 641.446 496.324 657 496.735C673.408 496.735 693.545 519.572 712.903 526.769C718.727 528.934 725.184 528.395 730.902 525.965C751.726 517.115 764.085 497.106 782 496.735C794.831 496.47 804.103 508.859 822.469 518.515C835.13 525.171 850.214 526.815 862.827 520.069C875.952 513.049 889.748 502.706 903.5 503.736C922.677 505.171 935.293 510.562 945.817 515.673C954.234 519.76 963.095 522.792 972.199 524.954C996.012 530.611 1007.42 534.118 1034 549C1077.5 573.359 1082.5 594.5 1140 629C1206 670 1328.5 662.5 1440 662.5",
  "M0 587.5C147 587.5 277 587.5 310 573.5C348 563 392.5 543.5 408 535C434 523.5 426 526.235 479 515.235C494 512.729 523 510.435 534.5 512.735C554.5 516.735 555.5 523.235 576 523.735C592 523.735 616 496.735 633 497.235C648.671 497.235 661.31 515.052 684.774 524.942C692.004 527.989 700.2 528.738 707.349 525.505C724.886 517.575 741.932 498.33 757.5 498.742C773.864 498.742 791.711 520.623 810.403 527.654C816.218 529.841 822.661 529.246 828.451 526.991C849.246 518.893 861.599 502.112 879.5 501.742C886.47 501.597 896.865 506.047 907.429 510.911C930.879 521.707 957.139 519.639 982.951 520.063C1020.91 520.686 1037.5 530.797 1056.5 537C1102.24 556.627 1116.5 570.704 1180.5 579.235C1257.5 589.5 1279 587 1440 588",
  "M0 514C147.5 514.333 294.5 513.735 380.5 513.735C405.976 514.94 422.849 515.228 436.37 515.123C477.503 514.803 518.631 506.605 559.508 511.197C564.04 511.706 569.162 512.524 575 513.735C588 516.433 616 521.702 627.5 519.402C647.5 515.402 659 499.235 680.5 499.235C700.5 499.235 725 529.235 742 528.735C757.654 528.735 768.77 510.583 791.793 500.59C798.991 497.465 807.16 496.777 814.423 499.745C832.335 507.064 850.418 524.648 866 524.235C882.791 524.235 902.316 509.786 921.814 505.392C926.856 504.255 932.097 504.674 937.176 505.631C966.993 511.248 970.679 514.346 989.5 514.735C1006.3 515.083 1036.5 513.235 1055.5 513.235C1114.5 513.235 1090.5 513.235 1124 513.235C1177.5 513.235 1178.99 514.402 1241 514.402C1317.5 514.402 1274.5 512.568 1440 513.235",
  "M0 438.5C150.5 438.5 261 438.318 323.5 456.5C351 464.5 387.517 484.001 423.5 494.5C447.371 501.465 472 503.735 487 507.735C503.786 512.212 504.5 516.808 523 518.735C547 521.235 564.814 501.235 584.5 501.235C604.5 501.235 626 529.069 643 528.569C658.676 528.569 672.076 511.63 695.751 501.972C703.017 499.008 711.231 498.208 718.298 501.617C735.448 509.889 751.454 529.98 767 529.569C783.364 529.569 801.211 507.687 819.903 500.657C825.718 498.469 832.141 499.104 837.992 501.194C859.178 508.764 873.089 523.365 891 523.735C907.8 524.083 923 504.235 963 506.735C1034.5 506.735 1047.5 492.68 1071 481.5C1122.5 457 1142.23 452.871 1185 446.5C1255.5 436 1294 439 1439.5 439",
  "M0.5 364C145.288 362.349 195 361.5 265.5 378C322 391.223 399.182 457.5 411 467.5C424.176 478.649 456.916 491.677 496.259 502.699C498.746 503.396 501.16 504.304 503.511 505.374C517.104 511.558 541.149 520.911 551.5 521.236C571.5 521.236 590 498.736 611.5 498.736C631.5 498.736 652.5 529.236 669.5 528.736C685.171 528.736 697.81 510.924 721.274 501.036C728.505 497.988 736.716 497.231 743.812 500.579C761.362 508.857 778.421 529.148 794 528.736C810.375 528.736 829.35 508.68 848.364 502.179C854.243 500.169 860.624 500.802 866.535 502.718C886.961 509.338 898.141 519.866 916 520.236C932.8 520.583 934.5 510.236 967.5 501.736C1011.5 491 1007.5 493.5 1029.5 480C1069.5 453.5 1072 440.442 1128.5 403.5C1180.5 369.5 1275 360.374 1439 364",
];

// 5 Dedicated Mobile Flow Paths
const MOBILE_PATHS = [
  "M30 0 C30 65, 180 65, 180 130 C180 195, 30 195, 30 260",
  "M105 0 C105 70, 180 70, 180 130 C180 190, 105 190, 105 260",
  "M180 0 C180 60, 180 70, 180 130 C180 190, 180 200, 180 260",
  "M255 0 C255 70, 180 70, 180 130 C180 190, 255 190, 255 260",
  "M330 0 C330 65, 180 65, 180 130 C180 195, 330 195, 330 260",
];

// Rafiq Royal Palette for the 5 lines
const LINE_COLORS = [
  "#1A3A6B",
  "#284B82",
  "#3B629B",
  "#5678A8",
  "#7B95B8",
];

const ITEM_TOP_PCTS = ["11.6%", "31.2%", "51.0%", "70.4%", "90.3%"];

export const GoogleGeminiEffect: React.FC<GoogleGeminiEffectProps> = ({
  pathLengths,
  title,
  description,
  pillLabel,
  className,
}) => {
  const { language, dir, isRtl, t } = useLanguage();

  const effectiveTitle = title || t.connection.title;
  const effectiveDescription = description || t.connection.description;
  const effectivePillLabel = pillLabel || t.connection.pillLabel;

  const needsList = t.connection.needs.map((label, idx) => ({
    label,
    topPct: ITEM_TOP_PCTS[idx] || `${12 + idx * 20}%`,
  }));

  const outcomesList = t.connection.outcomes.map((label, idx) => ({
    label,
    topPct: ITEM_TOP_PCTS[idx] || `${12 + idx * 20}%`,
  }));

  return (
    <div
      dir={dir}
      lang={language}
      className={cn("relative w-full text-center flex flex-col items-center select-none", className)}
    >
      {/* Brand Eyebrow */}
      <div className="mb-2 inline-flex items-center gap-2.5">
        <span className="h-px w-6 bg-[#1A3A6B]/30" aria-hidden="true" />
        <span className="text-xs sm:text-sm font-black tracking-widest text-[#1A3A6B] uppercase">
          {t.connection.eyebrow}
        </span>
        <span className="h-px w-6 bg-[#1A3A6B]/30" aria-hidden="true" />
      </div>

      {/* Main Heading */}
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-[#12294D] max-w-3xl mx-auto px-4 leading-tight">
        {effectiveTitle}
      </h2>

      {/* Description */}
      <p className="text-xs sm:text-sm md:text-base font-normal text-[#4A5F7D] mt-2 max-w-xl mx-auto px-4 leading-relaxed">
        {effectiveDescription}
      </p>

      {/* ============================================================ */}
      {/* MOBILE-ONLY VERTICAL COMPOSITION (< 768px) */}
      {/* ============================================================ */}
      <div className="w-full flex flex-col items-center mt-6 md:hidden">
        {/* 1. Five Separate Need Pills (Top) */}
        <div className="w-full px-2 mb-2">
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-sm mx-auto">
            {needsList.map((item, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#E2D9C5] bg-[#FAF8F0] px-3.5 py-1.5 text-xs font-bold text-[#12294D] shadow-sm backdrop-blur-sm"
              >
                <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Central Rafiq Logo / Pill on Mobile */}
        <div className="relative w-full max-w-[360px] h-[250px] my-2 flex items-center justify-center">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-auto">
            <div
              className="inline-flex items-center justify-center bg-[#12294D] text-white border-2 border-white rounded-full px-6 py-2.5 min-w-[155px] min-h-[48px] shadow-[0_12px_30px_rgba(18,41,77,0.35)] ring-4 ring-[#FAF8F0]/90 transition-transform active:scale-95 overflow-visible"
              aria-label={effectivePillLabel}
            >
              <RafiqBrandLogo
                size="md"
                variant="light"
                className="h-7 sm:h-8 w-auto transform scale-115"
              />
            </div>
          </div>

          {/* Vertical Flow SVG */}
          <svg
            viewBox="0 0 360 260"
            className="w-full h-full block"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <filter id="mobileFlowGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
              </filter>
            </defs>

            {MOBILE_PATHS.map((d, idx) => (
              <path
                key={`mob-base-${idx}`}
                d={d}
                stroke="#D8CEB8"
                strokeWidth="2.5"
                strokeOpacity="0.45"
                fill="none"
              />
            ))}

            {MOBILE_PATHS.map((d, idx) => (
              <path
                key={`mob-glow-${idx}`}
                d={d}
                stroke={LINE_COLORS[idx]}
                strokeWidth="4.5"
                strokeOpacity="0.22"
                fill="none"
                filter="url(#mobileFlowGlow)"
              />
            ))}

            {MOBILE_PATHS.map((d, idx) => (
              <motion.path
                key={`mob-path-${idx}`}
                d={d}
                stroke={LINE_COLORS[idx]}
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
                initial={{ pathLength: 0 }}
                style={{ pathLength: pathLengths[idx] || pathLengths[0] }}
                transition={pathTransition}
              />
            ))}
          </svg>
        </div>

        {/* 3. Five Separate Outcome Pills (Bottom) */}
        <div className="w-full px-2 mt-2">
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-sm mx-auto">
            {outcomesList.map((item, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#E2D9C5] bg-[#FAF8F0] px-3.5 py-1.5 text-xs font-bold text-[#1A3A6B] shadow-sm backdrop-blur-sm"
              >
                <span>{item.label}</span>
                <span className="h-2 w-2 rounded-full bg-[#1A3A6B] shrink-0" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* DESKTOP / TABLET COMPOSITION (Direction-Adaptive Network) */}
      {/* ============================================================ */}
      <div className="relative w-full max-w-6xl mx-auto mt-4 sm:mt-6 aspect-[1440/380] min-h-[300px] md:min-h-[340px] items-center justify-center hidden md:flex">
        {/* User Needs Endpoints (Left side in LTR, Right side in RTL) */}
        <div
          className={cn(
            "absolute top-0 bottom-0 w-44 md:w-52 z-30 pointer-events-none",
            isRtl ? "right-0 sm:right-1 md:right-2" : "left-0 sm:left-1 md:left-2"
          )}
        >
          {needsList.map((item, idx) => (
            <div
              key={idx}
              style={{ top: item.topPct }}
              className={cn(
                "absolute -translate-y-1/2 flex items-center gap-2 pointer-events-auto",
                isRtl ? "right-0 text-right" : "left-0 text-left"
              )}
            >
              {isRtl && (
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-4 ring-[#FAF8F0] shadow-sm shrink-0" aria-hidden="true" />
              )}
              <div className="rounded-xl border border-[#E2D9C5] bg-[#FAF8F0] px-3.5 py-1.5 text-xs font-bold text-[#12294D] shadow-sm backdrop-blur-sm transition-all hover:scale-105 hover:border-[#1A3A6B]/40 hover:shadow-md">
                <span>{item.label}</span>
              </div>
              {!isRtl && (
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-4 ring-[#FAF8F0] shadow-sm shrink-0" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>

        {/* Rafiq Solutions Endpoints (Right side in LTR, Left side in RTL) */}
        <div
          className={cn(
            "absolute top-0 bottom-0 w-44 md:w-52 z-30 pointer-events-none",
            isRtl ? "left-0 sm:left-1 md:left-2" : "right-0 sm:right-1 md:right-2"
          )}
        >
          {outcomesList.map((item, idx) => (
            <div
              key={idx}
              style={{ top: item.topPct }}
              className={cn(
                "absolute -translate-y-1/2 flex items-center gap-2 pointer-events-auto",
                isRtl ? "left-0 text-left" : "right-0 text-right"
              )}
            >
              {!isRtl && (
                <span className="h-2.5 w-2.5 rounded-full bg-[#1A3A6B] ring-4 ring-[#FAF8F0] shadow-sm shrink-0" aria-hidden="true" />
              )}
              <div className="rounded-xl border border-[#E2D9C5] bg-[#FAF8F0] px-3.5 py-1.5 text-xs font-bold text-[#1A3A6B] shadow-sm backdrop-blur-sm transition-all hover:scale-105 hover:border-[#1A3A6B]/40 hover:shadow-md">
                <span>{item.label}</span>
              </div>
              {isRtl && (
                <span className="h-2.5 w-2.5 rounded-full bg-[#1A3A6B] ring-4 ring-[#FAF8F0] shadow-sm shrink-0" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>

        {/* CENTER CONVERGENCE ELEMENT (In the middle / في النص with transparent background) */}
        <div className="absolute top-[51%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-auto">
          <div
            className="inline-flex items-center justify-center bg-[#12294D] text-white border-[2.5px] border-white rounded-full px-9 py-3 sm:px-11 sm:py-3.5 shadow-[0_16px_40px_rgba(18,41,77,0.36)] ring-4 ring-[#FAF8F0]/90 transition-all duration-200 hover:scale-105 overflow-visible"
            aria-label={effectivePillLabel}
          >
            <RafiqBrandLogo
              size="lg"
              variant="light"
              className="h-10 sm:h-12 md:h-13 w-auto transform scale-120 sm:scale-125 transition-transform duration-200"
            />
          </div>
        </div>

        {/* Continuous Flowing SVG Network for Desktop */}
        <svg
          viewBox="0 320 1440 380"
          className="absolute inset-0 w-full h-full block"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <filter id="rafiqGlowDesktop" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
            </filter>
            {/* Clip path so lines terminate exactly at the indicator dots and never extend behind badges */}
            <clipPath id="connectionLinesClip">
              <rect x="145" y="320" width="1150" height="380" />
            </clipPath>
          </defs>

          <g clipPath="url(#connectionLinesClip)">
            {/* 1. Base Subtle Connected Network */}
            {DESKTOP_PATHS.map((d, idx) => (
              <path
                key={`base-desk-${idx}`}
                d={d}
                stroke="#D8CEB8"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
                strokeOpacity="0.5"
                fill="none"
              />
            ))}

            {/* 2. Soft Ambient Gaussian Blur Glow Layers */}
            {DESKTOP_PATHS.map((d, idx) => (
              <path
                key={`glow-desk-${idx}`}
                d={d}
                stroke={LINE_COLORS[idx]}
                strokeWidth="4"
                vectorEffect="non-scaling-stroke"
                strokeOpacity="0.18"
                fill="none"
                filter="url(#rafiqGlowDesktop)"
              />
            ))}

            {/* 3. Left-to-Center Animated Paths */}
            {DESKTOP_PATHS.map((d, idx) => (
              <motion.path
                key={`left-desk-${idx}`}
                d={d}
                stroke={LINE_COLORS[idx]}
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                fill="none"
                initial={{ pathLength: 0 }}
                style={{ pathLength: pathLengths[idx] || pathLengths[0] }}
                transition={pathTransition}
              />
            ))}

            {/* 4. Right-to-Center Mirrored Animated Paths */}
            <g transform="scale(-1, 1) translate(-1440, 0)">
              {DESKTOP_PATHS.map((d, idx) => (
                <motion.path
                  key={`right-desk-${idx}`}
                  d={d}
                  stroke={LINE_COLORS[idx]}
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  style={{ pathLength: pathLengths[idx] || pathLengths[0] }}
                  transition={pathTransition}
                />
              ))}
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
};

export default GoogleGeminiEffect;
