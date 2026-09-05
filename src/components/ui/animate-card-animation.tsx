import { useEffect, useRef, useState } from 'react';
import { motion, animate, useMotionValue, useReducedMotion } from 'framer-motion';

/**
 * Animated card stack (ported from the 21st.dev "animate-card-animation"
 * component). One card is on top, two peek behind it; the top card is thrown
 * away and the stack springs forward. The same gesture drives it everywhere —
 * swipe the card left or right with a finger, drag it with the mouse, or scroll
 * sideways on a trackpad; arrow keys do it for keyboard users. There is no
 * "next" button: it existed only on the source's demo page and would have been
 * a desktop-only second way to do what the card itself already does.
 *
 * Adapted from the source in four ways:
 *  - the cards are TALLER than the original (portrait), because the service
 *    photos are landscape and need text room underneath them;
 *  - the top card follows the finger, tilts as it goes, springs back when the
 *    swipe was too short, and flies off in the swiped direction when it wasn't;
 *    the source's button is replaced by position dots;
 *  - the content comes from the real service catalog instead of the demo data;
 *  - the shadcn color tokens the registry ships (bg-card / border-border /
 *    bg-secondary) don't exist in this project's Tailwind config, so they are
 *    mapped onto the site palette (white surface, gray border, navy text).
 *
 * The thrown card leaves the stack the instant it is thrown and finishes its
 * flight as a copy layered on top (see `flying` below). Advancing the stack
 * therefore never waits on an animation to report that it finished — in a
 * background tab, where animation frames stop firing, the stack would otherwise
 * be stuck on a card that has already been swiped away.
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

const enterAnimation = {
  y: -16,
  scale: 0.9,
};

/** How far (px) or how fast (px/s) a swipe has to be before the card leaves. */
const SWIPE_DISTANCE = 90;
const SWIPE_VELOCITY = 450;
/** how long the thrown copy stays mounted, animation finished or not */
const FLIGHT_MS = 900;
/** -1 = leaves to the left, 1 = leaves to the right */
type Dir = -1 | 1;

const SPRING = { type: 'spring' as const, stiffness: 400, damping: 34 };

/** shared by the cards in the stack and by the thrown copy */
const CARD_CLASS =
  'absolute flex h-[380px] w-full max-w-[324px] select-none items-center justify-center overflow-hidden rounded-t-xl border-x border-t border-gray-200 bg-white p-1 shadow-card will-change-transform sm:max-w-[420px]';

const tiltFor = (dx: number) => Math.max(-14, Math.min(14, dx / 16));

