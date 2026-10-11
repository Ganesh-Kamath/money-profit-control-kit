import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  db,
  recalculateAccountBalance,
  type Account,
  type Transaction,
  type Reconciliation,
  type AccountType,
} from '../storage/db';
import { formatINR, parseINRToPaise } from '../engine/calculationEngine';
import {
  Wallet,
  ArrowRightLeft,
  CheckCircle,
  AlertCircle,
  Plus,
  Edit2,
  Calendar,
  Check,
  X,
  History,
} from 'lucide-react';

export const CashAccountsPage: React.FC = () => {
  const { activeWorkspace, openAddTxModal, openDrilldown, showToast } = useApp();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);

  // Add / Edit Account modal
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accName, setAccName] = useState<string>('');
  const [accType, setAccType] = useState<AccountType>('bank');
  const [accNumberLast4, setAccNumberLast4] = useState<string>('');
  const [accOpeningBalStr, setAccOpeningBalStr] = useState<string>('');
  const [accOpeningDate, setAccOpeningDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Quick Transfer modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferFromId, setTransferFromId] = useState<string>('');
  const [transferToId, setTransferToId] = useState<string>('');
  const [transferAmtStr, setTransferAmtStr] = useState<string>('');
  const [transferDesc, setTransferDesc] = useState<string>('Sweep transfer between accounts');

  // Reconciliation modal
  const [reconcilingAccount, setReconcilingAccount] = useState<Account | null>(null);
  const [statementBalStr, setStatementBalStr] = useState<string>('');
  const [reconcilePeriodEnd, setReconcilePeriodEnd] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reconcileNotes, setReconcileNotes] = useState<string>('');

  const loadAccounts = async () => {
    if (!activeWorkspace) return;
    const allAccs = await db.accounts
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();

    // Recalculate each balance to guarantee 100% accuracy
    for (const a of allAccs) {
      await recalculateAccountBalance(db, a.id);
    }
    const refreshed = await db.accounts
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
    setAccounts(refreshed);

    const recons = await db.reconciliations
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
    setReconciliations(recons);
  };

  useEffect(() => {
    loadAccounts();
  }, [activeWorkspace]);

  if (!activeWorkspace) return null;

  const totalCashPaise = accounts.reduce((s, a) => s + a.currentBalancePaise, 0);

  // Save Account (Create or Update)
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;

    const openingPaise = parseINRToPaise(accOpeningBalStr || '0');
    const nowIso = new Date().toISOString();

    if (editingAccountId) {
      await db.accounts.update(editingAccountId, {
        name: accName.trim(),
        accountType: accType,
        accountNumberLast4: accNumberLast4.trim() || undefined,
        updatedAt: nowIso,
      });
      await recalculateAccountBalance(db, editingAccountId);
      showToast({ type: 'success', title: 'Account Updated', message: `Account ${accName} updated.` });
    } else {
      const newId = `acc-${Date.now()}`;
      await db.accounts.put({
        id: newId,
        workspaceId: activeWorkspace.id,
        name: accName.trim(),
        accountType: accType,
        accountNumberLast4: accNumberLast4.trim() || undefined,
        openingBalancePaise: openingPaise,
        openingBalanceDate: accOpeningDate,
        currentBalancePaise: openingPaise,
        isDefault: accounts.length === 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      showToast({ type: 'success', title: 'Account Created', message: `New account ${accName} created.` });
    }

    setIsAccountModalOpen(false);
    setEditingAccountId(null);
    setAccName('');
    setAccOpeningBalStr('');
    loadAccounts();
  };

  // Perform Transfer
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amtPaise = parseINRToPaise(transferAmtStr);
    if (amtPaise <= 0 || !transferFromId || !transferToId || transferFromId === transferToId) {
      alert('Please select valid distinct source and destination accounts and an amount.');
      return;
    }

    const nowIso = new Date().toISOString();
    await db.transaction('rw', db.accounts, db.transactions, async () => {
      const txId = `tx-xfer-${Date.now()}`;
      await db.transactions.put({
        id: txId,
        workspaceId: activeWorkspace.id,
        type: 'transfer',
        amountPaise: amtPaise,
        occurredAt: nowIso,
        accountId: transferFromId,
        toAccountId: transferToId,
        description: transferDesc.trim() || 'Account Transfer',
        status: 'active',
        source: 'manual',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      await recalculateAccountBalance(db, transferFromId);
      await recalculateAccountBalance(db, transferToId);
    });

    showToast({
      type: 'success',
      title: 'Transfer Completed',
      message: `${formatINR(amtPaise)} transferred atomically between accounts.`,
    });

    setIsTransferModalOpen(false);
    setTransferAmtStr('');
    loadAccounts();
  };

  // Perform Reconciliation
  const handlePerformReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcilingAccount) return;

    const stmtBalPaise = parseINRToPaise(statementBalStr);
    const recordedBal = reconcilingAccount.currentBalancePaise;
    const diffPaise = recordedBal - stmtBalPaise;
    const status = diffPaise === 0 ? 'matched' : 'discrepancy';

    await db.reconciliations.put({
      id: `recon-${Date.now()}`,
      workspaceId: activeWorkspace.id,
      accountId: reconcilingAccount.id,
      periodStart: reconcilingAccount.openingBalanceDate,
      periodEnd: reconcilePeriodEnd,
      statementBalancePaise: stmtBalPaise,
      recordedBalancePaise: recordedBal,
      differencePaise: diffPaise,
      status,
      notes: reconcileNotes.trim() || undefined,
      reconciledAt: new Date().toISOString(),
    });

    showToast({
      type: status === 'matched' ? 'success' : 'warning',
      title: status === 'matched' ? 'Reconciliation Matched' : 'Reconciliation Discrepancy',
      message:
        status === 'matched'
          ? `Recorded balance matches statement perfectly for ${reconcilingAccount.name}.`
          : `Difference of ${formatINR(Math.abs(diffPaise))} found between ledger and statement.`,
    });

    setReconcilingAccount(null);
    setStatementBalStr('');
    setReconcileNotes('');
    loadAccounts();
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-navy-950">Cash & Accounts</h1>
          <p className="text-xs text-navy-500 mt-0.5">
            Closing = Opening + Inflows − Outflows · Neutral transfers · Statement reconciliation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (accounts.length >= 2) {
                setTransferFromId(accounts[0].id);
                setTransferToId(accounts[1].id);
                setIsTransferModalOpen(true);
              } else {
                alert('You need at least 2 accounts to execute a transfer.');
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-control border border-surface-border bg-white px-3 py-1.5 text-xs font-semibold text-navy-700 shadow-sm hover:bg-surface-subtle transition"
          >
            <ArrowRightLeft className="h-4 w-4 text-brand-600" />
            <span>Transfer Funds</span>
          </button>
          <button
            onClick={() => {
              setEditingAccountId(null);
              setAccName('');
              setAccOpeningBalStr('0');
              setIsAccountModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-control bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>New Account</span>
          </button>
        </div>
      </div>

      {/* Total Balance Card */}
      <div className="rounded-card bg-white p-6 border border-surface-border shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-navy-500 uppercase tracking-wider">
            Total Current Business Funds Available
          </span>
          <p className="text-3xl font-extrabold text-navy-950 tabular-nums mt-1">
            {formatINR(totalCashPaise)}
          </p>
          <p className="text-xs text-navy-400 mt-1">
            Combined sum across {accounts.length} active business accounts
          </p>
        </div>
        <div className="rounded-full bg-brand-50 p-3 text-brand-600">
          <Wallet className="h-8 w-8" />
        </div>
      </div>

      {/* Accounts Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => {
          const accRecons = reconciliations.filter((r) => r.accountId === acc.id);
          const latestRecon = accRecons[accRecons.length - 1];

          return (
            <div
              key={acc.id}
              className="rounded-card bg-white border border-surface-border p-5 shadow-sm flex flex-col justify-between hover:border-brand-500/40 transition"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-navy-950">{acc.name}</h3>
                    <p className="text-[11px] text-navy-400 capitalize">
                      {acc.accountType} {acc.accountNumberLast4 && `(••${acc.accountNumberLast4})`}
                    </p>
                  </div>
                  <span className="rounded bg-surface-subtle px-2 py-0.5 text-[10px] font-bold text-navy-600 uppercase border border-surface-border">
                    {acc.accountType}
                  </span>
                </div>

                <div className="mt-4">
                  <span className="text-xs text-navy-500">Current Balance:</span>
                  <p className="text-2xl font-bold text-navy-950 tabular-nums mt-0.5">
                    {formatINR(acc.currentBalancePaise)}
                  </p>
                  <p className="text-[11px] text-navy-400 mt-1">
                    Opening: {formatINR(acc.openingBalancePaise)} (as of {acc.openingBalanceDate})
                  </p>
                </div>

                {/* Reconciliation Status */}
                <div className="mt-4 pt-3 border-t border-surface-border text-xs">
                  {latestRecon ? (
                    <div
                      className={`p-2 rounded flex items-center justify-between ${
                        latestRecon.status === 'matched'
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {latestRecon.status === 'matched' ? (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                        )}
                        <span className="text-[11px] font-medium capitalize">
                          {latestRecon.status} (as of {latestRecon.periodEnd})
                        </span>
                      </div>
                      {latestRecon.status === 'discrepancy' && (
                        <span className="text-[11px] font-bold">
                          Diff: {formatINR(Math.abs(latestRecon.differencePaise))}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-navy-400 italic">Not reconciled yet</div>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-4 pt-3 border-t border-surface-border flex items-center justify-between text-xs">
                <button
                  onClick={() =>
                    openDrilldown({
                      title: `Transactions for ${acc.name}`,
                      accountId: acc.id,
                      filterType: 'all',
                    })
                  }
                  className="text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1"
                >
                  <History className="h-3.5 w-3.5" />
                  <span>View History</span>
                </button>

                <button
                  onClick={() => {
                    setReconcilingAccount(acc);
                    setStatementBalStr((acc.currentBalancePaise / 100).toFixed(2));
                  }}
                  className="px-2.5 py-1 bg-surface-subtle hover:bg-surface-border text-navy-700 font-medium rounded text-xs transition"
                >
                  Reconcile
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reconciliation Modal */}
      {reconcilingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-card bg-white p-6 shadow-2xl border border-surface-border space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-navy-900">
                  Reconcile {reconcilingAccount.name}
                </h3>
                <p className="text-xs text-navy-500">Compare recorded balance against official bank statement</p>
              </div>
              <button
                onClick={() => setReconcilingAccount(null)}
                className="text-navy-400 hover:text-navy-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handlePerformReconciliation} className="space-y-3 text-xs">
              <div className="p-3 bg-surface-subtle rounded border border-surface-border flex justify-between">
                <span className="text-navy-600">Ledger Recorded Balance:</span>
                <span className="font-bold text-navy-900 tabular-nums">
                  {formatINR(reconcilingAccount.currentBalancePaise)}
                </span>
              </div>

              <div>
                <label className="block font-semibold text-navy-700 mb-1">
                  Statement Ending Balance (₹) <span className="text-finance-expense">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 52400.00"
                  value={statementBalStr}
                  onChange={(e) => setStatementBalStr(e.target.value)}
                  className="w-full rounded-control border border-surface-borderStrong px-3 py-2 text-sm font-bold text-navy-950 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-navy-700 mb-1">Statement Date</label>
                <input
                  type="date"
                  required
                  value={reconcilePeriodEnd}
                  onChange={(e) => setReconcilePeriodEnd(e.target.value)}
                  className="w-full rounded-control border border-surface-border px-3 py-1.5 text-xs text-navy-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-navy-700 mb-1">Reconciliation Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Oct statement matches Bank PDF"
                  value={reconcileNotes}
                  onChange={(e) => setReconcileNotes(e.target.value)}
                  className="w-full rounded-control border border-surface-border px-3 py-1.5 text-xs text-navy-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setReconcilingAccount(null)}
                  className="px-3 py-1.5 rounded text-navy-600 hover:bg-surface-subtle"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-brand-600 text-white font-semibold hover:bg-brand-700"
                >
                  Record Reconciliation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-card bg-white p-6 shadow-2xl border border-surface-border space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-navy-900">Transfer Funds</h3>
                <p className="text-xs text-navy-500">Strictly neutral movement between accounts</p>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-navy-400 hover:text-navy-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-navy-700 mb-1">From Account</label>
                  <select
                    value={transferFromId}
                    onChange={(e) => setTransferFromId(e.target.value)}
                    className="w-full rounded-control border border-surface-border px-2.5 py-1.5 text-xs text-navy-900 bg-white"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-navy-700 mb-1">To Account</label>
                  <select
                    value={transferToId}
                    onChange={(e) => setTransferToId(e.target.value)}
                    className="w-full rounded-control border border-surface-border px-2.5 py-1.5 text-xs text-navy-900 bg-white"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-navy-700 mb-1">
                  Amount (₹) <span className="text-finance-expense">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="0.00"
                  value={transferAmtStr}
                  onChange={(e) => setTransferAmtStr(e.target.value)}
                  className="w-full rounded-control border border-surface-borderStrong px-3 py-2 text-sm font-bold text-navy-950"
                />
              </div>

              <div>
                <label className="block font-semibold text-navy-700 mb-1">Description</label>
                <input
                  type="text"
                  value={transferDesc}
                  onChange={(e) => setTransferDesc(e.target.value)}
                  className="w-full rounded-control border border-surface-border px-3 py-1.5 text-xs text-navy-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-3 py-1.5 rounded text-navy-600 hover:bg-surface-subtle"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-brand-600 text-white font-semibold hover:bg-brand-700"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Modal (Create / Edit) */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-card bg-white p-6 shadow-2xl border border-surface-border space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-navy-900">
                {editingAccountId ? 'Edit Account' : 'Create Business Account'}
              </h3>
              <button
                onClick={() => setIsAccountModalOpen(false)}
                className="text-navy-400 hover:text-navy-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-navy-700 mb-1">
                  Account Name <span className="text-finance-expense">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Current, Cash Box, GPay QR"
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  className="w-full rounded-control border border-surface-borderStrong px-3 py-2 text-xs text-navy-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-navy-700 mb-1">Account Type</label>
                  <select
                    value={accType}
                    onChange={(e) => setAccType(e.target.value as AccountType)}
                    className="w-full rounded-control border border-surface-border px-2.5 py-1.5 text-xs text-navy-900 bg-white"
                  >
                    <option value="bank">Bank Account</option>
                    <option value="upi">UPI / QR Code</option>
                    <option value="cash">Cash in Hand</option>
                    <option value="petty_cash">Petty Cash</option>
                    <option value="custom">Custom Account</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-navy-700 mb-1">Last 4 Digits</label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="Optional (e.g. 4821)"
                    value={accNumberLast4}
                    onChange={(e) => setAccNumberLast4(e.target.value)}
                    className="w-full rounded-control border border-surface-border px-3 py-1.5 text-xs text-navy-900"
                  />
                </div>
              </div>

              {!editingAccountId && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-navy-700 mb-1">
                      Opening Balance (₹)
                    </label>
                    <input
                      type="text"
                      placeholder="0.00"
                      value={accOpeningBalStr}
                      onChange={(e) => setAccOpeningBalStr(e.target.value)}
                      className="w-full rounded-control border border-surface-border px-3 py-1.5 text-xs text-navy-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-navy-700 mb-1">As-Of Date</label>
                    <input
                      type="date"
                      value={accOpeningDate}
                      onChange={(e) => setAccOpeningDate(e.target.value)}
                      className="w-full rounded-control border border-surface-border px-3 py-1.5 text-xs text-navy-900"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-3 py-1.5 rounded text-navy-600 hover:bg-surface-subtle"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-brand-600 text-white font-semibold hover:bg-brand-700"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
