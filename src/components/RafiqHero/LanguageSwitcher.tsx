import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { LANGUAGES, type SupportedLanguage } from '@/i18n/types';
import { Globe } from 'lucide-react';

export interface LanguageSwitcherProps {
  className?: string;
  variant?: 'header' | 'mobile';
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  className = '',
  variant = 'header',
}) => {
  const { language, setLanguage, isRtl } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES[language] || LANGUAGES.ar;

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectLanguage = (code: SupportedLanguage) => {
    setLanguage(code);
    setIsOpen(false);
  };

  const languageList: SupportedLanguage[] = ['ar', 'en', 'fa', 'ru'];

  if (variant === 'mobile') {
    return (
      <div className={`flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#1A3A6B]/10 border border-[#EFEADB] ${className}`}>
        {languageList.map((code) => {
          const item = LANGUAGES[code];
          const isActive = language === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => setLanguage(code)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-[#1A3A6B] text-white shadow-sm'
                  : 'text-[#12294D] hover:bg-white/60'
              }`}
            >
              <span>{item.flag}</span>
              <span>{item.nativeName}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Same look as the language button in the normal site header: a small
          light-blue box (36px tall, 12px corners), globe + language name. */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Language selector: current is ${currentLang.name}`}
        className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-[#E8F0FB] hover:bg-[#D6E0EE] text-[#1A3A6B] text-xs font-semibold transition-colors duration-150 active:scale-97 cursor-pointer"
      >
        <Globe className="h-3.5 w-3.5 text-[#1A3A6B] shrink-0" aria-hidden="true" />
        <span className="font-semibold hidden sm:inline">{currentLang.nativeName}</span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Select website language"
          className={`absolute top-full mt-2 w-36 rounded-2xl bg-white border border-[#EFEADB] shadow-xl p-1 z-50 ${
            isRtl ? 'left-0 origin-top-left' : 'right-0 origin-top-right'
          }`}
        >
          <div className="space-y-0">
            {languageList.map((code) => {
              const item = LANGUAGES[code];
              const isActive = language === code;
              return (
                <button
                  key={code}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelectLanguage(code)}
                  className={`w-full flex items-center px-3 py-2 rounded-lg text-sm transition-colors duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-[#E8F0FB] text-[#1A3A6B] font-bold'
                      : 'text-[#1A3A6B]/80 hover:bg-[#E8F0FB] hover:text-[#1A3A6B]'
                  }`}
                >
                  <span>{item.nativeName}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
