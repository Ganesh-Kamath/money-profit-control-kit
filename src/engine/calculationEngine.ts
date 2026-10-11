/**
 * Authoritative Pure TypeScript Calculation Engine for Money & Profit Control Kit.
 * Single source of truth used by Dashboard, Drill-downs, Reports, and Exports.
 * Zero UI or storage dependencies.
 */

export interface TransactionRecord {
  id: string;
  type: 'income' | 'expense' | 'transfer' | 'adjustment';
  amountPaise: number;
  occurredAt: string;
  status: 'active' | 'voided';
  categoryId?: string;
  categoryName?: string;
  accountId?: string;
  accountName?: string;
  isStock?: boolean;
  isEquipment?: boolean;
  description: string;
  receiptId?: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  totalAmountPaise: number;
  paidAmountPaise: number;
  status: 'unpaid' | 'partially_paid' | 'paid' | 'cancelled';
}

export interface CategoryBreakdownItem {
  categoryId?: string;
  categoryName: string;
  amountPaise: number;
  amountFormatted: string;
  percentage: number;
  count: number;
  isStock: boolean;
  isEquipment: boolean;
}

export interface FinancialMetrics {
  revenuePaise: number;
  revenueFormatted: string;
  totalExpensePaise: number;
  totalExpenseFormatted: string;
  operatingExpensePaise: number;
  stockPurchasePaise: number;
  equipmentPurchasePaise: number;
  estimatedNetProfitPaise: number;
  estimatedNetProfitFormatted: string;
  netMarginPct: number;
  manualCogsPaise: number;
  grossProfitPaise: number;
  grossProfitFormatted: string;
  grossMarginPct: number;
  cashInflowsPaise: number;
  cashInflowsFormatted: string;
  cashOutflowsPaise: number;
  cashOutflowsFormatted: string;
  netCashMovementPaise: number;
  netCashMovementFormatted: string;
  transfersVolumePaise: number;
  totalReceivablesPaise: number;
  totalReceivablesFormatted: string;
  unpaidInvoicesCount: number;
  categoriesBreakdown: CategoryBreakdownItem[];
  paymentMethodsBreakdown: Record<string, number>;
  activeTransactionsCount: number;
  calculationNotes: string;
}

/**
 * Formats integer paise to Indian currency format.
 * Example: 12500000 paise -> ₹1,25,000.00
 */
export function formatINR(paise: number, includeSymbol = true): string {
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const remainderPaise = absPaise % 100;

  const s = rupees.toString();
  let formattedRupees = '';

  if (s.length <= 3) {
    formattedRupees = s;
  } else {
    const last3 = s.slice(-3);
    const other = s.slice(0, -3);
    const groups: string[] = [];
    let rem = other;
    while (rem.length > 0) {
      if (rem.length <= 2) {
        groups.unshift(rem);
        break;
      }
      groups.unshift(rem.slice(-2));
      rem = rem.slice(0, -2);
    }
    formattedRupees = groups.join(',') + ',' + last3;
  }

  const cents = remainderPaise.toString().padStart(2, '0');
  const result = `${formattedRupees}.${cents}`;
  const prefix = isNegative ? '-₹' : includeSymbol ? '₹' : '';
  const noSymbolPrefix = isNegative ? '-' : '';
  return includeSymbol ? `${prefix}${result}` : `${noSymbolPrefix}${result}`;
}

/**
 * Parses user input like '1,250.50' or '₹1250' to integer paise without float errors.
 */
export function parseINRToPaise(input: string): number {
  const cleaned = input.replace(/[₹,\s]/g, '').trim();
  if (!cleaned) return 0;

  const isNegative = cleaned.startsWith('-');
  const unsignedStr = isNegative ? cleaned.slice(1).trim() : cleaned;

  if (unsignedStr.includes('.')) {
    const [wholeStr, fracStr] = unsignedStr.split('.');
    const whole = parseInt(wholeStr || '0', 10);
    const frac = (fracStr || '').slice(0, 2).padEnd(2, '0');
    const cents = parseInt(frac, 10);
    const total = whole * 100 + cents;
    return isNegative ? -total : total;
  }

  const whole = parseInt(unsignedStr || '0', 10);
  const total = whole * 100;
  return isNegative ? -total : total;
}

/**
 * Calculates start and end timestamps for standard business periods in ISO format.
 */
