import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError, medicalContent, medicalRequests } from '../lib/api';
import { useApp } from '../context/AppContext';
import { useAsyncSection } from '../hooks/useAsyncSection';
import { SectionState } from '../components/SectionState';
import { AppIcon } from '../components/AppIcon';
import { usePageMeta } from '../lib/seo';
import { track } from '../lib/analytics';
import type { MedicalSpecialty } from '../lib/types';

const WA = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) ?? '';
const WA_ENABLED = /^\d{8,15}$/.test(WA) && WA !== '905000000000';

const ACCEPT_TYPES = 'application/pdf,image/jpeg,image/jpg,image/png';
const MAX_BYTES = 10 * 1024 * 1024;

/** Only ask for a travel date when the stored profile says the patient still needs to travel. */
function needsTravelDate(situation: string | null | undefined): boolean {
  if (!situation) return true; // unknown — safer to ask than to hide a needed field
  return situation === 'planning';
}

function pick(v: { ar: string; en: string; fa: string; ru: string }, lang: string): string {
  const l = lang.split('-')[0];
  return (v as Record<string, string>)[l] || v.en || v.ar || '';
}

interface PendingFile {
  file: File;
  status: 'queued' | 'uploading' | 'done' | 'error';
  error?: string;
}

function MedicalRequestForm() {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const navigate = useNavigate();
  const lang = i18n.language;

  const specialties = useAsyncSection<MedicalSpecialty[]>(() => medicalContent.specialties(), []);

  const [specialty, setSpecialty] = useState('');
  const [description, setDescription] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ id: string } | null>(null);

  const showTravelDate = needsTravelDate(user?.situation);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next: PendingFile[] = [];
    for (const file of Array.from(list)) {
      if (!/^(application\/pdf|image\/jpeg|image\/jpg|image\/png)$/.test(file.type)) {
        next.push({ file, status: 'error', error: t('medical.request.files.badType') });
      } else if (file.size > MAX_BYTES) {
        next.push({ file, status: 'error', error: t('medical.request.files.tooLarge') });
      } else {
        next.push({ file, status: 'queued' });
      }
    }
    setFiles((prev) => [...prev, ...next]);
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const valid = specialty.trim() && description.trim().length >= 5 && consent && (!showTravelDate || travelDate);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      track('request_started', { target: 'medical', meta: { specialty } });
      const res = await medicalRequests.create({
        specialty,
        description: description.trim(),
        expectedTravelDate: showTravelDate ? travelDate : null,
        budgetEstimate: budget ? Number(budget) : null,
        notes: notes.trim() || null,
      });

      const uploadable = files.filter((f) => f.status !== 'error');
      for (let i = 0; i < uploadable.length; i++) {
        const idx = files.indexOf(uploadable[i]);
        setFiles((prev) => prev.map((f, j) => (j === idx ? { ...f, status: 'uploading' } : f)));
        try {
          await medicalRequests.uploadFile(res.id, uploadable[i].file);
          setFiles((prev) => prev.map((f, j) => (j === idx ? { ...f, status: 'done' } : f)));
        } catch {
          setFiles((prev) => prev.map((f, j) => (j === idx ? { ...f, status: 'error', error: t('medical.request.files.uploadFailed') } : f)));
        }
      }

      track('request_submitted', { target: 'medical', meta: { specialty, request_id: res.id } });
      setSubmitted({ id: res.id });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'rate_limited') setError(t('medical.request.rateLimited'));
      else setError(t('medical.request.error'));
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    const waText = `${t('medical.request.waIntro')} #${submitted.id.slice(0, 8)}`;
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="icon-chip mx-auto"><AppIcon name="check-circle" className="w-6 h-6" /></div>
        <h1 className="mt-4 text-xl font-extrabold text-navy">{t('medical.request.successTitle')}</h1>
        <p className="mt-2 text-sm text-navy/60">{t('medical.request.successBody')}</p>
        <Link to="/requests" className="btn-primary w-full mt-6">
          {t('medical.request.trackCta')}
        </Link>
        {WA_ENABLED && (
          <a
            href={`https://wa.me/${WA}?text=${encodeURIComponent(waText)}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => track('whatsapp_clicked', { target: 'medical_request_success' })}
            className="btn-secondary w-full mt-3"
          >
            <AppIcon name="message-circle" className="w-4 h-4" />
            {t('medical.request.whatsappCta')}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-extrabold text-navy">{t('medical.request.title')}</h1>
      <p className="mt-1 text-sm text-navy/60">{t('medical.request.subtitle')}</p>

      <div className="mt-6 flex flex-col gap-4">
        <label className="text-xs font-semibold text-navy/70">
          {t('medical.request.specialty')}
          <SectionState section={specialties} title={t('medical.request.specialty')} isEmpty={() => false} empty={null}>
            {(rows) => (
              <select className="input mt-1" value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
                <option value="">{t('medical.request.specialtyPlaceholder')}</option>
                {rows.map((s) => (
                  <option key={s.id} value={s.slug}>{pick(s.name, lang)}</option>
                ))}
              </select>
            )}
          </SectionState>
        </label>

        <label className="text-xs font-semibold text-navy/70">
          {t('medical.request.description')}
          <textarea
            className="input mt-1 min-h-[100px] py-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('medical.request.descriptionPlaceholder')}
            maxLength={4000}
          />
        </label>

        {showTravelDate && (
          <label className="text-xs font-semibold text-navy/70">
            {t('medical.request.travelDate')}
            <input
              type="date"
              className="input mt-1"
              value={travelDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setTravelDate(e.target.value)}
            />
          </label>
        )}

        <label className="text-xs font-semibold text-navy/70">
          {t('medical.request.budget')}
          <input
            type="number"
            min={0}
            className="input mt-1"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder={t('medical.request.budgetPlaceholder')}
          />
        </label>

        <label className="text-xs font-semibold text-navy/70">
          {t('medical.request.notes')}
          <textarea className="input mt-1 min-h-[70px] py-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <div className="text-xs font-semibold text-navy/70">
          {t('medical.request.files.label')}
          <label className="mt-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-cream-dark px-4 py-6 text-navy/50 cursor-pointer hover:border-navy/30">
            <AppIcon name="upload" className="w-5 h-5" />
            <span className="text-sm">{t('medical.request.files.cta')}</span>
            <input type="file" multiple accept={ACCEPT_TYPES} className="hidden" onChange={(e) => addFiles(e.target.files)} />
          </label>
          <p className="mt-1 text-[11px] font-normal text-navy/40">{t('medical.request.files.hint')}</p>
          {files.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg bg-cream px-3 py-2 text-xs font-normal">
                  <AppIcon name="file-text" className="w-4 h-4 shrink-0 text-navy/50" />
                  <span className="flex-1 min-w-0 truncate">{f.file.name}</span>
                  {f.status === 'uploading' && <AppIcon name="clock" className="w-4 h-4 text-navy/40" />}
                  {f.status === 'done' && <AppIcon name="check-circle" className="w-4 h-4 text-green-600" />}
                  {f.status === 'error' && <span className="text-brand-red">{f.error}</span>}
                  {f.status !== 'uploading' && (
                    <button type="button" onClick={() => removeFile(i)} aria-label={t('common.close')}>
                      <AppIcon name="x" className="w-4 h-4 text-navy/40" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="flex items-start gap-2 text-xs text-navy/70">
          <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          {t('medical.request.consent')}
        </label>

        {error && (
          <p role="alert" className="amber-note flex items-center gap-2">
            <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
            {error}
          </p>
        )}

        <button onClick={submit} disabled={!valid || busy} className="btn-primary w-full mt-2 disabled:opacity-50">
          {busy ? t('medical.request.sending') : t('medical.request.submit')}
        </button>
      </div>
    </div>
  );
}

export function MedicalRequest() {
  const { t } = useTranslation();
  usePageMeta({ title: t('medical.request.title'), description: t('medical.request.subtitle') });
  return <MedicalRequestForm />;
}
