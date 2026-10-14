import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { db, recalculateAccountBalance, type RecurringEntry, type Account, type Category, type Transaction } from '../storage/db';
import { formatINR, parseINRToPaise } from '../engine/calculationEngine';
import { Repeat, Plus, Trash2, Check, Clock, AlertCircle, X } from 'lucide-react';

interface RecurringEntriesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RecurringEntriesModal: React.FC<RecurringEntriesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeWorkspace, showToast } = useApp();

  const [recurringList, setRecurringList] = useState<RecurringEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // New recurring state
  const [title, setTitle] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [frequency, setFrequency] = useState<'monthly' | 'weekly' | 'quarterly' | 'annual'>('monthly');
  const [nextDueDate, setNextDueDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');

  const loadData = async () => {
    if (!activeWorkspace) return;
    const rList = await db.recurringEntries
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
    setRecurringList(rList);

    const accs = await db.accounts
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
    setAccounts(accs);
    if (accs.length > 0 && !accountId) setAccountId(accs[0].id);

    const cats = await db.categories
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .filter((c) => c.type === 'expense')
      .toArray();
    setCategories(cats);
    if (cats.length > 0 && !categoryId) setCategoryId(cats[0].id);
  };

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, activeWorkspace]);

  if (!isOpen || !activeWorkspace) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const paise = parseINRToPaise(amountStr);
    if (!title.trim() || paise <= 0) return;

    const newRec: RecurringEntry = {
      id: `rec-${Date.now()}`,
      workspaceId: activeWorkspace.id,
      title: title.trim(),
      type: 'expense',
      amountPaise: paise,
      frequency,
      nextDueDate,
      accountId: accountId || undefined,
      categoryId: categoryId || undefined,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    await db.recurringEntries.put(newRec);
    setTitle('');
    setAmountStr('');
    await loadData();

    showToast({
      type: 'success',
      title: 'Recurring Reminder Added',
      message: `Reminder for "${newRec.title}" scheduled.`,
    });
  };

  // 1-Tap Confirm & Post to ledger
  const handleConfirmAndPost = async (rec: RecurringEntry) => {
    if (!rec.accountId) {
      alert('Please select an account for this recurring payment first.');
      return;
    }

    const nowIso = new Date().toISOString();
    const txId = `tx-rec-${Date.now()}`;

    const newTx: Transaction = {
      id: txId,
      workspaceId: activeWorkspace.id,
      type: rec.type,
      amountPaise: rec.amountPaise,
      occurredAt: nowIso,
      accountId: rec.accountId,
      categoryId: rec.categoryId,
      description: `${rec.title} (Recurring ${rec.frequency})`,
      status: 'active',
      source: 'recurring_confirmed',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Compute next due date based on frequency
    const curDue = new Date(rec.nextDueDate);
    let nextDate = new Date(curDue);
    if (rec.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
    if (rec.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
    if (rec.frequency === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
    if (rec.frequency === 'annual') nextDate.setFullYear(nextDate.getFullYear() + 1);

    await db.transaction('rw', [db.transactions, db.accounts, db.recurringEntries], async () => {
      await db.transactions.put(newTx);
      await recalculateAccountBalance(db, rec.accountId!);
      await db.recurringEntries.update(rec.id, {
        lastConfirmedDate: nowIso.slice(0, 10),
        nextDueDate: nextDate.toISOString().slice(0, 10),
      });
    });

    await loadData();

    showToast({
      type: 'success',
      title: 'Payment Recorded',
      message: `Posted ${formatINR(rec.amountPaise)} for "${rec.title}". Next reminder on ${nextDate.toISOString().slice(0, 10)}.`,
    });
  };

  const handleDelete = async (id: string) => {
    await db.recurringEntries.delete(id);
    await loadData();
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-card shadow-modal max-w-xl w-full border border-surface-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-surface-subtle border-b border-surface-border">
          <div className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-navy-950">Recurring Bills & Reminders</h3>
          </div>
          <button onClick={onClose} className="p-1 text-navy-400 hover:text-navy-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Add Form */}
          <form onSubmit={handleCreate} className="bg-surface-subtle p-4 rounded-control border border-surface-border space-y-3">
            <div className="text-xs font-bold text-navy-900">Add Rent, Salaries, EMIs or Subscriptions</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-navy-700 mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Shop Rent, Helper Salary"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-surface-border rounded-control focus:outline-hidden focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-navy-700 mb-1">Amount (₹)</label>
                <input
                  type="text"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-surface-border rounded-control focus:outline-hidden focus:border-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-navy-700 mb-1">Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-surface-border rounded-control focus:outline-hidden"
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-navy-700 mb-1">Next Due Date</label>
                <input
                  type="date"
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-surface-border rounded-control focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-navy-700 mb-1">Pay From</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-surface-border rounded-control focus:outline-hidden"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-navy-500">Never automatically charged; requires 1-tap confirmation</span>
              <button
                type="submit"
                disabled={!title.trim() || parseINRToPaise(amountStr) <= 0}
                className="px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-control hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                Save Reminder
              </button>
            </div>
          </form>

          {/* List */}
          <div>
            <div className="text-xs font-bold text-navy-900 mb-2">Scheduled Items ({recurringList.length})</div>
            {recurringList.length === 0 ? (
              <p className="text-xs text-navy-500 py-3 text-center">No recurring payments scheduled.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-2">
                {recurringList.map((rec) => {
                  const isDue = rec.nextDueDate <= todayStr;
                  return (
                    <div
                      key={rec.id}
                      className={`flex items-center justify-between p-3 rounded-control border transition ${
                        isDue ? 'bg-amber-50/70 border-amber-300' : 'bg-surface-base border-surface-border'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-navy-950">{rec.title}</span>
                          <span className="text-xs font-bold text-rose-700">{formatINR(rec.amountPaise)}</span>
                          {isDue && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-200 text-amber-900 rounded-control">
                              DUE NOW
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-navy-500 mt-0.5">
                          {rec.frequency.toUpperCase()} • Next: {rec.nextDueDate}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleConfirmAndPost(rec)}
                          className="px-3 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-control transition flex items-center gap-1 shadow-xs"
                        >
                          <Check className="h-3 w-3" />
                          <span>Record Paid</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(rec.id)}
                          className="text-navy-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
