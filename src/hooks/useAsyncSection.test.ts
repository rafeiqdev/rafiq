import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAsyncSection } from './useAsyncSection';

/**
 * /admin loaded six unrelated sections through one Promise.all with a bare
 * `.catch(() => {})`. Promise.all rejects if any member rejects, so a single
 * missing RPC skipped every setState after the await and blanked users,
 * payments, broadcasts, leads and cancellations at once — silently. On a
 * dashboard that is indistinguishable from a quiet week.
 *
 * The property under test is that failure is a STATE, never an empty result.
 */
describe('useAsyncSection', () => {
  it('reports ready with the value', async () => {
    const { result } = renderHook(() => useAsyncSection(() => Promise.resolve([1, 2, 3]), []));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data).toEqual([1, 2, 3]);
  });

  it('starts in loading, never in empty', () => {
    const { result } = renderHook(() => useAsyncSection(() => new Promise(() => {}), []));

    expect(result.current.status).toBe('loading');
    // The critical bit: no data yet is null, not [] — a caller cannot mistake
    // "not answered yet" for "answered, nothing there".
    expect(result.current.data).toBeNull();
  });

  it('reports error on rejection and does NOT return an empty list', async () => {
    const { result } = renderHook(() => useAsyncSection(() => Promise.reject(new Error('boom')), []));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.data).toBeNull();
    expect(result.current.data).not.toEqual([]);
  });

  it('retries just this section, and recovers', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(['recovered']);
    const { result } = renderHook(() => useAsyncSection(fetcher, []));

    await waitFor(() => expect(result.current.status).toBe('error'));
    act(() => result.current.reload());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data).toEqual(['recovered']);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps the last good data visible when a retry fails again', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(['first'])
      .mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useAsyncSection(fetcher, []));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.reload());

    await waitFor(() => expect(result.current.status).toBe('error'));
    // status is what the UI branches on; stale data is not wiped so a failed
    // refresh cannot blank a section that was working a second ago.
    expect(result.current.data).toEqual(['first']);
  });

  it('one section failing cannot affect another', async () => {
    const good = renderHook(() => useAsyncSection(() => Promise.resolve(['ok']), []));
    const bad = renderHook(() => useAsyncSection(() => Promise.reject(new Error('boom')), []));

    await waitFor(() => expect(bad.result.current.status).toBe('error'));
    await waitFor(() => expect(good.result.current.status).toBe('ready'));
    expect(good.result.current.data).toEqual(['ok']);
  });
});
