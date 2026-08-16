import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon } from './AppIcon';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal shell: role=dialog, aria-modal, focus trap,
 * Escape-to-close, backdrop-click-to-close, focus restore on unmount.
 *
 * Rendered through a portal on <body> so `position: fixed` is always relative
 * to the viewport — otherwise a transformed/contained ancestor on a tall page
 * would trap the backdrop and push the panel off-screen.
 */
export function Modal({
  onClose,
  labelId,
  children,
  showClose = true,
  maxWidth = 'max-w-md',
  mobileSheet = false,
}: {
  onClose: () => void;
  labelId: string;
  children: ReactNode;
  showClose?: boolean;
  maxWidth?: string;
  /** Below the md breakpoint, dock the panel to the bottom edge full-width
   * (native bottom-sheet feel) instead of centering it like a dialog. */
  mobileSheet?: boolean;
}) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(FOCUSABLE);
    (focusables?.[0] ?? panel)?.focus();

    // lock background scroll while the modal is open — compensate for the
    // vanishing scrollbar's width, otherwise the now-wider viewport reflows
    // in-flow content and shifts everything sideways under the modal.
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      const currentPadding = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab' && panel) {
        const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-navy/60 backdrop-blur-sm animate-fade-in">
      <div
        className={
          mobileSheet
            ? 'flex min-h-full items-end justify-center p-0 md:items-center md:p-4'
            : 'flex min-h-full items-center justify-center p-4'
        }
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelId}
          tabIndex={-1}
          // `md:${maxWidth}` looked right but Tailwind never generated it —
          // class names assembled at runtime are invisible to the compiler, so
          // the width cap simply did not exist and sheets spanned the whole
          // desktop viewport. Both classes here are static: the cap always
          // applies, and `max-md:` lifts it below the breakpoint.
          className={`relative w-full outline-none animate-pop ${maxWidth} ${mobileSheet ? 'max-md:max-w-none' : ''}`}
        >
          {showClose && (
            <button
              onClick={onClose}
              aria-label={t('common.close')}
              className="absolute top-3 end-3 z-10 w-8 h-8 rounded-full bg-white/90 text-navy shadow-card hover:bg-white flex items-center justify-center"
            >
              <AppIcon name="x" className="w-4 h-4" />
            </button>
          )}
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
