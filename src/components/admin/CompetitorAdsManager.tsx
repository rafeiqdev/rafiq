import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminCompetitorAds } from '../../lib/api';
import type { CompetitorAd, CompetitorAdImport, CompetitorAdRow } from '../../lib/api';
import { readCompetitorAdsFile } from '../../lib/competitorAdsFile';
import { SERVICES, SERVICE_CATEGORIES, pickText } from '../../data/services';
import { AppIcon } from '../AppIcon';
import { Modal } from '../Modal';
import { SectionState } from '../SectionState';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { CompetitorAdCard } from './CompetitorAdCard';

/**
 * File-picker + preview count + confirm button. Shared by two places:
 *  - the "no imports yet" empty state, where it's rendered inline (no modal
 *    to open first — importing IS the only thing to do with a freshly-picked
 *    service that has no data, so nothing should gate it behind an extra click);
 *  - ImportModal, used once data already exists, to bring in a fresh batch on
 *    top of the current view without losing it.
 */
function ImportFields({ serviceId, onImported }: { serviceId: string; onImported: () => void }) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ rows: CompetitorAdRow[]; skipped: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const pick = async (f: File | null) => {
    setFile(f);
    setPreview(null);
    setError(false);
    if (!f) return;
    try {
      const parsed = await readCompetitorAdsFile(f);
      setPreview(parsed);
    } catch {
      setError(true);
    }
  };

  const confirm = async () => {
    if (!file || !preview || preview.rows.length === 0) return;
    setBusy(true);
    setError(false);
    try {
      await adminCompetitorAds.importRows(serviceId, file.name, preview.rows);
      onImported();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="flex flex-col gap-1 text-sm">
        {t('competitorAds.manager.chooseFile')}
        <input
          type="file"
          accept=".xlsx"
          aria-label={t('competitorAds.manager.chooseFile')}
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          className="input !h-auto py-2"
        />
      </label>

      {preview && (
        <p className="mt-3 text-sm text-navy/70">
          {t('competitorAds.manager.previewCount', { count: preview.rows.length })}
          {preview.skipped > 0 && ` · ${t('competitorAds.manager.previewSkipped', { count: preview.skipped })}`}
        </p>
      )}

      {error && <p className="mt-3 text-sm text-brand-red">{t('common.error')}</p>}

      <button
        type="button"
        onClick={confirm}
        disabled={busy || !preview || preview.rows.length === 0}
        className="btn-primary mt-4 min-h-[44px] w-full disabled:opacity-50"
      >
        {busy ? t('common.loading') : t('competitorAds.manager.confirmImport')}
      </button>
    </div>
  );
}

function ImportModal({
  serviceId, onClose, onImported,
}: {
  serviceId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal onClose={onClose} labelId="competitor-import-title">
      <h2 id="competitor-import-title" className="font-bold text-navy">{t('competitorAds.manager.importNew')}</h2>
      <div className="mt-4">
        <ImportFields serviceId={serviceId} onImported={() => { onImported(); onClose(); }} />
      </div>
    </Modal>
  );
}

