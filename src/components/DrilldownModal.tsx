import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { db, type Transaction, type Receipt } from '../storage/db';
import { formatINR } from '../engine/calculationEngine';
import { X, Search, FileText, ArrowDownRight, ArrowUpRight, ArrowRightLeft } from 'lucide-react';

export const DrilldownModal: React.FC = () => {
  const { drilldownParams, closeDrilldown, activeWorkspace } = useApp();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [receipts, setReceipts] = useState<Record<string, Receipt>>({});
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    if (!drilldownParams || !activeWorkspace) return;

    async function loadData() {
      let query = db.transactions.where('workspaceId').equals(activeWorkspace!.id);

      let items = await query.toArray();
      // Filter active
      items = items.filter((t) => t.status === 'active');

      if (drilldownParams?.filterType && drilldownParams.filterType !== 'all') {
        items = items.filter((t) => t.type === drilldownParams!.filterType);
      }
      if (drilldownParams?.categoryId) {
        items = items.filter((t) => t.categoryId === drilldownParams!.categoryId);
      }
      if (drilldownParams?.accountId) {
        items = items.filter(
          (t) => t.accountId === drilldownParams!.accountId || t.toAccountId === drilldownParams!.accountId
        );
      }
      if (drilldownParams?.startDate) {
        items = items.filter((t) => t.occurredAt >= drilldownParams!.startDate!);
      }
      if (drilldownParams?.endDate) {
        items = items.filter((t) => t.occurredAt <= drilldownParams!.endDate!);
      }

      // Sort by occurredAt descending
      items.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
      setTransactions(items);

      // Load receipts
      const rcptMap: Record<string, Receipt> = {};
      const allRcpts = await db.receipts
        .where('workspaceId')
        .equals(activeWorkspace!.id)
        .toArray();
      for (const r of allRcpts) {
        if (r.transactionId) rcptMap[r.transactionId] = r;
      }
      setReceipts(rcptMap);
    }

    loadData();
  }, [drilldownParams, activeWorkspace]);

  if (!drilldownParams) return null;

  const filtered = transactions.filter(
    (t) =>
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.referenceNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSumPaise = filtered.reduce((s, t) => {
    if (t.type === 'income') return s + t.amountPaise;
    if (t.type === 'expense') return s + t.amountPaise;
    return s;
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-3xl rounded-card bg-white shadow-2xl border border-surface-border overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4 bg-surface-subtle shrink-0">
          <div>
            <h2 className="text-base font-semibold text-navy-900">{drilldownParams.title}</h2>
            <p className="text-xs text-navy-500">
              Showing {filtered.length} underlying records · Total:{' '}
              <span className="font-semibold text-navy-900">{formatINR(totalSumPaise)}</span>
            </p>
          </div>
          <button
            onClick={closeDrilldown}
            className="rounded-control p-1 text-navy-400 hover:bg-surface-border hover:text-navy-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Filter */}
        <div className="p-4 border-b border-surface-border bg-white shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-400" />
            <input
              type="text"
              placeholder="Search descriptions, reference numbers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-control border border-surface-border pl-9 pr-3 py-1.5 text-xs text-navy-900 placeholder:text-navy-400 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Records Table */}
        <div className="overflow-y-auto p-4 flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-navy-400 text-xs">
              No matching records found for this drilldown view.
            </div>
          ) : (
            <div className="divide-y divide-surface-border">
              {filtered.map((tx) => {
                const rcpt = receipts[tx.id];
                const isInc = tx.type === 'income';
                const isExp = tx.type === 'expense';
                const isXfer = tx.type === 'transfer';

                return (
                  <div key={tx.id} className="py-3 flex items-center justify-between hover:bg-surface-subtle px-2 rounded-control transition">
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-full p-1.5 ${
                          isInc
                            ? 'bg-finance-incomeBg text-finance-income'
                            : isExp
                            ? 'bg-finance-expenseBg text-finance-expense'
                            : 'bg-brand-50 text-brand-600'
                        }`}
                      >
                        {isInc ? (
                          <ArrowDownRight className="h-4 w-4" />
                        ) : isExp ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowRightLeft className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-navy-900">{tx.description}</p>
                        <p className="text-[11px] text-navy-400">
                          {new Date(tx.occurredAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                          {tx.referenceNumber && ` · Ref: ${tx.referenceNumber}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {rcpt && (
                        <button
                          onClick={() => setSelectedReceipt(rcpt)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700 bg-brand-50 px-2 py-1 rounded-control"
                          title="View attached receipt"
                        >
                          <FileText className="h-3 w-3" />
                          <span>Receipt</span>
                        </button>
                      )}
                      <span
                        className={`text-xs font-bold tabular-nums ${
                          isInc
                            ? 'text-finance-income'
                            : isExp
                            ? 'text-finance-expense'
                            : 'text-brand-600'
                        }`}
                      >
                        {isInc ? '+' : isExp ? '−' : ''}
                        {formatINR(tx.amountPaise)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="p-4 border-t border-surface-border bg-surface-subtle flex justify-end shrink-0">
          <button
            onClick={closeDrilldown}
            className="px-4 py-2 rounded-control text-xs font-semibold text-navy-600 hover:bg-surface-border transition"
          >
            Close Drilldown
          </button>
        </div>
      </div>

      {/* Nested Receipt Viewer Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-card p-4 max-w-lg w-full max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-navy-900">{selectedReceipt.fileName}</span>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="text-navy-400 hover:text-navy-700 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-surface-subtle rounded-control p-2">
              {selectedReceipt.mimeType.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(selectedReceipt.blob)}
                  alt="Receipt"
                  className="max-h-[60vh] object-contain rounded"
                />
              ) : (
                <div className="text-center p-6 text-xs text-navy-600">
                  <p className="font-semibold mb-2">PDF Document Attached</p>
                  <a
                    href={URL.createObjectURL(selectedReceipt.blob)}
                    download={selectedReceipt.fileName}
                    className="px-3 py-1.5 bg-brand-600 text-white rounded text-xs inline-block"
                  >
                    Download PDF
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
