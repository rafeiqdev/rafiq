/**
 * Live services catalog = static SERVICES/SERVICE_CATEGORIES with admin overrides
 * (edits / hidden / added) merged on top. Overrides are stored in Supabase
 * (settings.service_catalog) and loaded once; the static catalog is the instant
 * fallback so the UI never blocks or flashes empty.
 */
import { useSyncExternalStore } from 'react';
import { SERVICES, SERVICE_CATEGORIES } from './services';
import type { ServiceItem, ServiceCategory } from './services';
import { fetchCatalogOverrides } from '../lib/api';
import type { CatalogOverrides } from '../lib/api';

interface CatalogSnapshot {
  services: ServiceItem[];
  categories: ServiceCategory[];
}

let snapshot: CatalogSnapshot = { services: SERVICES, categories: SERVICE_CATEGORIES };
let started = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function applyOverrides(ov: CatalogOverrides | null): void {
  if (!ov) {
    snapshot = { services: SERVICES, categories: SERVICE_CATEGORIES };
    emit();
    return;
  }
  const hidden = new Set(ov.hidden ?? []);
  const edits = ov.edits ?? {};
  const base = SERVICES.filter((s) => !hidden.has(s.id)).map((s) => {
    const e = edits[s.id];
    if (!e) return s;
    return {
      ...s,
      ...e,
      title: { ...s.title, ...(e.title ?? {}) },
      desc: { ...s.desc, ...(e.desc ?? {}) },
    } as ServiceItem;
  });
  const added = (ov.added ?? []).filter((a) => !hidden.has(a.id));
  snapshot = { services: [...base, ...added], categories: SERVICE_CATEGORIES };
  emit();
}

export async function loadCatalog(): Promise<void> {
  try {
    applyOverrides(await fetchCatalogOverrides());
  } catch {
    /* keep static catalog */
  }
}

/** Re-fetch after an admin save so the change shows immediately. */
export function reloadCatalog(): Promise<void> {
  return loadCatalog();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (!started) {
    started = true;
    loadCatalog();
  }
  return () => listeners.delete(cb);
}

function getSnapshot(): CatalogSnapshot {
  return snapshot;
}

/** Live catalog (static + admin overrides). Triggers a one-time background load. */
export function useCatalog(): CatalogSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
