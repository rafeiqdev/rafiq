import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EMPTY_INTAKE,
  PERMIT_TYPES,
  PRIOR_PERMIT,
  buildIntakeSummary,
  documentsForSubject,
  needsPermitQuestions,
} from '../lib/intake';
import type { IntakeAnswers, PermitType, PriorPermit } from '../lib/intake';
import { AppIcon, DirArrow } from './AppIcon';

/** One tappable answer (≥44px target, state not conveyed by colour alone). */
function Choice({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-[48px] w-full flex items-center gap-3 rounded-xl border px-4 py-2.5 text-start transition-colors
        focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 ${
          selected ? 'border-navy bg-brand-blue text-navy' : 'border-cream-dark bg-white text-navy/80 hover:border-navy/40'
        }`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? 'border-navy bg-navy text-white' : 'border-gray-300 text-transparent'
        }`}
        aria-hidden
      >
        <AppIcon name="check" className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1 break-words text-sm font-semibold">{label}</span>
    </button>
  );
}

/**
 * Asked right before a chat is handed to a human: what the customer needs, what
 * they already hold, and therefore what is still missing — so the admin doesn't
 * have to re-interview them. Returns a ready-made summary block.
 */
export function HumanHelpIntake({
  subject,
  onDone,
  onCancel,
}: {
  /** service category detected from the conversation (may be null) */
  subject: string | null;
  onDone: (result: { answers: IntakeAnswers; summaryBlock: string }) => void;
  onCancel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const askPermit = needsPermitQuestions(subject);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<IntakeAnswers>({ ...EMPTY_INTAKE, subject });

  // steps: [permitType, priorPermit]? + documents
  const steps = askPermit ? (['permitType', 'priorPermit', 'documents'] as const) : (['documents'] as const);
  const current = steps[step];
  const total = steps.length;

  const required = useMemo(
    () => documentsForSubject(subject, lang, answers.permitType),
    [subject, lang, answers.permitType],
  );

  const finish = (final: IntakeAnswers) => {
    const summaryBlock = buildIntakeSummary(final, required, {
      permitType: t('intake.summary.permitType'),
      priorPermit: t('intake.summary.priorPermit'),
      has: t('intake.summary.has'),
      missing: t('intake.summary.missing'),
      none: t('intake.summary.none'),
      permitTypeValue: final.permitType ? t(`intake.permitType.${final.permitType}`) : undefined,
      priorPermitValue: final.priorPermit ? t(`intake.priorPermit.${final.priorPermit}`) : undefined,
    });
    onDone({ answers: final, summaryBlock });
  };

  const next = () => {
    if (step < total - 1) setStep((s) => s + 1);
    else finish(answers);
  };

  const canAdvance =
    current === 'permitType' ? answers.permitType != null : current === 'priorPermit' ? answers.priorPermit != null : true;

  return (
    <div className="p-5">
      <p className="text-xs font-semibold text-navy/60">{t('intake.stepOf', { current: step + 1, total })}</p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-dark"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={total}
      >
        <div className="h-full bg-navy transition-all duration-300" style={{ width: `${((step + 1) / total) * 100}%` }} />
      </div>

      <h2 className="mt-4 text-base font-extrabold leading-relaxed text-navy">
        {current === 'permitType' && t('intake.permitType.label')}
        {current === 'priorPermit' && t('intake.priorPermit.label')}
        {current === 'documents' && t('intake.documents.label')}
      </h2>
      {current === 'documents' && <p className="mt-1 text-xs text-gray-500">{t('intake.documents.hint')}</p>}
      {step === 0 && <p className="mt-1 text-xs text-gray-500">{t('intake.subtitle')}</p>}

      <div className="mt-4 flex max-h-[42vh] flex-col gap-2 overflow-y-auto overscroll-contain">
        {current === 'permitType' &&
          PERMIT_TYPES.map((p: PermitType) => (
            <Choice
              key={p}
              label={t(`intake.permitType.${p}`)}
              selected={answers.permitType === p}
              onClick={() => setAnswers((a) => ({ ...a, permitType: p }))}
            />
          ))}

        {current === 'priorPermit' &&
          PRIOR_PERMIT.map((p: PriorPermit) => (
            <Choice
              key={p}
              label={t(`intake.priorPermit.${p}`)}
              selected={answers.priorPermit === p}
              onClick={() => setAnswers((a) => ({ ...a, priorPermit: p }))}
            />
          ))}

        {current === 'documents' &&
          (required.length === 0 ? (
            <p className="rounded-xl bg-cream px-3 py-3 text-sm text-navy/60">{t('intake.documents.none')}</p>
          ) : (
            required.map((doc) => {
              const held = answers.documentsHeld.includes(doc);
              return (
                <Choice
                  key={doc}
                  label={doc}
                  selected={held}
                  onClick={() =>
                    setAnswers((a) => ({
                      ...a,
                      documentsHeld: held ? a.documentsHeld.filter((d) => d !== doc) : [...a.documentsHeld, doc],
                    }))
                  }
                />
              );
            })
          ))}
      </div>

      <div className="mt-5 flex gap-2">
        {step > 0 ? (
          <button onClick={() => setStep((s) => s - 1)} className="btn-secondary min-h-[44px] flex-1">
            {t('intake.back')}
          </button>
        ) : (
          <button onClick={onCancel} className="btn-secondary min-h-[44px] flex-1">
            {t('common.cancel')}
          </button>
        )}
        <button onClick={next} disabled={!canAdvance} className="btn-primary min-h-[44px] flex-1 disabled:opacity-50">
          {step === total - 1 ? t('intake.finish') : t('intake.next')}
          <DirArrow />
        </button>
      </div>
    </div>
  );
}
