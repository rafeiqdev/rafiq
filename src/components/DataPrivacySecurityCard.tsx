import { useTranslation } from 'react-i18next';
import { AppIcon } from './AppIcon';

/**
 * Reassures a logged-in user that documents in their locker (passport, TC
 * number, tax number) are stored securely and used only for official
 * transaction processing. One component for desktop (ProfilePage) and
 * mobile (MobileProfilePage) so the copy cannot drift, as with ActivityCard.
 */
export function DataPrivacySecurityCard({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();

  return (
    <div className={compact ? 'card animate-fade-up p-5' : 'card p-5 sm:p-6'}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy">
          <AppIcon name="shield-check" className="h-5 w-5" />
        </span>
        <h2 className={compact ? 'text-[15px] font-extrabold text-navy' : 'font-bold text-navy'}>
          {t('profile.privacySecurity.title')}
        </h2>
      </div>
      <p className={`mt-3 text-navy/70 ${compact ? 'text-[13px]' : 'text-sm'}`}>
        {t('profile.privacySecurity.body')}
      </p>
      <ul className="mt-3.5 flex flex-col gap-2">
        {(['encrypted', 'rls', 'purpose'] as const).map((k) => (
          <li key={k} className="flex items-start gap-2.5">
            <AppIcon name="check" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy" />
            <span className={`text-navy/70 ${compact ? 'text-[13px]' : 'text-sm'}`}>
              {t(`profile.privacySecurity.points.${k}`)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
