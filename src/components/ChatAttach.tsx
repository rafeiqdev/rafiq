import { useTranslation } from 'react-i18next';
import type { BookingMedia } from '../lib/types';
import { AppIcon } from './AppIcon';

/** Upload limits / accepted kinds for intake attachments (photos, video, PDF). */
export const MAX_MEDIA_MB = 50;
export const ATTACH_ACCEPT = 'image/*,video/*,application/pdf';

/**
 * Does the assistant's message ask the user to attach a document? Used to pop a
 * clear attach prompt exactly when it is relevant (multi-language keywords).
 */
const MEDIA_HINT_RE =
  /جواز|إقامة|اقامة|وثيق|مرفق|أرفق|ارفق|صور|passport|document|photo|attach|upload|ikamet|residence|паспорт|документ|فایل|گذرنامه|مدرک|عکس|پاسپورت/i;

export function wantsMedia(text: string | undefined | null): boolean {
  return !!text && MEDIA_HINT_RE.test(text);
}

/**
 * Join file names the way the current language does ("a, b and c" / "أ، ب و ج").
 * Used to tell the assistant, in the transcript, exactly what was attached.
 */
export function formatFileList(names: string[], lang: string): string {
  // Intl.ListFormat is ES2021 and the project targets lower, so reach for it
  // defensively — every supported browser has it, older TS libs just don't type it.
  const LF = (Intl as unknown as { ListFormat?: new (l: string, o: object) => { format(v: string[]): string } })
    .ListFormat;
  try {
    if (LF) return new LF(lang, { style: 'short', type: 'conjunction' }).format(names);
  } catch {
    /* unsupported locale — fall through */
  }
  return names.join(', ');
}

function kindIcon(mime?: string): 'camera' | 'paperclip' | 'file-text' {
  if (mime?.startsWith('image/')) return 'camera';
  if (mime?.startsWith('video/')) return 'paperclip';
  return 'file-text';
}

/** Row of attached-file chips shown above the composer, each removable. */
export function MediaChips({ media, onRemove }: { media: BookingMedia[]; onRemove: (path: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="mt-3 flex flex-wrap gap-2" aria-label={t('chat.attached', { count: media.length })}>
      {media.map((m) => (
        <span key={m.path} className="inline-flex items-center gap-1.5 rounded-lg bg-cream px-2.5 py-1.5 text-xs text-navy max-w-[220px]">
          <AppIcon name={kindIcon(m.mime)} className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{m.name}</span>
          <button
            type="button"
            onClick={() => onRemove(m.path)}
            aria-label={t('common.delete')}
            className="shrink-0 text-navy/50 hover:text-brand-red font-bold leading-none px-1"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

/** Prominent "attach your documents" prompt, with an explicit Skip. */
export function AttachCard({ onAttach, onSkip, uploading }: { onAttach: () => void; onSkip: () => void; uploading: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="self-start w-full max-w-[85%] rounded-2xl border-2 border-dashed border-navy/25 bg-white p-4 text-center">
      <div className="icon-chip mx-auto">
        <AppIcon name="paperclip" className="w-5 h-5" />
      </div>
      <p className="mt-2 font-bold text-navy text-sm">{t('chat.attachCard.title')}</p>
      <p className="mt-1 text-xs text-gray-500">{t('chat.attachCard.body', { mb: MAX_MEDIA_MB })}</p>
      <div className="mt-3 flex gap-2">
        <button onClick={onSkip} className="btn-secondary flex-1 min-w-0 h-10 text-sm">
          {t('chat.attachCard.skip')}
        </button>
        <button onClick={onAttach} disabled={uploading} className="btn-primary flex-1 min-w-0 h-10 text-sm disabled:opacity-60">
          <AppIcon name={uploading ? 'hourglass' : 'paperclip'} className="w-4 h-4" />
          {uploading ? t('chat.attaching') : t('chat.attachCard.cta')}
        </button>
      </div>
    </div>
  );
}
