import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { parseINRToPaise } from './calculationEngine';

export interface ParsedStatementEntry {
  id?: string;
  type: 'income' | 'expense';
  amountPaise: number;
  occurredAt: string;
  description: string;
  referenceNumber?: string;
  source: string;
  isPossibleDuplicate?: boolean;
  duplicateReason?: string;
  selected?: boolean;
}

export interface BankPreset {
  id: string;
  name: string;
  dateCol: string;
  descCol: string;
  refCol?: string;
  debitCol?: string;
  creditCol?: string;
  amountCol?: string;
  typeCol?: string;
  dateFormat?: string;
  isCommunityTested?: boolean;
}

export const BANK_PRESETS: Record<string, BankPreset> = {
  hdfc: {
    id: 'hdfc',
    name: 'HDFC Bank Statement',
    dateCol: 'Date',
    descCol: 'Narration',
    refCol: 'Chq/Ref No',
    debitCol: 'Withdrawal Amount',
    creditCol: 'Deposit Amount',
    isCommunityTested: true,
  },
  icici: {
    id: 'icici',
    name: 'ICICI Bank Statement',
    dateCol: 'Value Date',
    descCol: 'Transaction Details',
    refCol: 'Cheque No',
    debitCol: 'Dr Amount',
    creditCol: 'Cr Amount',
    isCommunityTested: true,
  },
  sbi: {
    id: 'sbi',
    name: 'State Bank of India (SBI)',
    dateCol: 'Txn Date',
    descCol: 'Description',
    refCol: 'Ref No',
    debitCol: 'Debit',
    creditCol: 'Credit',
    isCommunityTested: true,
  },
  axis: {
    id: 'axis',
    name: 'Axis Bank Statement',
    dateCol: 'Tran Date',
    descCol: 'Particulars',
    refCol: 'CHQNO',
    debitCol: 'Debit',
    creditCol: 'Credit',
    isCommunityTested: true,
  },
  kotak: {
    id: 'kotak',
    name: 'Kotak Mahindra Bank',
    dateCol: 'Date',
    descCol: 'Description',
    refCol: 'Chq/Ref',
    debitCol: 'Debit',
    creditCol: 'Credit',
    isCommunityTested: true,
  },
  phonepe: {
    id: 'phonepe',
    name: 'PhonePe UPI Statement',
    dateCol: 'Date',
    descCol: 'Details',
    refCol: 'Transaction ID',
    typeCol: 'Type',
    amountCol: 'Amount',
    isCommunityTested: true,
  },
  gpay: {
    id: 'gpay',
    name: 'Google Pay Statement',
    dateCol: 'Date',
    descCol: 'Description',
    refCol: 'Transaction ID',
    amountCol: 'Amount',
    isCommunityTested: true,
  },
  paytm: {
    id: 'paytm',
    name: 'Paytm Statement',
    dateCol: 'Date',
    descCol: 'Activity',
    refCol: 'Order ID',
    debitCol: 'Debit',
    creditCol: 'Credit',
    isCommunityTested: true,
  },
  razorpay: {
    id: 'razorpay',
    name: 'Razorpay Payments Export',
    dateCol: 'created_at',
    descCol: 'description',
    refCol: 'payment_id',
    amountCol: 'amount',
    isCommunityTested: true,
  },
};

/**
 * Parses Indian amount strings with real-world quirks:
 * - Lakh/Crore commas: "1,23,456.78"
 * - Currency symbols: "₹ 1,250.00"
 * - Dr/Cr suffixes or prefixes: "1,250.00 Dr", "Cr 4,500.00"
 * - Parentheses: "(1,250.00)"
 */
