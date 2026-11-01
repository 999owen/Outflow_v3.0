import { useOutflowStore } from '../../store/useOutflowStore.jsx';
import Card from '../ui/Card.jsx';
import AnimatedNumber from '../ui/AnimatedNumber.jsx';

export default function PacingCard() {
  const { fmt, totals, db } = useOutflowStore();
  const spent = Number(totals?.spent) || 0;
  const allowance = Number(totals?.allowance) || 0;
  const pct = allowance > 0 ? Math.min((spent / allowance) * 100, 100) : 0;
  const isOver = spent > allowance;
  const spendingPercentage = db?.settings?.spending_percentage ?? 35;

  const formatMoney = (amount) => {
    const num = Number(amount) || 0;
    return fmt?.format ? fmt.format(num) : `$${num.toFixed(2)}`;
  };

  // Color shifts: green → yellow → red
  const barColor = pct < 70 ? '#4ADE80' : pct < 90 ? '#FBBF24' : '#F87171';

  return (
    <Card className="p-5">
      <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-3">
        Monthly Pacing
      </p>

      <div className="mb-1">
        <span className="text-2xl font-bold" style={{ color: isOver ? '#F87171' : '#f9fafb' }}>
          <AnimatedNumber value={spent} format={(v) => formatMoney(v)} />
        </span>
        <span className="text-text-muted text-sm ml-1.5">
          / {formatMoney(allowance)}
        </span>
      </div>
      <p className="text-xs text-text-muted mb-4">
        Spending allowance ({spendingPercentage}% of income)
      </p>

      {/* Bar */}
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: pct + '%', background: barColor }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-[11px] text-text-muted">
        <span>{pct.toFixed(1)}% used</span>
        <span style={{ color: isOver ? '#F87171' : '#4ADE80' }}>
          {isOver ? '–' : ''}{formatMoney(Math.abs(allowance - spent))} {isOver ? 'over' : 'left'}
        </span>
      </div>
    </Card>
  );
}
