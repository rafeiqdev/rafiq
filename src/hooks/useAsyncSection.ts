import { useCallback, useEffect, useState } from 'react';

export type SectionStatus = 'loading' | 'error' | 'ready';

export interface AsyncSection<T> {
  status: SectionStatus;
  /** Last successful value. Never a stand-in for "failed" — check status first. */
  data: T | null;
  reload: () => void;
}

/**
 * One independently-loading admin section.
 *
 * /admin used to load six unrelated things through a single Promise.all with a
 * bare `.catch(() => {})`. Promise.all rejects if ANY member rejects, so one
 * missing RPC skipped every setState that followed and blanked users, payments,
 * broadcasts, leads and cancellations simultaneously — with the reason
 * discarded. An admin could not tell that from a quiet week, which is exactly
 * what happened when admin_users_overview turned out not to exist.
 *
 * So each section owns its own request, its own status and its own retry.
 * `error` is a state in its own right and is never collapsed into an empty
 * list: the three outcomes a caller must render are loading, error, and
 * genuinely-empty.
 */
export function useAsyncSection<T>(fetcher: () => Promise<T>, deps: unknown[] = []): AsyncSection<T> {
  const [status, setStatus] = useState<SectionStatus>('loading');
  const [data, setData] = useState<T | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fetcher, deps);

  useEffect(() => {
    let live = true;
    setStatus('loading');
    run().then(
      (value) => {
        if (!live) return;
        setData(value);
        setStatus('ready');
      },
      (err) => {
        console.error('[useAsyncSection error]:', err);
        // Deliberately no data reset: a retry that fails should not also wipe
        // what was on screen. status is what the UI branches on.
        if (!live) return;
        setStatus('error');
      },
    );
    return () => {
      live = false;
    };
  }, [run, nonce]);

  return { status, data, reload };
}
