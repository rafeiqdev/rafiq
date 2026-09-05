import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Animated card stack (ported from the 21st.dev "animate-card-animation"
 * component). One card is on top, two peek behind it; pressing the button
 * throws the top card down and out while the stack springs forward and a new
 * card rises into the back slot.
 *
 * Adapted from the source in three ways only:
 *  - the cards are TALLER than the original (portrait), because the service
 *    photos are landscape and need text room underneath them;
 *  - the content comes from the real service catalog instead of the demo data;
 *  - the shadcn color tokens the registry ships (bg-card / border-border /
 *    bg-secondary) don't exist in this project's Tailwind config, so they are
 *    mapped onto the site palette (white surface, gray border, navy text).
 */

export interface StackCardItem {
  id: string;
  title: string;
  subtitle: string;
  /** real photo when the admin set one; otherwise the fallback node is shown */
  image?: string;
  /** rendered inside the image frame when `image` is missing */
  fallback?: React.ReactNode;
}

/** top → back: the resting scale/offset of the three visible cards */
const positionStyles = [
  { scale: 1, y: 12 },
  { scale: 0.95, y: -16 },
  { scale: 0.9, y: -44 },
];

const exitAnimation = {
  y: 460,
  scale: 1,
  zIndex: 10,
};

const enterAnimation = {
  y: -16,
  scale: 0.9,
};

function CardFace({
  item,
  ctaLabel,
  onOpen,
}: {
  item: StackCardItem;
  ctaLabel: string;
  onOpen?: (id: string) => void;
}) {
  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="flex h-[250px] w-full items-center justify-center overflow-hidden rounded-xl bg-cream outline outline-1 -outline-offset-1 outline-black/10">
        {item.image ? (
          <img src={item.image} alt="" className="h-full w-full select-none object-cover" />
        ) : (
          item.fallback
        )}
      </div>
      <div className="flex w-full flex-1 items-end justify-between gap-2 px-3 pb-6">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-extrabold text-foreground">{item.title}</span>
          <span className="line-clamp-2 text-sm text-muted-foreground">{item.subtitle}</span>
        </div>
        <button
          type="button"
          onClick={() => onOpen?.(item.id)}
          className="flex h-10 shrink-0 cursor-pointer select-none items-center gap-0.5 rounded-full bg-navy pe-3 ps-4 text-sm font-bold text-white"
        >
          {ctaLabel}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="square"
            aria-hidden="true"
            className="rtl:-scale-x-100"
          >
            <path d="M9.5 18L15.5 12L9.5 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function AnimatedCard({
  item,
  index,
  isAnimating,
  ctaLabel,
  onOpen,
}: {
  item: StackCardItem;
  index: number;
  isAnimating: boolean;
  ctaLabel: string;
  onOpen?: (id: string) => void;
}) {
  const { scale, y } = positionStyles[index] ?? positionStyles[2];
  const zIndex = index === 0 && isAnimating ? 10 : 3 - index;

  return (
    <motion.div
      initial={index === 2 ? enterAnimation : undefined}
      animate={{ y, scale }}
      exit={index === 0 ? exitAnimation : undefined}
      transition={{ type: 'spring', duration: 1, bounce: 0 }}
      style={{ zIndex, left: '50%', x: '-50%', bottom: 0 }}
      className="absolute flex h-[380px] w-[324px] items-center justify-center overflow-hidden rounded-t-xl border-x border-t border-gray-200 bg-white p-1 shadow-card will-change-transform sm:w-[420px]"
    >
      <CardFace item={item} ctaLabel={ctaLabel} onOpen={onOpen} />
    </motion.div>
  );
}

export default function AnimatedCardStack({
  items,
  ctaLabel,
  nextLabel,
  onOpen,
}: {
  items: StackCardItem[];
  ctaLabel: string;
  nextLabel: string;
  onOpen?: (id: string) => void;
}) {
  // The visible window into `items`: three entries, each with its own key so
  // AnimatePresence treats the recycled card as a brand-new one entering at the
  // back rather than the same card moving.
  const [queue, setQueue] = useState(() =>
    [0, 1, 2].map((i) => ({ key: i, index: i % Math.max(items.length, 1) })),
  );
  const [isAnimating, setIsAnimating] = useState(false);
  const [nextKey, setNextKey] = useState(3);

  if (items.length === 0) return null;

  const handleNext = () => {
    setIsAnimating(true);
    const last = queue[queue.length - 1];
    setQueue([...queue.slice(1), { key: nextKey, index: (last.index + 1) % items.length }]);
    setNextKey((prev) => prev + 1);
    setIsAnimating(false);
  };

  return (
    <div className="flex w-full flex-col items-center justify-center pt-2">
      <div className="relative h-[440px] w-full overflow-hidden">
        <AnimatePresence initial={false}>
          {queue.slice(0, 3).map((entry, index) => (
            <AnimatedCard
              key={entry.key}
              item={items[entry.index % items.length]}
              index={index}
              isAnimating={isAnimating}
              ctaLabel={ctaLabel}
              onOpen={onOpen}
            />
          ))}
        </AnimatePresence>
      </div>

      <div className="relative z-10 -mt-px flex w-full items-center justify-center border-t border-gray-200 py-4">
        <button
          type="button"
          onClick={handleNext}
          className="flex h-9 cursor-pointer select-none items-center justify-center gap-1 overflow-hidden rounded-lg border border-gray-200 bg-white px-4 font-bold text-foreground transition-all hover:bg-gray-50 active:scale-[0.98]"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
