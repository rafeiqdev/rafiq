import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';
import { journey as journeyApi, profileApi } from '../lib/api';
import { classifyError, logDiagnostic } from '../lib/errors';
import {
  EMPTY_PROFILE,
  JOURNEY_TASK_KEYS,
  SITUATIONS,
  SITUATION_TO_PATH,
  SITUATION_TO_REASON,
  STUDENT_STAGES,
  STUDENT_RESIDENCY,
  STUDENT_HOUSING,
  ARRIVED_REASONS,
  ARRIVED_HOUSING,
} from '../lib/types';
import type {
  JourneyTaskKey,
  Profile,
  Situation,
  StudentStage,
  StudentResidency,
  StudentHousing,
  ArrivedReason,
  ArrivedHousing,
} from '../lib/types';
import { TURKEY_CITIES, pickCity } from '../data/turkeyCities';
import { RequireAuth } from '../components/Gates';
import { AppIcon, DirArrow } from '../components/AppIcon';
import type { IconName } from '../components/AppIcon';
import { usePageMeta } from '../lib/seo';

const SITUATION_ICONS: Record<Situation, IconName> = {
  planning: 'luggage',
  arrived: 'plane',
  visiting: 'camera',
  student: 'graduation-cap',
  resident: 'home',
  long_resident: 'building',
};

const HAS_ICONS: Record<JourneyTaskKey, IconName> = {
  turkishPhone: 'smartphone',
  taxNumber: 'receipt',
  residencePermit: 'id-card',
  bankAccount: 'landmark',
};

const STUDENT_STAGE_ICONS: Record<StudentStage, IconName> = {
  coming: 'luggage',
  arrived: 'map-pin',
  settled: 'home',
};

const ARRIVED_REASON_ICONS: Record<ArrivedReason, IconName> = {
  work: 'briefcase',
  living: 'home',
  family: 'users',
  business: 'trending-up',
  study: 'graduation-cap',
  short: 'plane',
  other: 'compass',
};

/**
 * The questionnaire is a dynamic list of step keys, not a fixed count: a
 * persona-specific follow-up step is inserted only for the situations that have
 * one (student, arrived), so everyone else keeps the original four-question flow.
 */
type StepKey = 'situation' | 'studentDetails' | 'arrivedDetails' | 'city' | 'has' | 'family';

function stepsFor(situation: Situation | null): StepKey[] {
  const base: StepKey[] = ['situation', 'city', 'has', 'family'];
  // Right after they tell us who they are, ask that persona's follow-ups.
  if (situation === 'student') return ['situation', 'studentDetails', 'city', 'has', 'family'];
  if (situation === 'arrived') return ['situation', 'arrivedDetails', 'city', 'has', 'family'];
  return base;
}

/** A large, accessible choice button (min 44px target, no colour-only state). */
function Choice({
  icon,
  label,
  selected,
  onClick,
  ariaLabel,
}: {
  icon: IconName;
  label: string;
  selected: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={ariaLabel}
      className={`min-h-[56px] w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-start transition-colors
        focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 ${
          selected ? 'border-navy bg-brand-blue text-navy' : 'border-gray-200 bg-white text-navy/80 hover:border-navy/40'
        }`}
    >
      <span
        className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${
          selected ? 'bg-navy text-white' : 'bg-gray-100 text-navy/70'
        }`}
      >
        <AppIcon name={icon} className="w-5 h-5" />
      </span>
      <span className="flex-1 min-w-0 font-semibold break-words">{label}</span>
      <span
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
          selected ? 'border-navy bg-navy text-white' : 'border-gray-300 text-transparent'
        }`}
        aria-hidden
      >
        <AppIcon name="check" className="w-3.5 h-3.5" />
      </span>
    </button>
  );
}

