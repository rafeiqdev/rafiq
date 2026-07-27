import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Payment settings: shape compatibility, save/load round trip, and the rule
 * that matters most — an ENABLED but incomplete rail stays hidden from
 * customers. The toggle is not permission to display garbage.
 */

let settingsValue: unknown = null;
const upserted: unknown[] = [];

vi.mock('./supabase', () => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () =>
      Promise.resolve({ data: settingsValue === null ? null : { value: settingsValue }, error: null }),
    upsert: (row: unknown) => {
      upserted.push(row);
      return Promise.resolve({ error: null });
    },
  };
  return { supabase: { from: () => builder }, supabaseEnabled: true };
});

import { checkout, toCheckoutConfig, toCheckoutRow, toCheckoutSettings } from './api';
import { validateCheckoutSettings } from './checkoutValidation';

const REAL_IBAN = 'TR33 0006 1005 1978 6457 8413 26';
const REAL_TRC = 'TQrY8mFkD2vXjW3pZsN6bHcL9aGtE5uRw1';
const REAL_ERC = '0x52908400098527886E0F7030069857D2E4169EE7';

const settings = (over: Record<string, unknown> = {}) => ({
  bank: { enabled: true, iban: REAL_IBAN, holder: 'Rafiq Ltd', bankName: 'Ziraat' },
  crypto: { enabled: true, network: 'TRC20', wallet: REAL_TRC },
  gateways: [{ id: 'g1', label: 'iyzico', url: 'https://pay.example/checkout', enabled: true }],
  ...over,
});

beforeEach(() => {
  settingsValue = null;
  upserted.length = 0;
});

describe('shape compatibility', () => {
  it('reads a LEGACY hand-written row and treats its rails as enabled', async () => {
    // Rows written before the admin editor had no enabled flag; the only reason
    // to write one was to use it.
    settingsValue = { iban: REAL_IBAN, holder: 'Rafiq Ltd', wallet: REAL_TRC, network: 'TRC20' };

    const cfg = await checkout.config();

    expect(cfg.bankConfigured).toBe(true);
    expect(cfg.cryptoConfigured).toBe(true);
    expect(cfg.iban).toBe(REAL_IBAN);
  });

  it('does not enable a legacy rail whose value is absent', async () => {
    settingsValue = { iban: REAL_IBAN, holder: 'Rafiq Ltd' };

    const cfg = await checkout.config();

    expect(cfg.bankConfigured).toBe(true);
    expect(cfg.cryptoConfigured).toBe(false);
  });

  it('writes the legacy flat keys alongside the new shape', () => {
    // An older deployed bundle still reads iban/holder/wallet/network off the
    // top level; a row saved by the new UI must not break it mid-rollout.
    const row = toCheckoutRow(settings());

    expect(row).toMatchObject({
      iban: REAL_IBAN,
      holder: 'Rafiq Ltd',
      wallet: REAL_TRC,
      network: 'TRC20',
    });
    expect(row.bank).toBeDefined();
    expect(row.gateways).toHaveLength(1);
  });

  it('round-trips through save and load', async () => {
    await checkout.adminSave(settings());

    const row = (upserted[0] as { value: unknown }).value;
    settingsValue = row;

    expect(toCheckoutSettings(await Promise.resolve(row))).toMatchObject(settings());
    expect((await checkout.config()).bankConfigured).toBe(true);
  });

  it('survives a malformed row instead of throwing', async () => {
    settingsValue = { bank: 'not an object', gateways: 'nope' };

    const cfg = await checkout.config();

    expect(cfg.bankConfigured).toBe(false);
    expect(cfg.gateways).toEqual([]);
  });
});

describe('enabled-but-incomplete stays hidden from customers', () => {
  it('hides a bank rail that is ON but still holds the placeholder IBAN', () => {
    const cfg = toCheckoutConfig(
      settings({ bank: { enabled: true, iban: 'TR00 0000 0000 0000 0000 0000 00', holder: 'x', bankName: '' } }),
    );

    expect(cfg.bankConfigured).toBe(false);
  });

  it('hides a bank rail that is ON but has no account holder', () => {
    const cfg = toCheckoutConfig(
      settings({ bank: { enabled: true, iban: REAL_IBAN, holder: '   ', bankName: '' } }),
    );

    expect(cfg.bankConfigured).toBe(false);
  });

  it('hides a crypto rail that is ON but still holds the placeholder wallet', () => {
    const cfg = toCheckoutConfig(
      settings({ crypto: { enabled: true, network: 'TRC20', wallet: 'TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' } }),
    );

    expect(cfg.cryptoConfigured).toBe(false);
  });

  it('hides a complete rail that is switched OFF', () => {
    const cfg = toCheckoutConfig(settings({ bank: { enabled: false, iban: REAL_IBAN, holder: 'Rafiq Ltd', bankName: '' } }));

    expect(cfg.bankConfigured).toBe(false);
  });

  it('drops gateways that are off, unlabelled, or not https', () => {
    const cfg = toCheckoutConfig(
      settings({
        gateways: [
          { id: 'a', label: 'ok', url: 'https://ok.example', enabled: true },
          { id: 'b', label: 'off', url: 'https://off.example', enabled: false },
          { id: 'c', label: 'insecure', url: 'http://plain.example', enabled: true },
          { id: 'd', label: '', url: 'https://nolabel.example', enabled: true },
        ],
      }),
    );

    expect(cfg.gateways.map((g) => g.id)).toEqual(['a']);
  });

  it('shows both rails when everything is complete and on', () => {
    const cfg = toCheckoutConfig(settings());

    expect(cfg.bankConfigured).toBe(true);
    expect(cfg.cryptoConfigured).toBe(true);
    expect(cfg.gateways).toHaveLength(1);
  });
});

