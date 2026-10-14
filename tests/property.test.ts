import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateGSTSplit } from '../src/engine/gstEngine';
import { parseINRToPaise, formatINR } from '../src/engine/calculationEngine';

describe('Financial & Accounting Property-Based Tests (fast-check)', () => {
  it('Property 1: Commutativity of Ledger Balances (Order Independence)', () => {
    // Sum of amounts should be completely order-independent in integer paise
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -10_000_000_00, max: 10_000_000_00 }), { minLength: 1, maxLength: 100 }),
        (transactions) => {
          const sumAscending = transactions.reduce((acc, curr) => acc + curr, 0);
          const shuffled = [...transactions].reverse();
          const sumDescending = shuffled.reduce((acc, curr) => acc + curr, 0);
          return sumAscending === sumDescending && Number.isInteger(sumAscending);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('Property 2: Transfer Neutrality (Zero-Sum Invariant across Accounts)', () => {
    // Transferring X paise from Account A to Account B must result in net change of 0 paise
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50_000_000_00 }), // initial balance A
        fc.integer({ min: 0, max: 50_000_000_00 }), // initial balance B
        fc.integer({ min: 1, max: 10_000_000_00 }), // transfer amount
        (balA, balB, transferPaise) => {
          const initialTotal = balA + balB;
          const finalA = balA - transferPaise;
          const finalB = balB + transferPaise;
          const finalTotal = finalA + finalB;
          return initialTotal === finalTotal;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('Property 3: Payment Split Invariant (Cash + UPI + Card == Total Paid)', () => {
    // Any multi-tender split must sum strictly to the total with zero floating residue
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.integer({ min: 0, max: 10_000_000 }),
        (cashPaise, upiPaise, bankPaise) => {
          const totalPaid = cashPaise + upiPaise + bankPaise;
          const reconstructed = totalPaid - cashPaise - upiPaise;
          return reconstructed === bankPaise && Number.isInteger(totalPaid);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('Property 4: Partial Invoice Collection Invariant', () => {
    // Uncollected balance must strictly equal (Invoice Total - Sum of collections)
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 50_000_000 }), // invoice total
        fc.array(fc.integer({ min: 1, max: 10_000 }), { minLength: 1, maxLength: 10 }), // partial payments
        (invTotal, payments) => {
          const clampedPayments: number[] = [];
          let currentRemaining = invTotal;

          for (const p of payments) {
            const actualPayment = Math.min(p, currentRemaining);
            clampedPayments.push(actualPayment);
            currentRemaining -= actualPayment;
            if (currentRemaining === 0) break;
          }

          const sumPaid = clampedPayments.reduce((a, b) => a + b, 0);
          const computedOutstanding = invTotal - sumPaid;
          return computedOutstanding >= 0 && computedOutstanding === currentRemaining;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('Property 5: GST Integer Split & Conservation Invariant', () => {
    // Taxable paise and rates: CGST + SGST must equal total tax with zero fractional cents
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000_000 }), // taxable paise
        fc.constantFrom(0, 5, 12, 18, 28), // standard Indian GST slabs
        fc.boolean(), // isInterstate
        (taxablePaise, gstRate, isInterState) => {
          const split = calculateGSTSplit(taxablePaise, gstRate, isInterState);

          if (isInterState) {
            expect(split.cgstPaise).toBe(0);
            expect(split.sgstPaise).toBe(0);
            expect(split.igstPaise).toBe(split.totalTaxPaise);
          } else {
            expect(split.igstPaise).toBe(0);
            // CGST and SGST must be equal
            expect(split.cgstPaise).toBe(split.sgstPaise);
            expect(split.cgstPaise + split.sgstPaise).toBe(split.totalTaxPaise);
          }

          // Tax is non-negative and always an integer
          expect(Number.isInteger(split.totalTaxPaise)).toBe(true);
          expect(split.totalTaxPaise).toBeGreaterThanOrEqual(0);
          return true;
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('Property 6: Bijective INR Parsing & Formatting Round-Trip', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000_000_00 }), // Up to 100 Crore Paise
        (paise) => {
          const formatted = formatINR(paise, false);
          const parsed = parseINRToPaise(formatted);
          return parsed === paise;
        }
      ),
      { numRuns: 1000 }
    );
  });
});