function OnboardingInner() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const { profile, updateProfile, refresh } = useApp();

  const [stepIndex, setStepIndex] = useState(0);
  const [situation, setSituation] = useState<Situation | null>(profile.situation ?? null);
  const [city, setCity] = useState<string>(profile.city ?? '');
  const [otherCity, setOtherCity] = useState('');
  const [has, setHas] = useState({ ...EMPTY_PROFILE.has, ...profile.has });
  const [family, setFamily] = useState<'yes' | 'no' | null>(profile.family ?? null);
  const [studentStage, setStudentStage] = useState<StudentStage | null>(profile.studentStage ?? null);
  const [studentResidency, setStudentResidency] = useState<StudentResidency | null>(profile.studentResidency ?? null);
  const [studentHousing, setStudentHousing] = useState<StudentHousing | null>(profile.studentHousing ?? null);
  const [arrivedReason, setArrivedReason] = useState<ArrivedReason | null>(profile.arrivedReason ?? null);
  const [arrivedHousing, setArrivedHousing] = useState<ArrivedHousing | null>(profile.arrivedHousing ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  usePageMeta({
    title: `${t('onboard.title')} — ${t('common.appName')}`,
    description: t('onboard.subtitle'),
  });

  const steps = stepsFor(situation);
  const totalSteps = steps.length;
  // Clamp: changing the situation on step 1 can grow/shrink the list; never let
  // the index dangle past the end.
  const safeIndex = Math.min(stepIndex, totalSteps - 1);
  const stepKey = steps[safeIndex];
  const isLast = safeIndex === totalSteps - 1;

  const canNext =
    (stepKey === 'situation' && situation !== null) ||
    (stepKey === 'studentDetails' && studentStage !== null) ||
    (stepKey === 'arrivedDetails' && arrivedReason !== null) ||
    (stepKey === 'city' && (city === 'other' ? otherCity.trim().length > 1 : city.length > 0)) ||
    stepKey === 'has' ||
    (stepKey === 'family' && family !== null);

  const finish = async () => {
    if (!situation || !family) return;
    setSaving(true);
    setError(false);
    const isStudent = situation === 'student';
    const isArrived = situation === 'arrived';
    const next: Profile = {
      ...EMPTY_PROFILE,
      ...profile,
      situation,
      city: city === 'other' ? otherCity.trim() : city,
      // keep the legacy engine (blocks/registry.ts) working
      path: SITUATION_TO_PATH[situation],
      reason: SITUATION_TO_REASON[situation] ?? profile.reason ?? null,
      has,
      family,
      // Persona follow-ups are only meaningful for their own persona; clear them
      // if the answer changed away, so a stale answer can't skew matching.
      studentStage: isStudent ? studentStage : null,
      studentResidency: isStudent ? studentResidency : null,
      studentHousing: isStudent ? studentHousing : null,
      arrivedReason: isArrived ? arrivedReason : null,
      arrivedHousing: isArrived ? arrivedHousing : null,
    };
    try {
      await profileApi.save(next, { completed: true });
      updateProfile(next);
      // Seeds on first run; on a later edit it only upgrades todo → done and
      // never reverts manual progress (see ensure_my_journey). Non-fatal: the
      // profile is already saved and Home retries — but never swallowed silently.
      await journeyApi.ensure().catch((e) => logDiagnostic('onboarding.ensure', e, classifyError(e)));
      await refresh();
      navigate('/home', { replace: true });
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const next = () => (isLast ? finish() : setStepIndex(safeIndex + 1));

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      {/* progress */}
      <p className="text-xs font-semibold text-navy/60">
        {t('onboard.stepOf', { current: safeIndex + 1, total: totalSteps })}
      </p>
      <div
        className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden"
        role="progressbar"
        aria-valuenow={safeIndex + 1}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
      >
        <div
          className="h-full bg-navy transition-all duration-300"
          style={{ width: `${((safeIndex + 1) / totalSteps) * 100}%` }}
        />
      </div>

      <h1 className="mt-6 text-2xl font-extrabold text-navy leading-snug">
        {stepKey === 'situation' && t('onboard.situation.title')}
        {stepKey === 'studentDetails' && t('onboard.student.title')}
        {stepKey === 'arrivedDetails' && t('onboard.arrived.title')}
        {stepKey === 'city' && t('onboard.city.title')}
        {stepKey === 'has' && t('onboard.has.title')}
        {stepKey === 'family' && t('onboard.family.title')}
      </h1>
      {stepKey === 'has' && <p className="mt-2 text-sm text-gray-500">{t('onboard.has.subtitle')}</p>}
      {stepKey === 'situation' && <p className="mt-2 text-sm text-gray-500">{t('onboard.subtitle')}</p>}
      {stepKey === 'studentDetails' && <p className="mt-2 text-sm text-gray-500">{t('onboard.student.subtitle')}</p>}
      {stepKey === 'arrivedDetails' && <p className="mt-2 text-sm text-gray-500">{t('onboard.arrived.subtitle')}</p>}

      <div className="mt-6 flex flex-col gap-2.5">
        {stepKey === 'situation' &&
          SITUATIONS.map((s) => (
            <Choice
              key={s}
              icon={SITUATION_ICONS[s]}
              label={t(`onboard.situation.${s}`)}
              ariaLabel={t(`onboard.situation.${s}`)}
              selected={situation === s}
              onClick={() => setSituation(s)}
            />
          ))}

        {stepKey === 'studentDetails' && (
          <>
            {/* Q1 — stage (the hero question; drives the top-3 recommendations) */}
            <fieldset>
              <legend className="text-sm font-semibold text-navy/70">{t('onboard.student.stage.title')}</legend>
              <div className="mt-2 flex flex-col gap-2.5">
                {STUDENT_STAGES.map((s) => (
                  <Choice
                    key={s}
                    icon={STUDENT_STAGE_ICONS[s]}
                    label={t(`onboard.student.stage.${s}`)}
                    ariaLabel={t(`onboard.student.stage.${s}`)}
                    selected={studentStage === s}
                    onClick={() => setStudentStage(s)}
                  />
                ))}
              </div>
            </fieldset>

            {/* Q2 — residence status (optional refinement) */}
            <label htmlFor="onboarding-student-residency" className="mt-4 text-sm font-semibold text-navy/70">
              {t('onboard.student.residency.title')}
            </label>
            <select
              id="onboarding-student-residency"
              className="input"
              value={studentResidency ?? ''}
              onChange={(e) => setStudentResidency((e.target.value || null) as StudentResidency | null)}
            >
              <option value="">{t('onboard.student.optionalPlaceholder')}</option>
              {STUDENT_RESIDENCY.map((r) => (
                <option key={r} value={r}>
                  {t(`onboard.student.residency.${r}`)}
                </option>
              ))}
            </select>

            {/* Q3 — housing status (optional refinement) */}
            <label htmlFor="onboarding-student-housing" className="mt-3 text-sm font-semibold text-navy/70">
              {t('onboard.student.housing.title')}
            </label>
            <select
              id="onboarding-student-housing"
              className="input"
              value={studentHousing ?? ''}
              onChange={(e) => setStudentHousing((e.target.value || null) as StudentHousing | null)}
            >
              <option value="">{t('onboard.student.optionalPlaceholder')}</option>
              {STUDENT_HOUSING.map((h) => (
                <option key={h} value={h}>
                  {t(`onboard.student.housing.${h}`)}
                </option>
              ))}
            </select>
          </>
        )}

        {stepKey === 'arrivedDetails' && (
          <>
            {/* Q1 — reason for coming (the hero; branches the top-3 services) */}
            <fieldset>
              <legend className="text-sm font-semibold text-navy/70">{t('onboard.arrived.reason.title')}</legend>
              <div className="mt-2 flex flex-col gap-2.5">
                {ARRIVED_REASONS.map((r) => (
                  <Choice
                    key={r}
                    icon={ARRIVED_REASON_ICONS[r]}
                    label={t(`onboard.arrived.reason.${r}`)}
                    ariaLabel={t(`onboard.arrived.reason.${r}`)}
                    selected={arrivedReason === r}
                    onClick={() => setArrivedReason(r)}
                  />
                ))}
              </div>
            </fieldset>

            {/* Q2 — housing status (optional refinement) */}
            <label htmlFor="onboarding-arrived-housing" className="mt-4 text-sm font-semibold text-navy/70">
              {t('onboard.arrived.housing.title')}
            </label>
            <select
              id="onboarding-arrived-housing"
              className="input"
              value={arrivedHousing ?? ''}
              onChange={(e) => setArrivedHousing((e.target.value || null) as ArrivedHousing | null)}
            >
              <option value="">{t('onboard.arrived.optionalPlaceholder')}</option>
              {ARRIVED_HOUSING.map((h) => (
                <option key={h} value={h}>
                  {t(`onboard.arrived.housing.${h}`)}
                </option>
              ))}
            </select>
          </>
        )}

        {stepKey === 'city' && (
          <>
            <label htmlFor="onboarding-city" className="text-sm font-semibold text-navy/70">
              {t('onboard.city.title')}
            </label>
            <select
              id="onboarding-city"
              className="input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              <option value="">{t('onboard.city.placeholder')}</option>
              {TURKEY_CITIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {pickCity(c.id, lang)}
                </option>
              ))}
              <option value="other">{t('onboard.city.other')}</option>
            </select>
            {city === 'other' && (
              <>
                <label htmlFor="onboarding-city-other" className="mt-2 text-sm font-semibold text-navy/70">
                  {t('onboard.city.other')}
                </label>
                <input
                  id="onboarding-city-other"
                  className="input"
                  value={otherCity}
                  onChange={(e) => setOtherCity(e.target.value)}
                />
              </>
            )}
          </>
        )}

        {stepKey === 'has' &&
          JOURNEY_TASK_KEYS.map((k) => (
            <Choice
              key={k}
              icon={HAS_ICONS[k]}
              label={t(`journeyTasks.${k}.title`)}
              ariaLabel={t(`journeyTasks.${k}.title`)}
              selected={has[k]}
              onClick={() => setHas((h) => ({ ...h, [k]: !h[k] }))}
            />
          ))}

        {stepKey === 'family' && (
          <>
            <Choice
              icon="user"
              label={t('onboard.family.alone')}
              ariaLabel={t('onboard.family.alone')}
              selected={family === 'no'}
              onClick={() => setFamily('no')}
            />
            <Choice
              icon="users"
              label={t('onboard.family.family')}
              ariaLabel={t('onboard.family.family')}
              selected={family === 'yes'}
              onClick={() => setFamily('yes')}
            />
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="amber-note mt-4 flex items-center gap-2">
          <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
          {t('onboard.error')}
        </p>
      )}

      {/* actions */}
      <div className="mt-8 flex gap-3">
        {safeIndex > 0 && (
          <button
            type="button"
            onClick={() => setStepIndex(Math.max(0, safeIndex - 1))}
            className="btn-secondary min-h-[44px] flex-1"
          >
            {t('onboard.back')}
          </button>
        )}
        <button
          type="button"
          onClick={next}
          disabled={!canNext || saving}
          className="btn-primary min-h-[44px] flex-1 disabled:opacity-50"
        >
          {saving ? t('onboard.saving') : isLast ? t('onboard.finish') : t('onboard.next')}
          {!saving && !isLast && <DirArrow />}
        </button>
      </div>
    </div>
  );
}

/**
 * The one and only onboarding surface.
 *
 * A user who already finished is bounced to /home so the questionnaire can
 * never re-appear on its own — `?edit=1` ("تعديل إجاباتي") is the single way
 * back in, and it reuses this very page rather than any separate dialog.
 */
function OnboardingGate() {
  // RequireAuth has already waited out `authLoading`, so completion is settled.
  const { onboardingCompleted } = useApp();
  const [params] = useSearchParams();
  const editing = params.get('edit') === '1';
  if (onboardingCompleted && !editing) return <Navigate to="/home" replace />;
  return <OnboardingInner />;
}

export function Onboarding() {
  return (
    <RequireAuth>
      <OnboardingGate />
    </RequireAuth>
  );
}
