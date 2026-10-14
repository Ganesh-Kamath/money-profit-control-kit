import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  db,
  recalculateAccountBalance,
  type Account,
  type Category,
  type Transaction,
  type CategorisationRule,
} from '../storage/db';
import {
  StatementParser,
  BANK_PRESETS,
  type ParsedStatementEntry,
  type BankPreset,
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
  Sliders,
  Check,
  X,
  RefreshCw,
  Smartphone,
  HardDrive,
} from 'lucide-react';

export const ImportBackupPage: React.FC = () => {
  const { activeWorkspace, showToast, isStoragePersisted, requestStoragePersistence } = useApp();

  const [activeTab, setActiveTab] = useState<'statement' | 'backup' | 'test_backup' | 'migrate'>('statement');

  // Statement Import Wizard state
  const [selectedPreset, setSelectedPreset] = useState<string>('hdfc');
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [fileContent, setFileContent] = useState<string | ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<ParsedStatementEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customPresets, setCustomPresets] = useState<Record<string, BankPreset>>({});

  // Custom Column Mapping State
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<Record<string, string>[]>([]);
  const [mapDateCol, setMapDateCol] = useState<string>('');
  const [mapDescCol, setMapDescCol] = useState<string>('');
  const [mapRefCol, setMapRefCol] = useState<string>('');
  const [mapStrategy, setMapStrategy] = useState<'separate_debit_credit' | 'single_signed' | 'type_and_amount'>('separate_debit_credit');
  const [mapDebitCol, setMapDebitCol] = useState<string>('');
  const [mapCreditCol, setMapCreditCol] = useState<string>('');
  const [mapAmountCol, setMapAmountCol] = useState<string>('');
  const [newPresetName, setNewPresetName] = useState<string>('');

  // Backup & Encryption state
  const [passphrase, setPassphrase] = useState<string>('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Test Backup state
  const [testBackupFile, setTestBackupFile] = useState<File | null>(null);
  const [testPassphrase, setTestPassphrase] = useState<string>('');
  const [testReport, setTestReport] = useState<{
    valid: boolean;
    timestamp?: string;
    txCount?: number;
    accCount?: number;
    invCount?: number;
    catCount?: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!activeWorkspace) return;
    db.accounts
      .where('workspaceId')
      .equals(activeWorkspace.id)
      .toArray()
      .then((accs) => {
        setAccounts(accs);
        if (accs.length > 0 && !targetAccountId) setTargetAccountId(accs[0].id);
      });

    // Load custom presets from localStorage
    const saved = localStorage.getItem(`controlkit_custom_presets_${activeWorkspace.id}`);
    if (saved) {
      try {
        setCustomPresets(JSON.parse(saved));
      } catch (e) {
        // ignore
      }
    }
  }, [activeWorkspace]);

  if (!activeWorkspace) return null;

  // Handle Statement File Upload (CSV, XLSX, XLS)
  const handleStatementFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setFileName(file.name);

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result;
      if (!content) return;
      setFileContent(content);

      try {
        // Get sample rows and headers for custom mapper preview
        let headers: string[] = [];
        let rows: Record<string, string>[] = [];

        if (typeof content === 'string') {
          const parsed = StatementParser.parseCSVText(content);
          headers = parsed.headers;
          rows = parsed.rows;
        } else {
          const parsed = StatementParser.parseExcelBuffer(content as ArrayBuffer);
          headers = parsed.headers;
          rows = parsed.rows;
        }

        setDetectedHeaders(headers);
        setSampleRows(rows.slice(0, 10));

        // If custom mode is active or user selected custom
        if (isCustomMode) {
          if (headers.length >= 3) {
            setMapDateCol(headers[0]);
            setMapDescCol(headers[1]);
            setMapDebitCol(headers[2] || '');
            setMapCreditCol(headers[3] || '');
          }
          return;
        }

        // Parse with preset
        let parsed = StatementParser.parseWithPreset(content, selectedPreset);

        // Fetch existing transactions for duplicate flagging
        const existingTxs = await db.transactions
          .where('workspaceId')
          .equals(activeWorkspace.id)
          .toArray();

        const flagged = StatementParser.flagDuplicates(parsed, existingTxs);
        setParsedPreview(flagged);
      } catch (err: any) {
        alert(`Parsing failed: ${err.message}. Try using the Custom Column Mapping Wizard.`);
        setIsCustomMode(true);
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleApplyCustomMapping = async () => {
    if (!fileContent) return;

    try {
      const parsed = StatementParser.parseWithCustomMapping(fileContent, {
        dateCol: mapDateCol,
        descCol: mapDescCol,
        refCol: mapRefCol || undefined,
        strategy: mapStrategy,
        debitCol: mapDebitCol || undefined,
        creditCol: mapCreditCol || undefined,
        amountCol: mapAmountCol || undefined,
      });

      const existingTxs = await db.transactions
        .where('workspaceId')
        .equals(activeWorkspace.id)
        .toArray();

      const flagged = StatementParser.flagDuplicates(parsed, existingTxs);
      setParsedPreview(flagged);
      setIsCustomMode(false);

      showToast({
        type: 'success',
        title: 'Custom Mapping Applied',
        message: `Parsed ${flagged.length} transactions from file.`,
      });
    } catch (err: any) {
      alert(`Custom mapping failed: ${err.message}`);
    }
  };

  const handleSaveCustomPreset = () => {
    if (!newPresetName.trim()) return;

    const preset: BankPreset = {
      id: `custom_${Date.now()}`,
      name: newPresetName.trim(),
      dateCol: mapDateCol,
      descCol: mapDescCol,
      refCol: mapRefCol || undefined,
      debitCol: mapDebitCol || undefined,
      creditCol: mapCreditCol || undefined,
      amountCol: mapAmountCol || undefined,
    };

    const updated = { ...customPresets, [preset.id]: preset };
    setCustomPresets(updated);
    localStorage.setItem(`controlkit_custom_presets_${activeWorkspace.id}`, JSON.stringify(updated));
    setSelectedPreset(preset.id);
    setNewPresetName('');

    showToast({
      type: 'success',
      title: 'Preset Saved',
      message: `Preset "${preset.name}" saved locally for future statements.`,
    });
  };

  const toggleSelectEntry = (index: number) => {
    setParsedPreview((prev) =>
      prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
    );
  };

  // Commit selected entries to IndexedDB with auto-categorisation rules
  const handleCommitImport = async () => {
    const selectedEntries = parsedPreview.filter((p) => p.selected);
    if (selectedEntries.length === 0 || !targetAccountId) return;

    setIsProcessing(true);
    try {
      const rules = await db.categorisationRules
        .where('workspaceId')
        .equals(activeWorkspace.id)
        .toArray();

      const nowIso = new Date().toISOString();
      let importedCount = 0;

      await db.transaction('rw', [db.transactions, db.accounts], async () => {
        for (const item of selectedEntries) {
          // Auto-apply categorization rule if matched
          let assignedCatId: string | undefined = undefined;
          const descLower = item.description.toLowerCase();
          for (const rule of rules) {
            if (rule.matchType === 'contains' && descLower.includes(rule.pattern)) {
              assignedCatId = rule.categoryId;
              break;
            }
          }

          const txId = `tx-imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          await db.transactions.put({
            id: txId,
            workspaceId: activeWorkspace.id,
            type: item.type,
            amountPaise: item.amountPaise,
            occurredAt: item.occurredAt,
            accountId: targetAccountId,
            categoryId: assignedCatId,
            description: item.description,
            referenceNumber: item.referenceNumber,
            status: 'active',
            source: item.source,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
          importedCount++;
        }

        await recalculateAccountBalance(db, targetAccountId);
      });

      showToast({
        type: 'success',
        title: 'Statement Imported',
        message: `Successfully imported ${importedCount} transactions. Account balance updated.`,
      });

      setParsedPreview([]);
      setFileContent(null);
      setFileName('');
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Encrypted Backup Export using File System Access API where available
  const handleExportBackup = async () => {
    if (!passphrase || passphrase.length < 6) {
      alert('Please enter a strong backup passphrase (at least 6 characters).');
      return;
    }

    setIsProcessing(true);
    try {
      // Export all tables
      const dump = {
        version: 2,
        workspaceId: activeWorkspace.id,
        exportedAt: new Date().toISOString(),
        workspaces: await db.workspaces.where('id').equals(activeWorkspace.id).toArray(),
        categories: await db.categories.where('workspaceId').equals(activeWorkspace.id).toArray(),
        accounts: await db.accounts.where('workspaceId').equals(activeWorkspace.id).toArray(),
        transactions: await db.transactions.where('workspaceId').equals(activeWorkspace.id).toArray(),
        invoices: await db.invoices.where('workspaceId').equals(activeWorkspace.id).toArray(),
        receipts: await db.receipts.where('workspaceId').equals(activeWorkspace.id).toArray(),
        businessProfiles: await db.businessProfiles.where('workspaceId').equals(activeWorkspace.id).toArray(),
        categorisationRules: await db.categorisationRules.where('workspaceId').equals(activeWorkspace.id).toArray(),
        recurringEntries: await db.recurringEntries.where('workspaceId').equals(activeWorkspace.id).toArray(),
      };

      const encryptedPkg = await encryptData(dump, passphrase);
      const jsonStr = JSON.stringify(encryptedPkg, null, 2);
      const safeBizName = activeWorkspace.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const dateStr = new Date().toISOString().slice(0, 10);
      const defaultFileName = `${safeBizName}_${dateStr}.ckbackup`;

      // Try File System Access API
      let fileSaved = false;
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: defaultFileName,
            types: [
              {
                description: 'ControlKit Encrypted Backup',
                accept: { 'application/json': ['.ckbackup', '.json'] },
              },
            ],
          });
          const writable = await handle.createWritable();
          await writable.write(jsonStr);
          await writable.close();
          fileSaved = true;
        } catch (pickerErr: any) {
          if (pickerErr.name !== 'AbortError') {
            console.warn('File picker error, falling back to download:', pickerErr);
          }
        }
      }

      // Fallback: regular download
      if (!fileSaved) {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultFileName;
        a.click();
        URL.revokeObjectURL(url);
      }

      // Record backup timestamp in localStorage for health indicator
      localStorage.setItem(`controlkit_last_backup_${activeWorkspace.id}`, new Date().toISOString());

      showToast({
        type: 'success',
        title: 'Encrypted Backup Complete',
        message: 'Your backup is encrypted with AES-256-GCM. Keep your passphrase safe!',
      });
      setPassphrase('');
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Test My Backup (Decrypt in memory without importing)
  const handleTestBackup = async () => {
    if (!testBackupFile || !testPassphrase) return;

    setIsProcessing(true);
    setTestReport(null);

    try {
      const text = await testBackupFile.text();
      const pkg = JSON.parse(text);

      const decrypted = await decryptData(pkg, testPassphrase);

      setTestReport({
        valid: true,
        timestamp: decrypted.exportedAt,
        txCount: decrypted.transactions?.length || 0,
        accCount: decrypted.accounts?.length || 0,
        invCount: decrypted.invoices?.length || 0,
        catCount: decrypted.categories?.length || 0,
      });

      showToast({
        type: 'success',
        title: 'Backup Verified',
        message: 'Passphrase verified! All data blocks decrypted cleanly.',
      });
    } catch (err: any) {
      setTestReport({
        valid: false,
        error: 'Incorrect passphrase or corrupted backup file.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-navy-950">Statement Import & Encrypted Backup</h1>
        <p className="text-xs text-navy-500 mt-0.5">
          Import CSV / XLSX statements · WebCrypto AES-256-GCM Backups · Zero Cloud Storage
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-border gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('statement')}
          className={`pb-2.5 transition ${
            activeTab === 'statement' ? 'border-b-2 border-brand-600 text-brand-600 font-bold' : 'text-navy-500 hover:text-navy-800'
          }`}
        >
          Bank & UPI Statement Import
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`pb-2.5 transition ${
            activeTab === 'backup' ? 'border-b-2 border-brand-600 text-brand-600 font-bold' : 'text-navy-500 hover:text-navy-800'
          }`}
        >
          Encrypted Backup & Restore
        </button>
        <button
          onClick={() => setActiveTab('test_backup')}
          className={`pb-2.5 transition ${
            activeTab === 'test_backup' ? 'border-b-2 border-brand-600 text-brand-600 font-bold' : 'text-navy-500 hover:text-navy-800'
          }`}
        >
          Test My Backup
        </button>
        <button
          onClick={() => setActiveTab('migrate')}
          className={`pb-2.5 transition ${
            activeTab === 'migrate' ? 'border-b-2 border-brand-600 text-brand-600 font-bold' : 'text-navy-500 hover:text-navy-800'
          }`}
        >
          Move to New Device
        </button>
      </div>

      {/* TAB 1: Statement Import */}
      {activeTab === 'statement' && (
        <div className="space-y-6">
          <div className="p-6 bg-white rounded-card border border-surface-border shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-navy-950">1. Select Statement File (.csv, .xlsx, .xls)</h3>
                <p className="text-xs text-navy-500">Supports HDFC, ICICI, SBI, Axis, Kotak, PhonePe, GPay, Paytm, Razorpay</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomMode(!isCustomMode)}
                  className="px-2.5 py-1 text-xs font-semibold bg-surface-subtle text-navy-700 hover:bg-surface-border rounded-control transition flex items-center gap-1"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>{isCustomMode ? 'Use Preset Mode' : 'Custom Column Mapper'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!isCustomMode && (
                <div>
                  <label className="block text-xs font-semibold text-navy-700 mb-1">Preset Format</label>
                  <select
                    value={selectedPreset}
                    onChange={(e) => setSelectedPreset(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-surface-subtle border border-surface-border rounded-control"
                  >
                    <optgroup label="Standard Bank & UPI Presets">
                      {Object.values(BANK_PRESETS).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </optgroup>
                    {Object.keys(customPresets).length > 0 && (
                      <optgroup label="Your Custom Presets">
                        {Object.values(customPresets).map((cp) => (
                          <option key={cp.id} value={cp.id}>{cp.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-navy-700 mb-1">Deposit Into Account</label>
                <select
                  value={targetAccountId}
                  onChange={(e) => setTargetAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-surface-border rounded-control"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({formatINR(a.currentBalancePaise)})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* File Picker */}
            <div className="border-2 border-dashed border-surface-border hover:border-brand-500 rounded-control p-6 text-center transition">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleStatementFileChange}
                className="hidden"
                id="statement-file-input"
              />
              <label htmlFor="statement-file-input" className="cursor-pointer block space-y-1">
                <FileSpreadsheet className="h-8 w-8 text-brand-600 mx-auto" />
                <div className="text-xs font-bold text-navy-950">
                  {fileName ? fileName : 'Click to select CSV or Excel (.xlsx / .xls) file'}
                </div>
                <p className="text-[11px] text-navy-500">
                  File is parsed 100% on your device. Zero data is sent to any server.
                </p>
              </label>
            </div>

            {/* Custom Column Mapper Wizard */}
            {isCustomMode && detectedHeaders.length > 0 && (
              <div className="p-4 bg-brand-50/60 border border-brand-200 rounded-control space-y-4">
                <div className="text-xs font-bold text-navy-950">Column Mapping Wizard</div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-navy-700 mb-1">Date Column</label>
                    <select
                      value={mapDateCol}
                      onChange={(e) => setMapDateCol(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-surface-border rounded-control"
                    >
                      {detectedHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-navy-700 mb-1">Description Column</label>
                    <select
                      value={mapDescCol}
                      onChange={(e) => setMapDescCol(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-surface-border rounded-control"
                    >
                      {detectedHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-navy-700 mb-1">Strategy</label>
                    <select
                      value={mapStrategy}
                      onChange={(e) => setMapStrategy(e.target.value as any)}
                      className="w-full px-2 py-1.5 bg-white border border-surface-border rounded-control"
                    >
                      <option value="separate_debit_credit">Separate Debit & Credit Columns</option>
                      <option value="single_signed">Single Signed Amount (+/-)</option>
                      <option value="type_and_amount">Type Column + Amount</option>
                    </select>
                  </div>
                  {mapStrategy === 'separate_debit_credit' ? (
                    <>
                      <div>
                        <label className="block text-[11px] font-semibold text-navy-700 mb-1">Debit Column</label>
                        <select
                          value={mapDebitCol}
                          onChange={(e) => setMapDebitCol(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-surface-border rounded-control"
                        >
                          {detectedHeaders.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-navy-700 mb-1">Credit Column</label>
                        <select
                          value={mapCreditCol}
                          onChange={(e) => setMapCreditCol(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-surface-border rounded-control"
                        >
                          {detectedHeaders.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-semibold text-navy-700 mb-1">Amount Column</label>
                      <select
                        value={mapAmountCol}
                        onChange={(e) => setMapAmountCol(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-surface-border rounded-control"
                      >
                        {detectedHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* 10-Row Sample Preview */}
                <div className="overflow-x-auto max-h-40 border border-surface-border rounded-control bg-white">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-surface-subtle font-semibold">
                      <tr>
                        {detectedHeaders.map((h) => (
                          <th key={h} className="p-1.5 border-b border-surface-border whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sampleRows.map((row, idx) => (
                        <tr key={idx} className="border-b border-surface-border">
                          {detectedHeaders.map((h) => (
                            <td key={h} className="p-1.5 whitespace-nowrap text-navy-700">{row[h] || ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      placeholder="Name this preset (e.g. Canara Bank)"
                      className="px-2.5 py-1 text-xs bg-white border border-surface-border rounded-control"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCustomPreset}
                      disabled={!newPresetName.trim()}
                      className="px-3 py-1 text-xs font-semibold bg-white border border-surface-border hover:bg-surface-base rounded-control disabled:opacity-50"
                    >
                      Save Preset
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyCustomMapping}
                    className="px-4 py-1.5 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-control shadow-xs"
                  >
                    Apply Mapping & Preview
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Duplicate Review Screen */}
          {parsedPreview.length > 0 && (
            <div className="bg-white rounded-card border border-surface-border shadow-xs overflow-hidden space-y-4 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-border pb-3">
                <div>
                  <h3 className="text-sm font-bold text-navy-950">
                    Review Transactions ({parsedPreview.filter((p) => p.selected).length} of {parsedPreview.length} selected)
                  </h3>
                  <p className="text-xs text-navy-500">
                    Entries flagged as potential duplicates are unselected by default for safety.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCommitImport}
                  disabled={parsedPreview.filter((p) => p.selected).length === 0 || isProcessing}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-control transition flex items-center gap-1.5 shadow-sm"
                >
                  <Check className="h-4 w-4" />
                  <span>
                    Commit {parsedPreview.filter((p) => p.selected).length} Entries to {accounts.find((a) => a.id === targetAccountId)?.name}
                  </span>
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-surface-border">
                {parsedPreview.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => toggleSelectEntry(idx)}
                    className={`flex items-center justify-between p-3 cursor-pointer text-xs transition ${
                      item.isPossibleDuplicate
                        ? 'bg-amber-50/70 border-l-4 border-amber-500'
                        : item.selected
                        ? 'hover:bg-surface-subtle'
                        : 'opacity-60 bg-surface-base'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(item.selected)}
                        onChange={() => {}} // handled by parent div
                        className="rounded border-surface-border text-brand-600 focus:ring-0"
                      />
                      <div>
                        <div className="font-semibold text-navy-950 flex items-center gap-2">
                          <span>{item.description}</span>
                          {item.isPossibleDuplicate && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-200 text-amber-900 rounded">
                              POSSIBLE DUPLICATE
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-navy-500 mt-0.5">
                          {item.occurredAt.slice(0, 10)} {item.referenceNumber ? `• Ref: ${item.referenceNumber}` : ''}
                          {item.duplicateReason ? ` • ${item.duplicateReason}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`font-bold ${item.type === 'income' ? 'text-emerald-700' : 'text-navy-950'}`}>
                        {item.type === 'income' ? '+' : '-'}{formatINR(item.amountPaise)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Encrypted Backup & Persistence */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          {/* Storage Persistence Banner */}
          <div className="p-4 bg-brand-50 border border-brand-200 rounded-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <HardDrive className="h-5 w-5 text-brand-600" />
              <div>
                <div className="font-bold text-navy-950">
                  Browser Storage Persistence: {isStoragePersisted ? 'Guaranteed Persistent' : 'Best Effort'}
                </div>
                <p className="text-navy-600 text-[11px]">
                  When persistent, the browser guarantees it will never automatically purge your financial database even under low disk space.
                </p>
              </div>
            </div>

            {!isStoragePersisted && (
              <button
                type="button"
                onClick={requestStoragePersistence}
                className="px-3 py-1.5 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-control shadow-xs"
              >
                Enable Persistent Storage
              </button>
            )}
          </div>

          {/* Export Encrypted Backup */}
          <div className="p-6 bg-white rounded-card border border-surface-border shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-navy-950">Download Encrypted Full Backup (`.ckbackup`)</h3>
            </div>
            <p className="text-xs text-navy-600 leading-relaxed">
              Generates an encrypted package using WebCrypto AES-256-GCM and PBKDF2 (100,000 rounds). Saves directly to your computer using the File System Access API.
            </p>

            <div className="max-w-md space-y-3">
              <div>
                <label className="block text-xs font-semibold text-navy-700 mb-1">Set Backup Passphrase</label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Enter a memorable secret passphrase"
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-surface-border rounded-control focus:outline-hidden"
                />
              </div>

              <button
                type="button"
                onClick={handleExportBackup}
                disabled={isProcessing || passphrase.length < 6}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-control transition flex items-center gap-1.5 shadow-xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Save Encrypted Backup File</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Test My Backup */}
      {activeTab === 'test_backup' && (
        <div className="p-6 bg-white rounded-card border border-surface-border shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-navy-950">Verify & Test a Backup File</h3>
          </div>
          <p className="text-xs text-navy-600">
            Decrypts and inspects a backup file completely in memory to verify passphrase and record integrity without altering your existing database.
          </p>

          <div className="max-w-md space-y-3">
            <div>
              <label className="block text-xs font-semibold text-navy-700 mb-1">Select Backup File</label>
              <input
                type="file"
                accept=".ckbackup,.json"
                onChange={(e) => e.target.files && setTestBackupFile(e.target.files[0])}
                className="w-full text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-700 mb-1">Passphrase</label>
              <input
                type="password"
                value={testPassphrase}
                onChange={(e) => setTestPassphrase(e.target.value)}
                placeholder="Passphrase used when creating backup"
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-surface-border rounded-control"
              />
            </div>

            <button
              type="button"
              onClick={handleTestBackup}
              disabled={isProcessing || !testBackupFile || !testPassphrase}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-control transition"
            >
              Verify Backup Integrity
            </button>
          </div>

          {testReport && (
            <div className={`p-4 rounded-control border text-xs mt-4 ${testReport.valid ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
              {testReport.valid ? (
                <div className="space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-sm">
                    <CheckCircle className="h-4 w-4 text-emerald-700" />
                    <span>Backup Verified 100% Authentic & Intact</span>
                  </div>
                  <div>Exported on: {testReport.timestamp}</div>
                  <div>Records: {testReport.txCount} transactions, {testReport.accCount} accounts, {testReport.invCount} invoices.</div>
                </div>
              ) : (
                <div className="font-bold">{testReport.error}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Move to New Device */}
      {activeTab === 'migrate' && (
        <div className="p-6 bg-white rounded-card border border-surface-border shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-brand-600" />
            <h3 className="text-sm font-bold text-navy-950">Guided Guide: Moving to a New Laptop or Phone</h3>
          </div>

          <div className="space-y-3 text-xs text-navy-700 leading-relaxed">
            <div className="p-3 bg-surface-subtle border border-surface-border rounded-control">
              <span className="font-bold text-navy-950">Step 1: Take an Encrypted Backup on Old Device</span>
              <p className="mt-0.5">Go to "Encrypted Backup" tab above, enter a memorable passphrase, and click Save Encrypted Backup File (`.ckbackup`).</p>
            </div>

            <div className="p-3 bg-surface-subtle border border-surface-border rounded-control">
              <span className="font-bold text-navy-950">Step 2: Transfer the File</span>
              <p className="mt-0.5">Send the `.ckbackup` file to your new device via USB drive, WhatsApp, email, or Google Drive.</p>
            </div>

            <div className="p-3 bg-surface-subtle border border-surface-border rounded-control">
              <span className="font-bold text-navy-950">Step 3: Open ControlKit on New Device & Restore</span>
              <p className="mt-0.5">Open ControlKit in Chrome/Edge/Safari on the new device, open Import & Backup → Restore Backup, and select your file and passphrase.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
