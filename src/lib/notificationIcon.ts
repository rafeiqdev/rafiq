import type { IconName } from '../components/AppIcon';

/** Maps a notification's i18n key (see src/pages/Notifications.tsx) to the
 *  icon that best represents what it's about, so the mobile Dynamic Island
 *  toast can swap its glyph per notification instead of always showing a
 *  generic bell. */
const KEY_ICONS: Record<string, IconName> = {
  custom: 'megaphone',
  welcome: 'sparkles',
  paymentPending: 'wallet',
  paymentVerified: 'credit-card',
  paymentRejected: 'x-circle',
  adminNewPayment: 'credit-card',
  bookingNew: 'calendar',
  bookingConfirmed: 'calendar',
  adminNewBooking: 'calendar',
  bookingDone: 'check',
  bookingCancelled: 'x-circle',
  leadReceived: 'users',
  adminNewLead: 'users',
  requestAccepted: 'file-check',
  requestDone: 'file-check',
  requestRejected: 'x-circle',
};

export function notificationIconName(key: string): IconName {
  return KEY_ICONS[key] ?? 'bell';
}
