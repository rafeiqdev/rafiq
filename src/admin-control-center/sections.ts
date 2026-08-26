import type { IconName } from '../components/AppIcon';

/**
 * The Control Center section registry — reshaped for a single owner running
 * everything himself. Seven groups instead of the original eleven flat
 * sections: rarely-touched detail (system health, document metadata,
 * notification history, onboarding funnel, referral payouts, traffic
 * analytics) now lives inside an accordion on its parent page instead of
 * being its own top-level nav item.
 */
export interface CCSectionDef {
  id: string;
  labelKey: string; // key into the module-local i18n dictionary
  icon: IconName;
  implemented: boolean;
}

export const CC_SECTIONS: CCSectionDef[] = [
  { id: 'today', labelKey: 'section.today', icon: 'alarm-clock', implemented: true },
  { id: 'orders', labelKey: 'section.orders', icon: 'inbox', implemented: true },
  { id: 'customers', labelKey: 'section.customers', icon: 'users', implemented: true },
  { id: 'content', labelKey: 'section.content', icon: 'newspaper', implemented: true },
  { id: 'money', labelKey: 'section.money', icon: 'wallet', implemented: true },
  { id: 'properties', labelKey: 'section.properties', icon: 'map-pin', implemented: true },
  { id: 'settings', labelKey: 'section.settings', icon: 'shield-check', implemented: true },
];

export const CC_SECTION_IDS = CC_SECTIONS.map((s) => s.id);
export const CC_DEFAULT_SECTION = 'today';

export function isCCSection(v: string | null): boolean {
  return !!v && CC_SECTION_IDS.includes(v);
}

/**
 * Old section ids from the 11-section layout, mapped onto their new home.
 * Kept so a bookmarked or shared `?section=` link from before this redesign
 * still lands somewhere sensible instead of silently falling back to the
 * default with no visible reason.
 */
export const LEGACY_SECTION_MAP: Record<string, string> = {
  overview: 'today',
  analytics: 'today',
  operations: 'orders',
  crm: 'customers',
  journey: 'customers',
  finance: 'money',
  referrals: 'money',
  documents: 'settings',
  notifications: 'settings',
  security: 'settings',
  systemHealth: 'settings',
};

/**
 * Resolve a raw `?section=` value to a current section id: passes current
 * ids through unchanged, maps legacy ids to their new home, and falls back
 * to the default for anything unrecognized (missing param, typo, stale id).
 */
export function resolveSectionId(raw: string | null): string {
  if (raw && isCCSection(raw)) return raw;
  if (raw && LEGACY_SECTION_MAP[raw]) return LEGACY_SECTION_MAP[raw];
  return CC_DEFAULT_SECTION;
}
