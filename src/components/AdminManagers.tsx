import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminPlaces, listings as listingsApi } from '../lib/api';
import type { ListingInput, PlaceInput } from '../lib/api';
import type { Listing, Place } from '../lib/types';
import { AppIcon } from './AppIcon';
import { Modal } from './Modal';
import { SectionState } from './SectionState';
import { useAsyncSection } from '../hooks/useAsyncSection';

const PLACE_CATEGORIES = ['dining', 'hotels', 'notary', 'hospitals', 'government', 'shopping'] as const;

const EMPTY_LISTING: ListingInput = { district: '', rooms: '', m2: 0, priceUsd: 0, citizenship: false, image: '', description: '', bathrooms: 0, furnished: false, images: [] };
const EMPTY_PLACE: PlaceInput = { name: '', category: 'dining', lat: 41.0151, lng: 28.9795, address: '' };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-navy/70">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

// ---------------------------------------------------------------- listings

function ListingEditor({ initial, onClose, onSaved }: { initial: Listing | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<ListingInput>(
    initial
      ? {
          district: initial.district, rooms: initial.rooms, m2: initial.m2, priceUsd: initial.priceUsd,
          citizenship: initial.citizenship, image: initial.image ?? '',
          description: initial.description ?? '', bathrooms: initial.bathrooms ?? 0,
          furnished: initial.furnished ?? false, images: initial.images ?? [],
        }
      : EMPTY_LISTING,
  );
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(false);

  const set = <K extends keyof ListingInput>(k: K, v: ListingInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const addImages = async (files?: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(false);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) urls.push(await listingsApi.uploadImage(file));
      setForm((f) => ({ ...f, images: [...(f.images ?? []), ...urls] }));
    } catch {
      setError(true);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url: string) =>
    setForm((f) => ({ ...f, images: (f.images ?? []).filter((u) => u !== url) }));

  const save = async () => {
    setBusy(true);
    setError(false);
    // the first uploaded photo becomes the card cover (back-compat with `image`)
    const payload: ListingInput = { ...form, image: form.images?.[0] || form.image || '' };
    try {
      if (initial) await listingsApi.update(initial.id, payload);
      else await listingsApi.create(payload);
      onSaved();
      onClose();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} labelId="listing-editor" maxWidth="max-w-lg">
      <div className="card p-6 max-h-[85vh] overflow-y-auto">
        <h3 id="listing-editor" className="font-extrabold text-navy text-lg">
          {initial ? t('admin.listings.edit') : t('admin.listings.add')}
        </h3>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label={t('admin.listings.district')}>
            <input className="input" value={form.district} onChange={(e) => set('district', e.target.value)} />
          </Field>
          <Field label={t('admin.listings.roomsField')}>
            <input className="input" value={form.rooms} onChange={(e) => set('rooms', e.target.value)} placeholder="2+1" />
          </Field>
          <Field label={t('admin.listings.m2')}>
            <input type="number" className="input" value={form.m2 || ''} onChange={(e) => set('m2', Number(e.target.value))} />
          </Field>
          <Field label={t('admin.listings.bathrooms')}>
            <input type="number" className="input" value={form.bathrooms || ''} onChange={(e) => set('bathrooms', Number(e.target.value))} />
          </Field>
          <Field label={t('admin.listings.priceUsd')}>
            <input type="number" className="input" value={form.priceUsd || ''} onChange={(e) => set('priceUsd', Number(e.target.value))} />
          </Field>
        </div>

        <div className="mt-3">
          <Field label={t('admin.listings.description')}>
            <textarea
              className="input min-h-[80px] py-2"
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              placeholder={t('admin.listings.descriptionPlaceholder')}
            />
          </Field>
        </div>

        {/* photo upload (files, not links) */}
        <div className="mt-3">
          <p className="text-xs font-semibold text-navy/70">{t('admin.listings.photos')}</p>
          {(form.images?.length ?? 0) > 0 && (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {form.images!.map((url) => (
                <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-cream-dark">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    aria-label={t('common.delete')}
                    className="absolute top-1 end-1 w-6 h-6 rounded-full bg-brand-red text-white flex items-center justify-center"
                  >
                    <AppIcon name="x" className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="btn-secondary w-full mt-2 cursor-pointer">
            <AppIcon name={uploading ? 'hourglass' : 'upload'} className="w-4 h-4" />
            {uploading ? t('admin.listings.uploading') : t('admin.listings.uploadPhotos')}
            <input
              type="file"
              className="hidden"
              accept="image/png,image/jpeg,image/webp"
              multiple
              disabled={uploading}
              onChange={(e) => addImages(e.target.files)}
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-navy cursor-pointer">
            <input type="checkbox" checked={form.citizenship} onChange={(e) => set('citizenship', e.target.checked)} />
            {t('admin.listings.citizenship')}
          </label>
          <label className="flex items-center gap-2 text-sm text-navy cursor-pointer">
            <input type="checkbox" checked={form.furnished ?? false} onChange={(e) => set('furnished', e.target.checked)} />
            {t('admin.listings.furnished')}
          </label>
        </div>

        {error && (
          <p role="alert" className="amber-note mt-3 flex items-center gap-2">
            <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
            {t('admin.listings.invalid')}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">
            {t('common.cancel')}
          </button>
          <button onClick={save} disabled={busy || uploading} className="btn-primary flex-1 disabled:opacity-60">
            <AppIcon name="save" className="w-4 h-4" />
            {t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function ListingsManager() {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<Listing | null>(null);
  const [adding, setAdding] = useState(false);
  // Error is a state — a failed load must not read as "no listings".
  const section = useAsyncSection<Listing[]>(() => listingsApi.adminList(), []);
  const load = section.reload;

  const remove = async (id: string) => {
    if (!window.confirm(t('admin.listings.confirmDelete'))) return;
    await listingsApi.remove(id);
    load();
  };

  return (
    <div className="card p-6 mt-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-navy">{t('admin.listings.title')}</h2>
        <button onClick={() => setAdding(true)} className="btn-primary h-9 px-4 text-xs">
          <AppIcon name="plus" className="w-3.5 h-3.5" />
          {t('admin.listings.add')}
        </button>
      </div>

      <SectionState
        section={section}
        title={t('admin.listings.title')}
        empty={<p className="mt-3 text-sm text-gray-500">{t('admin.listings.empty')}</p>}
      >
        {(rows) => (
        <ul className="mt-4 flex flex-col gap-2">
          {rows.map((l) => (
            <li key={l.id} className="flex items-center gap-3 flex-wrap rounded-xl bg-cream px-4 py-2.5 text-sm">
              <span className="font-semibold text-navy">{l.district}</span>
              <span className="text-xs text-gray-500" dir="ltr">
                {l.rooms} · {l.m2} m² · ${l.priceUsd.toLocaleString()}
              </span>
              {l.citizenship && (
                <span className="rounded-full bg-brand-red/10 text-brand-red text-[10px] font-bold px-2 py-0.5">
                  {t('realEstate.citizenshipBadge')}
                </span>
              )}
              <span className="ms-auto flex gap-2">
                <button onClick={() => setEditing(l)} className="btn-secondary !h-8 px-2.5 text-xs" aria-label={t('common.edit')}>
                  <AppIcon name="pencil" className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(l.id)} className="btn-danger !h-8 px-2.5 text-xs" aria-label={t('common.delete')}>
                  <AppIcon name="trash" className="w-3.5 h-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
        )}
      </SectionState>

      {(adding || editing) && (
        <ListingEditor
          initial={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={load}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- places

function PlaceEditor({ initial, onClose, onSaved }: { initial: Place | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<PlaceInput>(
    initial ? { name: initial.name, category: initial.category, lat: initial.lat, lng: initial.lng, address: initial.address ?? '' } : EMPTY_PLACE,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const set = <K extends keyof PlaceInput>(k: K, v: PlaceInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    setError(false);
    try {
      if (initial) await adminPlaces.update(initial.id, form);
      else await adminPlaces.create(form);
      onSaved();
      onClose();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} labelId="place-editor" maxWidth="max-w-lg">
      <div className="card p-6">
        <h3 id="place-editor" className="font-extrabold text-navy text-lg">
          {initial ? t('admin.places.edit') : t('admin.places.add')}
        </h3>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label={t('admin.places.name')}>
            <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label={t('admin.places.category')}>
            <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {PLACE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`map.categories.${c}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('admin.places.lat')}>
            <input type="number" step="any" className="input" value={form.lat} onChange={(e) => set('lat', Number(e.target.value))} dir="ltr" />
          </Field>
          <Field label={t('admin.places.lng')}>
            <input type="number" step="any" className="input" value={form.lng} onChange={(e) => set('lng', Number(e.target.value))} dir="ltr" />
          </Field>
        </div>
        <div className="mt-3">
          <Field label={t('admin.places.address')}>
            <input className="input" value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
          </Field>
        </div>
        {error && (
          <p role="alert" className="amber-note mt-3 flex items-center gap-2">
            <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
            {t('admin.places.invalid')}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">
            {t('common.cancel')}
          </button>
          <button onClick={save} disabled={busy} className="btn-primary flex-1 disabled:opacity-60">
            <AppIcon name="save" className="w-4 h-4" />
            {t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function PlacesManager() {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<Place | null>(null);
  const [adding, setAdding] = useState(false);
  // Error is a state — a failed load must not read as "no places".
  const section = useAsyncSection<Place[]>(() => adminPlaces.list(), []);
  const load = section.reload;

  const remove = async (id: string) => {
    if (!window.confirm(t('admin.places.confirmDelete'))) return;
    await adminPlaces.remove(id);
    load();
  };

  return (
    <div className="card p-6 mt-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-navy">{t('admin.places.title')}</h2>
        <button onClick={() => setAdding(true)} className="btn-primary h-9 px-4 text-xs">
          <AppIcon name="plus" className="w-3.5 h-3.5" />
          {t('admin.places.add')}
        </button>
      </div>

      <SectionState
        section={section}
        title={t('admin.places.title')}
        empty={<p className="mt-3 text-sm text-gray-500">{t('admin.places.empty')}</p>}
      >
        {(rows) => (
        <ul className="mt-4 flex flex-col gap-2">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center gap-3 flex-wrap rounded-xl bg-cream px-4 py-2.5 text-sm">
              <span className="rounded-full bg-brand-blue px-3 py-1 text-[10px] font-bold text-navy">
                {t(`map.categories.${p.category}`)}
              </span>
              <span className="font-semibold text-navy">{p.name}</span>
              {p.address && <span className="text-xs text-gray-500">{p.address}</span>}
              <span className="ms-auto flex gap-2">
                <button onClick={() => setEditing(p)} className="btn-secondary !h-8 px-2.5 text-xs" aria-label={t('common.edit')}>
                  <AppIcon name="pencil" className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(p.id)} className="btn-danger !h-8 px-2.5 text-xs" aria-label={t('common.delete')}>
                  <AppIcon name="trash" className="w-3.5 h-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
        )}
      </SectionState>

      {(adding || editing) && (
        <PlaceEditor
          initial={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={load}
        />
      )}
    </div>
  );
}
