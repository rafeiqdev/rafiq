import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, news } from '../../lib/api';
import { AppIcon } from '../AppIcon';
import { SectionState } from '../SectionState';
import { useAsyncSection } from '../../hooks/useAsyncSection';

/**
 * The sync endpoint reports WHY it failed (no channel saved, Telegram down,
 * channel private, server env missing, wrong account, or — in local dev —
 * the Vercel function simply not existing behind Vite's /api proxy). A
 * generic "something went wrong" hid all of that from the owner; map each
 * failure to its own instruction instead.
 */
function syncErrorKey(e: unknown): string {
  if (e instanceof ApiError) {
    // Vite proxies /api to the legacy Express server, which has no
    // cron/telegram-sync route — the function only exists on Vercel.
    if (e.status === 404 || e.status === 405) return 'admin.newsFeed.errors.devOnly';
    switch (e.code) {
      case 'no_channel':
        return 'admin.newsFeed.errors.noChannel';
      case 'telegram_unreachable':
        return 'admin.newsFeed.errors.unreachable';
      case 'no_posts_parsed':
        return 'admin.newsFeed.errors.noPosts';
      case 'not_configured':
        return 'admin.newsFeed.errors.notConfigured';
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
 * which reach signed-in users only). Paste the PUBLIC channel's link and the
 * server pulls its latest posts — picture and text, with the channel's own
 * links scrubbed out — immediately on save/"sync now" and again daily by
 * cron. The manual form below stays for one-off items with no Telegram post.
 */
export function NewsFeedManager() {
  const { t, i18n } = useTranslation();
  const postsSec = useAsyncSection(() => news.adminList(), []);

  const [channel, setChannel] = useState('');
  const [channelSaved, setChannelSaved] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  /** i18n key of the failure to show, or null when all is well. */
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<'idle' | 'busy' | number>('idle');

  useEffect(() => {
    news.telegramChannel().then((c) => setChannel(c ?? ''), () => {});
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

  const saveChannel = async () => {
    setError(null);
    setChannelSaved(false);
    try {
      await news.setTelegramChannel(channel);
      setChannelSaved(true);
      // a fresh link should show results immediately, not tomorrow at cron time
      if (channel.trim()) await sync();
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

      {/* the channel behind the "follow us on Telegram" button */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label htmlFor="news-channel" className="text-xs font-semibold text-navy/85">
          {t('admin.newsFeed.channel')}
        </label>
        <input
          id="news-channel"
          className="input flex-1 min-w-[220px]"
          dir="ltr"
          placeholder="https://t.me/your_channel"
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value);
            setChannelSaved(false);
          }}
        />
        <button onClick={saveChannel} className="btn-secondary h-10 px-4 text-xs">
          <AppIcon name="save" className="w-3.5 h-3.5" />
          {t('common.save')}
        </button>
        <button onClick={sync} disabled={syncState === 'busy'} className="btn-primary h-10 px-4 text-xs disabled:opacity-60">
          <AppIcon name="send" className="w-3.5 h-3.5" />
          {t('admin.newsFeed.sync')}
        </button>
        {channelSaved && (
          <span role="status" className="text-xs font-semibold text-emerald-700">
            {t('admin.newsFeed.channelSaved')}
          </span>
        )}
        {typeof syncState === 'number' && (
          <span role="status" className="text-xs font-semibold text-emerald-700">
            {t('admin.newsFeed.synced', { count: syncState })}
          </span>
        )}
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
        <button onClick={publish} disabled={busy || !title.trim()} className="btn-primary px-5 disabled:opacity-60">
          <AppIcon name="megaphone" className="w-4 h-4" />
          {t('admin.newsFeed.publish')}
        </button>
      </div>

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
        {(rows) => (
          <ul className="mt-4 flex flex-col gap-2">
            {rows.map((p) => (
              <li key={p.id} className="rounded-xl bg-cream px-4 py-2.5 text-sm text-navy flex gap-2 items-start">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" loading="lazy" className="mt-0.5 h-10 w-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <AppIcon name={p.source === 'telegram' ? 'send' : 'newspaper'} className="w-4 h-4 mt-0.5 shrink-0 text-navy/70" />
                )}
                <span className="flex-1 min-w-0">
                  <span className="font-semibold break-words">{p.title}</span>
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
                  onClick={() => remove(p.id)}
                  aria-label={t('common.delete')}
                  className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-brand-red hover:bg-brand-red/10"
                >
                  <AppIcon name="trash" className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionState>
    </div>
  );
}
