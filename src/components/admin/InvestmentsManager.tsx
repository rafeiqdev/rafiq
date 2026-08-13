import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { investmentContacts, investments as api } from '../../lib/api';
import type { InvestmentContact, InvestmentInput, InvestmentRecord, LocalizedText } from '../../lib/types';
import { seedRecords } from '../../data/investments';
import { AppIcon } from '../AppIcon';
import { Modal } from '../Modal';
import { SectionState } from '../SectionState';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { ConfirmActionModal } from './ConfirmActionModal';

const LANGS = ['ar', 'en', 'fa', 'ru'] as const;
const FACT_KEYS = [
  'delivery', 'buildYear', 'units', 'unitTypes', 'mix', 'aidat',
  'yield', 'occupancy', 'mgmtCut', 'payment', 'shortLet', 'residencyUnit',
] as const;

const EMPTY_TEXT: LocalizedText = { ar: '', en: '', fa: '', ru: '' };

const EMPTY_INVESTMENT: InvestmentInput = {
  slug: '', brand: '#1a3a6b', name: { ...EMPTY_TEXT }, district: { ...EMPTY_TEXT },
  type: { ...EMPTY_TEXT }, summary: { ...EMPTY_TEXT }, developer: '', side: 'european',
  minUsd: 0, maxUsd: null, pros: [], cons: [], extraFacts: [], images: [],
  source: { label: '', url: '' }, sort: 0, published: true,
};