function CardFace({
  item,
  ctaLabel,
  onOpen,
  interactive = true,
}: {
  item: StackCardItem;
  ctaLabel: string;
  onOpen?: (id: string) => void;
  /** false for the covered cards and the flying copy: their buttons must not
   *  become tab stops for something the reader cannot see */
  interactive?: boolean;
}) {
  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="flex h-[250px] w-full items-center justify-center overflow-hidden rounded-xl bg-cream outline outline-1 -outline-offset-1 outline-black/10">
        {item.image ? (
          <img
            src={item.image}
            alt=""
            draggable={false}
            className="h-full w-full select-none object-cover"
          />
        ) : (
          item.fallback
        )}
      </div>
      <div className="flex w-full flex-1 items-end justify-between gap-2 px-3 pb-6">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="line-clamp-2 font-extrabold leading-snug text-foreground">{item.title}</span>
          <span className="line-clamp-1 text-sm text-muted-foreground">{item.subtitle}</span>
        </div>
        <button
          type="button"
          onClick={() => onOpen?.(item.id)}
          tabIndex={interactive ? undefined : -1}
          aria-label={`${ctaLabel}: ${item.title}`}
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

function StackCard({
  item,
  index,
  isEntering,
  reduceMotion,
  ctaLabel,
  onOpen,
  onThrow,
}: {
  item: StackCardItem;
  index: number;
  /** true for a card that mounted into the back slot, not one of the first three */
  isEntering: boolean;
  /** the reader asked the system for reduced motion — settle instantly */
  reduceMotion: boolean;
  ctaLabel: string;
  onOpen?: (id: string) => void;
  /** the card was thrown: which way, and from what horizontal offset */
  onThrow: (dir: Dir, fromX: number) => void;
}) {
  const { scale, y } = positionStyles[index] ?? positionStyles[2];
  const isTop = index === 0;

  const x = useMotionValue(0);
  const rotate = useMotionValue(0);
  const drag = useRef<{ id: number; startX: number; startT: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // a second finger landing mid-swipe must not hijack the gesture the first
    // one owns — otherwise the card snaps back and the swipe is lost
    if (drag.current) return;
    if (!isTop) return;
    // let the "learn more" button be pressed normally
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { id: e.pointerId, startX: e.clientX, startT: performance.now() };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer capture is a nicety, the events still arrive without it */
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const dx = e.clientX - drag.current.startX;
    x.set(dx);
    rotate.set(tiltFor(dx));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const dx = e.clientX - d.startX;
    const velocity = (dx / Math.max(performance.now() - d.startT, 1)) * 1000;
    if (Math.abs(dx) > SWIPE_DISTANCE || Math.abs(velocity) > SWIPE_VELOCITY) {
      onThrow(dx < 0 ? -1 : 1, dx);
    } else {
      // too short to count — snap back under the finger's momentum
      animate(x, 0, SPRING);
      animate(rotate, 0, SPRING);
    }
  };

  // A cancel is the browser taking the gesture away — `touch-pan-y` lets it
  // claim a vertical page scroll — not the reader finishing a swipe. Its
  // coordinates are not meaningful either, so nothing here may read dx: the
  // card must snap back, never fly away because the page was scrolled.
  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    drag.current = null;
    animate(x, 0, SPRING);
    animate(rotate, 0, SPRING);
  };

  return (
    <motion.div
      initial={isEntering && !reduceMotion ? enterAnimation : false}
      animate={{ y, scale }}
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', duration: 1, bounce: 0 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      aria-hidden={!isTop}
      style={{ x, rotate, zIndex: 3 - index, bottom: 0, left: 0, right: 0, marginInline: 'auto' }}
      className={`${CARD_CLASS} ${isTop ? 'cursor-grab touch-pan-y' : ''}`}
    >
      <CardFace item={item} ctaLabel={ctaLabel} onOpen={onOpen} interactive={isTop} />
    </motion.div>
  );
}

/** The card that was just thrown, finishing its flight above the stack. */
function FlyingCard({
  item,
  dir,
  fromX,
  ctaLabel,
}: {
  item: StackCardItem;
  dir: Dir;
  fromX: number;
  ctaLabel: string;
}) {
  return (
    <motion.div
      initial={{ x: fromX, rotate: tiltFor(fromX), y: 12, scale: 1, opacity: 1 }}
      animate={{ x: dir * 520, rotate: dir * 18, y: 40, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30, opacity: { duration: 0.45 } }}
      style={{ zIndex: 10, bottom: 0, left: 0, right: 0, marginInline: 'auto' }}
      className={`${CARD_CLASS} pointer-events-none`}
      aria-hidden="true"
    >
      <CardFace item={item} ctaLabel={ctaLabel} interactive={false} />
    </motion.div>
  );
}

