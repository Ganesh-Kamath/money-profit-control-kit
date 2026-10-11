import { describe, it, expect } from 'vitest';
import {
  formatINR,
  parseINRToPaise,
  getPeriodBoundaries,
  CalculationEngine,
  type TransactionRecord,
  type InvoiceRecord,
} from '../src/engine/calculationEngine';

describe('CalculationEngine & Currency Rules', () => {
  it('formats integer paise to Indian currency with correct commas', () => {
    expect(formatINR(12500000)).toBe('₹1,25,000.00');
    expect(formatINR(25000)).toBe('₹250.00');
    expect(formatINR(0)).toBe('₹0.00');
    expect(formatINR(-45000)).toBe('-₹450.00');
    expect(formatINR(1000000000)).toBe('₹1,00,00,000.00'); // 1 Crore
  });

  it('parses formatted Indian amounts to integer paise without float errors', () => {
    expect(parseINRToPaise('1,25,000.00')).toBe(12500000);
    expect(parseINRToPaise('₹250')).toBe(25000);
    expect(parseINRToPaise('450.50')).toBe(45050);
    expect(parseINRToPaise('-₹500.00')).toBe(-50000);
    expect(parseINRToPaise('0')).toBe(0);
  });

  it('strictly excludes transfers from revenue and expenses', () => {
    const transactions: TransactionRecord[] = [
      { id: '1', type: 'income', amountPaise: 100000, occurredAt: '2026-10-10', status: 'active', description: 'Cake Sale' },
      { id: '2', type: 'expense', amountPaise: 40000, occurredAt: '2026-10-10', status: 'active', description: 'Packaging' },
      // Transfer of ₹50,000 from UPI to Bank
      { id: '3', type: 'transfer', amountPaise: 5000000, occurredAt: '2026-10-10', status: 'active', description: 'UPI to Bank' },
    ];

    const metrics = CalculationEngine.calculateMetrics(transactions);
    expect(metrics.revenuePaise).toBe(100000); // ₹1,000
    expect(metrics.totalExpensePaise).toBe(40000); // ₹400
    expect(metrics.estimatedNetProfitPaise).toBe(60000); // ₹600
    expect(metrics.netMarginPct).toBe(60);
    expect(metrics.transfersVolumePaise).toBe(5000000); // Tracked separately
  });

  it('excludes voided transactions from all financial metrics', () => {
    const transactions: TransactionRecord[] = [
      { id: '1', type: 'income', amountPaise: 50000, occurredAt: '2026-10-10', status: 'active', description: 'Active Sale' },
      { id: '2', type: 'income', amountPaise: 30000, occurredAt: '2026-10-10', status: 'voided', description: 'Voided Sale' },
      { id: '3', type: 'expense', amountPaise: 20000, occurredAt: '2026-10-10', status: 'active', description: 'Active Expense' },
      { id: '4', type: 'expense', amountPaise: 15000, occurredAt: '2026-10-10', status: 'voided', description: 'Voided Expense' },
    ];

    const metrics = CalculationEngine.calculateMetrics(transactions);
    expect(metrics.revenuePaise).toBe(50000);
    expect(metrics.totalExpensePaise).toBe(20000);
    expect(metrics.estimatedNetProfitPaise).toBe(30000);
    expect(metrics.activeTransactionsCount).toBe(2);
  });

  it('tracks unpaid invoice receivables without double-counting revenue', () => {
    const invoices: InvoiceRecord[] = [
      { id: 'inv1', invoiceNumber: 'INV-01', totalAmountPaise: 200000, paidAmountPaise: 50000, status: 'partially_paid' },
      { id: 'inv2', invoiceNumber: 'INV-02', totalAmountPaise: 100000, paidAmountPaise: 0, status: 'unpaid' },
      { id: 'inv3', invoiceNumber: 'INV-03', totalAmountPaise: 80000, paidAmountPaise: 80000, status: 'paid' },
    ];

    const transactions: TransactionRecord[] = [
      { id: 't1', type: 'income', amountPaise: 50000, occurredAt: '2026-10-10', status: 'active', description: 'Collected Partial' },
      { id: 't2', type: 'income', amountPaise: 80000, occurredAt: '2026-10-10', status: 'active', description: 'Collected Paid' },
    ];

    const metrics = CalculationEngine.calculateMetrics(transactions, invoices);
    // Outstanding = (200,000 - 50,000) + 100,000 = 250,000 paise (₹2,500.00)
    expect(metrics.totalReceivablesPaise).toBe(250000);
    expect(metrics.unpaidInvoicesCount).toBe(2);
    // Revenue is recognized from ledger transactions without duplicating unpaid amounts
    expect(metrics.revenuePaise).toBe(130000);
  });

  it('calculates gross profit and margin based on manual COGS', () => {
    const transactions: TransactionRecord[] = [
      { id: '1', type: 'income', amountPaise: 200000, occurredAt: '2026-10-10', status: 'active', description: 'Sales' },
      { id: '2', type: 'expense', amountPaise: 50000, occurredAt: '2026-10-10', status: 'active', description: 'Operating Expense' },
    ];

    // Manual COGS = ₹600 (60,000 paise)
    const metrics = CalculationEngine.calculateMetrics(transactions, [], 60000);
    expect(metrics.grossProfitPaise).toBe(140000); // 200,000 - 60,000
    expect(metrics.grossMarginPct).toBe(70);
    expect(metrics.estimatedNetProfitPaise).toBe(150000); // 200,000 - 50,000
  });

  it('calculates Indian Financial Year boundary correctly (April 1 start)', () => {
    // Reference date in October 2026 -> FY is Apr 1, 2026 to Mar 31, 2027
    const refOct = new Date(2026, 9, 15);
    const { start: startOct, end: endOct } = getPeriodBoundaries('this_fy', refOct, 4);
    expect(startOct.getFullYear()).toBe(2026);
    expect(startOct.getMonth()).toBe(3); // April (0-indexed 3)
    expect(startOct.getDate()).toBe(1);
    expect(endOct.getFullYear()).toBe(2027);
    expect(endOct.getMonth()).toBe(2); // March (0-indexed 2)

    // Reference date in January 2027 -> FY is still Apr 1, 2026 to Mar 31, 2027
    const refJan = new Date(2027, 0, 10);
    const { start: startJan, end: endJan } = getPeriodBoundaries('this_fy', refJan, 4);
    expect(startJan.getFullYear()).toBe(2026);
    expect(startJan.getMonth()).toBe(3);
    expect(endJan.getFullYear()).toBe(2027);
    expect(endJan.getMonth()).toBe(2);
  });

  it('detects duplicate transactions within window', () => {
    const existing: TransactionRecord[] = [
      { id: 'tx1', type: 'expense', amountPaise: 150000, occurredAt: '2026-10-10T10:00:00Z', description: 'Wheat Flour purchase', status: 'active' },
      { id: 'tx2', type: 'expense', amountPaise: 20000, occurredAt: '2026-10-09T14:00:00Z', description: 'Auto fare', status: 'active' },
    ];
    const candidate = {
      amountPaise: 150000,
      occurredAt: '2026-10-11T09:30:00Z',
      description: 'Wheat flour purchase',
    };
    const duplicates = CalculationEngine.detectDuplicates(candidate, existing, 2);
    expect(duplicates.length).toBe(1);
    expect(duplicates[0].id).toBe('tx1');
  });

  it('identifies statistical outlier expenses neutrally', () => {
    const expenses: TransactionRecord[] = [
      { id: 'e1', type: 'expense', amountPaise: 20000, occurredAt: '2026-10-01', status: 'active', description: 'Eggs' },
      { id: 'e2', type: 'expense', amountPaise: 25000, occurredAt: '2026-10-02', status: 'active', description: 'Sugar' },
      { id: 'e3', type: 'expense', amountPaise: 30000, occurredAt: '2026-10-03', status: 'active', description: 'Butter' },
      { id: 'e4', type: 'expense', amountPaise: 22000, occurredAt: '2026-10-04', status: 'active', description: 'Milk' },
      // Outlier of ₹6,000 (600,000 paise) exceeding user threshold ₹5,000
      { id: 'e5', type: 'expense', amountPaise: 600000, occurredAt: '2026-10-05', status: 'active', description: 'Bulk Vanilla' },
    ];
    const outliers = CalculationEngine.detectUnusualExpenses(expenses, 500000);
    expect(outliers.length).toBe(1);
    expect(outliers[0].transaction.id).toBe('e5');
    expect(outliers[0].reason).toContain('exceeds your alert threshold');
  });
});
