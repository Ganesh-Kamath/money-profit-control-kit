import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { db, type Transaction, type Account, type Category, type Invoice } from '../storage/db';
import { formatINR, CalculationEngine, getPeriodBoundaries } from '../engine/calculationEngine';
import { Sparkles, X, HelpCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

interface QuestionAnswer {
  question: string;
  answer: string;
  supportingFigures: Array<{ label: string; value: string }>;
  isSufficient: boolean;
}

export const AssistantDrawer: React.FC = () => {
  const { isAssistantOpen, closeAssistant, activeWorkspace } = useApp();
  const [selectedQuestion, setSelectedQuestion] = useState<string>('');
  const [activeQA, setActiveQA] = useState<QuestionAnswer | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!isAssistantOpen || !activeWorkspace) return null;

  const sampleQuestions = [
    'Which category was my largest expense this month?',
    'What was my total estimated profit this month?',
    'How much money do I have available across all accounts?',
    'What customer payments or invoices are currently outstanding?',
    'How did this month compare to last month in revenue?',
    'How much did I spend on stock/raw materials vs equipment?',
  ];

  const handleRunQuery = async (queryText: string) => {
    setSelectedQuestion(queryText);
    setIsProcessing(true);

    try {
      const now = new Date();
      const { start: thisMonthStart, end: thisMonthEnd } = getPeriodBoundaries('this_month', now);
      const { start: lastMonthStart, end: lastMonthEnd } = getPeriodBoundaries('last_month', now);

      const allTxs = await db.transactions
        .where('workspaceId')
        .equals(activeWorkspace.id)
        .toArray();
      const allCats = await db.categories
        .where('workspaceId')
        .equals(activeWorkspace.id)
        .toArray();
      const allAccs = await db.accounts
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

      const thisMonthTxs = enriched.filter(
        (t) =>
          t.status === 'active' &&
          new Date(t.occurredAt) >= thisMonthStart &&
          new Date(t.occurredAt) <= thisMonthEnd
      );

      const lastMonthTxs = enriched.filter(
        (t) =>
          t.status === 'active' &&
          new Date(t.occurredAt) >= lastMonthStart &&
          new Date(t.occurredAt) <= lastMonthEnd
      );

      const thisMetrics = CalculationEngine.calculateMetrics(thisMonthTxs as any, allInvs as any);
      const lastMetrics = CalculationEngine.calculateMetrics(lastMonthTxs as any, allInvs as any);

      let qa: QuestionAnswer;

      if (queryText.includes('largest expense')) {
        const topCat = thisMetrics.categoriesBreakdown[0];
        if (topCat && topCat.amountPaise > 0) {
          qa = {
            question: queryText,
            answer: `Your largest expense category this month is "${topCat.categoryName}", totaling ${topCat.amountFormatted} (${topCat.percentage}% of your recorded expenses).`,
            supportingFigures: [
              { label: 'Category', value: topCat.categoryName },
              { label: 'Total Spent', value: topCat.amountFormatted },
              { label: 'Share of Expenses', value: `${topCat.percentage}%` },
              { label: 'Transactions Count', value: `${topCat.count} items` },
            ],
            isSufficient: true,
          };
        } else {
          qa = {
            question: queryText,
            answer: 'No expenses have been recorded for this month yet.',
            supportingFigures: [],
            isSufficient: false,
          };
        }
      } else if (queryText.includes('estimated profit')) {
        qa = {
          question: queryText,
          answer: `For this month, your business generated ${thisMetrics.revenueFormatted} in revenue and recorded ${thisMetrics.totalExpenseFormatted} in expenses, leaving an estimated net profit of ${thisMetrics.estimatedNetProfitFormatted} (Net margin: ${thisMetrics.netMarginPct}%).`,
          supportingFigures: [
            { label: 'Revenue', value: thisMetrics.revenueFormatted },
            { label: 'Total Expenses', value: thisMetrics.totalExpenseFormatted },
            { label: 'Estimated Net Profit', value: thisMetrics.estimatedNetProfitFormatted },
            { label: 'Net Margin', value: `${thisMetrics.netMarginPct}%` },
          ],
          isSufficient: true,
        };
      } else if (queryText.includes('available across all accounts')) {
        const totalPaise = allAccs.reduce((s, a) => s + (a.currentBalancePaise || 0), 0);
        const figures = allAccs.map((a) => ({
          label: a.name,
          value: formatINR(a.currentBalancePaise),
        }));
        figures.push({ label: 'Total Available Cash', value: formatINR(totalPaise) });

        qa = {
          question: queryText,
          answer: `You currently have ${formatINR(totalPaise)} available across ${allAccs.length} business accounts.`,
          supportingFigures: figures,
          isSufficient: true,
        };
      } else if (queryText.includes('outstanding')) {
        const unpaid = allInvs.filter((i) => i.status === 'unpaid' || i.status === 'partially_paid');
        const totalPending = unpaid.reduce((s, i) => s + (i.totalAmountPaise - (i.paidAmountPaise || 0)), 0);

        if (unpaid.length > 0) {
          qa = {
            question: queryText,
            answer: `You have ${unpaid.length} pending customer invoice(s) totaling ${formatINR(totalPending)} in outstanding receivables.`,
            supportingFigures: unpaid.map((u) => ({
              label: `${u.contactName} (${u.invoiceNumber})`,
              value: formatINR(u.totalAmountPaise - u.paidAmountPaise),
            })),
            isSufficient: true,
          };
        } else {
          qa = {
            question: queryText,
            answer: 'All customer invoices are fully settled. No outstanding receivables pending.',
            supportingFigures: [{ label: 'Outstanding Balance', value: '₹0.00' }],
            isSufficient: true,
          };
        }
      } else if (queryText.includes('compare to last month')) {
        const revDiff = thisMetrics.revenuePaise - lastMetrics.revenuePaise;
        const diffText = revDiff >= 0 ? `up by ${formatINR(revDiff)}` : `down by ${formatINR(Math.abs(revDiff))}`;

        qa = {
          question: queryText,
          answer: `This month revenue stands at ${thisMetrics.revenueFormatted}, which is ${diffText} compared to last month (${lastMetrics.revenueFormatted}).`,
          supportingFigures: [
            { label: 'This Month Revenue', value: thisMetrics.revenueFormatted },
            { label: 'Last Month Revenue', value: lastMetrics.revenueFormatted },
            { label: 'Net Difference', value: formatINR(revDiff) },
          ],
          isSufficient: true,
        };
      } else {
        // Stock vs Equipment
        qa = {
          question: queryText,
          answer: `This month you invested ${formatINR(thisMetrics.stockPurchasePaise)} in raw materials/stock and ${formatINR(thisMetrics.equipmentPurchasePaise)} in capital equipment assets.`,
          supportingFigures: [
            { label: 'Stock / Raw Materials', value: formatINR(thisMetrics.stockPurchasePaise) },
            { label: 'Capital Equipment', value: formatINR(thisMetrics.equipmentPurchasePaise) },
            { label: 'Ordinary Operating Spend', value: formatINR(thisMetrics.operatingExpensePaise) },
          ],
          isSufficient: true,
        };
      }

      setActiveQA(qa);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-surface-border flex flex-col animate-slideLeft">
      {/* Header */}
      <div className="p-4 border-b border-surface-border bg-surface-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-control bg-brand-500/10 p-1.5 text-brand-600">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-navy-900">Ask About My Numbers</h3>
            <p className="text-[11px] text-navy-500">100% deterministic on-device queries (No AI guesses)</p>
          </div>
        </div>
        <button
          onClick={closeAssistant}
          className="rounded-control p-1 text-navy-400 hover:bg-surface-border hover:text-navy-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Suggested Questions */}
        <div>
          <p className="text-xs font-semibold text-navy-700 mb-2">Frequently Asked Financial Questions</p>
          <div className="space-y-1.5">
            {sampleQuestions.map((q) => (
              <button
                key={q}
                onClick={() => handleRunQuery(q)}
                className={`w-full text-left p-2.5 rounded-control text-xs border transition flex items-center justify-between ${
                  selectedQuestion === q
                    ? 'border-brand-500 bg-brand-50 text-brand-900 font-semibold'
                    : 'border-surface-border bg-surface-subtle hover:bg-surface-border/50 text-navy-800'
                }`}
              >
                <span>{q}</span>
                <ArrowRight className="h-3.5 w-3.5 text-navy-400 shrink-0 ml-2" />
              </button>
            ))}
          </div>
        </div>

        {/* Answer Output */}
        {isProcessing && (
          <div className="p-6 text-center text-xs text-navy-500">
            Calculating exact figures from ledger...
          </div>
        )}

        {activeQA && !isProcessing && (
          <div className="rounded-card bg-surface-subtle border border-surface-border p-4 space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-finance-income shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-navy-900 leading-relaxed">{activeQA.answer}</p>
            </div>

            {/* Supporting Figures Table */}
            {activeQA.supportingFigures.length > 0 && (
              <div className="pt-2 border-t border-surface-border/70">
                <p className="text-[11px] font-semibold text-navy-500 uppercase tracking-wider mb-1.5">
                  Supporting Verified Numbers
                </p>
                <div className="space-y-1 bg-white p-2.5 rounded-control border border-surface-border">
                  {activeQA.supportingFigures.map((f, i) => (
                    <div key={i} className="flex justify-between items-center text-xs py-0.5">
                      <span className="text-navy-600">{f.label}:</span>
                      <span className="font-bold text-navy-950 tabular-nums">{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!activeQA.isSufficient && (
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                Note: Financial records for this period are insufficient to provide complete breakdown.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-surface-border bg-surface-subtle text-[11px] text-navy-400 text-center">
        Queries run directly against on-device IndexedDB storage with verifiable calculations.
      </div>
    </div>
  );
};
