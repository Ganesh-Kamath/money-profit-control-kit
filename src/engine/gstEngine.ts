/**
 * GST Calculation & Indian Invoicing Engine for ControlKit.
 * 100% Integer Paise, Zero Floating Point Precision Errors.
 * Strict Indian Financial Year invoice numbering and number-to-words.
 */

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export interface LineItemCalculationInput {
  description: string;
  hsnSac?: string;
  quantity: number;
  unit?: string;
  ratePaise: number;
  gstRatePct: number; // 0, 5, 12, 18, 28
}

export interface CalculatedLineItem extends LineItemCalculationInput {
  id: string;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
}

export interface InvoiceTotals {
  taxableAmountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalAmountPaise: number;
  totalInWords: string;
  isInterState: boolean;
}

export const INDIAN_STATES: Array<{ code: string; name: string }> = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
];

/**
 * Validates 15-character Indian GSTIN format.
 */
export function isValidGSTIN(gstin?: string): boolean {
  if (!gstin) return false;
  return GSTIN_REGEX.test(gstin.trim().toUpperCase());
}

/**
 * Derives state name from first two digits of GSTIN.
 */
export function getStateFromGSTIN(gstin?: string): string | undefined {
  if (!gstin || gstin.length < 2) return undefined;
  const prefix = gstin.trim().slice(0, 2);
  const found = INDIAN_STATES.find((s) => s.code === prefix);
  return found?.name;
}

/**
 * Computes Indian Financial Year string from an ISO date.
 * Example: '2026-10-15' -> '2026-27'
 *          '2027-02-10' -> '2026-27'
 */
export function getFinancialYearString(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0 = Jan, 3 = Apr

  let fyStartYear = year;
  if (month < 3) {
    fyStartYear = year - 1;
  }
  const fyEndShort = (fyStartYear + 1).toString().slice(-2);
  return `${fyStartYear}-${fyEndShort}`;
}

/**
 * Formats a sequential invoice number with FY code.
 * Example: ('INV', 1, '2026-10-15') -> 'INV/2026-27/0001'
 */
export function generateInvoiceNumber(prefix = 'INV', sequenceNum = 1, dateStr = new Date().toISOString()): string {
  const cleanPrefix = (prefix || 'INV').trim().toUpperCase();
  const fyStr = getFinancialYearString(dateStr);
  const paddedSeq = sequenceNum.toString().padStart(4, '0');
  return `${cleanPrefix}/${fyStr}/${paddedSeq}`;
}

/**
 * Computes CGST/SGST/IGST breakdown in integer paise.
 */
export function calculateGSTSplit(
  taxablePaise: number,
  gstRatePct: number,
  isInterState: boolean
): { cgstPaise: number; sgstPaise: number; igstPaise: number; totalTaxPaise: number } {
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;

  if (gstRatePct > 0 && taxablePaise > 0) {
    if (isInterState) {
      igstPaise = Math.round((taxablePaise * gstRatePct) / 100);
    } else {
      cgstPaise = Math.round((taxablePaise * gstRatePct) / 200);
      sgstPaise = Math.round((taxablePaise * gstRatePct) / 200);
    }
  }

  const totalTaxPaise = cgstPaise + sgstPaise + igstPaise;
  return { cgstPaise, sgstPaise, igstPaise, totalTaxPaise };
}

/**
 * Calculates line items and totals with integer paise precision and GST tax splits.
 */