export function parseMessyAmountToPaise(input: any): { amountPaise: number; isDebitHint?: boolean; isCreditHint?: boolean } {
  if (input === null || input === undefined) return { amountPaise: 0 };
  let str = String(input).trim();
  if (!str) return { amountPaise: 0 };

  let isDebitHint = false;
  let isCreditHint = false;

  const upper = str.toUpperCase();
  if (upper.includes('DR') || upper.includes('DEBIT')) {
    isDebitHint = true;
  }
  if (upper.includes('CR') || upper.includes('CREDIT')) {
    isCreditHint = true;
  }

  // Remove DR/CR words, ₹, commas, parentheses
  let isNegative = str.startsWith('-') || (str.startsWith('(') && str.endsWith(')'));
  let cleaned = str.replace(/[₹,\s\(\)a-zA-Z]/g, '').trim();

  if (cleaned.startsWith('-')) {
    isNegative = true;
    cleaned = cleaned.slice(1).trim();
  } else if (cleaned.endsWith('-')) {
    isNegative = true;
    cleaned = cleaned.slice(0, -1).trim();
  }

  if (!cleaned) return { amountPaise: 0 };

  const parsedPaise = parseINRToPaise(cleaned);
  const total = isNegative ? -Math.abs(parsedPaise) : Math.abs(parsedPaise);

  return { amountPaise: total, isDebitHint, isCreditHint };
}

/**
 * Flexible date parser for Indian banking formats:
 * - DD/MM/YYYY or DD/MM/YY
 * - DD-MM-YYYY or DD-MM-YY
 * - DD-MMM-YYYY or DD-MMM-YY (e.g. 10-Oct-26, 12-Nov-2026)
 * - ISO formats: 2026-10-10, 2026-10-10 14:30:00
 */
