import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  db,
  recalculateAccountBalance,
  type Account,
  type Category,
  type TransactionType,
  type Transaction,
} from '../storage/db';
import { formatINR, parseINRToPaise, CalculationEngine } from '../engine/calculationEngine';
import { computeBlobSha256 } from '../engine/encryptionEngine';
import {
  X,
  PlusCircle,
  ArrowRightLeft,
  SlidersHorizontal,
  Paperclip,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const AddTransactionModal: React.FC = () => {
  const {
    isAddTxModalOpen,
    closeAddTxModal,
    activeWorkspace,
    showToast,
    openDrilldown,
  } = useApp();

  const [txType, setTxType] = useState<TransactionType>('expense');
  const [amountStr, setAmountStr] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');

  // Expandable details
  const [showMoreDetails, setShowMoreDetails] = useState<boolean>(false);
  const [occurredAt, setOccurredAt] = useState<string>(new Date().toISOString().slice(0, 16));
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [duplicateWarning, setDuplicateWarning] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!activeWorkspace) return;
    async function loadData() {
      const cats = await db.categories
        .where('workspaceId')
        .equals(activeWorkspace!.id)
        .toArray();
      const accs = await db.accounts
        .where('workspaceId')
        .equals(activeWorkspace!.id)
        .toArray();

      setCategories(cats);
      setAccounts(accs);

      // Defaults
      if (accs.length > 0) {
        const defAcc = accs.find((a) => a.isDefault) || accs[0];
        setAccountId(defAcc.id);
        const secAcc = accs.find((a) => a.id !== defAcc.id) || accs[0];
        setToAccountId(secAcc.id);
      }
    }
    loadData();
  }, [activeWorkspace, isAddTxModalOpen]);

  // Set default category when type changes
  useEffect(() => {
    const relevantCats = categories.filter((c) => c.type === (txType === 'income' ? 'income' : 'expense'));
    if (relevantCats.length > 0) {
      setCategoryId(relevantCats[0].id);
    }
  }, [txType, categories]);

  if (!isAddTxModalOpen || !activeWorkspace) return null;

  const amountPaise = parseINRToPaise(amountStr);
  const selectedCat = categories.find((c) => c.id === categoryId);
  const selectedAcc = accounts.find((a) => a.id === accountId);
  const selectedToAcc = accounts.find((a) => a.id === toAccountId);

  // Live Transaction Preview String
  const previewFormatted = formatINR(amountPaise);
  let previewText = '';
  if (txType === 'expense') {
    previewText = `−${previewFormatted} · ${selectedCat?.name || 'Category'} · ${selectedAcc?.name || 'Account'}`;
  } else if (txType === 'income') {
    previewText = `+${previewFormatted} · ${selectedCat?.name || 'Category'} · ${selectedAcc?.name || 'Account'}`;
  } else if (txType === 'transfer') {
    previewText = `⇄ ${previewFormatted} · ${selectedAcc?.name || 'From'} → ${selectedToAcc?.name || 'To'}`;
  } else {
    previewText = `⚙ Adjustment · ${previewFormatted} · ${selectedAcc?.name || 'Account'}`;
  }

  // Duplicate check on amount/description change
  const checkForDuplicates = async () => {
    if (amountPaise <= 0 || !description.trim()) {
      setDuplicateWarning(null);
      return;
    }
    const recent = await db.transactions
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .limit(100)
      .toArray();

    const matched = CalculationEngine.detectDuplicates(
      {
        amountPaise,
        occurredAt: new Date(occurredAt).toISOString(),
        description,
      },
      recent as any,
      2
    );

    setDuplicateWarning(matched.length > 0 ? (matched[0] as any) : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountPaise <= 0) {
      alert('Please enter an amount greater than 0');
      return;
    }
    if (txType === 'transfer' && accountId === toAccountId) {
      alert('Source and destination accounts for a transfer must be different.');
      return;
    }

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const txId = `tx-${Date.now()}`;
      let receiptId: string | undefined = undefined;

      // Handle receipt attachment
      if (receiptFile) {
        receiptId = `rcpt-${Date.now()}`;
        const sha256 = await computeBlobSha256(receiptFile);
        await db.receipts.put({
          id: receiptId,
          workspaceId: activeWorkspace.id,
          transactionId: txId,
          fileName: receiptFile.name,
          mimeType: receiptFile.type || 'image/jpeg',
          fileSizeBytes: receiptFile.size,
          sha256Hash: sha256,
          status: 'reviewed',
          blob: receiptFile,
          createdAt: nowIso,
        });
      }

      // Execute atomic balance update and transaction save
      await db.transaction('rw', db.accounts, db.transactions, db.receipts, async () => {
        const newTx: Transaction = {
          id: txId,
          workspaceId: activeWorkspace.id,
          type: txType,
          amountPaise,
          occurredAt: new Date(occurredAt).toISOString(),
          accountId,
          toAccountId: txType === 'transfer' ? toAccountId : undefined,
          categoryId: txType === 'transfer' || txType === 'adjustment' ? undefined : categoryId,
          description: description.trim() || (txType === 'transfer' ? 'Account Transfer' : 'Transaction'),
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
          status: 'active',
          receiptId,
          source: 'manual',
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        await db.transactions.put(newTx);
        await recalculateAccountBalance(db, accountId);
        if (txType === 'transfer' && toAccountId) {
          await recalculateAccountBalance(db, toAccountId);
        }
      });

      // Show toast with Undo option
      showToast({
        type: 'success',
        title: 'Transaction Saved',
        message: `${description || 'Entry'} for ${formatINR(amountPaise)} recorded.`,
        undoAction: async () => {
          await db.transaction('rw', db.accounts, db.transactions, async () => {
            await db.transactions.update(txId, {
              status: 'voided',
              voidReason: 'User clicked Undo from entry toast',
              voidedAt: new Date().toISOString(),
            });
            await recalculateAccountBalance(db, accountId);
            if (txType === 'transfer' && toAccountId) {
              await recalculateAccountBalance(db, toAccountId);
            }
          });
        },
      });

      // Reset form & close
      setAmountStr('');
      setDescription('');
      setReferenceNumber('');
      setNotes('');
      setReceiptFile(null);
      setDuplicateWarning(null);
      closeAddTxModal();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCategories = categories.filter(
    (c) => c.type === (txType === 'income' ? 'income' : 'expense')
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg rounded-card bg-white shadow-2xl border border-surface-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4 bg-surface-subtle">
          <div className="flex items-center gap-2">
            <div className="rounded-control bg-brand-500/10 p-2 text-brand-600">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-navy-900">Record Transaction</h2>
              <p className="text-xs text-navy-500">Atomic ledger write with instant balance update</p>
            </div>
          </div>
          <button
            onClick={closeAddTxModal}
            className="rounded-control p-1 text-navy-400 hover:bg-surface-border hover:text-navy-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type Selector Tabs */}
          <div className="grid grid-cols-4 gap-1.5 rounded-control bg-surface-subtle p-1 border border-surface-border">
            {(
              [
                { id: 'expense', label: 'Expense', color: 'text-finance-expense' },
                { id: 'income', label: 'Income', color: 'text-finance-income' },
                { id: 'transfer', label: 'Transfer', color: 'text-brand-600' },
                { id: 'adjustment', label: 'Adjust', color: 'text-navy-600' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTxType(tab.id)}
                className={`py-2 text-xs font-semibold rounded-control transition ${
                  txType === tab.id
                    ? 'bg-white shadow-sm text-navy-900 border border-surface-border'
                    : 'text-navy-500 hover:text-navy-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Amount Input with Currency Symbol */}
          <div>
            <label className="block text-xs font-medium text-navy-700 mb-1">
              Amount (₹) <span className="text-finance-expense">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-navy-400">
                ₹
              </span>
              <input
                type="text"
                required
                autoFocus
                placeholder="0.00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                onBlur={checkForDuplicates}
                className="w-full rounded-control border border-surface-borderStrong pl-8 pr-4 py-2.5 text-xl font-bold tracking-tight text-navy-950 placeholder:text-navy-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 tabular-nums"
              />
            </div>
          </div>

          {/* Live Preview Badge */}
          {amountPaise > 0 && (
            <div className="rounded-control bg-brand-50 border border-brand-100 px-3.5 py-2 text-xs font-medium text-brand-700 flex items-center justify-between">
              <span>Preview:</span>
              <span className="font-semibold">{previewText}</span>
            </div>
          )}

          {/* Duplicate Warning */}
          {duplicateWarning && (
            <div className="rounded-control bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Possible duplicate detected:</p>
                <p>
                  A recent transaction matching {formatINR(duplicateWarning.amountPaise)} on{' '}
                  {duplicateWarning.occurredAt.slice(0, 10)} exists ({duplicateWarning.description}).
                </p>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-navy-700 mb-1">
              Description <span className="text-finance-expense">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={
                txType === 'expense'
                  ? 'e.g., 5kg Amul Butter, Cake Boxes'
                  : txType === 'income'
                  ? 'e.g., Chocolate Truffle Cake order #104'
                  : 'Transfer details'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={checkForDuplicates}
              className="w-full rounded-control border border-surface-borderStrong px-3.5 py-2 text-sm text-navy-900 placeholder:text-navy-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* Category & Account Selectors */}
          {txType !== 'transfer' ? (
            <div className="grid grid-cols-2 gap-3">
              {txType !== 'adjustment' && (
                <div>
                  <label className="block text-xs font-medium text-navy-700 mb-1">
                    Category <span className="text-finance-expense">*</span>
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full rounded-control border border-surface-borderStrong px-3 py-2 text-sm text-navy-900 bg-white focus:border-brand-500 focus:outline-none"
                  >
                    {filteredCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} {cat.isStock ? '(Stock)' : cat.isEquipment ? '(Asset)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={txType === 'adjustment' ? 'col-span-2' : ''}>
                <label className="block text-xs font-medium text-navy-700 mb-1">
                  Payment Account <span className="text-finance-expense">*</span>
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full rounded-control border border-surface-borderStrong px-3 py-2 text-sm text-navy-900 bg-white focus:border-brand-500 focus:outline-none"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatINR(acc.currentBalancePaise)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            /* Transfer: Source & Destination Accounts */
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-navy-700 mb-1">
                  From Account (Withdraw) <span className="text-finance-expense">*</span>
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full rounded-control border border-surface-borderStrong px-3 py-2 text-sm text-navy-900 bg-white focus:border-brand-500 focus:outline-none"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatINR(acc.currentBalancePaise)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-navy-700 mb-1">
                  To Account (Deposit) <span className="text-finance-expense">*</span>
                </label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full rounded-control border border-surface-borderStrong px-3 py-2 text-sm text-navy-900 bg-white focus:border-brand-500 focus:outline-none"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatINR(acc.currentBalancePaise)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* More Details Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowMoreDetails(!showMoreDetails)}
              className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 transition"
            >
              {showMoreDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showMoreDetails ? 'Hide additional fields' : 'More details (Date, Bill #, Receipt, Notes)'}
            </button>
          </div>

          {showMoreDetails && (
            <div className="space-y-3 pt-2 border-t border-surface-border text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-navy-700 mb-1">Date & Time</label>
                  <input
                    type="datetime-local"
                    value={occurredAt}
                    onChange={(e) => setOccurredAt(e.target.value)}
                    className="w-full rounded-control border border-surface-borderStrong px-3 py-2 text-xs text-navy-900 bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-navy-700 mb-1">Bill / Reference Number</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-104 or UPI Ref"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full rounded-control border border-surface-borderStrong px-3 py-2 text-xs text-navy-900 placeholder:text-navy-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-navy-700 mb-1">Receipt Attachment (Photo / PDF)</label>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-control border border-surface-borderStrong bg-surface-subtle text-xs font-medium text-navy-700 hover:bg-surface-border transition">
                    <Paperclip className="h-3.5 w-3.5 text-navy-500" />
                    <span>{receiptFile ? receiptFile.name : 'Choose receipt file'}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setReceiptFile(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                  {receiptFile && (
                    <button
                      type="button"
                      onClick={() => setReceiptFile(null)}
                      className="text-xs text-finance-expense hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-medium text-navy-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional internal notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-control border border-surface-borderStrong px-3 py-2 text-xs text-navy-900 placeholder:text-navy-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
            <button
              type="button"
              onClick={closeAddTxModal}
              className="px-4 py-2.5 rounded-control text-xs font-semibold text-navy-600 hover:bg-surface-subtle transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || amountPaise <= 0}
              className="px-5 py-2.5 rounded-control text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
