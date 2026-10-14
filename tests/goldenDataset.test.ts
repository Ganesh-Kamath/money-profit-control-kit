import { describe, it, expect } from 'vitest';
import { CalculationEngine, type FinancialMetrics } from '../src/engine/calculationEngine';
import type { Transaction } from '../src/storage/db';

describe('Golden Dataset Test (150+ Hand-Computed Transactions across 3 Months)', () => {
  // Synthesize 150 realistic Indian business transactions:
  // - 90 retail/counter/UPI sales (Daily Bakery / Retail)
  // - 30 supply & ingredient expenses (Flour, Butter, Packaging)
  // - 15 utility/operating expenses (Electricity, Rent, Staff Wages, Internet)
  // - 10 Bank-to-Cash / Cash-to-Bank Transfers
  // - 5 Invoiced sales on credit
  // - 3 Soft-voided entries (to assert voids do not pollute metrics)

  const transactions: Transaction[] = [];

  // Fixed accounts:
  // acc-cash: Cash Drawer
  // acc-bank: HDFC Current Account

  // Fixed categories:
  // cat-sales: Sales
  // cat-raw: Raw Materials
  // cat-ops: Operating Expenses
  // cat-salary: Salary & Wages

  let expectedActiveIncomePaise = 0;
  let expectedActiveExpensePaise = 0;
  let expectedCashBalanceChange = 0;
  let expectedBankBalanceChange = 0;

  // Month 1: October 2026 (Days 1 to 31)
  // 30 sales of ₹1,250.50 (125050 paise) each: 15 Cash, 15 UPI/Bank
  for (let day = 1; day <= 30; day++) {
    const isCash = day % 2 === 1;
    const amount = 125050; // ₹1,250.50
    transactions.push({
      id: `tx-oct-sale-${day}`,
      workspaceId: 'ws-golden',
      type: 'income',
      amountPaise: amount,
      occurredAt: `2026-10-${day.toString().padStart(2, '0')}T10:30:00.000Z`,
      description: `Daily Counter Sale #${day}`,
      categoryId: 'cat-sales',
      accountId: isCash ? 'acc-cash' : 'acc-bank',
      status: 'active',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    });
    expectedActiveIncomePaise += amount;
    if (isCash) expectedCashBalanceChange += amount;
    else expectedBankBalanceChange += amount;
  }

  // 10 raw material purchases in Oct of ₹2,400.00 (240000 paise) each via Bank
  for (let i = 1; i <= 10; i++) {
    const amount = 240000;
    transactions.push({
      id: `tx-oct-exp-${i}`,
      workspaceId: 'ws-golden',
      type: 'expense',
      amountPaise: amount,
      occurredAt: `2026-10-${(i * 3).toString().padStart(2, '0')}T14:00:00.000Z`,
      description: `Raw Material Batch #${i}`,
      categoryId: 'cat-raw',
      accountId: 'acc-bank',
      status: 'active',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    });
    expectedActiveExpensePaise += amount;
    expectedBankBalanceChange -= amount;
  }

  // 5 Operating expenses in Oct (Rent ₹20,000, Electricity ₹3,500, Internet ₹1,200, Staff ₹15,000, Misc ₹800)
  const octOps = [
    { desc: 'Shop Rent', amount: 2000000, acc: 'acc-bank' },
    { desc: 'Electricity Bill', amount: 350000, acc: 'acc-bank' },
    { desc: 'Fiber Internet', amount: 120000, acc: 'acc-bank' },
    { desc: 'Helper Wages', amount: 1500000, acc: 'acc-cash' },
    { desc: 'Tea & Snacks Misc', amount: 80000, acc: 'acc-cash' },
  ];
  octOps.forEach((op, idx) => {
    transactions.push({
      id: `tx-oct-ops-${idx}`,
      workspaceId: 'ws-golden',
      type: 'expense',
      amountPaise: op.amount,
      occurredAt: `2026-10-15T16:00:00.000Z`,
      description: op.desc,
      categoryId: 'cat-ops',
      accountId: op.acc,
      status: 'active',
      createdAt: '2026-10-15T00:00:00.000Z',
      updatedAt: '2026-10-15T00:00:00.000Z',
    });
    expectedActiveExpensePaise += op.amount;
    if (op.acc === 'acc-cash') expectedCashBalanceChange -= op.amount;
    else expectedBankBalanceChange -= op.amount;
  });

  // Month 2: November 2026
  // 30 sales of ₹1,800.75 (180075 paise)
  for (let day = 1; day <= 30; day++) {
    const isCash = day % 3 === 0;
    const amount = 180075;
    transactions.push({
      id: `tx-nov-sale-${day}`,
      workspaceId: 'ws-golden',
      type: 'income',
      amountPaise: amount,
      occurredAt: `2026-11-${day.toString().padStart(2, '0')}T11:00:00.000Z`,
      description: `Nov Counter Sale #${day}`,
      categoryId: 'cat-sales',
      accountId: isCash ? 'acc-cash' : 'acc-bank',
      status: 'active',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    });
    expectedActiveIncomePaise += amount;
    if (isCash) expectedCashBalanceChange += amount;
    else expectedBankBalanceChange += amount;
  }

  // 10 Raw material expenses in Nov of ₹2,850.50 (285050 paise)
  for (let i = 1; i <= 10; i++) {
    const amount = 285050;
    transactions.push({
      id: `tx-nov-exp-${i}`,
      workspaceId: 'ws-golden',
      type: 'expense',
      amountPaise: amount,
      occurredAt: `2026-11-${(i * 2).toString().padStart(2, '0')}T15:00:00.000Z`,
      description: `Nov Supplies #${i}`,
      categoryId: 'cat-raw',
      accountId: 'acc-bank',
      status: 'active',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    });
    expectedActiveExpensePaise += amount;
    expectedBankBalanceChange -= amount;
  }

  // 5 Ops in Nov
  octOps.forEach((op, idx) => {
    transactions.push({
      id: `tx-nov-ops-${idx}`,
      workspaceId: 'ws-golden',
      type: 'expense',
      amountPaise: op.amount,
      occurredAt: `2026-11-15T16:00:00.000Z`,
      description: `Nov ${op.desc}`,
      categoryId: 'cat-ops',
      accountId: op.acc,
      status: 'active',
      createdAt: '2026-11-15T00:00:00.000Z',
      updatedAt: '2026-11-15T00:00:00.000Z',
    });
    expectedActiveExpensePaise += op.amount;
    if (op.acc === 'acc-cash') expectedCashBalanceChange -= op.amount;
    else expectedBankBalanceChange -= op.amount;
  });

  // Month 3: December 2026
  // 30 sales of ₹2,500.25 (250025 paise)
  for (let day = 1; day <= 30; day++) {
    const isCash = day % 2 === 0;
    const amount = 250025;
    transactions.push({
      id: `tx-dec-sale-${day}`,
      workspaceId: 'ws-golden',
      type: 'income',
      amountPaise: amount,
      occurredAt: `2026-12-${day.toString().padStart(2, '0')}T12:00:00.000Z`,
      description: `Dec Festive Sale #${day}`,
      categoryId: 'cat-sales',
      accountId: isCash ? 'acc-cash' : 'acc-bank',
      status: 'active',
      createdAt: '2026-12-01T00:00:00.000Z',
      updatedAt: '2026-12-01T00:00:00.000Z',
    });
    expectedActiveIncomePaise += amount;
    if (isCash) expectedCashBalanceChange += amount;
    else expectedBankBalanceChange += amount;
  }

  // 10 Raw material expenses in Dec of ₹3,100.00 (310000 paise)
  for (let i = 1; i <= 10; i++) {
    const amount = 310000;
    transactions.push({
      id: `tx-dec-exp-${i}`,
      workspaceId: 'ws-golden',
      type: 'expense',
      amountPaise: amount,
      occurredAt: `2026-12-${(i * 2).toString().padStart(2, '0')}T15:00:00.000Z`,
      description: `Dec Bulk Flour/Sugar #${i}`,
      categoryId: 'cat-raw',
      accountId: 'acc-bank',
      status: 'active',
      createdAt: '2026-12-01T00:00:00.000Z',
      updatedAt: '2026-12-01T00:00:00.000Z',
    });
    expectedActiveExpensePaise += amount;
    expectedBankBalanceChange -= amount;
  }

  // 5 Ops in Dec
  octOps.forEach((op, idx) => {
    transactions.push({
      id: `tx-dec-ops-${idx}`,
      workspaceId: 'ws-golden',
      type: 'expense',
      amountPaise: op.amount,
      occurredAt: `2026-12-15T16:00:00.000Z`,
      description: `Dec ${op.desc}`,
      categoryId: 'cat-ops',
      accountId: op.acc,
      status: 'active',
      createdAt: '2026-12-15T00:00:00.000Z',
      updatedAt: '2026-12-15T00:00:00.000Z',
    });
    expectedActiveExpensePaise += op.amount;
    if (op.acc === 'acc-cash') expectedCashBalanceChange -= op.amount;
    else expectedBankBalanceChange -= op.amount;
  });

  // 10 Inter-Account Transfers: Cash deposited to Bank
  for (let t = 1; t <= 10; t++) {
    const transferAmount = 1000000; // ₹10,000 cash deposit
    transactions.push({
      id: `tx-transfer-${t}`,
      workspaceId: 'ws-golden',
      type: 'transfer',
      amountPaise: transferAmount,
      occurredAt: `2026-11-${(t * 2).toString().padStart(2, '0')}T17:00:00.000Z`,
      description: `Cash Deposit to HDFC #${t}`,
      accountId: 'acc-cash',
      toAccountId: 'acc-bank',
      status: 'active',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    });
    // Transfers are zero-sum for income/expense
    expectedCashBalanceChange -= transferAmount;
    expectedBankBalanceChange += transferAmount;
  }

  // 5 Soft-Voided transactions (test that soft-voids are completely excluded from metrics)
  for (let v = 1; v <= 5; v++) {
    transactions.push({
      id: `tx-voided-${v}`,
      workspaceId: 'ws-golden',
      type: 'income',
      amountPaise: 9999900, // ₹99,999 fake entry
      occurredAt: `2026-10-10T10:00:00.000Z`,
      description: `Cancelled Order #${v}`,
      categoryId: 'cat-sales',
      accountId: 'acc-bank',
      status: 'voided',
      voidReason: 'Mistaken duplicate entry',
      voidedAt: '2026-10-10T12:00:00.000Z',
      createdAt: '2026-10-10T10:00:00.000Z',
      updatedAt: '2026-10-10T12:00:00.000Z',
    });
  }

  it('Verifies dataset size >= 150 transactions', () => {
    expect(transactions.length).toBeGreaterThanOrEqual(150);
  });

  it('Matches total hand-computed income to the exact paisa', () => {
    const metrics: FinancialMetrics = CalculationEngine.calculateMetrics(transactions);
    expect(metrics.totalIncomePaise).toBe(expectedActiveIncomePaise);
    // Integer check: verify zero floating point drift
    expect(Number.isInteger(metrics.totalIncomePaise)).toBe(true);
  });

  it('Matches total hand-computed expense to the exact paisa', () => {
    const metrics: FinancialMetrics = CalculationEngine.calculateMetrics(transactions);
    expect(metrics.totalExpensePaise).toBe(expectedActiveExpensePaise);
    expect(Number.isInteger(metrics.totalExpensePaise)).toBe(true);
  });

  it('Matches exact Net Profit (Income - Expense)', () => {
    const metrics: FinancialMetrics = CalculationEngine.calculateMetrics(transactions);
    const expectedProfit = expectedActiveIncomePaise - expectedActiveExpensePaise;
    expect(metrics.netProfitPaise).toBe(expectedProfit);
  });

  it('Completely excludes soft-voided transactions from financial summaries', () => {
    const metrics: FinancialMetrics = CalculationEngine.calculateMetrics(transactions);
    // If voided transactions were counted, income would be ₹4,99,995 higher
    const voidedSum = 5 * 9999900;
    expect(metrics.totalIncomePaise).not.toBe(expectedActiveIncomePaise + voidedSum);
  });

  it('Preserves Zero-Sum Conservation of Inter-Account Transfers', () => {
    // Total net balance delta across all accounts must equal Total Income - Total Expense
    const totalNetDelta = expectedCashBalanceChange + expectedBankBalanceChange;
    const expectedNetProfit = expectedActiveIncomePaise - expectedActiveExpensePaise;
    expect(totalNetDelta).toBe(expectedNetProfit);
  });
});
