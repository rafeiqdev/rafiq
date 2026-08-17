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
  { id: 'analytics', labelKey: 'section.analytics', icon: 'bar-chart-2', implemented: true },
  { id: 'operations', labelKey: 'section.operations', icon: 'inbox', implemented: true },
  { id: 'crm', labelKey: 'section.crm', icon: 'users', implemented: true },
  { id: 'notifications', labelKey: 'section.notifications', icon: 'bell', implemented: true },
  { id: 'documents', labelKey: 'section.documents', icon: 'file-text', implemented: true },
  { id: 'finance', labelKey: 'section.finance', icon: 'credit-card', implemented: true },
  { id: 'journey', labelKey: 'section.journey', icon: 'compass', implemented: true },
  { id: 'referrals', labelKey: 'section.referrals', icon: 'gift', implemented: true },
  { id: 'content', labelKey: 'section.content', icon: 'newspaper', implemented: true },
  { id: 'security', labelKey: 'section.security', icon: 'shield-check', implemented: true },
  { id: 'systemHealth', labelKey: 'section.systemHealth', icon: 'sliders-horizontal', implemented: true },
];

export const CC_SECTION_IDS = CC_SECTIONS.map((s) => s.id);
export const CC_DEFAULT_SECTION = 'overview';

export function isCCSection(v: string | null): boolean {
  return !!v && CC_SECTION_IDS.includes(v);
}
