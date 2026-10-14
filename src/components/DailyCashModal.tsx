import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { db, type Account, type DailyCashReconciliation } from '../storage/db';
import { formatINR } from '../engine/calculationEngine';
import { Banknote, CheckCircle, AlertTriangle, X } from 'lucide-react';

interface DailyCashModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailyCashModal: React.FC<DailyCashModalProps> = ({ isOpen, onClose }) => {
  const { activeWorkspace, showToast } = useApp();

  const [cashAccount, setCashAccount] = useState<Account | null>(null);

  // Note denominations count
  const [counts, setCounts] = useState<{ [denom: number]: number }>({
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
  });
  const [coinsRupees, setCoinsRupees] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !activeWorkspace) return;
    db.accounts
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .filter((a) => a.accountType === 'cash')
      .first()
      .then((acc) => {
        setCashAccount(acc || null);
      });
  }, [isOpen, activeWorkspace]);

  if (!isOpen || !activeWorkspace) return null;

  const totalDenominationsRupees =
    Object.entries(counts).reduce((sum, [denom, count]) => sum + Number(denom) * (count || 0), 0) +
    (parseFloat(coinsRupees) || 0);

  const countedPaise = Math.round(totalDenominationsRupees * 100);
  const expectedPaise = cashAccount?.currentBalancePaise || 0;
  const differencePaise = countedPaise - expectedPaise;

  const handleSaveReconciliation = async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const recon: DailyCashReconciliation = {
      id: `cash-recon-${todayStr}-${Date.now()}`,
      workspaceId: activeWorkspace.id,
      date: todayStr,
      countedCashPaise: countedPaise,
      expectedCashPaise: expectedPaise,
      differencePaise,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    await db.dailyCashReconciliations.put(recon);
    onClose();

    showToast({
      type: differencePaise === 0 ? 'success' : 'warning',
      title: 'Daily Cash Reconciled',
      message:
        differencePaise === 0
          ? 'Cash matches ledger balance perfectly.'
          : `Discrepancy of ${formatINR(Math.abs(differencePaise))} (${differencePaise > 0 ? 'Excess' : 'Shortage'}).`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-card shadow-modal max-w-lg w-full border border-surface-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-surface-subtle border-b border-surface-border">
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-navy-950">Daily Cash Closing Routine</h3>
          </div>
          <button onClick={onClose} className="p-1 text-navy-400 hover:text-navy-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-navy-600">
            Count the physical cash in your drawer or box at closing time. We compare it to your ledger balance.
          </p>

          {/* Denominations Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {[500, 200, 100, 50, 20, 10].map((denom) => (
              <div key={denom} className="p-2.5 bg-surface-base rounded-control border border-surface-border">
                <span className="text-xs font-bold text-navy-900">₹{denom} notes</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-navy-400">×</span>
                  <input
                    type="number"
                    min="0"
                    value={counts[denom] || ''}
                    onChange={(e) =>
                      setCounts((prev) => ({ ...prev, [denom]: parseInt(e.target.value, 10) || 0 }))
                    }
                    placeholder="0"
                    className="w-full px-2 py-1 text-xs font-semibold bg-white border border-surface-border rounded-control focus:outline-hidden"
                  />
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-navy-800 mb-1">Loose Coins (₹)</label>
            <input
              type="number"
              min="0"
              value={coinsRupees}
              onChange={(e) => setCoinsRupees(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-surface-subtle border border-surface-border rounded-control focus:outline-hidden"
            />
          </div>

          {/* Results Summary Box */}
          <div className="p-4 bg-surface-subtle rounded-control border border-surface-border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-navy-600">Total Counted Physical Cash:</span>
              <span className="font-bold text-navy-950 text-sm">{formatINR(countedPaise)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-navy-600">Expected System Balance:</span>
              <span className="font-bold text-navy-800">{formatINR(expectedPaise)}</span>
            </div>
            <div className="pt-2 border-t border-surface-border flex items-center justify-between text-xs">
              <span className="font-bold text-navy-900">Difference:</span>
              <span
                className={`font-bold text-sm ${
                  differencePaise === 0
                    ? 'text-emerald-600'
                    : differencePaise > 0
                    ? 'text-brand-600'
                    : 'text-rose-600'
                }`}
              >
                {differencePaise === 0
                  ? '₹0.00 (Matched)'
                  : `${differencePaise > 0 ? '+' : ''}${formatINR(differencePaise)} (${
                      differencePaise > 0 ? 'Surplus' : 'Shortage'
                    })`}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-navy-800 mb-1">Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. ₹50 given for tea not logged yet"
              className="w-full px-3 py-1.5 text-xs bg-white border border-surface-border rounded-control focus:outline-hidden"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-navy-600 hover:text-navy-900 font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveReconciliation}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-control transition"
            >
              Save Closing Record
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
