import { useAsyncSection } from '../../hooks/useAsyncSection';
import { adminAuditLog } from '../../lib/api';
import { AppIcon } from '../../components/AppIcon';
import { useCC } from '../i18n';
import { CCState } from '../components/CCState';
import { Card, Kpi, StatusChip, TableWrap, Td, Th, num } from '../components/CCKit';
import { fetchBroadcasts, fetchContent, fetchDocuments, fetchHealth } from '../api/platform';

/** Content — news publication and translation coverage. Listings/Investments live on the Properties & Map page. */
export function Content() {
  const { cc, lang } = useCC();
  const sec = useAsyncSection(() => fetchContent(), []);

  return (
    <CCState section={sec} title={cc('section.content')} isEmpty={() => false}>
      {(d) => (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Kpi
              icon="newspaper"
              label={cc('ct.news')}
              value={num(d.news.total, lang)}
              hint={`${cc('ct.published')}: ${num(d.news.published, lang)}`}
            />
            <Kpi
              icon="languages"
              label={cc('ct.translated')}
              value={num(d.news.translated, lang)}
              hint={`${cc('ct.missingTranslations')}: ${num(Math.max(0, d.news.total - d.news.translated), lang)}`}
            />
          </div>

          <Card title={cc('ct.news')} icon="newspaper" to="/admin?tab=newsFeed">
            <p className="mt-2 text-3xl font-extrabold text-navy" dir="ltr">
              {num(d.news.translated, lang)} / {num(d.news.total, lang)}
            </p>
            <p className="text-xs text-navy/50">{cc('ct.translated')}</p>
          </Card>
        </div>
      )}
    </CCState>
  );
}

