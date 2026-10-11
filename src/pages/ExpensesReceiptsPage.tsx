import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  db,
  type Receipt,
  type Transaction,
  type Category,
  type ReceiptStatus,
} from '../storage/db';
import { formatINR } from '../engine/calculationEngine';
import { computeBlobSha256 } from '../engine/encryptionEngine';
import {
  UploadCloud,
  FileText,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Link as LinkIcon,
  X,
  Trash2,
} from 'lucide-react';

export const ExpensesReceiptsPage: React.FC = () => {
  const { activeWorkspace, showToast } = useApp();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [expenses, setExpenses] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Linking modal state
  const [linkingReceipt, setLinkingReceipt] = useState<Receipt | null>(null);
  const [selectedTxIdToLink, setSelectedTxIdToLink] = useState<string>('');

  // Preview modal
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);

  const loadData = async () => {
    if (!activeWorkspace) return;
    const rcpts = await db.receipts
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
    rcpts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setReceipts(rcpts);

    const txs = await db.transactions
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
    const activeExp = txs.filter((t) => t.type === 'expense' && t.status === 'active');
    setExpenses(activeExp);

    const cats = await db.categories
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
    setCategories(cats);
  };

  useEffect(() => {
    loadData();
  }, [activeWorkspace]);

  if (!activeWorkspace) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);

    let uploadedCount = 0;
    let duplicateCount = 0;

    for (const file of files) {
      const sha256 = await computeBlobSha256(file);
      // Duplicate hash check
      const existing = await db.receipts
        .where('workspaceId')
        .equals(activeWorkspace.id)
        .filter((r) => r.sha256Hash === sha256)
        .first();

      if (existing) {
        duplicateCount++;
        continue;
      }

      const receiptId = `rcpt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await db.receipts.put({
        id: receiptId,
        workspaceId: activeWorkspace.id,
        fileName: file.name,
        mimeType: file.type || 'image/jpeg',
        fileSizeBytes: file.size,
        sha256Hash: sha256,
        status: 'needs_details',
        blob: file,
        createdAt: new Date().toISOString(),
      });
      uploadedCount++;
    }

    showToast({
      type: uploadedCount > 0 ? 'success' : 'warning',
      title: 'Receipts Processed',
      message: `${uploadedCount} receipt(s) stored on-device.${
        duplicateCount > 0 ? ` ${duplicateCount} duplicate file(s) skipped.` : ''
      }`,
    });

    loadData();
  };

  const handleLinkToExpense = async () => {
    if (!linkingReceipt || !selectedTxIdToLink) return;

    await db.transaction('rw', db.receipts, db.transactions, async () => {
      await db.receipts.update(linkingReceipt.id, {
        transactionId: selectedTxIdToLink,
        status: 'reviewed',
      });
      await db.transactions.update(selectedTxIdToLink, {
        receiptId: linkingReceipt.id,
      });
    });

    showToast({
      type: 'success',
      title: 'Receipt Linked',
      message: 'Receipt linked to expense without modifying amounts or duplicating records.',
    });

    setLinkingReceipt(null);
    setSelectedTxIdToLink('');
    loadData();
  };

  const handleDeleteReceipt = async (id: string) => {
    await db.receipts.delete(id);
    showToast({ type: 'info', title: 'Receipt Deleted', message: 'Receipt removed from storage.' });
    loadData();
  };

  const filteredReceipts = receipts.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (searchTerm && !r.fileName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const txMap = Object.fromEntries(expenses.map((t) => [t.id, t]));

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-navy-950">Expenses & Receipts</h1>
          <p className="text-xs text-navy-500 mt-0.5">
            On-device blob storage · Hash duplicate detection · Zero double-counting
          </p>
        </div>

        <div>
          <label className="cursor-pointer inline-flex items-center gap-2 rounded-control bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 transition">
            <UploadCloud className="h-4 w-4" />
            <span>Upload Receipts (Photo/PDF)</span>
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-card border border-surface-border shadow-sm text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-navy-400" />
          <input
            type="text"
            placeholder="Search receipt filename..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-control border border-surface-border pl-8 pr-3 py-1.5 text-xs text-navy-900 placeholder:text-navy-400 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-navy-500">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-control border border-surface-border px-3 py-1.5 text-xs text-navy-900 bg-white focus:outline-none"
          >
            <option value="all">All ({receipts.length})</option>
            <option value="needs_details">Needs details</option>
            <option value="ready">Ready to link</option>
            <option value="reviewed">Reviewed & Linked</option>
          </select>
        </div>
      </div>

      {/* Receipts Grid */}
      {filteredReceipts.length === 0 ? (
        <div className="rounded-card bg-white p-12 border border-surface-border text-center text-navy-400 text-xs">
          <FileText className="h-8 w-8 mx-auto mb-2 text-navy-300" />
          <p className="font-semibold text-navy-600">No receipts uploaded yet</p>
          <p className="mt-1">
            Snap photos of bills or upload PDFs from vendors. Receipts are stored 100% locally on your device.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReceipts.map((rcpt) => {
            const linkedTx = rcpt.transactionId ? txMap[rcpt.transactionId] : undefined;
            const isImage = rcpt.mimeType.startsWith('image/');

            return (
              <div
                key={rcpt.id}
                className="rounded-card bg-white border border-surface-border p-4 shadow-sm flex flex-col justify-between hover:border-brand-500/50 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-brand-600 shrink-0" />
                      <span className="text-xs font-semibold text-navy-900 truncate max-w-[180px]" title={rcpt.fileName}>
                        {rcpt.fileName}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        rcpt.status === 'reviewed'
                          ? 'bg-emerald-50 text-emerald-800'
                          : rcpt.status === 'ready'
                          ? 'bg-blue-50 text-blue-800'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {rcpt.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-[11px] text-navy-400">
                    Uploaded: {new Date(rcpt.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ·{' '}
                    {(rcpt.fileSizeBytes / 1024).toFixed(1)} KB
                  </p>

                  {/* Linked Transaction Info */}
                  <div className="mt-3 p-2 rounded bg-surface-subtle border border-surface-border text-xs">
                    {linkedTx ? (
                      <div className="flex justify-between items-center">
                        <span className="text-navy-700 truncate">{linkedTx.description}</span>
                        <span className="font-bold text-finance-expense tabular-nums">
                          {formatINR(linkedTx.amountPaise)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-navy-400 italic text-[11px]">Not linked to any expense record yet</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 pt-3 border-t border-surface-border flex items-center justify-between text-xs">
                  <button
                    onClick={() => setViewingReceipt(rcpt)}
                    className="text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1"
                  >
                    <span>View File</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>

                  <div className="flex items-center gap-2">
                    {!linkedTx && (
                      <button
                        onClick={() => setLinkingReceipt(rcpt)}
                        className="px-2.5 py-1 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded text-xs font-medium flex items-center gap-1"
                      >
                        <LinkIcon className="h-3 w-3" />
                        <span>Link to Expense</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteReceipt(rcpt.id)}
                      className="text-navy-400 hover:text-finance-expense p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Link to Expense Modal */}
      {linkingReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-card bg-white p-6 shadow-2xl border border-surface-border space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-navy-900">Link Receipt to Expense</h3>
              <button onClick={() => setLinkingReceipt(null)} className="text-navy-400 hover:text-navy-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-navy-600">
              Select an existing recorded expense to pair with <strong>{linkingReceipt.fileName}</strong>. This ensures the expense is verified without double-counting.
            </p>
            <div>
              <label className="block text-xs font-semibold text-navy-700 mb-1">Select Expense</label>
              <select
                value={selectedTxIdToLink}
                onChange={(e) => setSelectedTxIdToLink(e.target.value)}
                className="w-full rounded-control border border-surface-border px-3 py-2 text-xs text-navy-900 bg-white"
              >
                <option value="">Choose an expense...</option>
                {expenses.map((tx) => (
                  <option key={tx.id} value={tx.id}>
                    {tx.occurredAt.slice(0, 10)} · {tx.description} ({formatINR(tx.amountPaise)})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setLinkingReceipt(null)}
                className="px-3 py-1.5 text-xs text-navy-600 hover:bg-surface-subtle rounded-control"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkToExpense}
                disabled={!selectedTxIdToLink}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-600 rounded-control hover:bg-brand-700 disabled:opacity-50"
              >
                Confirm Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Receipt Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-card p-4 max-w-xl w-full max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-navy-900">{viewingReceipt.fileName}</span>
              <button onClick={() => setViewingReceipt(null)} className="text-navy-400 hover:text-navy-700 p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-surface-subtle rounded-control p-2">
              {viewingReceipt.mimeType.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(viewingReceipt.blob)}
                  alt="Receipt Preview"
                  className="max-h-[60vh] object-contain rounded"
                />
              ) : (
                <div className="text-center p-6 text-xs text-navy-600">
                  <p className="font-semibold mb-2">PDF Document</p>
                  <a
                    href={URL.createObjectURL(viewingReceipt.blob)}
                    download={viewingReceipt.fileName}
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
