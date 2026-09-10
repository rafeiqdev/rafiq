import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { serviceRequests, ApiError } from '../lib/api';
import { checkSubmitThrottle, recordSubmit } from '../lib/submitThrottle';
import { track } from '../lib/analytics';
import { relativeTime } from '../lib/relativeTime';
import { ISTANBUL_AREAS, pickArea } from '../data/istanbulAreas';
import { useApp } from '../context/AppContext';
import { Modal } from './Modal';
import { AppIcon } from './AppIcon';
import type { IconName } from './AppIcon';
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
/** "Ahmet Yilmaz" → "Ahmet" — what a friend would call you. */
function firstName(full: string | null | undefined): string {
  return (full ?? '').trim().split(/\s+/)[0] ?? '';
}

/**
 * Situation chips — keys resolve under services.modal.problems.*
 *
 * Scoped per SERVICE ID, and phrased as the visitor's SITUATION rather than a
 * restatement of the service: on "Property residency" the old chip
 * "New residency application" only repeated the title of the thing they had
 * just clicked, which read as a glitch. Each chip now adds information the
 * title does not carry (first time vs renewal vs refused…). Services with no
 * entry skip the row — the free-text field below still covers them.
 */
const PROBLEM_CHIPS_BY_SERVICE_ID: Partial<Record<string, readonly string[]>> = {
  'res-tourist': ['firstTime', 'renewal', 'rejected', 'nufusAddress'],
  'res-property': ['firstTime', 'renewal', 'rejected', 'nufusAddress'],
  'res-work': ['firstTime', 'renewal', 'rejected'],
  'res-student': ['firstTime', 'renewal', 'rejected', 'nufusAddress'],
  'res-family': ['firstTime', 'renewal', 'rejected'],
  'res-renew': ['expiringSoon', 'expired', 'rejected'],
  'res-rejected': ['appeal', 'reapply'],
  'bank-account': ['noResidency', 'withResidency'],
};

const CHIP_ICON: Record<string, IconName> = {
  firstTime: 'sparkles',
  renewal: 'history',
  rejected: 'alert-triangle',
  nufusAddress: 'home',
  expiringSoon: 'clock',
  expired: 'hourglass',
  appeal: 'scale',
  reapply: 'file-text',
  noResidency: 'landmark',
  withResidency: 'file-check',
};

const EASE = [0.22, 1, 0.36, 1] as const;

