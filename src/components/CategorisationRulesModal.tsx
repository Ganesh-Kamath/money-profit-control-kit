import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { db, type CategorisationRule, type Category, type Transaction } from '../storage/db';
import { Sliders, Plus, Trash2, CheckCircle, X, ArrowRight } from 'lucide-react';

interface CategorisationRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CategorisationRulesModal: React.FC<CategorisationRulesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeWorkspace, showToast } = useApp();

  const [rules, setRules] = useState<CategorisationRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Add rule state
  const [pattern, setPattern] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [matchType, setMatchType] = useState<'contains' | 'starts_with' | 'exact'>('contains');

  const loadRules = async () => {
    if (!activeWorkspace) return;
    const rList = await db.categorisationRules
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
    setRules(rList);

    const cList = await db.categories
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray();
    setCategories(cList);
    if (cList.length > 0 && !categoryId) setCategoryId(cList[0].id);
  };

  useEffect(() => {
    if (isOpen) loadRules();
  }, [isOpen, activeWorkspace]);

  if (!isOpen || !activeWorkspace) return null;

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim() || !categoryId) return;

    const newRule: CategorisationRule = {
      id: `rule-${Date.now()}`,
      workspaceId: activeWorkspace.id,
      pattern: pattern.trim().toLowerCase(),
      categoryId,
      matchType,
      autoApplyOnImport: true,
      createdAt: new Date().toISOString(),
    };

    await db.categorisationRules.put(newRule);
    setPattern('');
    await loadRules();

    showToast({
      type: 'success',
      title: 'Rule Saved',
      message: `Future transactions containing "${pattern}" will be assigned automatically.`,
    });
  };

  const handleDeleteRule = async (ruleId: string) => {
    await db.categorisationRules.delete(ruleId);
    await loadRules();
  };

  const handleApplyToExisting = async () => {
    const uncatTxs = await db.transactions
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .filter((t) => !t.categoryId || t.categoryId === '')
      .toArray();

    if (uncatTxs.length === 0 || rules.length === 0) {
      showToast({ type: 'info', title: 'No Uncategorised Entries', message: 'All transactions already have categories assigned.' });
      return;
    }

    let appliedCount = 0;
    await db.transaction('rw', db.transactions, async () => {
      for (const tx of uncatTxs) {
        const desc = (tx.description || '').toLowerCase();
        for (const rule of rules) {
          let matched = false;
          if (rule.matchType === 'contains' && desc.includes(rule.pattern)) matched = true;
          if (rule.matchType === 'starts_with' && desc.startsWith(rule.pattern)) matched = true;
          if (rule.matchType === 'exact' && desc === rule.pattern) matched = true;

          if (matched) {
            await db.transactions.update(tx.id, { categoryId: rule.categoryId, updatedAt: new Date().toISOString() });
            appliedCount++;
            break;
          }
        }
      }
    });

    showToast({
      type: 'success',
      title: 'Rules Applied',
      message: `Updated ${appliedCount} past transactions.`,
    });
  };

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-card shadow-modal max-w-lg w-full border border-surface-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-surface-subtle border-b border-surface-border">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-brand-600" />
            <h3 className="text-sm font-bold text-navy-950">Auto-Categorisation Rules</h3>
          </div>
          <button onClick={onClose} className="p-1 text-navy-400 hover:text-navy-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Add Rule Form */}
          <form onSubmit={handleCreateRule} className="bg-surface-subtle p-4 rounded-control border border-surface-border space-y-3">
            <div className="text-xs font-bold text-navy-900">Add New Keyword Rule</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-navy-700 mb-1">If Description Contains</label>
                <input
                  type="text"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="e.g. Swiggy, Milk, Rent"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-surface-border rounded-control focus:outline-hidden focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-navy-700 mb-1">Assign Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-surface-border rounded-control focus:outline-hidden focus:border-brand-500"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-navy-500">100% on-device deterministic matching</span>
              <button
                type="submit"
                disabled={!pattern.trim()}
                className="px-3 py-1.5 text-xs font-bold bg-brand-600 text-white rounded-control hover:bg-brand-700 disabled:opacity-50 transition flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                <span>Save Rule</span>
              </button>
            </div>
          </form>

          {/* Existing Rules List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-navy-900">Active Rules ({rules.length})</div>
              {rules.length > 0 && (
                <button
                  type="button"
                  onClick={handleApplyToExisting}
                  className="text-xs text-brand-600 font-semibold hover:underline"
                >
                  Apply to Past Entries
                </button>
              )}
            </div>

            {rules.length === 0 ? (
              <p className="text-xs text-navy-500 py-4 text-center">No rules created yet. Add keywords to automate statement imports.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {rules.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2.5 bg-surface-base rounded-control border border-surface-border text-xs"
                  >
                    <div>
                      <span className="font-semibold text-navy-950">"{r.pattern}"</span>
                      <span className="text-navy-400 mx-2">→</span>
                      <span className="text-brand-700 font-medium">{catMap[r.categoryId] || 'Unknown'}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteRule(r.id)}
                      className="text-navy-400 hover:text-rose-600 transition p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
