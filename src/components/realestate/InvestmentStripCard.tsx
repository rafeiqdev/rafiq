import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppIcon } from '../AppIcon';
import type { IconName } from '../AppIcon';

interface InvestmentStripCardProps {
  title: string;
  body: string;
  cta: string;
  to?: string;
  icon?: IconName;
  className?: string;
}

/**
 * نفس قالب البطاقة الكحلية من لقطة الشاشة — بنفس الألوان والترتيب
 * (أيقونة ذهبية + عنوان أبيض + سطر رمادي + زر ذهبي)،
 * محسّن بفكرة قوالب 21st.dev (Yield Card + Gradient Card + Shine Border):
 * إطار ذهبي متدرج، حركة دخول ناعمة، لمعة تنزلق عند التحويم،
 * وزر بسهم يتحرك — دون أي مكتبة جديدة (framer-motion موجود أصلًا).
 */
export function InvestmentStripCard({
  title,
  body,
  cta,
  to = '/real-estate/investments',
  icon = 'trending-up',
  className = '',
}: InvestmentStripCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={className}
    >
      <Link
        to={to}
        aria-label={`${title} — ${cta}`}
        className="group block rounded-2xl p-px no-underline shadow-[0_6px_18px_rgba(15,36,64,0.18)] transition-transform duration-300 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e7c877] focus-visible:ring-offset-2 focus-visible:ring-offset-[#12305c]"
        style={{
          background:
            'linear-gradient(135deg, rgba(231,200,119,.75), rgba(231,200,119,.15) 40%, rgba(255,255,255,.14) 60%, rgba(231,200,119,.6))',
        }}
      >
        <span
          className="relative flex items-center gap-3 overflow-hidden rounded-[15px] p-3.5 text-white"
          style={{ background: 'linear-gradient(135deg,#12305c,#1a3a6b)' }}
        >
          {/* لمعة 21st تنزلق عند التحويم */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full rtl:translate-x-full rtl:group-hover:-translate-x-full"
          />
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105"
            style={{ background: 'rgba(201,162,75,.2)', color: '#e7c877' }}
            aria-hidden
          >
            <AppIcon name={icon} className="h-[22px] w-[22px]" />
          </span>
          <span className="relative min-w-0 flex-1">
            <b className="mb-0.5 block text-[14.5px] font-bold leading-snug">{title}</b>
            <span className="block text-xs leading-relaxed" style={{ color: '#cdd6ea' }}>
              {body}
            </span>
          </span>
          <span
            className="relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-bold transition-shadow duration-300 group-hover:shadow-[0_0_16px_rgba(231,200,119,.45)]"
            style={{ background: '#e7c877', color: '#1a2340' }}
          >
            {cta}
            <span className="inline-flex transition-transform duration-300 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">
              <AppIcon name="arrow-right" className="dir-arrow h-3.5 w-3.5" />
            </span>
          </span>
        </span>
      </Link>
    </motion.div>
  );
}
