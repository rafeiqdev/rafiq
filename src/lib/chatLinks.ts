/**
 * Turns the page ids the assistant offers ("news", "service:res-tourist",
 * "category:realestate"…) into what a button needs: where it goes, what it says
 * in the visitor's language, and which icon it wears.
 *
 * Service and category names come from the live catalogue (static data plus
 * whatever an admin has edited), so a button never shows a stale title.
 */
import type { IconName } from '../components/AppIcon';
import { pickText } from '../data/services';
import type { ServiceCategory, ServiceItem } from '../data/services';
import { getDestination, linkPath, parseLinkId, siteLang } from './siteMap';

export interface ChatLinkView {
  id: string;
  /** language-relative router path (the router basename adds /ar, /en, …) */
  to: string;
  label: string;
  icon: IconName;
  /** a guide button gets a "guide" prefix from the i18n layer */
  kind: 'page' | 'service' | 'category' | 'guide';
}

const PAGE_ICON: Record<string, IconName> = {
  home: 'home',
  services: 'layers',
  realestate: 'building',
  investments: 'trending-up',
  propertyResidence: 'id-card',
  health: 'heart-pulse',
  news: 'newspaper',
  tricks: 'lightbulb',
  map: 'map',
  referrals: 'gift',
  wallet: 'wallet',
  journey: 'check-circle',
  dashboard: 'home',
  requests: 'inbox',
  consultation: 'calendar',
  faq: 'info',
  about: 'info',
  contact: 'phone',
  profile: 'user',
  notifications: 'bell',
  forCompanies: 'briefcase',
  terms: 'file-text',
  privacy: 'shield-check',
  refund: 'file-text',
};

export interface CatalogLike {
  services: readonly ServiceItem[];
  categories: readonly ServiceCategory[];
}

export function resolveChatLink(id: string, lang: string, catalog: CatalogLike): ChatLinkView | null {
  const parsed = parseLinkId(id);
  const to = linkPath(id);
  if (!parsed || !to) return null;
  const L = siteLang(lang);

  switch (parsed.kind) {
    case 'page': {
      const d = getDestination(parsed.id);
      if (!d) return null;
      return { id, to, label: d.label[L], icon: PAGE_ICON[parsed.id] ?? 'compass', kind: 'page' };
    }
    case 'service': {
      const s = catalog.services.find((x) => x.id === parsed.id);
      if (!s) return null;
      return { id, to, label: pickText(s.title, L), icon: s.icon, kind: 'service' };
    }
    case 'category':
    case 'guide': {
      const c = catalog.categories.find((x) => x.id === parsed.id);
      if (!c) return null;
      return { id, to, label: pickText(c.title, L), icon: parsed.kind === 'guide' ? 'file-text' : c.icon, kind: parsed.kind };
    }
  }
}

/** Resolve a list of ids, silently dropping any the catalogue no longer has. */
export function resolveChatLinks(ids: readonly string[] | undefined, lang: string, catalog: CatalogLike): ChatLinkView[] {
  if (!ids) return [];
  return ids.map((id) => resolveChatLink(id, lang, catalog)).filter((v): v is ChatLinkView => v !== null);
}
