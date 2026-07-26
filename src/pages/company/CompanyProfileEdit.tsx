import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { companies } from '../../lib/api';
import type { Company } from '../../lib/types';
import { SERVICE_CATEGORIES, SERVICES, pickText } from '../../data/services';
import { ISTANBUL_AREAS, pickArea } from '../../data/istanbulAreas';
import { RequireCompany } from '../../components/Gates';
import { TagPicker } from '../../components/company/TagPicker';
import { AppIcon, DirArrow } from '../../components/AppIcon';
import { RafiqLoaderScreen } from '../../components/RafiqLoader';

function ProfileEditInner() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [company, setCompany] = useState<Company | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cats, setCats] = useState<string[]>([]);
  const [svcs, setSvcs] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    companies.mine().then((c) => {
      setCompany(c);
      if (c) {
        setName(c.name);
        setDescription(c.description ?? '');
        setLogo(c.logo ?? null);
        setEmail(c.contact.email ?? '');
        setPhone(c.contact.phone ?? '');
        setWhatsapp(c.contact.whatsapp ?? '');
        setCats(c.categories);
        setSvcs(c.services);
        setAreas(c.areas);
      }
    }).catch(() => setCompany(null));
  }, []);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const uploadLogo = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError(false);
    try {
      setLogo(await companies.uploadLogo(file));
    } catch {
      setError(true);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(false);
    setSaved(false);
    try {
      await companies.update({
        name: name.trim(),
        description: description.trim() || undefined,
        logo,
        contact: { email: email.trim() || undefined, phone: phone.trim() || undefined, whatsapp: whatsapp.trim() || undefined },
        categories: cats,
        services: svcs,
        areas,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  if (company === undefined) {
    return (
      <RafiqLoaderScreen />
    );
  }

  if (!company) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="card p-8">
          <p className="text-sm text-navy/70">{t('company.dashboard.noCompany')}</p>
          <Link to="/company/register" className="btn-primary w-full mt-6">{t('company.dashboard.registerCta')}</Link>
        </div>
      </div>
    );
  }

  const catOptions = SERVICE_CATEGORIES.map((c) => ({ id: c.id, label: pickText(c.title, lang) }));
  const svcOptions = SERVICES.filter((s) => cats.includes(s.category)).map((s) => ({ id: s.id, label: pickText(s.title, lang) }));
  const areaOptions = ISTANBUL_AREAS.map((a) => ({ id: a.id, label: pickArea(a.id, lang) }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/company" className="inline-flex items-center gap-1.5 text-sm text-navy/60 hover:text-navy">
        <DirArrow className="w-4 h-4 rotate-180" />
        {t('company.dashboard.title')}
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold text-navy">{t('company.profile.title')}</h1>

      <div className="card p-5 sm:p-6 mt-6 flex flex-col gap-5">
        {/* logo */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-cream-dark overflow-hidden flex items-center justify-center shrink-0">
            {logo ? <img src={logo} alt="" className="w-full h-full object-cover" /> : <AppIcon name="building" className="w-7 h-7 text-navy/40" />}
          </div>
          <label className="btn-secondary cursor-pointer">
            <AppIcon name={uploading ? 'hourglass' : 'upload'} className="w-4 h-4" />
            {t('company.profile.uploadLogo')}
            <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(e) => uploadLogo(e.target.files?.[0])} />
          </label>
        </div>

        <label className="block text-xs font-semibold text-navy/70">
          {t('company.profile.name')}
          <input className="input mt-1.5" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="block text-xs font-semibold text-navy/70">
          {t('company.profile.description')}
          <textarea className="input mt-1.5 min-h-[88px] py-2" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <div>
          <p className="text-xs font-semibold text-navy/70 mb-2">{t('company.profile.categories')}</p>
          <TagPicker options={catOptions} selected={cats} onToggle={(id) => toggle(cats, setCats, id)} />
        </div>

        {cats.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-navy/70 mb-2">{t('company.profile.services')}</p>
            <TagPicker options={svcOptions} selected={svcs} onToggle={(id) => toggle(svcs, setSvcs, id)} />
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-navy/70 mb-2">{t('company.profile.areas')}</p>
          <TagPicker options={areaOptions} selected={areas} onToggle={(id) => toggle(areas, setAreas, id)} />
        </div>

        <div className="border-t border-cream-dark pt-4 grid sm:grid-cols-3 gap-3">
          <label className="block text-xs font-semibold text-navy/70">
            {t('company.register.contactEmail')}
            <input className="input mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
          </label>
          <label className="block text-xs font-semibold text-navy/70">
            {t('company.register.contactPhone')}
            <input className="input mt-1.5" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
          </label>
          <label className="block text-xs font-semibold text-navy/70">
            {t('company.register.contactWhatsapp')}
            <input className="input mt-1.5" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} dir="ltr" />
          </label>
        </div>

        {error && (
          <p role="alert" className="amber-note flex items-center gap-2">
            <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
            {t('company.profile.error')}
          </p>
        )}

        <button onClick={save} disabled={busy || uploading} className="btn-primary w-full disabled:opacity-60">
          <AppIcon name={saved ? 'check' : 'save'} className="w-4 h-4" />
          {saved ? t('company.profile.saved') : t('company.profile.save')}
        </button>
      </div>
    </div>
  );
}

export function CompanyProfileEdit() {
  return (
    <RequireCompany>
      <ProfileEditInner />
    </RequireCompany>
  );
}
