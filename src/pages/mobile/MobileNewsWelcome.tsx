import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { AppIcon } from '../../components/AppIcon';
import { Logo } from '../../components/Logo';

/**
 * First-run splash for the phone /news screen. Shown once per device on the very
 * first visit — a full-screen welcome over the feed with the Rafiq wordmark, a
 * short tagline, the 17+ / data-use notice, and a Continue button. Gated by a
 * localStorage flag in MobileNews so it never reappears after the reader
 * dismisses it. Links to the real /terms and /privacy pages.
 */
export function MobileNewsWelcome({ onContinue }: { onContinue: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white overflow-y-auto">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-7 pt-[calc(env(safe-area-inset-top)+28px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
        {/* wordmark — self-start stops the flex column from stretching the
            image to full width (which distorts the wordmark's aspect ratio) */}
        <Logo size={30} className="self-start" />

        {/* headline */}
        <h1 className="mt-8 text-[44px] font-extrabold leading-[1.05] tracking-tight">
          <span className="block text-black">{t('home.news.welcome.heading1')}</span>
          <span className="block text-navy">{t('home.news.welcome.heading2')}</span>
        </h1>

        {/* tagline */}
        <p className="mt-5 text-lg leading-relaxed text-gray-600">
          {t('home.news.welcome.tagline')}
        </p>

        {/* people glyph */}
        <div className="mt-auto pt-10">
          <AppIcon name="users" className="h-9 w-9 text-navy" />

          {/* legal + age notice */}
          <p className="mt-5 text-[15px] leading-relaxed text-gray-700">
            {t('home.news.welcome.legalPre')}
            <Link to="/terms" className="font-bold text-[#2f6fed] underline-offset-2 hover:underline">
              {t('home.news.welcome.termsLink')}
            </Link>
            {t('home.news.welcome.legalMid')}
            <Link to="/privacy" className="font-bold text-[#2f6fed] underline-offset-2 hover:underline">
              {t('home.news.welcome.privacyLink')}
            </Link>
            {t('home.news.welcome.legalPost')}
          </p>
          <p className="mt-3 text-[15px] font-bold text-navy">
            {t('home.news.welcome.ageNotice')}
          </p>

          {/* continue */}
          <button
            type="button"
            onClick={onContinue}
            className="mt-7 w-full rounded-full bg-navy py-4 text-lg font-bold text-white transition-transform active:scale-[0.98]"
          >
            {t('home.news.welcome.continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
