import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { resolveNotificationText } from '../lib/notificationText';
import { notificationIconName } from '../lib/notificationIcon';
import type { AppNotification } from '../lib/types';
import { AppIcon } from './AppIcon';
import { ToastNotification } from './ui/toast-notification';
import { DynamicIsland } from './ui/dynamic-island';

const AUTO_DISMISS_MS = 6000;
/** How long the island stays expanded before shrinking to an icon-only pill
 *  — mirrors real Dynamic Island behavior (expand → hold → collapse) rather
 *  than just popping in and out. */
const COLLAPSE_AFTER_MS = 3500;

/**
 * The live popup for a notification that arrives while the tab is open —
 * mounted once in Layout, driven entirely by `toast`/`dismissToast` from
 * AppContext (see the unread-count poll there for what sets it).
 *
 * Desktop gets the framecn-style card, bottom-corner, English-reading-order
 * layout that reuses `ui/toast-notification`. Mobile gets an Apple-style
 * Dynamic Island pill (`ui/dynamic-island`) instead of that same wide card:
 * at phone width the card's fixed 320-420px box either overflows the screen
 * or sits on top of MobileTabBar, and a bottom-right corner has no meaning
 * in a single-column layout anyway.
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
    return <MobileIslandToast notification={toast} title={title} body={body} onOpen={open} />;
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

function MobileIslandToast({
  notification,
  title,
  body,
  onOpen,
}: {
  notification: AppNotification;
  title: string;
  body: string;
  onOpen: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    setExpanded(true);
    const id = setTimeout(() => setExpanded(false), COLLAPSE_AFTER_MS);
    return () => clearTimeout(id);
  }, [notification.id]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[70] flex justify-center px-4">
      <DynamicIsland
        expanded={expanded}
        icon={<AppIcon name={notificationIconName(notification.key)} className="h-3.5 w-3.5" />}
        title={title}
        body={body || undefined}
        onClick={onOpen}
        className="pointer-events-auto"
      />
    </div>
  );
}
