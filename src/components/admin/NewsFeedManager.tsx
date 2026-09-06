import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, news } from '../../lib/api';
import { normalizeFeedUrl } from '../../lib/rssNews';
import { AppIcon } from '../AppIcon';
import { SectionState } from '../SectionState';
import { useAsyncSection } from '../../hooks/useAsyncSection';
import { ConfirmActionModal } from './ConfirmActionModal';

/**
 * The sync endpoint reports WHY it failed (sources down, nothing readable in
 * them, the screening model unavailable, server env missing, wrong account,
 * or — in local dev — the Vercel function simply not existing behind Vite's
 * /api proxy). A generic "something went wrong" hid all of that from the
 * owner; map each failure to its own instruction instead.
 */
function syncErrorKey(e: unknown): string {
  if (e instanceof ApiError) {
    // Vite proxies /api to the legacy Express server, which has no
    // cron/news-sync route — the function only exists on Vercel.
    if (e.status === 404 || e.status === 405) return 'admin.newsFeed.errors.devOnly';
    switch (e.code) {
      case 'feeds_unreachable':
        return 'admin.newsFeed.errors.unreachable';
      case 'no_items_parsed':
        return 'admin.newsFeed.errors.noPosts';
      case 'ai_unavailable':
        return 'admin.newsFeed.errors.aiUnavailable';
      case 'not_configured':
        return 'admin.newsFeed.errors.notConfigured';
      case 'db_error':
        return 'admin.newsFeed.errors.dbError';
      case 'not_authenticated':
      case 'unauthorized':
      case 'forbidden':
        return 'admin.newsFeed.errors.forbidden';
    }
  }
  return 'common.error';
}

/**
 * The PUBLIC news feed on the home page (distinct from the bell broadcasts,
 * which reach signed-in users only). The server reads the tourism sources
 * listed here, has a model throw out anything that isn't useful travel/living
 * news for an Arabic-speaking visitor, translates what survives into all four
 * site languages, and files it as a DRAFT — nothing appears on the home page
 * until it is published below. Empty list = the built-in sources. The manual
 * form stays for one-off items with no article behind them.
 */
