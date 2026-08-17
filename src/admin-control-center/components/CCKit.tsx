import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AppIcon } from '../../components/AppIcon';
import type { IconName } from '../../components/AppIcon';
import { useCC } from '../i18n';

/**
 * Shared presentation for Control Center sections, so every card looks and
 * behaves the same and no section has to reinvent a number tile or a table.
 *
 * The single rule encoded here: a value that could not be read renders as an
 * em-dash, never as 0. `num()` is the only way numbers reach the screen.
 */

/** Format a possibly-unreadable number. null/undefined ⇒ "—" (NOT zero). */
export function num(v: number | null | undefined, locale = 'en'): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toLocaleString(locale);
}

/** Money with its currency, or "—" when unreadable. */
export function money(v: number | null | undefined, currency: string, locale = 'en'): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toLocaleString(locale, { maximumFractionDigits: 2 })} ${currency}`;
}

export function Kpi({
  icon,
  label,
  value,
  delta,
  hint,
}: {
  icon: IconName;
  label: string;
  value: string;
  /** % vs the previous period; null = no fair baseline, so nothing is shown. */
  delta?: number | null;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-navy/60">
        <AppIcon name={icon} className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 truncate">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-extrabold text-navy" dir="ltr">{value}</p>
      {delta != null && (
        <p
          className={`mt-0.5 text-[11px] font-bold ${delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-brand-red' : 'text-navy/40'}`}
          dir="ltr"
        >
          {delta > 0 ? '▲' : delta < 0 ? '▼' : '='} {Math.abs(delta)}%
        </p>
      )}
      {hint && <p className="mt-0.5 text-[11px] text-navy/45">{hint}</p>}
    </div>
  );
}

export function Card({
  title,
  icon,
  to,
  actions,
  children,
}: {
  title: string;
  icon?: IconName;
  /** Deep-link into the classic Admin tab that owns this record type. */
  to?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { cc } = useCC();
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold text-navy">
          {icon && <AppIcon name={icon} className="h-4 w-4 text-navy/60" />}
          {title}
        </h2>
        <div className="flex items-center gap-3">
          {actions}
          {to && (
            <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline">
              {cc('overview.viewDetails')}
              <AppIcon name="arrow-right" className="dir-arrow h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Horizontally scrollable table shell — wide tables must never scroll the page. */
export function TableWrap({ children, minWidth = 640 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

/** `children` is optional so an action column can have a blank header. */
export function Th({ children, align = 'start' }: { children?: ReactNode; align?: 'start' | 'center' | 'end' }) {
  return <th className={`text-${align} border-b border-cream-dark py-2 text-xs font-semibold text-navy/60`}>{children}</th>;
}

export function Td({ children, align = 'start', dir }: { children: ReactNode; align?: 'start' | 'center' | 'end'; dir?: 'ltr' }) {
  return (
    <td className={`text-${align} border-b border-cream-dark/60 py-2 text-navy`} dir={dir}>
      {children}
    </td>
  );
}

/**
 * A status chip. Deliberately carries an icon AND text, never colour alone —
 * colour-blind admins and greyscale printouts must read the same meaning.
 */
const STATUS_STYLE: Record<string, { cls: string; icon: IconName }> = {
  new: { cls: 'bg-brand-blue text-navy', icon: 'sparkles' },
  pending: { cls: 'bg-amber-100 text-amber-900', icon: 'hourglass' },
  under_review: { cls: 'bg-amber-100 text-amber-900', icon: 'hourglass' },
  processing: { cls: 'bg-amber-100 text-amber-900', icon: 'hourglass' },
  available: { cls: 'bg-sky-100 text-sky-900', icon: 'circle' },
  approved: { cls: 'bg-emerald-100 text-emerald-800', icon: 'check' },
  verified: { cls: 'bg-emerald-100 text-emerald-800', icon: 'check-circle' },
  paid: { cls: 'bg-emerald-100 text-emerald-800', icon: 'check-circle' },
  done: { cls: 'bg-emerald-100 text-emerald-800', icon: 'check-circle' },
  success: { cls: 'bg-emerald-100 text-emerald-800', icon: 'check-circle' },
  confirmed: { cls: 'bg-emerald-100 text-emerald-800', icon: 'check-circle' },
  published: { cls: 'bg-emerald-100 text-emerald-800', icon: 'check-circle' },
  rejected: { cls: 'bg-brand-red/10 text-brand-red', icon: 'x-circle' },
  failed: { cls: 'bg-brand-red/10 text-brand-red', icon: 'alert-triangle' },
  cancelled: { cls: 'bg-gray-200 text-gray-700', icon: 'x' },
  reversed: { cls: 'bg-gray-200 text-gray-700', icon: 'arrow-left-right' },
  refunded: { cls: 'bg-gray-200 text-gray-700', icon: 'arrow-left-right' },
  partial: { cls: 'bg-amber-100 text-amber-900', icon: 'alert-triangle' },
  draft: { cls: 'bg-gray-200 text-gray-700', icon: 'pencil' },
};

export function StatusChip({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { cls: 'bg-cream-dark text-navy/70', icon: 'circle' as IconName };
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${s.cls}`}>
      <AppIcon name={s.icon} className="h-3 w-3 shrink-0" />
      {status}
    </span>
  );
}

/** A labelled proportion bar — used for funnels and top-N breakdowns. */
export function Bar({ label, value, max, suffix }: { label: string; value: number; max: number; suffix?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-36 shrink-0 truncate text-navy/70" title={label}>{label}</span>
      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-cream-dark">
        <span className="block h-full rounded-full bg-navy/70" style={{ width: `${pct}%` }} />
      </span>
      <span className="w-20 shrink-0 text-end font-bold text-navy" dir="ltr">
        {value.toLocaleString()}{suffix ?? ''}
      </span>
    </div>
  );
}
