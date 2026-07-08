import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import type { JourneyPath, Reason } from '../lib/types';
import { Logo } from './Logo';
import { Modal } from './Modal';
import { AppIcon, DirArrow } from './AppIcon';
import type { IconName } from './AppIcon';
import { ONBOARDING_PHOTOS } from '../lib/images';

const Q1: { id: JourneyPath; icon: IconName }[] = [
  { id: 'planning', icon: 'luggage' },
  { id: 'arrived', icon: 'plane' },
  { id: 'living', icon: 'home' },
  { id: 'browsing', icon: 'compass' },
];

const Q2: { id: Reason; icon: IconName }[] = [
  { id: 'tourism', icon: 'camera' },
  { id: 'visiting', icon: 'users' },
  { id: 'live', icon: 'home' },
  { id: 'work', icon: 'briefcase' },
  { id: 'study', icon: 'graduation-cap' },
];

const Q3: { id: 'turkishPhone' | 'taxNumber' | 'residencePermit' | 'bankAccount'; icon: IconName }[] = [
  { id: 'turkishPhone', icon: 'smartphone' },
  { id: 'taxNumber', icon: 'receipt' },
  { id: 'residencePermit', icon: 'id-card' },
  { id: 'bankAccount', icon: 'landmark' },
];

function OptionCard({
  icon,
  image,
  title,
  sub,
  selected,
  onPick,
  buttonLabel,
}: {
  icon: IconName;
  image?: string;
  title: string;
  sub: string;
  selected?: boolean;
  onPick: () => void;
  buttonLabel: string;
}) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className={`card card-hover flex flex-col overflow-hidden text-center ${selected ? 'ring-2 ring-navy border-navy' : ''}`}>
      {/* photo header (falls back to a navy gradient if the photo fails) */}
      <div className="relative h-16 sm:h-32 bg-gradient-to-br from-navy to-navy-light">
        {image && imgOk && (
          <img
            src={image}
            alt=""
            loading="lazy"
            onError={() => setImgOk(false)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-navy/75 via-navy/20 to-transparent" />
        <span className="absolute bottom-2 start-2 flex items-center justify-center w-9 h-9 rounded-full bg-white/90 text-navy shadow">
          <AppIcon name={icon} className="w-4 h-4" />
        </span>
      </div>
      <div className="p-3 sm:p-4 flex flex-col flex-1 min-w-0">
        <h3 className="font-bold text-navy text-sm break-words">{title}</h3>
        <p className="mt-1 text-xs text-gray-500 flex-1 break-words">{sub}</p>
        <button onClick={onPick} className="btn-primary w-full mt-2.5 h-9 text-xs sm:h-11 sm:text-sm">
          {buttonLabel}
          <DirArrow />
        </button>
      </div>
    </div>
  );
}

/** Wide horizontal onboarding modal: navy top bar + cream body + option card rows. */
export function OnboardingModal() {
  const { t } = useTranslation();
  const { updateProfile } = useApp();

  type Step = 'q1' | 'q2' | 'q3' | 'q4';
  const [step, setStep] = useState<Step>('q1');
  const [path, setPath] = useState<JourneyPath | null>(null);
  const [reason, setReason] = useState<Reason | null>(null);
  const [has, setHas] = useState({ turkishPhone: false, taxNumber: false, residencePermit: false, bankAccount: false });

  const questionTitle =
    step === 'q1' ? t('onboarding.q1.title') : step === 'q2' ? t('onboarding.q2.title') : step === 'q3' ? t('onboarding.q3.title') : t('onboarding.q4.title');

  const pickPath = (p: JourneyPath) => {
    setPath(p);
    setStep(p === 'planning' ? 'q2' : 'q3');
  };

  const pickReason = (r: Reason) => {
    setReason(r);
    setStep('q3');
  };

  const finish = (family: 'yes' | 'no') => {
    updateProfile({ path, reason, has, family });
  };

  // the modal does not hard-block the app — skipping lands on the browsing
  // experience, which can always be redone from "Change my answers"
  const skip = () => {
    updateProfile({ path: 'browsing', reason: null, has, family: 'no' });
  };

  return (
    <Modal onClose={skip} labelId="onboarding-title" maxWidth="max-w-3xl">
      <div className="w-full rounded-card overflow-hidden shadow-cardHover">
        {/* navy top bar */}
        <div className="bg-navy px-4 py-4 sm:px-6 sm:py-5 flex items-center gap-3 sm:gap-4">
          <Logo size={32} variant="white" />
          <div className="flex-1 min-w-0">
            <h2 id="onboarding-title" className="text-white font-extrabold text-base sm:text-lg leading-snug break-words">{questionTitle}</h2>
            {step === 'q3' && <p className="text-white/70 text-xs mt-0.5">{t('onboarding.q3.subtitle')}</p>}
          </div>
          <button onClick={skip} className="text-white/80 hover:text-white text-xs font-semibold underline-offset-2 hover:underline me-8">
            {t('onboarding.skip')}
          </button>
        </div>

        {/* cream body */}
        <div className="bg-cream px-6 py-6">
          {step === 'q1' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {Q1.map((o) => (
                <OptionCard
                  key={o.id}
                  icon={o.icon}
                  image={ONBOARDING_PHOTOS[o.id]}
                  title={t(`onboarding.q1.${o.id}.title`)}
                  sub={t(`onboarding.q1.${o.id}.sub`)}
                  onPick={() => pickPath(o.id)}
                  buttonLabel={t('onboarding.startBtn')}
                />
              ))}
            </div>
          )}

          {step === 'q2' && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              {Q2.map((o) => (
                <OptionCard
                  key={o.id}
                  icon={o.icon}
                  image={ONBOARDING_PHOTOS[o.id]}
                  title={t(`onboarding.q2.${o.id}.title`)}
                  sub={t(`onboarding.q2.${o.id}.sub`)}
                  onPick={() => pickReason(o.id)}
                  buttonLabel={t('onboarding.startBtn')}
                />
              ))}
            </div>
          )}

          {step === 'q3' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Q3.map((o) => {
                  const selected = has[o.id];
                  return (
                    <div
                      key={o.id}
                      role="checkbox"
                      aria-checked={selected}
                      tabIndex={0}
                      onClick={() => setHas((h) => ({ ...h, [o.id]: !h[o.id] }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setHas((h) => ({ ...h, [o.id]: !h[o.id] }));
                        }
                      }}
                      className={`card card-hover cursor-pointer flex flex-col items-center p-4 text-center ${
                        selected ? 'ring-2 ring-navy border-navy bg-brand-blue' : ''
                      }`}
                    >
                      <div className="icon-chip">
                        <AppIcon name={o.icon} />
                      </div>
                      <h3 className="mt-3 font-bold text-navy text-sm">{t(`onboarding.q3.${o.id}.title`)}</h3>
                      <p className="mt-1 text-xs text-gray-500">{t(`onboarding.q3.${o.id}.sub`)}</p>
                      <div
                        className={`mt-3 w-5 h-5 rounded-md border-2 border-navy flex items-center justify-center ${
                          selected ? 'bg-navy text-white' : 'text-transparent'
                        }`}
                      >
                        <AppIcon name="check" className="w-3 h-3" />
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setStep('q4')} className="btn-primary w-full mt-5">
                {t('onboarding.q3.continue')}
                <DirArrow />
              </button>
            </>
          )}

          {step === 'q4' && (
            <div className="grid grid-cols-2 gap-4 max-w-xl mx-auto">
              <OptionCard
                icon="users"
                image={ONBOARDING_PHOTOS.family_yes}
                title={t('onboarding.q4.yes.title')}
                sub={t('onboarding.q4.yes.sub')}
                onPick={() => finish('yes')}
                buttonLabel={t('onboarding.startBtn')}
              />
              <OptionCard
                icon="user"
                image={ONBOARDING_PHOTOS.family_no}
                title={t('onboarding.q4.no.title')}
                sub={t('onboarding.q4.no.sub')}
                onPick={() => finish('no')}
                buttonLabel={t('onboarding.startBtn')}
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
