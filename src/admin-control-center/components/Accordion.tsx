import type { ReactNode } from 'react';
import { AppIcon } from '../../components/AppIcon';
import type { IconName } from '../../components/AppIcon';

/**
 * A collapsed-by-default section, styled like `Card` so it sits naturally
 * among the KPI/table cards on a group page. Built on native
 * `<details>/<summary>` rather than a hand-rolled toggle: free keyboard and
 * screen-reader support, no extra state, no dependency.
 *
 * Used to hold detail a single owner checks occasionally (system health,
 * document metadata, onboarding funnel, referral payouts, traffic
 * analytics) without it competing for attention with the page's primary
 * content.
 */
export function Accordion({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: IconName;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="card group p-0" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-5 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 font-bold text-navy">
          {icon && <AppIcon name={icon} className="h-4 w-4 text-navy/60" />}
          {title}
        </span>
        <AppIcon name="chevron-down" className="h-4 w-4 shrink-0 text-navy/50 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}
