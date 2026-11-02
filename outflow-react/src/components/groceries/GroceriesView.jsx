import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ShoppingCart,
  Plus,
  Trash2,
  TrendingUp,
  Flame,
  Calendar,
  Receipt,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useOutflowStore } from '../../store/useOutflowStore.jsx';
import Card from '../ui/Card.jsx';
import Modal from '../ui/Modal.jsx';
import AnimatedNumber from '../ui/AnimatedNumber.jsx';
import { parseDate, weekKey } from '../../store/trackerStore.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const TIMELINES = [
  { id: '1w', label: '1 Week' },
  { id: '1m', label: '1 Month' },
  { id: '6m', label: '6 Months' },
  { id: '1y', label: '1 Year' },
  { id: '3y', label: '3 Years' },
];

const today = () => {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
};

export default function GroceriesView() {
  const { db, fmt, totals, addEntry, deleteEntry } = useOutflowStore();

  const [timeline, setTimeline] = useState('1m');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ date: today(), amount: '', notes: '' });
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const rawGroceries = Array.isArray(db?.grocery_entries) ? db.grocery_entries : [];
  const limit = Number(db?.settings?.monthly_grocery_limit) || 280;

  const formatMoney = (amount) => {
    const num = Number(amount) || 0;
    return fmt?.format ? fmt.format(num) : `$${num.toFixed(2)}`;
  };

  const safeDate = (d) => {
    try {
      const parsed = parseDate(d);
      return parsed instanceof Date && !isNaN(parsed.getTime()) ? parsed.getTime() : 0;
    } catch {
      return 0;
    }
  };

  const entries = useMemo(() => {
    return [...rawGroceries].sort((a, b) => safeDate(b?.date) - safeDate(a?.date));
  }, [rawGroceries]);

  // ── Grocery KPI Analytics (Inspired by original Outflow analytics) ────────
  const analytics = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    // Current month entries
    const currentMonthEntries = rawGroceries.filter((e) => {
      if (!e?.date) return false;
      return String(e.date).slice(0, 7) === currentMonthStr;
    });

    const spentThisMonth = currentMonthEntries.reduce(
      (sum, e) => sum + (Number(e?.amount) || 0),
      0
    );
    const tripsThisMonth = currentMonthEntries.length;
    const avgTripThisMonth = tripsThisMonth > 0 ? spentThisMonth / tripsThisMonth : 0;
    const budgetRemaining = limit - spentThisMonth;
    const pctUsed = limit > 0 ? (spentThisMonth / limit) * 100 : 0;

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const dayOfMonth = Math.max(1, now.getDate());
    const targetDailyBurn = limit / daysInMonth;
    const pacedTargetToDate = (dayOfMonth / daysInMonth) * limit;
    const isOverPace = spentThisMonth > pacedTargetToDate;
    const isOverLimit = budgetRemaining < 0;

    // Rolling Burn: 14-day and 30-day daily averages
    const calcBurn = (days) => {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - days);
      const sum = rawGroceries.reduce((acc, e) => {
        const d = parseDate(e?.date);
        if (d && d > cutoff && d <= now) {
          return acc + (Number(e?.amount) || 0);
        }
        return acc;
      }, 0);
      return sum / days;
    };

    const burn14 = calcBurn(14);
    const burn30 = calcBurn(30);

    return {
      spentThisMonth,
      pctUsed,
      budgetRemaining,
      isOverPace,
      isOverLimit,
      tripsThisMonth,
      avgTripThisMonth,
      burn14,
      burn30,
      targetDailyBurn,
      daysInMonth,
    };
  }, [rawGroceries, limit]);

  // ── Chart Data Generation with Trendline ─────────────────────────────────
  const { chartData, windowStats } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let points = []; // [{ label, value, target }]
    let targetVal = 0;
    let targetLabel = '';

    if (timeline === '1w') {
      targetVal = limit / 30.4375;
      targetLabel = `Target Daily (${formatMoney(targetVal)})`;
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr =
          d.getFullYear() +
          '-' +
          String(d.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(d.getDate()).padStart(2, '0');
        const dayName =
          i === 0
            ? 'Today'
            : d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
        const dayTotal = rawGroceries
          .filter((e) => e.date === dateStr)
          .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        points.push({ label: dayName, value: dayTotal, target: targetVal });
      }
    } else if (timeline === '1m') {
      targetVal = limit / 30.4375;
      targetLabel = `Target Daily (${formatMoney(targetVal)})`;
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr =
          d.getFullYear() +
          '-' +
          String(d.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(d.getDate()).padStart(2, '0');
        const dayLabel = `${d.getMonth() + 1}/${d.getDate()}`;
        const dayTotal = rawGroceries
          .filter((e) => e.date === dateStr)
          .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        points.push({ label: dayLabel, value: dayTotal, target: targetVal });
      }
    } else if (timeline === '6m') {
      const weeklyTarget = limit / 4.333;
      targetVal = weeklyTarget;
      targetLabel = `Target Weekly (${formatMoney(weeklyTarget)})`;
      const cursor = new Date(now);
      const dayOffset = (cursor.getDay() + 1) % 7;
      cursor.setDate(cursor.getDate() - dayOffset);

      const weekMap = {};
      rawGroceries.forEach((e) => {
        const wk = weekKey(e.date);
        if (wk) weekMap[wk] = (weekMap[wk] || 0) + (Number(e.amount) || 0);
      });

      const tempWeeks = [];
      for (let i = 0; i < 26; i++) {
        const wDate = new Date(cursor);
        wDate.setDate(wDate.getDate() - i * 7);
        const wkStr =
          wDate.getFullYear() +
          '-' +
          String(wDate.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(wDate.getDate()).padStart(2, '0');
        const label = i === 0 ? 'This Week' : `${wDate.getMonth() + 1}/${wDate.getDate()}`;
        tempWeeks.unshift({ label, value: weekMap[wkStr] || 0, target: targetVal });
      }
      points = tempWeeks;
    } else if (timeline === '1y') {
      targetVal = limit;
      targetLabel = `Monthly Cap (${formatMoney(limit)})`;
      const monthMap = {};
      rawGroceries.forEach((e) => {
        if (e?.date) {
          const mKey = String(e.date).slice(0, 7);
          monthMap[mKey] = (monthMap[mKey] || 0) + (Number(e.amount) || 0);
        }
      });
      for (let i = 11; i >= 0; i--) {
        const mDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mKey =
          mDate.getFullYear() + '-' + String(mDate.getMonth() + 1).padStart(2, '0');
        const label = mDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        points.push({ label, value: monthMap[mKey] || 0, target: targetVal });
      }
    } else if (timeline === '3y') {
      targetVal = limit;
      targetLabel = `Monthly Cap (${formatMoney(limit)})`;
      const monthMap = {};
      rawGroceries.forEach((e) => {
        if (e?.date) {
          const mKey = String(e.date).slice(0, 7);
          monthMap[mKey] = (monthMap[mKey] || 0) + (Number(e.amount) || 0);
        }
      });
      for (let i = 35; i >= 0; i--) {
        const mDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mKey =
          mDate.getFullYear() + '-' + String(mDate.getMonth() + 1).padStart(2, '0');
        const label = mDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        points.push({ label, value: monthMap[mKey] || 0, target: targetVal });
      }
    }

    // Moving average trendline
    const trendWindow =
      timeline === '1w' ? 2 : timeline === '1m' ? 5 : timeline === '6m' ? 4 : 3;
    const trendData = [];
    for (let i = 0; i < points.length; i++) {
      const start = Math.max(0, i - trendWindow + 1);
      const windowSlice = points.slice(start, i + 1);
      const avg = windowSlice.reduce((sum, p) => sum + p.value, 0) / windowSlice.length;
      trendData.push(Math.round(avg * 100) / 100);
    }

    const labels = points.map((p) => p.label);
    const spendValues = points.map((p) => p.value);
    const targetValues = points.map((p) => p.target);

    // Window metrics
    const totalSpentInWindow = spendValues.reduce((a, b) => a + b, 0);
    const avgPerPeriod = points.length > 0 ? totalSpentInWindow / points.length : 0;
    const peakPeriod = Math.max(...spendValues, 0);

    const datasets = [
      {
        label: 'Grocery Spend',
        data: spendValues,
        fill: true,
        tension: 0.35,
        borderColor: '#fbbf24',
        borderWidth: 2.5,
        pointRadius: timeline === '1m' ? 2.5 : 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#fbbf24',
        pointBorderColor: '#0c1424',
        pointBorderWidth: 2,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: canvasCtx, chartArea } = chart;
          if (!chartArea) return 'rgba(251,191,36,0.12)';
          const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(251,191,36,0.30)');
          gradient.addColorStop(1, 'rgba(251,191,36,0.01)');
          return gradient;
        },
      },
      {
        label: 'Trendline (Average)',
        data: trendData,
        fill: false,
        borderDash: [5, 5],
        borderColor: '#38bdf8',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.35,
      },
      {
        label: targetLabel,
        data: targetValues,
        fill: false,
        borderDash: [6, 4],
        borderColor: '#f87171',
        borderWidth: 1.5,
        pointRadius: 0,
      },
    ];

    return {
      chartData: { labels, datasets },
      windowStats: {
        totalSpent: totalSpentInWindow,
        avgPerPeriod,
        peakPeriod,
        periodCount: points.length,
      },
    };
  }, [timeline, rawGroceries, limit, fmt]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          color: '#9ca3af',
          font: { size: 11 },
          boxWidth: 12,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(12,20,36,0.96)',
        titleColor: '#9ca3af',
        bodyColor: '#f9fafb',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${formatMoney(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#6b7280', font: { size: 10 }, maxRotation: 0 },
        border: { display: false },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: '#6b7280',
          font: { size: 10 },
          callback: (v) => formatMoney(v),
        },
        border: { display: false },
        beginAtZero: true,
      },
    },
    interaction: { mode: 'index', intersect: false },
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
    setTimeout(() => {
      deleteEntry?.('grocery', id);
      setDeletingId(null);
    }, 220);
  };

  return (
    <div className="p-4 sm:p-6 xl:p-8 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-text-main">Groceries</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent-yellow/15 text-accent-yellow font-semibold border border-accent-yellow/25">
              Budget & Analytics
            </span>
          </div>
          <p className="text-text-muted text-sm mt-0.5">
            Track spending velocity, inspect historical trendlines, and log grocery trips.
          </p>
        </div>

        <button
          onClick={() => {
            setModal(true);
            setError('');
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-accent-blue/10 border border-accent-blue/25 text-accent-blue text-sm font-semibold hover:bg-accent-blue/20 transition-colors w-fit"
        >
          <Plus size={15} />
          Add Grocery
        </button>
      </div>

      {/* ── KPI Analytics Boxes (Inspired by Pre-React Outflow) ─────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Monthly Spend vs Cap */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold flex items-center gap-1.5">
                <ShoppingCart size={12} className="text-accent-yellow" />
                Monthly Spend vs Cap
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  analytics.isOverLimit
                    ? 'bg-accent-red/15 text-accent-red border-accent-red/25'
                    : analytics.isOverPace
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                    : 'bg-accent-green/15 text-accent-green border-accent-green/25'
                }`}
              >
                {analytics.isOverLimit
                  ? 'Over Limit'
                  : analytics.isOverPace
                  ? 'Over Pace'
                  : 'On Track'}
              </span>
            </div>

            <div className="flex items-baseline gap-1.5 mt-1">
              <span
                className="text-2xl font-extrabold"
                style={{ color: analytics.isOverLimit ? '#F87171' : '#FBBF24' }}
              >
                <AnimatedNumber
                  value={analytics.spentThisMonth}
                  format={(v) => formatMoney(v)}
                />
              </span>
              <span className="text-xs text-text-muted">/ {formatMoney(limit)}</span>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-[11px] mb-1.5 font-medium">
              <span className="text-text-muted">{analytics.pctUsed.toFixed(1)}% used</span>
              <span style={{ color: analytics.isOverLimit ? '#F87171' : '#4ADE80' }}>
                {analytics.isOverLimit ? '–' : ''}
                {formatMoney(Math.abs(analytics.budgetRemaining))}{' '}
                {analytics.isOverLimit ? 'over' : 'left'}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(analytics.pctUsed, 100)}%`,
                  background:
                    analytics.pctUsed < 70
                      ? '#4ADE80'
                      : analytics.pctUsed < 90
                      ? '#FBBF24'
                      : '#F87171',
                }}
              />
            </div>
          </div>
        </Card>

        {/* Card 2: 14-Day Rolling Burn */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold flex items-center gap-1.5 mb-2">
              <Flame size={12} className="text-accent-blue" />
              14-Day Rolling Burn
            </span>
            <div className="text-2xl font-extrabold text-accent-blue mt-1">
              <AnimatedNumber value={analytics.burn14} format={(v) => formatMoney(v)} />
              <span className="text-xs font-normal text-text-muted ml-1">/day</span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Target rate: ≤ {formatMoney(analytics.targetDailyBurn)}/day
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
            <span className="text-text-muted">Pacing Status</span>
            <span
              className={`font-semibold flex items-center gap-1 ${
                analytics.burn14 <= analytics.targetDailyBurn
                  ? 'text-accent-green'
                  : 'text-amber-400'
              }`}
            >
              {analytics.burn14 <= analytics.targetDailyBurn ? (
                <>
                  <CheckCircle2 size={12} /> Within Target
                </>
              ) : (
                <>
                  <AlertCircle size={12} /> Above Target
                </>
              )}
            </span>
          </div>
        </Card>

        {/* Card 3: 30-Day Rolling Burn */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold flex items-center gap-1.5 mb-2">
              <Calendar size={12} className="text-accent-green" />
              30-Day Rolling Burn
            </span>
            <div className="text-2xl font-extrabold text-accent-green mt-1">
              <AnimatedNumber value={analytics.burn30} format={(v) => formatMoney(v)} />
              <span className="text-xs font-normal text-text-muted ml-1">/day</span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Monthly projection: ~{formatMoney(analytics.burn30 * analytics.daysInMonth)}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
            <span className="text-text-muted">Target Benchmark</span>
            <span className="text-text-main font-semibold">
              {formatMoney(analytics.targetDailyBurn)}/day
            </span>
          </div>
        </Card>

        {/* Card 4: Trip Analytics */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold flex items-center gap-1.5 mb-2">
              <Receipt size={12} className="text-purple-400" />
              Trip Analytics (Month)
            </span>
            <div className="text-2xl font-extrabold text-text-main mt-1">
              {analytics.tripsThisMonth}{' '}
              <span className="text-xs font-normal text-text-muted">
                {analytics.tripsThisMonth === 1 ? 'grocery run' : 'grocery runs'}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Avg ticket:{' '}
              <span className="text-purple-400 font-semibold">
                {formatMoney(analytics.avgTripThisMonth)}
              </span>{' '}
              per trip
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-text-muted">
            <span>Trip Frequency</span>
            <span className="text-text-main font-semibold">
              ~{((analytics.tripsThisMonth / Math.max(1, new Date().getDate())) * 7).toFixed(1)} /
              week
            </span>
          </div>
        </Card>
      </div>

      {/* ── Interactive Grocery Spending & Trendline Chart (Hero) ───────── */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-base font-bold text-text-main flex items-center gap-2">
              <TrendingUp size={16} className="text-accent-yellow" />
              Grocery Spending Trend & Datapoints
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Historical grocery purchases with moving average trendline and budget thresholds
            </p>
          </div>

          {/* Timeline selector: 1w, 1m, 6m, 1y, 3y */}
          <div className="flex bg-white/[0.04] p-0.5 rounded-lg border border-white/[0.06] w-fit">
            {TIMELINES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeline(t.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  timeline === t.id
                    ? 'bg-accent-yellow/20 text-accent-yellow border border-accent-yellow/30'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="relative h-[260px] sm:h-[300px] w-full">
          <Line data={chartData} options={chartOptions} />
        </div>

        {/* Summary Bar Under Chart (Matching Projections style) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/[0.06] text-xs">
          <div>
            <p className="text-text-muted">Total in Window</p>
            <p className="text-sm font-bold text-accent-yellow mt-0.5">
              {formatMoney(windowStats.totalSpent)}
            </p>
          </div>
          <div>
            <p className="text-text-muted">
              Average /{' '}
              {timeline === '1w' || timeline === '1m'
                ? 'Day'
                : timeline === '6m'
                ? 'Week'
                : 'Month'}
            </p>
            <p className="text-sm font-bold text-accent-blue mt-0.5">
              {formatMoney(windowStats.avgPerPeriod)}
            </p>
          </div>
          <div>
            <p className="text-text-muted">Peak Recorded Period</p>
            <p className="text-sm font-bold text-accent-red mt-0.5">
              {formatMoney(windowStats.peakPeriod)}
            </p>
          </div>
          <div>
            <p className="text-text-muted">Timeline Spanned</p>
            <p className="text-sm font-bold text-text-main mt-0.5">
              {TIMELINES.find((t) => t.id === timeline)?.label}
            </p>
          </div>
        </div>
      </Card>

      {/* ── Grocery Entry List & Table (Moved to bottom of chart) ────────── */}
      <Card>
        <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-text-main">Grocery Log & Receipts</h2>
            <p className="text-xs text-text-muted mt-0.5">
              {entries.length} recorded {entries.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>
          <button
            onClick={() => {
              setModal(true);
              setError('');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-xs font-semibold hover:bg-accent-blue/20 transition-colors"
          >
            <Plus size={13} />
            Log Grocery Run
          </button>
        </div>

        {entries.length === 0 ? (
          <p className="text-text-muted text-center py-12 text-sm">
            No grocery entries yet. Log your first grocery run above!
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left text-[10px] uppercase tracking-widest text-text-muted font-semibold px-5 py-3">
                    Date
                  </th>
                  <th className="text-left text-[10px] uppercase tracking-widest text-text-muted font-semibold px-5 py-3">
                    Notes
                  </th>
                  <th className="text-right text-[10px] uppercase tracking-widest text-text-muted font-semibold px-5 py-3">
                    Amount
                  </th>
                  <th className="px-3" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <motion.tr
                    key={entry?.id || Math.random()}
                    animate={{
                      opacity: deletingId === entry?.id ? 0 : 1,
                      x: deletingId === entry?.id ? 20 : 0,
                    }}
                    transition={{ duration: 0.2 }}
                    className="border-b border-white/[0.04] last:border-none hover:bg-white/[0.02] group"
                  >
                    <td className="px-5 py-3.5 text-xs text-text-muted font-mono">
                      {entry?.date || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-text-main font-medium">
                      {entry?.notes || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-accent-yellow">
                      {formatMoney(entry?.amount)}
                    </td>
                    <td className="px-3 py-3.5">
                      <button
                        onClick={() => handleDelete(entry?.id)}
                        className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-accent-red transition-all p-1 rounded"
                        title="Delete entry"
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

      {/* ── Add Grocery Modal ───────────────────────────────────────────── */}
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
              placeholder="e.g. Whole Foods, Trader Joe's, Costco run…"
              className="input-field"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          {error && <p className="text-accent-red text-xs">{error}</p>}
          <div className="flex gap-2 mt-1">
            <button onClick={handleAdd} className="btn-primary flex-1">
              Add Grocery
            </button>
            <button onClick={() => setModal(false)} className="btn-ghost flex-1">
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
