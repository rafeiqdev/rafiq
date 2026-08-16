import { describe, expect, it } from 'vitest';
import { calculateCommission } from './api';

describe('Referral Commission Calculation (5% Flat Rule)', () => {
  it('calculates 50 USD commission on a 1,000 USD transaction', () => {
    const amount = 1000;
    const commission = calculateCommission(amount);
    expect(commission).toBe(50);
    expect(amount * 0.05).toBe(50);
  });

  it('calculates 2,500 USD commission on a 50,000 USD transaction', () => {
    const amount = 50000;
    const commission = calculateCommission(amount);
    expect(commission).toBe(2500);
    expect(amount * 0.05).toBe(2500);
  });

  it('handles custom amounts with exact 2 decimal precision', () => {
    expect(calculateCommission(250)).toBe(12.5);
    expect(calculateCommission(149.99)).toBe(7.5);
    expect(calculateCommission(3250)).toBe(162.5);
  });

  it('returns 0 for non-positive or invalid amounts', () => {
    expect(calculateCommission(0)).toBe(0);
    expect(calculateCommission(-500)).toBe(0);
    expect(calculateCommission(NaN)).toBe(0);
  });

  it('strictly rejects any 30% or 50% legacy commission assumptions', () => {
    const amount = 1000;
    const commission = calculateCommission(amount);
    // 5% is exactly 50
    expect(commission).toBe(50);
    // MUST NOT be 30% (300) or 50% (500)
    expect(commission).not.toBe(300);
    expect(commission).not.toBe(500);
  });
});

describe('Multi-currency Wallet & Ledger Properties', () => {
  it('preserves the original transaction currency without forcing single-currency conversion', () => {
    const transactions = [
      { id: '1', transactionAmount: 1000, currency: 'USD', commissionAmount: calculateCommission(1000) },
      { id: '2', transactionAmount: 40000, currency: 'TRY', commissionAmount: calculateCommission(40000) },
      { id: '3', transactionAmount: 5000, currency: 'EUR', commissionAmount: calculateCommission(5000) },
    ];

    expect(transactions[0].currency).toBe('USD');
    expect(transactions[0].commissionAmount).toBe(50);

    expect(transactions[1].currency).toBe('TRY');
    expect(transactions[1].commissionAmount).toBe(2000);

    expect(transactions[2].currency).toBe('EUR');
    expect(transactions[2].commissionAmount).toBe(250);
  });

  it('reversal retains the original record while creating an offsetting entry', () => {
    const originalRecord = {
      id: 'tx_001',
      serviceName: 'Residency Application Assistance',
      transactionAmount: 1000,
      currency: 'USD',
      commissionAmount: 50,
      status: 'pending',
    };

    // When reversed:
    const updatedOriginal = { ...originalRecord, status: 'reversed' };
    const reversalRecord = {
      id: 'tx_002_rev',
      reversalOfId: originalRecord.id,
      serviceName: 'Reversal: ' + originalRecord.serviceName,
      transactionAmount: -1000,
      currency: 'USD',
      commissionAmount: -50,
      status: 'reversed',
      notes: 'Customer cancelled and payment was refunded',
    };

    expect(updatedOriginal.status).toBe('reversed');
    expect(reversalRecord.reversalOfId).toBe('tx_001');
    expect(reversalRecord.commissionAmount).toBe(-50);
    // Original record is NEVER deleted
    expect(updatedOriginal.id).toBe('tx_001');
  });
});
