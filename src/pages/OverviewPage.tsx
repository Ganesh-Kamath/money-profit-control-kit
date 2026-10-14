import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { db, type Transaction, type Account, type Category, type Invoice, type Alert, type RecurringEntry } from '../storage/db';
import {
  formatINR,
  CalculationEngine,
  getPeriodBoundaries,
  type FinancialMetrics,
} from '../engine/calculationEngine';
import { getTranslation, type SupportedLanguage } from '../i18n/translations';
import { FastEntryModal } from '../components/FastEntryModal';
import { DailyCashModal } from '../components/DailyCashModal';
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
  Zap,
  Banknote,
  ShieldCheck,
  Repeat,
  Trash2,
  Globe,
  ArrowRight,
} from 'lucide-react';

export const OverviewPage: React.FC = () => {
  const {
    activeWorkspace,
    openAddTxModal,
    openDrilldown,
    setCurrentScreen,
    resetDemoWorkspace,
    showToast,
  } = useApp();

  const [lang, setLang] = useState<SupportedLanguage>('en');
  const t = getTranslation(lang);

  const [period, setPeriod] = useState<string>('this_month');
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<
    (Transaction & { categoryName?: string; accountName?: string })[]
  >([]);
  const [attentionItems, setAttentionItems] = useState<Array<{ id: string; label: string; action: () => void; severity: 'critical' | 'warning' | 'info' }>>([]);
  const [todayIncomePaise, setTodayIncomePaise] = useState<number>(0);
  const [todayExpensePaise, setTodayExpensePaise] = useState<number>(0);

  // Modals
  const [isFastSaleOpen, setIsFastSaleOpen] = useState<boolean>(false);
  const [isDailyCashOpen, setIsDailyCashOpen] = useState<boolean>(false);

  // Backup Health State
  const [daysSinceBackup, setDaysSinceBackup] = useState<number | null>(null);

  useEffect(() => {
    const savedLang = localStorage.getItem('controlkit_user_lang') as SupportedLanguage | null;
    if (savedLang) setLang(savedLang);
  }, []);

  const handleToggleLang = () => {
    const nextLang = lang === 'en' ? 'hi' : 'en';
    setLang(nextLang);
    localStorage.setItem('controlkit_user_lang', nextLang);
  };

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
      const allRecurring = await db.recurringEntries
        .where('workspaceId')
        .equals(activeWorkspace!.id)
        .toArray();

      setAccounts(allAccs);

      const catMap = Object.fromEntries(allCats.map((c) => [c.id, c]));
      const accMap = Object.fromEntries(allAccs.map((a) => [a.id, a]));

      const enrichedTxs = allTxs.map((tx) => ({
        ...tx,
        categoryName: tx.categoryId ? catMap[tx.categoryId]?.name : 'Uncategorized',
        accountName: tx.accountId ? accMap[tx.accountId]?.name : 'Account',
        isStock: tx.categoryId ? catMap[tx.categoryId]?.isStock : false,
        isEquipment: tx.categoryId ? catMap[tx.categoryId]?.isEquipment : false,
      }));

      // Filter for selected period
      const periodTxs = enrichedTxs.filter(
        (tx) =>
          new Date(tx.occurredAt) >= pStart &&
          new Date(tx.occurredAt) <= pEnd
      );

      // Today's specific figures (Question 1 & 2)
      const todayTxs = enrichedTxs.filter(
        (tx) =>
          tx.status === 'active' &&
          new Date(tx.occurredAt) >= todayStart &&
          new Date(tx.occurredAt) <= todayEnd
      );
      const todayIn = todayTxs
        .filter((tx) => tx.type === 'income')
        .reduce((s, tx) => s + tx.amountPaise, 0);
      const todayOut = todayTxs
        .filter((tx) => tx.type === 'expense')
        .reduce((s, tx) => s + tx.amountPaise, 0);

      setTodayIncomePaise(todayIn);
      setTodayExpensePaise(todayOut);

      // Financial Metrics via shared calculation engine
      const computed = CalculationEngine.calculateMetrics(periodTxs as any, allInvs as any);
      setMetrics(computed);

      // Recent 6 transactions
      const sorted = [...enrichedTxs]
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, 6);
      setRecentTransactions(sorted);

      // Backup Health Calculation
      const lastBackupStr = localStorage.getItem(`controlkit_last_backup_${activeWorkspace!.id}`);
      if (lastBackupStr) {
        const lastDate = new Date(lastBackupStr).getTime();
        const diffDays = Math.floor((now.getTime() - lastDate) / (1000 * 60 * 60 * 24));
        setDaysSinceBackup(diffDays);
      } else {
        setDaysSinceBackup(null);
      }

      // Attention Required Items (Question 5)
      const attentionList: Array<{ id: string; label: string; action: () => void; severity: 'critical' | 'warning' | 'info' }> = [];

      // 1. Overdue / Uncollected Invoices
      const overdueInvoices = allInvs.filter((i) => {
        if (i.status === 'paid' || i.status === 'cancelled') return false;
        return new Date(i.dueDate).getTime() < now.getTime();
      });
      if (overdueInvoices.length > 0) {
        const totalOverduePaise = overdueInvoices.reduce((s, i) => s + (i.totalAmountPaise - i.paidAmountPaise), 0);
        attentionList.push({
          id: 'overdue-invoices',
          label: `${overdueInvoices.length} customer invoice${overdueInvoices.length > 1 ? 's are' : ' is'} overdue (${formatINR(totalOverduePaise)} pending collection)`,
          action: () => setCurrentScreen('receivables'),
          severity: 'critical',
        });
      }

      // 2. Missing Receipts
      const expensesMissingReceipts = enrichedTxs.filter(
        (tx) => tx.type === 'expense' && tx.status === 'active' && !tx.receiptId
      );
      if (expensesMissingReceipts.length > 0) {
        attentionList.push({
          id: 'missing-receipts',
          label: `${expensesMissingReceipts.length} expense${expensesMissingReceipts.length > 1 ? 's do' : ' does'} not have bill/receipt photos attached`,
          action: () => setCurrentScreen('expenses'),
          severity: 'warning',
        });
      }

      // 3. Recurring Payments Due
      const todayIsoDate = now.toISOString().slice(0, 10);
      const dueRecurring = allRecurring.filter((r) => r.status === 'active' && r.nextDueDate <= todayIsoDate);
      if (dueRecurring.length > 0) {
        attentionList.push({
          id: 'recurring-due',
          label: `${dueRecurring.length} recurring bill / salary reminder due today`,
          action: () => setCurrentScreen('reports'),
          severity: 'warning',
        });
      }

      // 4. Unusual Expense Outliers
      const outliers = CalculationEngine.detectUnusualExpenses(enrichedTxs as any, 500000);
      if (outliers.length > 0) {
        attentionList.push({
          id: 'outlier-expenses',
          label: `${outliers.length} unusual expense outlier${outliers.length > 1 ? 's' : ''} detected exceeding typical amounts`,
          action: () => setCurrentScreen('expenses'),
          severity: 'info',
        });
      }

      // 5. Overdue Backup Warning
      if (lastBackupStr === null) {
        attentionList.push({
          id: 'backup-never',
          label: 'No backup has been taken yet. Protect your records with an encrypted backup.',
          action: () => setCurrentScreen('import_backup'),
          severity: 'critical',
        });
      } else if (daysSinceBackup !== null && daysSinceBackup > 14) {
        attentionList.push({
          id: 'backup-overdue',
          label: `Last backup was ${daysSinceBackup} days ago. Run an encrypted backup today.`,
          action: () => setCurrentScreen('import_backup'),
          severity: 'warning',
        });
      }

      setAttentionItems(attentionList);
    }

    loadOverview();
  }, [activeWorkspace, period]);

  const handleClearDemoData = async () => {
    if (!activeWorkspace?.isDemo) return;
    if (confirm('Delete all demo transactions and start with a clean workspace?')) {
      await db.transaction('rw', [db.transactions, db.accounts, db.categories, db.invoices, db.receipts, db.workspaces], async () => {
        await db.transactions.where('workspaceId').equals(activeWorkspace.id).delete();
        await db.invoices.where('workspaceId').equals(activeWorkspace.id).delete();
        await db.receipts.where('workspaceId').equals(activeWorkspace.id).delete();
        await db.workspaces.update(activeWorkspace.id, { isDemo: false, updatedAt: new Date().toISOString() });
      });

      showToast({
        type: 'success',
        title: 'Demo Data Cleared',
        message: 'Your workspace is now completely clean and ready for your real data.',
      });

      window.location.reload();
    }
  };

  if (!activeWorkspace || !metrics) return null;

  const totalCashBalancePaise = accounts.reduce((sum, a) => sum + (a.currentBalancePaise || 0), 0);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Demo Workspace Banner with 1-Tap Clear */}
      {activeWorkspace.isDemo && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-amber-500 text-white font-bold rounded text-[10px] uppercase">
              DEMO MODE
            </span>
            <span className="text-navy-950 font-medium">
              You are exploring sample bakery data. Your real business records will be 100% private.
            </span>
          </div>

          <button
            onClick={handleClearDemoData}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-control transition flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Remove Demo Data & Start Clean</span>
          </button>
        </div>
      )}

      {/* Top Header Row with Actions and Language Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-navy-950">
            {activeWorkspace.name}
          </h1>
          <p className="text-xs text-navy-500 mt-0.5">
            {t.zeroCloudProof}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Language Switcher */}
          <button
            onClick={handleToggleLang}
            className="px-3 py-2 text-xs font-semibold bg-white border border-surface-border hover:bg-surface-subtle text-navy-700 rounded-control transition flex items-center gap-1.5 shadow-xs"
          >
            <Globe className="h-3.5 w-3.5 text-brand-600" />
            <span>{lang === 'en' ? 'हिन्दी में देखें' : 'English'}</span>
          </button>

          {/* Daily Cash Counter */}
          <button
            onClick={() => setIsDailyCashOpen(true)}
            className="px-3 py-2 text-xs font-semibold bg-white border border-surface-border hover:bg-surface-subtle text-navy-700 rounded-control transition flex items-center gap-1.5 shadow-xs"
          >
            <Banknote className="h-3.5 w-3.5 text-emerald-600" />
            <span>{t.cardDailyClosing}</span>
          </button>

          {/* Fast Sale in 3 Taps */}
          <button
            onClick={() => setIsFastSaleOpen(true)}
            className="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-control transition flex items-center gap-1.5 shadow-xs"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>{t.actionQuickSale}</span>
          </button>

          {/* Standard Add Transaction */}
          <button
            onClick={openAddTxModal}
            className="px-3.5 py-2 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-control transition flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Add Entry</span>
          </button>
        </div>
      </div>

      {/* THE 5 CORE QUESTIONS GRID (Mobile-First, Fits Viewport) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Question 1: How much came in today? */}
        <div className="p-4 bg-white rounded-card border border-surface-border shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-navy-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Q1. Today Inflow</span>
            <div className="p-1 rounded-full bg-emerald-50 text-emerald-600">
              <ArrowDownRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-navy-950">{formatINR(todayIncomePaise)}</div>
          <span className="text-[11px] text-navy-500 mt-1 block">Cash & UPI customer sales today</span>
        </div>

        {/* Question 2: How much went out today? */}
        <div className="p-4 bg-white rounded-card border border-surface-border shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-navy-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Q2. Today Outflow</span>
            <div className="p-1 rounded-full bg-rose-50 text-rose-600">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-700">{formatINR(todayExpensePaise)}</div>
          <span className="text-[11px] text-navy-500 mt-1 block">Expenses, supplies & raw materials</span>
        </div>

        {/* Question 3: What is my real operating profit? */}
        <div className="p-4 bg-white rounded-card border border-surface-border shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-navy-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-700">Q3. Net Operating Profit</span>
            <div className="p-1 rounded-full bg-brand-50 text-brand-600">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700">{metrics.estimatedNetProfitFormatted}</div>
          <span className="text-[11px] text-navy-500 mt-1 block">This Month (Net Margin: {metrics.netMarginPct}%)</span>
        </div>

        {/* Question 4: How much cash do I have right now? */}
        <div className="p-4 bg-white rounded-card border border-surface-border shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-navy-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-navy-700">Q4. Available Cash</span>
            <div className="p-1 rounded-full bg-navy-50 text-navy-700">
              <Wallet className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-navy-950">{formatINR(totalCashBalancePaise)}</div>
          <span className="text-[11px] text-navy-500 mt-1 block">Total across {accounts.length} accounts & cash</span>
        </div>
      </div>

      {/* Backup Health Bar (Part C1) */}
      <div className="p-3 bg-white rounded-card border border-surface-border shadow-xs flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-3 h-3 rounded-full ${
              daysSinceBackup === null || daysSinceBackup > 14
                ? 'bg-rose-500 animate-pulse'
                : daysSinceBackup >= 7
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
          />
          <div className="font-semibold text-navy-900">
            {daysSinceBackup === null
              ? t.backupHealthNever
              : daysSinceBackup === 0
              ? 'Backup taken today'
              : `Last backup taken ${daysSinceBackup} day${daysSinceBackup > 1 ? 's' : ''} ago`}
          </div>
        </div>

        <button
          onClick={() => setCurrentScreen('import_backup')}
          className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1"
        >
          <span>{t.actionTakeBackup}</span>
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {/* QUESTION 5: WHAT NEEDS ATTENTION NEXT? */}
      <div className="bg-white rounded-card border border-surface-border shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h3 className="text-xs font-bold text-navy-950 uppercase tracking-wider">
              {t.q5Title} ({attentionItems.length})
            </h3>
          </div>
          <span className="text-[11px] text-navy-500">Every item is 1-tap from resolution</span>
        </div>

        {attentionItems.length === 0 ? (
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-control flex items-center gap-2 text-xs text-emerald-900">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold">All clean! No overdue invoices, missing receipts, or pending tasks.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {attentionItems.map((item) => (
              <div
                key={item.id}
                onClick={item.action}
                className={`p-3 rounded-control border text-xs flex items-center justify-between cursor-pointer transition ${
                  item.severity === 'critical'
                    ? 'bg-rose-50/70 border-rose-200 hover:bg-rose-100/70'
                    : item.severity === 'warning'
                    ? 'bg-amber-50/70 border-amber-200 hover:bg-amber-100/70'
                    : 'bg-brand-50/70 border-brand-200 hover:bg-brand-100/70'
                }`}
              >
                <div className="font-medium text-navy-900">{item.label}</div>
                <div className="flex items-center gap-1 font-bold text-brand-700 shrink-0 ml-3">
                  <span>Fix</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Transactions & Accounts List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Transactions */}
        <div className="lg:col-span-2 bg-white rounded-card border border-surface-border shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
            <h3 className="text-xs font-bold text-navy-950">Recent Activity</h3>
            <button
              onClick={() => setCurrentScreen('transactions')}
              className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1"
            >
              <span>{t.viewAll}</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="divide-y divide-surface-border">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="p-3.5 flex items-center justify-between hover:bg-surface-subtle text-xs transition">
                <div>
                  <div className="font-semibold text-navy-950">{tx.description}</div>
                  <div className="text-[11px] text-navy-500 mt-0.5">
                    {tx.occurredAt.slice(0, 10)} • {tx.accountName} • {tx.categoryName}
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`font-bold ${
                      tx.type === 'income'
                        ? 'text-emerald-700'
                        : tx.type === 'transfer'
                        ? 'text-navy-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '⇄ ' : '-'}{formatINR(tx.amountPaise)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Account Balances */}
        <div className="bg-white rounded-card border border-surface-border shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-navy-950">{t.navAccounts}</h3>
            <button
              onClick={() => setCurrentScreen('accounts')}
              className="text-xs font-semibold text-brand-600 hover:underline"
            >
              Manage
            </button>
          </div>

          <div className="space-y-2.5">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                onClick={() => openDrilldown({ title: `${acc.name} History`, accountId: acc.id })}
                className="p-3 bg-surface-subtle hover:bg-surface-base border border-surface-border rounded-control cursor-pointer transition text-xs flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-navy-900">{acc.name}</div>
                  <div className="text-[10px] text-navy-500 uppercase">{acc.accountType}</div>
                </div>
                <div className="font-bold text-navy-950">{formatINR(acc.currentBalancePaise)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fast Entry Modal */}
      <FastEntryModal isOpen={isFastSaleOpen} onClose={() => setIsFastSaleOpen(false)} />

      {/* Daily Cash Closing Modal */}
      <DailyCashModal isOpen={isDailyCashOpen} onClose={() => setIsDailyCashOpen(false)} />
    </div>
  );
};
