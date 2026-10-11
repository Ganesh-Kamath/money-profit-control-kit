import { describe, it, expect } from 'vitest';
import { StatementParser } from '../src/engine/statementParsers';

const HDFC_CSV = `
Date,Narration,Chq/Ref No,Value Dt,Withdrawal Amount,Deposit Amount,Closing Balance
10/10/26,UPI-SWIGGY-12345,REF001,10/10/26,450.00,,50000.00
11/10/26,UPI-CUSTOMER-PAID,REF002,11/10/26,,1200.00,51200.00
`;

const SBI_CSV = `
Txn Date,Value Date,Description,Ref No,Debit,Credit,Balance
10-Oct-2026,10-Oct-2026,ELECTRICITY BILL,SBI001,2340.00,,45000.00
11-Oct-2026,11-Oct-2026,NEFT FROM CLIENT,SBI002,,15000.00,60000.00
`;

const PHONEPE_CSV = `
Date,Transaction ID,Details,Type,Amount
2026-10-10 14:30:00,T261010001,Paid to Packaging Vendor,DEBIT,350.00
2026-10-10 16:45:00,T261010002,Received from Amit Cake Order,CREDIT,1500.00
`;

describe('StatementParser & Presets', () => {
  it('parses HDFC bank CSV export with separate debit and credit columns', () => {
    const results = StatementParser.parseWithPreset(HDFC_CSV, 'hdfc');
    expect(results.length).toBe(2);

    expect(results[0].type).toBe('expense');
    expect(results[0].amountPaise).toBe(45000); // ₹450
    expect(results[0].description).toContain('SWIGGY');
    expect(results[0].referenceNumber).toBe('REF001');

    expect(results[1].type).toBe('income');
    expect(results[1].amountPaise).toBe(120000); // ₹1,200
    expect(results[1].referenceNumber).toBe('REF002');
  });

  it('parses SBI bank CSV with text month dates', () => {
    const results = StatementParser.parseWithPreset(SBI_CSV, 'sbi');
    expect(results.length).toBe(2);

    expect(results[0].type).toBe('expense');
    expect(results[0].amountPaise).toBe(234000); // ₹2,340
    expect(results[1].type).toBe('income');
    expect(results[1].amountPaise).toBe(1500000); // ₹15,000
  });

  it('parses PhonePe UPI statement with Type (DEBIT/CREDIT) and Amount', () => {
    const results = StatementParser.parseWithPreset(PHONEPE_CSV, 'phonepe');
    expect(results.length).toBe(2);

    expect(results[0].type).toBe('expense');
    expect(results[0].amountPaise).toBe(35000); // ₹350
    expect(results[1].type).toBe('income');
    expect(results[1].amountPaise).toBe(150000); // ₹1,500
  });

  it('supports custom mapping wizard with separate debit/credit columns', () => {
    const customCsv = `
TxnDate,Particulars,ChequeRef,Withdrawal,Deposit
2026-10-12,Office Rent,RNT01,12000.00,
2026-10-12,Design Consulting,INV99,,25000.00
    `;
    const results = StatementParser.parseWithCustomMapping(customCsv, {
      dateCol: 'TxnDate',
      descCol: 'Particulars',
      refCol: 'ChequeRef',
      strategy: 'separate_debit_credit',
      debitCol: 'Withdrawal',
      creditCol: 'Deposit',
    });

    expect(results.length).toBe(2);
    expect(results[0].type).toBe('expense');
    expect(results[0].amountPaise).toBe(1200000);
    expect(results[1].type).toBe('income');
    expect(results[1].amountPaise).toBe(2500000);
  });
});
