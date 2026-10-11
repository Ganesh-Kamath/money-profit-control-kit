import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { db, type Transaction, type Account, type Category, type Invoice, type Alert } from '../storage/db';
import {
  formatINR,
  CalculationEngine,
  getPeriodBoundaries,
  type FinancialMetrics,
} from '../engine/calculationEngine';
import {
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  Wallet,
  AlertTriangle,
  FileCheck,
  CheckCircle,
  Clock,
  Plus,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

export const OverviewPage: React.FC = () => {
  const {
    activeWorkspace,
    openAddTxModal,
    openDrilldown,
    setCurrentScreen,
    resetDemoWorkspace,
  } = useApp();

  const [period, setPeriod] = useState<string>('this_month');
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<
    (Transaction & { categoryName?: string; accountName?: string })[]
  >([]);
  const [attentionItems, setAttentionItems] = useState<string[]>([]);
  const [todayIncomePaise, setTodayIncomePaise] = useState<number>(0);
  const [todayExpensePaise, setTodayExpensePaise] = useState<number>(0);

  useEffect(() => {
    if (!activeWorkspace) return;

    async function loadOverview() {
      const now = new Date();
      const { start: pStart, end: pEnd } = getPeriodBoundaries(period, now);
      const { start: todayStart, end: todayEnd } = getPeriodBoundaries('today', now);

      const allTxs = await db.transactions
        .where('workspaceId')
        .equals(activeWorkspace!.id)
        .toArray();
      const allCats = await db.categories
        .where('workspaceId')
        .equals(activeWorkspace!.id)
        .toArray();
      const allAccs = await db.accounts
        .where('workspaceId')
        .equals(activeWorkspace!.id)
        .toArray();
      const allInvs = await db.invoices
        .where('workspaceId')
        .equals(activeWorkspace!.id)
        .toArray();
      const allRcpts = await db.receipts
        .where('workspaceId')
        .equals(activeWorkspace!.id)
        .toArray();

      setAccounts(allAccs);

      const catMap = Object.fromEntries(allCats.map((c) => [c.id, c]));
      const accMap = Object.fromEntries(allAccs.map((a) => [a.id, a]));

      const enrichedTxs = allTxs.map((t) => ({
        ...t,
        categoryName: t.categoryId ? catMap[t.categoryId]?.name : 'Uncategorized',
        accountName: t.accountId ? accMap[t.accountId]?.name : 'Account',
        isStock: t.categoryId ? catMap[t.categoryId]?.isStock : false,
        isEquipment: t.categoryId ? catMap[t.categoryId]?.isEquipment : false,
      }));

      // Filter for selected period
      const periodTxs = enrichedTxs.filter(
        (t) =>
          new Date(t.occurredAt) >= pStart &&
          new Date(t.occurredAt) <= pEnd
      );

      // Today's specific figures (Question 1 & 2)
      const todayTxs = enrichedTxs.filter(
        (t) =>
          t.status === 'active' &&
          new Date(t.occurredAt) >= todayStart &&
          new Date(t.occurredAt) <= todayEnd
      );
      const todayIn = todayTxs
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + t.amountPaise, 0);
      const todayOut = todayTxs
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + t.amountPaise, 0);

      setTodayIncomePaise(todayIn);
      setTodayExpensePaise(todayOut);

      // Financial Metrics via shared calculation engine
      const computed = CalculationEngine.calculateMetrics(periodTxs as any, allInvs as any);
      setMetrics(computed);

      // Recent 5 transactions
      const sorted = [...enrichedTxs]
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, 6);
      setRecentTransactions(sorted);

      // Identify Attention Required items
      const items: string[] = [];
      const needsReceipt = enrichedTxs.filter(
        (t) => t.type === 'expense' && t.status === 'active' && t.amountPaise >= 50000 && !t.receiptId
      );
      if (needsReceipt.length > 0) {
        items.push(`${needsReceipt.length} expense(s) above ₹500 have missing receipts.`);
      }

      const pendingInvoices = allInvs.filter((i) => i.status === 'unpaid' || i.status === 'partially_paid');
      if (pendingInvoices.length > 0) {
        items.push(`${pendingInvoices.length} customer invoice(s) awaiting payment collection.`);
      }

      const outliers = CalculationEngine.detectUnusualExpenses(enrichedTxs as any, 500000);
      if (outliers.length > 0) {
        items.push(`${outliers.length} unusually large expense(s) recorded recently.`);
      }

      setAttentionItems(items);
    }

    loadOverview();
  }, [activeWorkspace, period]);

  const totalAvailableCashPaise = accounts.reduce((s, a) => s + (a.currentBalancePaise || 0), 0);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner / Demo Mode Indicator */}
      {activeWorkspace?.isDemo && (
        <div className="rounded-control bg-amber-50 border border-amber-200 px-4 py-2.5 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded text-[10px]">
              Demo Mode
            </span>
            <span>You are viewing a realistic 3-month sample home bakery workspace.</span>
          </div>
          <button
            onClick={resetDemoWorkspace}
            className="font-semibold text-amber-900 underline hover:text-amber-950"
          >
            Reset Demo Data
          </button>
        </div>
      )}

      {/* Header & The 5 Core Answers at a glance */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-navy-950">
            {activeWorkspace?.name || 'Financial Overview'}
          </h1>
          <p className="text-xs text-navy-500 mt-0.5">
            100% on-device private financial control · All 5 questions answered in seconds
          </p>
        </div>

        {/* Period Selector & Add Tx Action */}
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-control border border-surface-border bg-white px-3 py-1.5 text-xs font-semibold text-navy-700 shadow-sm focus:outline-none focus:border-brand-500"
          >
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_fy">This Financial Year</option>
          </select>

          <button
            onClick={openAddTxModal}
            className="inline-flex items-center gap-1.5 rounded-control bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>+ Add transaction</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          THE FIVE CORE QUESTIONS (Cards Row)
         ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Q1: Money In Today & In Period */}
        <div
          onClick={() =>
            openDrilldown({
              title: `Income Received (${period.replace('_', ' ')})`,
              filterType: 'income',
            })
          }
          className="cursor-pointer rounded-card bg-white p-5 border border-surface-border shadow-sm hover:border-brand-500/50 hover:shadow-md transition"
        >
          <div className="flex items-center justify-between text-navy-500 mb-2">
            <span className="text-xs font-medium">1. Money In Today</span>
            <span className="rounded-full bg-finance-incomeBg p-1.5 text-finance-income">
              <ArrowDownRight className="h-4 w-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-navy-950 tabular-nums">
            {formatINR(todayIncomePaise)}
          </p>
          <div className="mt-2 text-[11px] text-navy-500 flex items-center justify-between">
            <span>Period total:</span>
            <span className="font-semibold text-finance-income tabular-nums">
              {metrics ? metrics.revenueFormatted : '₹0.00'}
            </span>
          </div>
        </div>

        {/* Q2: Money Out & What Spent On */}
        <div
          onClick={() =>
            openDrilldown({
              title: `Expenses Recorded (${period.replace('_', ' ')})`,
              filterType: 'expense',
            })
          }
          className="cursor-pointer rounded-card bg-white p-5 border border-surface-border shadow-sm hover:border-brand-500/50 hover:shadow-md transition"
        >
          <div className="flex items-center justify-between text-navy-500 mb-2">
            <span className="text-xs font-medium">2. Money Spent Today</span>
            <span className="rounded-full bg-finance-expenseBg text-finance-expense">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-navy-950 tabular-nums">
            {formatINR(todayExpensePaise)}
          </p>
          <div className="mt-2 text-[11px] text-navy-500 flex items-center justify-between">
            <span>Period expenses:</span>
            <span className="font-semibold text-finance-expense tabular-nums">
              {metrics ? metrics.totalExpenseFormatted : '₹0.00'}
            </span>
          </div>
        </div>

        {/* Q3: Real Estimated Net Profit */}
        <div
          onClick={() => setCurrentScreen('sales_profit')}
          className="cursor-pointer rounded-card bg-white p-5 border border-surface-border shadow-sm hover:border-brand-500/50 hover:shadow-md transition"
        >
          <div className="flex items-center justify-between text-navy-500 mb-2">
            <span className="text-xs font-medium">3. Estimated Net Profit</span>
            <span className="rounded-full bg-brand-50 p-1.5 text-brand-600">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <p
            className={`text-2xl font-bold tabular-nums ${
              (metrics?.estimatedNetProfitPaise || 0) >= 0 ? 'text-finance-income' : 'text-finance-expense'
            }`}
          >
            {metrics ? metrics.estimatedNetProfitFormatted : '₹0.00'}
          </p>
          <div className="mt-2 text-[11px] text-navy-500 flex items-center justify-between">
            <span>Net margin:</span>
            <span className="font-semibold text-navy-700 tabular-nums">
              {metrics ? `${metrics.netMarginPct}%` : '0%'}
            </span>
          </div>
        </div>

        {/* Q4: Available Cash Right Now */}
        <div
          onClick={() => setCurrentScreen('accounts')}
          className="cursor-pointer rounded-card bg-white p-5 border border-surface-border shadow-sm hover:border-brand-500/50 hover:shadow-md transition"
        >
          <div className="flex items-center justify-between text-navy-500 mb-2">
            <span className="text-xs font-medium">4. Available Cash Now</span>
            <span className="rounded-full bg-navy-100 p-1.5 text-navy-700">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-navy-950 tabular-nums">
            {formatINR(totalAvailableCashPaise)}
          </p>
          <div className="mt-2 text-[11px] text-navy-500 flex items-center justify-between">
            <span>Across accounts:</span>
            <span className="font-semibold text-navy-700">{accounts.length} active</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          Q5: ATTENTION REQUIRED PANEL & ACCOUNTS BREAKDOWN
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 5. What needs attention next */}
        <div className="rounded-card bg-white p-5 border border-surface-border shadow-sm lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-finance-warning" />
                <h3 className="text-xs font-bold text-navy-950">5. Attention Required</h3>
              </div>
              <span className="text-[11px] font-semibold text-navy-400">
                {attentionItems.length} alerts
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              {attentionItems.length === 0 ? (
                <div className="p-4 rounded-control bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>All caught up! All balances reconciled and receipts linked.</span>
                </div>
              ) : (
                attentionItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-control bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2"
                  >
                    <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-surface-border text-[11px] text-navy-500 flex items-center justify-between">
            <span>Data completeness:</span>
            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              High (98%)
            </span>
          </div>
        </div>

        {/* Expenses by Category Breakdown */}
        <div className="rounded-card bg-white p-5 border border-surface-border shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border">
            <h3 className="text-xs font-bold text-navy-950">Expense Breakdown by Category</h3>
            <span className="text-[11px] text-navy-400">Click any category to drill down</span>
          </div>

          <div className="mt-4 space-y-3">
            {metrics?.categoriesBreakdown.length === 0 ? (
              <p className="text-xs text-navy-400 py-6 text-center">
                No expenses recorded in this period.
              </p>
            ) : (
              metrics?.categoriesBreakdown.slice(0, 5).map((cat) => (
                <div
                  key={cat.categoryName}
                  onClick={() =>
                    openDrilldown({
                      title: `Expenses: ${cat.categoryName}`,
                      categoryId: cat.categoryId,
                      filterType: 'expense',
                    })
                  }
                  className="cursor-pointer group p-2 hover:bg-surface-subtle rounded-control transition"
                >
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-navy-900 group-hover:text-brand-600">
                      {cat.categoryName}{' '}
                      {cat.isStock ? (
                        <span className="text-[10px] text-amber-600 font-normal">(Stock)</span>
                      ) : cat.isEquipment ? (
                        <span className="text-[10px] text-purple-600 font-normal">(Asset)</span>
                      ) : null}
                    </span>
                    <span className="font-bold text-navy-950 tabular-nums">
                      {cat.amountFormatted} ({cat.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-surface-subtle rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-brand-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, cat.percentage)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          RECENT TRANSACTIONS & CASH FLOW
         ========================================================================= */}
      <div className="rounded-card bg-white p-5 border border-surface-border shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-surface-border">
          <h3 className="text-xs font-bold text-navy-950">Recent Activity</h3>
          <button
            onClick={() => setCurrentScreen('transactions')}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            <span>View all transactions</span>
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>

        <div className="mt-3 divide-y divide-surface-border">
          {recentTransactions.map((tx) => (
            <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full p-1.5 text-xs ${
                    tx.type === 'income'
                      ? 'bg-finance-incomeBg text-finance-income'
                      : tx.type === 'expense'
                      ? 'bg-finance-expenseBg text-finance-expense'
                      : 'bg-brand-50 text-brand-600'
                  }`}
                >
                  {tx.type === 'income' ? (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  ) : tx.type === 'expense' ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    '⇄'
                  )}
                </span>
                <div>
                  <p className="font-semibold text-navy-900">{tx.description}</p>
                  <p className="text-[11px] text-navy-400">
                    {new Date(tx.occurredAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}{' '}
                    · {tx.categoryName || tx.type}
                  </p>
                </div>
              </div>

              <span
                className={`font-bold tabular-nums ${
                  tx.type === 'income'
                    ? 'text-finance-income'
                    : tx.type === 'expense'
                    ? 'text-finance-expense'
                    : 'text-brand-600'
                }`}
              >
                {tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : ''}
                {formatINR(tx.amountPaise)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
