import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { db, type Category, type Account } from '../storage/db';
import {
  ShieldCheck,
  Key,
  Lock,
  Database,
  Building,
  Tag,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Plus,
  RefreshCw,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { HelpModal } from '../components/HelpModal';
import { PrivacyCenterModal } from '../components/PrivacyCenterModal';
import { GuidedTourModal } from '../components/GuidedTourModal';

export const SettingsPage: React.FC = () => {
  const {
    activeWorkspace,
    workspaces,
    createWorkspace,
    setActiveWorkspaceId,
    refreshWorkspaces,
    license,
    activateLicense,
    isBusinessPlan,
    security,
    setAppPin,
    removeAppPin,
    isStoragePersisted,
    storageUsageMb,
    requestStoragePersistence,
    showToast,
    resetDemoWorkspace,
  } = useApp();

  // License input state
  const [licenseKeyInput, setLicenseKeyInput] = useState<string>('');

  // Pin setup state
  const [newPin, setNewPin] = useState<string>('');
  const [autoLockMins, setAutoLockMins] = useState<number>(15);

  // New Workspace state
  const [newWsName, setNewWsName] = useState<string>('');
  const [newWsType, setNewWsType] = useState<string>('home_bakery');
  const [isCreatingWs, setIsCreatingWs] = useState<boolean>(false);

  // Categories editor
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense');
  const [newCatIsStock, setNewCatIsStock] = useState<boolean>(false);
  const [newCatIsEquipment, setNewCatIsEquipment] = useState<boolean>(false);
  // Interactive Modals
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isPrivacyCenterOpen, setIsPrivacyCenterOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);

  React.useEffect(() => {
    if (!activeWorkspace) return;
    db.categories
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray()
      .then(setCategories);
  }, [activeWorkspace]);

  if (!activeWorkspace) return null;

  const handleApplyLicense = async () => {
    if (!licenseKeyInput.trim()) return;
    const res = await activateLicense(licenseKeyInput.trim());
    if (res.success) {
      showToast({ type: 'success', title: 'License Activated', message: 'Offline Ed25519 license verified successfully.' });
      setLicenseKeyInput('');
    } else {
      alert(`License activation error: ${res.error}`);
    }
  };

  const handleCreateNewWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    try {
      const id = await createWorkspace(newWsName.trim(), newWsType);
      showToast({ type: 'success', title: 'Workspace Created', message: `Workspace "${newWsName}" is now active.` });
      setNewWsName('');
      setIsCreatingWs(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    await db.categories.put({
      id: `cat-${Date.now()}`,
      workspaceId: activeWorkspace.id,
      name: newCatName.trim(),
      type: newCatType,
      isStock: newCatIsStock,
      isEquipment: newCatIsEquipment,
      createdAt: new Date().toISOString(),
    });

    setNewCatName('');
    setNewCatIsStock(false);
    setNewCatIsEquipment(false);
    const updated = await db.categories.where('workspaceId').equals(activeWorkspace.id).toArray();
    setCategories(updated);
    showToast({ type: 'success', title: 'Category Created', message: 'Category added to ledger.' });
  };

  const handleWipeAllData = async () => {
    const confirm1 = confirm('WARNING: Are you sure you want to completely erase ALL financial records from this device?');
    if (!confirm1) return;
    const confirm2 = prompt('To confirm permanent deletion, type "DELETE" below:');
    if (confirm2 !== 'DELETE') return;

    await db.delete();
    alert('All on-device records erased. The page will now reload.');
    window.location.reload();
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-navy-950">Settings & Privacy Centre</h1>
        <p className="text-xs text-navy-500 mt-0.5">
          100% On-device configuration · Zero external data sharing
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: License & App Lock */}
        <div className="space-y-6 lg:col-span-1">
          {/* License Status Card */}
          <div className="rounded-card bg-white p-5 border border-surface-border shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-brand-600" />
              <h2 className="text-sm font-bold text-navy-900">Offline License Details</h2>
            </div>

            {license ? (
              <div className="p-3 bg-brand-50 border border-brand-100 rounded-control space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-brand-900 font-semibold">Active Plan:</span>
                  <span className="font-bold uppercase tracking-wider text-brand-700 bg-brand-100 px-2 py-0.5 rounded">
                    {license.plan}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-navy-600">Licensee:</span>
                  <span className="font-semibold text-navy-900">{license.licenseeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-navy-600">Free Updates Until:</span>
                  <span className="font-semibold text-navy-900">
                    {license.updatesUntil.slice(0, 10)}
                  </span>
                </div>
                <p className="text-[11px] text-navy-500 pt-1 border-t border-brand-200">
                  Perpetual lifetime license. Your app never locks you out when updates expire.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-control text-xs text-amber-900">
                <p className="font-semibold">Unregistered Demo Mode</p>
                <p className="text-[11px] mt-0.5">
                  Enter your purchased license key to unlock your licensed plan.
                </p>
              </div>
            )}

            {/* License Key Input */}
            <div className="space-y-2 pt-2 border-t border-surface-border text-xs">
              <label className="block font-semibold text-navy-700">Enter or Update License Key</label>
              <input
                type="text"
                placeholder="CK-eyJwbGFu... (Paste signed key)"
                value={licenseKeyInput}
                onChange={(e) => setLicenseKeyInput(e.target.value)}
                className="w-full rounded-control border border-surface-borderStrong px-3 py-2 text-xs font-mono text-navy-900 focus:outline-none"
              />
              <button
                onClick={handleApplyLicense}
                className="w-full py-2 bg-brand-600 text-white rounded-control text-xs font-semibold hover:bg-brand-700"
              >
                Verify & Activate Offline Key
              </button>
            </div>
          </div>

          {/* App Lock & PIN Security Card */}
          <div className="rounded-card bg-white p-5 border border-surface-border shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-navy-700" />
              <h2 className="text-sm font-bold text-navy-900">App Lock (Passcode / PIN)</h2>
            </div>
            <p className="text-xs text-navy-600 leading-relaxed">
              Require a 4-6 digit PIN to open the financial control kit on this device.
            </p>

            {security?.pinHash ? (
              <div className="space-y-3 text-xs">
                <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span>PIN Lock is currently active.</span>
                </div>
                <button
                  onClick={removeAppPin}
                  className="w-full py-2 border border-surface-border text-finance-expense rounded-control text-xs font-semibold hover:bg-surface-subtle"
                >
                  Disable PIN Lock
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-navy-700 mb-1">Set New Passcode</label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="4-6 digit numeric PIN"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    className="w-full rounded-control border border-surface-border px-3 py-2 text-xs text-navy-900 focus:outline-none text-center font-bold tracking-widest"
                  />
                </div>
                <button
                  onClick={() => {
                    if (newPin.length >= 4) {
                      setAppPin(newPin, autoLockMins);
                      setNewPin('');
                      showToast({ type: 'success', title: 'PIN Set', message: 'App lock configured.' });
                    }
                  }}
                  disabled={newPin.length < 4}
                  className="w-full py-2 bg-navy-800 text-white rounded-control text-xs font-semibold hover:bg-navy-900 disabled:opacity-50"
                >
                  Enable Passcode Lock
                </button>
              </div>
            )}
          </div>

          {/* Device Storage & Persistence Card */}
          <div className="rounded-card bg-white p-5 border border-surface-border shadow-sm space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-brand-600" />
              <h2 className="text-sm font-bold text-navy-900">Storage & Persistence</h2>
            </div>
            <div className="p-2.5 bg-surface-subtle rounded space-y-1">
              <div className="flex justify-between">
                <span className="text-navy-600">Storage Persistence:</span>
                <span className={`font-semibold ${isStoragePersisted ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {isStoragePersisted ? 'Guaranteed Persistent' : 'Best-Effort'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-600">On-Device Storage Usage:</span>
                <span className="font-semibold text-navy-900">{storageUsageMb} MB</span>
              </div>
            </div>

            {!isStoragePersisted && (
              <button
                onClick={requestStoragePersistence}
                className="w-full py-2 bg-surface-subtle hover:bg-surface-border text-navy-800 rounded font-semibold text-xs border border-surface-border"
              >
                Request Storage Persistence
              </button>
            )}

            <p className="text-[11px] text-navy-400">
              On iOS Safari, install the app via "Add to Home Screen" to prevent browser data eviction.
            </p>
          </div>
        </div>

        {/* Right Column: Workspaces, Categories, Privacy Centre */}
        <div className="space-y-6 lg:col-span-2">
          {/* Workspace Switcher & Multi-Business Card */}
          <div className="rounded-card bg-white p-5 border border-surface-border shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-brand-600" />
                <h2 className="text-sm font-bold text-navy-900">Business Workspaces</h2>
              </div>
              <button
                onClick={() => setIsCreatingWs(!isCreatingWs)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Workspace</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {workspaces.map((ws) => (
                <div
                  key={ws.id}
                  onClick={() => setActiveWorkspaceId(ws.id)}
                  className={`cursor-pointer p-3 rounded-control border transition flex justify-between items-center ${
                    ws.id === activeWorkspace.id
                      ? 'border-brand-500 bg-brand-50/50 shadow-sm'
                      : 'border-surface-border hover:bg-surface-subtle'
                  }`}
                >
                  <div>
                    <p className="font-bold text-navy-950">{ws.name}</p>
                    <p className="text-[11px] text-navy-400 capitalize">{ws.businessType.replace('_', ' ')}</p>
                  </div>
                  {ws.id === activeWorkspace.id && (
                    <span className="text-[10px] font-bold text-brand-700 bg-brand-100 px-2 py-0.5 rounded">
                      ACTIVE
                    </span>
                  )}
                </div>
              ))}
            </div>

            {isCreatingWs && (
              <form onSubmit={handleCreateNewWorkspace} className="pt-3 border-t border-surface-border flex gap-2 text-xs">
                <input
                  type="text"
                  required
                  placeholder="New Business Name (e.g. Maya Handicrafts)"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  className="flex-1 rounded border border-surface-border px-3 py-1.5 text-xs text-navy-900"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-brand-600 text-white rounded font-semibold text-xs hover:bg-brand-700"
                >
                  Create
                </button>
              </form>
            )}
          </div>

          {/* Categories Management */}
          <div className="rounded-card bg-white p-5 border border-surface-border shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-navy-700" />
              <h2 className="text-sm font-bold text-navy-900">Custom Ledger Categories</h2>
            </div>

            {/* Category creator */}
            <form onSubmit={handleAddCategory} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
              <input
                type="text"
                required
                placeholder="Category name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="sm:col-span-2 rounded border border-surface-border px-3 py-1.5 text-navy-900"
              />
              <select
                value={newCatType}
                onChange={(e) => setNewCatType(e.target.value as any)}
                className="rounded border border-surface-border px-2 py-1.5 text-navy-900 bg-white"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
              <button
                type="submit"
                className="px-3 py-1.5 bg-navy-800 text-white rounded font-semibold hover:bg-navy-900"
              >
                Add Category
              </button>
            </form>

            <div className="flex flex-wrap gap-2 pt-2">
              {categories.map((c) => (
                <span
                  key={c.id}
                  className={`px-2.5 py-1 rounded text-xs border ${
                    c.type === 'income'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-surface-subtle text-navy-800 border-surface-border'
                  }`}
                >
                  {c.name} {c.isStock ? '(Stock)' : c.isEquipment ? '(Asset)' : ''}
                </span>
              ))}
            </div>
          </div>

          {/* Privacy Centre Guarantee */}
          <div className="rounded-card bg-emerald-50/50 border border-emerald-200 p-5 space-y-4 text-xs text-emerald-950">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-700" />
                <h2 className="text-sm font-bold text-emerald-900">Privacy Centre Guarantee</h2>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                100% On-Device
              </span>
            </div>
            <p className="leading-relaxed">
              <strong>Your financial data never leaves your device:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1 text-[11px] text-emerald-900">
              <li>No database server, no cloud accounts, and no backend synchronization.</li>
              <li>Zero telemetry, zero tracking cookies, zero analytics.</li>
              <li>Network requests with user financial data: <strong>EXACTLY ZERO.</strong></li>
              <li>All records reside in your browser's encrypted on-device IndexedDB storage.</li>
            </ul>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-emerald-200/60">
              <button
                type="button"
                onClick={() => setIsPrivacyCenterOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-emerald-700 text-white font-semibold text-xs hover:bg-emerald-800 transition shadow-sm"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Live Privacy Inspector
              </button>
              <button
                type="button"
                onClick={() => setIsHelpOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-white border border-emerald-300 text-emerald-900 font-semibold text-xs hover:bg-emerald-50 transition shadow-sm"
              >
                <HelpCircle className="h-3.5 w-3.5 text-emerald-700" />
                Help & FAQ (EN / हिन्दी)
              </button>
              <button
                type="button"
                onClick={() => setIsTourOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-white border border-emerald-300 text-emerald-900 font-semibold text-xs hover:bg-emerald-50 transition shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                Replay Sample Tour
              </button>
            </div>
          </div>

          {/* Wipe All Data Danger Zone */}
          <div className="rounded-card bg-rose-50/50 border border-rose-200 p-5 space-y-3 text-xs">
            <h3 className="font-bold text-rose-900">Danger Zone: Wipe Local Data</h3>
            <p className="text-rose-800 text-[11px]">
              Erase all local financial records, receipts, and workspaces from this browser. This cannot be undone. We recommend exporting an encrypted backup file first.
            </p>
            <button
              onClick={handleWipeAllData}
              className="px-4 py-2 bg-rose-600 text-white rounded-control font-semibold text-xs hover:bg-rose-700 transition"
            >
              Wipe All On-Device Data
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Modals */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <PrivacyCenterModal isOpen={isPrivacyCenterOpen} onClose={() => setIsPrivacyCenterOpen(false)} />
      <GuidedTourModal isOpen={isTourOpen} onClose={() => setIsTourOpen(false)} />
    </div>
  );
};
