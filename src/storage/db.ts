import Dexie, { type Table } from 'dexie';

export type TransactionType = 'income' | 'expense' | 'transfer' | 'adjustment';
export type TransactionStatus = 'active' | 'voided';
export type AccountType = 'cash' | 'bank' | 'upi' | 'petty_cash' | 'custom';
export type ReceiptStatus = 'needs_details' | 'ready' | 'reviewed';
export type InvoiceStatus = 'unpaid' | 'partially_paid' | 'paid' | 'cancelled';
export type LicensePlan = 'solo' | 'business';

export interface Workspace {
  id: string;
  name: string;
  businessType: string;
  currency: string;
  timezone: string;
  fyStartMonth: number;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  workspaceId: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
  isStock?: boolean;
  isEquipment?: boolean;
  isDefault?: boolean;
  archived?: boolean;
  createdAt: string;
}

export interface Account {
  id: string;
  workspaceId: string;
  name: string;
  accountType: AccountType;
  accountNumberLast4?: string;
  openingBalancePaise: number;
  openingBalanceDate: string;
  currentBalancePaise: number;
  isDefault?: boolean;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  workspaceId: string;
  type: TransactionType;
  amountPaise: number;
  occurredAt: string;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  contactId?: string;
  description: string;
  referenceNumber?: string;
  notes?: string;
  status: TransactionStatus;
  voidReason?: string;
  voidedAt?: string;
  idempotencyKey?: string;
  source: string;
  isReviewed?: boolean;
  receiptId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  id: string;
  workspaceId: string;
  transactionId?: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256Hash: string;
  status: ReceiptStatus;
  blob: Blob;
  createdAt: string;
}

export interface Contact {
  id: string;
  workspaceId: string;
  name: string;
  contactType: 'customer' | 'supplier' | 'both';
  phone?: string;
  email?: string;
  upiId?: string;
  notes?: string;
  createdAt: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  hsnSac?: string;
  quantity: number;
  unit?: string;
  ratePaise: number;
  gstRatePct: number; // 0, 5, 12, 18, 28
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
}

export interface Invoice {
  id: string;
  workspaceId: string;
  invoiceNumber: string;
  contactId?: string;
  contactName: string;
  customerAddress?: string;
  customerGstin?: string;
  customerState?: string;
  issueDate: string;
  dueDate: string;
  totalAmountPaise: number;
  paidAmountPaise: number;
  status: InvoiceStatus;
  categoryId?: string;
  notes?: string;
  // GST & Tax Invoice fields (Part A2)
  isTaxInvoice?: boolean;
  businessLegalName?: string;
  businessGstin?: string;
  businessAddress?: string;
  placeOfSupplyState?: string;
  lineItems?: InvoiceLineItem[];
  taxableAmountPaise?: number;
  cgstPaise?: number;
  sgstPaise?: number;
  igstPaise?: number;
  totalInWords?: string;
  prefix?: string;
  sequenceNumber?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessProfile {
  id: string; // usually same as workspaceId or 'default'
  workspaceId: string;
  legalName: string;
  tradeName?: string;
  gstin?: string;
  address: string;
  state: string;
  stateCode?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  updatedAt: string;
}

export interface CategorisationRule {
  id: string;
  workspaceId: string;
  pattern: string; // substring match
  categoryId: string;
  matchType: 'contains' | 'starts_with' | 'exact';
  autoApplyOnImport: boolean;
  createdAt: string;
}

export interface RecurringEntry {
  id: string;
  workspaceId: string;
  title: string;
  type: 'income' | 'expense';
  amountPaise: number;
  categoryId?: string;
  accountId?: string;
  frequency: 'monthly' | 'weekly' | 'quarterly' | 'annual';
  dayOfMonth?: number; // 1-31
  nextDueDate: string; // YYYY-MM-DD
  lastConfirmedDate?: string;
  status: 'active' | 'paused';
  notes?: string;
  createdAt: string;
}

export interface DailyCashReconciliation {
  id: string;
  workspaceId: string;
  date: string; // YYYY-MM-DD
  countedCashPaise: number;
  expectedCashPaise: number;
  differencePaise: number;
  notes?: string;
  createdAt: string;
}

export interface Reconciliation {
  id: string;
  workspaceId: string;
  accountId: string;
  periodStart: string;
  periodEnd: string;
  statementBalancePaise: number;
  recordedBalancePaise: number;
  differencePaise: number;
  status: 'matched' | 'discrepancy';
  notes?: string;
  reconciledAt: string;
}

export interface PeriodLock {
  id: string;
  workspaceId: string;
  periodEndDate: string;
  lockedAt: string;
  notes?: string;
}

export interface AuditEvent {
  id: string;
  workspaceId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: any;
  afterState?: any;
  createdAt: string;
}

export interface Alert {
  id: string;
  workspaceId: string;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  entityType?: string;
  entityId?: string;
  isDismissed: boolean;
  createdAt: string;
}

export interface LicenseRecord {
  id: string;
  key: string;
  plan: LicensePlan;
  licenseeName: string;
  licenseeEmail: string;
  issuedAt: string;
  updatesUntil: string;
  verifiedAt: string;
}

export interface AppSecurityRecord {
  id: string; // 'current'
  pinHash?: string;
  pinSalt?: string;
  autoLockMinutes: number;
  lockOnBackground: boolean;
  isLocked: boolean;
}

export class ControlKitDatabase extends Dexie {
  workspaces!: Table<Workspace, string>;
  categories!: Table<Category, string>;
  accounts!: Table<Account, string>;
  transactions!: Table<Transaction, string>;
  receipts!: Table<Receipt, string>;
  contacts!: Table<Contact, string>;
  invoices!: Table<Invoice, string>;
  reconciliations!: Table<Reconciliation, string>;
  periodLocks!: Table<PeriodLock, string>;
  auditEvents!: Table<AuditEvent, string>;
  alerts!: Table<Alert, string>;
  license!: Table<LicenseRecord, string>;
  appSecurity!: Table<AppSecurityRecord, string>;
  businessProfiles!: Table<BusinessProfile, string>;
  categorisationRules!: Table<CategorisationRule, string>;
  recurringEntries!: Table<RecurringEntry, string>;
  dailyCashReconciliations!: Table<DailyCashReconciliation, string>;

