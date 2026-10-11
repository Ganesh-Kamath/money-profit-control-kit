import React, { useState } from 'react';
import {
  LayoutDashboard,
  Receipt,
  FileCheck2,
  TrendingUp,
  Wallet,
  FileText,
  BarChart3,
  HardDriveDownload,
  Settings,
  Plus,
  HelpCircle,
  Lock,
  ShieldCheck,
  AlertTriangle,
  Building2,
  Globe,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  X,
  ExternalLink,
} from 'lucide-react';
import { useApp, type ScreenId } from '../context/AppContext';

interface NavItem {
  id: ScreenId;
  label: string;
  icon: React.ElementType;
  badge?: string;
  businessOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'expenses', label: 'Expenses & Receipts', icon: FileCheck2 },
  { id: 'sales_profit', label: 'Sales & Profit', icon: TrendingUp },
  { id: 'accounts', label: 'Cash & Accounts', icon: Wallet },
  { id: 'receivables', label: 'Receivables & Invoices', icon: FileText, businessOnly: true },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'import_backup', label: 'Import & Backup', icon: HardDriveDownload },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    currentScreen,
    setCurrentScreen,
    workspaces,
    activeWorkspace,
    setActiveWorkspaceId,
    openAddTxModal,
    openAssistant,
    lockAppNow,
    security,
    license,
    isBusinessPlan,
    isStoragePersisted,
    requestStoragePersistence,
    toasts,
    dismissToast,
  } = useApp();

  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [persistenceDismissed, setPersistenceDismissed] = useState(false);

  const handlePersistClick = async () => {
    const ok = await requestStoragePersistence();
    if (!ok) {
      alert('Your browser does not allow persistent storage for this site or requires "Add to Home Screen" first.');
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800">
      {/* 1. DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex flex-col w-64 bg-navy-950 text-slate-200 border-r border-navy-900 select-none flex-shrink-0 z-20">
        {/* Brand Header */}
        <div className="p-4 border-b border-navy-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white font-black text-sm shadow-sm">
              ₹
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                ControlKit
                <span className="rounded bg-navy-800 px-1 py-0.2 text-[9px] font-semibold text-emerald-400 border border-emerald-900/50">
                  LOCAL
                </span>
              </div>
              <div className="text-[11px] text-slate-400">Zero-Cloud Financials</div>
            </div>
          </div>
          {security?.pinHash && (
            <button
              onClick={lockAppNow}
              title="Lock App"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition-colors"
            >
              <Lock className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Workspace Switcher */}
        <div className="p-3 border-b border-navy-900 relative">
          <button
            onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-navy-900/80 hover:bg-navy-800 border border-navy-800 text-left transition-colors text-xs"
          >
            <div className="flex items-center gap-2 truncate">
              <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <div className="truncate font-medium text-white">
                {activeWorkspace?.name || 'Select Workspace'}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {activeWorkspace?.isDemo && (
                <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-medium border border-amber-500/30">
                  DEMO
                </span>
              )}
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </div>
          </button>

          {isWorkspaceMenuOpen && (
            <div className="absolute top-full left-3 right-3 mt-1 bg-navy-900 border border-navy-800 rounded-xl shadow-xl p-1 z-30">
              <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1 tracking-wider">
                Workspaces ({workspaces.length} / {isBusinessPlan ? '5' : '1'})
              </div>
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    setActiveWorkspaceId(ws.id);
                    setIsWorkspaceMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left ${
                    activeWorkspace?.id === ws.id
                      ? 'bg-brand-600 text-white font-medium'
                      : 'text-slate-300 hover:bg-navy-800'
                  }`}
                >
                  <span className="truncate">{ws.name}</span>
                  {ws.isDemo && (
                    <span className="text-[9px] opacity-75 font-mono ml-1">Demo</span>
                  )}
                </button>
              ))}
              <div className="pt-1 mt-1 border-t border-navy-800">
                <button
                  onClick={() => {
                    setIsWorkspaceMenuOpen(false);
                    setCurrentScreen('settings');
                  }}
                  className="w-full text-left text-[11px] text-brand-400 hover:text-brand-300 px-2 py-1 font-medium"
                >
                  + Manage Workspaces
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentScreen(item.id);
                  setIsMobileMoreOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:bg-navy-900 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.businessOnly && !isBusinessPlan && (
                  <span className="text-[9px] bg-navy-800 text-amber-300 px-1.5 py-0.5 rounded border border-navy-700">
                    Business
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Actions & Utilities */}
        <div className="p-3 border-t border-navy-900 space-y-2">
          {/* Ask Numbers Quick Drawer Button */}
          <button
            onClick={openAssistant}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-navy-900 hover:bg-navy-800 text-slate-300 hover:text-white border border-navy-800 text-xs font-medium transition-all"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Ask About My Numbers</span>
          </button>

          {/* Persistent Primary Action: Add Transaction */}
          <button
            onClick={openAddTxModal}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-950/40 active:scale-98 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>+ Add Transaction</span>
          </button>

          {/* Storage & Privacy Status Footer */}
          <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-navy-900">
            <button
              onClick={() => setCurrentScreen('privacy_center')}
              className="flex items-center gap-1 hover:text-slate-200 transition-colors"
            >
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              <span>Privacy Centre</span>
            </button>
            <button
              onClick={() => setCurrentScreen('site')}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
              title="View Public Product Site"
            >
              <Globe className="h-3 w-3" />
              <span>Sales Page</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. MAIN APPLICATION CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Top Header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-navy-950 text-white border-b border-navy-900 flex-shrink-0 z-20">
          <div className="flex items-center gap-2 truncate">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white font-black text-xs">
              ₹
            </div>
            <div className="truncate">
              <span className="font-bold text-sm block leading-tight">{activeWorkspace?.name || 'ControlKit'}</span>
              <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-mono">100% On-Device</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openAssistant}
              className="p-1.5 rounded-lg bg-navy-900 text-amber-300 hover:text-white border border-navy-800"
              title="Ask About My Numbers"
            >
              <Sparkles className="h-4 w-4" />
            </button>
            <button
              onClick={openAddTxModal}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          </div>
        </header>

        {/* Persistence Banner (if not persisted and not dismissed) */}
        {!isStoragePersisted && !persistenceDismissed && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-900 flex-shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span>
                Browser storage is currently non-persistent. To prevent accidental clearing on iOS/Safari, enable storage persistence.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePersistClick}
                className="underline font-semibold hover:text-amber-950 text-xs"
              >
                Enable Persistence
              </button>
              <button
                onClick={() => setPersistenceDismissed(true)}
                className="p-1 text-amber-600 hover:text-amber-900"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto bg-slate-50 relative pb-16 lg:pb-0">
          {children}
        </main>

        {/* 3. MOBILE BOTTOM NAVIGATION */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around px-2 z-30 shadow-lg">
          <button
            onClick={() => {
              setCurrentScreen('overview');
              setIsMobileMoreOpen(false);
            }}
            className={`flex flex-col items-center justify-center w-14 py-1 ${
              currentScreen === 'overview' ? 'text-brand-600 font-bold' : 'text-slate-500'
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-[10px] mt-0.5">Overview</span>
          </button>

          <button
            onClick={() => {
              setCurrentScreen('transactions');
              setIsMobileMoreOpen(false);
            }}
            className={`flex flex-col items-center justify-center w-14 py-1 ${
              currentScreen === 'transactions' ? 'text-brand-600 font-bold' : 'text-slate-500'
            }`}
          >
            <Receipt className="h-5 w-5" />
            <span className="text-[10px] mt-0.5">Ledger</span>
          </button>

          {/* Center Prominent Add Button on Mobile */}
          <button
            onClick={openAddTxModal}
            className="flex items-center justify-center h-12 w-12 rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 active:scale-95 -mt-4 border-2 border-white"
            title="Add Transaction"
          >
            <Plus className="h-6 w-6" />
          </button>

          <button
            onClick={() => {
              setCurrentScreen('sales_profit');
              setIsMobileMoreOpen(false);
            }}
            className={`flex flex-col items-center justify-center w-14 py-1 ${
              currentScreen === 'sales_profit' ? 'text-brand-600 font-bold' : 'text-slate-500'
            }`}
          >
            <TrendingUp className="h-5 w-5" />
            <span className="text-[10px] mt-0.5">Profit</span>
          </button>

          <button
            onClick={() => setIsMobileMoreOpen(!isMobileMoreOpen)}
            className={`flex flex-col items-center justify-center w-14 py-1 ${
              isMobileMoreOpen || ['accounts', 'expenses', 'receivables', 'reports', 'import_backup', 'settings'].includes(currentScreen)
                ? 'text-brand-600 font-bold'
                : 'text-slate-500'
            }`}
          >
            <ChevronDown className={`h-5 w-5 transition-transform ${isMobileMoreOpen ? 'rotate-180' : ''}`} />
            <span className="text-[10px] mt-0.5">More</span>
          </button>
        </nav>

        {/* Mobile "More" Drawer Menu */}
        {isMobileMoreOpen && (
          <div className="lg:hidden fixed bottom-16 left-0 right-0 bg-white border-t border-slate-200 shadow-2xl p-4 z-40 rounded-t-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">All Sections</span>
              <button onClick={() => setIsMobileMoreOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {NAV_ITEMS.slice(2).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentScreen(item.id);
                      setIsMobileMoreOpen(false);
                    }}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium text-left ${
                      currentScreen === item.id
                        ? 'bg-brand-50 border-brand-200 text-brand-700 font-semibold'
                        : 'border-slate-100 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Icon className="h-4 w-4 text-slate-500" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. FLOATING TOAST NOTIFICATIONS */}
        <div className="fixed bottom-20 lg:bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-xl p-3.5 shadow-xl border text-xs flex items-start justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-150 ${
                toast.type === 'success'
                  ? 'bg-emerald-950 text-white border-emerald-800'
                  : toast.type === 'error'
                  ? 'bg-rose-950 text-white border-rose-800'
                  : toast.type === 'warning'
                  ? 'bg-amber-950 text-white border-amber-800'
                  : 'bg-navy-950 text-white border-navy-800'
              }`}
            >
              <div>
                <div className="font-bold">{toast.title}</div>
                <div className="mt-0.5 opacity-90 leading-relaxed">{toast.message}</div>
                {toast.undoAction && (
                  <button
                    onClick={() => {
                      toast.undoAction?.();
                      dismissToast(toast.id);
                    }}
                    className="mt-2 text-xs font-bold underline text-amber-300 hover:text-amber-200 block"
                  >
                    Undo Action
                  </button>
                )}
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="opacity-70 hover:opacity-100 p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
