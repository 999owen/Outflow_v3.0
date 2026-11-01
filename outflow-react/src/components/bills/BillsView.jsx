import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { useOutflowStore } from '../../store/useOutflowStore.jsx';
import Card from '../ui/Card.jsx';
import Modal from '../ui/Modal.jsx';

const today = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

const EMPTY_FORM = {
  name: '', type: 'fixed', amount: '', dueDay: '1', isAutoPaid: false, isActive: true,
};

export default function BillsView() {
  const { db, fmt, addBill, updateBill, deleteBill } = useOutflowStore();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const rawBills = Array.isArray(db?.recurring_bills) ? db.recurring_bills : [];
  const bills = [...rawBills].sort((a, b) => (Number(a?.dueDay) || 1) - (Number(b?.dueDay) || 1));
  const activeBills = bills.filter((b) => !!b?.isActive);
  const totalCommitted = activeBills.reduce((acc, b) => {
    const cost = b?.type === 'variable' && b?.actualAmount !== null && b?.actualAmount !== undefined
      ? (Number(b.actualAmount) || 0)
      : (Number(b?.amount) || 0);
    return acc + cost;
  }, 0);

  const formatMoney = (amount) => {
    const num = Number(amount) || 0;
    return fmt?.format ? fmt.format(num) : `$${num.toFixed(2)}`;
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setError('');
    setModal(true);
  };

  const openEdit = (bill) => {
    if (!bill) return;
    setEditId(bill.id);
    setForm({
      name: bill.name || '',
      type: bill.type || 'fixed',
      amount: String(bill.amount ?? ''),
      dueDay: String(bill.dueDay ?? '1'),
      isAutoPaid: !!bill.isAutoPaid,
      isActive: bill.isActive !== undefined ? !!bill.isActive : true,
    });
    setError('');
    setModal(true);
  };

  const handleSave = () => {
    try {
      if (editId) {
        updateBill?.(editId, form);
      } else {
        addBill?.(form);
      }
      setModal(false);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = (id) => {
    setDeletingId(id);
    setTimeout(() => { deleteBill?.(id); setDeletingId(null); }, 220);
  };

  const toggleActive = (bill) => {
    if (!bill?.id) return;
    updateBill?.(bill.id, { isActive: !bill.isActive });
  };

  return (
    <div className="p-6 xl:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Recurring Bills</h1>
          <p className="text-text-muted text-sm mt-0.5">
            {activeBills.length} active · Total committed: <span className="text-accent-red font-semibold">{formatMoney(totalCommitted)}/mo</span>
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-sm font-semibold hover:bg-accent-blue/20 transition-colors"
        >
          <Plus size={15} />
          Add Bill
        </button>
      </div>

      {/* Bills list */}
      <Card>
        {bills.length === 0 ? (
          <p className="text-text-muted text-center py-12 text-sm">No bills yet. Add your first recurring bill!</p>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {bills.map((bill) => {
              const cost = bill?.type === 'variable' && bill?.actualAmount !== null && bill?.actualAmount !== undefined
                ? (Number(bill.actualAmount) || 0)
                : (Number(bill?.amount) || 0);
              return (
                <motion.div
                  key={bill?.id || Math.random()}
                  animate={{ opacity: deletingId === bill?.id ? 0 : 1, x: deletingId === bill?.id ? 20 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-between px-5 py-4 group hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3">
                    {/* Active toggle */}
                    <button
                      onClick={() => toggleActive(bill)}
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                        bill?.isActive
                          ? 'border-accent-green bg-accent-green/20'
                          : 'border-text-muted/30 bg-transparent'
                      }`}
                    >
                      {bill?.isActive && <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />}
                    </button>

                    <div>
                      <p className={`text-sm font-semibold ${bill?.isActive ? 'text-text-main' : 'text-text-muted line-through'}`}>
                        {bill?.name || 'Untitled Bill'}
                      </p>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        Due day {bill?.dueDay || 1} · {bill?.type === 'fixed' ? 'Fixed' : 'Variable'}
                        {bill?.isAutoPaid && ' · Auto-paid'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-accent-red">{formatMoney(cost)}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(bill)}
                        className="text-text-muted hover:text-accent-blue transition-colors p-1 rounded"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(bill.id)}
                        className="text-text-muted hover:text-accent-red transition-colors p-1 rounded"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? 'Edit Bill' : 'Add Bill'}
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Name</span>
            <input
              type="text"
              placeholder="e.g. Netflix, Rent…"
              className="input-field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
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
              <span className="text-xs text-text-muted">Due Day</span>
              <input
                type="number"
                min="1"
                max="31"
                placeholder="1"
                className="input-field"
                value={form.dueDay}
                onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Type</span>
            <select
              className="input-field"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="fixed">Fixed</option>
              <option value="variable">Variable</option>
            </select>
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isAutoPaid}
                onChange={(e) => setForm({ ...form, isAutoPaid: e.target.checked })}
                className="accent-accent-blue"
              />
              <span className="text-xs text-text-muted">Auto-paid</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="accent-accent-green"
              />
              <span className="text-xs text-text-muted">Active</span>
            </label>
          </div>
          {error && <p className="text-accent-red text-xs">{error}</p>}
          <div className="flex gap-2 mt-1">
            <button onClick={handleSave} className="btn-primary flex-1">
              {editId ? 'Save Changes' : 'Add Bill'}
            </button>
            <button onClick={() => setModal(false)} className="btn-ghost flex-1">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
