import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { resolveNotificationText } from '../lib/notificationText';
import { AppIcon } from './AppIcon';
import { ToastNotification } from './ui/toast-notification';

const AUTO_DISMISS_MS = 6000;

/**
 * The live popup for a notification that arrives while the tab is open —
 * mounted once in Layout, driven entirely by `toast`/`dismissToast` from
 * AppContext (see the unread-count poll there for what sets it).
 *
 * Desktop gets the framecn-style card, bottom-corner, English-reading-order
 * layout that reuses `ui/toast-notification`. Mobile gets a slimmer top
 * banner instead of that same wide card: at phone width the card's fixed
 * 320-420px box either overflows the screen or sits on top of MobileTabBar,
 * and a bottom-right corner has no meaning in a single-column layout anyway.
 */
export function NotificationToastHost({ isMobile }: { isMobile: boolean }) {
  const { t } = useTranslation();
  const { toast, dismissToast } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(dismissToast, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [toast, dismissToast]);

  if (!toast) return null;

  const { title, body } = resolveNotificationText(toast, t);
  const open = () => {
    dismissToast();
    navigate('/notifications');
  };

  if (isMobile) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[70] flex justify-center px-4">
        <button
          type="button"
          onClick={open}
          className="toast-mobile-enter pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-navy px-4 py-3 text-start shadow-xl transition-transform active:scale-[0.98]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
            <AppIcon name={toast.key === 'custom' ? 'megaphone' : 'bell'} className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-bold text-white">{title}</span>
            {body && <span className="block truncate text-[12px] text-white/70">{body}</span>}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]" onClick={open}>
      <ToastNotification
        title={title}
        message={body}
        variant="info"
        background="transparent"
        className="pointer-events-auto cursor-pointer"
      />
    </div>
  );
}