export function ServiceRequestModal({ source, onClose }: { source: LeadSource; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const lang = i18n.language;
  const serviceTitle = source.title;
  // A trusted-partner request from a logged-in customer is BROADCAST to matching
  // companies (they compete). Direct services / logged-out keep the classic flow.
  const broadcast = source.type === 'partner' && !!user;

  // Pre-filled from the account so a signed-in customer never retypes what we
  // already know. Still editable — the pencil below opens the fields again.
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
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
  /** The customer chose to change the pre-filled name / phone. */
  const [editingIdentity, setEditingIdentity] = useState(false);

  const problemChips = PROBLEM_CHIPS_BY_SERVICE_ID[source.id] ?? [];

  const phoneValid = isValidPhone(phone);
  const showPhoneError = phoneTouched && phone.trim().length > 0 && !phoneValid;
  const nameValid = isValidName(name);
  const showNameError = nameTouched && name.trim().length > 0 && !nameValid;

  // Both known and valid from the account → show a one-line summary instead of
  // two inputs. Anything missing (typically the phone) keeps the fields open.
  const identityKnown = !!user && isValidName(user.name ?? '') && isValidPhone(user.phone ?? '');
  const showIdentityFields = !identityKnown || editingIdentity;
  const greetingName = firstName(user?.name);

  const problemLabel = problem ? t(`services.modal.problems.${problem}`) : '';
  const fullMessage = [problemLabel, message.trim()].filter(Boolean).join(' — ');

  const waText = () =>
    `${t('services.modal.waIntro')}\n• ${t('services.modal.service')}: ${serviceTitle}\n• ${t('services.modal.name')}: ${name}\n• ${t('services.modal.phone')}: ${phone}${fullMessage ? `\n• ${t('services.modal.message')}: ${fullMessage}` : ''}`;

  const submit = async () => {
    if (!nameValid || !phoneValid) {
      setNameTouched(true);
      setPhoneTouched(true);
      setEditingIdentity(true);
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

  // ── motion ────────────────────────────────────────────────────────────
  // One gentle rise per section, staggered, so the form "settles" into place
  // after the panel pops in. Off entirely when the OS asks for less motion.
  const list = {
    hidden: {},
    show: { transition: reduceMotion ? {} : { staggerChildren: 0.05, delayChildren: 0.08 } },
  };
  const item = {
    hidden: reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE } },
  };
  const grow = {
    initial: reduceMotion ? { opacity: 1 } : { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto', transition: { duration: 0.28, ease: EASE } },
    exit: reduceMotion ? { opacity: 1 } : { opacity: 0, height: 0, transition: { duration: 0.2, ease: EASE } },
  };
  const hoverLift = reduceMotion ? undefined : { y: -1 };
  const tap = reduceMotion ? undefined : { scale: 0.97 };

  const fieldLabel = 'text-xs font-semibold text-navy/70';
  const inputCls = (bad: boolean) =>
    `input mt-1 transition-[border-color,box-shadow] hover:border-navy/40 ${bad ? 'border-brand-red ring-1 ring-brand-red' : ''}`;

  return (
    <Modal onClose={onClose} labelId="service-request-title" mobileSheet>
      <div className="card overflow-hidden rounded-t-[28px] rounded-b-none max-h-[85vh] overflow-y-auto shadow-2xl md:rounded-card md:max-h-none md:shadow-card">
        {/* Header: title + one warm line. The greeting uses the first name when
            we have it; the "no account needed" reassurance only shows to
            visitors who actually have no account. */}
        <div className="sticky top-0 z-10 bg-gradient-to-br from-navy to-navy-light px-5 py-4 text-white">
          <div className="flex items-center gap-3 pe-8">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
              <AppIcon name={done ? 'check-circle' : 'send'} className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <h2 id="service-request-title" className="font-extrabold leading-tight">
                {done ? t('services.modal.successTitle') : t('services.modal.title')}
              </h2>
              {!done && (
                <p className="mt-0.5 truncate text-xs text-white/75">
                  {greetingName
                    ? t('services.modal.greeting', { name: greetingName })
                    : t('services.modal.noAccountNote')}
                </p>
              )}
            </div>
          </div>
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
            <motion.div
              className="text-center"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <motion.div
                className="icon-chip mx-auto"
                initial={reduceMotion ? false : { scale: 0.6 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.1 }}
              >
                <AppIcon name="check-circle" className="w-6 h-6" />
              </motion.div>
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
            </motion.div>
          ) : (
            <motion.div variants={list} initial="hidden" animate="show" className="flex flex-col gap-4">
              {/* The service being requested */}
              <motion.div variants={item} className="flex items-center gap-3 rounded-xl bg-cream px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy">
                  <AppIcon name="sparkles" className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-navy/60">{t('services.modal.service')}</p>
                  <p className="text-sm font-bold text-navy">{annotateGlossaryTerms(serviceTitle, lang as Lang)}</p>
                </div>
              </motion.div>

              {/* Who you are: a summary line when the account already tells us,
                  the two fields otherwise (or after tapping the pencil). */}
              <motion.div variants={item}>
                <AnimatePresence initial={false} mode="wait">
                  {showIdentityFields ? (
                    <motion.div key="fields" {...grow} className="overflow-hidden">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className={fieldLabel}>
                          {t('services.modal.name')}
                          <input
                            className={inputCls(showNameError)}
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
                        <label className={fieldLabel}>
                          {t('services.modal.phone')}
                          <input
                            className={inputCls(showPhoneError)}
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
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="summary" {...grow} className="overflow-hidden">
                      <div className="flex items-center gap-3 rounded-xl border border-cream-dark px-3 py-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold uppercase text-white">
                          {greetingName.charAt(0)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-navy">{name}</p>
                          <p className="truncate text-xs text-navy/60" dir="ltr">
                            {phone}
                          </p>
                        </div>
                        <motion.button
                          type="button"
                          onClick={() => setEditingIdentity(true)}
                          whileHover={hoverLift}
                          whileTap={tap}
                          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-cream px-3 text-xs font-semibold text-navy transition-colors hover:bg-cream-dark"
                        >
                          <AppIcon name="pencil" className="h-3.5 w-3.5" />
                          {t('common.edit')}
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {broadcast && (
                <motion.label variants={item} className={fieldLabel}>
                  {t('services.modal.area')}
                  <select className={inputCls(false)} value={area} onChange={(e) => setArea(e.target.value)}>
                    <option value="">{t('services.modal.areaPlaceholder')}</option>
                    {ISTANBUL_AREAS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {pickArea(a.id, lang)}
                      </option>
                    ))}
                  </select>
                </motion.label>
              )}

              {/* Situation chips: tap one, tap again to clear. Each carries an
                  icon and says something the service title does not. */}
              {problemChips.length > 0 && (
                <motion.div variants={item}>
                  <p className={fieldLabel}>{t('services.modal.problemLabel')}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {problemChips.map((id) => {
                      const selected = problem === id;
                      return (
                        <motion.button
                          key={id}
                          type="button"
                          onClick={() => setProblem(selected ? null : id)}
                          aria-pressed={selected}
                          whileHover={hoverLift}
                          whileTap={tap}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-[background-color,border-color,color,box-shadow] duration-200 ${
                            selected
                              ? 'border-navy bg-navy text-white shadow-md shadow-navy/20'
                              : 'border-navy/15 bg-cream text-navy/75 hover:border-navy/40 hover:bg-white'
                          }`}
                        >
                          <AppIcon
                            name={selected ? 'check' : CHIP_ICON[id] ?? 'circle'}
                            className="h-3.5 w-3.5 shrink-0"
                          />
                          {t(`services.modal.problems.${id}`)}
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              <motion.label variants={item} className={fieldLabel}>
                {t('services.modal.problemDetailsLabel')}
                <textarea
                  className={`${inputCls(false)} min-h-[88px] py-2`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('services.modal.messagePlaceholder')}
                />
              </motion.label>

              {broadcast && (
                <p className="amber-note flex items-center gap-2 text-xs">
                  <AppIcon name="users" className="w-4 h-4 shrink-0" />
                  {t('services.modal.broadcastNote')}
                </p>
              )}
              {error && (
                <p role="alert" className="amber-note flex items-center gap-2">
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
                <p role="status" className="rounded-xl bg-brand-blue/60 px-3 py-2 text-sm text-navy">
                  {t('services.modal.throttled', { when: throttledWhen })}
                </p>
              )}
              {rateLimited && (
                <p role="status" className="rounded-xl bg-brand-blue/60 px-3 py-2 text-sm text-navy">
                  {t('services.modal.rateLimited')}
                </p>
              )}

              <motion.div variants={item} className="sticky bottom-0 -mx-5 -mb-5 bg-white px-5 pb-5 pt-3">
                <p className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-navy/70">
                  <AppIcon name="shield" className="h-3.5 w-3.5 shrink-0" />
                  {t('services.modal.reassurance')}
                </p>
                <div className="mt-3 flex gap-2">
                  <button onClick={onClose} className="btn-secondary flex-1">
                    {t('common.cancel')}
                  </button>
                  <motion.button
                    onClick={submit}
                    disabled={busy || !nameValid || !phoneValid}
                    whileTap={tap}
                    className="btn-primary flex-1 disabled:opacity-50"
                  >
                    {busy ? (
                      t('services.modal.sending')
                    ) : (
                      <>
                        <AppIcon name="send" className="h-4 w-4" />
                        {t('services.modal.send')}
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>
    </Modal>
  );
}
