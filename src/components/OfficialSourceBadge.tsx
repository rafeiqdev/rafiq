import { useTranslation } from 'react-i18next';
import { AppIcon } from './AppIcon';
import type { IconName } from './AppIcon';

interface OfficialSource {
  id: string;
  url: string;
  icon: IconName;
  /** services.ts category ids this portal applies to */
  categories?: string[];
  /** specific services.ts service ids this portal applies to (checked before categories) */
  serviceIds?: string[];
  /** journey taskKey values this portal applies to (checked before categories) */
  taskKeys?: string[];
}

/**
 * Verified Turkish government portals, matched by service category / id / journey
 * task key. Deliberately a short, hand-picked list — only portals a foreign user
 * would actually need to double-check a step against, not an exhaustive directory.
 */
const OFFICIAL_SOURCES: OfficialSource[] = [
  {
    id: 'eIkamet',
    url: 'https://e-ikamet.goc.gov.tr',
    icon: 'id-card',
    categories: ['residency'],
    taskKeys: ['residencePermit'],
  },
  {
    id: 'gib',
    url: 'https://www.gib.gov.tr',
    icon: 'receipt',
    categories: ['accounting'],
    serviceIds: ['res-tax'],
    taskKeys: ['taxNumber'],
  },
  {
    id: 'tkgm',
    url: 'https://www.tkgm.gov.tr',
    icon: 'landmark',
    categories: ['realestate'],
  },
  {
    id: 'eDevlet',
    url: 'https://www.turkiye.gov.tr',
    icon: 'shield-check',
    categories: ['legal', 'business', 'telecom', 'daily', 'education', 'health', 'banking'],
  },
];

function resolveSource(serviceId?: string, taskKey?: string, categoryId?: string): OfficialSource | null {
  if (serviceId) {
    const bySvc = OFFICIAL_SOURCES.find((s) => s.serviceIds?.includes(serviceId));
    if (bySvc) return bySvc;
  }
  if (taskKey) {
    const byTask = OFFICIAL_SOURCES.find((s) => s.taskKeys?.includes(taskKey));
    if (byTask) return byTask;
  }
  if (categoryId) {
    const byCat = OFFICIAL_SOURCES.find((s) => s.categories?.includes(categoryId));
    if (byCat) return byCat;
  }
  return null;
}

/**
 * Small pill linking a service-guide step to the verified Turkish government
 * portal that actually processes it (e-İkamet, GİB, TKGM, e-Devlet…), so a
 * foreign user can immediately confirm the step against an authoritative source.
 * Renders nothing when no portal matches — always safe to render unconditionally.
 */
export function OfficialSourceBadge({
  categoryId,
  serviceId,
  taskKey,
  className = '',
}: {
  categoryId?: string;
  serviceId?: string;
  taskKey?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const source = resolveSource(serviceId, taskKey, categoryId);
  if (!source) return null;

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-2.5 py-1 text-[11px] font-semibold text-navy/70 hover:text-navy hover:border-navy/30 transition-colors ${className}`}
    >
      <AppIcon name={source.icon} className="w-3.5 h-3.5" />
      {t(`officialSource.${source.id}`)}
      <AppIcon name="external-link" className="w-3 h-3" />
    </a>
  );
}
