import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { bookings, ApiError } from '../lib/api';
import { LANGS } from '../lib/types';
import type { ChatMessage, Lang } from '../lib/types';
import { Modal } from './Modal';
import { AppIcon } from './AppIcon';

/**
 * Minimal booking form: date & time + language only.
 * Problem summary, transcript and user identity are attached automatically;
 * past datetimes are blocked client-side (min) and rejected server-side.
 */
export function BookingModal({
  problemSummary,
  transcript,
  onClose,
}: {
  problemSummary: string;
  transcript: ChatMessage[];
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [lang, setLang] = useState<Lang>((i18n.language as Lang) || 'en');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const isPast = !!date && !!time && new Date(`${date}T${time}`) <= new Date();

  const submit = async () => {
    if (!date || !time || isPast) return;
    setBusy(true);
    setError(null);
    try {
      await bookings.create({
        problemSummary,
        transcript,
        preferredDatetime: `${date}T${time}`,
        preferredLanguage: lang,
      });
      setDone(true);
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
                <button onClick={submit} disabled={busy || !date || !time || isPast} className="btn-primary flex-1 min-w-0 disabled:opacity-50">
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
