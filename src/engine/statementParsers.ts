import Papa from 'papaparse';
import { parseINRToPaise } from './calculationEngine';

export interface ParsedStatementEntry {
  type: 'income' | 'expense';
  amountPaise: number;
  occurredAt: string;
  description: string;
  referenceNumber?: string;
  source: string;
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
 * Flexible date parser for Indian banking formats.
 */
export function parseDateFlexibly(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  const cleaned = dateStr.trim().replace(/['"]/g, '');

  // Try standard Date parsing
  const direct = new Date(cleaned);
  if (!isNaN(direct.getTime()) && cleaned.includes('-') && cleaned.length >= 8 && cleaned.slice(0, 4).match(/^\d{4}$/)) {
    return direct.toISOString();
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY
  const parts = cleaned.split(/[\/\-\s]/);
  if (parts.length >= 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);

    // If month is text (e.g. 10-Oct-2026)
    const monthNames: Record<string, number> = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
    };
    if (isNaN(month) && parts[1]) {
      const mStr = parts[1].toLowerCase().slice(0, 3);
      if (monthNames[mStr]) {
        month = monthNames[mStr];
      }
    }

    if (year < 100) year += 2000;
    if (day > 0 && day <= 31 && month > 0 && month <= 12 && year > 1900) {
      return new Date(year, month - 1, day, 12, 0, 0).toISOString();
    }
  }

  return new Date().toISOString();
}

export class StatementParser {
  /**
   * Parses raw CSV string to rows with headers.
   */
  static parseCSVText(csvContent: string): { headers: string[]; rows: Record<string, string>[] } {
    const parsed = Papa.parse<Record<string, string>>(csvContent.trim(), {
      header: true,
      skipEmptyLines: true,
    });
    const headers = parsed.meta.fields || [];
    const rows = parsed.data;
    return { headers, rows };
  }

  /**
   * Parses CSV content using a predefined bank/UPI preset.
   */
  static parseWithPreset(csvContent: string, presetKey: string): ParsedStatementEntry[] {
    const preset = BANK_PRESETS[presetKey];
    if (!preset) throw new Error(`Unknown preset: ${presetKey}`);

    const { rows } = this.parseCSVText(csvContent);
    const results: ParsedStatementEntry[] = [];

    for (const r of rows) {
      const dateVal = r[preset.dateCol];
      if (!dateVal) continue;
      const occurredAt = parseDateFlexibly(dateVal);
      const desc = r[preset.descCol] || 'Bank Entry';
      const ref = preset.refCol ? r[preset.refCol] : undefined;

      // Case 1: Separate Debit and Credit columns
      if (preset.debitCol && preset.creditCol) {
        const drPaise = parseINRToPaise(r[preset.debitCol] || '0');
        const crPaise = parseINRToPaise(r[preset.creditCol] || '0');

        if (crPaise > 0) {
          results.push({
            type: 'income',
            amountPaise: crPaise,
            occurredAt,
            description: desc,
            referenceNumber: ref,
            source: `import_${presetKey}`,
          });
        } else if (drPaise > 0) {
          results.push({
            type: 'expense',
            amountPaise: drPaise,
            occurredAt,
            description: desc,
            referenceNumber: ref,
            source: `import_${presetKey}`,
          });
        }
      }
      // Case 2: Type column + Amount column (PhonePe)
      else if (preset.typeCol && preset.amountCol) {
        const typeStr = (r[preset.typeCol] || '').toUpperCase();
        const amtPaise = parseINRToPaise(r[preset.amountCol] || '0');
        if (amtPaise > 0) {
          results.push({
            type: typeStr.includes('CREDIT') ? 'income' : 'expense',
            amountPaise: amtPaise,
            occurredAt,
            description: desc,
            referenceNumber: ref,
            source: `import_${presetKey}`,
          });
        }
      }
      // Case 3: Single signed or magnitude column (Google Pay / Razorpay)
      else if (preset.amountCol) {
        const amtPaise = parseINRToPaise(r[preset.amountCol] || '0');
        if (amtPaise !== 0) {
          results.push({
            type: amtPaise > 0 ? 'income' : 'expense',
            amountPaise: Math.abs(amtPaise),
            occurredAt,
            description: desc,
            referenceNumber: ref,
            source: `import_${presetKey}`,
          });
        }
      }
    }

    return results;
  }

  /**
   * Parses CSV content using custom column mapping wizard configuration.
   */
  static parseWithCustomMapping(
    csvContent: string,
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
    const { rows } = this.parseCSVText(csvContent);
    const results: ParsedStatementEntry[] = [];

    for (const r of rows) {
      const dateVal = r[mapping.dateCol];
      if (!dateVal) continue;
      const occurredAt = parseDateFlexibly(dateVal);
      const desc = r[mapping.descCol] || 'Imported Entry';
      const ref = mapping.refCol ? r[mapping.refCol] : undefined;

      if (mapping.strategy === 'separate_debit_credit') {
        const drPaise = parseINRToPaise(r[mapping.debitCol || ''] || '0');
        const crPaise = parseINRToPaise(r[mapping.creditCol || ''] || '0');

        if (crPaise > 0) {
          results.push({
            type: 'income',
            amountPaise: crPaise,
            occurredAt,
            description: desc,
            referenceNumber: ref,
            source: 'import_custom',
          });
        } else if (drPaise > 0) {
          results.push({
            type: 'expense',
            amountPaise: drPaise,
            occurredAt,
            description: desc,
            referenceNumber: ref,
            source: 'import_custom',
          });
        }
      } else if (mapping.strategy === 'single_signed') {
        const amtPaise = parseINRToPaise(r[mapping.amountCol || ''] || '0');
        if (amtPaise !== 0) {
          results.push({
            type: amtPaise > 0 ? 'income' : 'expense',
            amountPaise: Math.abs(amtPaise),
            occurredAt,
            description: desc,
            referenceNumber: ref,
            source: 'import_custom',
          });
        }
      } else if (mapping.strategy === 'type_and_amount') {
        const typeStr = (r[mapping.typeCol || ''] || '').toLowerCase();
        const amtPaise = Math.abs(parseINRToPaise(r[mapping.amountCol || ''] || '0'));
        const isIncome = ['cr', 'credit', 'income', 'deposit', 'received'].some((k) =>
          typeStr.includes(k)
        );
        if (amtPaise > 0) {
          results.push({
            type: isIncome ? 'income' : 'expense',
            amountPaise: amtPaise,
            occurredAt,
            description: desc,
            referenceNumber: ref,
            source: 'import_custom',
          });
        }
      }
    }

    return results;
  }
}
