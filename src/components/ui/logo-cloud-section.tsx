"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { VerifiedBadge } from "@/components/ui/verified-badge";

export interface PartnerItem {
  id: string;
  name: string;
  src: string;
  alt: string;
}

export const ALL_OFFICIAL_PARTNERS: PartnerItem[] = [
  {
    id: "turkiye-gov",
    name: "türkiye.gov.tr",
    src: "/images/partners/turkiye-gov-tr.png",
    alt: "e-Devlet Kapısı — Türkiye Cumhuriyeti Cumhurbaşkanlığı",
  },
  {
    id: "turkish-airlines",
    name: "Turkish Airlines",
    src: "/images/partners/turkish-airlines.png",
    alt: "Türk Hava Yolları Turkish Airlines",
  },
  {
    id: "goc-idaresi",
    name: "Presidency of Migration Management",
    src: "/images/partners/goc-idaresi.png",
    alt: "T.C. İçişleri Bakanlığı Göç İdaresi Başkanlığı",
  },
  {
    id: "istanbul-airport",
    name: "Istanbul Airport iGA",
    src: "/images/partners/istanbul-airport.svg",
    alt: "İstanbul Havalimanı iGA Istanbul Airport",
  },
  {
    id: "web-tapu",
    name: "Web Tapu",
    src: "/images/partners/web-tapu.png",
    alt: "Tapu ve Kadastro Genel Müdürlüğü Web Tapu Sistemi",
  },
  {
    id: "ziraat-bankasi",
    name: "Ziraat Bankası",
    src: "/images/partners/ziraat-bankasi.svg",
    alt: "Ziraat Bankası Türkiye",
  },
  {
    id: "otelz",
    name: "otelz.com",
    src: "/images/partners/otelz.svg",
    alt: "Otelz Otel Rezervasyon Platformu",
  },
  {
    id: "gelir-idaresi",
    name: "Gelir İdaresi Başkanlığı",
    src: "/images/partners/gelir-idaresi.png",
    alt: "T.C. Hazine ve Maliye Bakanlığı Gelir İdaresi Başkanlığı GİB",
  },
  {
    id: "garanti-bbva",
    name: "Garanti BBVA",
    src: "/images/partners/garanti-bbva.svg",
    alt: "Garanti BBVA Bankası",
  },
  {
    id: "calisma-bakanligi",
    name: "Ministry of Labour and Social Security",
    src: "/images/partners/calisma-bakanligi.png",
    alt: "T.C. Çalışma ve Sosyal Güvenlik Bakanlığı",
  },
  {
    id: "acibadem",
    name: "Acıbadem Sağlık Grubu",
    src: "/images/partners/acibadem.svg",
    alt: "Acıbadem Sağlık Grubu",
  },
  {
    id: "nufus-vatandaslik",
    name: "Nüfus ve Vatandaşlık İşleri",
    src: "/images/partners/nufus-vatandaslik.png",
    alt: "T.C. İçişleri Bakanlığı Nüfus ve Vatandaşlık İşleri Genel Müdürlüğü NVİ",
  },
  {
    id: "medical-park",
    name: "Medical Park Hastaneler Grubu",
    src: "/images/partners/medical-park.svg",
    alt: "Medical Park Hastaneler Grubu",
  },
  {
    id: "health-turkiye",
    name: "HealthTürkiye",
    src: "/images/partners/health-turkiye.png",
    alt: "HealthTürkiye — Uluslararası Sağlık Hizmetleri USHAŞ",
  },
  {
    id: "noterler-birligi",
    name: "Türkiye Noterler Birliği",
    src: "/images/partners/noterler-birligi.png",
    alt: "Türkiye Noterler Birliği TNB",
  },
  {
    id: "tursab",
    name: "TÜRSAB",
    src: "/images/partners/tursab.png",
    alt: "Türkiye Seyahat Acentaları Birliği TÜRSAB",
  },
  {
    id: "sustainable-tourism",
    name: "Sustainable Tourism Türkiye",
    src: "/images/partners/sustainable-tourism.png",
    alt: "Türkiye Turizm Tanıtım ve Geliştirme Ajansı TGA Sustainable Tourism",
  },
];

interface LogoCloudSectionProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  badge?: string;
  partners?: PartnerItem[];
}

export const LogoCloudSection: React.FC<LogoCloudSectionProps> = ({
  className,
  title,
  badge,
  partners = ALL_OFFICIAL_PARTNERS,
  ...props
}) => {
  const { language, dir, t } = useLanguage();

  const effectiveBadge = badge || t.logoCloud.badge;
  const effectiveTitle = title || t.logoCloud.heading;

  return (
    <section
      id="partners-cloud"
      dir={dir}
      lang={language}
      aria-label={effectiveBadge}
      className={cn(
        "relative w-full overflow-hidden bg-[#FAF8F0] py-7 sm:py-9 text-[#12294D] font-sans selection:bg-[#1A3A6B]/15",
        className
      )}
      {...props}
    >
      {/* Clean Minimal Text Header */}
      <div className="relative z-10 container mx-auto max-w-5xl px-4 sm:px-6 text-center mb-6 sm:mb-8">
        <div className="inline-flex items-center justify-center gap-1.5 mb-2 px-3 py-1 rounded-full bg-white/80 border border-[#EFEADB] shadow-xs">
          <VerifiedBadge variant="shimmer" size={15} />
          <span className="text-xs sm:text-sm font-semibold text-[#4A5F7D] tracking-wide">
            {effectiveBadge}
          </span>
        </div>
        <h2 className="text-base sm:text-lg md:text-xl font-bold text-[#1A3A6B] tracking-tight">
          {effectiveTitle}
        </h2>
      </div>

      {/* 100% True Continuous Gapless Marquee Track */}
      <div
        className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]"
        dir="ltr"
      >
        <div className="flex w-max items-center animate-marquee-continuous will-change-transform py-2 select-none">
          {/* Track 1: All 17 Partner Logos */}
          <div className="flex items-center gap-10 sm:gap-14 md:gap-16 pr-10 sm:pr-14 md:pr-16 shrink-0">
            {partners.map((partner) => (
              <div
                key={`t1-${partner.id}`}
                className="flex items-center justify-center shrink-0 group"
                title={partner.name}
              >
                <img
                  src={partner.src}
                  alt={partner.alt}
                  loading="lazy"
                  className="h-8 sm:h-10 md:h-11 w-auto max-w-[170px] sm:max-w-[220px] object-contain opacity-85 transition-all duration-300 group-hover:opacity-100 group-hover:scale-105"
                />
              </div>
            ))}
          </div>

          {/* Track 2: Exact Clone for 100% Seamless Infinite Looping */}
          <div className="flex items-center gap-10 sm:gap-14 md:gap-16 pr-10 sm:pr-14 md:pr-16 shrink-0" aria-hidden="true">
            {partners.map((partner) => (
              <div
                key={`t2-${partner.id}`}
                className="flex items-center justify-center shrink-0 group"
                title={partner.name}
              >
                <img
                  src={partner.src}
                  alt={partner.alt}
                  loading="lazy"
                  className="h-8 sm:h-10 md:h-11 w-auto max-w-[170px] sm:max-w-[220px] object-contain opacity-85 transition-all duration-300 group-hover:opacity-100 group-hover:scale-105"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default LogoCloudSection;