/** System Health — did the scheduled work run, and when did it last succeed. */
export function SystemHealth() {
  const { cc, lang } = useCC();
  const sec = useAsyncSection(() => fetchHealth(), []);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-navy/50">{cc('sh.noSecrets')}</p>

      <CCState section={sec} title={cc('section.systemHealth')} isEmpty={() => false}>
        {(d) => (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Kpi
                icon="clock"
                label={cc('sh.lastFxSuccess')}
                value={d.lastSuccessfulFx ? new Date(d.lastSuccessfulFx).toLocaleDateString(lang) : cc('sh.never')}
              />
              <Kpi icon="trending-up" label={cc('sh.fxRates')} value={num(d.fxRates, lang)} />
              <Kpi icon="alert-triangle" label={cc('sh.failedRuns')} value={num(d.failedFxRuns, lang)} />
            </div>

            <Card title={cc('sh.runs')} icon="history" to="/admin?tab=rates">
              {d.fxRuns.length === 0 ? (
                <p className="mt-2 text-sm text-navy/50">{cc('state.empty')}</p>
              ) : (
                <TableWrap minWidth={520}>
                  <thead>
                    <tr>
                      <Th>{cc('f.status')}</Th>
                      <Th>{cc('f.source')}</Th>
                      <Th align="center">✓</Th>
                      <Th align="center">✕</Th>
                      <Th>{cc('f.date')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.fxRuns.map((r) => (
                      <tr key={r.id}>
                        <Td><StatusChip status={r.status} /></Td>
                        <Td><span className="text-xs text-navy/60">{r.providerName ?? '—'}</span></Td>
                        <Td align="center" dir="ltr">{num(r.pairsUpdated, lang)}</Td>
                        <Td align="center" dir="ltr">{num(r.pairsRejected, lang)}</Td>
                        <Td dir="ltr">
                          <span className="whitespace-nowrap text-xs text-navy/50">
                            {new Date(r.startedAt).toLocaleString(lang)}
                          </span>
                        </Td>
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

/** Documents & Privacy — METADATA ONLY. No open, download or preview. */
export function Documents() {
  const { cc, lang } = useCC();
  const sec = useAsyncSection(() => fetchDocuments(), []);
  const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div className="flex flex-col gap-6">
      <p className="flex items-start gap-2 rounded-xl bg-cream px-4 py-3 text-xs font-semibold text-navy/70">
        <AppIcon name="lock" className="mt-0.5 h-4 w-4 shrink-0" />
        {cc('dc.metadataOnly')}
      </p>

      <CCState section={sec} title={cc('section.documents')} isEmpty={(d) => d.files.length === 0}>
        {(d) => (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Kpi icon="file-text" label={cc('dc.files')} value={num(d.files.length, lang)} />
              <Kpi icon="folder" label={cc('dc.size')} value={mb(d.totalBytes)} />
            </div>

            <Card title={cc('section.documents')} icon="file-text">
              <TableWrap minWidth={520}>
                <thead>
                  <tr>
                    <Th>{cc('f.file')}</Th>
                    <Th>{cc('f.type')}</Th>
                    <Th align="center">{cc('f.size')}</Th>
                    <Th>{cc('f.date')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {d.files.slice(0, 30).map((f) => (
                    <tr key={f.id}>
                      {/* filename only — never a link, never a signed URL */}
                      <Td><span className="break-all text-xs">{f.filename}</span></Td>
                      <Td><span className="text-xs text-navy/60">{f.mime}</span></Td>
                      <Td align="center" dir="ltr"><span className="text-xs">{(f.sizeBytes / 1024).toFixed(0)} KB</span></Td>
                      <Td dir="ltr"><span className="whitespace-nowrap text-xs text-navy/50">{new Date(f.createdAt).toLocaleDateString(lang)}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </Card>
          </div>
        )}
      </CCState>
    </div>
  );
}

/** Notifications — read-only history. Sending is deliberately not offered. */
export function Notifications() {
  const { cc, lang } = useCC();
  const sec = useAsyncSection(() => fetchBroadcasts(), []);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-navy/50">{cc('nt.readOnlyNote')}</p>

      <CCState section={sec} title={cc('section.notifications')}>
        {(rows) => (
          <Card title={cc('nt.broadcasts')} icon="megaphone" to="/admin?tab=news">
            <ul className="mt-3 flex flex-col gap-2">
              {rows.slice(0, 25).map((b) => (
                <li key={b.id} className="flex items-start gap-2 rounded-xl bg-cream px-4 py-2.5 text-sm">
                  <AppIcon name="megaphone" className="mt-0.5 h-4 w-4 shrink-0 text-navy/60" />
                  <span className="min-w-0 flex-1 break-anywhere text-navy">{b.customText}</span>
                  <span className="shrink-0 text-xs text-navy/40" dir="ltr">
                    {new Date(b.createdAt).toLocaleDateString(lang)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </CCState>
    </div>
  );
}

/** Security & Audit — who did what, when. */
export function Security() {
  const { cc, lang } = useCC();
  const sec = useAsyncSection(() => adminAuditLog.list(100), []);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-navy/50">{cc('sec.hint')}</p>

      <CCState section={sec} title={cc('section.security')}>
        {(rows) => (
          <Card title={cc('sec.recent')} icon="shield-check" to="/admin?tab=auditLog">
            <TableWrap minWidth={620}>
              <thead>
                <tr>
                  <Th>{cc('f.action')}</Th>
                  <Th>{cc('f.target')}</Th>
                  <Th>{cc('f.actor')}</Th>
                  <Th>{cc('f.date')}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td><span className="font-semibold">{r.action}</span></Td>
                    <Td><span className="text-xs text-navy/60">{r.targetType}</span></Td>
                    <Td><span className="text-xs text-navy/60">{r.actorName ?? '—'}</span></Td>
                    <Td dir="ltr">
                      <span className="whitespace-nowrap text-xs text-navy/50">{new Date(r.createdAt).toLocaleString(lang)}</span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Card>
        )}
      </CCState>
    </div>
  );
}
