import { useOutflowStore } from '../../store/useOutflowStore.jsx';
import Card from '../ui/Card.jsx';
import AnimatedNumber from '../ui/AnimatedNumber.jsx';
import TrajectoryChart from './TrajectoryChart.jsx';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function HeroCard() {
  const { fmt, totals, db } = useOutflowStore();

  const remaining = Number(totals?.remaining) || 0;
  const allowance = Number(totals?.allowance) || 0;
  const earned = Number(totals?.earned) || 0;
  const spent = Number(totals?.spent) || 0;
  const saved = Number(totals?.saved) || 0;
  const isPositive = remaining >= 0;

  // Committed bills total (active only)
  const activeBills = (Array.isArray(db?.recurring_bills) ? db.recurring_bills : []).filter((b) => !!b?.isActive);
  const committedBills = activeBills.reduce((acc, b) => {
    const cost = b?.type === 'variable' && b?.actualAmount !== null && b?.actualAmount !== undefined
      ? (Number(b.actualAmount) || 0)
      : (Number(b?.amount) || 0);
    return acc + cost;
  }, 0);
  const runway = remaining - committedBills;

  // Asset/liability bar proportions
  const totalBar = Math.max(earned, 0.01);
  const cashPct   = Math.min((allowance / totalBar) * 100, 100);
  const billsPct  = Math.min((committedBills / totalBar) * 100, 100);

  const heroColor = isPositive ? '#4ADE80' : '#F87171';

  const formatMoney = (amount) => {
    const num = Number(amount) || 0;
    return fmt?.format ? fmt.format(num) : `$${num.toFixed(2)}`;
  };

  return (
    <Card className="p-6">
      {/* Top row */}
      <div className="flex items-start justify-between mb-1">
        <p className="text-[11px] uppercase tracking-widest text-text-muted font-semibold">
          Overall Left (Runway)
        </p>
        {isPositive
          ? <TrendingUp size={16} className="text-accent-green" />
          : <TrendingDown size={16} className="text-accent-red" />
        }
      </div>

      {/* Hero value */}
      <div className="mb-1" style={{ color: heroColor }}>
        <span className="text-4xl font-extrabold tracking-tight leading-none">
          <AnimatedNumber
            value={remaining}
            format={(v) => formatMoney(v)}
            duration={0.9}
          />
        </span>
        <span className="text-sm ml-2 font-medium opacity-70">
          {isPositive ? 'remaining' : 'over budget'}
        </span>
      </div>

      {/* Sub-metrics row */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 mb-5">
        <Metric label="Earned"    value={formatMoney(earned)}    color="text-accent-green" />
        <Metric label="Spent"     value={formatMoney(spent)}     color="text-accent-red" />
        <Metric label="Allowance" value={formatMoney(allowance)} color="text-accent-blue" />
        <Metric label="Saved"     value={formatMoney(saved)}     color="text-text-muted" />
      </div>

      {/* Trajectory chart */}
      <TrajectoryChart />

      {/* Asset/Liability bar */}
      <div className="mt-5">
        <div className="flex justify-between text-xs text-text-muted mb-2">
          <span>Spending Allowance — <span className="text-text-main font-semibold">{formatMoney(allowance)}</span></span>
          <span>Bills — <span className="text-text-main font-semibold">{formatMoney(committedBills)}</span></span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden flex gap-0.5">
          <div
            className="h-full rounded-full bg-accent-green transition-all duration-700"
            style={{ width: cashPct + '%' }}
          />
          <div
            className="h-full rounded-full bg-accent-blue/60 transition-all duration-700"
            style={{ width: billsPct + '%' }}
          />
        </div>
        <div className="flex gap-4 mt-2 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent-green inline-block" />
            Cash Runway
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent-blue/60 inline-block" />
            Committed Bills
          </span>
        </div>
      </div>

      {/* Runway after bills */}
      <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between">
        <span className="text-xs text-text-muted">Runway after bills</span>
        <span
          className="text-sm font-bold"
          style={{ color: runway >= 0 ? '#4ADE80' : '#F87171' }}
        >
          {formatMoney(runway)}
        </span>
      </div>
    </Card>
  );
}

function Metric({ label, value, color }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}
