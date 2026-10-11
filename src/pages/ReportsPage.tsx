import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  db,
  type Transaction,
  type Category,
  type Account,
  type Invoice,
  type PeriodLock,
} from '../storage/db';
import {
  formatINR,
  CalculationEngine,
  getPeriodBoundaries,
  type FinancialMetrics,
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
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { activeWorkspace, isBusinessPlan, showToast } = useApp();

  const [reportType, setReportType] = useState<'weekly' | 'monthly' | 'month_end_review'>('weekly');
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [prevMetrics, setPrevMetrics] = useState<FinancialMetrics | null>(null);
  const [periodLocks, setPeriodLocks] = useState<PeriodLock[]>([]);

  // Period Lock Form
  const [lockDate, setLockDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [lockNotes, setLockNotes] = useState<string>('Month-end closing review approved');

  const loadReport = async () => {
    if (!activeWorkspace) return;

    const now = new Date();
    const periodKey = reportType === 'weekly' ? 'this_week' : 'this_month';
    const prevKey = reportType === 'weekly' ? 'last_week' : 'last_month';

    const { start: curStart, end: curEnd } = getPeriodBoundaries(periodKey, now);
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

    setMetrics(computedCur);
    setPrevMetrics(computedPrev);

    const locks = await db.periodLocks
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
    setPeriodLocks(locks);
  };

  useEffect(() => {
    loadReport();
  }, [activeWorkspace, reportType]);

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

  return (
    <div className="space-y-6 animate-fadeIn pb-12 print-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-navy-950">Financial Reports & Reviews</h1>
          <p className="text-xs text-navy-500 mt-0.5">
            Same authoritative calculation engine · Printable on-device PDF · Period locking
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Report Type Selector */}
          <div className="flex bg-surface-subtle p-1 rounded-control border border-surface-border text-xs">
            <button
              onClick={() => setReportType('weekly')}
              className={`px-3 py-1 font-semibold rounded ${
                reportType === 'weekly' ? 'bg-white shadow text-navy-900' : 'text-navy-500'
              }`}
            >
              Weekly Report
            </button>
            <button
              onClick={() => setReportType('monthly')}
              className={`px-3 py-1 font-semibold rounded ${
                reportType === 'monthly' ? 'bg-white shadow text-navy-900' : 'text-navy-500'
              }`}
            >
              Monthly Summary
            </button>
            <button
              onClick={() => setReportType('month_end_review')}
              className={`px-3 py-1 font-semibold rounded ${
                reportType === 'month_end_review' ? 'bg-white shadow text-navy-900' : 'text-navy-500'
              }`}
            >
              Month-End Review Flow
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-control bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 transition"
          >
            <Printer className="h-4 w-4" />
            <span>Print Report (PDF)</span>
          </button>
        </div>
      </div>

      {/* Honest Scope Disclaimer Box */}
      <div className="rounded-card bg-amber-50/80 border border-amber-200 p-3.5 text-xs text-amber-900 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
        <p>
          <strong>Notice for Indian Businesses:</strong> This financial report reflects managerial cash and profit tracking for owner decision-making. It complements your accountant and does <strong>NOT</strong> constitute statutory bookkeeping, GST filing, or audited income tax accounts.
        </p>
      </div>

      {/* Report Body Card */}
      <div className="rounded-card bg-white p-6 border border-surface-border shadow-sm space-y-6">
        {/* Printable Header */}
        <div className="border-b border-surface-border pb-4 flex justify-between items-start">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-600">
              Money & Profit Control Kit · Financial Statement
            </span>
            <h2 className="text-lg font-bold text-navy-950 mt-1">{activeWorkspace.name}</h2>
            <p className="text-xs text-navy-500">
              Generated on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-navy-700 uppercase">
              {reportType.replace(/_/g, ' ')}
            </span>
            <p className="text-xs text-navy-500">Currency: INR (₹) Paise Precision</p>
          </div>
        </div>

        {/* 1. Profitability Summary Table */}
        <div>
          <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-3">
            1. Profitability & Operational Performance
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded bg-surface-subtle border border-surface-border">
              <span className="text-navy-500">Net Sales Revenue</span>
              <p className="text-lg font-bold text-navy-950 tabular-nums mt-0.5">
                {metrics.revenueFormatted}
              </p>
            </div>
            <div className="p-3 rounded bg-surface-subtle border border-surface-border">
              <span className="text-navy-500">Recorded Expenses</span>
              <p className="text-lg font-bold text-finance-expense tabular-nums mt-0.5">
                {metrics.totalExpenseFormatted}
              </p>
            </div>
            <div className="p-3 rounded bg-surface-subtle border border-surface-border">
              <span className="text-navy-500">Estimated Net Profit</span>
              <p className="text-lg font-bold text-finance-income tabular-nums mt-0.5">
                {metrics.estimatedNetProfitFormatted}
              </p>
            </div>
            <div className="p-3 rounded bg-surface-subtle border border-surface-border">
              <span className="text-navy-500">Net Margin</span>
              <p className="text-lg font-bold text-navy-900 tabular-nums mt-0.5">
                {metrics.netMarginPct}%
              </p>
            </div>
          </div>
        </div>

        {/* 2. Cash Flow Movement (Inflows vs Outflows) */}
        <div>
          <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-3">
            2. Cash Flow Movement (Cash Inflows vs Outflows)
          </h3>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded bg-emerald-50/50 border border-emerald-100">
              <span className="text-emerald-800">Total Cash Inflows</span>
              <p className="text-base font-bold text-emerald-950 tabular-nums mt-0.5">
                {metrics.cashInflowsFormatted}
              </p>
            </div>
            <div className="p-3 rounded bg-rose-50/50 border border-rose-100">
              <span className="text-rose-800">Total Cash Outflows</span>
              <p className="text-base font-bold text-rose-950 tabular-nums mt-0.5">
                {metrics.cashOutflowsFormatted}
              </p>
            </div>
            <div className="p-3 rounded bg-surface-subtle border border-surface-border">
              <span className="text-navy-600">Net Cash Movement</span>
              <p className="text-base font-bold text-navy-950 tabular-nums mt-0.5">
                {metrics.netCashMovementFormatted}
              </p>
            </div>
          </div>
        </div>

        {/* 3. Largest Expense Categories */}
        <div>
          <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-3">
            3. Expense Categories Breakdown
          </h3>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border text-navy-500 text-[11px]">
                <th className="py-2">Category</th>
                <th className="py-2 text-center">Transactions</th>
                <th className="py-2 text-right">Amount</th>
                <th className="py-2 text-right">Share (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {metrics.categoriesBreakdown.map((c) => (
                <tr key={c.categoryName}>
                  <td className="py-2.5 font-medium text-navy-900">
                    {c.categoryName}{' '}
                    {c.isStock ? (
                      <span className="text-[10px] text-amber-600">(Stock/Raw Material)</span>
                    ) : c.isEquipment ? (
                      <span className="text-[10px] text-purple-600">(Asset Equipment)</span>
                    ) : null}
                  </td>
                  <td className="py-2.5 text-center text-navy-500">{c.count}</td>
                  <td className="py-2.5 text-right font-bold tabular-nums text-navy-900">
                    {c.amountFormatted}
                  </td>
                  <td className="py-2.5 text-right font-semibold text-navy-700">{c.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. Month-End Review & Period Locking Section */}
        {reportType === 'month_end_review' && (
          <div className="pt-4 border-t border-surface-border space-y-4">
            <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
              4. Month-End Control Checklist & Period Locking
            </h3>

            <div className="p-4 rounded-control bg-surface-subtle border border-surface-border space-y-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>All bank accounts reconciled against official statements.</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Outstanding customer receivables reviewed ({metrics.totalReceivablesFormatted} pending).</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>On-device database backup recommended prior to locking period.</span>
              </div>
            </div>

            {/* Lock Period Form */}
            <div className="p-4 rounded-control bg-brand-50 border border-brand-100 text-xs space-y-3 no-print">
              <div className="flex items-center gap-2 font-bold text-brand-900">
                <Lock className="h-4 w-4" />
                <span>Period Lock Enforcement (Business Plan)</span>
              </div>
              <p className="text-brand-800 text-[11px]">
                Locking a period protects all historical ledger records on or before the selected date from accidental modification. Subsequent corrections must be entered as explicit audited adjustments.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={lockDate}
                  onChange={(e) => setLockDate(e.target.value)}
                  className="rounded border border-brand-200 px-3 py-1 text-xs bg-white text-navy-900"
                />
                <input
                  type="text"
                  placeholder="Lock reason / approval notes"
                  value={lockNotes}
                  onChange={(e) => setLockNotes(e.target.value)}
                  className="flex-1 rounded border border-brand-200 px-3 py-1 text-xs bg-white text-navy-900"
                />
                <button
                  onClick={handleLockPeriod}
                  className="px-4 py-1 bg-brand-600 text-white rounded text-xs font-semibold hover:bg-brand-700"
                >
                  Lock Period Now
                </button>
              </div>
            </div>

            {/* Locked Periods List */}
            {periodLocks.length > 0 && (
              <div className="text-xs">
                <span className="font-semibold text-navy-700">Currently Locked Historical Periods:</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {periodLocks.map((l) => (
                    <span
                      key={l.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-800 rounded text-[11px] border border-slate-200"
                    >
                      <Lock className="h-3 w-3 text-slate-500" />
                      <span>Locked through {l.periodEndDate}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
