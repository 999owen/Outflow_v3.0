import { useOutflowStore } from '../../store/useOutflowStore.jsx';
import Card from '../ui/Card.jsx';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js';
import { ExternalLink } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip);

const BILL_COLORS = ['#60A5FA','#4ADE80','#F87171','#FBBF24','#A78BFA','#F472B6','#34D399','#38BDF8'];

export default function UpcomingBillsCard() {
  const { db, fmt, totals } = useOutflowStore();

  const now = new Date();
  const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

  const rawBills = Array.isArray(db?.recurring_bills) ? db.recurring_bills : [];
  const activeBills = rawBills
    .filter((b) => !!b?.isActive)
    .sort((a, b) => (Number(a?.dueDay) || 1) - (Number(b?.dueDay) || 1));

  const getBillCost = (b) => {
    if (b?.type === 'variable' && b?.actualAmount !== null && b?.actualAmount !== undefined && b?.lastUpdatedMonth === currentMonth) {
      return Number(b.actualAmount) || 0;
    }
    return Number(b?.amount) || 0;
  };

  const totalCommitted = activeBills.reduce((acc, b) => acc + getBillCost(b), 0);
  const remaining = Number(totals?.remaining) || 0;
  const runway = remaining - totalCommitted;

  const formatMoney = (amount) => {
    const num = Number(amount) || 0;
    return fmt?.format ? fmt.format(num) : `$${num.toFixed(2)}`;
  };

  // Chart data
  const chartData = {
    labels: activeBills.map((b) => b?.name || 'Bill'),
    datasets: [
      {
        data: activeBills.map((b) => getBillCost(b)),
        backgroundColor: BILL_COLORS.slice(0, activeBills.length),
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(12,20,36,0.95)',
        titleColor: '#9ca3af',
        bodyColor: '#f9fafb',
        callbacks: {
          label: (ctx) => ' ' + fmt.format(ctx.parsed),
        },
      },
    },
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">
          Upcoming Bills
        </p>
        <span className="text-xs text-accent-red font-semibold">{formatMoney(totalCommitted)}</span>
      </div>

      {activeBills.length === 0 ? (
        <p className="text-text-muted text-sm text-center py-4">No active bills.</p>
      ) : (
        <>
          {/* Mini doughnut */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative h-20 w-20 shrink-0">
              <Doughnut data={chartData} options={chartOptions} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] text-text-muted font-semibold text-center leading-tight">
                  {activeBills.length}<br />bills
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-0.5 text-xs overflow-hidden">
              {activeBills.slice(0, 4).map((b, i) => (
                <div key={b?.id || i} className="flex items-center gap-1.5 truncate">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: BILL_COLORS[i % BILL_COLORS.length] }}
                  />
                  <span className="truncate text-text-muted">{b?.name || 'Bill'}</span>
                </div>
              ))}
              {activeBills.length > 4 && (
                <span className="text-text-muted/60">+{activeBills.length - 4} more</span>
              )}
            </div>
          </div>

          {/* Scrollable bill list */}
          <ul className="flex flex-col divide-y divide-white/[0.05] max-h-[180px] overflow-y-auto">
            {activeBills.map((bill) => {
              const cost = getBillCost(bill);
              return (
                <li key={bill?.id || Math.random()} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-xs font-semibold text-text-main">{bill?.name || 'Bill'}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      Day {bill?.dueDay || 1} · {bill?.type === 'fixed' ? 'Fixed' : 'Variable'}
                      {bill?.isAutoPaid && ' · Auto'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-accent-red">{formatMoney(cost)}</span>
                </li>
              );
            })}
          </ul>

          {/* Runway after bills */}
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex justify-between text-xs">
            <span className="text-text-muted">Runway after bills</span>
            <span
              className="font-bold"
              style={{ color: runway >= 0 ? '#4ADE80' : '#F87171' }}
            >
              {formatMoney(runway)}
            </span>
          </div>
        </>
      )}
    </Card>
  );
}
