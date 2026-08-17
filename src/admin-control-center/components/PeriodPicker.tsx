import { useCC } from '../i18n';
import { PERIODS, type PeriodId } from '../period';

/** Shared period selector. Sections that read time-bounded data all use this. */
export function PeriodPicker({ value, onChange }: { value: PeriodId; onChange: (p: PeriodId) => void }) {
  const { cc } = useCC();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-semibold text-navy/50">{cc('period.label')}</span>
      {PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          aria-pressed={value === p}
          className={`min-h-[32px] rounded-full border px-3 text-xs font-bold transition-colors ${
            value === p ? 'border-navy bg-navy text-white' : 'border-cream-dark bg-white text-navy/70 hover:bg-cream'
          }`}
        >
          {cc(`period.${p}`)}
        </button>
      ))}
    </div>
  );
}
