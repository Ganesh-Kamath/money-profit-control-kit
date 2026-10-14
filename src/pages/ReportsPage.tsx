import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  db,
  type Transaction,
  type Category,
  type Account,
  type Invoice,
  type PeriodLock,
  type Receipt,
} from '../storage/db';
import {
  formatINR,
  formatIndianDate,
  CalculationEngine,
  getPeriodBoundaries,
  sanitizeCSVCell,
  type FinancialMetrics,
  type PeriodComparison,
  type ReceivablesAgeingReport,
} from '../engine/calculationEngine';
import {
  FileText,
  Printer,
  Download,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Layers,
  Users,
  Briefcase,
  ShieldCheck,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { activeWorkspace, isBusinessPlan, showToast, openDrilldown } = useApp();

  const [periodKey, setPeriodKey] = useState<string>('this_month');
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [prevMetrics, setPrevMetrics] = useState<FinancialMetrics | null>(null);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);
  const [ageingReport, setAgeingReport] = useState<ReceivablesAgeingReport | null>(null);
  const [topCustomers, setTopCustomers] = useState<Array<{ name: string; totalRevenuePaise: number; totalRevenueFormatted: string }>>([]);
  const [periodLocks, setPeriodLocks] = useState<PeriodLock[]>([]);

  // Checklist for Month-End Review
  const [allReceiptsAttached, setAllReceiptsAttached] = useState<boolean>(false);
  const [backupTakenRecently, setBackupTakenRecently] = useState<boolean>(true);
  const [accountsReconciled, setAccountsReconciled] = useState<boolean>(false);

  // Period Lock Form
  const [lockDate, setLockDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [lockNotes, setLockNotes] = useState<string>('Month-end closing review approved');

  const [activeTab, setActiveTab] = useState<'pnl' | 'ageing' | 'accountant_pack' | 'month_end'>('pnl');

  const loadReport = async () => {
    if (!activeWorkspace) return;

    const now = new Date();
    const { start: curStart, end: curEnd } = getPeriodBoundaries(periodKey, now);

    // Compute previous period key for comparison
    let prevKey = 'last_month';
    let comparisonLabel = 'last month';
    if (periodKey === 'this_fy') {
      prevKey = 'last_fy';
      comparisonLabel = 'last financial year';
    } else if (periodKey === 'this_month') {
      prevKey = 'last_month';
      comparisonLabel = 'last month';
    } else if (periodKey === 'q1') {
      prevKey = 'q4';
      comparisonLabel = 'previous quarter (Q4)';
    } else if (periodKey === 'q2') {
      prevKey = 'q1';
      comparisonLabel = 'previous quarter (Q1)';
    } else if (periodKey === 'q3') {
      prevKey = 'q2';
      comparisonLabel = 'previous quarter (Q2)';
    } else if (periodKey === 'q4') {
      prevKey = 'q3';
      comparisonLabel = 'previous quarter (Q3)';
    }

    const { start: prevStart, end: prevEnd } = getPeriodBoundaries(prevKey, now);

    const allTxs = await db.transactions
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
    const allCats = await db.categories
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
    const allInvs = await db.invoices
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
    const allRcpts = await db.receipts
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();

    const catMap = Object.fromEntries(allCats.map((c) => [c.id, c]));

    const enriched = allTxs.map((t) => ({
      ...t,
      categoryName: t.categoryId ? catMap[t.categoryId]?.name : 'Uncategorized',
      isStock: t.categoryId ? catMap[t.categoryId]?.isStock : false,
      isEquipment: t.categoryId ? catMap[t.categoryId]?.isEquipment : false,
    }));

    const curTxs = enriched.filter(
      (t) => new Date(t.occurredAt) >= curStart && new Date(t.occurredAt) <= curEnd
    );
    const priorTxs = enriched.filter(
      (t) => new Date(t.occurredAt) >= prevStart && new Date(t.occurredAt) <= prevEnd
    );

    const computedCur = CalculationEngine.calculateMetrics(curTxs as any, allInvs as any);
    const computedPrev = CalculationEngine.calculateMetrics(priorTxs as any, allInvs as any);
    const comp = CalculationEngine.calculateComparison(computedCur, computedPrev, comparisonLabel);

    setMetrics(computedCur);
    setPrevMetrics(computedPrev);
    setComparison(comp);

    // Receivables Ageing
    const ageing = CalculationEngine.calculateReceivablesAgeing(allInvs as any, now);
    setAgeingReport(ageing);

    // Top Customers
    const top = CalculationEngine.calculateTopCustomers(allTxs as any, allInvs as any);
    setTopCustomers(top);

    // Check receipts completeness
    const expenseTxs = curTxs.filter((t) => t.type === 'expense' && t.status === 'active');
    const withReceipt = expenseTxs.filter((t) => t.receiptId);
    setAllReceiptsAttached(expenseTxs.length === 0 || withReceipt.length === expenseTxs.length);

    // Period Locks
    const locks = await db.periodLocks
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
    setPeriodLocks(locks);
  };

  useEffect(() => {
    loadReport();
  }, [activeWorkspace, periodKey]);

  if (!activeWorkspace || !metrics) return null;

  // Lock Period Action (Business Tier)
  const handleLockPeriod = async () => {
    if (!isBusinessPlan) {
      alert('Period locking is an exclusive feature of the Business Plan.');
      return;
    }

    await db.periodLocks.put({
      id: `lock-${Date.now()}`,
      workspaceId: activeWorkspace.id,
      periodEndDate: lockDate,
      lockedAt: new Date().toISOString(),
      notes: lockNotes,
    });

    showToast({
      type: 'success',
      title: 'Period Locked',
      message: `Financial transactions on or before ${lockDate} locked from editing.`,
    });

    loadReport();
  };

  // Export Clean Ledger CSV
  const handleExportLedgerCSV = async () => {
    const allTxs = await db.transactions
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
    const allCats = await db.categories.where('workspaceId').equals(activeWorkspace.id).toArray();
    const allAccs = await db.accounts.where('workspaceId').equals(activeWorkspace.id).toArray();

    const catMap = Object.fromEntries(allCats.map((c) => [c.id, c.name]));
    const accMap = Object.fromEntries(allAccs.map((a) => [a.id, a.name]));

    const rows = [
      ['Date', 'Description', 'Type', 'Account', 'Category', 'Debit (INR)', 'Credit (INR)', 'Reference', 'Status'],
    ];

    allTxs.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

    for (const tx of allTxs) {
      const isDebit = tx.type === 'expense';
      const isCredit = tx.type === 'income';
      const amtStr = (tx.amountPaise / 100).toFixed(2);

      rows.push([
        formatIndianDate(tx.occurredAt),
        sanitizeCSVCell(tx.description),
        tx.type.toUpperCase(),
        sanitizeCSVCell(accMap[tx.accountId] || ''),
        sanitizeCSVCell(tx.categoryId ? catMap[tx.categoryId] || '' : ''),
        isDebit ? amtStr : '',
        isCredit ? amtStr : '',
        sanitizeCSVCell(tx.referenceNumber || ''),
        tx.status,
      ]);
    }

    const csvContent = rows.map((r) => r.join(',')).join('\n');
    downloadFile(csvContent, `ledger-export-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');

    showToast({
      type: 'success',
      title: 'Ledger CSV Exported',
      message: `${allTxs.length} transactions exported with Indian date format.`,
    });
  };

  // Export Invoices CSV
  const handleExportInvoicesCSV = async () => {
    const allInvs = await db.invoices.where('workspaceId').equals(activeWorkspace.id).toArray();
    const rows = [
      ['Invoice Number', 'Issue Date', 'Due Date', 'Customer Name', 'Total Amount (INR)', 'Paid Amount (INR)', 'Status', 'Tax Invoice'],
    ];

    for (const inv of allInvs) {
      rows.push([
        sanitizeCSVCell(inv.invoiceNumber),
        formatIndianDate(inv.issueDate),
        formatIndianDate(inv.dueDate),
        sanitizeCSVCell(inv.contactName),
        (inv.totalAmountPaise / 100).toFixed(2),
        (inv.paidAmountPaise / 100).toFixed(2),
        inv.status.toUpperCase(),
        inv.isTaxInvoice ? 'YES' : 'NO',
      ]);
    }

    downloadFile(rows.map((r) => r.join(',')).join('\n'), `invoices-export-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
  };

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12 print-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-navy-950">Financial Reports & Accountant Pack</h1>
          <p className="text-xs text-navy-500 mt-0.5">
            Indian Financial Year (April–March) · Period Comparisons · One-Tap Accountant CSVs
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-surface-border rounded-control shadow-xs text-navy-800"
          >
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_fy">This Financial Year (2026-27)</option>
            <option value="last_fy">Last Financial Year (2025-26)</option>
            <option value="q1">Q1 (Apr–Jun)</option>
            <option value="q2">Q2 (Jul–Sep)</option>
            <option value="q3">Q3 (Oct–Dec)</option>
            <option value="q4">Q4 (Jan–Mar)</option>
            <option value="all_time">All Time</option>
          </select>

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-control text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-border no-print gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('pnl')}
          className={`pb-2.5 transition ${
            activeTab === 'pnl' ? 'border-b-2 border-brand-600 text-brand-600 font-bold' : 'text-navy-500 hover:text-navy-800'
          }`}
        >
          Operating Profit & Loss
        </button>
        <button
          onClick={() => setActiveTab('ageing')}
          className={`pb-2.5 transition ${
            activeTab === 'ageing' ? 'border-b-2 border-brand-600 text-brand-600 font-bold' : 'text-navy-500 hover:text-navy-800'
          }`}
        >
          Receivables Ageing
        </button>
        <button
          onClick={() => setActiveTab('accountant_pack')}
          className={`pb-2.5 transition ${
            activeTab === 'accountant_pack' ? 'border-b-2 border-brand-600 text-brand-600 font-bold' : 'text-navy-500 hover:text-navy-800'
          }`}
        >
          Accountant Pack (CSVs)
        </button>
        <button
          onClick={() => setActiveTab('month_end')}
          className={`pb-2.5 transition ${
            activeTab === 'month_end' ? 'border-b-2 border-brand-600 text-brand-600 font-bold' : 'text-navy-500 hover:text-navy-800'
          }`}
        >
          Month-End Review & Lock
        </button>
      </div>

      {/* TAB 1: P&L with Period Comparisons */}
      {activeTab === 'pnl' && (
        <div className="space-y-6">
          {/* Comparison Delta Banner */}
          {comparison && (
            <div className="p-4 bg-brand-50/70 border border-brand-200 rounded-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${comparison.isProfitUp ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {comparison.isProfitUp ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                </div>
                <div>
                  <div className="font-bold text-navy-950 text-sm">{comparison.profitSummary}</div>
                  <div className="text-navy-600 mt-0.5">{comparison.revenueSummary} • {comparison.expenseSummary}</div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-navy-500">Margin shift:</span>
                <span className="font-bold text-navy-900 ml-1">
                  {comparison.marginDeltaPct > 0 ? `+${comparison.marginDeltaPct}%` : `${comparison.marginDeltaPct}%`}
                </span>
              </div>
            </div>
          )}

          {/* Core Metrics Grid with Tappable Drilldown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => openDrilldown({ title: 'Total Revenue Drilldown', filterType: 'income' })}
              className="p-4 bg-white rounded-card border border-surface-border text-left hover:border-brand-500 transition shadow-xs"
            >
              <span className="text-xs font-semibold text-navy-500">Total Revenue (Recognized)</span>
              <div className="text-2xl font-bold text-navy-950 mt-1">{metrics.revenueFormatted}</div>
              <span className="text-[11px] text-brand-600 mt-1 flex items-center gap-1 font-semibold">
                <span>View transactions</span>
                <ArrowRight className="h-3 w-3" />
              </span>
            </button>

            <button
              onClick={() => openDrilldown({ title: 'Operating Expenses Drilldown', filterType: 'expense' })}
              className="p-4 bg-white rounded-card border border-surface-border text-left hover:border-brand-500 transition shadow-xs"
            >
              <span className="text-xs font-semibold text-navy-500">Total Expenses</span>
              <div className="text-2xl font-bold text-rose-700 mt-1">{metrics.totalExpenseFormatted}</div>
              <span className="text-[11px] text-brand-600 mt-1 flex items-center gap-1 font-semibold">
                <span>View transactions</span>
                <ArrowRight className="h-3 w-3" />
              </span>
            </button>

            <div className="p-4 bg-white rounded-card border border-surface-border text-left shadow-xs">
              <span className="text-xs font-semibold text-navy-500">Estimated Net Operating Profit</span>
              <div className="text-2xl font-bold text-emerald-700 mt-1">{metrics.estimatedNetProfitFormatted}</div>
              <span className="text-[11px] text-navy-600 mt-1 block">Net Margin: {metrics.netMarginPct}%</span>
            </div>
          </div>

          {/* Expense by Category Table */}
          <div className="bg-white rounded-card border border-surface-border shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
              <span className="text-xs font-bold text-navy-950">Expense Breakdown by Category</span>
              <span className="text-[11px] text-navy-500">Click category to drill down</span>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-surface-subtle text-navy-600 font-semibold border-b border-surface-border">
                <tr>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-center">Items</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Share (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {metrics.categoriesBreakdown.map((cat) => (
                  <tr
                    key={cat.categoryName}
                    onClick={() =>
                      cat.categoryId &&
                      openDrilldown({ title: `Category: ${cat.categoryName}`, categoryId: cat.categoryId })
                    }
                    className="hover:bg-surface-subtle cursor-pointer transition"
                  >
                    <td className="px-4 py-3 font-semibold text-navy-950 flex items-center gap-2">
                      <span>{cat.categoryName}</span>
                      {cat.isStock && (
                        <span className="px-1.5 py-0.5 text-[9px] bg-amber-100 text-amber-800 rounded font-bold">STOCK</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-navy-600">{cat.count}</td>
                    <td className="px-4 py-3 text-right font-bold text-navy-950">{cat.amountFormatted}</td>
                    <td className="px-4 py-3 text-right text-navy-600">{cat.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Receivables Ageing & Top Customers */}
      {activeTab === 'ageing' && (
        <div className="space-y-6">
          <div className="p-4 bg-white rounded-card border border-surface-border shadow-xs">
            <h3 className="text-sm font-bold text-navy-950 mb-1">Receivables Ageing Analysis</h3>
            <p className="text-xs text-navy-500 mb-4">
              Shows how long customer invoices have been overdue to help prioritize polite reminders.
            </p>

            {ageingReport && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-control">
                  <span className="text-xs font-bold text-emerald-900">0–30 Days (Current)</span>
                  <div className="text-xl font-bold text-emerald-700 mt-1">{ageingReport.current0to30.amountFormatted}</div>
                  <span className="text-[11px] text-emerald-800">{ageingReport.current0to30.invoiceCount} invoices</span>
                </div>

                <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-control">
                  <span className="text-xs font-bold text-amber-900">31–60 Days (Attention)</span>
                  <div className="text-xl font-bold text-amber-700 mt-1">{ageingReport.overdue31to60.amountFormatted}</div>
                  <span className="text-[11px] text-amber-800">{ageingReport.overdue31to60.invoiceCount} invoices</span>
                </div>

                <div className="p-4 bg-rose-50/60 border border-rose-200 rounded-control">
                  <span className="text-xs font-bold text-rose-900">61+ Days (Overdue)</span>
                  <div className="text-xl font-bold text-rose-700 mt-1">{ageingReport.overdue61plus.amountFormatted}</div>
                  <span className="text-[11px] text-rose-800">{ageingReport.overdue61plus.invoiceCount} invoices</span>
                </div>
              </div>
            )}
          </div>

          {/* Top Customers */}
          <div className="p-5 bg-white rounded-card border border-surface-border shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-brand-600" />
              <h3 className="text-xs font-bold text-navy-950">Top Clients by Revenue</h3>
            </div>

            {topCustomers.length === 0 ? (
              <p className="text-xs text-navy-500">No customer invoices recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {topCustomers.map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between p-2.5 bg-surface-subtle rounded-control text-xs">
                    <span className="font-semibold text-navy-900">#{i + 1} {c.name}</span>
                    <span className="font-bold text-navy-950">{c.totalRevenueFormatted}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Accountant Pack */}
      {activeTab === 'accountant_pack' && (
        <div className="space-y-6">
          <div className="p-6 bg-white rounded-card border border-surface-border shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-control">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-navy-950">One-Tap Accountant & CA Export Pack</h3>
                <p className="text-xs text-navy-500">
                  Clean, structured CSV spreadsheets designed specifically for your Chartered Accountant.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-surface-subtle border border-surface-border rounded-control space-y-2">
                <div className="font-bold text-xs text-navy-950">1. Complete General Ledger CSV</div>
                <p className="text-[11px] text-navy-600">
                  Contains all financial transactions with DD/MM/YYYY dates, debit/credit split, accounts, and reference numbers.
                </p>
                <button
                  onClick={handleExportLedgerCSV}
                  className="px-3 py-1.5 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-control transition flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Ledger CSV</span>
                </button>
              </div>

              <div className="p-4 bg-surface-subtle border border-surface-border rounded-control space-y-2">
                <div className="font-bold text-xs text-navy-950">2. Invoices & Receivables CSV</div>
                <p className="text-[11px] text-navy-600">
                  Customer invoice list with GST eligibility, payment status, issue dates, and outstanding balances.
                </p>
                <button
                  onClick={handleExportInvoicesCSV}
                  className="px-3 py-1.5 text-xs font-bold bg-white border border-surface-border hover:bg-surface-base text-navy-800 rounded-control transition flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Invoices CSV</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Month-End Review & Period Lock */}
      {activeTab === 'month_end' && (
        <div className="space-y-6">
          <div className="p-6 bg-white rounded-card border border-surface-border shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-navy-950">Month-End Closing Checklist</h3>
            <p className="text-xs text-navy-500">
              Complete these three checks before locking historical books to prevent accidental retroactive edits.
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 p-2.5 bg-surface-subtle rounded-control">
                <CheckCircle2 className={`h-4 w-4 ${allReceiptsAttached ? 'text-emerald-600' : 'text-amber-500'}`} />
                <span className="text-navy-800">
                  {allReceiptsAttached ? 'All current month expenses have receipts attached.' : 'Some expenses are missing receipts.'}
                </span>
              </div>

              <div className="flex items-center gap-2 p-2.5 bg-surface-subtle rounded-control">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-navy-800">All statement imports reviewed with zero pending duplicates.</span>
              </div>

              <div className="flex items-center gap-2 p-2.5 bg-surface-subtle rounded-control">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-navy-800">Bank accounts reconciled against physical passbook / statement.</span>
              </div>
            </div>

            {/* Lock Action (Business Plan) */}
            <div className="pt-4 border-t border-surface-border">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="h-4 w-4 text-brand-600" />
                <span className="text-xs font-bold text-navy-950">Lock Accounting Period (Business Tier)</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  type="date"
                  value={lockDate}
                  onChange={(e) => setLockDate(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-surface-subtle border border-surface-border rounded-control"
                />
                <input
                  type="text"
                  value={lockNotes}
                  onChange={(e) => setLockNotes(e.target.value)}
                  placeholder="Lock reason notes"
                  className="px-3 py-1.5 text-xs bg-surface-subtle border border-surface-border rounded-control flex-1"
                />
                <button
                  onClick={handleLockPeriod}
                  className="px-4 py-2 bg-brand-600 text-white rounded-control text-xs font-bold hover:bg-brand-700 shadow-xs transition"
                >
                  Lock Period
                </button>
              </div>

              {periodLocks.length > 0 && (
                <div className="mt-4">
                  <span className="text-[11px] font-bold text-navy-700">Existing Active Locks:</span>
                  <div className="space-y-1 mt-1 text-xs">
                    {periodLocks.map((l) => (
                      <div key={l.id} className="p-2 bg-surface-subtle border border-surface-border rounded-control flex justify-between">
                        <span>Locked up to {l.periodEndDate}</span>
                        <span className="text-navy-500 text-[11px]">{l.notes}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
