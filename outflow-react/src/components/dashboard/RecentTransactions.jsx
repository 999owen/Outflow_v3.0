import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOutflowStore } from '../../store/useOutflowStore.jsx';
import Card from '../ui/Card.jsx';
import { parseDate } from '../../store/trackerStore.js';

const tabVariants = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.2, ease: [0.4,0,0.2,1] } },
  exit:    { opacity: 0, x: -12, transition: { duration: 0.15 } },
};

export default function RecentTransactions() {
  const { db, fmt } = useOutflowStore();
  const [tab, setTab] = useState('income'); // 'income' | 'spend'

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

  const income = [...incomeList]
    .sort((a, b) => safeDate(b?.date) - safeDate(a?.date))
    .slice(0, 5);

  const spend = [...spendList]
    .sort((a, b) => safeDate(b?.date) - safeDate(a?.date))
    .slice(0, 5);

  const rows = tab === 'income' ? income : spend;

  const formatMoney = (amount) => {
    const num = Number(amount) || 0;
    return fmt?.format ? fmt.format(num) : `$${num.toFixed(2)}`;
  };

  return (
    <Card className="p-5">
      {/* Header + tabs */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text-main">Recent Transactions</h2>
        <div className="flex gap-1 bg-white/[0.04] rounded-lg p-0.5">
          {['income', 'spend'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="relative px-3 py-1.5 text-xs font-semibold rounded-md transition-colors duration-150"
              style={{ color: tab === t ? '#f9fafb' : '#6b7280' }}
            >
              {tab === t && (
                <motion.div
                  layoutId="tx-tab-indicator"
                  className="absolute inset-0 bg-white/[0.10] rounded-md"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 capitalize">{t === 'income' ? 'Income' : 'Weekly Spend'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Animated list */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          variants={tabVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {rows.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-6">No entries yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-white/[0.05]">
              {rows.map((entry) => (
                <li
                  key={entry?.id || Math.random()}
                  className="flex items-center justify-between py-3 group"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-text-main leading-tight">
                      {entry?.notes || '—'}
                    </span>
                    <span className="text-[11px] text-text-muted mt-0.5">
                      {entry?.date || '—'}
                      {entry?.category && entry.category !== 'Groceries' && (
                        <span className="ml-2 px-1.5 py-0.5 bg-white/[0.05] rounded text-[10px] text-text-muted">
                          {entry.category}
                        </span>
                      )}
                    </span>
                  </div>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: tab === 'income' ? '#4ADE80' : '#F87171' }}
                  >
                    {tab === 'income' ? '+' : ''}{formatMoney(entry?.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </AnimatePresence>
    </Card>
  );
}
