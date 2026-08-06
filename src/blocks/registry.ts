import type { Profile } from '../lib/types';
import type { IconName } from '../components/AppIcon';

export type BlockKind = 'info' | 'checklist' | 'col' | 'services' | 'nudge';

export interface Block {
  id: string;
  icon: IconName;
  priority: number;
  /** dynamic priority override (reorder rules) */
  priorityFor?: (p: Profile) => number;
  showIf: (p: Profile) => boolean;
  kind: BlockKind;
  /** which profile.has flag this checklist item completes */
  hasKey?: 'turkishPhone' | 'taxNumber' | 'residencePermit' | 'bankAccount';
  hasDuration?: boolean;
  hasDocs?: boolean;
  hasWarning?: boolean;
  hasTip?: boolean;
  ctaTo: string;
}

function residenceExpired(p: Profile): boolean {
  return !!p.renewals.residence && new Date(p.renewals.residence) < new Date();
}

export const BLOCKS: Block[] = [
  // ---- PATH = planning ----
  {
    id: 'preArrival',
    icon: 'file-check',
    priority: 10,
    showIf: (p) => p.path === 'planning',
    kind: 'info',
    hasWarning: true,
    ctaTo: '/services',
  },
  {
    id: 'arrivalPackage',
    icon: 'luggage',
    priority: 20,
    showIf: (p) => p.path === 'planning',
    kind: 'info',
    hasTip: true,
    ctaTo: '/premium',
  },
  {
    id: 'tourismGuide',
    icon: 'camera',
    priority: 30,
    showIf: (p) => p.path === 'planning' && (p.reason === 'tourism' || p.reason === 'visiting'),
    kind: 'info',
    ctaTo: '/services',
  },
  {
    id: 'settlementStack',
    icon: 'layers',
    priority: 30,
    showIf: (p) => p.path === 'planning' && (p.reason === 'live' || p.reason === 'work'),
    kind: 'info',
    ctaTo: '/services',
  },
  {
    id: 'studyBlock',
    icon: 'graduation-cap',
    priority: 30,
    showIf: (p) => p.path === 'planning' && p.reason === 'study',
    kind: 'info',
    ctaTo: '/services',
  },

  // ---- PATH = arrived (14-day checklist; hidden if already owned) ----
  {
    id: 'simBlock',
    icon: 'smartphone',
    priority: 1,
    showIf: (p) => p.path === 'arrived' && !p.has.turkishPhone,
    kind: 'checklist',
    hasKey: 'turkishPhone',
    hasDuration: true,
    hasDocs: true,
    ctaTo: '/premium',
  },
  {
    id: 'transportBlock',
    icon: 'bus',
    priority: 2,
    showIf: (p) => p.path === 'arrived',
    kind: 'checklist',
    hasDuration: true,
    hasDocs: true,
    hasWarning: true,
    ctaTo: '/premium',
  },
  {
    id: 'taxNumberBlock',
    icon: 'receipt',
    priority: 3,
    showIf: (p) => p.path === 'arrived' && !p.has.taxNumber,
    kind: 'checklist',
    hasKey: 'taxNumber',
    hasDuration: true,
    hasDocs: true,
    ctaTo: '/premium',
  },
  {
    id: 'bankBlock',
    icon: 'landmark',
    priority: 4,
    showIf: (p) => p.path === 'arrived' && !p.has.bankAccount,
    kind: 'checklist',
    hasKey: 'bankAccount',
    hasDuration: true,
    hasDocs: true,
    ctaTo: '/premium',
  },
  {
    id: 'residenceBlock',
    icon: 'id-card',
    priority: 5,
    // floats to top while the permit is missing
    priorityFor: (p) => (!p.has.residencePermit ? 0 : 5),
    showIf: (p) => p.path === 'arrived' && !p.has.residencePermit,
    kind: 'checklist',
    hasKey: 'residencePermit',
    hasDuration: true,
    hasDocs: true,
    hasWarning: true,
    ctaTo: '/premium',
  },

  // ---- PATH = living ----
  {
    id: 'renewalTracker',
    icon: 'alarm-clock',
    priority: 10,
    // pushed to top when the residence permit is expired
    priorityFor: (p) => (residenceExpired(p) ? 0 : 10),
    showIf: (p) => p.path === 'living',
    kind: 'info',
    ctaTo: '/profile',
  },
  {
    id: 'driverLicense',
    icon: 'car',
    priority: 20,
    showIf: (p) => p.path === 'living',
    kind: 'info',
    ctaTo: '/premium',
  },
  {
    id: 'healthInsurance',
    icon: 'heart-pulse',
    priority: 30,
    showIf: (p) => p.path === 'living',
    kind: 'info',
    ctaTo: '/premium',
  },
  {
    id: 'realEstateUpgrade',
    icon: 'building',
    priority: 40,
    showIf: (p) => p.path === 'living',
    kind: 'info',
    ctaTo: '/real-estate',
  },
  {
    id: 'companyFormation',
    icon: 'trending-up',
    priority: 41,
    showIf: (p) => p.path === 'living',
    kind: 'info',
    ctaTo: '/premium',
  },
  {
    id: 'translators',
    icon: 'languages',
    priority: 50,
    showIf: (p) => p.path === 'living',
    kind: 'info',
    ctaTo: '/premium',
  },

  // ---- PATH = browsing ----
  {
    id: 'cityGuide',
    icon: 'map',
    priority: 20,
    showIf: (p) => p.path === 'browsing',
    kind: 'info',
    ctaTo: '/map',
  },
  {
    id: 'serviceOverview',
    icon: 'star',
    priority: 30,
    showIf: (p) => p.path === 'browsing',
    kind: 'services',
    ctaTo: '/services',
  },
  {
    id: 'relocateNudge',
    icon: 'plane',
    priority: 40,
    showIf: (p) => p.path === 'browsing',
    kind: 'nudge',
    ctaTo: '/',
  },

  // ---- FAMILY (any path) ----
  {
    id: 'schoolsBlock',
    icon: 'school',
    priority: 60,
    showIf: (p) => p.family === 'yes',
    kind: 'info',
    ctaTo: '/services',
  },
  {
    id: 'familyResidence',
    icon: 'users',
    priority: 61,
    showIf: (p) => p.family === 'yes',
    kind: 'info',
    ctaTo: '/premium',
  },
  {
    id: 'familyInsurance',
    icon: 'shield',
    priority: 62,
    showIf: (p) => p.family === 'yes',
    kind: 'info',
    ctaTo: '/premium',
  },
];

/** Filter by showIf and sort by (possibly dynamic) priority ascending. */
export function blocksFor(profile: Profile): Block[] {
  return BLOCKS.filter((b) => b.showIf(profile)).sort((a, b) => {
    const pa = a.priorityFor ? a.priorityFor(profile) : a.priority;
    const pb = b.priorityFor ? b.priorityFor(profile) : b.priority;
    return pa - pb;
  });
}
