import * as React from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { createPortal } from 'react-dom';

/**
 * Spotlight product tour — ported from 21st.dev (laziekiki/product-tour).
 *
 * Blurs and dims the page, glides a rounded spotlight across real elements and
 * floats an auto-positioned card beside each. Changes from the source:
 *   - button labels come in through `labels` (the site ships four languages),
 *   - `rtl` flips the forward arrow and the arrow keys,
 *   - colours use the site's navy instead of zinc,
 *   - the root carries `data-tour-layer` so the host can tell this dialog apart
 *     from any other `aria-modal` on the page,
 *   - THE VEIL. The source drew the dim with two different elements — a full
 *     dim when there was no target and a huge box-shadow around the spotlight
 *     when there was — swapped in the same slot. React reused the first for
 *     the second mid fade-in, so on any tour whose first step points at an
 *     element the dim froze at ~4% opacity: no dim at all. It is now ONE
 *     element that is always mounted: a blurred, dimmed full-screen layer with
 *     a rounded hole cut out by an even-odd clip-path, the hole's position and
 *     size driven by springs. No target = the hole shrinks to nothing.
 *   - the hole is clamped to the viewport and to at most 45% of its height, so
 *     a tall target (a whole list) no longer swallows the screen and leaves
 *     nothing blurred,
 *   - each step's text animates in (fade + rise + un-blur) and the spotlight
 *     carries a soft pulse, so moving between steps reads as motion.
 * No dark-mode branch: the site has no dark theme.
 */

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto' | 'center';

export type TourStep = {
  target?: string;
  title: string;
  content: React.ReactNode;
  placement?: TourPlacement;
  padding?: number;
};

export type TourLabels = {
  next: string;
  back: string;
  done: string;
  close: string;
};

export type TourProps = {
  steps: TourStep[];
  open: boolean;
  labels: TourLabels;
  rtl?: boolean;
  onOpenChange?: (open: boolean) => void;
  index?: number;
  onIndexChange?: (index: number) => void;
  onFinish?: () => void;
  onSkip?: () => void;
  showProgress?: boolean;
  clickToNext?: boolean;
  className?: string;
};

export type Rect = { top: number; left: number; width: number; height: number };

const SPRING = { type: 'spring' as const, stiffness: 320, damping: 32, mass: 0.7 };
const HOLE_SPRING = { stiffness: 230, damping: 28, mass: 0.8 };
const VEIL_INK = 'rgba(18,41,77,0.45)';
const VEIL_BLUR = 'blur(6px) saturate(0.85)';
const EDGE = 8;
const MAX_HOLE_SHARE = 0.45;
const HOLE_RADIUS = 14;

/**
 * The visible hole for a target: padded, kept inside the viewport, and never
 * taller than MAX_HOLE_SHARE of it (a list's top part is spotlighted rather
 * than the whole list). Exported for tests.
 */
export function clampSpot(rect: Rect, pad: number, vp: { w: number; h: number }): Rect {
  const top = Math.max(EDGE, rect.top - pad);
  const bottom = Math.min(vp.h - EDGE, rect.top + rect.height + pad);
  const left = Math.max(EDGE / 2, rect.left - pad);
  const right = Math.min(vp.w - EDGE / 2, rect.left + rect.width + pad);
  const height = Math.min(Math.max(0, bottom - top), Math.round(vp.h * MAX_HOLE_SHARE));
  return { top, left, width: Math.max(0, right - left), height };
}

