import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { serviceRequests, ApiError } from '../lib/api';
import { checkSubmitThrottle, recordSubmit } from '../lib/submitThrottle';
import { track } from '../lib/analytics';
import { relativeTime } from '../lib/relativeTime';
import { ISTANBUL_AREAS, pickArea } from '../data/istanbulAreas';
import { useApp } from '../context/AppContext';
import { Modal } from './Modal';
import { AppIcon } from './AppIcon';
import { BestOfferSearching } from './BestOfferSearching';
import { annotateGlossaryTerms } from './TermTooltip';
import type { Lang } from '../lib/types';

/** Anything a lead can be requested about — a catalog service or a hub guide. */
export interface LeadSource {
  id: string;
  title: string;
  category: string;
  /** 'direct' | 'partner' (catalog services) or 'guide' (hub self-help guides) */
  type: string;
}

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

/**
 * Preset problem chips — keys resolve under services.modal.problems.*
 * Scoped per service category so, e.g., a banking request never offers
 * "rejected residency renewal" and a residency request never offers
 * "bank account without residency". Categories with no entry here simply
 * skip the quick-chip row — the free-text field below still covers them.
 */
const PROBLEM_CHIPS_BY_CATEGORY: Partial<Record<string, readonly string[]>> = {
  residency: ['newResidency', 'rejectedRenewal', 'nufusAddress'],
  banking: ['bankAccount'],
};

