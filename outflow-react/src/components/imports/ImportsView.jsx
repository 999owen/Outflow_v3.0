import { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileSpreadsheet,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  HelpCircle,
  X,
  Sparkles,
  Layers,
  ChevronDown,
  Info,
} from 'lucide-react';
import { useOutflowStore } from '../../store/useOutflowStore.jsx';
import Card from '../ui/Card.jsx';
import { processStatementCSV } from '../../utils/csvParser.js';

export default function ImportsView() {
  const { db, fmt, batchAddEntries, exportData, importData, clearAll } = useOutflowStore();

  // Mode: 'csv' (Bank Statement CSV) or 'json' (JSON Backup & Restore)
  const [activeSubTab, setActiveSubTab] = useState('csv');

  // CSV Import State
  const [fileInfo, setFileInfo] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [csvError, setCsvError] = useState('');
  const [importSuccess, setImportSuccess] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Filter & Search in Review Table
  const [filterType, setFilterType] = useState('all'); // 'all' | 'debit' | 'credit' | 'duplicate' | 'skip'
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk / Preset Settings
  const [creditPreset, setCreditPreset] = useState('smart'); // 'smart' | 'all-income' | 'skip-transfers'
  const [debitPreset, setDebitPreset] = useState('smart'); // 'smart' | 'personal' | 'cost'

  // JSON Management State (Redundant from Settings per request)
  const [jsonImportMsg, setJsonImportMsg] = useState('');
  const [clearConfirm, setClearConfirm] = useState(false);
  const jsonFileInputRef = useRef(null);

  // ── Handle CSV File Reading & Parsing ──────────────────────────────────────
  const handleCSVFile = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setCsvError('Please select a valid .csv bank statement file.');
      return;
    }

    setCsvError('');
    setImportSuccess(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = processStatementCSV(text, db);
        setFileInfo({
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          totalRows: parsed.length,
        });
        setTransactions(parsed);
      } catch (err) {
        setCsvError(err.message || 'Could not parse the CSV file.');
      }
    };
    reader.onerror = () => {
      setCsvError('Error reading file from disk.');
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleCSVFile(e.dataTransfer.files[0]);
    }
  };

  const resetCSV = () => {
    setFileInfo(null);
    setTransactions([]);
    setCsvError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Preset Handlers ────────────────────────────────────────────────────────
  const applyCreditPreset = (preset) => {
    setCreditPreset(preset);
    setTransactions((prev) =>
      prev.map((t) => {
        const isCredit = t.rawType?.toLowerCase() === 'credit' || t.amount < 0;
        if (!isCredit) return t;

        const desc = (t.rawDescription || '').toUpperCase();
        if (preset === 'skip-transfers' && (desc.includes('TRANSFER') || desc.includes('SAVINGS'))) {
          return { ...t, targetType: 'skip' };
        }
        if (preset === 'all-income') {
          return { ...t, targetType: 'income', category: 'Income' };
        }
        if (preset === 'smart') {
          if (desc.includes('ADJUSTMENT') || desc.includes('REFUND') || desc.includes('RETURN')) {
            return { ...t, targetType: 'income', category: 'Refund' };
          }
          return { ...t, targetType: 'income', category: 'Income' };
        }
        return t;
      })
    );
  };

  const applyDebitPreset = (preset) => {
    setDebitPreset(preset);
    setTransactions((prev) =>
      prev.map((t) => {
        const isCredit = t.rawType?.toLowerCase() === 'credit' || t.amount < 0;
        if (isCredit) return t;

        if (preset === 'personal') {
          return { ...t, targetType: 'spend', category: 'Personal Spend' };
        }
        if (preset === 'cost') {
          return { ...t, targetType: 'spend', category: 'Cost' };
        }
        if (preset === 'smart') {
          const desc = (t.rawDescription || '').toUpperCase();
          if (['WALMART', 'GROCERY', 'ALDI', 'KROGER', 'SUPERCENTER'].some((k) => desc.includes(k))) {
            return { ...t, targetType: 'grocery', category: 'Groceries' };
          }
          if (['RENT', 'ELECTRIC', 'WATER', 'INSURANCE', 'INTERNET', 'LOAN'].some((k) => desc.includes(k))) {
            return { ...t, targetType: 'spend', category: 'Cost' };
          }
          return { ...t, targetType: 'spend', category: 'Personal Spend' };
        }
        return t;
      })
    );
  };

  // Bulk duplicate handlers
  const handleBulkDuplicates = (resolution) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (!t.isDuplicate) return t;
        return {
          ...t,
          duplicateResolution: resolution,
          targetType: resolution === 'skip' ? 'skip' : (t.originalTargetType || 'spend'),
          category: resolution === 'skip' ? t.category : (t.originalCategory || t.category || 'Personal Spend'),
        };
      })
    );
  };

  const setRowDuplicateChoice = (id, choice) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          duplicateResolution: choice,
          targetType: choice === 'skip' ? 'skip' : (t.originalTargetType || 'spend'),
          category: choice === 'skip' ? t.category : (t.originalCategory || t.category || 'Personal Spend'),
        };
      })
    );
  };

  // ── Row-level Updates ──────────────────────────────────────────────────────
  const updateTransaction = (id, field, value) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, [field]: value };

        // Handle target type / category sync
        if (field === 'targetType') {
          if (value === 'grocery') updated.category = 'Groceries';
          else if (value === 'spend' && !['Cost', 'Personal Spend'].includes(updated.category)) {
            updated.category = 'Personal Spend';
          } else if (value === 'income' && !['Income', 'Refund'].includes(updated.category)) {
            updated.category = 'Income';
          }
        }
        return updated;
      })
    );
  };

  // ── Final Commit ───────────────────────────────────────────────────────────
  const handleCommitImport = () => {
    const toImport = transactions.filter((t) => t.targetType !== 'skip');
    if (toImport.length === 0) {
      setCsvError('No transactions are selected for import (all marked as Skip).');
      return;
    }

    try {
      const result = batchAddEntries(toImport);
      const counts = {
        spendCost: toImport.filter((t) => t.targetType === 'spend' && t.category === 'Cost').length,
        spendPersonal: toImport.filter((t) => t.targetType === 'spend' && t.category === 'Personal Spend').length,
        grocery: toImport.filter((t) => t.targetType === 'grocery').length,
        income: toImport.filter((t) => t.targetType === 'income').length,
        skipped: transactions.length - toImport.length,
      };

      setImportSuccess({
        total: toImport.length,
        counts,
      });

      // Clear memory of the raw CSV and working transaction list for privacy & hygiene
      resetCSV();
    } catch (err) {
      setCsvError(err.message || 'Failed to complete import.');
    }
  };

  // ── Filtering & Computed Stats ─────────────────────────────────────────────
  const duplicateCount = useMemo(() => transactions.filter((t) => t.isDuplicate).length, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Filter Type
      if (filterType === 'debit' && (t.rawType?.toLowerCase() === 'credit' || t.amount < 0)) return false;
      if (filterType === 'credit' && t.rawType?.toLowerCase() !== 'credit' && t.amount >= 0) return false;
      if (filterType === 'duplicate' && !t.isDuplicate) return false;
      if (filterType === 'skip' && t.targetType !== 'skip') return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNote = (t.notes || '').toLowerCase().includes(q);
        const matchRaw = (t.rawDescription || '').toLowerCase().includes(q);
        const matchDate = (t.date || '').includes(q);
        const matchAmt = String(t.amount).includes(q);
        if (!matchNote && !matchRaw && !matchDate && !matchAmt) return false;
      }

      return true;
    });
  }, [transactions, filterType, searchQuery]);

  const summaryToImport = useMemo(() => {
    const active = transactions.filter((t) => t.targetType !== 'skip');
    return {
      total: active.length,
      cost: active.filter((t) => t.targetType === 'spend' && t.category === 'Cost').length,
      personal: active.filter((t) => t.targetType === 'spend' && t.category === 'Personal Spend').length,
      grocery: active.filter((t) => t.targetType === 'grocery').length,
      income: active.filter((t) => t.targetType === 'income').length,
      skipped: transactions.length - active.length,
    };
  }, [transactions]);

  // ── JSON Management Handlers ───────────────────────────────────────────────
  const handleJSONImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const result = importData(ev.target.result);
        setJsonImportMsg(
          `✓ Imported ${result.imported} entries${result.skipped > 0 ? `, skipped ${result.skipped}` : ''}.`
        );
      } catch (err) {
        setJsonImportMsg('✗ ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleJSONClear = () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      return;
    }
    clearAll();
    setClearConfirm(false);
  };

  return (
    <div className="p-6 xl:p-8 max-w-6xl">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2.5">
            <FileSpreadsheet className="text-accent-blue" size={26} />
            Import Data
          </h1>
          <p className="text-text-muted text-sm mt-0.5">
            Import bank statement CSV transactions with guided classification or manage your JSON backups.
          </p>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex gap-1 bg-white/[0.04] p-1 rounded-lg border border-white/[0.06] shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('csv')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeSubTab === 'csv'
                ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            Bank Statement (.csv)
          </button>
          <button
            onClick={() => setActiveSubTab('json')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeSubTab === 'json'
                ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            JSON Backup & Restore
          </button>
        </div>
      </div>

      {/* ── SUB-TAB 1: CSV BANK STATEMENT IMPORT ───────────────────────────── */}
      {activeSubTab === 'csv' && (
        <div className="space-y-6">
          {/* Success Banner */}
          <AnimatePresence>
            {importSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 rounded-xl bg-accent-green/10 border border-accent-green/30 text-accent-green flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm">
                      Successfully imported {importSuccess.total} transactions!
                    </h3>
                    <p className="text-xs text-text-muted mt-1">
                      Added additively: {importSuccess.counts.spendCost} Cost,{' '}
                      {importSuccess.counts.spendPersonal} Personal Spend,{' '}
                      {importSuccess.counts.grocery} Groceries, {importSuccess.counts.income} Income. All data
                      persisted to local storage and synced with Gist.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setImportSuccess(null)}
                  className="text-text-muted hover:text-text-main text-xs"
                >
                  <X size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Banner */}
          {csvError && (
            <div className="p-4 rounded-xl bg-accent-red/10 border border-accent-red/30 text-accent-red flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} />
                <span>{csvError}</span>
              </div>
              <button onClick={() => setCsvError('')} className="text-accent-red hover:underline text-xs">
                Dismiss
              </button>
            </div>
          )}

          {/* Upload Dropzone (When no file active) */}
          {transactions.length === 0 ? (
            <Card className="p-8">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-accent-blue bg-accent-blue/[0.08] scale-[1.01]'
                    : 'border-white/[0.12] hover:border-white/[0.25] hover:bg-white/[0.02]'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center text-accent-blue mb-4 shadow-lg shadow-accent-blue/5">
                  <Upload size={24} />
                </div>
                <h3 className="text-base font-semibold text-text-main">
                  Drop your bank statement (.csv) here
                </h3>
                <p className="text-xs text-text-muted mt-1.5 max-w-md">
                  Supports Capital One checking & debit statements, as well as CSV exports from major banks.
                  We&apos;ll guide you through classifying expenses, handling deposits vs refunds, and reviewing
                  duplicates.
                </p>

                <div className="mt-5 flex items-center gap-2">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg bg-accent-blue text-bg-outer font-semibold text-xs hover:bg-accent-blue/90 transition-colors shadow-sm"
                  >
                    Browse CSV File
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => handleCSVFile(e.target.files[0])}
                />
              </div>

              {/* Privacy Guarantee */}
              <div className="mt-6 flex items-start gap-3 p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                <ShieldCheck size={18} className="text-accent-green shrink-0 mt-0.5" />
                <div className="text-xs text-text-muted">
                  <span className="font-semibold text-text-main">100% Private & Client-Side: </span>
                  Your CSV is parsed entirely in your browser. Sensitive account numbers and account balances are
                  discarded immediately. Approved transactions are stored only in your local JSON storage and
                  synced directly to your private GitHub Gist.
                </div>
              </div>
            </Card>
          ) : (
            /* Review & Guided Classification Interface */
            <div className="space-y-6">
              {/* File Info & Reset Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent-blue/15 text-accent-blue flex items-center justify-center font-bold">
                    <FileSpreadsheet size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-main">{fileInfo?.name}</h3>
                    <p className="text-xs text-text-muted">
                      {fileInfo?.totalRows} transactions parsed • {fileInfo?.size}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={resetCSV}
                    className="px-3 py-1.5 rounded-lg border border-white/[0.1] text-xs text-text-muted hover:text-text-main hover:bg-white/[0.04] transition-colors"
                  >
                    Choose Different File
                  </button>
                </div>
              </div>

              {/* ── Guided Setup & Questions Card ────────────────────────────── */}
              <Card className="p-5 border-accent-blue/20 bg-gradient-to-br from-bg-inner to-accent-blue/[0.03]">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={16} className="text-accent-blue" />
                  <h2 className="text-sm font-bold text-text-main uppercase tracking-wider">
                    Interactive Import Setup
                  </h2>
                </div>
                <p className="text-xs text-text-muted mb-4">
                  Configure default handling for this statement. You can always change individual items in the table below.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  {/* Question 1: Positive Transactions (Credits) */}
                  <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-text-main flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-accent-green/20 text-accent-green flex items-center justify-center text-[10px] font-bold">
                          +
                        </span>
                        Deposits & Credits
                      </span>
                    </div>
                    <p className="text-text-muted mb-2 text-[11px]">
                      How should positive inflows and refunds be handled?
                    </p>
                    <select
                      value={creditPreset}
                      onChange={(e) => applyCreditPreset(e.target.value)}
                      className="w-full bg-bg-outer border border-white/[0.1] rounded-md px-2.5 py-1.5 text-xs text-text-main focus:outline-none focus:border-accent-blue"
                    >
                      <option value="smart">Smart: Detect Deposits vs Refunds</option>
                      <option value="all-income">Mark All Credits as Income</option>
                      <option value="skip-transfers">Skip Internal Savings Transfers</option>
                    </select>
                  </div>

                  {/* Question 2: Debits & Expenses */}
                  <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-text-main flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-accent-red/20 text-accent-red flex items-center justify-center text-[10px] font-bold">
                          -
                        </span>
                        Debits & Outflows
                      </span>
                    </div>
                    <p className="text-text-muted mb-2 text-[11px]">
                      Default classification for your purchases:
                    </p>
                    <select
                      value={debitPreset}
                      onChange={(e) => applyDebitPreset(e.target.value)}
                      className="w-full bg-bg-outer border border-white/[0.1] rounded-md px-2.5 py-1.5 text-xs text-text-main focus:outline-none focus:border-accent-blue"
                    >
                      <option value="smart">Smart Categorization (Groceries / Cost / Spend)</option>
                      <option value="personal">Default all to Personal Spend</option>
                      <option value="cost">Default all to Fixed Cost</option>
                    </select>
                  </div>

                  {/* Question 3: Duplicate Resolution */}
                  <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-text-main flex items-center gap-1.5">
                        <AlertTriangle
                          size={13}
                          className={duplicateCount > 0 ? 'text-amber-400' : 'text-text-muted'}
                        />
                        Duplicates ({duplicateCount})
                      </span>
                    </div>
                    <p className="text-text-muted mb-2 text-[11px]">
                      {duplicateCount > 0
                        ? `${duplicateCount} potential duplicate(s) flagged.`
                        : 'No potential duplicates detected.'}
                    </p>
                    {duplicateCount > 0 ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleBulkDuplicates('skip')}
                          className="flex-1 px-2 py-1.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-amber-300 border border-amber-400/30 text-[11px] font-medium"
                        >
                          Skip All
                        </button>
                        <button
                          onClick={() => handleBulkDuplicates('keep')}
                          className="flex-1 px-2 py-1.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-text-muted hover:text-text-main border border-white/[0.1] text-[11px] font-medium"
                        >
                          Keep All
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-accent-green font-medium py-1">
                        ✓ All entries appear unique
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* ── Table Filter & Search Controls ────────────────────────── */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Filter Pills */}
                <div className="flex flex-wrap gap-1.5 bg-white/[0.03] p-1 rounded-lg border border-white/[0.05]">
                  {[
                    { id: 'all', label: `All (${transactions.length})` },
                    {
                      id: 'debit',
                      label: `Debits (${transactions.filter((t) => t.rawType?.toLowerCase() !== 'credit' && t.amount >= 0).length})`,
                    },
                    {
                      id: 'credit',
                      label: `Credits (${transactions.filter((t) => t.rawType?.toLowerCase() === 'credit' || t.amount < 0).length})`,
                    },
                    {
                      id: 'duplicate',
                      label: `Flagged (${duplicateCount})`,
                      highlight: duplicateCount > 0,
                    },
                    {
                      id: 'skip',
                      label: `Skipped (${transactions.filter((t) => t.targetType === 'skip').length})`,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setFilterType(tab.id)}
                      className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                        filterType === tab.id
                          ? 'bg-white/[0.1] text-text-main shadow-sm'
                          : tab.highlight
                          ? 'text-amber-400 hover:bg-amber-400/10'
                          : 'text-text-muted hover:text-text-main'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-60">
                  <Search size={14} className="absolute left-3 top-2.5 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Search payee or note..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/[0.03] border border-white/[0.08] rounded-lg text-text-main placeholder-text-muted focus:outline-none focus:border-accent-blue"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-text-muted hover:text-text-main"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* ── Transaction Review Table ───────────────────────────────── */}
              <Card className="overflow-hidden">
                <div className="overflow-x-auto max-h-[520px]">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-bg-inner/95 backdrop-blur z-10 border-b border-white/[0.06]">
                      <tr className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Payee / Notes</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3">Classification</th>
                        <th className="px-4 py-3 text-center">Duplicate Check</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04] text-xs">
                      {filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-text-muted text-xs">
                            No transactions match this filter.
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map((tx) => {
                          const isCredit = tx.rawType?.toLowerCase() === 'credit' || tx.amount < 0;
                          const isSkipped = tx.targetType === 'skip';

                          return (
                            <tr
                              key={tx.id}
                              className={`transition-colors ${
                                tx.isDuplicate
                                  ? 'bg-amber-500/[0.04] hover:bg-amber-500/[0.07]'
                                  : isSkipped
                                  ? 'opacity-50 bg-black/10 hover:bg-white/[0.01]'
                                  : 'hover:bg-white/[0.02]'
                              }`}
                            >
                              {/* Date */}
                              <td className="px-4 py-3 font-mono text-[11px] text-text-muted whitespace-nowrap">
                                <input
                                  type="date"
                                  value={tx.date}
                                  onChange={(e) => updateTransaction(tx.id, 'date', e.target.value)}
                                  className="bg-transparent border border-transparent hover:border-white/[0.1] rounded px-1.5 py-0.5 text-text-muted focus:text-text-main focus:bg-bg-outer focus:outline-none"
                                />
                              </td>

                              {/* Payee / Notes */}
                              <td className="px-4 py-3 max-w-xs">
                                <input
                                  type="text"
                                  value={tx.notes}
                                  onChange={(e) => updateTransaction(tx.id, 'notes', e.target.value)}
                                  className="w-full bg-transparent border border-transparent hover:border-white/[0.1] rounded px-1.5 py-0.5 font-medium text-text-main focus:bg-bg-outer focus:border-accent-blue focus:outline-none truncate"
                                  title={tx.rawDescription}
                                />
                                <div className="text-[10px] text-text-muted truncate px-1.5 mt-0.5" title={tx.rawDescription}>
                                  {tx.rawDescription}
                                </div>
                              </td>

                              {/* Amount */}
                              <td className="px-4 py-3 text-right font-semibold whitespace-nowrap font-mono text-xs">
                                <span style={{ color: isCredit ? '#4ADE80' : '#F87171' }}>
                                  {isCredit ? '+' : '-'}
                                  {fmt.format(tx.amount)}
                                </span>
                              </td>

                              {/* Classification Dropdown */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <select
                                  value={
                                    tx.targetType === 'skip'
                                      ? 'skip'
                                      : tx.targetType === 'grocery'
                                      ? 'grocery'
                                      : `${tx.targetType}:${tx.category}`
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === 'skip') {
                                      updateTransaction(tx.id, 'targetType', 'skip');
                                    } else if (val === 'grocery') {
                                      updateTransaction(tx.id, 'targetType', 'grocery');
                                    } else {
                                      const [tgt, cat] = val.split(':');
                                      setTransactions((prev) =>
                                        prev.map((t) =>
                                          t.id === tx.id
                                            ? { ...t, targetType: tgt, category: cat }
                                            : t
                                        )
                                      );
                                    }
                                  }}
                                  className="bg-white/[0.04] border border-white/[0.08] rounded-md px-2 py-1 text-xs text-text-main focus:outline-none focus:border-accent-blue"
                                >
                                  <optgroup label="Spending & Expenses">
                                    <option value="spend:Personal Spend">Personal Spend</option>
                                    <option value="spend:Cost">Cost (Fixed / Essential)</option>
                                    <option value="grocery">Groceries</option>
                                  </optgroup>
                                  <optgroup label="Income & Inflows">
                                    <option value="income:Income">Income (Deposit)</option>
                                    <option value="income:Refund">Refund / Offset</option>
                                  </optgroup>
                                  <optgroup label="Actions">
                                    <option value="skip">Skip / Do Not Import</option>
                                  </optgroup>
                                </select>
                              </td>

                              {/* Duplicate Verification Prompt */}
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                {tx.isDuplicate ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <div className="flex items-center gap-1 bg-white/[0.04] p-0.5 rounded-md border border-white/[0.08]">
                                      <button
                                        type="button"
                                        onClick={() => setRowDuplicateChoice(tx.id, 'skip')}
                                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                          tx.duplicateResolution === 'skip'
                                            ? 'bg-amber-400 text-bg-outer shadow-sm'
                                            : 'text-text-muted hover:text-text-main'
                                        }`}
                                      >
                                        Skip Duplicate
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setRowDuplicateChoice(tx.id, 'keep')}
                                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                          tx.duplicateResolution === 'keep'
                                            ? 'bg-accent-green text-bg-outer shadow-sm'
                                            : 'text-text-muted hover:text-text-main'
                                        }`}
                                      >
                                        Keep (Bought Twice)
                                      </button>
                                    </div>
                                    <div className="text-[10px] text-amber-300/80 max-w-[200px] truncate" title={tx.duplicateReason}>
                                      ⚠️ {tx.duplicateReason}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-accent-green/80 font-medium">✓ Unique</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* ── Summary & Commit Action Footer ─────────────────────────── */}
              <Card className="p-5 flex flex-col md:flex-row items-center justify-between gap-4 border-white/[0.08] bg-bg-inner">
                <div className="text-xs text-text-muted flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-semibold text-text-main">
                    Ready to import {summaryToImport.total} entries:
                  </span>
                  <span>💼 {summaryToImport.cost} Cost</span>
                  <span>💳 {summaryToImport.personal} Personal Spend</span>
                  <span>🛒 {summaryToImport.grocery} Groceries</span>
                  <span>💰 {summaryToImport.income} Income</span>
                  {summaryToImport.skipped > 0 && (
                    <span className="text-text-muted/60">({summaryToImport.skipped} skipped)</span>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
                  <button
                    onClick={resetCSV}
                    className="flex-1 md:flex-none px-4 py-2 rounded-lg border border-white/[0.1] text-xs font-medium text-text-muted hover:text-text-main transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCommitImport}
                    disabled={summaryToImport.total === 0}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-md ${
                      summaryToImport.total > 0
                        ? 'bg-accent-blue text-bg-outer hover:bg-accent-blue/90 shadow-accent-blue/10'
                        : 'bg-white/[0.05] text-text-muted cursor-not-allowed border border-white/[0.05]'
                    }`}
                  >
                    Confirm & Add {summaryToImport.total} Transactions
                    <ArrowRight size={14} />
                  </button>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ── SUB-TAB 2: JSON BACKUP & RESTORE (Also present in Settings) ─────── */}
      {activeSubTab === 'json' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <Download size={18} className="text-accent-blue" />
              <h2 className="text-base font-semibold text-text-main">JSON Data Backup & Restore</h2>
            </div>
            <p className="text-xs text-text-muted mb-6">
              Export your full Outflow database as an offline backup file, or restore data from a previous .json export.
              Importing JSON is additive and will not overwrite non-conflicting entries.
            </p>

            {jsonImportMsg && (
              <p
                className={`text-xs mb-4 p-2.5 rounded-lg border ${
                  jsonImportMsg.startsWith('✓')
                    ? 'bg-accent-green/10 border-accent-green/30 text-accent-green'
                    : 'bg-accent-red/10 border-accent-red/30 text-accent-red'
                }`}
              >
                {jsonImportMsg}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={exportData}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-text-muted text-sm font-medium hover:bg-white/[0.08] hover:text-text-main transition-colors"
              >
                <Download size={14} />
                Export JSON Backup
              </button>

              <button
                onClick={() => jsonFileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-text-muted text-sm font-medium hover:bg-white/[0.08] hover:text-text-main transition-colors"
              >
                <Upload size={14} />
                Import JSON Backup
              </button>
              <input
                ref={jsonFileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleJSONImport}
              />

              <button
                onClick={handleJSONClear}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  clearConfirm
                    ? 'bg-accent-red/20 border-accent-red/40 text-accent-red'
                    : 'bg-white/[0.04] border-white/[0.08] text-text-muted hover:bg-accent-red/10 hover:border-accent-red/30 hover:text-accent-red'
                }`}
              >
                <Trash2 size={14} />
                {clearConfirm ? 'Confirm Clear All Data' : 'Clear All Data'}
              </button>
              {clearConfirm && (
                <button
                  onClick={() => setClearConfirm(false)}
                  className="text-xs text-text-muted underline self-center"
                >
                  Cancel
                </button>
              )}
            </div>
          </Card>

          {/* Current Database Summary */}
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-text-main mb-4">Current Database Entries</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Income entries', val: db?.income_entries?.length || 0 },
                { label: 'Spend entries', val: db?.spend_entries?.length || 0 },
                { label: 'Grocery entries', val: db?.grocery_entries?.length || 0 },
                { label: 'Recurring bills', val: db?.recurring_bills?.length || 0 },
              ].map(({ label, val }) => (
                <div key={label} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
                  <p className="text-xl font-bold text-text-main">{val}</p>
                  <p className="text-xs text-text-muted mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            {db?.last_updated && (
              <p className="text-xs text-text-muted mt-4">
                Last synchronized: {new Date(db.last_updated).toLocaleString()}
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
