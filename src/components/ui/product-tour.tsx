import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { createPortal } from 'react-dom';

/**
 * Spotlight product tour — ported from 21st.dev (laziekiki/product-tour).
 *
 * Dims the page, glides a rounded spotlight across real elements and floats an
 * auto-positioned card beside each. Kept structurally identical to the source;
 * the deliberate changes are:
 *   - button labels come in through `labels` (the site ships four languages),
 *   - `rtl` flips the forward arrow (the source hard-coded a left-to-right one),
 *   - colours use the site's navy instead of zinc,
 *   - the root carries `data-tour-layer` so the host can tell this dialog apart
 *     from any other `aria-modal` on the page.
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

type Rect = { top: number; left: number; width: number; height: number };

const SPRING = { type: 'spring' as const, stiffness: 320, damping: 32, mass: 0.7 };

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

  const rootRef = React.useRef<HTMLDivElement>(null);
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

    const el = step?.target ? (document.querySelector(step.target) as HTMLElement | null) : null;
    el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center', inline: 'center' });

    measure();
    const settle = window.setTimeout(measure, reduce ? 0 : 320);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open, index, step, reduce]);

  React.useLayoutEffect(() => {
    if (cardRef.current) {
      const r = cardRef.current.getBoundingClientRect();
      setCardSize({ w: r.width, h: r.height });
    }
  }, [index, open, rect]);

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

  if (!mounted || !open || !step) return null;

  const gap = 14;
  let place: TourPlacement = step.placement ?? 'auto';
  if (!rect) place = 'center';
  if (place === 'auto' && rect) {
    if (rect.top + rect.height + gap + cardSize.h < vp.h) place = 'bottom';
    else if (rect.top - gap - cardSize.h > 0) place = 'top';
    else if (rect.left + rect.width + gap + cardSize.w < vp.w) place = 'right';
    else place = 'left';
  }

  let left = vp.w / 2 - cardSize.w / 2;
  let top = vp.h / 2 - cardSize.h / 2;
  if (rect) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    if (place === 'bottom') {
      left = cx - cardSize.w / 2;
      top = rect.top + rect.height + gap + pad;
    } else if (place === 'top') {
      left = cx - cardSize.w / 2;
      top = rect.top - gap - pad - cardSize.h;
    } else if (place === 'right') {
      left = rect.left + rect.width + gap + pad;
      top = cy - cardSize.h / 2;
    } else if (place === 'left') {
      left = rect.left - gap - pad - cardSize.w;
      top = cy - cardSize.h / 2;
    }
  }
  left = Math.min(Math.max(12, left), vp.w - 12 - cardSize.w);
  top = Math.min(Math.max(12, top), vp.h - 12 - cardSize.h);

  const spot = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  const overlayInk = 'rgba(18,41,77,0.55)';

  return createPortal(
    <div ref={rootRef} data-tour-layer dir={rtl ? 'rtl' : 'ltr'} className={className ?? ''}>
      <AnimatePresence>
        <motion.div
          key="tour-layer"
          className="fixed inset-0 z-[100]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
          aria-hidden={false}
          role="dialog"
          aria-modal="true"
          aria-label={step.title}
        >
          <div className="absolute inset-0" onClick={() => clickToNext && next()} />

          {spot ? (
            <motion.div
              className="pointer-events-none absolute rounded-xl"
              initial={false}
              animate={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
              transition={reduce ? { duration: 0 } : SPRING}
              style={{
                boxShadow: `0 0 0 9999px ${overlayInk}`,
                outline: '1px solid rgba(255,255,255,0.85)',
                outlineOffset: 2,
              }}
            >
              <span
                className="absolute inset-0 rounded-xl"
                style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 8px 40px rgba(0,0,0,0.18)' }}
              />
            </motion.div>
          ) : (
            <motion.div
              className="pointer-events-none absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ background: overlayInk }}
            />
          )}

          <motion.div
            ref={cardRef}
            className="absolute w-[320px] max-w-[calc(100vw-24px)] rounded-2xl border border-cream-dark bg-white p-4 shadow-2xl shadow-black/20"
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1, left, top }}
            transition={reduce ? { duration: 0 } : SPRING}
            style={{ left, top }}
            onClick={(e) => e.stopPropagation()}
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
                <button
                  type="button"
                  data-tour-primary
                  onClick={next}
                  className="inline-flex min-h-[40px] items-center gap-1 rounded-lg bg-navy px-3.5 py-1.5 text-[13px] font-bold text-white transition-colors hover:bg-navy-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
                >
                  {isLast ? labels.done : labels.next}
                  {!isLast && <IconArrow className={rtl ? 'rotate-180' : ''} />}
                </button>
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
