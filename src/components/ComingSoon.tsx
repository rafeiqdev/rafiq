import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppIcon, DirArrow } from './AppIcon';
import { TextAnimate } from './ui/text-animate';

/** Placeholder shown instead of a page that's still being built — swap back once it's ready. */
export function ComingSoon() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="card p-10">
        <div className="icon-chip mx-auto">
          <AppIcon name="construction" className="w-6 h-6" />
        </div>
        <TextAnimate as="h1" animation="blurIn" className="mt-4 text-xl font-extrabold text-navy">
          {t('tricks.comingSoonTitle')}
        </TextAnimate>
        <p className="mt-2 text-sm text-gray-500">{t('tricks.comingSoonBody')}</p>
        <Link to="/" className="btn-primary w-full mt-6">
          {t('tricks.comingSoonCta')}
          <DirArrow />
        </Link>
      </div>
    </div>
  );
}
