import React, { useState, useEffect, useRef } from 'react';

export type AppLanguage = 'en' | 'ar' | 'ru' | 'fa';

interface KineticHeaderProps {
  language?: AppLanguage;
  customColor?: string;
}

/**
 * Concise Rafiq brand phrases for Istanbul/Turkey expats & travelers.
 * Kept short (single line, no wrapping) across all four languages.
 */
const RAFIQ_PHRASES: Record<AppLanguage, string[]> = {
  en: [
    'Your Istanbul companion',
    'Explore Turkey with Rafiq',
    'Simplify your stay',
    'Your journey starts here',
  ],
  ar: [
    'رفيقك في إسطنبول',
    'اكتشف تركيا مع رفيق',
    'كل خدماتك في مكان واحد',
    'رحلتك تبدأ مع رفيق',
  ],
  ru: [
    'Ваш гид в Стамбуле',
    'Откройте Турцию с Rafiq',
    'Все сервисы в одном месте',
    'Ваш надежный спутник',
  ],
  fa: [
    'همراه شما در استانبول',
    'کشف ترکیه با رفیق',
    'خدمات آسان در استانبول',
    'آغاز سفر شما با رفیق',
  ],
};

export const KineticHeader: React.FC<KineticHeaderProps> = ({
  language = 'en',
  customColor = '#09245E',
}) => {
  const phrases = RAFIQ_PHRASES[language] || RAFIQ_PHRASES.en;

  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charCount, setCharCount] = useState(1);
  const [isErasing, setIsErasing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentFullText = phrases[phraseIndex] || phrases[0];
  const isRtl = language === 'ar' || language === 'fa';

  useEffect(() => {
    setPhraseIndex(0);
    setCharCount(1);
    setIsErasing(false);
    setIsPaused(false);
  }, [language]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    if (isPaused) {
      timeout = setTimeout(() => {
        setIsPaused(false);
        setIsErasing(true);
      }, 1900);
      return () => clearTimeout(timeout);
    }

    if (isErasing) {
      if (charCount > 1) {
        timeout = setTimeout(() => setCharCount((prev) => prev - 1), 30);
      } else {
        timeout = setTimeout(() => {
          setIsErasing(false);
          setPhraseIndex((prev) => (prev + 1) % phrases.length);
          setCharCount(1);
        }, 220);
      }
    } else if (charCount < currentFullText.length) {
      const nextChar = currentFullText[charCount];
      const delay = nextChar === ' ' ? 95 : 65;
      timeout = setTimeout(() => setCharCount((prev) => prev + 1), delay);
    } else {
      setIsPaused(true);
    }

    return () => clearTimeout(timeout);
  }, [charCount, isErasing, isPaused, currentFullText, phrases.length]);

  // Responsive hero size: scales with viewport width (bigger on large phones,
  // smaller on small ones) via vw, clamped so it never gets tiny or overflows
  // the single line. Arabic/Persian kept slightly shorter in rem — the script
  // sits taller — while still landing noticeably larger than before.
  const headlineFontSize = isRtl
    ? 'clamp(1.3rem, 6vw, 1.95rem)'
    : 'clamp(1.35rem, 6.4vw, 2.05rem)';

  const fontFamily =
    language === 'ar'
      ? 'var(--font-arabic)'
      : language === 'fa'
      ? 'var(--font-persian)'
      : language === 'ru'
      ? 'var(--font-russian)'
      : 'var(--font-english)';

  const displayedSlice = currentFullText.slice(0, charCount);

  return (
    <div
      ref={containerRef}
      className="kinetic-header-container"
      style={{
        width: '100%',
        maxWidth: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0 18px',
        boxSizing: 'border-box',
        direction: isRtl ? 'rtl' : 'ltr',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          whiteSpace: 'nowrap',
          flexWrap: 'nowrap',
          maxWidth: '100%',
        }}
      >
        <span
          className="optical-headline"
          style={{
            fontSize: headlineFontSize,
            fontWeight: 700,
            color: customColor,
            fontFamily,
            lineHeight: 1.25,
            letterSpacing: isRtl ? '0' : '-0.022em',
            verticalAlign: 'middle',
            transition: 'color 0.2s ease, font-size 0.2s ease',
            whiteSpace: 'nowrap',
            display: 'inline-block',
            textRendering: 'optimizeLegibility',
          }}
        >
          {displayedSlice}
        </span>

        <span
          aria-hidden="true"
          className={`kinetic-cursor-dot ${!isErasing && isPaused ? 'kinetic-dot-pulse' : ''}`}
          style={{
            width: isRtl ? '13px' : '14px',
            height: isRtl ? '13px' : '14px',
            borderRadius: '50%',
            backgroundColor: customColor,
            marginInlineStart: '8px',
            flexShrink: 0,
            transform: isErasing
              ? 'scale(0.82) rotate(-8deg)'
              : !isPaused
              ? 'scale(1.08, 0.94)'
              : 'scale(1)',
            boxShadow: `0 2px 8px ${customColor}40`,
          }}
        />
      </div>
    </div>
  );
};
