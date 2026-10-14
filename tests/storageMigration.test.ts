import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { db, ControlKitDatabase, type Account, type Transaction, type Invoice } from '../src/storage/db';

describe('Dexie Storage Schema v1 -> v2 Migration', () => {
  it('preserves existing v1 data intact when opening the v2 database', async () => {
    // 1. Create a dummy test database under a separate name to simulate v1
    const testDbName = `MigrationTestDB_${Date.now()}`;
    const v1Db = new Dexie(testDbName);
    v1Db.version(1).stores({
      workspaces: 'id, name, isDemo',
      categories: 'id, workspaceId, type, [workspaceId+type]',
      accounts: 'id, workspaceId, name, [workspaceId+name]',
      transactions: 'id, workspaceId, occurredAt, accountId, categoryId, status, idempotencyKey, [workspaceId+status], [workspaceId+occurredAt]',
      receipts: 'id, workspaceId, transactionId, sha256Hash, status, [workspaceId+sha256Hash]',
      contacts: 'id, workspaceId, name',
      invoices: 'id, workspaceId, status, dueDate, [workspaceId+status]',
      reconciliations: 'id, workspaceId, accountId',
      periodLocks: 'id, workspaceId, periodEndDate, [workspaceId+periodEndDate]',
      auditEvents: 'id, workspaceId, entityId, createdAt',
      alerts: 'id, workspaceId, isDismissed, [workspaceId+isDismissed]',
      license: 'id',
      appSecurity: 'id',
    });

    await v1Db.open();

    // Insert v1 sample records
    await v1Db.table('accounts').put({
      id: 'acc-v1-1',
      workspaceId: 'ws-v1',
      name: 'Cash Box',
      accountType: 'cash',
      openingBalancePaise: 500000,
      openingBalanceDate: '2026-01-01',
      currentBalancePaise: 500000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await v1Db.table('transactions').put({
      id: 'tx-v1-1',
      workspaceId: 'ws-v1',
      type: 'income',
      amountPaise: 125000,
      occurredAt: '2026-01-02',
      accountId: 'acc-v1-1',
      description: 'First v1 Sale',
      status: 'active',
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await v1Db.table('invoices').put({
      id: 'inv-v1-1',
      workspaceId: 'ws-v1',
      invoiceNumber: 'INV-001',
      contactName: 'Mr. Sharma',
      issueDate: '2026-01-03',
      dueDate: '2026-01-10',
      totalAmountPaise: 250000,
      paidAmountPaise: 0,
      status: 'unpaid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await v1Db.close();

    // 2. Open with v2 definition including new tables and upgrade handler
    const v2Db = new Dexie(testDbName);
    v2Db.version(1).stores({
      workspaces: 'id, name, isDemo',
      categories: 'id, workspaceId, type, [workspaceId+type]',
      accounts: 'id, workspaceId, name, [workspaceId+name]',
      transactions: 'id, workspaceId, occurredAt, accountId, categoryId, status, idempotencyKey, [workspaceId+status], [workspaceId+occurredAt]',
      receipts: 'id, workspaceId, transactionId, sha256Hash, status, [workspaceId+sha256Hash]',
      contacts: 'id, workspaceId, name',
      invoices: 'id, workspaceId, status, dueDate, [workspaceId+status]',
      reconciliations: 'id, workspaceId, accountId',
      periodLocks: 'id, workspaceId, periodEndDate, [workspaceId+periodEndDate]',
      auditEvents: 'id, workspaceId, entityId, createdAt',
      alerts: 'id, workspaceId, isDismissed, [workspaceId+isDismissed]',
      license: 'id',
      appSecurity: 'id',
    });

    v2Db.version(2).stores({
      workspaces: 'id, name, isDemo',
      categories: 'id, workspaceId, type, [workspaceId+type]',
      accounts: 'id, workspaceId, name, [workspaceId+name]',
      transactions: 'id, workspaceId, occurredAt, accountId, categoryId, status, idempotencyKey, [workspaceId+status], [workspaceId+occurredAt]',
      receipts: 'id, workspaceId, transactionId, sha256Hash, status, [workspaceId+sha256Hash]',
      contacts: 'id, workspaceId, name',
      invoices: 'id, workspaceId, status, dueDate, [workspaceId+status]',
      reconciliations: 'id, workspaceId, accountId',
      periodLocks: 'id, workspaceId, periodEndDate, [workspaceId+periodEndDate]',
      auditEvents: 'id, workspaceId, entityId, createdAt',
      alerts: 'id, workspaceId, isDismissed, [workspaceId+isDismissed]',
      license: 'id',
      appSecurity: 'id',
      businessProfiles: 'id, workspaceId',
      categorisationRules: 'id, workspaceId, pattern, categoryId',
      recurringEntries: 'id, workspaceId, frequency, nextDueDate, status',
      dailyCashReconciliations: 'id, workspaceId, date',
    }).upgrade(async (tx) => {
      await tx.table('invoices').toCollection().modify((inv: any) => {
        if (inv.isTaxInvoice === undefined) {
          inv.isTaxInvoice = false;
        }
      });
    });

    await v2Db.open();

    // 3. Verify all existing data was preserved
    const account = await v2Db.table('accounts').get('acc-v1-1');
    expect(account).toBeDefined();
    expect(account.name).toBe('Cash Box');
    expect(account.currentBalancePaise).toBe(500000);

    const tx = await v2Db.table('transactions').get('tx-v1-1');
    expect(tx).toBeDefined();
    expect(tx.amountPaise).toBe(125000);

    const inv = await v2Db.table('invoices').get('inv-v1-1');
    expect(inv).toBeDefined();
    expect(inv.totalAmountPaise).toBe(250000);
    expect(inv.isTaxInvoice).toBe(false); // Upgraded default

    // 4. Verify new tables are usable
    await v2Db.table('categorisationRules').put({
      id: 'rule-1',
      workspaceId: 'ws-v1',
      pattern: 'swiggy',
      categoryId: 'cat-food',
      matchType: 'contains',
      autoApplyOnImport: true,
      createdAt: new Date().toISOString(),
    });

    const rule = await v2Db.table('categorisationRules').get('rule-1');
    expect(rule).toBeDefined();
    expect(rule.pattern).toBe('swiggy');

    await v2Db.close();
    await Dexie.delete(testDbName);
  });
});
