import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { db, type Transaction, type Category, type Invoice } from '../storage/db';
import {
  formatINR,
  CalculationEngine,
  getPeriodBoundaries,
  parseINRToPaise,
  type FinancialMetrics,
} from '../engine/calculationEngine';
import {
  TrendingUp,
  TrendingDown,
  Info,
  DollarSign,
  PieChart,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';

export const SalesProfitPage: React.FC = () => {
  const { activeWorkspace, openDrilldown } = useApp();

  const [period, setPeriod] = useState<string>('this_month');
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [prevMetrics, setPrevMetrics] = useState<FinancialMetrics | null>(null);
  const [manualCogsInput, setManualCogsInput] = useState<string>('0');
  const [showHowCalculated, setShowHowCalculated] = useState<boolean>(false);

  useEffect(() => {
    if (!activeWorkspace) return;

    async function loadMetrics() {
      const now = new Date();
      const { start: curStart, end: curEnd } = getPeriodBoundaries(period, now);

      // Equivalent prior period
      let prevPeriodKey = 'last_month';
      if (period === 'this_week') prevPeriodKey = 'last_week';
      if (period === 'today') prevPeriodKey = 'yesterday';
      const { start: prevStart, end: prevEnd } = getPeriodBoundaries(prevPeriodKey, now);

      const allTxs = await db.transactions
        .where('workspaceId')
        .equals(activeWorkspace!.id)
        .toArray();
      const allCats = await db.categories
        .where('workspaceId')
        .equals(activeWorkspace!.id)
        .toArray();
      const allInvs = await db.invoices
        .where('workspaceId')
        .equals(activeWorkspace!.id)
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

      const cogsPaise = parseINRToPaise(manualCogsInput);
      const computedCur = CalculationEngine.calculateMetrics(curTxs as any, allInvs as any, cogsPaise);
      const computedPrev = CalculationEngine.calculateMetrics(priorTxs as any, allInvs as any, 0);

      setMetrics(computedCur);
      setPrevMetrics(computedPrev);
    }

    loadMetrics();
  }, [activeWorkspace, period, manualCogsInput]);

  if (!activeWorkspace || !metrics) return null;

  const revDiffPaise = metrics.revenuePaise - (prevMetrics?.revenuePaise || 0);
  const profitDiffPaise = metrics.estimatedNetProfitPaise - (prevMetrics?.estimatedNetProfitPaise || 0);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-navy-950">Sales & Profit Analysis</h1>
          <p className="text-xs text-navy-500 mt-0.5">
            Transparent deterministic margins · Click any number to drill down to source entries
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-control border border-surface-border bg-white px-3 py-1.5 text-xs font-semibold text-navy-700 shadow-sm focus:outline-none focus:border-brand-500"
          >
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_fy">This Financial Year (Apr 1 - Mar 31)</option>
          </select>

          <button
            onClick={() => setShowHowCalculated(!showHowCalculated)}
            className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-semibold bg-brand-50 px-3 py-1.5 rounded-control"
          >
            <Info className="h-4 w-4" />
            <span>How this is calculated</span>
          </button>
        </div>
      </div>

      {/* Explanatory "How this is calculated" Panel */}
      {showHowCalculated && (
        <div className="rounded-card bg-brand-50/70 border border-brand-200 p-5 text-xs text-brand-950 space-y-2.5 animate-fadeIn">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm text-brand-900">Plain Language Calculation Rules</h3>
            <button
              onClick={() => setShowHowCalculated(false)}
              className="text-brand-700 hover:text-brand-950"
            >
              Close
            </button>
          </div>
          <p>
            <strong>Estimated Net Profit = Recognised Income − Recognised Expenses.</strong> This calculation assumes all relevant business costs (materials, rent, utilities) have been entered into the ledger.
          </p>
          <p>
            <strong>Transfers are NEVER profit or revenue:</strong> Moving money from your Cash Drawer to your Current Bank Account increases one account and reduces the other by the exact same amount.
          </p>
          <p>
            <strong>Cash Inflows ≠ Revenue:</strong> Collecting payment on a past credit invoice increases your bank balance, but does not count as new sales revenue if already recognized earlier.
          </p>
          <p>
            <strong>Gross Profit = Revenue − Cost of Goods Sold (COGS).</strong> You can enter a manual COGS value below to inspect direct margins.
          </p>
        </div>
      )}

      {/* Primary Metrics Grid (All Clickable Drill-downs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue */}
        <div
          onClick={() =>
            openDrilldown({
              title: `Revenue Breakdown (${period.replace('_', ' ')})`,
              filterType: 'income',
            })
          }
          className="cursor-pointer rounded-card bg-white p-5 border border-surface-border shadow-sm hover:border-brand-500/50 hover:shadow-md transition"
        >
          <span className="text-xs font-medium text-navy-500">Net Sales Revenue</span>
          <p className="text-2xl font-bold text-navy-950 tabular-nums mt-1">{metrics.revenueFormatted}</p>
          <div className="mt-2 text-[11px] flex items-center justify-between">
            <span className="text-navy-400">vs prior period:</span>
            <span
              className={`font-semibold tabular-nums ${
                revDiffPaise >= 0 ? 'text-finance-income' : 'text-finance-expense'
              }`}
            >
              {revDiffPaise >= 0 ? '+' : ''}
              {formatINR(revDiffPaise)}
            </span>
          </div>
        </div>

        {/* Expenses */}
        <div
          onClick={() =>
            openDrilldown({
              title: `Total Recorded Expenses (${period.replace('_', ' ')})`,
              filterType: 'expense',
            })
          }
          className="cursor-pointer rounded-card bg-white p-5 border border-surface-border shadow-sm hover:border-brand-500/50 hover:shadow-md transition"
        >
          <span className="text-xs font-medium text-navy-500">Total Recorded Expenses</span>
          <p className="text-2xl font-bold text-finance-expense tabular-nums mt-1">
            {metrics.totalExpenseFormatted}
          </p>
          <div className="mt-2 text-[11px] text-navy-400 flex justify-between">
            <span>Operating spend:</span>
            <span className="font-semibold text-navy-700 tabular-nums">
              {formatINR(metrics.operatingExpensePaise)}
            </span>
          </div>
        </div>

        {/* Estimated Net Profit */}
        <div
          onClick={() =>
            openDrilldown({
              title: `All Transactions in Period (${period.replace('_', ' ')})`,
              filterType: 'all',
            })
          }
          className="cursor-pointer rounded-card bg-white p-5 border border-surface-border shadow-sm hover:border-brand-500/50 hover:shadow-md transition"
        >
          <span className="text-xs font-medium text-navy-500">Estimated Net Profit</span>
          <p
            className={`text-2xl font-bold tabular-nums mt-1 ${
              metrics.estimatedNetProfitPaise >= 0 ? 'text-finance-income' : 'text-finance-expense'
            }`}
          >
            {metrics.estimatedNetProfitFormatted}
          </p>
          <div className="mt-2 text-[11px] flex items-center justify-between">
            <span className="text-navy-400">Net margin:</span>
            <span className="font-semibold text-navy-800 tabular-nums">{metrics.netMarginPct}%</span>
          </div>
        </div>

        {/* Gross Profit with Manual COGS */}
        <div className="rounded-card bg-white p-5 border border-surface-border shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-navy-500">Gross Profit (after COGS)</span>
            <span className="text-[10px] text-navy-400">Manual COGS</span>
          </div>
          <p className="text-2xl font-bold text-navy-950 tabular-nums mt-1">
            {metrics.grossProfitFormatted}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs">
            <span className="text-[11px] text-navy-400">COGS (₹):</span>
            <input
              type="text"
              value={manualCogsInput}
              onChange={(e) => setManualCogsInput(e.target.value)}
              className="w-20 px-2 py-0.5 rounded border border-surface-border text-right text-xs font-semibold"
            />
          </div>
        </div>
      </div>

      {/* Asset Allocation Breakdown (Stock vs Equipment vs Operations) */}
      <div className="rounded-card bg-white p-5 border border-surface-border shadow-sm">
        <h3 className="text-xs font-bold text-navy-950 mb-3">Cost Composition & Classification</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-control bg-amber-50 border border-amber-200">
            <p className="font-semibold text-amber-900">Raw Materials / Stock Purchases</p>
            <p className="text-lg font-bold text-amber-950 mt-1 tabular-nums">
              {formatINR(metrics.stockPurchasePaise)}
            </p>
            <p className="text-[11px] text-amber-700 mt-0.5">Inventory inward (Amul butter, flour, sugar)</p>
          </div>

          <div className="p-3 rounded-control bg-purple-50 border border-purple-200">
            <p className="font-semibold text-purple-900">Capital Equipment Assets</p>
            <p className="text-lg font-bold text-purple-950 mt-1 tabular-nums">
              {formatINR(metrics.equipmentPurchasePaise)}
            </p>
            <p className="text-[11px] text-purple-700 mt-0.5">Ovens, mixers, machinery (not consumed spend)</p>
          </div>

          <div className="p-3 rounded-control bg-slate-50 border border-slate-200">
            <p className="font-semibold text-slate-900">Operating Overhead Expenses</p>
            <p className="text-lg font-bold text-slate-950 mt-1 tabular-nums">
              {formatINR(metrics.operatingExpensePaise)}
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">Rent, electricity, packaging, marketing</p>
          </div>
        </div>
      </div>

      {/* Expense Categories Ranking */}
      <div className="rounded-card bg-white p-5 border border-surface-border shadow-sm">
        <h3 className="text-xs font-bold text-navy-950 mb-3">Top Expense Drivers in Period</h3>
        <div className="space-y-3">
          {metrics.categoriesBreakdown.map((cat, idx) => (
            <div
              key={cat.categoryName}
              onClick={() =>
                openDrilldown({
                  title: `Expenses: ${cat.categoryName}`,
                  categoryId: cat.categoryId,
                  filterType: 'expense',
                })
              }
              className="cursor-pointer group p-2 hover:bg-surface-subtle rounded-control transition flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="w-5 text-center font-bold text-navy-400">{idx + 1}</span>
                <span className="font-semibold text-navy-900 group-hover:text-brand-600">
                  {cat.categoryName}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-navy-400">{cat.count} transactions</span>
                <span className="font-bold text-navy-950 tabular-nums">
                  {cat.amountFormatted} ({cat.percentage}%)
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-navy-400 group-hover:text-brand-600" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
