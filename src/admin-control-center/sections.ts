import type { IconName } from '../components/AppIcon';

/**
 * The Control Center section registry. The full structure is declared up front
 * (the brief requires the architecture be extensible from day one), but only
 * `overview` is implemented in Phase A; the rest render an explicit
 * "in progress" placeholder — never fabricated data. Sections are added by
 * flipping `implemented` and pointing at a real page, with no change to routing
 * or the shell.
 */
export interface CCSectionDef {
  id: string;
  labelKey: string; // key into the module-local i18n dictionary
  icon: IconName;
  implemented: boolean;
}

export const CC_SECTIONS: CCSectionDef[] = [
  { id: 'overview', labelKey: 'section.overview', icon: 'layers', implemented: true },
  { id: 'analytics', labelKey: 'section.analytics', icon: 'bar-chart-2', implemented: false },
  { id: 'operations', labelKey: 'section.operations', icon: 'inbox', implemented: false },
  { id: 'crm', labelKey: 'section.crm', icon: 'users', implemented: false },
  { id: 'notifications', labelKey: 'section.notifications', icon: 'bell', implemented: false },
  { id: 'documents', labelKey: 'section.documents', icon: 'file-text', implemented: false },
  { id: 'finance', labelKey: 'section.finance', icon: 'credit-card', implemented: false },
  { id: 'journey', labelKey: 'section.journey', icon: 'compass', implemented: false },
  { id: 'referrals', labelKey: 'section.referrals', icon: 'gift', implemented: false },
  { id: 'content', labelKey: 'section.content', icon: 'newspaper', implemented: false },
  { id: 'security', labelKey: 'section.security', icon: 'shield-check', implemented: false },
  { id: 'systemHealth', labelKey: 'section.systemHealth', icon: 'sliders-horizontal', implemented: false },
];

export const CC_SECTION_IDS = CC_SECTIONS.map((s) => s.id);
export const CC_DEFAULT_SECTION = 'overview';

export function isCCSection(v: string | null): boolean {
  return !!v && CC_SECTION_IDS.includes(v);
}