export default function AnimatedCardStack({
  items,
  ctaLabel,
  deckLabel,
  onOpen,
}: {
  items: StackCardItem[];
  ctaLabel: string;
  /** describes the deck for screen readers and keyboard users */
  deckLabel: string;
  onOpen?: (id: string) => void;
}) {
  // The visible window into `items`: three entries, each with its own key so a
  // recycled card mounts fresh in the back slot instead of appearing to jump
  // there from the front.
  const [queue, setQueue] = useState(() =>
    [0, 1, 2].map((i) => ({ key: i, index: i % Math.max(items.length, 1) })),
  );
  const [nextKey, setNextKey] = useState(3);
  // A LIST, not a single slot: two quick flicks land inside the same flight
  // window, and a single slot would make the first thrown card blink out of
  // existence mid-air when the second one replaced it.
  const [flights, setFlights] = useState<
    { key: number; index: number; dir: Dir; fromX: number }[]
  >([]);
  const lastWheel = useRef(0);
  const timers = useRef<number[]>([]);
  const reduceMotion = useReducedMotion() ?? false;

  // The flight is decorative, so it is cleaned up on a timer rather than on the
  // animation's completion callback, which never arrives in a background tab.
  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  if (items.length === 0) return null;

  const current = queue[0].index % items.length;

  const throwTop = (dir: Dir, fromX: number) => {
    const [top, ...rest] = queue;
    const last = queue[queue.length - 1];
    if (!reduceMotion) {
      setFlights((prev) => [...prev, { key: top.key, index: top.index, dir, fromX }]);
      const id = window.setTimeout(() => {
        setFlights((prev) => prev.filter((f) => f.key !== top.key));
        timers.current = timers.current.filter((t) => t !== id);
      }, FLIGHT_MS);
      timers.current.push(id);
    }
    setQueue([...rest, { key: nextKey, index: (last.index + 1) % items.length }]);
    setNextKey((prev) => prev + 1);
  };

  // Trackpad / mouse-wheel sideways scrolling is the desktop equivalent of the
  // swipe, so the deck behaves the same on both — no desktop-only button. One
  // card per gesture: a trackpad emits a long burst of deltas, so anything
  // inside the flight window is ignored.
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaX) < 12 || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    const now = performance.now();
    if (now - lastWheel.current < FLIGHT_MS) return;
    lastWheel.current = now;
    throwTop(e.deltaX > 0 ? -1 : 1, 0);
  };

  // Keyboard: a card deck that can only be swiped is unusable without a
  // pointer, so the arrow keys throw the card the same way.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    // a held arrow key repeats ~30×/s; one press should mean one card
    if (e.repeat) return;
    // the card about to be dropped may hold the focused "learn more" button —
    // take focus back to the deck first, or focus falls to <body> and the
    // arrow keys stop working after the very first card
    e.currentTarget.focus();
    throwTop(e.key === 'ArrowLeft' ? -1 : 1, 0);
  };

  return (
    <div className="flex w-full flex-col items-center justify-center pt-2">
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label={deckLabel}
        tabIndex={0}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        className="relative h-[440px] w-full overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-navy/30"
      >
        {queue.slice(0, 3).map((entry, index) => (
          <StackCard
            key={entry.key}
            item={items[entry.index % items.length]}
            index={index}
            isEntering={entry.key > 2}
            reduceMotion={reduceMotion}
            ctaLabel={ctaLabel}
            onOpen={onOpen}
            onThrow={throwTop}
          />
        ))}
        {flights.map((f) => (
          <FlyingCard
            key={`flying-${f.key}`}
            item={items[f.index % items.length]}
            dir={f.dir}
            fromX={f.fromX}
            ctaLabel={ctaLabel}
          />
        ))}
      </div>

      {/* Position dots instead of a button: they say how many cards there are
          and which one is showing, without offering a second way to advance
          that only exists on desktop. */}
      <div className="relative z-10 -mt-px flex w-full items-center justify-center gap-1.5 border-t border-gray-200 py-4">
        {items.map((item, i) => (
          <span
            key={item.id}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === current ? 'w-5 bg-navy' : 'w-1.5 bg-gray-300'
            }`}
          />
        ))}
      </div>

      {/* The deck changes silently for a screen reader — this is the only
          non-visual signal of which service is showing and how many there are. */}
      <div className="sr-only" role="status" aria-live="polite">
        {`${items[current].title} — ${current + 1} / ${items.length}`}
      </div>
    </div>
  );
}
