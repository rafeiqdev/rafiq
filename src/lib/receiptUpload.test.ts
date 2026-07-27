import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * S3 regression suite — a payment claim with no proof.
 *
 * checkout.manual() used to wrap the receipt upload in `if (!up.error)` with no
 * else. A failed upload therefore fell through and inserted the payments row
 * anyway with receipt_path null: the customer saw "submitted, awaiting
 * verification", the admin saw a claim with no evidence, and nothing anywhere
 * said the receipt had been lost. A missing `receipts` bucket or a storage RLS
 * change would have done this to every receipt silently.
 */

let uploadResult: { error: { message: string } | null } = { error: null };
const inserted: unknown[] = [];

vi.mock('./supabase', () => {
  const insertBuilder = {
    select: () => insertBuilder,
    single: () => Promise.resolve({ data: { id: 'pay-1', status: 'pending' }, error: null }),
  };
  const table = () => ({
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { email: 'a@b.c' }, error: null }) }) }),
    insert: (row: unknown) => {
      inserted.push(row);
      return insertBuilder;
    },
  });
  return {
    supabase: {
      auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } } }) },
      from: () => table(),
      storage: { from: () => ({ upload: () => Promise.resolve(uploadResult) }) },
    },
    supabaseEnabled: true,
  };
});

import { ApiError, checkout } from './api';

const receipt = () => new File(['x'], 'receipt.png', { type: 'image/png' });

beforeEach(() => {
  inserted.length = 0;
  uploadResult = { error: null };
});

describe('checkout.manual() with a receipt', () => {
  it('records the payment when the upload succeeds', async () => {
    uploadResult = { error: null };

    await expect(checkout.manual('pro', 'monthly', 'bank', receipt())).resolves.toMatchObject({
      id: 'pay-1',
    });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ receipt_name: 'receipt.png' });
  });

  it('throws receipt_upload_failed instead of reporting success', async () => {
    uploadResult = { error: { message: 'Bucket not found' } };

    await expect(checkout.manual('pro', 'monthly', 'bank', receipt())).rejects.toMatchObject({
      code: 'receipt_upload_failed',
      status: 502,
    });
  });

  it('records NO payment row when the receipt could not be stored', async () => {
    // The heart of it: no unbacked claim may reach the admin queue.
    uploadResult = { error: { message: 'Bucket not found' } };

    await checkout.manual('pro', 'monthly', 'bank', receipt()).catch(() => {});

    expect(inserted).toEqual([]);
  });

  it('throws an ApiError so the UI can pick the right message', async () => {
    // Checkout maps this code to checkout.result.receiptFailed rather than the
    // default "no charge was made", which would be false when the transfer went
    // through and only the upload broke.
    uploadResult = { error: { message: 'permission denied' } };

    await expect(checkout.manual('pro', 'monthly', 'bank', receipt())).rejects.toBeInstanceOf(ApiError);
  });

  it('still works for a payment submitted without a receipt', async () => {
    // Card payments pass no file; the upload path must not run at all.
    uploadResult = { error: { message: 'should never be consulted' } };

    await expect(checkout.manual('pro', 'monthly', 'card')).resolves.toMatchObject({ id: 'pay-1' });
    expect(inserted[0]).toMatchObject({ receipt_path: null });
  });
});
