import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminCatalog } from '../lib/api';
import type { CatalogOverrides } from '../lib/api';
import { SERVICES, SERVICE_CATEGORIES, pickText } from '../data/services';
import type { ServiceItem, ServiceType, I18nText } from '../data/services';
import { reloadCatalog } from '../data/catalogStore';
import { AppIcon } from './AppIcon';
import type { IconName } from './AppIcon';
import { Modal } from './Modal';
import { SectionState } from './SectionState';
import { useAsyncSection } from '../hooks/useAsyncSection';

const LANGS = ['ar', 'en', 'tr', 'ru', 'fa'] as const;
type Lang = (typeof LANGS)[number];

interface Draft {
  id: string;
  isNew: boolean;
  category: string;
  type: ServiceType;
  icon: string;
  image: string;
  onRequest: boolean;
  title: Record<Lang, string>;
  desc: Record<Lang, string>;
}

const emptyText = (): Record<Lang, string> => ({ ar: '', en: '', tr: '', ru: '', fa: '' });

function toDraft(s: ServiceItem, isNew: boolean): Draft {
  const t = s.title as Record<string, string>;
  const d = s.desc as Record<string, string>;
  return {
    id: s.id,
    isNew,
    category: s.category,
    type: s.type,
    icon: s.icon,
    image: s.image ?? '',
    onRequest: !!s.onRequest,
    title: { ar: t.ar ?? '', en: t.en ?? '', tr: t.tr ?? '', ru: t.ru ?? '', fa: t.fa ?? '' },
    desc: { ar: d.ar ?? '', en: d.en ?? '', tr: d.tr ?? '', ru: d.ru ?? '', fa: d.fa ?? '' },
  };
}

