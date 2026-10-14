import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  db,
  recalculateAccountBalance,
  type Invoice,
  type InvoiceLineItem,
  type Account,
  type BusinessProfile,
} from '../storage/db';
import { formatINR, parseINRToPaise } from '../engine/calculationEngine';
import {
  isValidGSTIN,
  getStateFromGSTIN,
  generateInvoiceNumber,
  calculateInvoice,
  validateTaxInvoiceRequirements,
  INDIAN_STATES,
} from '../engine/gstEngine';
import { buildUpiUri, generateQrSvg } from '../engine/qrCode';
import {
  FileText,
  Plus,
  CheckCircle,
  Clock,
  Printer,
  X,
  Lock,
  ArrowRight,
  QrCode,
  Building,
  Info,
  Trash2,
} from 'lucide-react';

export const ReceivablesPage: React.FC = () => {
  const { activeWorkspace, isBusinessPlan, showToast, setCurrentScreen } = useApp();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);

  // Profile Edit Modal
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [profLegalName, setProfLegalName] = useState<string>('');
  const [profAddress, setProfAddress] = useState<string>('');
  const [profState, setProfState] = useState<string>('Maharashtra');
  const [profGstin, setProfGstin] = useState<string>('');
  const [profBankName, setProfBankName] = useState<string>('');
  const [profAccountNum, setProfAccountNum] = useState<string>('');
  const [profIfsc, setProfIfsc] = useState<string>('');
  const [profUpiId, setProfUpiId] = useState<string>('');
  const [profPrefix, setProfPrefix] = useState<string>('INV');

  // Create invoice modal state
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState<boolean>(false);
  const [isTaxInvoiceMode, setIsTaxInvoiceMode] = useState<boolean>(false);
  const [invNumber, setInvNumber] = useState<string>('');
  const [contactName, setContactName] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [customerGstin, setCustomerGstin] = useState<string>('');
  const [placeOfSupplyState, setPlaceOfSupplyState] = useState<string>('Maharashtra');
  const [dueDate, setDueDate] = useState<string>('');
  const [invNotes, setInvNotes] = useState<string>('');

  // Line items state
  const [lineItems, setLineItems] = useState<
    Array<{ description: string; hsnSac: string; quantity: number; unit: string; rateStr: string; gstRatePct: number }>
  >([
    { description: 'Product / Service', hsnSac: '', quantity: 1, unit: 'pcs', rateStr: '', gstRatePct: 18 },
  ]);

  // Collect modal state
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
    if (accs.length > 0 && !collectAccountId) setCollectAccountId(accs[0].id);

    // Load profile
    const prof = await db.businessProfiles.get(activeWorkspace.id);
    if (prof) {
      setProfile(prof);
      setProfLegalName(prof.legalName || '');
      setProfAddress(prof.address || '');
      setProfState(prof.state || 'Maharashtra');
      setProfGstin(prof.gstin || '');
      setProfBankName(prof.bankName || '');
      setProfAccountNum(prof.accountNumber || '');
      setProfIfsc(prof.ifscCode || '');
      setProfUpiId(prof.upiId || '');
      setProfPrefix(prof.invoicePrefix || 'INV');
    }
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
          The Receivables & Invoicing module is a <strong>Business Plan</strong> exclusive. It allows creating GST tax invoices, partial collection tracking, and on-device printable invoice PDFs with local UPI QR codes.
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: BusinessProfile = {
      id: activeWorkspace.id,
      workspaceId: activeWorkspace.id,
      legalName: profLegalName.trim(),
      address: profAddress.trim(),
      state: profState,
      gstin: isValidGSTIN(profGstin) ? profGstin.trim().toUpperCase() : undefined,
      bankName: profBankName.trim() || undefined,
      accountNumber: profAccountNum.trim() || undefined,
      ifscCode: profIfsc.trim().toUpperCase() || undefined,
      upiId: profUpiId.trim() || undefined,
      invoicePrefix: profPrefix.trim().toUpperCase() || 'INV',
      nextInvoiceNumber: profile?.nextInvoiceNumber || 1,
      updatedAt: new Date().toISOString(),
    };

    await db.businessProfiles.put(updated);
    setProfile(updated);
    setIsProfileModalOpen(false);

    showToast({
      type: 'success',
      title: 'Business Profile Updated',
      message: 'Invoice header and banking details saved.',
    });
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { description: '', hsnSac: '', quantity: 1, unit: 'pcs', rateStr: '', gstRatePct: 18 },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !invNumber.trim()) return;

    const bizState = profile?.state || 'Maharashtra';
    const posState = placeOfSupplyState || bizState;

    // Build line item inputs
    const itemInputs = lineItems.map((li) => ({
      description: li.description.trim() || 'Item',
      hsnSac: li.hsnSac.trim() || undefined,
      quantity: li.quantity || 1,
      unit: li.unit.trim() || 'pcs',
      ratePaise: parseINRToPaise(li.rateStr || '0'),
      gstRatePct: isTaxInvoiceMode ? li.gstRatePct : 0,
    }));

    const { lineItems: calculatedItems, totals } = calculateInvoice(itemInputs, bizState, posState);

    if (totals.totalAmountPaise <= 0) {
      alert('Invoice total must be greater than zero.');
      return;
    }

    // Tax invoice validation if toggled
    if (isTaxInvoiceMode) {
      const validation = validateTaxInvoiceRequirements({
        businessLegalName: profile?.legalName,
        businessAddress: profile?.address,
        businessState: profile?.state,
        businessGstin: profile?.gstin,
        customerName: contactName.trim(),
        placeOfSupplyState: posState,
        lineItems: calculatedItems,
      });

      if (!validation.isReadyForTaxInvoice) {
        alert(`Cannot mark as Tax Invoice. Missing required fields:\n• ${validation.missingFields.join('\n• ')}`);
        return;
      }
    }

    const nowIso = new Date().toISOString();
    const newInv: Invoice = {
      id: `inv-${Date.now()}`,
      workspaceId: activeWorkspace.id,
      invoiceNumber: invNumber.trim(),
      contactName: contactName.trim(),
      customerAddress: customerAddress.trim() || undefined,
      customerGstin: customerGstin.trim().toUpperCase() || undefined,
      customerState: posState,
      issueDate: nowIso.slice(0, 10),
      dueDate: dueDate || nowIso.slice(0, 10),
      totalAmountPaise: totals.totalAmountPaise,
      paidAmountPaise: 0,
      status: 'unpaid',
      notes: invNotes.trim() || undefined,
      isTaxInvoice: isTaxInvoiceMode,
      businessLegalName: profile?.legalName,
      businessAddress: profile?.address,
      businessGstin: profile?.gstin,
      placeOfSupplyState: posState,
      lineItems: calculatedItems,
      taxableAmountPaise: totals.taxableAmountPaise,
      cgstPaise: totals.cgstPaise,
      sgstPaise: totals.sgstPaise,
      igstPaise: totals.igstPaise,
      totalInWords: totals.totalInWords,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Increment next invoice number in profile
    if (profile) {
      await db.businessProfiles.update(profile.id, {
        nextInvoiceNumber: (profile.nextInvoiceNumber || 1) + 1,
      });
    }

    await db.invoices.put(newInv);

    showToast({
      type: 'success',
      title: isTaxInvoiceMode ? 'Tax Invoice Created' : 'Bill Created',
      message: `${invNumber} for ${contactName} recorded (${formatINR(totals.totalAmountPaise)}).`,
    });

    setIsInvoiceModalOpen(false);
    setContactName('');
    setCustomerAddress('');
    setCustomerGstin('');
    setLineItems([{ description: 'Product / Service', hsnSac: '', quantity: 1, unit: 'pcs', rateStr: '', gstRatePct: 18 }]);
    await loadData();
  };

  const handleRecordCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectingInvoice) return;

    const collectPaise = parseINRToPaise(collectAmountStr);
    if (collectPaise <= 0 || !collectAccountId) return;

    const newPaidPaise = collectingInvoice.paidAmountPaise + collectPaise;
    const newStatus = newPaidPaise >= collectingInvoice.totalAmountPaise ? 'paid' : 'partially_paid';
    const nowIso = new Date().toISOString();

    await db.transaction('rw', [db.invoices, db.accounts, db.transactions], async () => {
      await db.invoices.update(collectingInvoice.id, {
        paidAmountPaise: newPaidPaise,
        status: newStatus,
        updatedAt: nowIso,
      });

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

      await recalculateAccountBalance(db, collectAccountId);
    });

    showToast({
      type: 'success',
      title: 'Payment Received',
      message: `${formatINR(collectPaise)} recorded into account balance.`,
    });

    setCollectingInvoice(null);
    setCollectAmountStr('');
    await loadData();
  };

  const totalOutstandingPaise = invoices
    .filter((i) => i.status === 'unpaid' || i.status === 'partially_paid')
    .reduce((s, i) => s + (i.totalAmountPaise - i.paidAmountPaise), 0);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-navy-950">Receivables & Invoicing</h1>
          <p className="text-xs text-navy-500 mt-0.5">
            GST Tax Invoices & Simple Bills · On-device PDF & Local UPI QR Code
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="px-3 py-2 text-xs font-semibold bg-white border border-surface-border hover:bg-surface-subtle text-navy-700 rounded-control transition flex items-center gap-1.5"
          >
            <Building className="h-3.5 w-3.5 text-brand-600" />
            <span>Business Profile & GST</span>
          </button>

          <button
            onClick={() => {
              const nextSeq = profile?.nextInvoiceNumber || 1;
              const autoInv = generateInvoiceNumber(profile?.invoicePrefix || 'INV', nextSeq);
              setInvNumber(autoInv);
              setDueDate(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
              setPlaceOfSupplyState(profile?.state || 'Maharashtra');
              setIsInvoiceModalOpen(true);
            }}
            className="px-4 py-2 bg-brand-600 text-white rounded-control text-xs font-bold hover:bg-brand-700 shadow-sm transition flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Summary KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-card border border-surface-border shadow-xs">
          <span className="text-xs font-semibold text-navy-500">Total Uncollected Receivables</span>
          <div className="text-2xl font-bold text-amber-700 mt-1">{formatINR(totalOutstandingPaise)}</div>
          <span className="text-[11px] text-navy-500">Across all open client invoices</span>
        </div>
        <div className="p-4 bg-white rounded-card border border-surface-border shadow-xs">
          <span className="text-xs font-semibold text-navy-500">Unpaid Invoices</span>
          <div className="text-2xl font-bold text-navy-950 mt-1">
            {invoices.filter((i) => i.status === 'unpaid' || i.status === 'partially_paid').length}
          </div>
          <span className="text-[11px] text-navy-500">Awaiting customer collection</span>
        </div>
        <div className="p-4 bg-white rounded-card border border-surface-border shadow-xs">
          <span className="text-xs font-semibold text-navy-500">Paid Invoices</span>
          <div className="text-2xl font-bold text-emerald-700 mt-1">
            {invoices.filter((i) => i.status === 'paid').length}
          </div>
          <span className="text-[11px] text-navy-500">Collected into cash/bank</span>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white rounded-card border border-surface-border shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
          <span className="text-xs font-bold text-navy-950">Invoices ({invoices.length})</span>
          <span className="text-[11px] text-navy-500">Print or collect payments with 1 tap</span>
        </div>

        {invoices.length === 0 ? (
          <div className="p-12 text-center text-xs text-navy-500">
            No invoices created yet. Tap "+ Create Invoice" to issue your first bill.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-subtle text-navy-600 font-semibold border-b border-surface-border">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Collected</th>
                  <th className="px-4 py-3 text-right">Pending</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {invoices.map((inv) => {
                  const pending = inv.totalAmountPaise - inv.paidAmountPaise;
                  return (
                    <tr key={inv.id} className="hover:bg-surface-subtle transition">
                      <td className="px-4 py-3 font-bold text-brand-700">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 font-semibold text-navy-950">{inv.contactName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-control ${
                            inv.isTaxInvoice
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-surface-subtle text-navy-600'
                          }`}
                        >
                          {inv.isTaxInvoice ? 'TAX INVOICE' : 'BILL'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-navy-600">{inv.dueDate}</td>
                      <td className="px-4 py-3 text-right font-bold text-navy-950">{formatINR(inv.totalAmountPaise)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{formatINR(inv.paidAmountPaise)}</td>
                      <td className="px-4 py-3 text-right font-bold text-amber-700">{formatINR(pending)}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            inv.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : inv.status === 'partially_paid'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {inv.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setPreviewingInvoice(inv)}
                            className="p-1 text-navy-600 hover:text-brand-600 hover:bg-surface-border rounded-control transition"
                            title="Print / View Invoice PDF"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          {inv.status !== 'paid' && (
                            <button
                              onClick={() => {
                                setCollectingInvoice(inv);
                                setCollectAmountStr((pending / 100).toString());
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-control transition"
                            >
                              Collect
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Printable Invoice Modal with QR Code and Clean Print Stylesheet */}
      {previewingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 p-4 print:p-0 print:bg-white print:fixed print:inset-0 animate-fadeIn">
          <div className="bg-white rounded-card max-w-2xl w-full border border-surface-border overflow-hidden max-h-[92vh] flex flex-col print:border-none print:shadow-none print:max-w-none print:h-auto">
            {/* Modal Header (Hidden on Print) */}
            <div className="flex items-center justify-between px-6 py-3 bg-surface-subtle border-b border-surface-border print:hidden">
              <span className="text-xs font-bold text-navy-900">Print Preview</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-control flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print / Save PDF</span>
                </button>
                <button
                  onClick={() => setPreviewingInvoice(null)}
                  className="p-1 text-navy-400 hover:text-navy-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* A4 Printable Sheet */}
            <div className="p-8 overflow-y-auto space-y-6 text-xs text-navy-900 print:overflow-visible print:p-8">
              {/* Document Title Header */}
              <div className="flex justify-between items-start border-b-2 border-navy-900 pb-4">
                <div>
                  <h2 className="text-base font-extrabold text-navy-950 uppercase tracking-tight">
                    {previewingInvoice.isTaxInvoice ? 'TAX INVOICE' : 'COMMERCIAL BILL'}
                  </h2>
                  <div className="text-sm font-bold text-navy-800 mt-1">
                    {previewingInvoice.businessLegalName || profile?.legalName || activeWorkspace.name}
                  </div>
                  <p className="text-navy-600 max-w-xs text-[11px] mt-0.5">
                    {previewingInvoice.businessAddress || profile?.address || 'India'}
                  </p>
                  {(previewingInvoice.businessGstin || profile?.gstin) && (
                    <div className="font-mono text-[11px] font-bold text-navy-900 mt-1">
                      GSTIN: {previewingInvoice.businessGstin || profile?.gstin}
                    </div>
                  )}
                </div>

                <div className="text-right space-y-1">
                  <div className="text-sm font-bold font-mono text-brand-800">
                    {previewingInvoice.invoiceNumber}
                  </div>
                  <div className="text-navy-600">Date: {previewingInvoice.issueDate}</div>
                  <div className="text-navy-600">Due: {previewingInvoice.dueDate}</div>
                  {previewingInvoice.placeOfSupplyState && (
                    <div className="text-[11px] font-semibold text-navy-700">
                      Place of Supply: {previewingInvoice.placeOfSupplyState}
                    </div>
                  )}
                </div>
              </div>

              {/* Bill To */}
              <div className="bg-surface-subtle p-3 rounded-control border border-surface-border">
                <span className="text-[10px] font-bold text-navy-500 uppercase tracking-wide">Billed To (Customer):</span>
                <div className="text-xs font-bold text-navy-950 mt-0.5">{previewingInvoice.contactName}</div>
                {previewingInvoice.customerAddress && (
                  <p className="text-navy-600 text-[11px] mt-0.5">{previewingInvoice.customerAddress}</p>
                )}
                {previewingInvoice.customerGstin && (
                  <div className="font-mono text-[11px] font-bold text-navy-800 mt-0.5">
                    Customer GSTIN: {previewingInvoice.customerGstin}
                  </div>
                )}
              </div>

              {/* Items Table */}
              <table className="w-full text-left border-collapse border border-surface-border text-xs">
                <thead>
                  <tr className="bg-surface-subtle text-navy-700 font-semibold">
                    <th className="p-2 border border-surface-border w-10 text-center">#</th>
                    <th className="p-2 border border-surface-border">Description</th>
                    {previewingInvoice.isTaxInvoice && <th className="p-2 border border-surface-border w-16">HSN/SAC</th>}
                    <th className="p-2 border border-surface-border text-center w-12">Qty</th>
                    <th className="p-2 border border-surface-border text-right w-20">Rate</th>
                    {previewingInvoice.isTaxInvoice && <th className="p-2 border border-surface-border text-center w-12">GST %</th>}
                    <th className="p-2 border border-surface-border text-right w-24">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(previewingInvoice.lineItems || []).map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="p-2 border border-surface-border text-center text-navy-500">{idx + 1}</td>
                      <td className="p-2 border border-surface-border font-medium text-navy-900">{item.description}</td>
                      {previewingInvoice.isTaxInvoice && (
                        <td className="p-2 border border-surface-border font-mono text-[11px]">{item.hsnSac || '—'}</td>
                      )}
                      <td className="p-2 border border-surface-border text-center">{item.quantity}</td>
                      <td className="p-2 border border-surface-border text-right">{formatINR(item.ratePaise)}</td>
                      {previewingInvoice.isTaxInvoice && (
                        <td className="p-2 border border-surface-border text-center font-semibold">{item.gstRatePct}%</td>
                      )}
                      <td className="p-2 border border-surface-border text-right font-bold text-navy-950">
                        {formatINR(item.totalPaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals & Tax Breakdown */}
              <div className="flex justify-between items-start gap-4">
                {/* Left: UPI QR Code and Bank Details */}
                <div className="space-y-3 max-w-xs">
                  {profile?.upiId && (
                    <div className="flex items-center gap-3 p-2.5 bg-surface-subtle border border-surface-border rounded-control">
                      <div
                        className="w-20 h-20 bg-white border border-surface-border flex items-center justify-center p-1 rounded-xs"
                        dangerouslySetInnerHTML={{
                          __html: generateQrSvg(
                            buildUpiUri({
                              upiId: profile.upiId,
                              payeeName: profile.legalName || activeWorkspace.name,
                              amountPaise: previewingInvoice.totalAmountPaise,
                              transactionNote: previewingInvoice.invoiceNumber,
                            }),
                            { size: 76 }
                          ),
                        }}
                      />
                      <div className="text-[11px] text-navy-700">
                        <div className="font-bold text-navy-950">Scan & Pay via UPI</div>
                        <div className="font-mono text-[10px] text-brand-700 break-all">{profile.upiId}</div>
                      </div>
                    </div>
                  )}

                  {profile?.bankName && (
                    <div className="text-[11px] text-navy-700 leading-tight">
                      <span className="font-bold text-navy-900">Bank Transfer Details:</span>
                      <div>Bank: {profile.bankName}</div>
                      <div>A/C: {profile.accountNumber}</div>
                      <div>IFSC: {profile.ifscCode}</div>
                    </div>
                  )}
                </div>

                {/* Right: Tax Summary */}
                <div className="w-56 space-y-1 text-xs">
                  {previewingInvoice.isTaxInvoice && (
                    <>
                      <div className="flex justify-between py-1 border-b border-surface-border">
                        <span className="text-navy-600">Taxable Amount:</span>
                        <span className="font-semibold">{formatINR(previewingInvoice.taxableAmountPaise || 0)}</span>
                      </div>
                      {(previewingInvoice.cgstPaise || 0) > 0 && (
                        <div className="flex justify-between py-1 border-b border-surface-border">
                          <span className="text-navy-600">CGST:</span>
                          <span className="font-semibold">{formatINR(previewingInvoice.cgstPaise || 0)}</span>
                        </div>
                      )}
                      {(previewingInvoice.sgstPaise || 0) > 0 && (
                        <div className="flex justify-between py-1 border-b border-surface-border">
                          <span className="text-navy-600">SGST:</span>
                          <span className="font-semibold">{formatINR(previewingInvoice.sgstPaise || 0)}</span>
                        </div>
                      )}
                      {(previewingInvoice.igstPaise || 0) > 0 && (
                        <div className="flex justify-between py-1 border-b border-surface-border">
                          <span className="text-navy-600">IGST:</span>
                          <span className="font-semibold">{formatINR(previewingInvoice.igstPaise || 0)}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between py-1.5 font-bold text-sm text-navy-950 border-t-2 border-navy-900">
                    <span>Total Amount:</span>
                    <span>{formatINR(previewingInvoice.totalAmountPaise)}</span>
                  </div>
                </div>
              </div>

              {/* Total in words */}
              {previewingInvoice.totalInWords && (
                <div className="text-[11px] font-semibold text-navy-700 italic border-t border-surface-border pt-2">
                  {previewingInvoice.totalInWords}
                </div>
              )}

              {/* Statutory Disclaimer */}
              <div className="pt-4 border-t border-surface-border text-[10px] text-navy-400 text-center leading-relaxed">
                * Note: This document is a commercial invoice for record-keeping and customer payment. It does not replace statutory GST returns (GSTR-1/3B) filed through the GST portal.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Business Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 animate-fadeIn">
          <div className="bg-white rounded-card shadow-modal max-w-lg w-full border border-surface-border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-surface-subtle border-b border-surface-border">
              <span className="text-xs font-bold text-navy-950">Business Profile & Invoice Settings</span>
              <button onClick={() => setIsProfileModalOpen(false)} className="p-1 text-navy-400 hover:text-navy-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Business Legal Name</label>
                <input
                  type="text"
                  value={profLegalName}
                  onChange={(e) => setProfLegalName(e.target.value)}
                  placeholder="e.g. Sweet Crumb Studio LLP"
                  className="w-full px-2.5 py-1.5 bg-surface-subtle border border-surface-border rounded-control"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-navy-700 mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={profGstin}
                    onChange={(e) => setProfGstin(e.target.value)}
                    placeholder="27AAPFU0939F1ZV"
                    className="w-full px-2.5 py-1.5 bg-surface-subtle border border-surface-border rounded-control uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-navy-700 mb-1">State</label>
                  <select
                    value={profState}
                    onChange={(e) => setProfState(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-surface-subtle border border-surface-border rounded-control"
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.name}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-navy-700 mb-1">Business Address</label>
                <textarea
                  value={profAddress}
                  onChange={(e) => setProfAddress(e.target.value)}
                  rows={2}
                  placeholder="Shop No. 4, MG Road, Pune - 411001"
                  className="w-full px-2.5 py-1.5 bg-surface-subtle border border-surface-border rounded-control"
                />
              </div>

              <div className="pt-2 border-t border-surface-border font-bold text-navy-900">
                Payment & Banking Details (Printed on Invoice)
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-navy-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={profBankName}
                    onChange={(e) => setProfBankName(e.target.value)}
                    placeholder="HDFC Bank"
                    className="w-full px-2.5 py-1.5 bg-surface-subtle border border-surface-border rounded-control"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-navy-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={profAccountNum}
                    onChange={(e) => setProfAccountNum(e.target.value)}
                    placeholder="50100012345678"
                    className="w-full px-2.5 py-1.5 bg-surface-subtle border border-surface-border rounded-control"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-navy-700 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={profIfsc}
                    onChange={(e) => setProfIfsc(e.target.value)}
                    placeholder="HDFC0001234"
                    className="w-full px-2.5 py-1.5 bg-surface-subtle border border-surface-border rounded-control uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-navy-700 mb-1">UPI ID (For QR Code)</label>
                  <input
                    type="text"
                    value={profUpiId}
                    onChange={(e) => setProfUpiId(e.target.value)}
                    placeholder="sweetcrumb@okaxis"
                    className="w-full px-2.5 py-1.5 bg-surface-subtle border border-surface-border rounded-control font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-4 py-2 text-navy-600 hover:text-navy-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-control transition"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 animate-fadeIn">
          <div className="bg-white rounded-card shadow-modal max-w-2xl w-full border border-surface-border overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-surface-subtle border-b border-surface-border">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-brand-600" />
                <h3 className="text-sm font-bold text-navy-950">Create Customer Invoice</h3>
              </div>
              <button onClick={() => setIsInvoiceModalOpen(false)} className="p-1 text-navy-400 hover:text-navy-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Mode Toggle: Simple Bill vs Tax Invoice */}
              <div className="flex items-center justify-between p-3 bg-brand-50/70 border border-brand-200 rounded-control">
                <div>
                  <div className="font-bold text-navy-950">
                    {isTaxInvoiceMode ? 'Tax Invoice (GST Active)' : 'Simple Commercial Bill (No GST)'}
                  </div>
                  <div className="text-[11px] text-navy-600">
                    {isTaxInvoiceMode
                      ? 'Applies CGST/SGST/IGST breakdown and requires valid GSTIN'
                      : 'Plain invoice without tax lines'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsTaxInvoiceMode(!isTaxInvoiceMode)}
                  className={`px-3 py-1.5 rounded-control font-bold text-xs transition ${
                    isTaxInvoiceMode
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-surface-border text-navy-700 hover:bg-surface-subtle'
                  }`}
                >
                  {isTaxInvoiceMode ? 'Mode: Tax Invoice' : 'Switch to GST Invoice'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-navy-700 mb-1">Invoice Number</label>
                  <input
                    type="text"
                    value={invNumber}
                    onChange={(e) => setInvNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-surface-subtle border border-surface-border rounded-control font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-navy-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-surface-subtle border border-surface-border rounded-control"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-navy-700 mb-1">Customer / Client Name</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Amit Verma, ABC Enterprises"
                    className="w-full px-2.5 py-1.5 bg-surface-subtle border border-surface-border rounded-control"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-navy-700 mb-1">Place of Supply (Customer State)</label>
                  <select
                    value={placeOfSupplyState}
                    onChange={(e) => setPlaceOfSupplyState(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-surface-subtle border border-surface-border rounded-control"
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.name}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {isTaxInvoiceMode && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-navy-700 mb-1">Customer GSTIN (Optional for B2C)</label>
                    <input
                      type="text"
                      value={customerGstin}
                      onChange={(e) => setCustomerGstin(e.target.value)}
                      placeholder="e.g. 27AAPFU0939F1ZV"
                      className="w-full px-2.5 py-1.5 bg-surface-subtle border border-surface-border rounded-control font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-navy-700 mb-1">Customer Address</label>
                    <input
                      type="text"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="City, State"
                      className="w-full px-2.5 py-1.5 bg-surface-subtle border border-surface-border rounded-control"
                    />
                  </div>
                </div>
              )}

              {/* Line items editor */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-navy-950">Line Items</span>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Line</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {lineItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-surface-subtle border border-surface-border rounded-control">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLineItems((prev) => prev.map((li, i) => (i === idx ? { ...li, description: val } : li)));
                          }}
                          placeholder="Item description"
                          className="w-full px-2 py-1 text-xs bg-white border border-surface-border rounded-control"
                        />
                      </div>
                      <div className="w-16">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1;
                            setLineItems((prev) => prev.map((li, i) => (i === idx ? { ...li, quantity: val } : li)));
                          }}
                          placeholder="Qty"
                          className="w-full px-2 py-1 text-xs bg-white border border-surface-border rounded-control text-center"
                        />
                      </div>
                      <div className="w-24">
                        <input
                          type="text"
                          value={item.rateStr}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLineItems((prev) => prev.map((li, i) => (i === idx ? { ...li, rateStr: val } : li)));
                          }}
                          placeholder="Rate (₹)"
                          className="w-full px-2 py-1 text-xs bg-white border border-surface-border rounded-control"
                        />
                      </div>
                      {isTaxInvoiceMode && (
                        <div className="w-20">
                          <select
                            value={item.gstRatePct}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setLineItems((prev) => prev.map((li, i) => (i === idx ? { ...li, gstRatePct: val } : li)));
                            }}
                            className="w-full px-1.5 py-1 text-xs bg-white border border-surface-border rounded-control"
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                            <option value={28}>28%</option>
                          </select>
                        </div>
                      )}
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(idx)}
                          className="p-1 text-navy-400 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-navy-700 mb-1">Notes / Terms</label>
                <input
                  type="text"
                  value={invNotes}
                  onChange={(e) => setInvNotes(e.target.value)}
                  placeholder="Thank you for your business! Payment due within 14 days."
                  className="w-full px-2.5 py-1.5 bg-surface-subtle border border-surface-border rounded-control"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-4 py-2 text-navy-600 hover:text-navy-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!contactName.trim()}
                  className="px-5 py-2 font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-control transition"
                >
                  Create & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collect Modal */}
      {collectingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 animate-fadeIn">
          <div className="bg-white rounded-card shadow-modal max-w-sm w-full border border-surface-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-navy-950">Record Payment Collection</h3>
              <button onClick={() => setCollectingInvoice(null)} className="p-1 text-navy-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRecordCollection} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-navy-700 mb-1">Amount Collected (₹)</label>
                <input
                  type="text"
                  value={collectAmountStr}
                  onChange={(e) => setCollectAmountStr(e.target.value)}
                  className="w-full px-3 py-2 text-base font-bold bg-surface-subtle border border-surface-border rounded-control"
                />
              </div>

              <div>
                <label className="block font-semibold text-navy-700 mb-1">Deposit Into Account</label>
                <select
                  value={collectAccountId}
                  onChange={(e) => setCollectAccountId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-surface-subtle border border-surface-border rounded-control"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({formatINR(a.currentBalancePaise)})</option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-control transition"
                >
                  Confirm & Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
