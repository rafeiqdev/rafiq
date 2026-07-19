import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { serviceRequests } from '../lib/api';
import { AppIcon, DirArrow } from '../components/AppIcon';

/** Admin WhatsApp number (digits only). Placeholder = "not configured". */
const WA = String(import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');
const WA_ENABLED = /^\d{8,15}$/.test(WA) && WA !== '905000000000';

/** How long the "broadcasting" animation plays before the waiting state. */
const BROADCAST_MS = 3800;
/** How often we re-check whether the admin marked the request ready. */
const POLL_MS = 8000;

type Phase = 'broadcasting' | 'waiting' | 'ready' | 'closed';

/** Three little office pins that light up one after another. */
function OfficePins() {
  return (
    <div className="mt-5 flex items-center justify-center gap-6" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="relative flex items-center justify-center">
          <span
            className="absolute inline-flex h-10 w-10 rounded-full bg-gold/40 animate-ping"
            style={{ animationDelay: `${i * 0.45}s`, animationDuration: '1.8s' }}
          />
          <span
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-navy text-white shadow-soft"
            style={{ animation: 'pulse 1.8s ease-in-out infinite', animationDelay: `${i * 0.45}s` }}
          >
            <AppIcon name="building" className="w-4 h-4" />
          </span>
        </span>
      ))}
    </div>
  );
}

export function RequestBroadcast({
  requestId,
  serviceTitle,
  onClose,
}: {
  /** null for anonymous submissions — the animation still plays, tracking can't. */
  requestId: string | null;
  serviceTitle: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('broadcasting');
  const [step, setStep] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  // ── phase 1: the broadcast animation ──────────────────────────────────────
  useEffect(() => {
    timers.current.push(window.setTimeout(() => setStep(1), 1100));
    timers.current.push(window.setTimeout(() => setStep(2), 2300));
    timers.current.push(window.setTimeout(() => setPhase('waiting'), BROADCAST_MS));
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  // ── phase 2: keep checking until the admin marks it ready ─────────────────
  useEffect(() => {
    if (phase !== 'waiting' || !requestId) return;
    let alive = true;

    const check = async () => {
      const res = await serviceRequests.status(requestId);
      if (!alive || !res) return;
      if (res.status === 'accepted' || res.status === 'done') {
        setNote(res.adminNote);
        setPhase('ready');
      } else if (res.status === 'rejected') {
        setNote(res.adminNote);
        setPhase('closed');
      }
    };

    check();
    const id = window.setInterval(check, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [phase, requestId]);

  const waHref = WA_ENABLED
    ? `https://wa.me/${WA}?text=${encodeURIComponent(`${t('requestFlow.ready')} — ${serviceTitle}`)}`
    : null;

  // ── ready ─────────────────────────────────────────────────────────────────
  if (phase === 'ready') {
    return (
      <div className="py-2 text-center" role="status">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700 animate-pop">
          <AppIcon name="check-circle" className="h-8 w-8" />
        </span>
        <h2 className="mt-4 text-lg font-extrabold text-navy">{t('requestFlow.ready')}</h2>
        <p className="mt-1 text-sm text-gray-500">{note?.trim() || t('requestFlow.readySub')}</p>
        {waHref ? (
          <a href={waHref} target="_blank" rel="noreferrer" className="btn-primary w-full mt-5 min-h-[48px]">
            <AppIcon name="message-circle" className="h-4 w-4" />
            {t('requestFlow.openNow')}
          </a>
        ) : (
          <Link to="/requests" className="btn-primary w-full mt-5 min-h-[48px]">
            {t('requestFlow.openNow')}
            <DirArrow />
          </Link>
        )}
        <button onClick={onClose} className="btn-secondary w-full mt-2 min-h-[44px]">
          {t('common.close')}
        </button>
      </div>
    );
  }

  // ── closed ────────────────────────────────────────────────────────────────
  if (phase === 'closed') {
    return (
      <div className="py-2 text-center" role="status">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cream-dark text-navy/60">
          <AppIcon name="x-circle" className="h-7 w-7" />
        </span>
        <h2 className="mt-4 font-extrabold text-navy">{t('requestFlow.rejected')}</h2>
        <p className="mt-1 text-sm text-gray-500">{note?.trim() || t('requestFlow.rejectedSub')}</p>
        <button onClick={onClose} className="btn-secondary w-full mt-5 min-h-[44px]">
          {t('common.close')}
        </button>
      </div>
    );
  }

  // ── broadcasting / waiting ────────────────────────────────────────────────
  const broadcasting = phase === 'broadcasting';
  return (
    <div className="py-2 text-center" role="status" aria-live="polite">
      {broadcasting ? (
        <>
          <OfficePins />
          <h2 className="mt-6 text-base font-extrabold leading-relaxed text-navy">
            {t('requestFlow.broadcasting')}
          </h2>
          <p className="mt-2 text-sm text-gray-500">{t('requestFlow.broadcastingSub')}</p>

          {/* three steps lighting up in sequence */}
          <ul className="mt-5 flex flex-col gap-2 text-start">
            {(['sent', 'matching', 'offers'] as const).map((key, i) => {
              const active = i <= step;
              return (
                <li
                  key={key}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-all duration-500 ${
                    active ? 'border-navy/30 bg-brand-blue text-navy' : 'border-cream-dark text-navy/40'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full ${
                      active ? 'bg-navy text-white' : 'bg-cream-dark text-transparent'
                    }`}
                  >
                    <AppIcon name="check" className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-semibold">{t(`requestFlow.steps.${key}`)}</span>
                  {i === step && (
                    <span className="ms-auto h-4 w-4 rounded-full border-2 border-navy/30 border-t-navy animate-spin" />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <>
          <span className="mx-auto flex h-16 w-16 items-center justify-center">
            <span className="h-12 w-12 rounded-full border-4 border-cream-dark border-t-navy animate-spin" />
          </span>
          <h2 className="mt-5 text-lg font-extrabold text-navy">{t('requestFlow.waiting')}</h2>
          <p className="mt-1 text-sm text-gray-500">{t('requestFlow.waitingSub')}</p>
          <p className="mt-3 rounded-xl bg-cream px-3 py-2 text-xs font-semibold text-navy/70">{serviceTitle}</p>
          <button onClick={onClose} className="btn-secondary w-full mt-5 min-h-[44px]">
            {t('common.close')}
          </button>
        </>
      )}
    </div>
  );
}
