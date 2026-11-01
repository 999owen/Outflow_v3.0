import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { useOutflowStore } from '../../store/useOutflowStore.jsx';
import Card from '../ui/Card.jsx';
import Modal from '../ui/Modal.jsx';
import { parseDate } from '../../store/trackerStore.js';

const SPEND_CATEGORIES = ['Cost', 'Personal Spend'];

const tabVariants = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.2 } },
  exit:    { opacity: 0, x: -12, transition: { duration: 0.15 } },
};

const today = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

export default function EntriesView() {
  const { db, fmt, addEntry, deleteEntry } = useOutflowStore();
  const [tab, setTab] = useState('income'); // 'income' | 'spend'
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ date: today(), amount: '', notes: '', category: 'Cost' });
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const safeDate = (d) => {
    try {
      const parsed = parseDate(d);
      return parsed instanceof Date && !isNaN(parsed.getTime()) ? parsed.getTime() : 0;
    } catch {
      return 0;
    }
  };

  const incomeList = Array.isArray(db?.income_entries) ? db.income_entries : [];
  const spendList = Array.isArray(db?.spend_entries) ? db.spend_entries : [];

  const entries = (tab === 'income' ? incomeList : spendList)
    .slice()
    .sort((a, b) => safeDate(b?.date) - safeDate(a?.date));

  const handleAdd = () => {
    try {
      addEntry?.(tab, form);
      setModal(false);
      setForm({ date: today(), amount: '', notes: '', category: 'Cost' });
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = (id) => {
    setDeletingId(id);
    setTimeout(() => {
      deleteEntry?.(tab, id);
      setDeletingId(null);
    }, 220);
  };

  const formatMoney = (amount) => {
    const num = Number(amount) || 0;
    return fmt?.format ? fmt.format(num) : `$${num.toFixed(2)}`;
  };

  return (
    <div className="p-6 xl:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-main">All Entries</h1>
          <p className="text-text-muted text-sm mt-0.5">Manage your income and spending records.</p>
        </div>
        <button
          onClick={() => { setModal(true); setError(''); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-sm font-semibold hover:bg-accent-blue/20 transition-colors"
        >
          <Plus size={15} />
          Add Entry
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.04] rounded-lg p-1 mb-5 w-fit">
        {['income', 'spend'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="relative px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-150"
            style={{ color: tab === t ? '#f9fafb' : '#6b7280' }}
          >
            {tab === t && (
              <motion.div
                layoutId="entries-tab"
                className="absolute inset-0 bg-white/[0.10] rounded-md"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">
              {t === 'income' ? `Income (${incomeList.length})` : `Spending (${spendList.length})`}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          variants={tabVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <Card>
            {(entries || []).length === 0 ? (
              <p className="text-text-muted text-center py-12 text-sm">No entries yet. Add your first one!</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left text-[10px] uppercase tracking-widest text-text-muted font-semibold px-5 py-3">Date</th>
                      <th className="text-left text-[10px] uppercase tracking-widest text-text-muted font-semibold px-5 py-3">Notes</th>
                      {tab === 'spend' && (
                        <th className="text-left text-[10px] uppercase tracking-widest text-text-muted font-semibold px-5 py-3">Category</th>
                      )}
                      <th className="text-right text-[10px] uppercase tracking-widest text-text-muted font-semibold px-5 py-3">Amount</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {(entries || []).map((entry) => (
                      <motion.tr
                        key={entry?.id || Math.random()}
                        animate={{ opacity: deletingId === entry?.id ? 0 : 1, x: deletingId === entry?.id ? 20 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-b border-white/[0.04] last:border-none hover:bg-white/[0.02] group"
                      >
                        <td className="px-5 py-3.5 text-sm text-text-muted font-mono text-xs">{entry?.date || '—'}</td>
                        <td className="px-5 py-3.5 text-sm text-text-main font-medium">{entry?.notes || '—'}</td>
                        {tab === 'spend' && (
                          <td className="px-5 py-3.5">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.05] text-text-muted">
                              {entry?.category || 'Cost'}
                            </span>
                          </td>
                        )}
                        <td className="px-5 py-3.5 text-right text-sm font-semibold" style={{ color: tab === 'income' ? '#4ADE80' : '#F87171' }}>
                          {formatMoney(entry?.amount)}
                        </td>
                        <td className="px-3 py-3.5">
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-accent-red transition-all p-1 rounded"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Add Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={`Add ${tab === 'income' ? 'Income' : 'Spend'} Entry`}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Date</span>
            <input
              type="date"
              className="input-field"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Amount</span>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="input-field"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Notes</span>
            <input
              type="text"
              placeholder="e.g. Paycheck, Grocery run…"
              className="input-field"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          {tab === 'spend' && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Category</span>
              <select
                className="input-field"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {SPEND_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          )}
          {error && <p className="text-accent-red text-xs">{error}</p>}
          <div className="flex gap-2 mt-1">
            <button onClick={handleAdd} className="btn-primary flex-1">Add Entry</button>
            <button onClick={() => setModal(false)} className="btn-ghost flex-1">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
