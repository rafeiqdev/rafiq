import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { LANGUAGES, type SupportedLanguage } from '@/i18n/types';
import { Globe, ChevronDown, Check } from 'lucide-react';

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
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Language selector: current is ${currentLang.name}`}
        className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full border border-[#D5E2F3] bg-white/90 hover:bg-white text-[#1A3A6B] text-xs sm:text-sm font-bold shadow-xs hover:shadow-md transition-all duration-200 backdrop-blur-sm active:scale-97 cursor-pointer"
      >
        <Globe className="h-3.5 w-3.5 text-[#1A3A6B] shrink-0" aria-hidden="true" />
        <span className="text-sm shrink-0">{currentLang.flag}</span>
        <span className="font-bold tracking-tight hidden sm:inline">{currentLang.nativeName}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#1A3A6B]/70 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Select website language"
          className={`absolute top-full mt-2 w-44 rounded-2xl bg-white border border-[#E2D9C5] shadow-2xl p-1.5 z-50 transition-all duration-200 backdrop-blur-md animate-in fade-in-50 zoom-in-95 ${
            isRtl ? 'left-0 origin-top-left' : 'right-0 origin-top-right'
          }`}
        >
          <div className="px-2.5 py-1.5 mb-1 text-[11px] font-extrabold text-[#4A5F7D] uppercase tracking-wider border-b border-[#EFEADB]">
            {isRtl ? 'اختر اللغة' : language === 'ru' ? 'Выберите язык' : 'Select Language'}
          </div>

          <div className="space-y-1">
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
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-[#E8F0FB] text-[#1A3A6B] font-black'
                      : 'text-[#12294D] hover:bg-[#FAF8F0] hover:text-[#1A3A6B]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{item.flag}</span>
                    <span>{item.nativeName}</span>
                  </div>
                  {isActive && (
                    <Check className="h-4 w-4 text-[#1A3A6B] stroke-[2.5]" aria-hidden="true" />
                  )}
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
