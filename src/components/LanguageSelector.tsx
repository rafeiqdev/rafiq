import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';
import { LANGS } from '../lib/types';
import type { Lang } from '../lib/types';
import { useApp } from '../context/AppContext';
import { Logo } from './Logo';

/** Full-screen first-load language picker. */
export function LanguageSelector() {
  const { t } = useTranslation();
  const { setLangSelected } = useApp();

  const pick = async (code: Lang) => {
    await setLanguage(code);
    setLangSelected(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-navy px-6">
      <Logo size={84} variant="white" />
      <h1 className="mt-6 text-3xl font-extrabold text-white text-center">{t('langSelect.title')}</h1>
      <p className="mt-2 text-white/70 text-center">{t('langSelect.subtitle')}</p>
      <div className="mt-10 grid grid-cols-2 gap-4 w-full max-w-md">
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => pick(l.code)}
            className="card card-hover flex items-center justify-center text-center h-20 text-xl font-bold text-navy hover:bg-cream"
            style={{ lineHeight: 1.2 }}
          >
            {/* fixed dir so Arabic/Farsi and Latin labels align + space identically */}
            <span dir="ltr">{l.native}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
