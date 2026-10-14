import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  StatementParser,
  parseMessyAmountToPaise,
  parseDateFlexibly,
  findTableHeaderIndex,
  type ParsedStatementEntry,
} from '../src/engine/statementParsers';

const HDFC_CSV_WITH_PREAMBLE = `
HDFC BANK LTD - KOTHRUD PUNE BRANCH
Statement of Account No: 50100098765432
Customer Name: Sweet Crumb Studio
Currency: INR

Date,Narration,Chq/Ref No,Value Dt,Withdrawal Amount,Deposit Amount,Closing Balance
10/10/2026,UPI-SWIGGY-12345,REF001,10/10/2026,450.00,,50000.00
11/10/2026,UPI-CUSTOMER-PAID,REF002,11/10/2026,,"1,200.00",51200.00
`;

const SBI_CSV_WITH_BOM = `\uFEFFTxn Date,Value Date,Description,Ref No,Debit,Credit,Balance
10-Oct-2026,10-Oct-2026,ELECTRICITY BILL,SBI001,"2,340.00 Dr",,45000.00
11-Oct-2026,11-Oct-2026,NEFT FROM CLIENT,SBI002,,"15,000.00 Cr",60000.00
`;

const PHONEPE_CSV = `
Date,Transaction ID,Details,Type,Amount
2026-10-10 14:30:00,T261010001,Paid to Packaging Vendor,DEBIT,₹ 350.00
2026-10-10 16:45:00,T261010002,Received from Amit Cake Order,CREDIT,"₹ 1,500.00"
`;

describe('StatementParser Real-World Robustness', () => {
  it('parses messy amounts with commas, symbols, Dr/Cr suffixes and parentheses', () => {
    expect(parseMessyAmountToPaise('1,23,456.78').amountPaise).toBe(12345678);
    expect(parseMessyAmountToPaise('₹ 1,500.00 Dr').amountPaise).toBe(150000);
    expect(parseMessyAmountToPaise('₹ 1,500.00 Dr').isDebitHint).toBe(true);
    expect(parseMessyAmountToPaise('5,000.00 Cr').amountPaise).toBe(500000);
    expect(parseMessyAmountToPaise('5,000.00 Cr').isCreditHint).toBe(true);
    expect(parseMessyAmountToPaise('(450.00)').amountPaise).toBe(-45000);
    expect(parseMessyAmountToPaise('-₹250.50').amountPaise).toBe(-25050);
  });

  it('parses various Indian banking date formats flexibly', () => {
    const d1 = parseDateFlexibly('10/10/2026');
    expect(d1).toContain('2026-10-10');

    const d2 = parseDateFlexibly('15-Oct-26');
    expect(d2).toContain('2026-10-15');

    const d3 = parseDateFlexibly('2026-10-12 18:30:00');
    expect(d3).toContain('2026-10-12');
  });

  it('skips preamble rows in bank statements automatically', () => {
    const results = StatementParser.parseWithPreset(HDFC_CSV_WITH_PREAMBLE, 'hdfc');
    expect(results.length).toBe(2);
    expect(results[0].type).toBe('expense');
    expect(results[0].amountPaise).toBe(45000);
    expect(results[1].type).toBe('income');
    expect(results[1].amountPaise).toBe(120000);
  });

  it('handles UTF-8 with BOM and Dr/Cr suffixes on SBI preset', () => {
    const results = StatementParser.parseWithPreset(SBI_CSV_WITH_BOM, 'sbi');
    expect(results.length).toBe(2);
    expect(results[0].type).toBe('expense');
    expect(results[0].amountPaise).toBe(234000); // ₹2,340
    expect(results[1].type).toBe('income');
    expect(results[1].amountPaise).toBe(1500000); // ₹15,000
  });

  it('parses PhonePe statement with currency symbols and DEBIT/CREDIT type', () => {
    const results = StatementParser.parseWithPreset(PHONEPE_CSV, 'phonepe');
    expect(results.length).toBe(2);
    expect(results[0].type).toBe('expense');
    expect(results[0].amountPaise).toBe(35000);
    expect(results[1].type).toBe('income');
    expect(results[1].amountPaise).toBe(150000);
  });

  it('parses real binary Excel (.xlsx) statement buffer into transactions', () => {
    // Generate an in-memory XLSX workbook
    const wsData = [
      ['Date', 'Narration', 'Chq/Ref No', 'Withdrawal Amount', 'Deposit Amount'],
      ['2026-10-01', 'Butter Purchase Wholesale', 'CHQ991', '4500.00', ''],
      ['2026-10-02', 'Bulk Catering Advance', 'UPI882', '', '18500.00'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Statement');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const results = StatementParser.parseWithPreset(buffer, 'hdfc');
    expect(results.length).toBe(2);
    expect(results[0].description).toBe('Butter Purchase Wholesale');
    expect(results[0].amountPaise).toBe(450000);
    expect(results[0].type).toBe('expense');
    expect(results[1].description).toBe('Bulk Catering Advance');
    expect(results[1].amountPaise).toBe(1850000);
    expect(results[1].type).toBe('income');
  });

  it('flags duplicate candidates matching date, amount and description with warnings', () => {
    const candidates: ParsedStatementEntry[] = [
      {
        type: 'expense',
        amountPaise: 45000,
        occurredAt: '2026-10-10T12:00:00.000Z',
        description: 'Swiggy Packaging Box',
        referenceNumber: 'REF001',
        source: 'test',
        selected: true,
      },
      {
        type: 'income',
        amountPaise: 120000,
        occurredAt: '2026-10-11T12:00:00.000Z',
        description: 'New Customer Payment',
        referenceNumber: 'REF999',
        source: 'test',
        selected: true,
      },
    ];

    const existingTxs = [
      {
        amountPaise: 45000,
        occurredAt: '2026-10-10T14:00:00.000Z',
        description: 'Swiggy Packaging Box',
        referenceNumber: 'REF001',
      },
    ];

    const flagged = StatementParser.flagDuplicates(candidates, existingTxs);
    expect(flagged[0].isPossibleDuplicate).toBe(true);
    expect(flagged[0].selected).toBe(false); // Unchecked by default
    expect(flagged[0].duplicateReason).toContain('Matches existing transaction');

    expect(flagged[1].isPossibleDuplicate).toBeFalsy();
    expect(flagged[1].selected).toBe(true);
  });
});
