import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface DynamicIslandProps {
  /** false = a small icon-only pill (compact); true = expanded with title/body. */
  expanded: boolean;
  icon: ReactNode;
  title?: string;
  body?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * Apple-style "Dynamic Island" pill — a rounded-full black capsule that
 * morphs its own width via a plain CSS transition (not framer-motion's
 * `layout` projection, which visibly mis-rendered here alongside the
 * page's own always-on marquee animation) while the title/body fade in
 * with framer-motion.
 *
 * Ported from https://21st.dev/@aghasisahakyan1/components/dynamic-island,
 * trimmed to the collapsed/expanded morph a notification popup needs — the
 * source demo's call/timer/music-player states don't apply here.
 */
export function DynamicIsland({
  expanded,
  icon,
  title,
  body,
  onClick,
  className = "",
}: DynamicIslandProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={expanded ? title : undefined}
      style={{ borderRadius: 999 }}
      className={`mx-auto flex items-center overflow-hidden bg-black text-start shadow-2xl transition-all duration-500 ease-out ${
        expanded ? "w-[min(92vw,360px)] gap-3 px-4 py-3" : "w-11 justify-center px-0 py-2.5"
      } ${className}`}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center text-white">{icon}</span>
      <AnimatePresence>
        {expanded && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.2, duration: 0.25 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="min-w-0 flex-1"
          >
            <span className="block truncate text-[13px] font-bold text-white">{title}</span>
            {body && <span className="block truncate text-[11.5px] text-white/60">{body}</span>}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

export default DynamicIsland;
