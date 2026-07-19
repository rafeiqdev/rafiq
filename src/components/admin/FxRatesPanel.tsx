import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fx } from '../../lib/api';
import type { FxAuditEntry, FxRate, FxSyncRun } from '../../lib/api';
import { FX_PAIRS } from '../../lib/fxRates';
import { AppIcon } from '../AppIcon';

/**
 * Admin control surface for the daily FX sync.
 *
 * Three jobs: show whether the job is healthy (and when it last actually
 * succeeded, which is the number that matters when the provider is down),
 * let an admin override a rate with a mandatory reason, and expose the audit
 * trail so any published number can be traced to a run or a person.
 */
export function FxRatesPanel() {
  const { t, i18n } = useTranslation();
  const [rates, setRates] = useState<FxRate[]>([]);
  const [runs, setRuns] = useState<FxSyncRun[]>([]);
  const [audit, setAudit] = useState<FxAuditEntry[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftRate, setDraftRate] = useState('');
  const [draftReason, setDraftReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [r, s, a] = await Promise.all([
      fx.list(),
      fx.runs(5).catch(() => [] as FxSyncRun[]),
      fx.audit(20).catch(() => [] as FxAuditEntry[]),
    ]);
    setRates(r);
    setRuns(s);
    setAudit(a);
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(i18n.language) : '—');

  const lastRun = runs[0] ?? null;
  // The health signal: not "did it run" but "when did it last actually work".
  const lastSuccess = runs.find((r) => r.status === 'success' || r.status === 'partial') ?? null;
  const degraded = lastRun !== null && lastRun.status !== 'success';

  const startEdit = (r: FxRate | undefined, pair: string) => {
    setEditing(pair);
    setDraftRate(r ? String(r.rate) : '');
    setDraftReason('');
    setError(null);
  };

  const submitOverride = async (pair: string) => {
    const value = Number(draftRate);
    if (!Number.isFinite(value) || value <= 0) {
      setError(t('admin.fx.errors.rate'));
      return;
    }
    if (draftReason.trim().length < 3) {
      // The database rejects a blank reason too; this is the friendly first line.
      setError(t('admin.fx.errors.reason'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await fx.setOverride(pair, value, draftReason.trim());
      setEditing(null);
      await load();
    } catch {
      setError(t('admin.fx.errors.save'));
    } finally {
      setBusy(false);
    }
  };

  const release = async (pair: string) => {
    setBusy(true);
    try {
      await fx.clearOverride(pair, t('admin.fx.releasedReason'));
      await load();
    } catch {
      setError(t('admin.fx.errors.save'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-6 mt-5">
      <h2 className="font-bold text-navy flex items-center gap-2">
        <AppIcon name="trending-up" className="w-4 h-4" />
        {t('admin.fx.title')}
      </h2>
      <p className="mt-1 text-sm text-gray-500">{t('admin.fx.body')}</p>

      {/* health banner */}
      <div
        className={`mt-4 rounded-xl border p-3.5 ${
          degraded ? 'border-amber-300 bg-amber-50' : 'border-green-600/30 bg-green-50'
        }`}
        role={degraded ? 'alert' : undefined}
      >
        <p className="flex items-center gap-2 text-sm font-bold text-navy">
          <AppIcon name={degraded ? 'alert-triangle' : 'check-circle'} className="w-4 h-4 shrink-0" />
          {degraded ? t('admin.fx.degraded') : t('admin.fx.healthy')}
        </p>
        <p className="mt-1.5 text-xs text-navy/70">
          {t('admin.fx.lastSuccess', { date: fmt(lastSuccess?.startedAt ?? null) })}
        </p>
        {lastRun && (
          <p className="mt-0.5 text-xs text-navy/60">
            {t('admin.fx.lastRun', {
              date: fmt(lastRun.startedAt),
              status: t(`admin.fx.status.${lastRun.status}`),
              local: lastRun.localTime ?? '—',
            })}
          </p>
        )}
        {degraded && lastRun?.error && (
          <p className="mt-1.5 break-words text-xs text-amber-800">{lastRun.error}</p>
        )}
      </div>

      {/* per-pair table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[620px]">
          <thead>
            <tr className="text-xs text-navy/60 border-b border-cream-dark">
              <th className="text-start py-2">{t('admin.fx.col.pair')}</th>
              <th className="text-start py-2">{t('admin.fx.col.rate')}</th>
              <th className="text-start py-2">{t('admin.fx.col.source')}</th>
              <th className="text-start py-2">{t('admin.fx.col.updated')}</th>
              <th className="text-start py-2" />
            </tr>
          </thead>
          <tbody>
            {FX_PAIRS.map(({ pair }) => {
              const r = rates.find((x) => x.pair === pair);
              const isEditing = editing === pair;
              return (
                <tr key={pair} className="border-b border-cream-dark/60 align-top">
                  <td className="py-2.5 font-semibold text-navy" dir="ltr">{pair}</td>
                  <td className="py-2.5 tabular-nums text-navy" dir="ltr">{r ? r.rate.toFixed(4) : '—'}</td>
                  <td className="py-2.5">
                    {r ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          r.source === 'manual' ? 'bg-amber-100 text-amber-800' : 'bg-brand-blue text-navy'
                        }`}
                      >
                        {t(`admin.fx.source.${r.source}`)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                    {r?.overrideReason && (
                      <p className="mt-1 max-w-[220px] break-words text-[11px] text-navy/60">{r.overrideReason}</p>
                    )}
                  </td>
                  <td className="py-2.5 text-xs text-navy/60">{fmt(r?.updatedAt ?? null)}</td>
                  <td className="py-2.5">
                    {isEditing ? (
                      <div className="flex flex-col gap-2 min-w-[240px]">
                        <input
                          type="number"
                          step="any"
                          dir="ltr"
                          className="input !h-9 text-xs"
                          value={draftRate}
                          onChange={(e) => setDraftRate(e.target.value)}
                          aria-label={t('admin.fx.col.rate')}
                        />
                        <input
                          className="input !h-9 text-xs"
                          value={draftReason}
                          onChange={(e) => setDraftReason(e.target.value)}
                          placeholder={t('admin.fx.reasonPlaceholder')}
                          aria-label={t('admin.fx.reasonPlaceholder')}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => submitOverride(pair)}
                            disabled={busy}
                            className="btn-primary !h-9 px-3 text-xs disabled:opacity-50"
                          >
                            {t('admin.fx.save')}
                          </button>
                          <button onClick={() => setEditing(null)} className="btn-secondary !h-9 px-3 text-xs">
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(r, pair)} className="btn-secondary !h-9 px-3 text-xs">
                          <AppIcon name="pencil" className="w-3.5 h-3.5" />
                          {t('admin.fx.override')}
                        </button>
                        {r?.source === 'manual' && (
                          <button
                            onClick={() => release(pair)}
                            disabled={busy}
                            className="btn-secondary !h-9 px-3 text-xs disabled:opacity-50"
                          >
                            {t('admin.fx.release')}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && (
        <p role="alert" className="amber-note mt-3 flex items-center gap-2">
          <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
          {error}
        </p>
      )}

      {/* audit trail */}
      <details className="mt-5">
        <summary className="cursor-pointer text-sm font-bold text-navy">{t('admin.fx.auditTitle')}</summary>
        {audit.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500">{t('admin.fx.auditEmpty')}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {audit.map((a) => (
              <li key={a.id} className="rounded-lg bg-cream px-3 py-2 text-xs">
                <span className="font-semibold text-navy" dir="ltr">{a.pair}</span>
                <span className="text-navy/60" dir="ltr">
                  {' '}
                  {a.oldRate?.toFixed(4) ?? '—'} → {a.newRate?.toFixed(4) ?? '—'}
                </span>
                <span className="text-navy/50"> · {t(`admin.fx.source.${a.source}`)}</span>
                <span className="text-navy/40"> · {fmt(a.createdAt)}</span>
                {a.reason && <p className="mt-0.5 break-words text-navy/70">{a.reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