export function parseDateFlexibly(dateStr: any): string {
  if (!dateStr) return new Date().toISOString();
  if (dateStr instanceof Date) return dateStr.toISOString();

  let cleaned = String(dateStr).trim().replace(/['"]/g, '');
  if (!cleaned) return new Date().toISOString();

  // Try direct ISO parsing if format looks like YYYY-MM-DD
  if (/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(cleaned)) {
    const d = new Date(cleaned.replace(/\//g, '-'));
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Split on slash, dash, or space
  const parts = cleaned.split(/[\/\-\s]/).filter(Boolean);
  if (parts.length >= 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);

    const monthNames: Record<string, number> = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    };

    if (isNaN(month) && parts[1]) {
      const mStr = parts[1].toLowerCase().slice(0, 3);
      if (monthNames[mStr]) {
        month = monthNames[mStr];
      }
    }

    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      if (year < 100) year += 2000;
      if (day > 0 && day <= 31 && month > 0 && month <= 12 && year >= 1970 && year <= 2100) {
        return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
      }
    }
  }

  const fallback = new Date(cleaned);
  return !isNaN(fallback.getTime()) ? fallback.toISOString() : new Date().toISOString();
}

/**
 * Automatically detects where the actual table headers start,
 * skipping bank statement preamble/metadata rows.
 */
export function findTableHeaderIndex(lines: string[]): number {
  const headerKeywords = [
    'date', 'txn date', 'narration', 'description', 'particulars',
    'debit', 'withdrawal', 'credit', 'deposit', 'amount', 'balance', 'details',
  ];

  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const lineLower = lines[i].toLowerCase();
    const matches = headerKeywords.filter((k) => lineLower.includes(k));
    if (matches.length >= 2) {
      return i;
    }
  }
  return 0;
}

export class StatementParser {
  /**
   * Parses raw CSV string to rows, automatically stripping UTF-8 BOM and preambles.
   */
  static parseCSVText(csvContent: string): { headers: string[]; rows: Record<string, string>[] } {
    if (!csvContent || !csvContent.trim()) {
      return { headers: [], rows: [] };
    }

    // Strip BOM if present
    let content = csvContent.replace(/^\uFEFF/, '').trim();
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const headerIdx = findTableHeaderIndex(lines);
    const cleanedCsv = lines.slice(headerIdx).join('\n');

    const parsed = Papa.parse<Record<string, string>>(cleanedCsv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    const headers = (parsed.meta.fields || []).map((h) => h.trim());
    return { headers, rows: parsed.data };
  }

  /**
   * Parses an Excel (.xlsx or .xls) file binary buffer into CSV text or row records.
   */
  static parseExcelBuffer(buffer: ArrayBuffer): { headers: string[]; rows: Record<string, string>[] } {
    try {
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) return { headers: [], rows: [] };

      const worksheet = workbook.Sheets[firstSheetName];
      // Convert worksheet to CSV string with raw dates and numbers
      const csvString = XLSX.utils.sheet_to_csv(worksheet);
      return this.parseCSVText(csvString);
    } catch (err: any) {
      throw new Error(`Excel parsing failed: ${err?.message || 'Invalid or encrypted workbook'}`);
    }
  }

  /**
   * Parses content using a predefined bank/UPI preset.
   */
  static parseWithPreset(csvOrExcelContent: string | ArrayBuffer, presetKey: string): ParsedStatementEntry[] {
    const preset = BANK_PRESETS[presetKey];
    if (!preset) throw new Error(`Unknown preset: ${presetKey}`);

    const { rows } =
      typeof csvOrExcelContent === 'string'
        ? this.parseCSVText(csvOrExcelContent)
        : this.parseExcelBuffer(csvOrExcelContent);

    const results: ParsedStatementEntry[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      // Find date
      const dateVal = r[preset.dateCol];
      if (!dateVal || !dateVal.trim()) continue;

      const occurredAt = parseDateFlexibly(dateVal);
      const desc = (r[preset.descCol] || 'Bank Entry').trim();
      const ref = preset.refCol && r[preset.refCol] ? r[preset.refCol].trim() : undefined;

      // Case 1: Separate Debit and Credit columns
      if (preset.debitCol && preset.creditCol) {
        const { amountPaise: drPaise } = parseMessyAmountToPaise(r[preset.debitCol]);
        const { amountPaise: crPaise } = parseMessyAmountToPaise(r[preset.creditCol]);

        if (crPaise > 0) {
          results.push({
            id: `entry-${i}-${Date.now()}`,
            type: 'income',
            amountPaise: crPaise,
            occurredAt,
            description: desc,
            referenceNumber: ref,
            source: `import_${presetKey}`,
            selected: true,
          });
        } else if (drPaise > 0) {
          results.push({
            id: `entry-${i}-${Date.now()}`,
            type: 'expense',
            amountPaise: drPaise,
            occurredAt,
            description: desc,
            referenceNumber: ref,
            source: `import_${presetKey}`,
            selected: true,
          });
        }
      }
      // Case 2: Type column + Amount column (PhonePe)
      else if (preset.typeCol && preset.amountCol) {
        const typeStr = (r[preset.typeCol] || '').toUpperCase();
        const { amountPaise: amtPaise } = parseMessyAmountToPaise(r[preset.amountCol]);
        if (amtPaise > 0) {
          results.push({
            id: `entry-${i}-${Date.now()}`,
            type: typeStr.includes('CREDIT') || typeStr.includes('CR') ? 'income' : 'expense',
            amountPaise: amtPaise,
            occurredAt,
            description: desc,
            referenceNumber: ref,
            source: `import_${presetKey}`,
            selected: true,
          });
        }
      }
      // Case 3: Single signed or magnitude column (Google Pay / Razorpay)
      else if (preset.amountCol) {
        const { amountPaise: amtPaise, isDebitHint, isCreditHint } = parseMessyAmountToPaise(r[preset.amountCol]);
        if (amtPaise !== 0) {
          let type: 'income' | 'expense' = amtPaise > 0 ? 'income' : 'expense';
          if (isDebitHint) type = 'expense';
          if (isCreditHint) type = 'income';

          results.push({
            id: `entry-${i}-${Date.now()}`,
            type,
            amountPaise: Math.abs(amtPaise),
            occurredAt,
            description: desc,
            referenceNumber: ref,
            source: `import_${presetKey}`,
            selected: true,
          });
        }
      }
    }

    return results;
  }

  /**
   * Parses content using custom column mapping wizard configuration.
   */
  static parseWithCustomMapping(
    csvOrExcelContent: string | ArrayBuffer,
    mapping: {
      dateCol: string;
      descCol: string;
      refCol?: string;
      strategy: 'separate_debit_credit' | 'single_signed' | 'type_and_amount';
      debitCol?: string;
      creditCol?: string;
      amountCol?: string;
      typeCol?: string;
    }
  ): ParsedStatementEntry[] {
    const { rows } =
      typeof csvOrExcelContent === 'string'
        ? this.parseCSVText(csvOrExcelContent)
        : this.parseExcelBuffer(csvOrExcelContent);

    const results: ParsedStatementEntry[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const dateVal = r[mapping.dateCol];
      if (!dateVal || !dateVal.trim()) continue;

      const occurredAt = parseDateFlexibly(dateVal);
      const desc = (r[mapping.descCol] || 'Imported Entry').trim();
      const ref = mapping.refCol && r[mapping.refCol] ? r[mapping.refCol].trim() : undefined;

      if (mapping.strategy === 'separate_debit_credit') {
        const { amountPaise: drPaise } = parseMessyAmountToPaise(r[mapping.debitCol || '']);
        const { amountPaise: crPaise } = parseMessyAmountToPaise(r[mapping.creditCol || '']);

        if (crPaise > 0) {
          results.push({
            id: `custom-${i}-${Date.now()}`,
            type: 'income',
            amountPaise: crPaise,
            occurredAt,
            description: desc,
            referenceNumber: ref,
            source: 'import_custom',
            selected: true,
          });
        } else if (drPaise > 0) {
          results.push({
            id: `custom-${i}-${Date.now()}`,
            type: 'expense',
            amountPaise: drPaise,
            occurredAt,
            description: desc,
            referenceNumber: ref,
            source: 'import_custom',
            selected: true,
          });
        }
      } else if (mapping.strategy === 'single_signed') {
        const { amountPaise: amtPaise, isDebitHint, isCreditHint } = parseMessyAmountToPaise(r[mapping.amountCol || '']);
        if (amtPaise !== 0) {
          let type: 'income' | 'expense' = amtPaise > 0 ? 'income' : 'expense';
          if (isDebitHint) type = 'expense';
          if (isCreditHint) type = 'income';

          results.push({
            id: `custom-${i}-${Date.now()}`,
            type,
            amountPaise: Math.abs(amtPaise),
            occurredAt,
            description: desc,
            referenceNumber: ref,
            source: 'import_custom',
            selected: true,
          });
        }
      } else if (mapping.strategy === 'type_and_amount') {
        const typeStr = (r[mapping.typeCol || ''] || '').toLowerCase();
        const { amountPaise: amtPaise } = parseMessyAmountToPaise(r[mapping.amountCol || '']);
        const isIncome = ['cr', 'credit', 'income', 'deposit', 'received'].some((k) => typeStr.includes(k));
        if (amtPaise > 0) {
          results.push({
            id: `custom-${i}-${Date.now()}`,
            type: isIncome ? 'income' : 'expense',
            amountPaise: Math.abs(amtPaise),
            occurredAt,
            description: desc,
            referenceNumber: ref,
            source: 'import_custom',
            selected: true,
          });
        }
      }
    }

    return results;
  }

  /**
   * Annotates candidate statement entries with duplicate warnings based on existing active transactions.
   */
  static flagDuplicates(
    candidates: ParsedStatementEntry[],
    existingTransactions: Array<{ amountPaise: number; occurredAt: string; description: string; referenceNumber?: string }>
  ): ParsedStatementEntry[] {
    return candidates.map((cand) => {
      const candDate = cand.occurredAt.slice(0, 10);
      const candDesc = cand.description.toLowerCase().trim();

      const match = existingTransactions.find((ext) => {
        if (ext.amountPaise !== cand.amountPaise) return false;

        const extDate = ext.occurredAt.slice(0, 10);
        // Check exact reference match
        if (cand.referenceNumber && ext.referenceNumber && cand.referenceNumber === ext.referenceNumber) {
          return true;
        }

        // Check date equality & description similarity
        if (candDate === extDate) {
          const extDesc = ext.description.toLowerCase().trim();
          if (extDesc === candDesc || (candDesc.length > 3 && (candDesc.includes(extDesc) || extDesc.includes(candDesc)))) {
            return true;
          }
        }
        return false;
      });

      if (match) {
        return {
          ...cand,
          isPossibleDuplicate: true,
          duplicateReason: `Matches existing transaction on ${match.occurredAt.slice(0, 10)}: "${match.description}"`,
          selected: false, // unselect by default so user reviews
        };
      }
      return cand;
    });
  }
}