/** Even-odd path: the whole screen minus a rounded rectangle. Exported for tests. */
export function veilPath(x: number, y: number, w: number, h: number, W: number, H: number): string {
  const outer = `M0,0 H${W} V${H} H0 Z`;
  if (w < 1 || h < 1) return `path(evenodd, "${outer}")`;
  const r = Math.max(0, Math.min(HOLE_RADIUS, w / 2, h / 2));
  const hole =
    `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} ` +
    `V${y + h - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} ` +
    `A${r},${r} 0 0 1 ${x},${y + h - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
  return `path(evenodd, "${outer} ${hole}")`;
}

export function Tour({
  steps,
  open,
  labels,
  rtl = false,
  onOpenChange,
  index: controlledIndex,
  onIndexChange,
  onFinish,
  onSkip,
  showProgress = true,
  clickToNext = false,
  className,
}: TourProps) {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = React.useState(false);
  const [indexState, setIndexState] = React.useState(0);
  const index = controlledIndex ?? indexState;
  const setIndex = React.useCallback(
    (i: number) => {
      onIndexChange?.(i);
      setIndexState(i);
    },
    [onIndexChange],
  );

  const cardRef = React.useRef<HTMLDivElement>(null);
  const [rect, setRect] = React.useState<Rect | null>(null);
  const [cardSize, setCardSize] = React.useState({ w: 320, h: 168 });
  const [vp, setVp] = React.useState({ w: 1024, h: 768 });

  React.useEffect(() => setMounted(true), []);

  const step = steps[index];
  const count = steps.length;
  const isFirst = index === 0;
  const isLast = index === count - 1;
  const pad = step?.padding ?? 8;

  const finish = React.useCallback(() => {
    onFinish?.();
    onOpenChange?.(false);
    setIndexState(0);
  }, [onFinish, onOpenChange]);

  const skip = React.useCallback(() => {
    onSkip?.();
    onOpenChange?.(false);
    setIndexState(0);
  }, [onSkip, onOpenChange]);

  const next = React.useCallback(() => {
    if (isLast) finish();
    else setIndex(index + 1);
  }, [isLast, finish, index, setIndex]);

  const back = React.useCallback(() => {
    if (!isFirst) setIndex(index - 1);
  }, [isFirst, index, setIndex]);

  React.useEffect(() => {
    if (!open) return;
    const measure = () => {
      setVp({ w: window.innerWidth, h: window.innerHeight });
      if (!step?.target) {
        setRect(null);
        return;
      }
      const el = document.querySelector(step.target) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    // A target taller than the hole can show (a category, a list) is scrolled
    // to its TOP, not its middle — the spotlight then frames its heading. The
    // temporary scroll-margin keeps it clear of sticky page headers.
    const el = step?.target ? (document.querySelector(step.target) as HTMLElement | null) : null;
    if (el) {
      const tall = el.getBoundingClientRect().height > window.innerHeight * MAX_HOLE_SHARE;
      const prevMargin = el.style.scrollMarginTop;
      if (tall) el.style.scrollMarginTop = '96px';
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: tall ? 'start' : 'center', inline: 'center' });
      if (tall) el.style.scrollMarginTop = prevMargin;
    }

    measure();
    const settle = window.setTimeout(measure, reduce ? 0 : 320);
    const late = window.setTimeout(measure, reduce ? 0 : 700);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(settle);
      window.clearTimeout(late);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open, index, step, reduce]);

  // offsetWidth/Height, not getBoundingClientRect: the card scales in, and a
  // measurement taken mid-scale would place it a few pixels off. The observer
  // catches the height change when a step's text swaps in.
  React.useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const update = () =>
      setCardSize((s) => (s.w === el.offsetWidth && s.h === el.offsetHeight ? s : { w: el.offsetWidth, h: el.offsetHeight }));
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [open, mounted]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        skip();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        if (rtl && e.key === 'ArrowRight') back();
        else next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (rtl) next();
        else back();
      } else if (e.key === 'Tab') {
        const focusables = cardRef.current?.querySelectorAll<HTMLElement>(
          "button, [href], input, [tabindex]:not([tabindex='-1'])",
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, next, back, skip, rtl]);

  React.useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      cardRef.current?.querySelector<HTMLElement>('[data-tour-primary]')?.focus();
    }, 40);
    return () => window.clearTimeout(t);
  }, [open, index]);

  // ── the hole ────────────────────────────────────────────────────────────
  const spot = React.useMemo(() => (rect ? clampSpot(rect, pad, vp) : null), [rect, pad, vp]);

  const hx = useSpring(0, HOLE_SPRING);
  const hy = useSpring(0, HOLE_SPRING);
  const hw = useSpring(0, HOLE_SPRING);
  const hh = useSpring(0, HOLE_SPRING);
  const vw = useMotionValue(1024);
  const vh = useMotionValue(768);
  const fresh = React.useRef(true);

  React.useEffect(() => {
    if (!open) {
      fresh.current = true;
      return;
    }
    vw.jump(vp.w);
    vh.jump(vp.h);
    // No target: the hole closes to a point in the middle (full veil). Opening
    // the tour starts from that closed state, so the first spotlight irises
    // open onto its target instead of flying in from the corner.
    const target = spot ?? { left: vp.w / 2, top: vp.h / 2, width: 0, height: 0 };
    const pairs: [MotionValue<number>, number][] = [
      [hx, target.left],
      [hy, target.top],
      [hw, target.width],
      [hh, target.height],
    ];
    for (const [mv, v] of pairs) {
      if (reduce || fresh.current) mv.jump(v);
      else mv.set(v);
    }
    fresh.current = false;
  }, [open, spot, vp, reduce, hx, hy, hw, hh, vw, vh]);

  const clip = useTransform([hx, hy, hw, hh, vw, vh] as MotionValue<number>[], (v: number[]) =>
    veilPath(v[0], v[1], v[2], v[3], v[4], v[5]),
  );

  if (!mounted || !open || !step) return null;

  // ── card placement (around the visible hole, not the raw target) ────────
  const gap = 14;
  let place: TourPlacement = step.placement ?? 'auto';
  if (!spot) place = 'center';
  if (spot) {
    const roomBelow = vp.h - (spot.top + spot.height) - gap - cardSize.h;
    const roomAbove = spot.top - gap - cardSize.h;
    if (place === 'auto') {
      if (roomBelow > EDGE) place = 'bottom';
      else if (roomAbove > EDGE) place = 'top';
      else if (spot.left + spot.width + gap + cardSize.w < vp.w) place = 'right';
      else place = 'left';
    } else if (place === 'top' && roomAbove < EDGE && roomBelow > EDGE) place = 'bottom';
    else if (place === 'bottom' && roomBelow < EDGE && roomAbove > EDGE) place = 'top';
  }

  let left = vp.w / 2 - cardSize.w / 2;
  let top = vp.h / 2 - cardSize.h / 2;
  if (spot) {
    const cx = spot.left + spot.width / 2;
    const cy = spot.top + spot.height / 2;
    if (place === 'bottom') {
      left = cx - cardSize.w / 2;
      top = spot.top + spot.height + gap;
    } else if (place === 'top') {
      left = cx - cardSize.w / 2;
      top = spot.top - gap - cardSize.h;
    } else if (place === 'right') {
      left = spot.left + spot.width + gap;
      top = cy - cardSize.h / 2;
    } else if (place === 'left') {
      left = spot.left - gap - cardSize.w;
      top = cy - cardSize.h / 2;
    }
  }
  left = Math.min(Math.max(12, left), vp.w - 12 - cardSize.w);
  top = Math.min(Math.max(12, top), vp.h - 12 - cardSize.h);

  return createPortal(
    <div data-tour-layer dir={rtl ? 'rtl' : 'ltr'} className={className ?? ''}>
      <AnimatePresence>
        <motion.div
          key="tour-layer"
          className="fixed inset-0 z-[100]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.3 }}
          aria-hidden={false}
          role="dialog"
          aria-modal="true"
          aria-label={step.title}
        >
          {/* Full-screen catcher: the page underneath — including the
              spotlighted element itself — is not clickable during the tour. */}
          <div className="absolute inset-0" onClick={() => clickToNext && next()} />

          {/* The veil: blurred + dimmed everywhere except the hole. */}
          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{
              clipPath: clip,
              WebkitClipPath: clip,
              background: VEIL_INK,
              backdropFilter: VEIL_BLUR,
              WebkitBackdropFilter: VEIL_BLUR,
            }}
          />

          {/* Spotlight ring around the hole, with a slow outward pulse. */}
          <motion.div
            className="pointer-events-none absolute"
            style={{ top: hy, left: hx, width: hw, height: hh, borderRadius: HOLE_RADIUS }}
            initial={false}
            animate={{ opacity: spot ? 1 : 0 }}
            transition={{ duration: reduce ? 0 : 0.25 }}
          >
            <span
              className="absolute inset-0"
              style={{
                borderRadius: HOLE_RADIUS,
                boxShadow: '0 0 0 2px rgba(255,255,255,0.95), 0 0 0 6px rgba(255,255,255,0.2), 0 12px 40px rgba(0,0,0,0.25)',
              }}
            />
            {!reduce && (
              <motion.span
                className="absolute inset-0"
                style={{ borderRadius: HOLE_RADIUS, boxShadow: '0 0 0 2px rgba(255,255,255,0.9)' }}
                animate={{ scale: [1, 1.08], opacity: [0.7, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
          </motion.div>

          <motion.div
            ref={cardRef}
            className="absolute w-[320px] max-w-[calc(100vw-24px)] rounded-2xl border border-cream-dark bg-white p-4 shadow-2xl shadow-black/25"
            initial={reduce ? false : { opacity: 0, scale: 0.92, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0, left, top }}
            transition={reduce ? { duration: 0 } : SPRING}
            style={{ left, top }}
            onClick={(e) => e.stopPropagation()}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={index}
                initial={reduce ? false : { opacity: 0, y: 10, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={reduce ? undefined : { opacity: 0, y: -8, filter: 'blur(4px)' }}
                transition={{ duration: reduce ? 0 : 0.22, ease: 'easeOut' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[15px] font-extrabold leading-snug text-navy">{step.title}</h3>
                  <button
                    type="button"
                    onClick={skip}
                    aria-label={labels.close}
                    className="-me-1 -mt-1 rounded-md p-1 text-navy/40 transition-colors hover:bg-cream hover:text-navy/70"
                  >
                    <IconX />
                  </button>
                </div>
                <div className="mt-1.5 text-[13.5px] leading-relaxed text-navy/70">{step.content}</div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-4 flex items-center justify-between">
              {showProgress ? (
                <div className="flex items-center gap-1.5" aria-hidden>
                  {steps.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === index ? 'w-4 bg-navy' : 'w-1.5 bg-cream-dark'
                      }`}
                    />
                  ))}
                </div>
              ) : (
                <span className="text-[11px] tabular-nums text-navy/40">
                  {index + 1} / {count}
                </span>
              )}

              <div className="flex items-center gap-1.5">
                {!isFirst && (
                  <button
                    type="button"
                    onClick={back}
                    className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-navy/60 transition-colors hover:bg-cream hover:text-navy"
                  >
                    <IconArrow className={rtl ? '' : 'rotate-180'} />
                    {labels.back}
                  </button>
                )}
                <motion.button
                  type="button"
                  data-tour-primary
                  onClick={next}
                  whileTap={reduce ? undefined : { scale: 0.94 }}
                  className="inline-flex min-h-[40px] items-center gap-1 rounded-lg bg-navy px-3.5 py-1.5 text-[13px] font-bold text-white transition-colors hover:bg-navy-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
                >
                  {isLast ? labels.done : labels.next}
                  {!isLast && <IconArrow className={rtl ? 'rotate-180' : ''} />}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" className="h-4 w-4">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function IconArrow({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-3.5 w-3.5 ${className}`}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
