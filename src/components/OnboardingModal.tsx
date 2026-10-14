import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { db, recalculateAccountBalance, type Account, type Category, type Workspace, type BusinessProfile } from '../storage/db';
import { parseINRToPaise } from '../engine/calculationEngine';
import { isValidGSTIN, getStateFromGSTIN } from '../engine/gstEngine';
import { seedDemoWorkspace } from '../engine/seedDemo';
import { Sparkles, Check, ArrowRight, ShieldCheck, Building2, Wallet } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const { refreshWorkspaces, setActiveWorkspaceId, showToast } = useApp();

  const [step, setStep] = useState<1 | 2>(1);
  const [businessName, setBusinessName] = useState<string>('');
  const [businessType, setBusinessType] = useState<string>('home_bakery');
  const [cashBalanceStr, setCashBalanceStr] = useState<string>('5000');
  const [bankBalanceStr, setBankBalanceStr] = useState<string>('25000');
  const [gstinInput, setGstinInput] = useState<string>('');

  if (!isOpen) return null;

  const handleStartFresh = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) return;

    const workspaceId = `ws-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const newWs: Workspace = {
      id: workspaceId,
      name: businessName.trim(),
      businessType,
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      fyStartMonth: 4,
      isDemo: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const cashPaise = parseINRToPaise(cashBalanceStr || '0');
    const bankPaise = parseINRToPaise(bankBalanceStr || '0');

    const accounts: Account[] = [
      {
        id: `acc-cash-${Date.now()}`,
        workspaceId,
        name: 'Cash Box / Register',
        accountType: 'cash',
        openingBalancePaise: cashPaise,
        openingBalanceDate: nowIso.slice(0, 10),
        currentBalancePaise: cashPaise,
        isDefault: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: `acc-bank-${Date.now()}`,
        workspaceId,
        name: 'Primary Bank Account',
        accountType: 'bank',
        openingBalancePaise: bankPaise,
        openingBalanceDate: nowIso.slice(0, 10),
        currentBalancePaise: bankPaise,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    // Standard business categories
    const categories: Category[] = [
      { id: `cat-inc-sales-${Date.now()}`, workspaceId, name: 'Product / Service Sales', type: 'income', isDefault: true, createdAt: nowIso },
      { id: `cat-exp-stock-${Date.now()}`, workspaceId, name: 'Stock & Raw Materials', type: 'expense', isStock: true, isDefault: true, createdAt: nowIso },
      { id: `cat-exp-rent-${Date.now()}`, workspaceId, name: 'Rent & Premises', type: 'expense', isDefault: true, createdAt: nowIso },
      { id: `cat-exp-util-${Date.now()}`, workspaceId, name: 'Electricity & Utilities', type: 'expense', isDefault: true, createdAt: nowIso },
      { id: `cat-exp-pkg-${Date.now()}`, workspaceId, name: 'Packaging & Supplies', type: 'expense', isDefault: true, createdAt: nowIso },
      { id: `cat-exp-wages-${Date.now()}`, workspaceId, name: 'Helper & Staff Wages', type: 'expense', isDefault: true, createdAt: nowIso },
    ];

    // Save profile with state and GSTIN if provided
    const validGstin = isValidGSTIN(gstinInput) ? gstinInput.trim().toUpperCase() : undefined;
    const derivedState = validGstin ? getStateFromGSTIN(validGstin) : 'Maharashtra';

    const profile: BusinessProfile = {
      id: workspaceId,
      workspaceId,
      legalName: businessName.trim(),
      gstin: validGstin,
      address: '',
      state: derivedState || 'Maharashtra',
      invoicePrefix: 'INV',
      nextInvoiceNumber: 1,
      updatedAt: nowIso,
    };

    await db.transaction('rw', [db.workspaces, db.accounts, db.categories, db.businessProfiles], async () => {
      await db.workspaces.put(newWs);
      await db.accounts.bulkPut(accounts);
      await db.categories.bulkPut(categories);
      await db.businessProfiles.put(profile);
    });

    await refreshWorkspaces();
    setActiveWorkspaceId(workspaceId);
    onClose();

    showToast({
      type: 'success',
      title: 'Workspace Initialized',
      message: `Welcome to ${businessName}! Ready for your first entry.`,
    });
  };

  const handleExploreDemo = async () => {
    const demoId = await seedDemoWorkspace();
    await refreshWorkspaces();
    setActiveWorkspaceId(demoId);
    onClose();

    showToast({
      type: 'info',
      title: 'Demo Workspace Loaded',
      message: 'Explore Sweet Crumb Patisserie demo data. You can clear it anytime with 1 tap.',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-card shadow-modal max-w-lg w-full border border-surface-border overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-brand-900 text-white text-center relative">
          <div className="w-12 h-12 bg-brand-700/60 rounded-full flex items-center justify-center mx-auto mb-2 text-brand-300">
            <Building2 className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold">Welcome to ControlKit</h2>
          <p className="text-xs text-brand-200 mt-1 max-w-sm mx-auto">
            100% on-device financial control. Zero cloud, zero subscription, your financial data never leaves this screen.
          </p>
        </div>

        {/* Content */}
        {step === 1 ? (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-navy-800 mb-1">
                Business or Trade Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Sweet Crumb Studio, Patel Stores, Rao Academy"
                className="w-full px-3 py-2 text-sm bg-surface-subtle border border-surface-border rounded-control focus:border-brand-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-800 mb-1">
                Type of Business
              </label>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-surface-subtle border border-surface-border rounded-control focus:border-brand-500 focus:bg-white focus:outline-hidden"
              >
                <option value="home_bakery">Home Baker / Cloud Kitchen / Food</option>
                <option value="tutor">School Tutor / Coaching Classes</option>
                <option value="retail">Kirana / Retail / Convenience Store</option>
                <option value="freelance">Freelance Designer / Consultant</option>
                <option value="service">Salon / Repair Shop / Service Provider</option>
                <option value="other">Other Small Business</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-navy-800 mb-1">
                  Cash on Hand (₹)
                </label>
                <input
                  type="text"
                  value={cashBalanceStr}
                  onChange={(e) => setCashBalanceStr(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-surface-subtle border border-surface-border rounded-control focus:border-brand-500 focus:bg-white focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-navy-800 mb-1">
                  Bank Balance (₹)
                </label>
                <input
                  type="text"
                  value={bankBalanceStr}
                  onChange={(e) => setBankBalanceStr(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-surface-subtle border border-surface-border rounded-control focus:border-brand-500 focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-800 mb-1">
                GSTIN (Optional)
              </label>
              <input
                type="text"
                value={gstinInput}
                onChange={(e) => setGstinInput(e.target.value)}
                placeholder="15-character GSTIN (e.g. 27AAPFU0939F1ZV)"
                className="w-full px-3 py-2 text-sm bg-surface-subtle border border-surface-border rounded-control focus:border-brand-500 focus:bg-white focus:outline-hidden uppercase"
              />
              {gstinInput && !isValidGSTIN(gstinInput) && (
                <p className="text-[11px] text-amber-600 mt-1">Please enter a valid 15-character GSTIN format.</p>
              )}
            </div>

            <div className="pt-4 flex items-center justify-between gap-3 border-t border-surface-border">
              <button
                type="button"
                onClick={handleExploreDemo}
                className="px-4 py-2 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-control transition flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 text-brand-600" />
                <span>Explore Demo Data</span>
              </button>

              <button
                type="button"
                disabled={!businessName.trim()}
                onClick={handleStartFresh}
                className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-control shadow-sm transition flex items-center gap-1.5"
              >
                <span>Start Fresh</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
