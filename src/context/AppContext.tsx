import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db, type Workspace, type LicenseRecord, type AppSecurityRecord } from '../storage/db';
import { verifyLicenseKey } from '../engine/licenseEngine';
import { hashPin } from '../engine/encryptionEngine';
import { seedDemoWorkspace } from '../engine/seedDemo';

export type ScreenId =
  | 'overview'
  | 'transactions'
  | 'expenses'
  | 'sales_profit'
  | 'accounts'
  | 'receivables'
  | 'reports'
  | 'import_backup'
  | 'settings'
  | 'site'
  | 'privacy_center';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  undoAction?: () => void;
}

export interface DrilldownParams {
  title: string;
  subtitle?: string;
  filterType?: 'income' | 'expense' | 'transfer' | 'all';
  categoryId?: string;
  accountId?: string;
  startDate?: string;
  endDate?: string;
}

interface AppContextType {
  // Navigation & Screen
  currentScreen: ScreenId;
  setCurrentScreen: (screen: ScreenId) => void;

  // Workspaces
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspaceId: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (name: string, businessType: string) => Promise<string>;

  // Licensing
  license: LicenseRecord | null;
  activateLicense: (keyString: string) => Promise<{ success: boolean; error?: string }>;
  isBusinessPlan: boolean;

  // App Lock
  security: AppSecurityRecord | null;
  isAppLocked: boolean;
  unlockApp: (pin: string) => Promise<boolean>;
  setAppPin: (pin: string, autoLockMinutes?: number) => Promise<void>;
  removeAppPin: () => Promise<void>;
  lockAppNow: () => void;

  // Storage & Persistence
  isStoragePersisted: boolean;
  storageUsageMb: number;
  requestStoragePersistence: () => Promise<boolean>;

  // Global Modals & Actions
  isAddTxModalOpen: boolean;
  openAddTxModal: () => void;
  closeAddTxModal: () => void;

  isAssistantOpen: boolean;
  openAssistant: () => void;
  closeAssistant: () => void;

  drilldownParams: DrilldownParams | null;
  openDrilldown: (params: DrilldownParams) => void;
  closeDrilldown: () => void;

  // Toast System
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;

  // Demo Workspace
  resetDemoWorkspace: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('overview');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string>('');
  const [license, setLicense] = useState<LicenseRecord | null>(null);
  const [security, setSecurity] = useState<AppSecurityRecord | null>(null);
  const [isAppLocked, setIsAppLocked] = useState<boolean>(false);

  const [isStoragePersisted, setIsStoragePersisted] = useState<boolean>(false);
  const [storageUsageMb, setStorageUsageMb] = useState<number>(0);

  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState<boolean>(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);
  const [drilldownParams, setDrilldownParams] = useState<DrilldownParams | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // 1. Load initial storage and license
  const refreshWorkspaces = useCallback(async () => {
    const list = await db.workspaces.toArray();
    setWorkspaces(list);
    if (list.length > 0 && (!activeWorkspaceId || !list.some((w) => w.id === activeWorkspaceId))) {
      setActiveWorkspaceIdState(list[0].id);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    async function init() {
      // Check storage persistence
      if (navigator.storage && navigator.storage.persisted) {
        const persisted = await navigator.storage.persisted();
        setIsStoragePersisted(persisted);
      }
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const mb = Math.round(((estimate.usage || 0) / (1024 * 1024)) * 10) / 10;
        setStorageUsageMb(mb);
      }

      // Load License
      const lic = await db.license.get('current');
      if (lic) setLicense(lic);

      // Load Security & Lock status
      const sec = await db.appSecurity.get('current');
      if (sec) {
        setSecurity(sec);
        if (sec.pinHash && sec.isLocked) {
          setIsAppLocked(true);
        }
      }

      // Load Workspaces
      const allWs = await db.workspaces.toArray();
      if (allWs.length === 0) {
        // Automatically seed demo workspace so user never lands on empty 0 screen
        const demoId = await seedDemoWorkspace();
        const updated = await db.workspaces.toArray();
        setWorkspaces(updated);
        setActiveWorkspaceIdState(demoId);
      } else {
        setWorkspaces(allWs);
        setActiveWorkspaceIdState(allWs[0].id);
      }
    }
    init();
  }, [refreshWorkspaces]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0] || null;

  const setActiveWorkspaceId = (id: string) => {
    setActiveWorkspaceIdState(id);
  };