export function getPeriodBoundaries(
  periodKey: string,
  referenceDate: Date = new Date(),
  fyStartMonth = 4
): { start: Date; end: Date } {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth(); // 0-indexed
  const day = referenceDate.getDate();

  let start: Date;
  let end: Date;

  if (periodKey === 'today') {
    start = new Date(year, month, day, 0, 0, 0, 0);
    end = new Date(year, month, day, 23, 59, 59, 999);
  } else if (periodKey === 'yesterday') {
    const yDay = new Date(year, month, day - 1);
    start = new Date(yDay.getFullYear(), yDay.getMonth(), yDay.getDate(), 0, 0, 0, 0);
    end = new Date(yDay.getFullYear(), yDay.getMonth(), yDay.getDate(), 23, 59, 59, 999);
  } else if (periodKey === 'this_week') {
    const dayOfWeek = referenceDate.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7; // 0 if Monday
    start = new Date(year, month, day - diffToMonday, 0, 0, 0, 0);
    end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000 + 86399999);
  } else if (periodKey === 'last_week') {
    const dayOfWeek = referenceDate.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    start = new Date(year, month, day - diffToMonday - 7, 0, 0, 0, 0);
    end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000 + 86399999);
  } else if (periodKey === 'this_month') {
    start = new Date(year, month, 1, 0, 0, 0, 0);
    end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  } else if (periodKey === 'last_month') {
    start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    end = new Date(year, month, 0, 23, 59, 59, 999);
  } else if (periodKey === 'this_fy') {
    // Indian Financial Year: April 1 to March 31
    const fyMonth0 = fyStartMonth - 1;
    if (month >= fyMonth0) {
      start = new Date(year, fyMonth0, 1, 0, 0, 0, 0);
      end = new Date(year + 1, fyMonth0, 0, 23, 59, 59, 999);
    } else {
      start = new Date(year - 1, fyMonth0, 1, 0, 0, 0, 0);
      end = new Date(year, fyMonth0, 0, 23, 59, 59, 999);
    }
  } else {
    // all_time fallback
    start = new Date(2000, 0, 1, 0, 0, 0, 0);
    end = new Date(year, month, day, 23, 59, 59, 999);
  }

  return { start, end };
}

export class CalculationEngine {
  /**
   * Authoritative calculation of financial metrics from raw ledger records.
   */
  static calculateMetrics(
    transactions: TransactionRecord[],
    invoices: InvoiceRecord[] = [],
    manualCogsPaise = 0
  ): FinancialMetrics {
    let revenuePaise = 0;
    let totalExpensePaise = 0;
    let operatingExpensePaise = 0;
    let stockPurchasePaise = 0;
    let equipmentPurchasePaise = 0;

    let cashInflowsPaise = 0;
    let cashOutflowsPaise = 0;
    let transfersVolumePaise = 0;

    const categoriesMap: Record<string, CategoryBreakdownItem> = {};
    const paymentMethodsMap: Record<string, number> = {};
    let activeTxCount = 0;

    for (const tx of transactions) {
      if (tx.status === 'voided') continue;
      activeTxCount++;

      const amt = tx.amountPaise;
      const catName = tx.categoryName || 'Uncategorized';
      const isStock = Boolean(tx.isStock);
      const isEquipment = Boolean(tx.isEquipment);
      const accName = tx.accountName || 'Primary Account';

      if (tx.type === 'income') {
        revenuePaise += amt;
        cashInflowsPaise += amt;
        paymentMethodsMap[accName] = (paymentMethodsMap[accName] || 0) + amt;
      } else if (tx.type === 'expense') {
        totalExpensePaise += amt;
        cashOutflowsPaise += amt;
        paymentMethodsMap[accName] = (paymentMethodsMap[accName] || 0) + amt;

        if (isStock) {
          stockPurchasePaise += amt;
        } else if (isEquipment) {
          equipmentPurchasePaise += amt;
        } else {
          operatingExpensePaise += amt;
        }

        if (!categoriesMap[catName]) {
          categoriesMap[catName] = {
            categoryId: tx.categoryId,
            categoryName: catName,
            amountPaise: 0,
            amountFormatted: '₹0.00',
            percentage: 0,
            count: 0,
            isStock,
            isEquipment,
          };
        }
        categoriesMap[catName].amountPaise += amt;
        categoriesMap[catName].count += 1;
      } else if (tx.type === 'transfer') {
        // Transfers are strictly neutral and move funds between accounts
        transfersVolumePaise += amt;
      }
    }

    // Unpaid invoices / Receivables
    let totalReceivablesPaise = 0;
    let unpaidInvoicesCount = 0;
    for (const inv of invoices) {
      if (inv.status === 'unpaid' || inv.status === 'partially_paid') {
        const outstanding = inv.totalAmountPaise - (inv.paidAmountPaise || 0);
        if (outstanding > 0) {
          totalReceivablesPaise += outstanding;
          unpaidInvoicesCount += 1;
        }
      }
    }

    // Net Profit = Recognized Income - Recognized Expenses
    const estimatedNetProfitPaise = revenuePaise - totalExpensePaise;
    const netMarginPct =
      revenuePaise > 0
        ? Math.round(((estimatedNetProfitPaise / revenuePaise) * 100) * 100) / 100
        : 0;

    // Gross Profit = Revenue - COGS
    const grossProfitPaise = revenuePaise - manualCogsPaise;
    const grossMarginPct =
      revenuePaise > 0
        ? Math.round(((grossProfitPaise / revenuePaise) * 100) * 100) / 100
        : 0;

    // Net Cash Movement = Inflows - Outflows
    const netCashMovementPaise = cashInflowsPaise - cashOutflowsPaise;

    // Category sorting and percentage
    const categoriesBreakdown = Object.values(categoriesMap).sort(
      (a, b) => b.amountPaise - a.amountPaise
    );
    for (const cat of categoriesBreakdown) {
      cat.amountFormatted = formatINR(cat.amountPaise);
      cat.percentage =
        totalExpensePaise > 0
          ? Math.round((cat.amountPaise / totalExpensePaise) * 1000) / 10
          : 0;
    }

    return {
      revenuePaise,
      revenueFormatted: formatINR(revenuePaise),
      totalExpensePaise,
      totalExpenseFormatted: formatINR(totalExpensePaise),
      operatingExpensePaise,
      stockPurchasePaise,
      equipmentPurchasePaise,
      estimatedNetProfitPaise,
      estimatedNetProfitFormatted: formatINR(estimatedNetProfitPaise),
      netMarginPct,
      manualCogsPaise,
      grossProfitPaise,
      grossProfitFormatted: formatINR(grossProfitPaise),
      grossMarginPct,
      cashInflowsPaise,
      cashInflowsFormatted: formatINR(cashInflowsPaise),
      cashOutflowsPaise,
      cashOutflowsFormatted: formatINR(cashOutflowsPaise),
      netCashMovementPaise,
      netCashMovementFormatted: formatINR(netCashMovementPaise),
      transfersVolumePaise,
      totalReceivablesPaise,
      totalReceivablesFormatted: formatINR(totalReceivablesPaise),
      unpaidInvoicesCount,
      categoriesBreakdown,
      paymentMethodsBreakdown: paymentMethodsMap,
      activeTransactionsCount: activeTxCount,
      calculationNotes:
        'Estimated net profit assumes all relevant business costs were recorded. Account transfers are strictly excluded from revenue and expenses.',
    };
  }

