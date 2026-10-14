import { describe, it, expect } from 'vitest';
import { CalculationEngine, type TransactionRecord } from '../src/engine/calculationEngine';

describe('Performance Benchmark (20,000 Transactions Latency Budget)', () => {
  it('Calculates complete financial metrics across 20,000 transactions within 100ms budget', () => {
    // Generate 20,000 synthetic transaction records
    const txCount = 20_000;
    const transactions: TransactionRecord[] = new Array(txCount);

    const categories = ['cat-sales', 'cat-raw', 'cat-rent', 'cat-salary', 'cat-utility'];
    const types: ('income' | 'expense' | 'transfer')[] = ['income', 'expense', 'transfer'];

    const baseTimestamp = new Date('2026-01-01T00:00:00Z').getTime();

    for (let i = 0; i < txCount; i++) {
      const type = types[i % 3];
      transactions[i] = {
        id: `tx-bench-${i}`,
        type,
        amountPaise: ((i * 37) % 500_000) + 100, // Varied amounts up to ₹5,000
        occurredAt: new Date(baseTimestamp + i * 60_000).toISOString(),
        status: i % 50 === 0 ? 'voided' : 'active',
        categoryId: categories[i % categories.length],
        accountId: i % 2 === 0 ? 'acc-cash' : 'acc-bank',
        description: `Synthetic Transaction #${i}`,
      };
    }

    // Warm-up run
    CalculationEngine.calculateMetrics(transactions.slice(0, 1000));

    // Benchmarked run
    const startTime = performance.now();
    const metrics = CalculationEngine.calculateMetrics(transactions);
    const durationMs = performance.now() - startTime;

    // Output for diagnostic reporting
    console.log(`[Benchmark] 20,000 transactions calculated in ${durationMs.toFixed(2)}ms`);

    // Invariants
    expect(metrics).toBeDefined();
    expect(Number.isInteger(metrics.totalIncomePaise)).toBe(true);
    expect(Number.isInteger(metrics.totalExpensePaise)).toBe(true);
    expect(Number.isInteger(metrics.netProfitPaise)).toBe(true);

    // Performance budget: must execute in under 100ms
    expect(durationMs).toBeLessThan(100);
  });
});
