import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { bookings } from '../lib/api';
import type { Booking, BookingStatus } from '../lib/types';
import { LANGS } from '../lib/types';
import { RequireAdmin } from '../components/Gates';
import { AppIcon } from '../components/AppIcon';
import { SectionState } from '../components/SectionState';
import { useAsyncSection } from '../hooks/useAsyncSection';

const STATUSES: BookingStatus[] = ['new', 'confirmed', 'done', 'cancelled'];

function Row({ booking, onChanged }: { booking: Booking; onChanged: () => void }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(booking.internalNote ?? '');
  const lang = LANGS.find((l) => l.code === booking.preferredLanguage);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-navy text-sm break-all">{booking.userEmail}</p>
          <p className="mt-1 text-sm text-navy/80 break-words">{booking.problemSummary}</p>
          <p className="mt-1 text-xs text-gray-500 break-words">
            {t('adminBookings.datetime')}: {new Date(booking.preferredDatetime).toLocaleString(i18n.language)} ·{' '}
            {t('adminBookings.language')}: {lang?.native ?? booking.preferredLanguage}
          </p>
          {booking.phone && (
            <p className="mt-1 text-xs text-navy/80 break-all">
              <span className="font-semibold">{t('adminBookings.phone')}:</span>{' '}
              <a href={`tel:${booking.phone}`} className="underline" dir="ltr">{booking.phone}</a>
            </p>
          )}
        </div>
        <select
          className="input !h-9 !w-auto text-xs"
          value={booking.status}
          onChange={async (e) => {
            await bookings.setStatus(booking.id, e.target.value as BookingStatus);
            onChanged();
          }}
          aria-label={t('common.status')}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`adminBookings.statuses.${s}`)}
            </option>
          ))}
        </select>
      </div>

      {booking.media && booking.media.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-navy/60">{t('adminBookings.media', { count: booking.media.length })}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {booking.media.map((file) => (
              <button
                key={file.path}
                onClick={async () => {
                  const url = await bookings.mediaUrl(file.path);
                  if (url) window.open(url, '_blank', 'noopener');
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cream px-2.5 py-1.5 text-xs text-navy hover:bg-cream-dark max-w-[220px]"
                title={file.name}
              >
                <AppIcon name="paperclip" className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{file.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => setOpen((v) => !v)} className="btn-secondary h-9 px-3 text-xs mt-3">
        <AppIcon name="message-circle" className="w-3.5 h-3.5" />
        {open ? t('adminBookings.hideTranscript') : t('adminBookings.transcript')}
      </button>

      {open && (
        <div className="mt-3 rounded-xl bg-cream p-3 max-h-64 overflow-y-auto flex flex-col gap-2">
          {booking.transcript.map((m, i) => (
            <div
              key={i}
              className={
                m.role === 'user'
                  ? 'self-end max-w-[85%] rounded-xl bg-navy px-3 py-2 text-xs text-white break-anywhere'
                  : 'self-start max-w-[85%] rounded-xl bg-white px-3 py-2 text-xs text-navy break-anywhere'
              }
            >
              {m.text}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <input
          className="input !h-9 text-xs flex-1 min-w-0"
          placeholder={t('adminBookings.notePlaceholder')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          className="btn-primary h-9 px-3 text-xs shrink-0"
          onClick={async () => {
            await bookings.setNote(booking.id, note);
            onChanged();
          }}
        >
          {t('adminBookings.saveNote')}
        </button>
      </div>
    </div>
  );
}

function AdminBookingsInner() {
  const { t } = useTranslation();
  // Error is a state — a failed load must not read as "no bookings". A booked
  // appointment nobody shows up to is a real person waiting at a time we chose.
  const section = useAsyncSection<Booking[]>(() => bookings.adminList(), []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-extrabold text-navy">{t('adminBookings.title')}</h1>
      <SectionState
        section={section}
        title={t('adminBookings.title')}
        empty={
          <div className="card p-10 mt-6 text-center">
            <div className="icon-chip mx-auto">
              <AppIcon name="calendar" className="w-6 h-6" />
            </div>
            <p className="mt-4 text-sm text-gray-500">{t('adminBookings.empty')}</p>
          </div>
        }
      >
        {(list) => (
          <div className="mt-6 flex flex-col gap-4">
            {list.map((b) => (
              <Row key={b.id} booking={b} onChanged={section.reload} />
            ))}
          </div>
        )}
      </SectionState>
    </div>
  );
}

export function AdminBookings() {
  return (
    <RequireAdmin>
      <AdminBookingsInner />
    </RequireAdmin>
  );
}