export function NewsFeedManager() {
  const { t, i18n } = useTranslation();
  const postsSec = useAsyncSection(() => news.adminList(), []);

  const [sources, setSources] = useState<string[]>([]);
  const [newSource, setNewSource] = useState('');
  const [sourcesSaved, setSourcesSaved] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  /** i18n key of the failure to show, or null when all is well. */
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<'idle' | 'busy' | number>('idle');
  const [confirmSync, setConfirmSync] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<{ id: string; next: boolean; title: string } | null>(null);
  const [confirmPublishAll, setConfirmPublishAll] = useState(false);
  const [publishAllState, setPublishAllState] = useState<'idle' | 'busy' | number>('idle');

  const togglePublished = async (id: string, next: boolean) => {
    setError(null);
    try {
      await news.setPublished(id, next);
      postsSec.reload();
    } catch {
      setError('common.error');
    }
  };

  useEffect(() => {
    news.sources().then(setSources, () => {});
  }, []);

  const sync = async () => {
    setError(null);
    setSyncState('busy');
    try {
      const { synced } = await news.syncNow();
      setSyncState(synced);
      postsSec.reload();
    } catch (e) {
      setSyncState('idle');
      setError(syncErrorKey(e));
    }
  };

  const addSource = () => {
    const url = normalizeFeedUrl(newSource);
    if (!url) {
      setError('admin.newsFeed.errors.badFeed');
      return;
    }
    setError(null);
    setSourcesSaved(false);
    setSources((list) => (list.includes(url) ? list : [...list, url]));
    setNewSource('');
  };

  const removeSource = (url: string) => {
    setSourcesSaved(false);
    setSources((list) => list.filter((s) => s !== url));
  };

  const saveSources = async () => {
    setError(null);
    setSourcesSaved(false);
    try {
      await news.setSources(sources);
      setSourcesSaved(true);
      // a changed list should show results immediately, not tomorrow at cron time
      await sync();
    } catch {
      setError('common.error');
    }
  };

  const publish = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await news.create({ title, body, url });
      setTitle('');
      setBody('');
      setUrl('');
      postsSec.reload();
    } catch {
      setError('common.error');
    } finally {
      setBusy(false);
    }
  };

  const publishAll = async () => {
    setError(null);
    setPublishAllState('busy');
    try {
      const { count } = await news.publishAllDrafts();
      setPublishAllState(count);
      postsSec.reload();
    } catch {
      setPublishAllState('idle');
      setError('common.error');
    }
  };

  const remove = async (id: string) => {
    setError(null);
    try {
      await news.remove(id);
      postsSec.reload();
    } catch {
      setError('common.error');
    }
  };

  return (
    <div className="card p-6 mt-5">
      <h2 className="font-bold text-navy flex items-center gap-2">
        <AppIcon name="newspaper" className="w-4 h-4" />
        {t('admin.newsFeed.title')}
      </h2>
      <p className="mt-1 text-xs text-gray-500">{t('admin.newsFeed.hint')}</p>

      {/* the sources api/cron/news-sync.ts reads */}
      <div className="mt-4">
        <p className="text-xs font-semibold text-navy/85">{t('admin.newsFeed.sources')}</p>
        {sources.length === 0 ? (
          <p className="mt-1 text-xs text-gray-500">{t('admin.newsFeed.sourcesDefault')}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {sources.map((url) => (
              <li key={url} className="flex items-center gap-2 rounded-xl bg-cream px-3 py-2">
                <AppIcon name="newspaper" className="w-3.5 h-3.5 shrink-0 text-navy/70" />
                <span dir="ltr" className="flex-1 min-w-0 break-all text-xs text-navy">{url}</span>
                <button
                  onClick={() => removeSource(url)}
                  aria-label={t('common.delete')}
                  className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-brand-red hover:bg-brand-red/10"
                >
                  <AppIcon name="trash" className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            id="news-source"
            className="input flex-1 min-w-[220px]"
            dir="ltr"
            placeholder="https://www.turizmgunlugu.com/rss"
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSource();
              }
            }}
          />
          <button onClick={addSource} disabled={!newSource.trim()} className="btn-secondary h-10 px-4 text-xs disabled:opacity-60">
            <AppIcon name="plus" className="w-3.5 h-3.5" />
            {t('admin.newsFeed.addSource')}
          </button>
          <button onClick={saveSources} className="btn-secondary h-10 px-4 text-xs">
            <AppIcon name="save" className="w-3.5 h-3.5" />
            {t('common.save')}
          </button>
          <button onClick={() => setConfirmSync(true)} disabled={syncState === 'busy'} className="btn-primary h-10 px-4 text-xs disabled:opacity-60">
            <AppIcon name="send" className="w-3.5 h-3.5" />
            {t('admin.newsFeed.sync')}
          </button>
          {sourcesSaved && (
            <span role="status" className="text-xs font-semibold text-emerald-700">
              {t('admin.newsFeed.saved')}
            </span>
          )}
          {typeof syncState === 'number' && (
            <span role="status" className="text-xs font-semibold text-emerald-700">
              {t('admin.newsFeed.synced', { count: syncState })}
            </span>
          )}
        </div>
      </div>

      {/* new post */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <input
          className="input sm:col-span-2"
          placeholder={t('admin.newsFeed.postTitle')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="input sm:col-span-2 min-h-[72px] py-2"
          placeholder={t('admin.newsFeed.postBody')}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <input
          className="input"
          dir="ltr"
          placeholder={t('admin.newsFeed.postLink')}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button onClick={() => title.trim() && setConfirmPublish(true)} disabled={busy || !title.trim()} className="btn-primary px-5 disabled:opacity-60">
          <AppIcon name="megaphone" className="w-4 h-4" />
          {t('admin.newsFeed.publish')}
        </button>
      </div>

      {confirmSync && (
        <ConfirmActionModal
          title={t('admin.newsFeed.sync')}
          expectedResult={t('admin.newsFeed.sync')}
          reversible={false}
          notifiesCustomer
          onClose={() => setConfirmSync(false)}
          onConfirm={() => {
            sync();
            setConfirmSync(false);
          }}
        />
      )}
      {confirmPublish && (
        <ConfirmActionModal
          title={t('admin.newsFeed.publish')}
          record={title}
          expectedResult={t('admin.newsFeed.publish')}
          reversible={false}
          notifiesCustomer
          onClose={() => setConfirmPublish(false)}
          onConfirm={() => {
            publish();
            setConfirmPublish(false);
          }}
        />
      )}
      {confirmRemoveId && (
        <ConfirmActionModal
          title={t('common.delete')}
          expectedResult={t('common.delete')}
          reversible={false}
          notifiesCustomer={false}
          onClose={() => setConfirmRemoveId(null)}
          onConfirm={() => {
            remove(confirmRemoveId);
            setConfirmRemoveId(null);
          }}
        />
      )}
      {confirmPublishAll && (
        <ConfirmActionModal
          title={t('admin.newsFeed.publishAllShort')}
          expectedResult={t('admin.newsFeed.publishAllShort')}
          reversible={false}
          notifiesCustomer
          onClose={() => setConfirmPublishAll(false)}
          onConfirm={() => {
            publishAll();
            setConfirmPublishAll(false);
          }}
        />
      )}
      {confirmToggle && (
        <ConfirmActionModal
          title={t(confirmToggle.next ? 'admin.newsFeed.publishDraft' : 'admin.newsFeed.unpublish')}
          record={confirmToggle.title}
          expectedResult={t(confirmToggle.next ? 'admin.newsFeed.published' : 'admin.newsFeed.draft')}
          reversible
          notifiesCustomer={confirmToggle.next}
          onClose={() => setConfirmToggle(null)}
          onConfirm={() => {
            togglePublished(confirmToggle.id, confirmToggle.next);
            setConfirmToggle(null);
          }}
        />
      )}

      {error && (
        <p role="alert" className="amber-note mt-3 flex items-center gap-2 text-sm">
          <AppIcon name="alert-triangle" className="w-4 h-4 shrink-0" />
          {t(error)}
        </p>
      )}

      <SectionState
        section={postsSec}
        title={t('admin.newsFeed.title')}
        empty={<p className="mt-3 text-sm text-gray-500">{t('admin.newsFeed.empty')}</p>}
      >
        {(rows) => {
          const draftCount = rows.filter((r) => !r.published).length;
          return (
          <>
            {draftCount > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setConfirmPublishAll(true)}
                  disabled={publishAllState === 'busy'}
                  className="btn-primary h-10 px-4 text-xs disabled:opacity-60"
                >
                  <AppIcon name="megaphone" className="w-3.5 h-3.5" />
                  {t('admin.newsFeed.publishAll', { count: draftCount })}
                </button>
                {typeof publishAllState === 'number' && (
                  <span role="status" className="text-xs font-semibold text-emerald-700">
                    {t('admin.newsFeed.publishedAll', { count: publishAllState })}
                  </span>
                )}
              </div>
            )}
            <ul className="mt-4 flex flex-col gap-2">
            {rows.map((p) => (
              <li key={p.id} className="rounded-xl bg-cream px-4 py-2.5 text-sm text-navy flex gap-2 items-start">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" loading="lazy" className="mt-0.5 h-10 w-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <AppIcon name={p.source === 'telegram' ? 'send' : 'newspaper'} className="w-4 h-4 mt-0.5 shrink-0 text-navy/70" />
                )}
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold break-words">{p.title}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        p.published ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {t(p.published ? 'admin.newsFeed.published' : 'admin.newsFeed.draft')}
                    </span>
                  </span>
                  {p.body && <span className="block text-navy/70 break-words">{p.body}</span>}
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" dir="ltr" className="block text-xs text-navy underline break-all">
                      {p.url}
                    </a>
                  )}
                </span>
                <span className="text-xs text-gray-500 shrink-0">
                  {new Date(p.createdAt).toLocaleDateString(i18n.language)}
                </span>
                <button
                  onClick={() => setConfirmToggle({ id: p.id, next: !p.published, title: p.title })}
                  className="shrink-0 btn-secondary !h-8 px-2.5 text-xs"
                >
                  {t(p.published ? 'admin.newsFeed.unpublish' : 'admin.newsFeed.publishDraft')}
                </button>
                <button
                  onClick={() => setConfirmRemoveId(p.id)}
                  aria-label={t('common.delete')}
                  className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-brand-red hover:bg-brand-red/10"
                >
                  <AppIcon name="trash" className="w-4 h-4" />
                </button>
              </li>
            ))}
            </ul>
          </>
          );
        }}
      </SectionState>
    </div>
  );
}