  constructor() {
    super('ControlKitDB');
    this.version(1).stores({
      workspaces: 'id, name, isDemo',
      categories: 'id, workspaceId, type, [workspaceId+type]',
      accounts: 'id, workspaceId, name, [workspaceId+name]',
      transactions: 'id, workspaceId, occurredAt, accountId, categoryId, status, idempotencyKey, [workspaceId+status], [workspaceId+occurredAt]',
      receipts: 'id, workspaceId, transactionId, sha256Hash, status, [workspaceId+sha256Hash]',
      contacts: 'id, workspaceId, name',
      invoices: 'id, workspaceId, status, dueDate, [workspaceId+status]',
      reconciliations: 'id, workspaceId, accountId',
      periodLocks: 'id, workspaceId, periodEndDate, [workspaceId+periodEndDate]',
      auditEvents: 'id, workspaceId, entityId, createdAt',
      alerts: 'id, workspaceId, isDismissed, [workspaceId+isDismissed]',
      license: 'id',
      appSecurity: 'id',
    });

    this.version(2).stores({
      workspaces: 'id, name, isDemo',
      categories: 'id, workspaceId, type, [workspaceId+type]',
      accounts: 'id, workspaceId, name, [workspaceId+name]',
      transactions: 'id, workspaceId, occurredAt, accountId, categoryId, status, idempotencyKey, [workspaceId+status], [workspaceId+occurredAt]',
      receipts: 'id, workspaceId, transactionId, sha256Hash, status, [workspaceId+sha256Hash]',
      contacts: 'id, workspaceId, name',
      invoices: 'id, workspaceId, status, dueDate, [workspaceId+status]',
      reconciliations: 'id, workspaceId, accountId',
      periodLocks: 'id, workspaceId, periodEndDate, [workspaceId+periodEndDate]',
      auditEvents: 'id, workspaceId, entityId, createdAt',
      alerts: 'id, workspaceId, isDismissed, [workspaceId+isDismissed]',
      license: 'id',
      appSecurity: 'id',
      businessProfiles: 'id, workspaceId',
      categorisationRules: 'id, workspaceId, pattern, categoryId',
      recurringEntries: 'id, workspaceId, frequency, nextDueDate, status',
      dailyCashReconciliations: 'id, workspaceId, date',
    }).upgrade(async (tx) => {
      await tx.table('invoices').toCollection().modify((inv: any) => {
        if (inv.isTaxInvoice === undefined) {
          inv.isTaxInvoice = false;
        }
      });
    });
  }
}

export const db = new ControlKitDatabase();

/**
 * Atomic calculation and update of account balance inside a Dexie transaction.
 */
export async function recalculateAccountBalance(
  database: ControlKitDatabase,
  accountId: string
): Promise<number> {
  const account = await database.accounts.get(accountId);
  if (!account) return 0;

  const opening = account.openingBalancePaise || 0;

  // Inflows (active income to this account)
  const incomeTxs = await database.transactions
    .where('accountId')
    .equals(accountId)
    .filter((t) => t.status === 'active' && t.type === 'income')
    .toArray();
  const inflows = incomeTxs.reduce((sum, t) => sum + t.amountPaise, 0);

  // Outflows (active expense from this account)
  const expenseTxs = await database.transactions
    .where('accountId')
    .equals(accountId)
    .filter((t) => t.status === 'active' && t.type === 'expense')
    .toArray();
  const outflows = expenseTxs.reduce((sum, t) => sum + t.amountPaise, 0);

  // Transfers in (toAccountId = this account)
  const transfersInTxs = await database.transactions
    .filter((t) => t.status === 'active' && t.type === 'transfer' && t.toAccountId === accountId)
    .toArray();
  const transfersIn = transfersInTxs.reduce((sum, t) => sum + t.amountPaise, 0);

  // Transfers out (accountId = this account)
  const transfersOutTxs = await database.transactions
    .where('accountId')
    .equals(accountId)
    .filter((t) => t.status === 'active' && t.type === 'transfer')
    .toArray();
  const transfersOut = transfersOutTxs.reduce((sum, t) => sum + t.amountPaise, 0);

  // Adjustments (positive or negative)
  const adjTxs = await database.transactions
    .where('accountId')
    .equals(accountId)
    .filter((t) => t.status === 'active' && t.type === 'adjustment')
    .toArray();
  const adjustments = adjTxs.reduce((sum, t) => sum + t.amountPaise, 0);

  // Authoritative closing balance formula:
  // Closing = Opening + Inflows - Outflows + Net Transfers + Adjustments
  const closingBalancePaise = opening + inflows - outflows + (transfersIn - transfersOut) + adjustments;

  await database.accounts.update(accountId, {
    currentBalancePaise: closingBalancePaise,
    updatedAt: new Date().toISOString(),
  });

  return closingBalancePaise;
}
