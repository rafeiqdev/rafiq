import { useEffect, useState } from 'react';
import { investments as investmentsApi } from '../lib/api';
import { seedRecords } from '../data/investments';
import type { InvestmentRecord } from '../lib/types';

/**
 * Investment opportunities for the public pages.
 *
 * Reads the database first and falls back to the built-in catalogue when the
 * table is missing, unreadable, or still empty. Without the fallback the whole
 * section would vanish the moment the migration lagged behind a deploy — a
 * silent disappearance is worse than slightly stale copy, because nobody
 * notices it and the strip on /real-estate would lead to an empty page.
 *
 * `source` tells the admin panel which one is live, so "my edit did not show
 * up" has a visible answer instead of being a mystery.
 */
export function useInvestments(): {
  items: InvestmentRecord[];
  loading: boolean;
  source: 'db' | 'seed';
} {
  const [items, setItems] = useState<InvestmentRecord[]>([]);
  const [source, setSource] = useState<'db' | 'seed'>('seed');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    investmentsApi
      .list()
      .then((rows) => {
        if (!alive) return;
        if (rows.length > 0) {
          setItems(rows);
          setSource('db');
        } else {
          setItems(seedRecords());
          setSource('seed');
        }
      })
      .catch(() => {
        if (!alive) return;
        setItems(seedRecords());
        setSource('seed');
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return { items, loading, source };
}
