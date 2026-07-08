/**
 * Tiny analytics layer. Events are pushed to `window.rafiqAnalytics` (and any
 * `window.dataLayer` if present, e.g. GTM) so a real provider can be wired later
 * without touching call sites.
 */
export type AnalyticsEvent =
  | 'guide_choice_shown'
  | 'diy_clicked'
  | 'ai_clicked'
  | 'get_person_clicked'
  | 'paywall_shown'
  | 'upgrade_clicked'
  | 'guide_viewed_full';

type Props = Record<string, unknown>;

interface AnalyticsWindow {
  rafiqAnalytics?: Array<Props & { event: string }>;
  dataLayer?: Array<Props & { event: string }>;
}

export function track(event: AnalyticsEvent, props: Props = {}): void {
  const payload = { event, ...props };
  try {
    const w = window as unknown as AnalyticsWindow;
    (w.rafiqAnalytics ||= []).push(payload);
    if (Array.isArray(w.dataLayer)) w.dataLayer.push(payload);
    if (import.meta.env.DEV) console.debug('[analytics]', payload);
  } catch {
    /* never let analytics break the UI */
  }
}
