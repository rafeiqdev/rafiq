import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

/**
 * Shared card shape for EmergencyLegalFAB and WhatsAppButton's inline
 * variant — icon circle + title/subtitle + a white CTA pill. Kept as one
 * component (not two near-identical JSX blocks) so the two bars stay
 * visually identical by construction; only color and copy differ.
 */
export function ContactBanner({
  icon,
  title,
  subtitle,
  cta,
  href,
  ariaLabel,
  onClick,
  gradient,
  border,
  ctaTextColor,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  ariaLabel: string;
  onClick?: () => void;
  /** Tailwind gradient classes, e.g. "bg-gradient-to-r from-red-700 via-red-600 to-red-700" */
  gradient: string;
  /** Tailwind border color class, e.g. "border-red-500/40" */
  border: string;
  /** Tailwind text color class for the CTA pill's label, e.g. "text-red-700" */
  ctaTextColor: string;
}) {
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
      className={`w-full ${gradient} text-white px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl shadow-md border ${border} flex flex-row items-center justify-between gap-2.5`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-bold leading-tight truncate">{title}</p>
          <p className="text-[10px] sm:text-xs text-white/80 leading-tight truncate">{subtitle}</p>
        </div>
      </div>

      <motion.a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={ariaLabel}
        onClick={onClick}
        className={`shrink-0 bg-white ${ctaTextColor} hover:bg-cream font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1 transition-colors whitespace-nowrap`}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
      >
        <span>{cta}</span>
        {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
      </motion.a>
    </motion.div>
  );
}
