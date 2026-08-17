import { AppIcon } from '../../components/AppIcon';
import { useCC } from '../i18n';
import { CC_SECTIONS } from '../sections';

/**
 * Shown for sections reserved in the structure but not yet implemented. It is
 * deliberately honest: NO numbers, NO mock data — just a clear "in progress"
 * state, per the brief's hard rule against fabricated figures.
 */
export function Placeholder({ sectionId }: { sectionId: string }) {
  const { cc } = useCC();
  const def = CC_SECTIONS.find((s) => s.id === sectionId);
  return (
    <section className="card p-8 text-center">
      <div className="icon-chip mx-auto">
        <AppIcon name={def?.icon ?? 'layers'} className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-extrabold text-navy">{def ? cc(def.labelKey) : sectionId}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-navy/60">{cc('state.comingSoon')}</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-navy/45">{cc('state.comingSoonBody')}</p>
    </section>
  );
}