export function ServiceRequestModal({ source, onClose }: { source: LeadSource; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const navigate = useNavigate();
  const lang = i18n.language;
  const serviceTitle = source.title;
  // A trusted-partner request from a logged-in customer is BROADCAST to matching
  // companies (they compete). Direct services / logged-out keep the classic flow.
  const broadcast = source.type === 'partner' && !!user;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [area, setArea] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  /** id of the row we just created — present only for signed-in customers */
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  /** Honeypot. Never shown, never focusable, never announced — only a bot fills it. */
  const [website, setWebsite] = useState('');
  /** Localised "in 2 minutes" while the client cooldown is blocking. */
  const [throttledWhen, setThrottledWhen] = useState<string | null>(null);
  /** The database trigger refused the insert (a real flood, or storage cleared). */
  const [rateLimited, setRateLimited] = useState(false);

  const problemChips = PROBLEM_CHIPS_BY_CATEGORY[source.category] ?? [];

  const phoneValid = isValidPhone(phone);
  const showPhoneError = phoneTouched && phone.trim().length > 0 && !phoneValid;
  const nameValid = isValidName(name);
  const showNameError = nameTouched && name.trim().length > 0 && !nameValid;

  const problemLabel = problem ? t(`services.modal.problems.${problem}`) : '';
  const fullMessage = [problemLabel, message.trim()].filter(Boolean).join(' — ');

  const waText = () =>
    `${t('services.modal.waIntro')}\n• ${t('services.modal.service')}: ${serviceTitle}\n• ${t('services.modal.name')}: ${name}\n• ${t('services.modal.phone')}: ${phone}${fullMessage ? `\n• ${t('services.modal.message')}: ${fullMessage}` : ''}`;

  const submit = async () => {
    if (!nameValid || !phoneValid) {
      setNameTouched(true);
      setPhoneTouched(true);
      return;
    }

    // Honeypot tripped. Show the bot exactly what a success looks like and
    // insert nothing — a visible rejection just teaches the next attempt which
    // field to leave alone.
    if (website.trim() !== '') {
      setDone(true);
      return;
    }

    // Client cooldown. Not security (it is the visitor's own localStorage), just
    // enough to stop double-taps and casual repeats before they reach the
    // database. Deliberately stricter than the server trigger, so a normal
    // browser meets this friendly message rather than a database exception.
    const verdict = checkSubmitThrottle();
    if (!verdict.allowed) {
      setThrottledWhen(relativeTime(new Date(Date.now() + verdict.retryInMs).toISOString(), lang));
      return;
    }

    setBusy(true);
    setError(false);
    setThrottledWhen(null);
    setRateLimited(false);
    try {
      const res = await serviceRequests.create({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        message: fullMessage || undefined,
        serviceId: source.id,
        serviceTitle,
        category: source.category,
        serviceType: source.type,
        lang,
        area: broadcast ? area || undefined : undefined,
        broadcast,
      });
      // Only a genuinely accepted insert counts against the cooldown.
      recordSubmit();
      track('request_submitted', {
        target: source.id,
        meta: { category: source.category, broadcast, request_id: res.id },
      });
      setRequestId(res.id);
      setDone(true);
      // NOTHING ELSE HAPPENS HERE — deliberately.
      //
      // This used to fire window.open() straight to wa.me, to guarantee the
      // admin heard about the request. It worked, and it cost us every customer.
      // On a phone that call is an app switch: the customer is thrown out of the
      // browser before the confirmation renders, so they never see the "track
      // your request" button, never learn /requests exists, and in at least one
      // reported case concluded the request had not been recorded at all.
      // Nobody who submitted a request had ever seen the screen that tells them
      // where it went.
      //
      // The trade is real and was made knowingly: the admin ping is now a button
      // the customer chooses after reading, not a redirect done to them. The
      // admin's safety net is the "needs action" queue at the top of /admin.
    } catch (e) {
      // The database trigger is distinguishable from a generic failure, so the
      // customer is told "we already have your request" rather than "something
      // went wrong" — which would invite the retry the limit is refusing.
      if (e instanceof ApiError && e.code === 'rate_limited') setRateLimited(true);
      else setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} labelId="service-request-title" mobileSheet>
      <div className="card overflow-hidden rounded-t-[28px] rounded-b-none max-h-[85vh] overflow-y-auto shadow-2xl md:rounded-card md:max-h-none md:shadow-card">
        <div className="bg-navy px-5 py-4 sticky top-0 z-10">
          <h2 id="service-request-title" className="text-white font-extrabold">
            {done ? t('services.modal.successTitle') : t('services.modal.title')}
          </h2>
        </div>
        <div className="p-5">
          {done && requestId ? (
            /* signed-in customer → full-screen "searching top offices" animation,
               then a success screen pointing them at the real /requests tracker */
            <BestOfferSearching
              serviceName={serviceTitle}
              onTrack={() => {
                onClose();
                navigate('/requests');
              }}
              onBack={onClose}
              // Peer to the track button, not a redirect. Null when the number
              // is unset or still the placeholder — we never build a wa.me link
              // from a missing number.
              waHref={WA_ENABLED ? `https://wa.me/${WA}?text=${encodeURIComponent(waText())}` : null}
              onWhatsApp={() => track('whatsapp_clicked', { target: 'service_request_modal' })}
            />
          ) : done ? (
            <div className="text-center">
              <div className="icon-chip mx-auto">
                <AppIcon name="check-circle" className="w-6 h-6" />
              </div>
              <p className="mt-4 text-sm text-gray-600">{t('services.modal.successBody')}</p>
              <p className="amber-note mt-3 inline-flex items-center gap-1.5 text-xs">
                <AppIcon name="clock" className="w-3.5 h-3.5 shrink-0" />
                {t('requests.reassurance.sla')}
              </p>
              {WA_ENABLED && (
                <a
                  href={`https://wa.me/${WA}?text=${encodeURIComponent(waText())}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => track('whatsapp_clicked', { target: 'service_request_modal' })}
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
                <p className="mt-1 text-sm font-semibold text-navy">
                  {annotateGlossaryTerms(serviceTitle, lang as Lang)}
                </p>
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
                <label className="text-xs font-semibold text-navy/70">
                  {t('services.modal.email')}
                  <input
                    className="input mt-1"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                    autoComplete="email"
                  />
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
                {problemChips.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-navy/70">{t('services.modal.problemLabel')}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {problemChips.map((id) => {
                      const selected = problem === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setProblem(selected ? null : id)}
                          aria-pressed={selected}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            selected
                              ? 'border-navy bg-navy text-white'
                              : 'border-navy/15 bg-cream text-navy/70 hover:border-navy/40'
                          }`}
                        >
                          {t(`services.modal.problems.${id}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                )}
                <label className="text-xs font-semibold text-navy/70">
                  {t('services.modal.problemDetailsLabel')}
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
              {/*
                Honeypot. Off-screen rather than display:none — plenty of form
                bots skip hidden inputs but happily fill one that is merely
                positioned away, and off-screen keeps it in the accessibility
                tree's reach so aria-hidden is doing real work rather than
                decorating an already-removed node. Never focusable (tabIndex
                -1), never announced (aria-hidden), never autofilled
                (autoComplete off), and excluded from the tab order, so no
                sighted, keyboard or screen-reader user can reach it.
              */}
              <div
                aria-hidden
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}
              >
                <label htmlFor="sr-website">Website</label>
                <input
                  id="sr-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              {throttledWhen && (
                <p role="status" className="mt-3 rounded-xl bg-brand-blue/60 px-3 py-2 text-sm text-navy">
                  {t('services.modal.throttled', { when: throttledWhen })}
                </p>
              )}
              {rateLimited && (
                <p role="status" className="mt-3 rounded-xl bg-brand-blue/60 px-3 py-2 text-sm text-navy">
                  {t('services.modal.rateLimited')}
                </p>
              )}

              <p className="mt-3 text-xs text-center text-navy/50">{t('services.modal.noAccountNote')}</p>
              <div className="sticky bottom-0 -mx-5 mt-5 bg-white px-5 pt-3 pb-1">
                <p className="rounded-full bg-brand-blue/60 px-3 py-1.5 text-center text-xs font-semibold text-navy">
                  {t('services.modal.reassurance')}
                </p>
                <div className="mt-2.5 flex gap-2">
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
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
