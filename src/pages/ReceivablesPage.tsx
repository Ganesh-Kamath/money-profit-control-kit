import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  db,
  recalculateAccountBalance,
  type Invoice,
  type Account,
  type Transaction,
} from '../storage/db';
import { formatINR, parseINRToPaise } from '../engine/calculationEngine';
import {
  FileText,
  Plus,
  CheckCircle,
  Clock,
  Printer,
  X,
  Lock,
  ArrowRight,
} from 'lucide-react';

export const ReceivablesPage: React.FC = () => {
  const { activeWorkspace, isBusinessPlan, showToast, setCurrentScreen } = useApp();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Create invoice modal
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState<boolean>(false);
  const [invNumber, setInvNumber] = useState<string>('');
  const [contactName, setContactName] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [invNotes, setInvNotes] = useState<string>('');

  // Collect modal
  const [collectingInvoice, setCollectingInvoice] = useState<Invoice | null>(null);
  const [collectAmountStr, setCollectAmountStr] = useState<string>('');
  const [collectAccountId, setCollectAccountId] = useState<string>('');

  // Printable Invoice Preview
  const [previewingInvoice, setPreviewingInvoice] = useState<Invoice | null>(null);

  const loadData = async () => {
    if (!activeWorkspace) return;
    const invs = await db.invoices
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
    invs.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
    setInvoices(invs);

    const accs = await db.accounts
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
    setAccounts(accs);
    if (accs.length > 0) setCollectAccountId(accs[0].id);
  };

  useEffect(() => {
    loadData();
  }, [activeWorkspace]);

  if (!activeWorkspace) return null;

  // Plan Gate: Business Plan only
  if (!isBusinessPlan) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-card border border-surface-border shadow-sm text-center space-y-4">
        <div className="rounded-full bg-brand-50 p-3 w-12 h-12 text-brand-600 mx-auto flex items-center justify-center">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-base font-bold text-navy-950">Customer Invoices & Receivables</h2>
        <p className="text-xs text-navy-600 leading-relaxed">
          The Receivables & Invoicing module is a <strong>Business Plan</strong> exclusive. It allows creating customer bills, partial collection tracking, and on-device printable invoice PDFs.
        </p>
        <div className="pt-2">
          <button
            onClick={() => setCurrentScreen('settings')}
            className="px-4 py-2 bg-brand-600 text-white rounded-control text-xs font-semibold hover:bg-brand-700 transition"
          >
            Manage Licence in Settings
          </button>
        </div>
      </div>
    );
  }

  const totalOutstandingPaise = invoices
    .filter((i) => i.status === 'unpaid' || i.status === 'partially_paid')
    .reduce((s, i) => s + (i.totalAmountPaise - i.paidAmountPaise), 0);

  // Create Invoice
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalPaise = parseINRToPaise(amountStr);
    if (totalPaise <= 0 || !contactName.trim() || !invNumber.trim()) return;

    const nowIso = new Date().toISOString();
    await db.invoices.put({
      id: `inv-${Date.now()}`,
      workspaceId: activeWorkspace.id,
      invoiceNumber: invNumber.trim(),
      contactName: contactName.trim(),
      issueDate: nowIso.slice(0, 10),
      dueDate: dueDate || nowIso.slice(0, 10),
      totalAmountPaise: totalPaise,
      paidAmountPaise: 0,
      status: 'unpaid',
      notes: invNotes.trim() || undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    showToast({
      type: 'success',
      title: 'Invoice Created',
      message: `Invoice ${invNumber} for ${contactName} recorded.`,
    });

    setIsInvoiceModalOpen(false);
    setInvNumber('');
    setContactName('');
    setAmountStr('');
    setInvNotes('');
    loadData();
  };

  // Record Collection (Increases Cash without duplicating Revenue)
  const handleRecordCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectingInvoice) return;

    const collectPaise = parseINRToPaise(collectAmountStr);
    if (collectPaise <= 0 || !collectAccountId) return;

    const newPaidPaise = collectingInvoice.paidAmountPaise + collectPaise;
    const newStatus =
      newPaidPaise >= collectingInvoice.totalAmountPaise ? 'paid' : 'partially_paid';

    const nowIso = new Date().toISOString();

    await db.transaction('rw', db.invoices, db.accounts, db.transactions, async () => {
      // 1. Update invoice
      await db.invoices.update(collectingInvoice.id, {
        paidAmountPaise: newPaidPaise,
        status: newStatus,
        updatedAt: nowIso,
      });

      // 2. Add collection transaction (Increases Account Cash)
      // Marked with source 'invoice_collection' so it does NOT inflate revenue if recognized
      await db.transactions.put({
        id: `tx-col-${Date.now()}`,
        workspaceId: activeWorkspace.id,
        type: 'income',
        amountPaise: collectPaise,
        occurredAt: nowIso,
        accountId: collectAccountId,
        description: `Payment Collection for ${collectingInvoice.invoiceNumber} (${collectingInvoice.contactName})`,
        referenceNumber: collectingInvoice.invoiceNumber,
        status: 'active',
        source: 'invoice_collection',
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      // Recalculate cash balance
      await recalculateAccountBalance(db, collectAccountId);
    });

    showToast({
      type: 'success',
      title: 'Collection Recorded',
      message: `${formatINR(collectPaise)} collected into account. Account balance updated.`,
    });

    setCollectingInvoice(null);
    setCollectAmountStr('');
    loadData();
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-navy-950">Receivables & Invoicing</h1>
          <p className="text-xs text-navy-500 mt-0.5">
            Track unpaid balances · Collections update cash without duplicating revenue
          </p>
        </div>

        <button
          onClick={() => {
            setInvNumber(`INV-${Date.now().toString().slice(-4)}`);
            setDueDate(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
            setIsInvoiceModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-control bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 transition"
        >
          <Plus className="h-4 w-4" />
          <span>New Customer Invoice</span>
        </button>
      </div>

      {/* Summary Card */}
      <div className="rounded-card bg-white p-5 border border-surface-border shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-navy-500">Total Pending Customer Receivables</span>
          <p className="text-2xl font-bold text-navy-950 tabular-nums mt-1">
            {formatINR(totalOutstandingPaise)}
          </p>
          <p className="text-xs text-navy-400 mt-1">
            {invoices.filter((i) => i.status !== 'paid').length} open invoices awaiting payment
          </p>
        </div>
        <div className="rounded-full bg-amber-50 p-2.5 text-amber-700">
          <Clock className="h-6 w-6" />
        </div>
      </div>

      {/* Invoices List */}
      <div className="rounded-card bg-white border border-surface-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-subtle border-b border-surface-border text-navy-600 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Invoice #</th>
                <th className="py-3 px-4 font-semibold">Customer</th>
                <th className="py-3 px-4 font-semibold">Due Date</th>
                <th className="py-3 px-4 font-semibold text-right">Total Amount</th>
                <th className="py-3 px-4 font-semibold text-right">Paid</th>
                <th className="py-3 px-4 font-semibold text-right">Outstanding</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-navy-400">
                    No customer invoices created yet.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const outstanding = inv.totalAmountPaise - inv.paidAmountPaise;

                  return (
                    <tr key={inv.id} className="hover:bg-surface-subtle transition">
                      <td className="py-3 px-4 font-bold text-navy-900">{inv.invoiceNumber}</td>
                      <td className="py-3 px-4 font-medium text-navy-800">{inv.contactName}</td>
                      <td className="py-3 px-4 text-navy-600">{inv.dueDate}</td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums text-navy-950">
                        {formatINR(inv.totalAmountPaise)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-finance-income">
                        {formatINR(inv.paidAmountPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums text-navy-900">
                        {formatINR(outstanding)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            inv.status === 'paid'
                              ? 'bg-emerald-50 text-emerald-800'
                              : inv.status === 'partially_paid'
                              ? 'bg-blue-50 text-blue-800'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {inv.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setPreviewingInvoice(inv)}
                            className="text-navy-400 hover:text-brand-600 p-1"
                            title="Print / View Invoice"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          {inv.status !== 'paid' && (
                            <button
                              onClick={() => {
                                setCollectingInvoice(inv);
                                setCollectAmountStr((outstanding / 100).toFixed(2));
                              }}
                              className="px-2 py-1 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded text-[11px] font-medium"
                            >
                              Collect
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
      </div>

      {/* Collect Modal */}
      {collectingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-card bg-white p-6 shadow-2xl border border-surface-border space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-navy-900">Record Payment Collection</h3>
                <p className="text-xs text-navy-500">
                  {collectingInvoice.invoiceNumber} · {collectingInvoice.contactName}
                </p>
              </div>
              <button
                onClick={() => setCollectingInvoice(null)}
                className="text-navy-400 hover:text-navy-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRecordCollection} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-navy-700 mb-1">
                  Collection Amount (₹) <span className="text-finance-expense">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={collectAmountStr}
                  onChange={(e) => setCollectAmountStr(e.target.value)}
                  className="w-full rounded-control border border-surface-borderStrong px-3 py-2 text-sm font-bold text-navy-950"
                />
              </div>

              <div>
                <label className="block font-semibold text-navy-700 mb-1">Deposit Into Account</label>
                <select
                  value={collectAccountId}
                  onChange={(e) => setCollectAccountId(e.target.value)}
                  className="w-full rounded-control border border-surface-border px-3 py-1.5 text-xs text-navy-900 bg-white"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatINR(a.currentBalancePaise)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setCollectingInvoice(null)}
                  className="px-3 py-1.5 rounded text-navy-600 hover:bg-surface-subtle"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-brand-600 text-white font-semibold hover:bg-brand-700"
                >
                  Confirm Collection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-card bg-white p-6 shadow-2xl border border-surface-border space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-navy-900">Create Customer Invoice</h3>
              <button
                onClick={() => setIsInvoiceModalOpen(false)}
                className="text-navy-400 hover:text-navy-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-navy-700 mb-1">Invoice Number</label>
                  <input
                    type="text"
                    required
                    value={invNumber}
                    onChange={(e) => setInvNumber(e.target.value)}
                    className="w-full rounded-control border border-surface-border px-3 py-1.5 text-xs text-navy-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-navy-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-control border border-surface-border px-3 py-1.5 text-xs text-navy-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-navy-700 mb-1">Customer / Client Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Infosys Catering Order"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full rounded-control border border-surface-border px-3 py-1.5 text-xs text-navy-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-navy-700 mb-1">Total Bill Amount (₹)</label>
                <input
                  type="text"
                  required
                  placeholder="0.00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full rounded-control border border-surface-borderStrong px-3 py-2 text-sm font-bold text-navy-950"
                />
              </div>

              <div>
                <label className="block font-semibold text-navy-700 mb-1">Notes / Terms</label>
                <textarea
                  rows={2}
                  placeholder="e.g. 50% advance received, balance payable upon delivery"
                  value={invNotes}
                  onChange={(e) => setInvNotes(e.target.value)}
                  className="w-full rounded-control border border-surface-border px-3 py-1.5 text-xs text-navy-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-3 py-1.5 rounded text-navy-600 hover:bg-surface-subtle"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-brand-600 text-white font-semibold hover:bg-brand-700"
                >
                  Save Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Invoice Modal */}
      {previewingInvoice && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-card p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto print-page shadow-2xl">
            <div className="flex justify-between items-start border-b border-navy-200 pb-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-navy-950">{activeWorkspace.name}</h2>
                <p className="text-xs text-navy-500">Commercial Tax-Exempt Small Business Bill</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold uppercase tracking-wider text-navy-400">INVOICE</span>
                <p className="text-sm font-bold text-navy-900">{previewingInvoice.invoiceNumber}</p>
                <p className="text-xs text-navy-500">Issue Date: {previewingInvoice.issueDate}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs mb-6">
              <div>
                <span className="font-semibold text-navy-500">Billed To:</span>
                <p className="font-bold text-navy-900 mt-0.5">{previewingInvoice.contactName}</p>
              </div>
              <div className="text-right">
                <span className="font-semibold text-navy-500">Payment Due:</span>
                <p className="font-bold text-navy-900 mt-0.5">{previewingInvoice.dueDate}</p>
              </div>
            </div>

            {/* Line items table */}
            <table className="w-full text-left text-xs mb-6 border-collapse">
              <thead>
                <tr className="border-b border-navy-200 text-navy-600 font-semibold">
                  <th className="py-2">Description</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-surface-border">
                  <td className="py-3">
                    {previewingInvoice.notes || 'Goods & Services Provided as agreed'}
                  </td>
                  <td className="py-3 text-right font-bold tabular-nums">
                    {formatINR(previewingInvoice.totalAmountPaise)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Total balance box */}
            <div className="flex justify-end mb-8">
              <div className="w-64 space-y-1.5 text-xs">
                <div className="flex justify-between text-navy-600">
                  <span>Total Amount:</span>
                  <span className="font-semibold">{formatINR(previewingInvoice.totalAmountPaise)}</span>
                </div>
                <div className="flex justify-between text-finance-income">
                  <span>Amount Paid:</span>
                  <span className="font-semibold">{formatINR(previewingInvoice.paidAmountPaise)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-navy-950 border-t border-navy-300 pt-2">
                  <span>Balance Due:</span>
                  <span>{formatINR(previewingInvoice.totalAmountPaise - previewingInvoice.paidAmountPaise)}</span>
                </div>
              </div>
            </div>

            {/* Print trigger and close */}
            <div className="flex justify-between items-center pt-4 border-t border-surface-border no-print">
              <span className="text-[11px] text-navy-400">
                Printed from Money & Profit Control Kit (100% on-device)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewingInvoice(null)}
                  className="px-3 py-1.5 text-xs rounded border border-surface-border"
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-brand-600 text-white text-xs font-semibold rounded hover:bg-brand-700"
                >
                  Print / Save PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
