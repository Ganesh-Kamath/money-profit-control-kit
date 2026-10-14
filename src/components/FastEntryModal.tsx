import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { db, recalculateAccountBalance, type Account, type Category, type Transaction } from '../storage/db';
import { formatINR, parseINRToPaise } from '../engine/calculationEngine';
import { Zap, Check, X, ArrowRight, Undo2 } from 'lucide-react';

interface FastEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FastEntryModal: React.FC<FastEntryModalProps> = ({ isOpen, onClose }) => {
  const { activeWorkspace, showToast } = useApp();

  const [amountStr, setAmountStr] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [description, setDescription] = useState<string>('Counter Cash / UPI Sale');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (!isOpen || !activeWorkspace) return;

    async function loadData() {
      const accs = await db.accounts
        .where('workspaceId')
        .equals(activeWorkspace!.id)
        .toArray();
      setAccounts(accs);

      const cats = await db.categories
        .where('workspaceId')
        .equals(activeWorkspace!.id)
        .filter((c) => c.type === 'income')
        .toArray();
      setCategories(cats);

      // Memory: restore last-used account & category from localStorage
      const lastAcc = localStorage.getItem(`controlkit_last_account_${activeWorkspace!.id}`);
      if (lastAcc && accs.some((a) => a.id === lastAcc)) {
        setSelectedAccountId(lastAcc);
      } else if (accs.length > 0) {
        setSelectedAccountId(accs[0].id);
      }

      const lastCat = localStorage.getItem(`controlkit_last_category_${activeWorkspace!.id}`);
      if (lastCat && cats.some((c) => c.id === lastCat)) {
        setSelectedCategoryId(lastCat);
      } else if (cats.length > 0) {
        setSelectedCategoryId(cats[0].id);
      }
    }

    loadData();
  }, [isOpen, activeWorkspace]);

  if (!isOpen || !activeWorkspace) return null;

  const handleQuickAdd = (incrementRupees: number) => {
    const currentPaise = parseINRToPaise(amountStr || '0');
    const newPaise = currentPaise + incrementRupees * 100;
    setAmountStr((newPaise / 100).toString());
  };

  const handleRecordFastSale = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const amountPaise = parseINRToPaise(amountStr);
    if (amountPaise <= 0 || !selectedAccountId) return;

    const nowIso = new Date().toISOString();
    const txId = `fast-sale-${Date.now()}`;

    const newTx: Transaction = {
      id: txId,
      workspaceId: activeWorkspace.id,
      type: 'income',
      amountPaise,
      occurredAt: nowIso,
      accountId: selectedAccountId,
      categoryId: selectedCategoryId || undefined,
      description: description.trim() || 'Fast Sale',
      status: 'active',
      source: 'fast_3_tap',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Atomic transaction write
    await db.transaction('rw', db.transactions, db.accounts, async () => {
      await db.transactions.put(newTx);
      await recalculateAccountBalance(db, selectedAccountId);
    });

    // Save memory for next time
    localStorage.setItem(`controlkit_last_account_${activeWorkspace.id}`, selectedAccountId);
    if (selectedCategoryId) {
      localStorage.setItem(`controlkit_last_category_${activeWorkspace.id}`, selectedCategoryId);
    }

    onClose();

    // Show toast with immediate Undo action
    showToast({
      type: 'success',
      title: 'Sale Recorded in 3 Taps',
      message: `Recorded ${formatINR(amountPaise)} into ${accounts.find((a) => a.id === selectedAccountId)?.name || 'Account'}.`,
      undoAction: async () => {
        await db.transaction('rw', db.transactions, db.accounts, async () => {
          await db.transactions.update(txId, { status: 'voided', voidReason: 'User undo action' });
          await recalculateAccountBalance(db, selectedAccountId);
        });
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-card shadow-modal max-w-md w-full border border-surface-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-emerald-50 border-b border-emerald-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-600 text-white rounded-control">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy-950">Sale in 3 Taps</h3>
              <p className="text-[11px] text-navy-600">Fast counter sale with instant undo support</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-navy-400 hover:text-navy-700 rounded-control transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleRecordFastSale} className="p-6 space-y-4">
          {/* Tap 1: Amount */}
          <div>
            <label className="block text-xs font-semibold text-navy-800 mb-1">
              1. Sale Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-navy-400">
                ₹
              </span>
              <input
                type="text"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="w-full pl-8 pr-4 py-2 text-xl font-bold text-navy-950 bg-surface-subtle border border-surface-border rounded-control focus:border-brand-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            {/* Quick Amount Chips */}
            <div className="flex flex-wrap gap-2 mt-2">
              {[100, 250, 500, 1000, 2000].map((inc) => (
                <button
                  key={inc}
                  type="button"
                  onClick={() => handleQuickAdd(inc)}
                  className="px-2.5 py-1 text-xs font-semibold bg-surface-base hover:bg-emerald-50 hover:text-emerald-700 text-navy-700 border border-surface-border rounded-control transition"
                >
                  +₹{inc}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmountStr('')}
                className="px-2 py-1 text-xs text-navy-400 hover:text-navy-700 transition"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Tap 2: Payment Account */}
          <div>
            <label className="block text-xs font-semibold text-navy-800 mb-1">
              2. Paid Into (Account)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`p-2.5 text-left rounded-control border text-xs font-medium transition ${
                    selectedAccountId === acc.id
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold ring-1 ring-emerald-500'
                      : 'border-surface-border bg-white text-navy-700 hover:bg-surface-subtle'
                  }`}
                >
                  <div className="truncate">{acc.name}</div>
                  <div className="text-[10px] text-navy-500 uppercase">{acc.accountType}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tap 3: Category (with Memory) */}
          {categories.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-navy-800 mb-1">
                3. Category
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`px-3 py-1.5 rounded-control text-xs transition ${
                      selectedCategoryId === cat.id
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'bg-surface-subtle text-navy-700 hover:bg-surface-border'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={parseINRToPaise(amountStr) <= 0 || !selectedAccountId}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-control font-bold text-sm shadow-sm transition flex items-center justify-center gap-2"
            >
              <Check className="h-4 w-4" />
              <span>Record Sale {amountStr ? `(${formatINR(parseINRToPaise(amountStr))})` : ''}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