  const createWorkspace = async (name: string, businessType: string): Promise<string> => {
    // Check plan workspace limit: Solo = 1, Business = 5
    const isBusiness = license?.plan === 'business';
    const nonDemoCount = workspaces.filter((w) => !w.isDemo).length;
    if (!isBusiness && nonDemoCount >= 1) {
      throw new Error('Solo plan supports 1 workspace. Upgrade to Business for up to 5 workspaces.');
    }
    if (isBusiness && nonDemoCount >= 5) {
      throw new Error('Maximum limit of 5 business workspaces reached.');
    }

    const id = `ws-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const newWs: Workspace = {
      id,
      name,
      businessType,
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      fyStartMonth: 4,
      isDemo: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await db.workspaces.put(newWs);
    await refreshWorkspaces();
    setActiveWorkspaceIdState(id);
    return id;
  };

  const activateLicense = async (keyString: string): Promise<{ success: boolean; error?: string }> => {
    const res = await verifyLicenseKey(keyString);
    if (!res.valid || !res.plan) {
      return { success: false, error: res.error || 'Invalid license key' };
    }

    const record: LicenseRecord = {
      id: 'current',
      key: keyString.trim(),
      plan: res.plan,
      licenseeName: res.licenseeName || 'Registered User',
      licenseeEmail: res.licenseeEmail || '',
      issuedAt: res.issuedAt || new Date().toISOString(),
      updatesUntil: res.updatesUntil || new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
    };

    await db.license.put(record);
    setLicense(record);
    return { success: true };
  };

  const isBusinessPlan = license?.plan === 'business';

  // App Lock logic
  const unlockApp = async (pin: string): Promise<boolean> => {
    if (!security || !security.pinHash || !security.pinSalt) {
      setIsAppLocked(false);
      return true;
    }
    const check = await hashPin(pin, security.pinSalt);
    if (check.hashHex === security.pinHash) {
      setIsAppLocked(false);
      await db.appSecurity.update('current', { isLocked: false });
      return true;
    }
    return false;
  };

  const setAppPin = async (pin: string, autoLockMinutes = 15) => {
    const { hashHex, saltHex } = await hashPin(pin);
    const rec: AppSecurityRecord = {
      id: 'current',
      pinHash: hashHex,
      pinSalt: saltHex,
      autoLockMinutes,
      lockOnBackground: true,
      isLocked: false,
    };
    await db.appSecurity.put(rec);
    setSecurity(rec);
    setIsAppLocked(false);
  };

  const removeAppPin = async () => {
    await db.appSecurity.delete('current');
    setSecurity(null);
    setIsAppLocked(false);
  };

  const lockAppNow = () => {
    if (security?.pinHash) {
      setIsAppLocked(true);
      db.appSecurity.update('current', { isLocked: true });
    }
  };

  const requestStoragePersistence = async (): Promise<boolean> => {
    if (navigator.storage && navigator.storage.persist) {
      const persisted = await navigator.storage.persist();
      setIsStoragePersisted(persisted);
      return persisted;
    }
    return false;
  };

  const showToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: ToastMessage = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      dismissToast(id);
    }, 6000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const resetDemoWorkspace = async () => {
    const demoId = await seedDemoWorkspace();
    await refreshWorkspaces();
    setActiveWorkspaceIdState(demoId);
    showToast({
      type: 'info',
      title: 'Demo Workspace Reset',
      message: 'Sweet Crumb Patisserie demo data restored with 3 months of sample records.',
    });
  };

  return (
    <AppContext.Provider
      value={{
        currentScreen,
        setCurrentScreen,
        workspaces,
        activeWorkspace,
        setActiveWorkspaceId,
        refreshWorkspaces,
        createWorkspace,
        license,
        activateLicense,
        isBusinessPlan,
        security,
        isAppLocked,
        unlockApp,
        setAppPin,
        removeAppPin,
        lockAppNow,
        isStoragePersisted,
        storageUsageMb,
        requestStoragePersistence,
        isAddTxModalOpen,
        openAddTxModal: () => setIsAddTxModalOpen(true),
        closeAddTxModal: () => setIsAddTxModalOpen(false),
        isAssistantOpen,
        openAssistant: () => setIsAssistantOpen(true),
        closeAssistant: () => setIsAssistantOpen(false),
        drilldownParams,
        openDrilldown: (p) => setDrilldownParams(p),
        closeDrilldown: () => setDrilldownParams(null),
        toasts,
        showToast,
        dismissToast,
        resetDemoWorkspace,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
