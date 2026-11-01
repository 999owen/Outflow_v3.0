import { useOutflowStore } from '../../store/useOutflowStore.jsx';
import Card from '../ui/Card.jsx';
import AnimatedNumber from '../ui/AnimatedNumber.jsx';
import { ShoppingCart } from 'lucide-react';

export default function GroceryMonitor() {
  const { fmt, totals, db, groceryByWeek, groceryThisWeek } = useOutflowStore();
  const groceryLeft = Number(totals?.groceryLeft) || 0;
  const groceryThisMonth = Number(totals?.groceryThisMonth) || 0;
  const limit = Number(db?.settings?.monthly_grocery_limit) || 280;
  const thisWeekTotal = typeof groceryThisWeek === 'function' ? (groceryThisWeek() || 0) : 0;

  const monthlyPct = limit > 0 ? Math.min((groceryThisMonth / limit) * 100, 100) : 0;
  const isOver = groceryLeft < 0;
  const barColor = monthlyPct < 70 ? '#4ADE80' : monthlyPct < 90 ? '#FBBF24' : '#F87171';

  const formatMoney = (amount) => {
    const num = Number(amount) || 0;
    return fmt?.format ? fmt.format(num) : `$${num.toFixed(2)}`;
  };

  // Weekly breakdown (last 4 weeks)
  const weeks = typeof groceryByWeek === 'function' ? (groceryByWeek(4) || []) : [];
  const weekMax = Math.max(...weeks.map((x) => Number(x?.total) || 0), 1);

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <ShoppingCart size={13} className="text-accent-yellow" />
        <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">
          Grocery Monitor
        </p>
      </div>

      {/* Monthly left */}
      <div className="mb-1">
        <span className="text-2xl font-bold" style={{ color: isOver ? '#F87171' : '#FBBF24' }}>
          <AnimatedNumber value={Math.abs(groceryLeft)} format={(v) => formatMoney(v)} />
        </span>
        <span className="text-text-muted text-sm ml-1.5">
          {isOver ? 'over monthly limit' : 'left this month'}
        </span>
      </div>
      <p className="text-xs text-text-muted mb-3">
        {formatMoney(groceryThisMonth)} of {formatMoney(limit)} limit used
      </p>

      {/* Bar */}
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: monthlyPct + '%', background: barColor }}
        />
      </div>

      {/* Weekly mini-bars */}
      <div className="grid grid-cols-4 gap-1.5">
        {weeks.map((w, idx) => {
          const totalVal = Number(w?.total) || 0;
          const h = Math.max((totalVal / weekMax) * 48, 4);
          const isThisWeek = w?.label === 'This Week';
          return (
            <div key={w?.key || idx} className="flex flex-col items-center gap-1">
              <div className="flex items-end h-12 w-full justify-center">
                <div
                  className="w-full rounded-t transition-all duration-500"
                  style={{
                    height: h + 'px',
                    background: isThisWeek ? '#FBBF24' : 'rgba(251,191,36,0.25)',
                  }}
                />
              </div>
              <span className="text-[9px] text-text-muted text-center leading-tight">{w?.label || '—'}</span>
              <span className="text-[9px] text-text-muted">{formatMoney(totalVal)}</span>
            </div>
          );
        })}
      </div>

      {/* This week callout */}
      <div className="mt-3 pt-3 border-t border-white/[0.06] flex justify-between text-xs">
        <span className="text-text-muted">This week</span>
        <span className="text-accent-yellow font-semibold">{formatMoney(thisWeekTotal)}</span>
      </div>
    </Card>
  );
}
