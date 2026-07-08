import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';
import { LANGS } from '../lib/types';
import type { Lang } from '../lib/types';
import { AppIcon } from './AppIcon';

/** Header language switcher with listbox semantics, outside-click and Escape close. */
export function LangSwitcher() {
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-secondary h-9 px-3 text-xs"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('common.language')}
      >
        <AppIcon name="globe" className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{current.native}</span>
      </button>
      {open && (
        <ul className="absolute end-0 mt-2 w-36 card p-1 z-40" role="listbox" aria-label={t('common.language')}>
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
