import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { companies } from '../../lib/api';
import type { Company, CompanyDoc } from '../../lib/types';
import { SERVICE_CATEGORIES, SERVICES, pickText } from '../../data/services';
import { ISTANBUL_AREAS, pickArea } from '../../data/istanbulAreas';
import { RequireAuth } from '../../components/Gates';
import { TagPicker } from '../../components/company/TagPicker';
import { AppIcon } from '../../components/AppIcon';
import { RafiqLoaderScreen } from '../../components/RafiqLoader';

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-navy/70">{label}</span>
      {hint && <span className="block text-[11px] text-navy/50 mt-0.5">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function RegisterInner() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const { user, refresh } = useApp();

  const [existing, setExisting] = useState<Company | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cats, setCats] = useState<string[]>([]);
  const [svcs, setSvcs] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [docs, setDocs] = useState<CompanyDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    companies.mine().then(setExisting).catch(() => setExisting(null));
  }, []);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const catOptions = SERVICE_CATEGORIES.map((c) => ({ id: c.id, label: pickText(c.title, lang) }));
  const svcOptions = SERVICES.filter((s) => cats.includes(s.category)).map((s) => ({ id: s.id, label: pickText(s.title, lang) }));
  const areaOptions = ISTANBUL_AREAS.map((a) => ({ id: a.id, label: pickArea(a.id, lang) }));

  const addDoc = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const d = await companies.uploadDoc(file);
      setDocs((p) => [...p, d]);
    } catch {
      setError(t('company.register.error'));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!name.trim() || cats.length === 0 || areas.length === 0) {
      setError(t('company.register.selectAtLeastOne'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await companies.register({
        name: name.trim(),
        description: description.trim() || undefined,
        contact: { email: email.trim() || undefined, phone: phone.trim() || undefined, whatsapp: whatsapp.trim() || undefined },
        categories: cats,
        services: svcs,
        areas,
        documents: docs,
      });
      await refresh();
      setDone(true);
    } catch {
      setError(t('company.register.error'));
    } finally {
      setBusy(false);
    }
  };

  if (existing === undefined) {
    return (
      <RafiqLoaderScreen />
    );
  }

  // Already registered (and not just-completed in this session) → point to dashboard.
  if (existing && !done) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="card p-8">
          <div className="icon-chip-gold mx-auto">
            <AppIcon name="briefcase" className="w-6 h-6" />
          </div>
          <h1 className="mt-4 text-xl font-extrabold text-navy">{existing.name}</h1>
          <p className="mt-2 text-sm text-gray-500">
            {t('company.status.' + existing.status)} · {t('company.sub.' + existing.subscriptionStatus)}
          </p>
          <Link to="/company" className="btn-primary w-full mt-6">
            {t('company.register.goDashboard')}
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="card p-8">
          <div className="icon-chip mx-auto">
            <AppIcon name="check-circle" className="w-6 h-6" />
          </div>
          <h1 className="mt-4 text-xl font-extrabold text-navy">{t('company.register.successTitle')}</h1>
          <p className="mt-2 text-sm text-gray-500">{t('company.register.successBody')}</p>
          <Link to="/company" className="btn-primary w-full mt-6">
            {t('company.register.goDashboard')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-extrabold text-navy">{t('company.register.title')}</h1>
      <p className="mt-2 text-sm text-navy/60">{t('company.register.subtitle')}</p>

      <div className="card p-5 sm:p-6 mt-6 flex flex-col gap-5">
        <Field label={t('company.register.name')}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('company.register.namePh')} />
        </Field>

        <Field label={t('company.register.description')}>
          <textarea className="input min-h-[88px] py-2" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('company.register.descriptionPh')} />
        </Field>

        <div>
          <p className="text-xs font-semibold text-navy/70 mb-2">{t('company.register.categories')}</p>
          <TagPicker options={catOptions} selected={cats} onToggle={(id) => toggle(cats, setCats, id)} />
        </div>

        {cats.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-navy/70 mb-2">{t('company.register.services')}</p>
            <TagPicker options={svcOptions} selected={svcs} onToggle={(id) => toggle(svcs, setSvcs, id)} />
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-navy/70 mb-2">{t('company.register.areas')}</p>
          <TagPicker options={areaOptions} selected={areas} onToggle={(id) => toggle(areas, setAreas, id)} />
        </div>

        <div className="border-t border-cream-dark pt-4 grid sm:grid-cols-3 gap-3">
          <Field label={t('company.register.contactEmail')}>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" inputMode="email" />
          </Field>
          <Field label={t('company.register.contactPhone')}>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" inputMode="tel" placeholder="+90 5xx xxx xx xx" />
          </Field>
          <Field label={t('company.register.contactWhatsapp')}>
            <input className="input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} dir="ltr" inputMode="tel" />
          </Field>
        </div>

        <Field label={t('company.register.documents')} hint={t('company.register.documentsHint')}>
          {docs.length > 0 && (
            <ul className="flex flex-col gap-2 mb-2">
              {docs.map((d, i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-sm">
                  <AppIcon name="file-check" className="w-4 h-4 shrink-0 text-navy/70" />
                  <span className="font-semibold text-navy flex-1 min-w-0 truncate">{d.name}</span>
                  <button type="button" onClick={() => setDocs((p) => p.filter((_, j) => j !== i))} aria-label={t('common.delete')} className="text-brand-red">
                    <AppIcon name="x" className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="btn-secondary w-full cursor-pointer">
            <AppIcon name={uploading ? 'hourglass' : 'upload'} className="w-4 h-4" />
            {t('company.register.uploadDocs')}
            <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp,application/pdf" disabled={uploading} onChange={(e) => addDoc(e.target.files?.[0])} />
          </label>
        </Field>

        {error && (
          <p role="alert" className="amber-note flex items-center gap-2">
            <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
            {error}
          </p>
        )}

        <button onClick={submit} disabled={busy || uploading} className="btn-primary w-full disabled:opacity-60">
          {busy ? t('company.register.submitting') : t('company.register.submit')}
        </button>
      </div>
    </div>
  );
}

export function CompanyRegister() {
  return (
    <RequireAuth>
      <RegisterInner />
    </RequireAuth>
  );
}
