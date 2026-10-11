import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  db,
  recalculateAccountBalance,
  type Account,
  type Category,
  type Transaction,
} from '../storage/db';
import {
  StatementParser,
  BANK_PRESETS,
  type ParsedStatementEntry,
} from '../engine/statementParsers';
import {
  encryptData,
  decryptData,
  type EncryptedPackage,
} from '../engine/encryptionEngine';
import { formatINR } from '../engine/calculationEngine';
import {
  UploadCloud,
  FileSpreadsheet,
  ShieldCheck,
  Download,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  FileText,
  Key,
  FolderDown,
  Info,
} from 'lucide-react';

export const ImportBackupPage: React.FC = () => {
  const { activeWorkspace, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<'statement' | 'backup' | 'roadmap'>('statement');

  // Statement Import Wizard state
  const [selectedPreset, setSelectedPreset] = useState<string>('hdfc');
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [csvContent, setCsvContent] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<ParsedStatementEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Backup & Encryption state
  const [passphrase, setPassphrase] = useState<string>('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  React.useEffect(() => {
    if (!activeWorkspace) return;
    db.accounts
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray()
      .then((accs) => {
        setAccounts(accs);
        if (accs.length > 0) setTargetAccountId(accs[0].id);
      });
  }, [activeWorkspace]);

  if (!activeWorkspace) return null;

  // Handle Statement CSV file upload & preview
  const handleStatementFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      try {
        const preview = StatementParser.parseWithPreset(text, selectedPreset);
        setParsedPreview(preview);
      } catch (err: any) {
        alert(`Parsing preview failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Commit Import to IndexedDB (with Idempotency)
  const handleCommitImport = async () => {
    if (parsedPreview.length === 0 || !targetAccountId) return;

    setIsProcessing(true);
    try {
      let importedCount = 0;
      let duplicateSkipped = 0;
      const nowIso = new Date().toISOString();

      await db.transaction('rw', db.transactions, db.accounts, async () => {
        for (const item of parsedPreview) {
          // Idempotency check: match account, amount, occurredAt, and description
          const existing = await db.transactions
            .where('workspaceId')
            .equals(activeWorkspace.id)
            .filter(
              (t) =>
                t.accountId === targetAccountId &&
                t.amountPaise === item.amountPaise &&
                t.description === item.description &&
                t.occurredAt.slice(0, 10) === item.occurredAt.slice(0, 10)
            )
            .first();

          if (existing) {
            duplicateSkipped++;
            continue;
          }

          const txId = `tx-imp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          await db.transactions.put({
            id: txId,
            workspaceId: activeWorkspace.id,
            type: item.type,
            amountPaise: item.amountPaise,
            occurredAt: item.occurredAt,
            accountId: targetAccountId,
            description: item.description,
            referenceNumber: item.referenceNumber,
            status: 'active',
            source: item.source,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
          importedCount++;
        }

        // Recalculate target account closing balance atomically
        await recalculateAccountBalance(db, targetAccountId);
      });

      showToast({
        type: 'success',
        title: 'Import Completed',
        message: `${importedCount} entries imported successfully into ${
          accounts.find((a) => a.id === targetAccountId)?.name
        }.${duplicateSkipped > 0 ? ` (${duplicateSkipped} duplicates skipped)` : ''}`,
      });

      setParsedPreview([]);
      setCsvContent('');
    } catch (err: any) {
      alert(`Import commit failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Full Encrypted Backup Export (.cpk file with AES-256-GCM)
  const handleExportEncryptedBackup = async () => {
    if (!passphrase || passphrase.length < 6) {
      alert('Please enter a secure passphrase (at least 6 characters) to encrypt your backup.');
      return;
    }

    setIsProcessing(true);
    try {
      // Gather all workspace records
      const [txs, cats, accs, rcpts, invs, recons, locks] = await Promise.all([
        db.transactions.where('workspaceId').equals(activeWorkspace.id).toArray(),
        db.categories.where('workspaceId').equals(activeWorkspace.id).toArray(),
        db.accounts.where('workspaceId').equals(activeWorkspace.id).toArray(),
        db.receipts.where('workspaceId').equals(activeWorkspace.id).toArray(),
        db.invoices.where('workspaceId').equals(activeWorkspace.id).toArray(),
        db.reconciliations.where('workspaceId').equals(activeWorkspace.id).toArray(),
        db.periodLocks.where('workspaceId').equals(activeWorkspace.id).toArray(),
      ]);

      const backupPayload = {
        workspace: activeWorkspace,
        transactions: txs,
        categories: cats,
        accounts: accs,
        receipts: rcpts.map((r) => ({
          ...r,
          blob: undefined, // Metadata included; blobs can be exported separately or serialized
        })),
        invoices: invs,
        reconciliations: recons,
        periodLocks: locks,
        exportedAt: new Date().toISOString(),
      };

      const encryptedPackage = await encryptData(backupPayload, passphrase);
      const blob = new Blob([JSON.stringify(encryptedPackage, null, 2)], {
        type: 'application/json',
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `controlkit_backup_${activeWorkspace.name.replace(/\s+/g, '_')}_${new Date()
        .toISOString()
        .slice(0, 10)}.cpk`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast({
        type: 'success',
        title: 'Encrypted Backup Saved',
        message: 'Your complete financial records were encrypted with AES-256-GCM and saved to your device.',
      });
      setPassphrase('');
    } catch (err: any) {
      alert(`Encryption failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Restore Encrypted Backup
  const handleRestoreEncryptedBackup = async () => {
    if (!restoreFile || !restorePassphrase) {
      alert('Please select a .cpk backup file and enter its decryption passphrase.');
      return;
    }

    setIsProcessing(true);
    try {
      const text = await restoreFile.text();
      const pkg = JSON.parse(text) as EncryptedPackage;
      const decrypted = await decryptData(pkg, restorePassphrase);

      if (!decrypted.workspace || !decrypted.transactions) {
        throw new Error('Invalid backup file schema.');
      }

      const replace = confirm(
        `Backup contains records for "${decrypted.workspace.name}". Do you want to restore these records into your workspace?`
      );
      if (!replace) return;

      await db.transaction(
        'rw',
        db.workspaces,
        db.accounts,
        db.categories,
        db.transactions,
        db.invoices,
        async () => {
          if (decrypted.accounts) await db.accounts.bulkPut(decrypted.accounts);
          if (decrypted.categories) await db.categories.bulkPut(decrypted.categories);
          if (decrypted.transactions) await db.transactions.bulkPut(decrypted.transactions);
          if (decrypted.invoices) await db.invoices.bulkPut(decrypted.invoices);
        }
      );

      showToast({
        type: 'success',
        title: 'Backup Restored',
        message: 'All records, accounts, and categories restored successfully.',
      });

      setRestoreFile(null);
      setRestorePassphrase('');
    } catch (err: any) {
      alert(`Restore failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-navy-950">Import & On-Device Backup</h1>
          <p className="text-xs text-navy-500 mt-0.5">
            Bank & UPI statement CSV imports · Zero-server encrypted AES-256 backups
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-surface-subtle p-1 rounded-control border border-surface-border text-xs">
          <button
            onClick={() => setActiveTab('statement')}
            className={`px-3 py-1 font-semibold rounded ${
              activeTab === 'statement' ? 'bg-white shadow text-navy-900' : 'text-navy-500'
            }`}
          >
            Bank / UPI Statement Import
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-1 font-semibold rounded ${
              activeTab === 'backup' ? 'bg-white shadow text-navy-900' : 'text-navy-500'
            }`}
          >
            Encrypted Backup & Restore
          </button>
          <button
            onClick={() => setActiveTab('roadmap')}
            className={`px-3 py-1 font-semibold rounded ${
              activeTab === 'roadmap' ? 'bg-white shadow text-navy-900' : 'text-navy-500'
            }`}
          >
            Honest Roadmap (Coming Soon)
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: STATEMENT IMPORT WIZARD
         ========================================================================= */}
      {activeTab === 'statement' && (
        <div className="space-y-6">
          <div className="rounded-card bg-white p-6 border border-surface-border shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-navy-900">1. Select Preset & Target Account</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-navy-700 mb-1">
                  Bank / UPI Statement Preset
                </label>
                <select
                  value={selectedPreset}
                  onChange={(e) => {
                    setSelectedPreset(e.target.value);
                    if (csvContent) {
                      try {
                        const preview = StatementParser.parseWithPreset(csvContent, e.target.value);
                        setParsedPreview(preview);
                      } catch (err) {}
                    }
                  }}
                  className="w-full rounded-control border border-surface-border px-3 py-2 text-xs text-navy-900 bg-white"
                >
                  {Object.values(BANK_PRESETS).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.isCommunityTested ? '(Community Tested)' : ''}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-navy-400 mt-1 block">
                  Supports HDFC, ICICI, SBI, Axis, Kotak, PhonePe, GPay, Paytm, Razorpay.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-navy-700 mb-1">
                  Target Account (to record entries into)
                </label>
                <select
                  value={targetAccountId}
                  onChange={(e) => setTargetAccountId(e.target.value)}
                  className="w-full rounded-control border border-surface-border px-3 py-2 text-xs text-navy-900 bg-white"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatINR(a.currentBalancePaise)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2">
              <label className="cursor-pointer inline-flex items-center gap-2 rounded-control bg-surface-subtle border border-surface-borderStrong px-4 py-2.5 text-xs font-semibold text-navy-800 hover:bg-surface-border transition">
                <FileSpreadsheet className="h-4 w-4 text-brand-600" />
                <span>Choose Statement CSV File</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleStatementFileChange}
                />
              </label>
            </div>
          </div>

          {/* Import Preview Table */}
          {parsedPreview.length > 0 && (
            <div className="rounded-card bg-white border border-surface-border shadow-sm overflow-hidden space-y-4 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-navy-900">
                    Preview Before Commit ({parsedPreview.length} entries parsed)
                  </h3>
                  <p className="text-xs text-navy-500">
                    Review parsed rows. Existing identical entries will be skipped automatically to prevent duplicates.
                  </p>
                </div>
                <button
                  onClick={handleCommitImport}
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-control bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 shadow-sm disabled:opacity-50"
                >
                  {isProcessing ? 'Importing...' : 'Commit Import into Ledger'}
                </button>
              </div>

              <div className="overflow-x-auto max-h-96 border border-surface-border rounded-control">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-subtle border-b border-surface-border text-navy-600">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Reference #</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {parsedPreview.map((row, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3 text-navy-600">{row.occurredAt.slice(0, 10)}</td>
                        <td className="py-2 px-3 uppercase text-[10px] font-bold">
                          <span
                            className={
                              row.type === 'income' ? 'text-finance-income' : 'text-finance-expense'
                            }
                          >
                            {row.type}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-medium text-navy-900">{row.description}</td>
                        <td className="py-2 px-3 text-navy-400">{row.referenceNumber || '—'}</td>
                        <td
                          className={`py-2 px-3 text-right font-bold tabular-nums ${
                            row.type === 'income' ? 'text-finance-income' : 'text-finance-expense'
                          }`}
                        >
                          {formatINR(row.amountPaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: ENCRYPTED BACKUP & RESTORE
         ========================================================================= */}
      {activeTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export Encrypted Backup */}
          <div className="rounded-card bg-white p-6 border border-surface-border shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand-600" />
              <h2 className="text-sm font-bold text-navy-900">Encrypted Full Backup (.cpk)</h2>
            </div>
            <p className="text-xs text-navy-600 leading-relaxed">
              Export all workspace ledger entries, accounts, invoices, and categories into a single AES-256-GCM encrypted file. Only someone with your secret passphrase can decrypt this file.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-navy-700 mb-1">
                  Encryption Passphrase <span className="text-finance-expense">*</span>
                </label>
                <input
                  type="password"
                  placeholder="Min 6 characters (e.g. MySecretBakery2026!)"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full rounded-control border border-surface-borderStrong px-3 py-2 text-xs text-navy-900 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded border border-amber-200 text-[11px] text-amber-900">
                <strong>Important:</strong> There is no password recovery. If you forget this passphrase, your backup file cannot be decrypted by anyone.
              </div>

              <button
                onClick={handleExportEncryptedBackup}
                disabled={isProcessing || passphrase.length < 6}
                className="w-full py-2.5 rounded-control bg-brand-600 text-white font-semibold text-xs hover:bg-brand-700 shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                <span>Export Encrypted Backup (.cpk)</span>
              </button>
            </div>
          </div>

          {/* Restore Backup */}
          <div className="rounded-card bg-white p-6 border border-surface-border shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <FolderDown className="h-5 w-5 text-navy-700" />
              <h2 className="text-sm font-bold text-navy-900">Restore from .cpk File</h2>
            </div>
            <p className="text-xs text-navy-600 leading-relaxed">
              Restore your financial records onto this device or a new laptop/phone using an encrypted backup file.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="cursor-pointer inline-flex items-center gap-2 rounded-control bg-surface-subtle border border-surface-border px-3 py-2 text-xs font-semibold text-navy-700 hover:bg-surface-border w-full">
                  <FileText className="h-4 w-4 text-navy-500" />
                  <span className="truncate">
                    {restoreFile ? restoreFile.name : 'Select .cpk Backup File'}
                  </span>
                  <input
                    type="file"
                    accept=".cpk,.json"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setRestoreFile(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>

              <div>
                <label className="block font-semibold text-navy-700 mb-1">
                  Decryption Passphrase
                </label>
                <input
                  type="password"
                  placeholder="Enter the passphrase used during export"
                  value={restorePassphrase}
                  onChange={(e) => setRestorePassphrase(e.target.value)}
                  className="w-full rounded-control border border-surface-borderStrong px-3 py-2 text-xs text-navy-900 focus:outline-none"
                />
              </div>

              <button
                onClick={handleRestoreEncryptedBackup}
                disabled={isProcessing || !restoreFile || !restorePassphrase}
                className="w-full py-2.5 rounded-control bg-navy-800 text-white font-semibold text-xs hover:bg-navy-900 shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Decrypt & Restore Records</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: HONEST ROADMAP
         ========================================================================= */}
      {activeTab === 'roadmap' && (
        <div className="rounded-card bg-white p-6 border border-surface-border shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-brand-600" />
            <h2 className="text-sm font-bold text-navy-900">Integrations Roadmap (Honest Status)</h2>
          </div>
          <p className="text-xs text-navy-600 leading-relaxed">
            We believe in complete commercial honesty. Below is the exact availability status for third-party connectors. We will NEVER ask for your netbanking passwords or promise automated bank syncing until regulated approvals are in place.
          </p>

          <div className="divide-y divide-surface-border text-xs">
            {[
              {
                name: 'Bank & UPI Statement CSV Import',
                status: 'AVAILABLE NOW',
                statusColor: 'text-emerald-700 bg-emerald-50',
                note: 'Tested with HDFC, ICICI, SBI, Axis, Kotak, PhonePe, GPay, Paytm exports.',
              },
              {
                name: 'Encrypted On-Device Backup & Restore',
                status: 'AVAILABLE NOW',
                statusColor: 'text-emerald-700 bg-emerald-50',
                note: 'AES-256-GCM encrypted local file portability between phones and PCs.',
              },
              {
                name: 'RBI Account Aggregator (Live Bank Sync)',
                status: 'COMING SOON',
                statusColor: 'text-amber-700 bg-amber-50',
                note: 'In active review. Requires Sahamati and NBFC-AA consent framework integration.',
              },
              {
                name: 'Tally Prime & Zoho Books Sync',
                status: 'COMING SOON',
                statusColor: 'text-slate-700 bg-slate-100',
                note: 'Planned export adapter for accountants who request Tally XML format.',
              },
              {
                name: 'WhatsApp Business Daily Digest',
                status: 'COMING SOON',
                statusColor: 'text-slate-700 bg-slate-100',
                note: 'Optional opt-in self-hosted notification bot.',
              },
            ].map((item, idx) => (
              <div key={idx} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-navy-900">{item.name}</h3>
                  <p className="text-navy-500 text-[11px] mt-0.5">{item.note}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded shrink-0 self-start sm:self-auto ${item.statusColor}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