export function calculateInvoice(
  items: LineItemCalculationInput[],
  businessState: string,
  placeOfSupplyState: string
): { lineItems: CalculatedLineItem[]; totals: InvoiceTotals } {
  const cleanBizState = (businessState || '').trim().toLowerCase();
  const cleanPosState = (placeOfSupplyState || '').trim().toLowerCase();
  const isInterState = cleanBizState !== '' && cleanPosState !== '' && cleanBizState !== cleanPosState;

  let totalTaxablePaise = 0;
  let totalCgstPaise = 0;
  let totalSgstPaise = 0;
  let totalIgstPaise = 0;

  const calculatedItems: CalculatedLineItem[] = items.map((item, idx) => {
    const qty = Math.max(1, Math.round(item.quantity || 1));
    const ratePaise = Math.round(item.ratePaise || 0);
    const taxablePaise = qty * ratePaise;
    const gstRate = item.gstRatePct || 0;

    const { cgstPaise, sgstPaise, igstPaise } = calculateGSTSplit(taxablePaise, gstRate, isInterState);

    const totalPaise = taxablePaise + cgstPaise + sgstPaise + igstPaise;

    totalTaxablePaise += taxablePaise;
    totalCgstPaise += cgstPaise;
    totalSgstPaise += sgstPaise;
    totalIgstPaise += igstPaise;

    return {
      ...item,
      id: `item-${idx + 1}`,
      quantity: qty,
      ratePaise,
      taxablePaise,
      cgstPaise,
      sgstPaise,
      igstPaise,
      totalPaise,
    };
  });

  const totalAmountPaise = totalTaxablePaise + totalCgstPaise + totalSgstPaise + totalIgstPaise;
  const totalInWords = numberToIndianWords(Math.round(totalAmountPaise / 100));

  return {
    lineItems: calculatedItems,
    totals: {
      taxableAmountPaise: totalTaxablePaise,
      cgstPaise: totalCgstPaise,
      sgstPaise: totalSgstPaise,
      igstPaise: totalIgstPaise,
      totalAmountPaise,
      totalInWords,
      isInterState,
    },
  };
}

/**
 * Converts integer rupees into Indian English words.
 * Example: 125450 -> 'Rupees One Lakh Twenty-Five Thousand Four Hundred Fifty Only'
 */
export function numberToIndianWords(rupees: number): string {
  if (rupees === 0) return 'Rupees Zero Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
  ];

  function convertTwoDigits(n: number): string {
    if (n < 20) return ones[n];
    const rem = n % 10;
    return tens[Math.floor(n / 10)] + (rem > 0 ? '-' + ones[rem] : '');
  }

  function convertThreeDigits(n: number): string {
    if (n === 0) return '';
    const h = Math.floor(n / 100);
    const rem = n % 100;
    let res = '';
    if (h > 0) res += ones[h] + ' Hundred';
    if (rem > 0) res += (res ? ' ' : '') + convertTwoDigits(rem);
    return res;
  }

  let num = Math.abs(rupees);
  let words = '';

  const crores = Math.floor(num / 10000000);
  num %= 10000000;
  if (crores > 0) {
    words += convertTwoDigits(crores) + ' Crore ';
  }

  const lakhs = Math.floor(num / 100000);
  num %= 100000;
  if (lakhs > 0) {
    words += convertTwoDigits(lakhs) + ' Lakh ';
  }

  const thousands = Math.floor(num / 1000);
  num %= 1000;
  if (thousands > 0) {
    words += convertTwoDigits(thousands) + ' Thousand ';
  }

  const hundreds = num;
  if (hundreds > 0) {
    words += convertThreeDigits(hundreds) + ' ';
  }

  return `Rupees ${words.trim()} Only`;
}

/**
 * Validates whether an invoice qualifies as a legitimate "Tax Invoice" under Indian GST rules.
 * If missing mandatory fields, returns a list of missing fields.
 */
export function validateTaxInvoiceRequirements(invoice: {
  businessLegalName?: string;
  businessAddress?: string;
  businessState?: string;
  businessGstin?: string;
  customerName?: string;
  placeOfSupplyState?: string;
  lineItems?: Array<{ description: string; ratePaise: number }>;
}): { isReadyForTaxInvoice: boolean; missingFields: string[] } {
  const missing: string[] = [];

  if (!invoice.businessLegalName?.trim()) missing.push('Your Business Legal Name');
  if (!invoice.businessAddress?.trim()) missing.push('Your Business Address');
  if (!invoice.businessState?.trim()) missing.push('Your Business State');
  if (!isValidGSTIN(invoice.businessGstin)) missing.push('A valid 15-character Business GSTIN');
  if (!invoice.customerName?.trim()) missing.push('Customer Name');
  if (!invoice.placeOfSupplyState?.trim()) missing.push('Place of Supply (Customer State)');
  if (!invoice.lineItems || invoice.lineItems.length === 0) missing.push('At least one line item');

  return {
    isReadyForTaxInvoice: missing.length === 0,
    missingFields: missing,
  };
}