function PreviousVersionsMenu({
  serviceId, activeImportId, onSelect,
}: {
  serviceId: string;
  activeImportId: string | null;
  onSelect: (imp: CompetitorAdImport) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const section = useAsyncSection(() => adminCompetitorAds.listImports(serviceId), [serviceId]);

  if (section.status !== 'ready' || !section.data || section.data.length <= 1) return null;

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="btn-secondary min-h-[44px] px-4 text-sm">
        {t('competitorAds.manager.previousVersions')}
      </button>
      {open && (
        <ul className="absolute z-10 mt-1 w-64 rounded-lg border border-cream-dark bg-white p-1 shadow-card">
          {section.data.map((imp) => (
            <li key={imp.id}>
              <button
                type="button"
                onClick={() => { onSelect(imp); setOpen(false); }}
                className={`w-full rounded-md px-3 py-2 text-start text-sm hover:bg-cream ${imp.id === activeImportId ? 'font-bold text-navy' : 'text-navy/70'}`}
              >
                {imp.importedAt.slice(0, 10)} · {t('competitorAds.manager.rowCount', { count: imp.rowCount })}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CompetitorAdsManager({ initialServiceId }: { initialServiceId?: string } = {}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [serviceId, setServiceId] = useState<string | null>(initialServiceId ?? null);
  const [viewImport, setViewImport] = useState<CompetitorAdImport | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const latest = useAsyncSection(
    () => (serviceId ? adminCompetitorAds.latestImport(serviceId) : Promise.resolve(null)),
    [serviceId, reloadNonce],
  );

  // Once the latest import is known, that's the default view — unless the
  // admin explicitly switched to an older one via PreviousVersionsMenu.
  const effectiveImport = viewImport ?? latest.data ?? null;
  const ads = useAsyncSection(
    () => (effectiveImport ? adminCompetitorAds.listAds(effectiveImport.id) : Promise.resolve([])),
    [effectiveImport?.id],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, CompetitorAd[]>();
    for (const ad of ads.data ?? []) {
      const list = map.get(ad.advertiserName) ?? [];
      list.push(ad);
      map.set(ad.advertiserName, list);
    }
    return [...map.entries()].sort((a, b) => {
      const activeA = a[1].filter((x) => x.status === 'Active').length;
      const activeB = b[1].filter((x) => x.status === 'Active').length;
      return activeB - activeA;
    });
  }, [ads.data]);

  const onImported = () => {
    setViewImport(null); // fall back to "latest" — the import that just landed
    setReloadNonce((n) => n + 1);
  };

  return (
    <div className="card p-6">
      <h2 className="font-bold text-navy">{t('admin.competitors.title')}</h2>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          className="input !h-10 max-w-xs text-sm"
          value={serviceId ?? ''}
          onChange={(e) => { setServiceId(e.target.value || null); setViewImport(null); }}
        >
          <option value="">{t('competitorAds.manager.selectPlaceholder')}</option>
          {SERVICE_CATEGORIES.map((cat) => (
            <optgroup key={cat.id} label={pickText(cat.title, lang)}>
              {SERVICES.filter((s) => s.category === cat.id).map((s) => (
                <option key={s.id} value={s.id}>{pickText(s.title, lang)}</option>
              ))}
            </optgroup>
          ))}
        </select>

        {serviceId && (
          <>
            <button type="button" onClick={() => setImportModalOpen(true)} className="btn-primary min-h-[44px] px-4 text-sm">
              <AppIcon name="upload" className="h-4 w-4 shrink-0" />
              {t('competitorAds.manager.importNew')}
            </button>
            <PreviousVersionsMenu serviceId={serviceId} activeImportId={effectiveImport?.id ?? null} onSelect={setViewImport} />
          </>
        )}
      </div>

      {!serviceId && <p className="mt-6 text-sm text-gray-500">{t('competitorAds.manager.pickService')}</p>}

      {serviceId && (
        <SectionState
          section={latest}
          title={t('admin.competitors.title')}
          empty={
            <div className="mt-6 rounded-xl border border-dashed border-cream-dark p-6 text-center">
              <p className="text-sm text-gray-500">{t('competitorAds.manager.noDataYet')}</p>
              <div className="mx-auto mt-4 max-w-sm text-start">
                <ImportFields serviceId={serviceId} onImported={onImported} />
              </div>
            </div>
          }
        >
          {() => (
            <SectionState
              section={ads}
              title={t('admin.competitors.title')}
              empty={<p className="mt-6 text-sm text-gray-500">{t('competitorAds.manager.noDataYet')}</p>}
            >
              {() => (
                <div className="mt-6 flex flex-col gap-3">
                  {grouped.map(([advertiserName, adsForAdvertiser]) => (
                    <CompetitorAdCard key={advertiserName} advertiserName={advertiserName} ads={adsForAdvertiser} />
                  ))}
                </div>
              )}
            </SectionState>
          )}
        </SectionState>
      )}

      {importModalOpen && serviceId && (
        <ImportModal serviceId={serviceId} onClose={() => setImportModalOpen(false)} onImported={onImported} />
      )}
    </div>
  );
}
