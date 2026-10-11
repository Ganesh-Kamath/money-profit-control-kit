import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  db,
  recalculateAccountBalance,
  type Transaction,
  type Category,
  type Account,
  type Receipt,
} from '../storage/db';
import { formatINR, CalculationEngine } from '../engine/calculationEngine';
import {
  Search,
  Filter,
  Download,
  Trash2,
  Edit2,
  FileText,
  AlertCircle,
  CheckSquare,
  Square,
  History,
  X,
  Plus,
} from 'lucide-react';

export const TransactionsPage: React.FC = () => {
  const { activeWorkspace, openAddTxModal, showToast } = useApp();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [receipts, setReceipts] = useState<Record<string, Receipt>>({});

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'voided' | 'all'>('active');

  // Multi-select & Bulk Categorize
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategoryTarget, setBulkCategoryTarget] = useState<string>('');

  // Void Modal state
  const [voidingTx, setVoidingTx] = useState<Transaction | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 25;

  const loadData = async () => {
    if (!activeWorkspace) return;
    const allTxs = await db.transactions
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();

    // Sort by occurredAt descending
    allTxs.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    setTransactions(allTxs);

    const cats = await db.categories
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
    setCategories(cats);

    const accs = await db.accounts
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
    setAccounts(accs);

    const allRcpts = await db.receipts
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
    const rMap: Record<string, Receipt> = {};
    for (const r of allRcpts) {
      if (r.transactionId) rMap[r.transactionId] = r;
    }
    setReceipts(rMap);
  };

  useEffect(() => {
    loadData();
  }, [activeWorkspace]);

  if (!activeWorkspace) return null;

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const accMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]));

  // Filtering
  const filtered = transactions.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (selectedType !== 'all' && t.type !== selectedType) return false;
    if (selectedCategory !== 'all' && t.categoryId !== selectedCategory) return false;
    if (selectedAccount !== 'all' && t.accountId !== selectedAccount && t.toAccountId !== selectedAccount)
      return false;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchDesc = t.description.toLowerCase().includes(q);
      const matchRef = (t.referenceNumber || '').toLowerCase().includes(q);
      if (!matchDesc && !matchRef) return false;
    }

    return true;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Bulk Selection
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedItems.map((t) => t.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkCategorize = async () => {
    if (!bulkCategoryTarget || selectedIds.size === 0) return;
    await db.transaction('rw', db.transactions, async () => {
      for (const id of selectedIds) {
        await db.transactions.update(id, {
          categoryId: bulkCategoryTarget,
          updatedAt: new Date().toISOString(),
        });
      }
    });

    showToast({
      type: 'success',
      title: 'Bulk Categorized',
      message: `${selectedIds.size} transaction(s) re-allocated to ${catMap[bulkCategoryTarget]}.`,
    });
    setSelectedIds(new Set());
    loadData();
  };

  // Soft Void
  const handleConfirmVoid = async () => {
    if (!voidingTx || !voidReason.trim()) return;

    await db.transaction('rw', db.accounts, db.transactions, db.auditEvents, async () => {
      const nowIso = new Date().toISOString();
      await db.transactions.update(voidingTx.id, {
        status: 'voided',
        voidReason,
        voidedAt: nowIso,
        updatedAt: nowIso,
      });

      await db.auditEvents.put({
        id: `audit-${Date.now()}`,
        workspaceId: activeWorkspace.id,
        action: 'void',
        entityType: 'transaction',
        entityId: voidingTx.id,
        beforeState: voidingTx,
        afterState: { status: 'voided', voidReason, voidedAt: nowIso },
        createdAt: nowIso,
      });

      await recalculateAccountBalance(db, voidingTx.accountId);
      if (voidingTx.type === 'transfer' && voidingTx.toAccountId) {
        await recalculateAccountBalance(db, voidingTx.toAccountId);
      }
    });

    showToast({
      type: 'info',
      title: 'Transaction Voided',
      message: `Transaction ${voidingTx.description} voided and balances updated atomically.`,
    });

    setVoidingTx(null);
    setVoidReason('');
    loadData();
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Date',
      'Type',
      'Amount (INR)',
      'Description',
      'Category',
      'Account',
      'Reference Number',
      'Status',
      'Receipt File',
    ];
    const rows = filtered.map((t) => [
      t.id,
      t.occurredAt.slice(0, 10),
      t.type,
      (t.amountPaise / 100).toFixed(2),
      `"${t.description.replace(/"/g, '""')}"`,
      `"${(catMap[t.categoryId || ''] || '').replace(/"/g, '""')}"`,
      `"${(accMap[t.accountId || ''] || '').replace(/"/g, '""')}"`,
      `"${(t.referenceNumber || '').replace(/"/g, '""')}"`,
      t.status,
      receipts[t.id] ? receipts[t.id].fileName : '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `transactions_${activeWorkspace.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-navy-950">Transactions Ledger</h1>
          <p className="text-xs text-navy-500 mt-0.5">
            {filtered.length} total records · Soft voids with full audit trace
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-control border border-surface-border bg-white px-3 py-1.5 text-xs font-semibold text-navy-700 shadow-sm hover:bg-surface-subtle transition"
          >
            <Download className="h-4 w-4 text-navy-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={openAddTxModal}
            className="inline-flex items-center gap-1.5 rounded-control bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>+ Add transaction</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-card bg-white p-4 border border-surface-border shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-navy-400" />
            <input
              type="text"
              placeholder="Search description, reference #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-control border border-surface-border pl-8 pr-3 py-1.5 text-xs text-navy-900 placeholder:text-navy-400 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full rounded-control border border-surface-border px-2.5 py-1.5 text-xs text-navy-900 bg-white focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="income">Income only</option>
              <option value="expense">Expense only</option>
              <option value="transfer">Transfers only</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-control border border-surface-border px-2.5 py-1.5 text-xs text-navy-900 bg-white focus:outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Account Filter */}
          <div>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full rounded-control border border-surface-border px-2.5 py-1.5 text-xs text-navy-900 bg-white focus:outline-none"
            >
              <option value="all">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-control p-2.5 text-xs text-brand-900">
            <span>{selectedIds.size} transactions selected</span>
            <div className="flex items-center gap-2">
              <select
                value={bulkCategoryTarget}
                onChange={(e) => setBulkCategoryTarget(e.target.value)}
                className="rounded-control border border-brand-200 px-2.5 py-1 text-xs bg-white text-navy-900"
              >
                <option value="">Choose Category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleBulkCategorize}
                disabled={!bulkCategoryTarget}
                className="px-3 py-1 bg-brand-600 text-white rounded-control text-xs font-semibold hover:bg-brand-700 disabled:opacity-50"
              >
                Apply Category
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div className="rounded-card bg-white border border-surface-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-subtle border-b border-surface-border text-navy-600 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 w-10">
                  <button onClick={toggleSelectAll} className="text-navy-400 hover:text-navy-700">
                    {selectedIds.size === paginatedItems.length && paginatedItems.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-brand-600" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Description</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Account</th>
                <th className="py-3 px-4 font-semibold text-right">Amount</th>
                <th className="py-3 px-4 font-semibold text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-navy-400">
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((tx) => {
                  const isInc = tx.type === 'income';
                  const isExp = tx.type === 'expense';
                  const isVoided = tx.status === 'voided';
                  const rcpt = receipts[tx.id];

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-surface-subtle transition ${
                        isVoided ? 'opacity-50 line-through bg-gray-50' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleSelectOne(tx.id)}
                          className="text-navy-400 hover:text-navy-700"
                        >
                          {selectedIds.has(tx.id) ? (
                            <CheckSquare className="h-4 w-4 text-brand-600" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-navy-600 whitespace-nowrap">
                        {tx.occurredAt.slice(0, 10)}
                      </td>
                      <td className="py-3 px-4 font-medium text-navy-950">
                        <div>
                          <span>{tx.description}</span>
                          {tx.referenceNumber && (
                            <span className="block text-[11px] text-navy-400">
                              Ref: {tx.referenceNumber}
                            </span>
                          )}
                          {isVoided && (
                            <span className="block text-[10px] text-finance-expense font-bold no-underline">
                              VOIDED: {tx.voidReason}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-navy-700">
                        {tx.categoryId ? (
                          <span className="inline-flex items-center gap-1 rounded bg-surface-subtle px-2 py-0.5 border border-surface-border">
                            {catMap[tx.categoryId] || 'Category'}
                          </span>
                        ) : (
                          <span className="text-navy-400 italic">Transfer</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-navy-600">
                        {tx.type === 'transfer' ? (
                          <span>
                            {accMap[tx.accountId]} → {accMap[tx.toAccountId || '']}
                          </span>
                        ) : (
                          accMap[tx.accountId] || 'Account'
                        )}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-bold tabular-nums whitespace-nowrap ${
                          isInc
                            ? 'text-finance-income'
                            : isExp
                            ? 'text-finance-expense'
                            : 'text-brand-600'
                        }`}
                      >
                        {isInc ? '+' : isExp ? '−' : ''}
                        {formatINR(tx.amountPaise)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {rcpt && (
                            <span title="Receipt attached" className="text-brand-600">
                              <FileText className="h-3.5 w-3.5" />
                            </span>
                          )}
                          {!isVoided && (
                            <button
                              onClick={() => setVoidingTx(tx)}
                              className="text-navy-400 hover:text-finance-expense transition p-1"
                              title="Soft void transaction"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-surface-border px-4 py-3 bg-surface-subtle text-xs text-navy-600">
          <span>
            Page {currentPage} of {totalPages} ({filtered.length} total entries)
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 rounded border border-surface-border bg-white disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 rounded border border-surface-border bg-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Soft Void Modal */}
      {voidingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-card bg-white p-6 shadow-2xl border border-surface-border space-y-4">
            <div className="flex items-center gap-2 text-finance-expense font-bold text-sm">
              <AlertCircle className="h-5 w-5" />
              <span>Soft Void Transaction</span>
            </div>
            <p className="text-xs text-navy-600">
              This will safely reverse{' '}
              <strong>
                {voidingTx.description} ({formatINR(voidingTx.amountPaise)})
              </strong>{' '}
              and update all account balances and reports atomically. No records are ever permanently destroyed.
            </p>
            <div>
              <label className="block text-xs font-semibold text-navy-700 mb-1">
                Reason for Voiding <span className="text-finance-expense">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Order cancelled, duplicate entry"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full rounded-control border border-surface-borderStrong px-3 py-2 text-xs text-navy-900 focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setVoidingTx(null)}
                className="px-3 py-1.5 text-xs text-navy-600 hover:bg-surface-subtle rounded-control"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmVoid}
                disabled={!voidReason.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-finance-expense rounded-control hover:bg-red-700 disabled:opacity-50"
              >
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
