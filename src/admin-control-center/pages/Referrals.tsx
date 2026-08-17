import { useState } from 'react';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { useCC } from '../i18n';
import { CCState } from '../components/CCState';
import { Card, Kpi, StatusChip, TableWrap, Td, Th, money, num } from '../components/CCKit';
import { PeriodPicker } from '../components/PeriodPicker';
import { DEFAULT_PERIOD, rangeFor, type PeriodId } from '../period';
import { fetchReferrals } from '../api/growth';

/** Referrals & Wallet — commissions and payout requests, read-only. */
export function Referrals() {
  const { cc, lang } = useCC();
  const [period, setPeriod] = useState<PeriodId>(DEFAULT_PERIOD);
  const sec = useAsyncSection(() => fetchReferrals(rangeFor(period)), [period]);

  return (
    <div className="flex flex-col gap-6">
      <PeriodPicker value={period} onChange={setPeriod} />
      <p className="text-xs text-navy/50">{cc('ref.approveNote')}</p>

      <CCState section={sec} title={cc('section.referrals')} isEmpty={() => false}>
        {(d) => (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi icon="users" label={cc('ref.referrers')} value={num(d.referrers, lang)} />
              <Kpi icon="gift" label={cc('ref.commissions')} value={num(d.commissions.length, lang)} />
              <Kpi icon="receipt" label={cc('ref.payouts')} value={num(d.payouts.length, lang)} />
              <Kpi icon="credit-card" label={cc('ref.paid')} value={num(d.byStatus.find(([s]) => s === 'paid')?.[1] ?? 0, lang)} />
            </div>

            {/* Money grouped per currency — never summed across them. */}
            {Object.keys(d.byCurrency).length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(d.byCurrency).map(([cur, v]) => (
                  <div key={cur} className="card p-4">
                    <p className="text-[11px] font-bold text-navy/50" dir="ltr">{cur}</p>
                    <div className="mt-2 flex flex-col gap-1 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="text-navy/60">{cc('ref.pending')}</span>
                        <span className="font-bold text-amber-800" dir="ltr">{money(v.pending, cur, lang)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-navy/60">{cc('ref.available')}</span>
                        <span className="font-bold text-sky-800" dir="ltr">{money(v.available, cur, lang)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-navy/60">{cc('ref.paid')}</span>
                        <span className="font-bold text-emerald-700" dir="ltr">{money(v.paid, cur, lang)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Card title={cc('ref.commissions')} icon="gift">
              {d.commissions.length === 0 ? (
                <p className="mt-2 text-sm text-navy/50">{cc('state.empty')}</p>
              ) : (
                <TableWrap minWidth={620}>
                  <thead>
                    <tr>
                      <Th>{cc('f.service')}</Th>
                      <Th>{cc('f.type')}</Th>
                      <Th>{cc('f.amount')}</Th>
                      <Th>{cc('f.commission')}</Th>
                      <Th>{cc('f.status')}</Th>
                      <Th>{cc('f.date')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.commissions.slice(0, 25).map((r) => (
                      <tr key={r.id}>
                        <Td><span className="break-anywhere">{r.serviceName}</span></Td>
                        <Td><span className="text-xs text-navy/60">{r.serviceType}</span></Td>
                        <Td dir="ltr">{money(r.amount, r.currency, lang)}</Td>
                        <Td dir="ltr"><span className="font-bold">{money(r.commission, r.currency, lang)}</span></Td>
                        <Td><StatusChip status={r.status} /></Td>
                        <Td dir="ltr"><span className="whitespace-nowrap text-xs text-navy/50">{new Date(r.createdAt).toLocaleDateString(lang)}</span></Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              )}
            </Card>

            <Card title={cc('ref.payouts')} icon="receipt">
              {d.payouts.length === 0 ? (
                <p className="mt-2 text-sm text-navy/50">{cc('state.empty')}</p>
              ) : (
                <TableWrap minWidth={520}>
                  <thead>
                    <tr>
                      <Th>{cc('f.amount')}</Th>
                      <Th>{cc('f.method')}</Th>
                      <Th>{cc('f.status')}</Th>
                      <Th>{cc('f.date')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.payouts.slice(0, 20).map((r) => (
                      <tr key={r.id}>
                        <Td dir="ltr"><span className="font-bold">{money(r.amount, r.currency, lang)}</span></Td>
                        <Td><span className="text-xs text-navy/60">{r.method}</span></Td>
                        <Td><StatusChip status={r.status} /></Td>
                        <Td dir="ltr"><span className="whitespace-nowrap text-xs text-navy/50">{new Date(r.createdAt).toLocaleDateString(lang)}</span></Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              )}
            </Card>
          </div>
        )}
      </CCState>
    </div>
  );
}
