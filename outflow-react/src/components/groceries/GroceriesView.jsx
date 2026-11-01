import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { useOutflowStore } from '../../store/useOutflowStore.jsx';
import Card from '../ui/Card.jsx';
import Modal from '../ui/Modal.jsx';
import { parseDate } from '../../store/trackerStore.js';

const today = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

export default function GroceriesView() {
  const { db, fmt, totals, addEntry, deleteEntry, groceryByWeek, groceryThisWeek } = useOutflowStore();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ date: today(), amount: '', notes: '' });
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

  const rawGroceries = Array.isArray(db?.grocery_entries) ? db.grocery_entries : [];
  const entries = [...rawGroceries].sort((a, b) => safeDate(b?.date) - safeDate(a?.date));
  const weeks = typeof groceryByWeek === 'function' ? (groceryByWeek(8) || []) : [];
  const thisWeek = typeof groceryThisWeek === 'function' ? (groceryThisWeek() || 0) : 0;
  const groceryLeft = totals?.groceryLeft ?? 0;
  const groceryThisMonth = totals?.groceryThisMonth ?? 0;
  const limit = db?.settings?.monthly_grocery_limit ?? 280;
  const monthlyPct = limit > 0 ? Math.min((groceryThisMonth / limit) * 100, 100) : 0;
  const isOver = groceryLeft < 0;

  const formatMoney = (amount) => {
    const num = Number(amount) || 0;
    return fmt?.format ? fmt.format(num) : `$${num.toFixed(2)}`;
  };

  const handleAdd = () => {
    try {
      addEntry?.('grocery', { ...form, category: 'Groceries' });
      setModal(false);
      setForm({ date: today(), amount: '', notes: '' });
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = (id) => {
    setDeletingId(id);
    setTimeout(() => { deleteEntry?.('grocery', id); setDeletingId(null); }, 220);
  };

  const weekMax = Math.max(...weeks.map((w) => Number(w?.total) || 0), 1);

  return (
    <div className="p-6 xl:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Groceries</h1>
          <p className="text-text-muted text-sm mt-0.5">
            Monthly limit: <span className="text-text-main font-semibold">{formatMoney(limit)}</span>
          </p>
        </div>
        <button
          onClick={() => { setModal(true); setError(''); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-sm font-semibold hover:bg-accent-blue/20 transition-colors"
        >
          <Plus size={15} />
          Add Grocery
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* Left — entries table */}
        <div className="flex flex-col gap-5">
          <Card>
            {(entries || []).length === 0 ? (
              <p className="text-text-muted text-center py-12 text-sm">No grocery entries yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left text-[10px] uppercase tracking-widest text-text-muted font-semibold px-5 py-3">Date</th>
                      <th className="text-left text-[10px] uppercase tracking-widest text-text-muted font-semibold px-5 py-3">Notes</th>
                      <th className="text-right text-[10px] uppercase tracking-widest text-text-muted font-semibold px-5 py-3">Amount</th>
                      <th className="px-3" />
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
                        <td className="px-5 py-3.5 text-xs text-text-muted font-mono">{entry?.date || '—'}</td>
                        <td className="px-5 py-3.5 text-sm text-text-main font-medium">{entry?.notes || '—'}</td>
                        <td className="px-5 py-3.5 text-right text-sm font-semibold text-accent-yellow">{formatMoney(entry?.amount)}</td>
                        <td className="px-3 py-3.5">
                          <button
                            onClick={() => handleDelete(entry?.id)}
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
        </div>

        {/* Right — monitor */}
        <div className="flex flex-col gap-4">
          {/* Monthly status */}
          <Card className="p-5">
            <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-3">Monthly Status</p>
            <div className="mb-1">
              <span className="text-2xl font-bold" style={{ color: isOver ? '#F87171' : '#FBBF24' }}>
                {formatMoney(Math.abs(groceryLeft))}
              </span>
              <span className="text-text-muted text-sm ml-1.5">
                {isOver ? 'over limit' : 'remaining'}
              </span>
            </div>
            <p className="text-xs text-text-muted mb-3">{formatMoney(groceryThisMonth)} used of {formatMoney(limit)}</p>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: monthlyPct + '%',
                  background: monthlyPct < 70 ? '#4ADE80' : monthlyPct < 90 ? '#FBBF24' : '#F87171',
                }}
              />
            </div>
            <div className="mt-3 pt-3 border-t border-white/[0.06] flex justify-between text-xs">
              <span className="text-text-muted">This week</span>
              <span className="text-accent-yellow font-semibold">{formatMoney(thisWeek)}</span>
            </div>
          </Card>

          {/* Weekly chart */}
          <Card className="p-5">
            <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-4">Weekly History</p>
            <div className="grid grid-cols-4 gap-1.5">
              {(weeks || []).slice(-4).map((w, idx) => {
                const totalVal = Number(w?.total) || 0;
                const h = Math.max((totalVal / weekMax) * 80, 4);
                const isThisWeek = w?.label === 'This Week';
                return (
                  <div key={w?.key || idx} className="flex flex-col items-center gap-1">
                    <div className="flex items-end h-20 w-full justify-center">
                      <div
                        className="w-full rounded-t transition-all duration-500"
                        style={{
                          height: h + 'px',
                          background: isThisWeek ? '#FBBF24' : 'rgba(251,191,36,0.25)',
                        }}
                      />
                    </div>
                    <span className="text-[9px] text-text-muted text-center">{w?.label || '—'}</span>
                    <span className="text-[9px] text-text-muted">{formatMoney(totalVal)}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Add Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Add Grocery Entry">
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
            <span className="text-xs text-text-muted">Notes (optional)</span>
            <input
              type="text"
              placeholder="e.g. Whole Foods, Trader Joe's…"
              className="input-field"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          {error && <p className="text-accent-red text-xs">{error}</p>}
          <div className="flex gap-2 mt-1">
            <button onClick={handleAdd} className="btn-primary flex-1">Add Grocery</button>
            <button onClick={() => setModal(false)} className="btn-ghost flex-1">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