describe('save-time validation', () => {
  it('accepts a fully configured set', () => {
    expect(validateCheckoutSettings(settings())).toEqual({});
  });

  it('rejects an IBAN that is not TR + 24 digits', () => {
    const e = validateCheckoutSettings(settings({ bank: { enabled: true, iban: 'TR12 3456', holder: 'Rafiq Ltd', bankName: '' } }));

    expect(e['bank.iban']).toBe('admin.paymentSettings.errors.iban');
  });

  it('tolerates and normalises spacing in a valid IBAN', () => {
    const e = validateCheckoutSettings(
      settings({ bank: { enabled: true, iban: 'TR330006100519786457841326', holder: 'Rafiq Ltd', bankName: '' } }),
    );

    expect(e['bank.iban']).toBeUndefined();
  });

  it('rejects the placeholder IBAN specifically', () => {
    const e = validateCheckoutSettings(
      settings({ bank: { enabled: true, iban: 'TR00 0000 0000 0000 0000 0000 00', holder: 'Rafiq Ltd', bankName: '' } }),
    );

    expect(e['bank.iban']).toBeDefined();
  });

  it('rejects a missing account holder', () => {
    const e = validateCheckoutSettings(settings({ bank: { enabled: true, iban: REAL_IBAN, holder: 'x', bankName: '' } }));

    expect(e['bank.holder']).toBe('admin.paymentSettings.errors.holder');
  });

  it('rejects a TRC20 address on an ERC20 network', () => {
    // Pasting the wrong chain's address is a lost payment, not a typo.
    const e = validateCheckoutSettings(settings({ crypto: { enabled: true, network: 'ERC20', wallet: REAL_TRC } }));

    expect(e['crypto.wallet']).toBe('admin.paymentSettings.errors.walletNetwork');
  });

  it('accepts an ERC20 address on an ERC20 network', () => {
    const e = validateCheckoutSettings(settings({ crypto: { enabled: true, network: 'ERC20', wallet: REAL_ERC } }));

    expect(e['crypto.wallet']).toBeUndefined();
  });

  it('rejects a blank network', () => {
    const e = validateCheckoutSettings(settings({ crypto: { enabled: true, network: '  ', wallet: REAL_TRC } }));

    expect(e['crypto.network']).toBe('admin.paymentSettings.errors.network');
  });

  it('rejects a non-https gateway URL', () => {
    const e = validateCheckoutSettings(
      settings({ gateways: [{ id: 'g', label: 'x', url: 'http://insecure.example', enabled: true }] }),
    );

    expect(e['gateways.0.url']).toBe('admin.paymentSettings.errors.gatewayUrl');
  });

  it('rejects an unlabelled enabled gateway', () => {
    const e = validateCheckoutSettings(
      settings({ gateways: [{ id: 'g', label: '  ', url: 'https://ok.example', enabled: true }] }),
    );

    expect(e['gateways.0.label']).toBe('admin.paymentSettings.errors.gatewayLabel');
  });

  it('does NOT validate a disabled group, so half-finished work can be saved', () => {
    const e = validateCheckoutSettings(
      settings({
        bank: { enabled: false, iban: 'nonsense', holder: '', bankName: '' },
        crypto: { enabled: false, network: '', wallet: '' },
        gateways: [{ id: 'g', label: '', url: 'not a url', enabled: false }],
      }),
    );

    expect(e).toEqual({});
  });
});

describe('no secret ever reaches the anon-readable settings row', () => {
  it('persists only label, url, enabled and id for a gateway', async () => {
    await checkout.adminSave(
      settings({
        gateways: [
          // Anything extra a caller might try to smuggle in must not survive.
          { id: 'g1', label: 'iyzico', url: 'https://pay.example', enabled: true } as never,
        ],
      }),
    );

    const row = (upserted[0] as { value: { gateways: Record<string, unknown>[] } }).value;
    expect(Object.keys(row.gateways[0]).sort()).toEqual(['enabled', 'id', 'label', 'url']);
  });

  it('the persisted row contains no key that looks like a credential', async () => {
    await checkout.adminSave(settings());

    const json = JSON.stringify(upserted[0]).toLowerCase();
    for (const word of ['secret', 'apikey', 'api_key', 'privatekey', 'token', 'password']) {
      expect(json).not.toContain(word);
    }
  });
});
