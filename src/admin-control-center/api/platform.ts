/**
 * Content, System Health, Documents and Notifications — the remaining
 * read-only sections.
 *
 * All four reuse existing readers wherever one exists. Nothing here publishes,
 * sends, reveals or downloads: those are Phase-C actions requiring the granular
 * permission layer plus an audit entry.
 */
import { adminPlaces, fx, investments, listings, news, notifications } from '../../lib/api';
import { ccSb, orThrow } from './client';

// ── Content & localization ─────────────────────────────────────────────────

export interface ContentSnapshot {
  listings: { total: number };
  investments: { total: number; published: number };
  news: { total: number; published: number; translated: number };
}

/**
 * Publication and translation coverage across the content types that have an
 * admin editor. "translated" counts news posts carrying a translations payload —
 * the gap between that and `total` is the untranslated backlog.
 */
export async function fetchContent(): Promise<ContentSnapshot> {
  const [ls, inv, nw] = await Promise.all([
    listings.adminList(),
    investments.adminList(),
    news.adminList(),
  ]);

  const newsRows = nw as unknown as { published?: boolean; translations?: unknown }[];

  return {
    listings: { total: ls.length },
    investments: {
      total: inv.length,
      published: inv.filter((i) => i.published).length,
    },
    news: {
      total: newsRows.length,
      published: newsRows.filter((n) => n.published !== false).length,
      translated: newsRows.filter((n) => n.translations && Object.keys(n.translations as object).length > 0).length,
    },
  };
}

// ── Places (map points) ────────────────────────────────────────────────────

export interface PlacesSnapshot {
  total: number;
  recent: { id: string; name: string; category: string }[];
}

/** Read-only summary for the Properties & Map page — adding/editing a place stays in the classic Admin. */
export async function fetchPlaces(): Promise<PlacesSnapshot> {
  const rows = await adminPlaces.list();
  return {
    total: rows.length,
    recent: rows.slice(0, 8).map((p) => ({ id: p.id, name: p.name, category: p.category })),
  };
}

// ── System health ──────────────────────────────────────────────────────────

export interface HealthSnapshot {
  fxRuns: Awaited<ReturnType<typeof fx.runs>>;
  fxRates: number;
  lastSuccessfulFx: string | null;
  failedFxRuns: number;
}

/**
 * Read-only operational status. Deliberately exposes NO environment variables,
 * API keys or tokens — only whether scheduled work ran and when it last
 * succeeded.
 */
export async function fetchHealth(): Promise<HealthSnapshot> {
  const [runs, rates] = await Promise.all([fx.runs(20), fx.list()]);
  const lastOk = runs.find((r) => r.status === 'success');
  return {
    fxRuns: runs,
    fxRates: rates.length,
    lastSuccessfulFx: lastOk?.startedAt ?? null,
    failedFxRuns: runs.filter((r) => r.status === 'failed').length,
  };
}

// ── Documents & privacy ────────────────────────────────────────────────────

export interface DocMeta {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
}

export interface DocsSnapshot {
  files: DocMeta[];
  totalBytes: number;
}

/**
 * METADATA ONLY — filename, type, size, date. No file content, no signed URL,
 * no download. Medical documents are the most sensitive data in this product;
 * revealing or downloading one is a Phase-C action that must be permission-gated
 * and written to the audit log before it is offered at all.
 *
 * The underlying table is protected by medical-staff RLS, so a caller without
 * that role gets an error here rather than rows.
 */
export async function fetchDocuments(): Promise<DocsSnapshot> {
  const rows = orThrow(
    await ccSb()
      .from('medical_request_files')
      .select('id,original_filename,mime_type,size_bytes,created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ) as { id: string; original_filename: string; mime_type: string; size_bytes: number | string; created_at: string }[];

  const files = rows.map((r) => ({
    id: r.id,
    filename: r.original_filename,
    mime: r.mime_type,
    sizeBytes: Number(r.size_bytes ?? 0),
    createdAt: r.created_at,
  }));

  return { files, totalBytes: files.reduce((a, f) => a + f.sizeBytes, 0) };
}

// ── Notifications ──────────────────────────────────────────────────────────

export type Broadcast = Awaited<ReturnType<typeof notifications.broadcasts>>[number];

/** Read-only history of what was broadcast. Sending is NOT offered here. */
export async function fetchBroadcasts(): Promise<Broadcast[]> {
  return notifications.broadcasts();
}
