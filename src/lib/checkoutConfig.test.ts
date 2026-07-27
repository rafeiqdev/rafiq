import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * B4 regression suite — placeholder payment details shown as real ones.
 *
 * checkout.config() spread DEFAULT_CHECKOUT over whatever the settings row
 * held and returned it as if it were genuine, so a missing row meant the
 * customer was told to transfer money to IBAN "TR00 0000 0000 0000 0000 0000
 * 00" and a "TXXXX..." wallet. Verified against the live database on
 * 2026-07-27: the settings table held one row (company_plan) and NO checkout
 * row, so this was live.
 *
 * Detection is BY VALUE, not by row existence — the row can exist and still
 * contain the dummy data, which any existence check would call "configured".
 */

let settingsValue: unknown = null;

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: settingsValue === null ? null : { value: settingsValue }, error: null }) }),
      }),
    }),
  },
  supabaseEnabled: true,
}));

import { checkout } from './api';

const REAL = {
  iban: 'TR33 0006 1005 1978 6457 8413 26',
  holder: 'Rafiq Istanbul Danışmanlık Ltd. Şti.',
  wallet: 'TQrY8mFkD2vXjW3pZsN6bHcL9aGtE5uRw1',
  network: 'TRC-20 (USDT/USDC)',
};

beforeEach(() => {
  settingsValue = null;
});

describe('when the settings row is absent (the live state)', () => {
  it('reports both manual rails as unconfigured', async () => {
    settingsValue = null;

    const cfg = await checkout.config();

    expect(cfg.bankConfigured).toBe(false);
    expect(cfg.cryptoConfigured).toBe(false);
  });
});

describe('when the row exists but still holds the placeholders', () => {
  it('is not fooled by a row that merely exists', async () => {
    settingsValue = {
      iban: 'TR00 0000 0000 0000 0000 0000 00',
      holder: 'Rafiq Istanbul',
      wallet: 'TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      network: 'TRC20 (USDT)',
    };

    const cfg = await checkout.config();

    expect(cfg.bankConfigured).toBe(false);
    expect(cfg.cryptoConfigured).toBe(false);
  });

  it.each([
    ['differently spaced zeros', 'TR000000000000000000000000'],
    ['zeros with odd grouping', 'TR00 000000 0000 00000000 00'],
    ['another country prefix', 'DE00000000000000000000'],
    ['empty string', ''],
    ['too short to be an IBAN', 'TR33 0006'],
  ])('rejects the IBAN: %s', async (_label, iban) => {
    settingsValue = { ...REAL, iban };

    expect((await checkout.config()).bankConfigured).toBe(false);
  });

  it.each([
    ['the TXXXX placeholder', 'TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'],
    ['bare Xs', 'XXXXXXXXXXXXXXXXXXXXXXXXX'],
    ['a single repeated character', 'TTTTTTTTTTTTTTTTTTTTTTTTTT'],
    ['empty string', ''],
    ['too short to be an address', 'TQrY8mFkD2'],
  ])('rejects the wallet: %s', async (_label, wallet) => {
    settingsValue = { ...REAL, wallet };

    expect((await checkout.config()).cryptoConfigured).toBe(false);
  });
});

describe('when real details are on file', () => {
  it('enables both rails and returns the real values', async () => {
    settingsValue = REAL;

    const cfg = await checkout.config();

    expect(cfg.bankConfigured).toBe(true);
    expect(cfg.cryptoConfigured).toBe(true);
    expect(cfg.iban).toBe(REAL.iban);
    expect(cfg.wallet).toBe(REAL.wallet);
  });

  it('enables the rails independently', async () => {
    // A real IBAN with no crypto wallet yet must offer bank but not crypto.
    settingsValue = { ...REAL, wallet: 'TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' };

    const cfg = await checkout.config();

    expect(cfg.bankConfigured).toBe(true);
    expect(cfg.cryptoConfigured).toBe(false);
  });
});
