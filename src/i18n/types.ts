export type SupportedLanguage = 'ar' | 'en' | 'fa' | 'ru';

export type TextDirection = 'rtl' | 'ltr';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
  dir: TextDirection;
}

export const LANGUAGES: Record<SupportedLanguage, LanguageInfo> = {
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    dir: 'rtl',
  },
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
    dir: 'ltr',
  },
  fa: {
    code: 'fa',
    name: 'Persian',
    nativeName: 'فارسی',
    flag: '🇮🇷',
    dir: 'rtl',
  },
  ru: {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    flag: '🇷🇺',
    dir: 'ltr',
  },
};

export interface Translations {
  common: {
    brandName: string;
    tagline: string;
    verifiedPartner: string;
    directRafiqService: string;
    requestService: string;
    exploreAllServices: string;
    contactUs: string;
    signIn: string;
    login: string;
    talkToRafiq: string;
    getStarted: string;
    allRightsReserved: string;
    switchLanguage: string;
    home: string;
    faq: string;
    solutions: string;
    helpCenter: string;
    whyStartWithRafiq: string;
  };
  nav: {
    home: string;
    services: string;
    cityGuide: string;
    aiConcierge: string;
    featuredServicesTitle: string;
    subItems: {
      allServices: { label: string; desc: string };
      guide: { label: string; desc: string };
      residence: { label: string; desc: string };
      realEstate: { label: string; desc: string };
      health: { label: string; desc: string };
      referral: { label: string; desc: string };
    };
  };
  hero: {
    headlineWords: string[];
    supportingText: string;
    primaryCta: string;
    secondaryCta: string;
  };
  logoCloud: {
    badge: string;
    heading: string;
  };
  howItWorks: {
    eyebrow: string;
    heading: string;
    description: string;
    steps: Array<{
      stepNumber: string;
      title: string;
      description: string;
      benefits: string[];
    }>;
  };
  servicesCarousel: {
    eyebrow: string;
    heading: string;
    description: string;
    label: string;
    services: Array<{
      id: string;
      title: string;
      category: string;
      badge: string;
      badgeType: 'partner' | 'direct';
      description: string;
      alt: string;
    }>;
  };
  connection: {
    eyebrow: string;
    title: string;
    description: string;
    pillLabel: string;
    needs: string[];
    outcomes: string[];
    ctaHeading: string;
    ctaDescription: string;
    primaryCta: string;
    secondaryCta: string;
  };
  faq: {
    eyebrow: string;
    title: string;
    subtitle: string;
    verifiedAnswerLabel: string;
    row1Title: string;
    row2Title: string;
    row1: Array<{ id: number; category: string; question: string; answer: string }>;
    row2: Array<{ id: number; category: string; question: string; answer: string }>;
  };
  cta: {
    badge: string;
    title: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
    features: string[];
  };
  marquee: {
    row1: string[];
    row2: string[];
  };
}