  /**
   * Detects duplicate candidates: identical amount, date within +/- daysWindow, and matching description.
   */
  static detectDuplicates(
    candidate: { amountPaise: number; occurredAt: string; description: string; id?: string },
    existingList: TransactionRecord[],
    daysWindow = 2
  ): TransactionRecord[] {
    const dups: TransactionRecord[] = [];
    const candDate = new Date(candidate.occurredAt).getTime();
    const candDesc = (candidate.description || '').toLowerCase().trim();

    for (const ext of existingList) {
      if (ext.id === candidate.id || ext.status === 'voided') continue;
      if (ext.amountPaise === candidate.amountPaise) {
        const extDate = new Date(ext.occurredAt).getTime();
        const diffDays = Math.abs(candDate - extDate) / (1000 * 60 * 60 * 24);
        if (diffDays <= daysWindow) {
          const extDesc = (ext.description || '').toLowerCase().trim();
          if (
            extDesc === candDesc ||
            (candDesc.length > 3 && (candDesc.includes(extDesc) || extDesc.includes(candDesc)))
          ) {
            dups.push(ext);
          }
        }
      }
    }
    return dups;
  }

  /**
   * Flags unusual statistical expense outliers (> threshold or > 2.5 std devs) neutrally.
   */
  static detectUnusualExpenses(
    expenses: TransactionRecord[],
    thresholdPaise = 500000
  ): Array<{ transaction: TransactionRecord; reason: string }> {
    const activeExpenses = expenses.filter((e) => e.type === 'expense' && e.status !== 'voided');
    if (!activeExpenses.length) return [];

    const amounts = activeExpenses.map((e) => e.amountPaise);
    const unusual: Array<{ transaction: TransactionRecord; reason: string }> = [];

    for (const exp of activeExpenses) {
      const amt = exp.amountPaise;
      let isUnusual = false;
      let reason = '';

      if (thresholdPaise > 0 && amt >= thresholdPaise) {
        isUnusual = true;
        reason = `Amount ${formatINR(amt)} exceeds your alert threshold (${formatINR(thresholdPaise)})`;
      } else if (amounts.length >= 4) {
        const others = amounts.filter((x) => x !== amt);
        if (others.length) {
          const mean = others.reduce((a, b) => a + b, 0) / others.length;
          const variance =
            others.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / others.length;
          const stdDev = Math.sqrt(variance);
          if (amt > mean + 2.5 * stdDev && amt > mean * 2) {
            isUnusual = true;
            reason = `Amount ${formatINR(amt)} is significantly higher than typical expenses (average: ${formatINR(Math.round(mean))})`;
          }
        }
      }

      if (isUnusual) {
        unusual.push({ transaction: exp, reason });
      }
    }
    return unusual;
  }
}
