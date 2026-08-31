import type { AppNotification } from './types';

/** Admins embed a deadline in a broadcast's free text as `[[deadline:YYYY-MM-DD]]`
 *  or `[[deadline:YYYY-MM-DD|Label]]` — mirrors the tag in src/pages/Notifications.tsx. */
const DEADLINE_TAG = /\[\[deadline:(\d{4}-\d{2}-\d{2})(?:\|([^\]]+))?\]\]/;

function stripDeadlineTag(text: string): string {
  return text.replace(DEADLINE_TAG, '').trim();
}

type TFunc = (key: string) => string;

/** Resolves a notification to display text — shared by the notifications
 *  pages and the live toast popup so the wording never drifts between them. */
export function resolveNotificationText(
  n: Pick<AppNotification, 'key' | 'customText'>,
  t: TFunc,
): { title: string; body: string } {
  if (n.key === 'custom') {
    const label = n.customText?.match(DEADLINE_TAG)?.[2]?.trim();
    return { title: label || stripDeadlineTag(n.customText ?? ''), body: '' };
  }
  return { title: t(`notifications.${n.key}.title`), body: t(`notifications.${n.key}.body`) };
}
