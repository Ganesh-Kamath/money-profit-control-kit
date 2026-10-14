import { describe, it, expect } from 'vitest';
import {
  isValidGSTIN,
  getStateFromGSTIN,
  getFinancialYearString,
  generateInvoiceNumber,
  calculateInvoice,
  numberToIndianWords,
  validateTaxInvoiceRequirements,
} from '../src/engine/gstEngine';
import { buildUpiUri, generateQrSvg } from '../src/engine/qrCode';

describe('GST Calculation & Invoicing Engine', () => {
  it('validates 15-character Indian GSTIN strings correctly', () => {
    // Valid Maharashtra GSTIN (State 27)
    expect(isValidGSTIN('27AAPFU0939F1ZV')).toBe(true);
    // Valid Karnataka GSTIN (State 29)
    expect(isValidGSTIN('29ABCDE1234F1Z5')).toBe(true);

    // Invalid format
    expect(isValidGSTIN('')).toBe(false);
    expect(isValidGSTIN('INVALID123')).toBe(false);
    expect(isValidGSTIN('27AAPFU0939F1Z')).toBe(false); // only 14 chars
    expect(isValidGSTIN('27AAPFU0939F1ZVV')).toBe(false); // 16 chars
  });

  it('identifies state name from GSTIN code prefix', () => {
    expect(getStateFromGSTIN('27AAPFU0939F1ZV')).toBe('Maharashtra');
    expect(getStateFromGSTIN('29ABCDE1234F1Z5')).toBe('Karnataka');
    expect(getStateFromGSTIN('07AAAAA0000A1Z5')).toBe('Delhi');
  });

  it('generates correct Financial Year numbering', () => {
    // October 2026 -> 2026-27
    expect(getFinancialYearString('2026-10-15')).toBe('2026-27');
    // February 2027 -> 2026-27
    expect(getFinancialYearString('2027-02-10')).toBe('2026-27');
    // April 2027 -> 2027-28
    expect(getFinancialYearString('2027-04-01')).toBe('2027-28');

    const invNo = generateInvoiceNumber('INV', 42, '2026-10-15');
    expect(invNo).toBe('INV/2026-27/0042');
  });

  it('calculates intra-state GST (50% CGST + 50% SGST) with integer paise precision', () => {
    const items = [
      {
        description: 'Chocolate Truffle Cake 1kg',
        quantity: 2,
        ratePaise: 120000, // ₹1,200.00 each
        gstRatePct: 18,
      },
    ];

    // Business in Maharashtra, Customer in Maharashtra -> Intra-state
    const { lineItems, totals } = calculateInvoice(items, 'Maharashtra', 'Maharashtra');

    expect(totals.isInterState).toBe(false);
    expect(totals.taxableAmountPaise).toBe(240000); // 2 * ₹1,200 = ₹2,400 (240,000 paise)

    // 18% GST split = 9% CGST (21,600 paise) + 9% SGST (21,600 paise)
    expect(totals.cgstPaise).toBe(21600); // ₹216.00
    expect(totals.sgstPaise).toBe(21600); // ₹216.00
    expect(totals.igstPaise).toBe(0);

    // Total = 240,000 + 43,200 = 283,200 paise (₹2,832.00)
    expect(totals.totalAmountPaise).toBe(283200);
    expect(totals.totalInWords).toContain('Two Thousand Eight Hundred Thirty-Two');
  });

  it('calculates inter-state GST (100% IGST) without CGST or SGST', () => {
    const items = [
      {
        description: 'UI Design Consulting Retainer',
        quantity: 1,
        ratePaise: 5000000, // ₹50,000.00
        gstRatePct: 18,
      },
    ];

    // Business in Karnataka, Customer in Delhi -> Inter-state
    const { totals } = calculateInvoice(items, 'Karnataka', 'Delhi');

    expect(totals.isInterState).toBe(true);
    expect(totals.taxableAmountPaise).toBe(5000000);
    expect(totals.cgstPaise).toBe(0);
    expect(totals.sgstPaise).toBe(0);
    expect(totals.igstPaise).toBe(900000); // 18% of 50,000 = ₹9,000 (900,000 paise)
    expect(totals.totalAmountPaise).toBe(5900000); // ₹59,000.00
  });

  it('converts numbers to Indian words format accurately', () => {
    expect(numberToIndianWords(0)).toBe('Rupees Zero Only');
    expect(numberToIndianWords(250)).toBe('Rupees Two Hundred Fifty Only');
    expect(numberToIndianWords(125450)).toBe('Rupees One Lakh Twenty-Five Thousand Four Hundred Fifty Only');
    expect(numberToIndianWords(10000000)).toBe('Rupees One Crore Only');
  });

  it('enforces Tax Invoice requirements and reports missing fields', () => {
    const incomplete = {
      businessLegalName: 'Sweet Crumb',
      businessState: 'Maharashtra',
      // missing address, GSTIN, customer state
    };

    const check1 = validateTaxInvoiceRequirements(incomplete as any);
    expect(check1.isReadyForTaxInvoice).toBe(false);
    expect(check1.missingFields.length).toBeGreaterThan(0);
    expect(check1.missingFields).toContain('Your Business Address');

    const complete = {
      businessLegalName: 'Sweet Crumb Studio LLP',
      businessAddress: 'Plot 4, FC Road, Pune',
      businessState: 'Maharashtra',
      businessGstin: '27AAPFU0939F1ZV',
      customerName: 'Rohit Verma',
      placeOfSupplyState: 'Maharashtra',
      lineItems: [{ description: 'Wedding Cake', ratePaise: 500000 }],
    };

    const check2 = validateTaxInvoiceRequirements(complete as any);
    expect(check2.isReadyForTaxInvoice).toBe(true);
    expect(check2.missingFields.length).toBe(0);
  });

  it('generates valid local UPI QR URI and SVG', () => {
    const upiUri = buildUpiUri({
      upiId: 'sweetcrumb@okaxis',
      payeeName: 'Sweet Crumb Studio',
      amountPaise: 283200,
      transactionNote: 'Invoice INV/2026-27/0042',
    });

    expect(upiUri).toContain('sweetcrumb@okaxis');
    expect(upiUri).toContain('am=2832.00');

    const svg = generateQrSvg(upiUri);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox=');
    expect(svg).toContain('</svg>');
  });
});
