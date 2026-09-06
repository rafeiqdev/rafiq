import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';
import { LANGS } from '../lib/types';
import type { Lang } from '../lib/types';
import { AppIcon } from './AppIcon';

/** Header language switcher with listbox semantics, outside-click and Escape close.
 *  `chipSize` swaps the labelled pill for a square icon chip of that edge length —
 *  the shape NotificationBell draws, so the two sit side by side as siblings. */
export function LangSwitcher({ dropUp = false, chipSize }: { dropUp?: boolean; chipSize?: number }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGS.find((l) => l.code === i18n.language) ?? LANGS[1];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const chip = typeof chipSize === 'number';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={
          chip
            ? 'inline-flex shrink-0 items-center justify-center bg-navy-50 text-navy hover:bg-navy-100 transition-transform active:scale-95'
            : 'btn-secondary h-9 px-3 text-xs'
        }
        style={chip ? { width: chipSize, height: chipSize, borderRadius: chipSize / 3 } : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('common.language')}
      >
        <AppIcon name="globe" className={chip ? 'w-[18px] h-[18px]' : 'w-3.5 h-3.5'} />
        {!chip && <span className="hidden sm:inline">{current.native}</span>}
      </button>
      {open && (
        <ul
          className={`absolute end-0 w-36 card p-1 z-40 ${dropUp ? 'bottom-full mb-2' : 'mt-2'}`}
          role="listbox"
          aria-label={t('common.language')}
        >
          {LANGS.map((l) => (
            <li key={l.code} role="option" aria-selected={l.code === current.code}>
              <button
                dir={l.dir}
                className={`w-full text-start px-3 py-2 rounded-lg text-sm hover:bg-brand-blue ${
                  l.code === current.code ? 'font-bold text-navy' : 'text-navy/80'
                }`}
                onClick={async () => {
                  await setLanguage(l.code as Lang);
                  setOpen(false);
                }}
              >
                {l.native}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
