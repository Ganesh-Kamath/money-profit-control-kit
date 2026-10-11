import { describe, it, expect, beforeEach } from 'vitest';
import { db, recalculateAccountBalance, type Account, type Transaction } from '../src/storage/db';

describe('Storage & Atomic Balance Integrity', () => {
  beforeEach(async () => {
    await db.accounts.clear();
    await db.transactions.clear();
  });

  it('maintains Opening + Inflows - Outflows = Closing balance property', async () => {
    const accountId = 'acc-bank-1';
    const initialAccount: Account = {
      id: accountId,
      workspaceId: 'ws-1',
      name: 'Bank Current',
      accountType: 'bank',
      openingBalancePaise: 1000000, // ₹10,000.00
      openingBalanceDate: '2026-10-01',
      currentBalancePaise: 1000000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.accounts.put(initialAccount);

    // 1. Inflow: ₹5,000 (500,000 paise)
    const tx1: Transaction = {
      id: 'tx-1',
      workspaceId: 'ws-1',
      type: 'income',
      amountPaise: 500000,
      occurredAt: '2026-10-02',
      accountId,
      description: 'Customer Payment',
      status: 'active',
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.transactions.put(tx1);
    const bal1 = await recalculateAccountBalance(db, accountId);
    expect(bal1).toBe(1500000); // 10,000 + 5,000 = ₹15,000

    // 2. Outflow: ₹3,200 (320,000 paise)
    const tx2: Transaction = {
      id: 'tx-2',
      workspaceId: 'ws-1',
      type: 'expense',
      amountPaise: 320000,
      occurredAt: '2026-10-03',
      accountId,
      description: 'Vendor Purchase',
      status: 'active',
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.transactions.put(tx2);
    const bal2 = await recalculateAccountBalance(db, accountId);
    expect(bal2).toBe(1180000); // 15,000 - 3,200 = ₹11,800

    // 3. Void tx2: balance should restore immediately
    await db.transactions.update('tx-2', { status: 'voided' });
    const bal3 = await recalculateAccountBalance(db, accountId);
    expect(bal3).toBe(1500000); // Restores back to ₹15,000
  });

  it('executes atomic transfers updating source and destination accounts simultaneously', async () => {
    const accSource: Account = {
      id: 'acc-src',
      workspaceId: 'ws-1',
      name: 'Source UPI',
      accountType: 'upi',
      openingBalancePaise: 500000, // ₹5,000
      openingBalanceDate: '2026-10-01',
      currentBalancePaise: 500000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const accDest: Account = {
      id: 'acc-dst',
      workspaceId: 'ws-1',
      name: 'Destination Bank',
      accountType: 'bank',
      openingBalancePaise: 200000, // ₹2,000
      openingBalanceDate: '2026-10-01',
      currentBalancePaise: 200000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.accounts.bulkPut([accSource, accDest]);

    // Atomic transfer of ₹1,500 (150,000 paise) inside a single Dexie transaction
    await db.transaction('rw', db.accounts, db.transactions, async () => {
      const transferTx: Transaction = {
        id: 'tx-xfer-1',
        workspaceId: 'ws-1',
        type: 'transfer',
        amountPaise: 150000,
        occurredAt: '2026-10-04',
        accountId: 'acc-src',
        toAccountId: 'acc-dst',
        description: 'Sweep to bank',
        status: 'active',
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.transactions.put(transferTx);
      await recalculateAccountBalance(db, 'acc-src');
      await recalculateAccountBalance(db, 'acc-dst');
    });

    const srcAfter = await db.accounts.get('acc-src');
    const dstAfter = await db.accounts.get('acc-dst');

    expect(srcAfter?.currentBalancePaise).toBe(350000); // 5,000 - 1,500 = ₹3,500
    expect(dstAfter?.currentBalancePaise).toBe(350000); // 2,000 + 1,500 = ₹3,500
  });

  it('ensures failed operations abort atomically leaving no partial state', async () => {
    const acc: Account = {
      id: 'acc-fail-test',
      workspaceId: 'ws-1',
      name: 'Safe Bank',
      accountType: 'bank',
      openingBalancePaise: 100000,
      openingBalanceDate: '2026-10-01',
      currentBalancePaise: 100000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.accounts.put(acc);

    // Intentionally inject an error midway through transaction
    await expect(
      db.transaction('rw', db.accounts, db.transactions, async () => {
        await db.transactions.put({
          id: 'tx-should-rollback',
          workspaceId: 'ws-1',
          type: 'income',
          amountPaise: 99900,
          occurredAt: '2026-10-05',
          accountId: 'acc-fail-test',
          description: 'Will fail',
          status: 'active',
          source: 'manual',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        await recalculateAccountBalance(db, 'acc-fail-test');
        // Simulated failure
        throw new Error('Injected storage failure!');
      })
    ).rejects.toThrow('Injected storage failure!');

    // Verify rollback: transaction must not exist, and account balance must remain unchanged
    const rolledBackTx = await db.transactions.get('tx-should-rollback');
    expect(rolledBackTx).toBeUndefined();

    const restoredAcc = await db.accounts.get('acc-fail-test');
    expect(restoredAcc?.currentBalancePaise).toBe(100000);
  });
});
