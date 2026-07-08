import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { serviceRequests, ApiError } from '../lib/api';
import { pickText } from '../data/services';
import type { ServiceItem } from '../data/services';
import { ISTANBUL_AREAS, pickArea } from '../data/istanbulAreas';
import { useApp } from '../context/AppContext';
import { Modal } from './Modal';
import { AppIcon } from './AppIcon';

// Admin WhatsApp number (international, no "+"). The placeholder is treated as
// "not configured" so we just confirm the request instead of opening WhatsApp.
const WA = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) ?? '';
const WA_ENABLED = /^\d{8,15}$/.test(WA) && WA !== '905000000000';

/** Valid = international format: a country code (+ or 00) then 10–15 digits total. */
function isValidPhone(raw: string): boolean {
  const v = raw.replace(/[\s()\-.]/g, '');
  return /^(\+|00)\d{10,15}$/.test(v);
}
/** Keep only "+", spaces and digits; allow a single leading "+". */
function sanitizePhone(raw: string): string {
  return raw.replace(/[^\d+\s]/g, '').replace(/(?!^)\+/g, '').replace(/\s{2,}/g, ' ');
}
/** Valid = trimmed length >= 3 with at least 2 Unicode letters (not only digits/symbols). */
function isValidName(s: string): boolean {
  const v = (s || '').trim();
  return v.length >= 3 && (v.match(/\p{L}/gu)?.length ?? 0) >= 2;
}

export function ServiceRequestModal({ service, onClose }: { service: ServiceItem; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const lang = i18n.language;
  const serviceTitle = pickText(service.title, lang);
  // A trusted-partner request from a logged-in customer is BROADCAST to matching
  // companies (they compete). Direct services / logged-out keep the classic flow.
  const broadcast = service.type === 'partner' && !!user;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);

  const phoneValid = isValidPhone(phone);
  const showPhoneError = phoneTouched && phone.trim().length > 0 && !phoneValid;
  const nameValid = isValidName(name);
  const showNameError = nameTouched && name.trim().length > 0 && !nameValid;

  const waText = () =>
    `${t('services.modal.waIntro')}\n• ${t('services.modal.service')}: ${serviceTitle}\n• ${t('services.modal.name')}: ${name}\n• ${t('services.modal.phone')}: ${phone}${message ? `\n• ${t('services.modal.message')}: ${message}` : ''}`;

  const submit = async () => {
    if (!nameValid || !phoneValid) {
      setNameTouched(true);
      setPhoneTouched(true);
      return;
    }
    setBusy(true);
    setError(false);
    try {
      await serviceRequests.create({
        name: name.trim(),
        phone: phone.trim(),
        message: message.trim() || undefined,
        serviceId: service.id,
        serviceTitle,
        category: service.category,
        serviceType: service.type,
        lang,
        area: broadcast ? area || undefined : undefined,
        broadcast,
      });
      setDone(true);
      // hand off to WhatsApp if a real admin number is configured
      if (WA_ENABLED) window.open(`https://wa.me/${WA}?text=${encodeURIComponent(waText())}`, '_blank', 'noopener');
    } catch (e) {
      setError(true);
      if (e instanceof ApiError && e.status === 503) setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} labelId="service-request-title">
      <div className="card overflow-hidden">
        <div className="bg-navy px-5 py-4">
          <h2 id="service-request-title" className="text-white font-extrabold">
            {done ? t('services.modal.successTitle') : t('services.modal.title')}
          </h2>
        </div>
        <div className="p-5">
          {done ? (
            <div className="text-center">
              <div className="icon-chip mx-auto">
                <AppIcon name="check-circle" className="w-6 h-6" />
              </div>
              <p className="mt-4 text-sm text-gray-600">{t('services.modal.successBody')}</p>
              {WA_ENABLED && (
                <a
                  href={`https://wa.me/${WA}?text=${encodeURIComponent(waText())}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary w-full mt-5"
                >
                  <AppIcon name="message-circle" className="w-4 h-4" />
                  {t('services.modal.whatsapp')}
                </a>
              )}
              <button onClick={onClose} className="btn-secondary w-full mt-3">
                {t('common.close')}
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-cream px-4 py-3">
                <p className="text-xs font-semibold text-navy/60">{t('services.modal.service')}</p>
                <p className="mt-1 text-sm font-semibold text-navy">{serviceTitle}</p>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <label className="text-xs font-semibold text-navy/70">
                  {t('services.modal.name')}
                  <input
                    className={`input mt-1 ${showNameError ? 'border-brand-red ring-1 ring-brand-red' : ''}`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => setNameTouched(true)}
                    autoComplete="name"
                    aria-invalid={showNameError}
                  />
                  {showNameError && (
                    <span className="mt-1 flex items-center gap-1 text-xs font-normal text-brand-red">
                      <AppIcon name="alert-triangle" className="w-3.5 h-3.5 shrink-0" />
                      {t('common.nameInvalid')}
                    </span>
                  )}
                </label>
                <label className="text-xs font-semibold text-navy/70">
                  {t('services.modal.phone')}
                  <input
                    className={`input mt-1 ${showPhoneError ? 'border-brand-red ring-1 ring-brand-red' : ''}`}
                    value={phone}
                    onChange={(e) => setPhone(sanitizePhone(e.target.value))}
                    onBlur={() => setPhoneTouched(true)}
                    inputMode="tel"
                    dir="ltr"
                    placeholder="+90 5xx xxx xx xx"
                    autoComplete="tel"
                    aria-invalid={showPhoneError}
                  />
                  {showPhoneError && (
                    <span className="mt-1 flex items-center gap-1 text-xs font-normal text-brand-red">
                      <AppIcon name="alert-triangle" className="w-3.5 h-3.5 shrink-0" />
                      {t('services.modal.phoneInvalid')}
                    </span>
                  )}
                </label>
                {broadcast && (
                  <label className="text-xs font-semibold text-navy/70">
                    {t('services.modal.area')}
                    <select className="input mt-1" value={area} onChange={(e) => setArea(e.target.value)}>
                      <option value="">{t('services.modal.areaPlaceholder')}</option>
                      {ISTANBUL_AREAS.map((a) => (
                        <option key={a.id} value={a.id}>{pickArea(a.id, lang)}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="text-xs font-semibold text-navy/70">
                  {t('services.modal.message')}
                  <textarea
                    className="input mt-1 min-h-[88px] py-2"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t('services.modal.messagePlaceholder')}
                  />
                </label>
              </div>
              {broadcast && (
                <p className="amber-note mt-3 flex items-center gap-2 text-xs">
                  <AppIcon name="users" className="w-4 h-4 shrink-0" />
                  {t('services.modal.broadcastNote')}
                </p>
              )}
              {error && (
                <p role="alert" className="amber-note mt-3 flex items-center gap-2">
                  <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
                  {t('services.modal.error')}
                </p>
              )}
              <div className="mt-5 flex gap-2">
                <button onClick={onClose} className="btn-secondary flex-1">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={submit}
                  disabled={busy || !nameValid || !phoneValid}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {busy ? t('services.modal.sending') : t('services.modal.send')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