export function AdminServicesManager() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * The list below is derived from the statically bundled SERVICES catalog
   * merged with these overrides, so a failed fetch never produced an empty
   * state — it rendered the full catalog WITHOUT the admin's edits, hidden
   * flags and added services, and nothing looked wrong. A hidden service
   * appeared live, edited titles reverted to the bundled originals, and the
   * next hide/unhide would have been computed from `{}` and written over the
   * real overrides.
   *
   * The admin must never operate on a catalog that is not showing their real
   * edits, so on failure this panel shows error-with-retry and nothing else.
   */
  const catalogSec = useAsyncSection<CatalogOverrides>(() => adminCatalog.get(), []);
  const ov = catalogSec.status === 'ready' ? (catalogSec.data ?? {}) : {};

  // working list = static + added, with edits applied, plus hidden/added flags
  const rows = useMemo(() => {
    const byId = new Map<string, ServiceItem>();
    SERVICES.forEach((s) => byId.set(s.id, s));
    (ov.added ?? []).forEach((s) => byId.set(s.id, s));
    const hidden = new Set(ov.hidden ?? []);
    const addedIds = new Set((ov.added ?? []).map((a) => a.id));
    const list = [...byId.values()].map((s) => {
      const e = ov.edits?.[s.id];
      const merged = e
        ? ({ ...s, ...e, title: { ...s.title, ...e.title }, desc: { ...s.desc, ...e.desc } } as ServiceItem)
        : s;
      return { service: merged, hidden: hidden.has(s.id), isAdded: addedIds.has(s.id) };
    });
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [r.service.title.ar, r.service.title.en, r.service.id].join(' ').toLowerCase().includes(q),
    );
  }, [ov, query]);

  const persist = async (next: CatalogOverrides) => {
    setBusy(true);
    try {
      await adminCatalog.save(next);
      // Re-read rather than trusting the local copy: what the panel shows after
      // a save should be what the database actually holds, and a refetch that
      // fails now surfaces as the error state instead of leaving optimistic
      // state on screen.
      catalogSec.reload();
      await reloadCatalog();
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async (d: Draft) => {
    const payload: Partial<ServiceItem> = {
      title: d.title as I18nText,
      desc: d.desc as I18nText,
      category: d.category,
      type: d.type,
      icon: d.icon as IconName,
      image: d.image || undefined,
      onRequest: d.onRequest,
    };
    const next: CatalogOverrides = {
      edits: { ...(ov.edits ?? {}) },
      hidden: [...(ov.hidden ?? [])],
      added: [...(ov.added ?? [])],
    };
    const full: ServiceItem = {
      id: d.id,
      category: d.category,
      type: d.type,
      icon: d.icon as IconName,
      image: d.image || undefined,
      title: d.title as I18nText,
      desc: d.desc as I18nText,
      onRequest: d.onRequest,
    };
    if (d.isNew) {
      next.added!.push(full);
    } else if (next.added!.some((a) => a.id === d.id)) {
      next.added = next.added!.map((a) => (a.id === d.id ? full : a));
    } else {
      next.edits![d.id] = payload;
    }
    await persist(next);
    setEditing(null);
  };

  const toggleHide = async (id: string) => {
    const hidden = new Set(ov.hidden ?? []);
    hidden.has(id) ? hidden.delete(id) : hidden.add(id);
    await persist({ ...ov, hidden: [...hidden] });
  };

  const deleteAdded = async (id: string) => {
    const edits = { ...(ov.edits ?? {}) };
    delete edits[id];
    await persist({
      edits,
      hidden: (ov.hidden ?? []).filter((h) => h !== id),
      added: (ov.added ?? []).filter((a) => a.id !== id),
    });
  };

  const newDraft = (): Draft => ({
    id: `custom-${Math.random().toString(36).slice(2, 8)}`,
    isNew: true,
    category: SERVICE_CATEGORIES[0].id,
    type: 'direct',
    icon: 'star',
    image: '',
    onRequest: false,
    title: emptyText(),
    desc: emptyText(),
  });

  return (
    <div className="card p-6 mt-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-bold text-navy inline-flex items-center gap-2">
            <AppIcon name="layers" className="w-4 h-4" />
            {t('admin.catalog.heading')}
          </h2>
          <p className="text-xs text-navy/60 mt-0.5">{t('admin.catalog.sub')}</p>
        </div>
        <button onClick={() => setEditing(newDraft())} className="btn-primary h-9 text-xs">
          <AppIcon name="plus" className="w-4 h-4" />
          {t('admin.catalog.add')}
        </button>
      </div>

      <SectionState
        section={catalogSec}
        title={t('admin.catalog.heading')}
        /* The derived list is never "empty" — SERVICES is bundled — so the
           empty branch is unreachable by construction; it exists only to
           satisfy the shared primitive. */
        isEmpty={() => false}
        empty={null}
      >
        {() => (
        <>
      <input
        className="input mt-4"
        placeholder={t('common.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="mt-3 max-h-[460px] overflow-y-auto divide-y divide-cream-dark/60">
        {rows.map(({ service: s, hidden, isAdded }) => (
          <div key={s.id} className={`py-2.5 flex items-center gap-3 ${hidden ? 'opacity-50' : ''}`}>
            {s.image ? (
              <img src={s.image} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
            ) : (
              <span className="icon-chip !w-8 !h-8 shrink-0">
                <AppIcon name={s.icon} className="w-4 h-4" />
              </span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-navy truncate">{pickText(s.title, lang)}</p>
              <p className="text-[11px] text-navy/50 truncate">{pickText(s.desc, lang)}</p>
            </div>
            {isAdded && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-blue text-navy shrink-0">
                {t('admin.catalog.addedTag')}
              </span>
            )}
            <button onClick={() => setEditing(toDraft(s, false))} className="btn-ghost !h-8 !px-2 text-xs shrink-0">
              <AppIcon name="pencil" className="w-4 h-4" />
            </button>
            <button onClick={() => toggleHide(s.id)} disabled={busy} className="btn-ghost !h-8 !px-2 text-xs shrink-0 whitespace-nowrap">
              {hidden ? t('admin.catalog.show') : t('admin.catalog.hide')}
            </button>
            {isAdded && (
              <button onClick={() => deleteAdded(s.id)} disabled={busy} className="btn-ghost !h-8 !px-2 text-xs text-brand-red shrink-0">
                <AppIcon name="trash" className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
        </>
        )}
      </SectionState>

      {editing && (
        <EditorModal
          draft={editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={saveDraft}
        />
      )}
    </div>
  );
}

function EditorModal({
  draft,
  busy,
  onClose,
  onSave,
}: {
  draft: Draft;
  busy: boolean;
  onClose: () => void;
  onSave: (d: Draft) => void;
}) {
  const { t } = useTranslation();
  const [d, setD] = useState<Draft>(draft);
  const [uploading, setUploading] = useState(false);
  const setField = (lang: Lang, field: 'title' | 'desc', v: string) =>
    setD((p) => ({ ...p, [field]: { ...p[field], [lang]: v } }));

  const onPickImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await adminCatalog.uploadImage(file);
      setD((p) => ({ ...p, image: url }));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal onClose={onClose} labelId="catalog-editor-title" maxWidth="max-w-2xl">
      <div className="card p-6">
        <h2 id="catalog-editor-title" className="font-extrabold text-navy">
          {d.isNew ? t('admin.catalog.newService') : pickText(d.title as I18nText, 'ar') || d.id}
        </h2>

        <label className="block mt-4 text-xs font-bold text-navy/70">{t('admin.catalog.fTitle')}</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
          {LANGS.map((l) => (
            <input
              key={l}
              className="input !h-9 text-sm"
              placeholder={l.toUpperCase()}
              dir={l === 'ar' || l === 'fa' ? 'rtl' : 'ltr'}
              value={d.title[l]}
              onChange={(e) => setField(l, 'title', e.target.value)}
            />
          ))}
        </div>

        <label className="block mt-4 text-xs font-bold text-navy/70">{t('admin.catalog.fDesc')}</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
          {LANGS.map((l) => (
            <textarea
              key={l}
              className="input min-h-[52px] py-1.5 text-sm"
              placeholder={l.toUpperCase()}
              dir={l === 'ar' || l === 'fa' ? 'rtl' : 'ltr'}
              value={d.desc[l]}
              onChange={(e) => setField(l, 'desc', e.target.value)}
            />
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <label className="text-xs font-bold text-navy/70">
            {t('admin.catalog.fCategory')}
            <select
              className="input mt-1"
              value={d.category}
              onChange={(e) => setD((p) => ({ ...p, category: e.target.value }))}
            >
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {pickText(c.title, 'ar')}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-navy/70">
            {t('admin.catalog.fType')}
            <select
              className="input mt-1"
              value={d.type}
              onChange={(e) => setD((p) => ({ ...p, type: e.target.value as ServiceType }))}
            >
              <option value="direct">{t('services.directBadge')}</option>
              <option value="partner">{t('services.partnerBadge')}</option>
            </select>
          </label>
          <label className="text-xs font-bold text-navy/70">
            {t('admin.catalog.fIcon')}
            <input
              className="input mt-1"
              value={d.icon}
              dir="ltr"
              onChange={(e) => setD((p) => ({ ...p, icon: e.target.value }))}
            />
          </label>
          <label className="text-xs font-bold text-navy/70 sm:col-span-2">
            {t('admin.catalog.fImage')}
            <div className="mt-1 flex items-center gap-3">
              {d.image ? (
                <img src={d.image} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 border border-cream-dark" />
              ) : (
                <span className="icon-chip !w-14 !h-14 shrink-0">
                  <AppIcon name={d.icon as IconName} className="w-6 h-6" />
                </span>
              )}
              <div className="flex-1 min-w-0">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploading}
                  onChange={(e) => onPickImage(e.target.files?.[0])}
                  className="block w-full text-xs text-navy/70"
                />
                {d.image && (
                  <button
                    type="button"
                    onClick={() => setD((p) => ({ ...p, image: '' }))}
                    className="mt-1 text-[11px] font-bold text-brand-red"
                  >
                    {t('admin.catalog.removeImage')}
                  </button>
                )}
                {uploading && <p className="text-[11px] text-navy/50 mt-1">{t('admin.listings.uploading')}</p>}
              </div>
            </div>
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-navy/70 mt-6">
            <input
              type="checkbox"
              checked={d.onRequest}
              onChange={(e) => setD((p) => ({ ...p, onRequest: e.target.checked }))}
            />
            {t('admin.catalog.onRequest')}
          </label>
        </div>

        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">
            {t('common.cancel')}
          </button>
          <button
            onClick={() => onSave(d)}
            disabled={busy || !d.title.ar.trim()}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
