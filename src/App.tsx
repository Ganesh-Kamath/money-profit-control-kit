import React, { useEffect } from 'react';
import { useApp } from './context/AppContext';
import { AppShell } from './components/AppShell';
import { PinLockModal } from './components/PinLockModal';
import { AddTransactionModal } from './components/AddTransactionModal';
import { DrilldownModal } from './components/DrilldownModal';
import { AssistantDrawer } from './components/AssistantDrawer';

// Pages
import { OverviewPage } from './pages/OverviewPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ExpensesReceiptsPage } from './pages/ExpensesReceiptsPage';
import { SalesProfitPage } from './pages/SalesProfitPage';
import { CashAccountsPage } from './pages/CashAccountsPage';
import { ReceivablesPage } from './pages/ReceivablesPage';
import { ReportsPage } from './pages/ReportsPage';
import { ImportBackupPage } from './pages/ImportBackupPage';
import { SettingsPage } from './pages/SettingsPage';
import { LandingPage } from './pages/LandingPage';

export const App: React.FC = () => {
  const {
    currentScreen,
    isAddTxModalOpen,
    openAddTxModal,
    isAssistantOpen,
    openAssistant,
    closeAssistant,
    drilldownParams,
  } = useApp();

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if focus is in an input or textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // 'a' or '+' to add transaction
      if (e.key === 'a' || e.key === 'A' || e.key === '+') {
        e.preventDefault();
        openAddTxModal();
      }

      // '?' or '/' or 'k' with Cmd/Ctrl for Assistant
      if (e.key === '?' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        openAssistant();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openAddTxModal, openAssistant]);

  // If on the public static sales / landing page, render it standalone
  if (currentScreen === 'site') {
    return <LandingPage />;
  }

  // Render the core local app inside the responsive AppShell
  return (
    <AppShell>
      {/* Dynamic Screen Routing */}
      {currentScreen === 'overview' && <OverviewPage />}
      {currentScreen === 'transactions' && <TransactionsPage />}
      {currentScreen === 'expenses' && <ExpensesReceiptsPage />}
      {currentScreen === 'sales_profit' && <SalesProfitPage />}
      {currentScreen === 'accounts' && <CashAccountsPage />}
      {currentScreen === 'receivables' && <ReceivablesPage />}
      {currentScreen === 'reports' && <ReportsPage />}
      {currentScreen === 'import_backup' && <ImportBackupPage />}
      {currentScreen === 'settings' && <SettingsPage />}
      {currentScreen === 'privacy_center' && <SettingsPage />}

      {/* Global Modals & Drawers */}
      <PinLockModal />
      {isAddTxModalOpen && <AddTransactionModal />}
      {drilldownParams && <DrilldownModal />}
      {isAssistantOpen && <AssistantDrawer />}
    </AppShell>
  );
};