const EMPTY_CONTACT = (id: string): InvestmentContact => ({
  opportunityId: id, salesEmail: '', salesPhone: '', whatsapp: '',
  officialUrl: '', pressUrl: '', permission: 'none', notes: '',
});

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-navy/70">
      {label}
      {hint && <span className="block font-normal text-[11px] text-gray-400">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

/** Four inputs, one per locale — used for every translated field. */
function LocalizedField({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: LocalizedText;
  onChange: (v: LocalizedText) => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <span className="block text-xs font-semibold text-navy/70">{label}</span>
      <div className="mt-1 grid gap-2 sm:grid-cols-2">
        {LANGS.map((l) => (
          <div key={l}>
            <span className="block text-[10px] font-bold uppercase text-gray-400">{l}</span>
            {multiline ? (
              <textarea
                className="input min-h-[70px]"
                dir={l === 'ar' || l === 'fa' ? 'rtl' : 'ltr'}
                value={value[l]}
                onChange={(e) => onChange({ ...value, [l]: e.target.value })}
              />
            ) : (
              <input
                className="input"
                dir={l === 'ar' || l === 'fa' ? 'rtl' : 'ltr'}
                value={value[l]}
                onChange={(e) => onChange({ ...value, [l]: e.target.value })}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A list of localised bullets (the upside / the risks). */
function BulletList({
  label,
  items,
  onChange,
  addLabel,
}: {
  label: string;
  items: LocalizedText[];
  onChange: (v: LocalizedText[]) => void;
  addLabel: string;
}) {
  return (
    <div className="rounded-card border-2 border-cream-dark p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-navy">{label}</span>
        <button
          type="button"
          onClick={() => onChange([...items, { ...EMPTY_TEXT }])}
          className="btn-secondary !h-8 px-3 text-xs"
        >
          <AppIcon name="plus" className="w-3.5 h-3.5" />
          {addLabel}
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {items.map((it, i) => (
          <div key={i} className="rounded-btn bg-cream p-2.5">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="btn-danger !h-7 px-2 text-xs"
              >
                <AppIcon name="trash" className="w-3 h-3" />
              </button>
            </div>
            <LocalizedField
              label={`#${i + 1}`}
              value={it}
              multiline
              onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function InvestmentEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: InvestmentRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<InvestmentInput>(initial ? { ...initial } : EMPTY_INVESTMENT);
  const [contact, setContact] = useState<InvestmentContact>(EMPTY_CONTACT(initial?.id ?? ''));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof InvestmentInput>(k: K, v: InvestmentInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!initial) return;
    investmentContacts
      .get(initial.id)
      .then((c) => c && setContact(c))
      .catch(() => {
        // A contact row that will not load must not block editing the public
        // fields — the two are independent records on purpose.
      });
  }, [initial]);

  const addImages = async (files?: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) urls.push(await api.uploadImage(file));
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
    } catch {
      setError(t('admin.investments.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.slug.trim()) {
      setError(t('admin.investments.slugRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = initial ? initial.id : (await api.create(form)).id;
      if (initial) await api.update(id, form);
      // Contacts are saved separately and only when something was typed —
      // an empty row for every opportunity is noise in the table.
      const hasContact = [contact.salesEmail, contact.salesPhone, contact.whatsapp, contact.officialUrl, contact.pressUrl, contact.notes]
        .some((v) => v.trim() !== '') || contact.permission !== 'none';
      if (hasContact) await investmentContacts.save({ ...contact, opportunityId: id });
      onSaved();
      onClose();
    } catch {
      setError(t('admin.investments.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} labelId="investment-editor" maxWidth="max-w-3xl">
      <div className="card max-h-[88vh] overflow-y-auto p-6">
        <h3 id="investment-editor" className="text-lg font-extrabold text-navy">
          {initial ? t('admin.investments.edit') : t('admin.investments.add')}
        </h3>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label={t('admin.investments.slug')} hint={t('admin.investments.slugHint')}>
            <input className="input" dir="ltr" value={form.slug} onChange={(e) => set('slug', e.target.value.trim())} />
          </Field>
          <Field label={t('admin.investments.developer')}>
            <input className="input" dir="ltr" value={form.developer} onChange={(e) => set('developer', e.target.value)} />
          </Field>
          <Field label={t('admin.investments.brand')} hint={t('admin.investments.brandHint')}>
            <div className="flex gap-2">
              <input type="color" className="h-10 w-12 rounded-btn border-2 border-cream-dark" value={form.brand} onChange={(e) => set('brand', e.target.value)} />
              <input className="input flex-1" dir="ltr" value={form.brand} onChange={(e) => set('brand', e.target.value)} />
            </div>
          </Field>
          <Field label={t('admin.investments.side')}>
            <select className="input" value={form.side} onChange={(e) => set('side', e.target.value as InvestmentInput['side'])}>
              <option value="european">{t('invest.side.european')}</option>
              <option value="asian">{t('invest.side.asian')}</option>
            </select>
          </Field>
          <Field label={t('admin.investments.minUsd')}>
            <input type="number" className="input" dir="ltr" value={form.minUsd} onChange={(e) => set('minUsd', Number(e.target.value))} />
          </Field>
          <Field label={t('admin.investments.maxUsd')} hint={t('admin.investments.maxUsdHint')}>
            <input
              type="number"
              className="input"
              dir="ltr"
              value={form.maxUsd ?? ''}
              onChange={(e) => set('maxUsd', e.target.value.trim() === '' ? null : Number(e.target.value))}
            />
          </Field>
          <Field label={t('admin.investments.sort')}>
            <input type="number" className="input" dir="ltr" value={form.sort} onChange={(e) => set('sort', Number(e.target.value))} />
          </Field>
          <Field label={t('admin.investments.published')}>
            <label className="flex h-10 items-center gap-2 text-sm text-navy">
              <input type="checkbox" className="h-4 w-4 accent-navy" checked={form.published} onChange={(e) => set('published', e.target.checked)} />
              {t('admin.investments.publishedHint')}
            </label>
          </Field>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <LocalizedField label={t('admin.investments.name')} value={form.name} onChange={(v) => set('name', v)} />
          <LocalizedField label={t('admin.investments.district')} value={form.district} onChange={(v) => set('district', v)} />
          <LocalizedField label={t('admin.investments.type')} value={form.type} onChange={(v) => set('type', v)} multiline />
          <LocalizedField label={t('admin.investments.summary')} value={form.summary} onChange={(v) => set('summary', v)} multiline />

          <BulletList
            label={t('admin.investments.pros')}
            items={form.pros}
            onChange={(v) => set('pros', v)}
            addLabel={t('admin.investments.addBullet')}
          />
          <BulletList
            label={t('admin.investments.cons')}
            items={form.cons}
            onChange={(v) => set('cons', v)}
            addLabel={t('admin.investments.addBullet')}
          />

          {/* extra facts */}
          <div className="rounded-card border-2 border-cream-dark p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-navy">{t('admin.investments.facts')}</span>
              <button
                type="button"
                onClick={() => set('extraFacts', [...form.extraFacts, { key: 'delivery', value: '' }])}
                className="btn-secondary !h-8 px-3 text-xs"
              >
                <AppIcon name="plus" className="w-3.5 h-3.5" />
                {t('admin.investments.addFact')}
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {form.extraFacts.map((f, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-btn bg-cream p-2">
                  <select
                    className="input !h-9 w-40"
                    value={f.key}
                    onChange={(e) =>
                      set('extraFacts', form.extraFacts.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))
                    }
                  >
                    {FACT_KEYS.map((k) => (
                      <option key={k} value={k}>{t(`invest.facts.${k}`)}</option>
                    ))}
                  </select>
                  <input
                    className="input !h-9 flex-1"
                    dir="ltr"
                    placeholder={t('admin.investments.factValue')}
                    value={typeof f.value === 'string' ? f.value : f.value.ar}
                    onChange={(e) =>
                      set('extraFacts', form.extraFacts.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => set('extraFacts', form.extraFacts.filter((_, j) => j !== i))}
                    className="btn-danger !h-8 px-2 text-xs"
                  >
                    <AppIcon name="trash" className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* images */}
          <div className="rounded-card border-2 border-cream-dark p-3">
            <span className="text-xs font-bold text-navy">{t('admin.investments.images')}</span>
            <p className="mt-1 text-[11px] text-gray-500">{t('admin.investments.imagesHint')}</p>
            <input type="file" accept="image/*" multiple onChange={(e) => addImages(e.target.files)} className="mt-2 text-xs" />
            {uploading && <p className="mt-2 text-xs text-gray-500">{t('admin.investments.uploading')}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {form.images.map((u) => (
                <div key={u} className="relative">
                  <img src={u} alt="" className="h-16 w-24 rounded-btn object-cover" />
                  <button
                    type="button"
                    onClick={() => set('images', form.images.filter((x) => x !== u))}
                    className="absolute -end-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-red text-white"
                    aria-label={t('common.delete')}
                  >
                    <AppIcon name="x" className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('admin.investments.sourceLabel')}>
              <input className="input" dir="ltr" value={form.source.label} onChange={(e) => set('source', { ...form.source, label: e.target.value })} />
            </Field>
            <Field label={t('admin.investments.sourceUrl')}>
              <input className="input" dir="ltr" value={form.source.url} onChange={(e) => set('source', { ...form.source, url: e.target.value })} />
            </Field>
          </div>

          {/* ── internal only ── */}
          <div className="rounded-card border-2 border-brand-red/40 bg-brand-red/5 p-3">
            <div className="flex items-start gap-2">
              <AppIcon name="lock" className="mt-0.5 h-4 w-4 shrink-0 text-brand-red" />
              <div>
                <span className="text-xs font-bold text-brand-red">{t('admin.investments.internal')}</span>
                <p className="text-[11px] text-brand-red/80">{t('admin.investments.internalHint')}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label={t('admin.investments.salesEmail')}>
                <input className="input" dir="ltr" value={contact.salesEmail} onChange={(e) => setContact({ ...contact, salesEmail: e.target.value })} />
              </Field>
              <Field label={t('admin.investments.salesPhone')}>
                <input className="input" dir="ltr" value={contact.salesPhone} onChange={(e) => setContact({ ...contact, salesPhone: e.target.value })} />
              </Field>
              <Field label={t('admin.investments.whatsapp')}>
                <input className="input" dir="ltr" value={contact.whatsapp} onChange={(e) => setContact({ ...contact, whatsapp: e.target.value })} />
              </Field>
              <Field label={t('admin.investments.officialUrl')}>
                <input className="input" dir="ltr" value={contact.officialUrl} onChange={(e) => setContact({ ...contact, officialUrl: e.target.value })} />
              </Field>
              <Field label={t('admin.investments.pressUrl')}>
                <input className="input" dir="ltr" value={contact.pressUrl} onChange={(e) => setContact({ ...contact, pressUrl: e.target.value })} />
              </Field>
              <Field label={t('admin.investments.permission')} hint={t('admin.investments.permissionHint')}>
                <select
                  className="input"
                  value={contact.permission}
                  onChange={(e) => setContact({ ...contact, permission: e.target.value as InvestmentContact['permission'] })}
                >
                  {(['none', 'requested', 'granted', 'refused'] as const).map((p) => (
                    <option key={p} value={p}>{t(`admin.investments.permissionState.${p}`)}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-3">
              <Field label={t('admin.investments.notes')}>
                <textarea className="input min-h-[70px]" value={contact.notes} onChange={(e) => setContact({ ...contact, notes: e.target.value })} />
              </Field>
            </div>
          </div>
        </div>

        {error && <p className="mt-4 text-sm font-semibold text-brand-red">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
          <button onClick={save} disabled={busy} className="btn-primary flex-[2] disabled:opacity-60">
            {t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function InvestmentsManager() {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<InvestmentRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const section = useAsyncSection<InvestmentRecord[]>(() => api.adminList(), []);
  const load = section.reload;
  const [confirmDelete, setConfirmDelete] = useState<InvestmentRecord | null>(null);
  const [confirmSeed, setConfirmSeed] = useState(false);

  const remove = async (row: InvestmentRecord) => {
    await api.remove(row.id);
    load();
  };

  /**
   * Imports the eleven built-in files as editable rows. Skips anything whose
   * slug already exists so pressing it twice cannot duplicate the catalogue.
   */
  const importSeed = async () => {
    setSeeding(true);
    try {
      const existing = new Set((section.data ?? []).map((r) => r.slug));
      for (const rec of seedRecords()) {
        if (existing.has(rec.slug)) continue;
        const { id: _ignored, ...input } = rec;
        await api.create(input);
      }
      load();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="card mt-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-navy">{t('admin.investments.title')}</h2>
        <div className="flex gap-2">
          <button onClick={() => setConfirmSeed(true)} disabled={seeding} className="btn-secondary h-9 px-4 text-xs disabled:opacity-60">
            <AppIcon name="download" className="h-3.5 w-3.5" />
            {t('admin.investments.importSeed')}
          </button>
          <button onClick={() => setAdding(true)} className="btn-primary h-9 px-4 text-xs">
            <AppIcon name="plus" className="h-3.5 w-3.5" />
            {t('admin.investments.add')}
          </button>
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-500">{t('admin.investments.intro')}</p>

      <SectionState
        section={section}
        title={t('admin.investments.title')}
        empty={<p className="mt-3 text-sm text-gray-500">{t('admin.investments.empty')}</p>}
      >
        {(rows) => (
          <ul className="mt-4 flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-cream px-4 py-2.5 text-sm">
                <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: r.brand }} />
                <span className="font-semibold text-navy">{r.name.ar || r.slug}</span>
                <span className="text-xs text-gray-500" dir="ltr">
                  {r.developer} · ${r.minUsd.toLocaleString()}
                  {r.maxUsd ? ` – $${r.maxUsd.toLocaleString()}` : '+'}
                </span>
                {!r.published && (
                  <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-bold text-navy">
                    {t('admin.investments.hidden')}
                  </span>
                )}
                <span className="ms-auto flex gap-2">
                  <button onClick={() => setEditing(r)} className="btn-secondary !h-8 px-2.5 text-xs" aria-label={t('common.edit')}>
                    <AppIcon name="pencil" className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setConfirmDelete(r)} className="btn-danger !h-8 px-2.5 text-xs" aria-label={t('common.delete')}>
                    <AppIcon name="trash" className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionState>

      {(adding || editing) && (
        <InvestmentEditor
          initial={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={load}
        />
      )}

      {confirmDelete && (
        <ConfirmActionModal
          title={t('common.delete')}
          record={confirmDelete.name.ar || confirmDelete.slug}
          expectedResult={t('common.delete')}
          reversible={false}
          notifiesCustomer={false}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => {
            remove(confirmDelete);
            setConfirmDelete(null);
          }}
        />
      )}
      {confirmSeed && (
        <ConfirmActionModal
          title={t('admin.investments.importSeed')}
          expectedResult={t('admin.investments.importSeed')}
          reversible={false}
          notifiesCustomer={false}
          onClose={() => setConfirmSeed(false)}
          onConfirm={() => {
            importSeed();
            setConfirmSeed(false);
          }}
        />
      )}
    </div>
  );
}
