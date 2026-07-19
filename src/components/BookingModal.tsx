import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { bookings, profileApi, ApiError } from '../lib/api';
import { useApp } from '../context/AppContext';
import { LANGS } from '../lib/types';
import type { BookingMedia, ChatMessage, Lang } from '../lib/types';
import { Modal } from './Modal';
import { AppIcon } from './AppIcon';

/**
 * Minimal booking form: date & time + language (+ phone, if the account has none).
 * Problem summary, transcript, uploaded media and user identity are attached
 * automatically; past datetimes are blocked client-side (min) and server-side.
 */
export function BookingModal({
  problemSummary,
  caseFile,
  transcript,
  media = [],
  onBooked,
  onClose,
}: {
  problemSummary: string;
  /**
   * Structured intake record from the assistant. Appended to the summary at
   * submit time only — the user reads the prose, the team gets the fields.
   */
  caseFile?: Record<string, unknown>;
  transcript: ChatMessage[];
  media?: BookingMedia[];
  /** fired once the appointment is actually created, so the caller can close the topic */
  onBooked?: () => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const needsPhone = !user?.phone;
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [lang, setLang] = useState<Lang>((i18n.language as Lang) || 'en');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const isPast = !!date && !!time && new Date(`${date}T${time}`) <= new Date();
  const phoneOk = !needsPhone || phone.trim().length >= 6;

  const submit = async () => {
    if (!date || !time || isPast || !phoneOk) return;
    setBusy(true);
    setError(null);
    try {
      const trimmedPhone = phone.trim();
      // Attach the phone to the account too, so it is asked only once.
      if (needsPhone && trimmedPhone) {
        try {
          await profileApi.setPhone(trimmedPhone);
        } catch {
          /* non-fatal: still send it with the booking below */
        }
      }
      await bookings.create({
        problemSummary: caseFile
          ? `${problemSummary}\n\n--- ملف الطلب / CASE FILE ---\n${JSON.stringify(caseFile, null, 2)}`
          : problemSummary,
        transcript,
        preferredDatetime: `${date}T${time}`,
        preferredLanguage: lang,
        phone: trimmedPhone || user?.phone || null,
        media,
      });
      setDone(true);
      onBooked?.();
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'past_datetime' ? 'booking.errors.past' : 'common.error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} labelId="booking-title">
      <div className="card overflow-hidden">
        <div className="bg-navy px-5 py-4">
          <h2 id="booking-title" className="text-white font-extrabold">
            {done ? t('booking.success.title') : t('booking.title')}
          </h2>
        </div>
        <div className="p-5">
          {done ? (
            <div className="text-center">
              <div className="icon-chip mx-auto">
                <AppIcon name="check-circle" className="w-6 h-6" />
              </div>
              <p className="mt-4 text-sm text-gray-600">{t('booking.success.body')}</p>
              <button onClick={onClose} className="btn-primary w-full mt-6">
                {t('common.close')}
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-cream px-4 py-3">
                <p className="text-xs font-semibold text-navy/60">{t('booking.summaryLabel')}</p>
                <p className="mt-1 text-sm text-navy break-words">{problemSummary}</p>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-navy/70">
                  {t('booking.dateLabel')}
                  <input type="date" min={today} className="input mt-1 w-full min-w-0" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <label className="text-xs font-semibold text-navy/70">
                  {t('booking.timeLabel')}
                  <input type="time" className="input mt-1 w-full min-w-0" value={time} onChange={(e) => setTime(e.target.value)} />
                </label>
              </div>
              <label className="block mt-3 text-xs font-semibold text-navy/70">
                {t('booking.langLabel')}
                <select className="input mt-1" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
                  {LANGS.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.native}
                    </option>
                  ))}
                </select>
              </label>
              {needsPhone && (
                <label className="block mt-3 text-xs font-semibold text-navy/70">
                  {t('booking.phoneLabel')}
                  <input
                    type="tel"
                    dir="ltr"
                    inputMode="tel"
                    className="input mt-1 w-full min-w-0"
                    placeholder="+90 5xx xxx xx xx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
              )}
              {media.length > 0 && (
                <p className="mt-3 text-xs text-green-700 flex items-center gap-1.5">
                  <AppIcon name="paperclip" className="w-3.5 h-3.5 shrink-0" />
                  {t('booking.mediaAttached', { count: media.length })}
                </p>
              )}
              {(isPast || error) && (
                <p role="alert" className="amber-note mt-3 flex items-center gap-2">
                  <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
                  {t(isPast ? 'booking.errors.past' : (error ?? 'common.error'))}
                </p>
              )}
              <p className="mt-3 text-xs text-gray-500 flex items-center gap-1.5">
                <AppIcon name="paperclip" className="w-3.5 h-3.5 shrink-0" />
                {t('booking.attachedNote')}
              </p>
              <div className="mt-5 flex gap-2">
                <button onClick={onClose} className="btn-secondary flex-1 min-w-0">
                  {t('common.cancel')}
                </button>
                <button onClick={submit} disabled={busy || !date || !time || isPast || !phoneOk} className="btn-primary flex-1 min-w-0 disabled:opacity-50">
                  {t('booking.submit')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
