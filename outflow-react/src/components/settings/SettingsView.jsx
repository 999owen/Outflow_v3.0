import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Upload, Trash2, RefreshCw, Save, Github } from 'lucide-react';
import { useOutflowStore } from '../../store/useOutflowStore.jsx';
import Card from '../ui/Card.jsx';
import { SUPPORTED_CURRENCIES } from '../../store/trackerStore.js';

export default function SettingsView() {
  const { db, updateSetting, clearAll, exportData, importData, syncNow, syncStatus } = useOutflowStore();
  const settings = db?.settings || {};

  const [spendPct, setSpendPct] = useState(String(settings.spending_percentage ?? 35));
  const [groceryLimit, setGroceryLimit] = useState(String(settings.monthly_grocery_limit ?? 280));
  const [token, setToken] = useState(settings.github_token || '');
  const [gistId, setGistId] = useState(settings.gist_id || '');
  const [importMsg, setImportMsg] = useState('');
  const [clearConfirm, setClearConfirm] = useState(false);
  const fileRef = useRef(null);

  const saveSpendPct = () => {
    const v = parseFloat(spendPct);
    if (isFinite(v) && v >= 1 && v <= 100) updateSetting('spending_percentage', v);
  };

  const saveGroceryLimit = () => {
    const v = parseFloat(groceryLimit);
    if (isFinite(v) && v > 0) updateSetting('monthly_grocery_limit', v);
  };

  const saveToken = () => {
    updateSetting('github_token', token.trim());
  };

  const saveGistId = () => {
    updateSetting('gist_id', gistId.trim());
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const result = importData(ev.target.result);
        setImportMsg(`✓ Imported ${result.imported} entries${result.skipped > 0 ? `, skipped ${result.skipped}` : ''}.`);
      } catch (err) {
        setImportMsg('✗ ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClear = () => {
    if (!clearConfirm) { setClearConfirm(true); return; }
    clearAll();
    setClearConfirm(false);
  };

  return (
    <div className="p-6 xl:p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-main">Settings</h1>
        <p className="text-text-muted text-sm mt-0.5">Configure your spending rules and sync preferences.</p>
      </div>

      {/* ── Spending Rules ─────────────────────────────────────────────── */}
      <Section title="Spending Rules">
        <SettingRow
          label="Spending Allowance %"
          description="Percentage of total income allocated for discretionary spending."
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="100"
              className="input-field w-24"
              value={spendPct}
              onChange={(e) => setSpendPct(e.target.value)}
              onBlur={saveSpendPct}
            />
            <span className="text-text-muted text-sm">%</span>
          </div>
        </SettingRow>

        <SettingRow
          label="Monthly Grocery Limit"
          description="Maximum grocery spend tracked per month."
        >
          <input
            type="number"
            step="0.01"
            min="0"
            className="input-field w-32"
            value={groceryLimit}
            onChange={(e) => setGroceryLimit(e.target.value)}
            onBlur={saveGroceryLimit}
          />
        </SettingRow>

        <SettingRow
          label="Currency"
          description="Display currency for all monetary values."
        >
          <select
            className="input-field w-28"
            value={settings.currency}
            onChange={(e) => updateSetting('currency', e.target.value)}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </SettingRow>
      </Section>

      {/* ── GitHub Gist Sync ───────────────────────────────────────────── */}
      <Section title="GitHub Gist Sync" icon={<Github size={14} className="text-text-muted" />}>
        <SettingRow
          label="GitHub Token"
          description="Personal access token with gist scope. Stored locally only."
        >
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="ghp_..."
              className="input-field w-48"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <button onClick={saveToken} className="btn-ghost px-3 py-2 text-xs">
              <Save size={12} />
            </button>
          </div>
        </SettingRow>

        <SettingRow
          label="Gist ID"
          description="Leave blank to auto-create a new Gist on first sync."
        >
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="abc123..."
              className="input-field w-48"
              value={gistId}
              onChange={(e) => setGistId(e.target.value)}
            />
            <button onClick={saveGistId} className="btn-ghost px-3 py-2 text-xs">
              <Save size={12} />
            </button>
          </div>
        </SettingRow>

        <div className="pt-2">
          <button
            onClick={syncNow}
            disabled={!settings.github_token}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-sm font-semibold hover:bg-accent-blue/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw size={13} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
            {syncStatus === 'syncing' ? 'Syncing…' :
             syncStatus === 'synced'  ? 'Synced ✓' : 'Sync Now'}
          </button>
        </div>
      </Section>

      {/* ── Data Management ────────────────────────────────────────────── */}
      <Section title="Data Management">
        {importMsg && (
          <p className={`text-xs mb-3 ${importMsg.startsWith('✓') ? 'text-accent-green' : 'text-accent-red'}`}>
            {importMsg}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportData}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-text-muted text-sm font-medium hover:bg-white/[0.08] hover:text-text-main transition-colors"
          >
            <Download size={13} />
            Export Backup
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-text-muted text-sm font-medium hover:bg-white/[0.08] hover:text-text-main transition-colors"
          >
            <Upload size={13} />
            Import JSON
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

          <button
            onClick={handleClear}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              clearConfirm
                ? 'bg-accent-red/20 border-accent-red/40 text-accent-red'
                : 'bg-white/[0.04] border-white/[0.08] text-text-muted hover:bg-accent-red/10 hover:border-accent-red/30 hover:text-accent-red'
            }`}
          >
            <Trash2 size={13} />
            {clearConfirm ? 'Confirm Clear All Data' : 'Clear All Data'}
          </button>
          {clearConfirm && (
            <button
              onClick={() => setClearConfirm(false)}
              className="text-xs text-text-muted underline"
            >
              cancel
            </button>
          )}
        </div>
      </Section>

      {/* Stats */}
      <Section title="Data Stats">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Income entries', val: db?.income_entries?.length || 0 },
            { label: 'Spend entries', val: db?.spend_entries?.length || 0 },
            { label: 'Grocery entries', val: db?.grocery_entries?.length || 0 },
            { label: 'Bills', val: db?.recurring_bills?.length || 0 },
          ].map(({ label, val }) => (
            <div key={label} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
              <p className="text-xl font-bold text-text-main">{val}</p>
              <p className="text-xs text-text-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        {db?.last_updated && (
          <p className="text-xs text-text-muted mt-3">
            Last saved: {new Date(db.last_updated).toLocaleString()}
          </p>
        )}
      </Section>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-sm font-semibold text-text-main">{title}</h2>
      </div>
      <Card className="p-5 flex flex-col gap-4">
        {children}
      </Card>
    </div>
  );
}

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-text-main">{label}</p>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
