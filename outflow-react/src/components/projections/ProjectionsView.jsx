import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Target,
  Calendar,
  Clock,
  Sparkles,
  ArrowUpRight,
  Pencil,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sliders,
  DollarSign,
  ShieldCheck,
  Zap,
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
import { getFinancialProjections } from '../../store/trackerStore.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const HORIZONS = [
  { label: '6 Months', months: 6 },
  { label: '1 Year', months: 12 },
  { label: '3 Years', months: 36 },
  { label: '5 Years', months: 60 },
];

export default function ProjectionsView() {
  const { db, fmt, updateSetting } = useOutflowStore();

  const projections = useMemo(() => getFinancialProjections(db), [db]);
  const {
    avgMonthlyIncome,
    monthlyBills,
    plannedMonthlyAllowance,
    plannedMonthlyGroceries,
    plannedMonthlyOutflows,
    plannedMonthlySavings,
    actualMonthlyOutflows,
    actualMonthlySavings,
    effectiveMonthlySavings,
    savingsRatePct,
    goal,
  } = projections;

  const [horizonMonths, setHorizonMonths] = useState(12);
  const [useHysa, setUseHysa] = useState(false); // 4.5% APY High-Yield Savings simulator
  const [modalOpen, setModalOpen] = useState(false);
  const [boostMonthly, setBoostMonthly] = useState(0); // What-If scenario slider: +/- monthly savings
  const [lumpSum, setLumpSum] = useState(0); // What-If scenario lump sum

  // Goal Form State
  const [goalForm, setGoalForm] = useState({
    name: goal.name || 'Emergency Fund',
    target: String(goal.target || 1000),
    current: String(goal.current || 0),
    date: goal.date || '',
  });
  const [formError, setFormError] = useState('');

  const formatMoney = (amount) => {
    const num = Number(amount) || 0;
    return fmt?.format ? fmt.format(num) : `$${num.toFixed(2)}`;
  };

  const openEditGoal = () => {
    setGoalForm({
      name: goal.name || 'Emergency Fund',
      target: String(goal.target || 1000),
      current: String(goal.current || 0),
      date: goal.date || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const saveGoal = () => {
    const targetVal = parseFloat(goalForm.target);
    const currentVal = parseFloat(goalForm.current);
    if (!goalForm.name.trim()) {
      setFormError('Please provide a goal name.');
      return;
    }
    if (isNaN(targetVal) || targetVal <= 0) {
      setFormError('Please enter a target amount greater than zero.');
      return;
    }
    if (isNaN(currentVal) || currentVal < 0) {
      setFormError('Current balance cannot be negative.');
      return;
    }

    updateSetting({
      savings_goal_name: goalForm.name.trim(),
      savings_goal_target: targetVal,
      savings_goal_current: currentVal,
      savings_goal_date: goalForm.date || '',
    });
    setModalOpen(false);
  };

  // Adjusted figures for "What-If" scenario
  const scenarioMonthlySavings = Math.max(0, effectiveMonthlySavings + boostMonthly);
  const scenarioStartingBalance = Math.max(0, goal.current + lumpSum);
  const scenarioRemaining = Math.max(0, goal.target - scenarioStartingBalance);
  const scenarioMonthsToGoal =
    scenarioRemaining <= 0
      ? 0
      : scenarioMonthlySavings > 0
      ? scenarioRemaining / scenarioMonthlySavings
      : null;

  // ── Projection Chart Data ──────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const labels = [];
    const baselineData = [];
    const scenarioData = [];
    const targetLineData = [];

    const now = new Date();
    const annualRate = 0.045; // 4.5% APY
    const monthlyRate = annualRate / 12;

    for (let i = 0; i <= horizonMonths; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const label = i === 0 ? 'Now' : d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      labels.push(label);

      // Baseline projection
      let baseVal = goal.current;
      if (useHysa && monthlyRate > 0) {
        // Compound interest with monthly contribution
        baseVal =
          goal.current * Math.pow(1 + monthlyRate, i) +
          (effectiveMonthlySavings * (Math.pow(1 + monthlyRate, i) - 1)) / monthlyRate;
      } else {
        baseVal = goal.current + effectiveMonthlySavings * i;
      }
      baselineData.push(Math.round(baseVal));

      // Scenario projection
      let scenVal = scenarioStartingBalance;
      if (useHysa && monthlyRate > 0) {
        scenVal =
          scenarioStartingBalance * Math.pow(1 + monthlyRate, i) +
          (scenarioMonthlySavings * (Math.pow(1 + monthlyRate, i) - 1)) / monthlyRate;
      } else {
        scenVal = scenarioStartingBalance + scenarioMonthlySavings * i;
      }
      scenarioData.push(Math.round(scenVal));

      if (goal.target > 0) {
        targetLineData.push(goal.target);
      }
    }

    const datasets = [
      {
        label: useHysa ? 'Projected Balance (4.5% HYSA)' : 'Projected Balance',
        data: boostMonthly !== 0 || lumpSum !== 0 ? scenarioData : baselineData,
        fill: true,
        tension: 0.35,
        borderColor: '#38bdf8',
        borderWidth: 2.5,
        pointRadius: horizonMonths <= 12 ? 3.5 : 2,
        pointBackgroundColor: '#38bdf8',
        pointBorderColor: '#0c1424',
        pointBorderWidth: 2,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: canvasCtx, chartArea } = chart;
          if (!chartArea) return 'rgba(56,189,248,0.12)';
          const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(56,189,248,0.28)');
          gradient.addColorStop(1, 'rgba(56,189,248,0.01)');
          return gradient;
        },
      },
    ];

    if (boostMonthly !== 0 || lumpSum !== 0) {
      datasets.push({
        label: 'Current Baseline Pace',
        data: baselineData,
        fill: false,
        borderDash: [5, 5],
        borderColor: '#9ca3af',
        borderWidth: 1.5,
        pointRadius: 0,
      });
    }

    if (goal.target > 0) {
      datasets.push({
        label: `Goal Target (${formatMoney(goal.target)})`,
        data: targetLineData,
        fill: false,
        borderDash: [6, 4],
        borderColor: '#f59e0b',
        borderWidth: 2,
        pointRadius: 0,
      });
    }

    return { labels, datasets };
  }, [
    horizonMonths,
    useHysa,
    goal.current,
    goal.target,
    effectiveMonthlySavings,
    scenarioStartingBalance,
    scenarioMonthlySavings,
    boostMonthly,
    lumpSum,
  ]);

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

  // Milestones (25%, 50%, 75%, 100%)
  const milestones = useMemo(() => {
    if (!goal.target || goal.target <= 0) return [];
    return [0.25, 0.5, 0.75, 1.0].map((ratio) => {
      const amt = goal.target * ratio;
      const pct = Math.round(ratio * 100);
      const isReached = goal.current >= amt;
      let estArrival = null;
      if (isReached) {
        estArrival = 'Achieved';
      } else if (effectiveMonthlySavings > 0) {
        const remainingToMilestone = amt - goal.current;
        const months = remainingToMilestone / effectiveMonthlySavings;
        const d = new Date();
        d.setMonth(d.getMonth() + Math.ceil(months));
        estArrival = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      } else {
        estArrival = 'Pending savings';
      }
      return { pct, amt, isReached, estArrival };
    });
  }, [goal.target, goal.current, effectiveMonthlySavings]);

  const projectedFinalSavings = chartData.datasets[0]?.data?.[horizonMonths] || 0;

  return (
    <div className="p-4 sm:p-6 xl:p-8 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-text-main">Projections & Goals</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent-blue/15 text-accent-blue font-semibold border border-accent-blue/25">
              Forecast
            </span>
          </div>
          <p className="text-text-muted text-sm mt-0.5">
            Simulate financial trajectory, track savings velocity, and reach your goals.
          </p>
        </div>
        <button
          onClick={openEditGoal}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-accent-blue/10 border border-accent-blue/25 text-accent-blue text-sm font-semibold hover:bg-accent-blue/20 transition-colors w-fit"
        >
          <Target size={15} />
          {goal.target > 0 ? 'Edit Goal' : 'Set Savings Goal'}
        </button>
      </div>

      {/* ── Key Metrics Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Goal Card */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold flex items-center gap-1.5">
                <Target size={12} className="text-accent-yellow" />
                Savings Goal
              </span>
              <button
                onClick={openEditGoal}
                className="text-text-muted hover:text-accent-blue transition-colors p-1"
                title="Edit goal"
              >
                <Pencil size={12} />
              </button>
            </div>
            <p className="text-base font-bold text-text-main truncate">{goal.name}</p>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-extrabold text-accent-yellow">
                <AnimatedNumber value={goal.current} format={(v) => formatMoney(v)} />
              </span>
              <span className="text-xs text-text-muted">/ {formatMoney(goal.target)}</span>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-[11px] mb-1.5 font-medium">
              <span className="text-text-muted">{goal.progressPct.toFixed(1)}% complete</span>
              <span className="text-accent-yellow">
                {goal.remaining <= 0 ? 'Target Reached! 🎉' : `${formatMoney(goal.remaining)} left`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-amber-500 to-yellow-400"
                style={{ width: `${goal.progressPct}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Monthly Net Savings Card */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold flex items-center gap-1.5 mb-2">
              <TrendingUp size={12} className="text-accent-green" />
              Monthly Savings Pace
            </span>
            <div className="text-2xl font-extrabold text-accent-green mt-1">
              <AnimatedNumber value={effectiveMonthlySavings} format={(v) => formatMoney(v)} />
              <span className="text-xs font-normal text-text-muted ml-1">/mo</span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              {savingsRatePct.toFixed(1)}% of average monthly income ({formatMoney(avgMonthlyIncome)})
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
            <span className="text-text-muted">Net Run-Rate</span>
            <span className={effectiveMonthlySavings >= 0 ? 'text-accent-green font-semibold' : 'text-accent-red font-semibold'}>
              {effectiveMonthlySavings >= 0 ? '+' : ''}{formatMoney(effectiveMonthlySavings * 12)}/yr
            </span>
          </div>
        </Card>

        {/* Goal Arrival Estimation */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold flex items-center gap-1.5 mb-2">
              <Clock size={12} className="text-accent-blue" />
              Goal Target Arrival
            </span>
            <div className="text-xl font-extrabold text-text-main mt-1">
              {goal.remaining <= 0 ? (
                <span className="text-accent-green flex items-center gap-1.5 text-lg">
                  <CheckCircle2 size={18} /> Completed
                </span>
              ) : goal.monthsToGoal !== null ? (
                <span>
                  {goal.monthsToGoal <= 1
                    ? 'Within 1 month'
                    : `${goal.monthsToGoal.toFixed(1)} months`}
                </span>
              ) : (
                <span className="text-text-muted text-sm">Need positive savings</span>
              )}
            </div>
            {goal.estimatedCompletionDate && goal.remaining > 0 && (
              <p className="text-xs text-accent-blue mt-1">
                Est. {goal.estimatedCompletionDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] text-xs">
            {goal.date ? (
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Target Date</span>
                <span className="font-semibold text-text-main">{goal.date}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-text-muted">
                <span>Target Date</span>
                <span>Open-ended</span>
              </div>
            )}
          </div>
        </Card>

        {/* Goal Status Badge Card */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold flex items-center gap-1.5 mb-2">
              <ShieldCheck size={12} className="text-purple-400" />
              Pacing Feasibility
            </span>
            <div className="mt-1">
              {goal.remaining <= 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-green/15 text-accent-green border border-accent-green/25">
                  <CheckCircle2 size={12} /> Achieved
                </span>
              ) : goal.targetDateStatus === 'ahead' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-green/15 text-accent-green border border-accent-green/25">
                  <Sparkles size={12} /> Ahead of Pace
                </span>
              ) : goal.targetDateStatus === 'behind' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25">
                  <AlertCircle size={12} /> Needs ${Math.ceil(goal.requiredMonthlySavings - effectiveMonthlySavings)}/mo More
                </span>
              ) : goal.targetDateStatus === 'deficit' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-red/15 text-accent-red border border-accent-red/25">
                  <AlertCircle size={12} /> Deficit Spending
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-blue/15 text-accent-blue border border-accent-blue/25">
                  <ArrowUpRight size={12} /> Steady Progress
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted mt-2">
              {goal.requiredMonthlySavings
                ? `Requires ${formatMoney(goal.requiredMonthlySavings)}/mo to meet target date`
                : 'Pacing against ongoing savings rate'}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-text-muted">
            <span>Discretionary Cap</span>
            <span className="text-text-main font-semibold">{db?.settings?.spending_percentage || 35}%</span>
          </div>
        </Card>
      </div>

      {/* ── Trajectory Simulation Chart ──────────────────────────────────── */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-base font-bold text-text-main flex items-center gap-2">
              <TrendingUp size={16} className="text-accent-blue" />
              Accumulated Savings Trajectory
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Simulated net worth & savings growth starting from {formatMoney(goal.current)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* HYSA toggle */}
            <button
              onClick={() => setUseHysa(!useHysa)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                useHysa
                  ? 'bg-accent-green/20 border-accent-green/30 text-accent-green'
                  : 'bg-white/[0.03] border-white/[0.08] text-text-muted hover:text-text-main'
              }`}
              title="Toggle 4.5% APY High-Yield Savings compound interest"
            >
              <Zap size={12} className={useHysa ? 'text-accent-green' : 'text-text-muted'} />
              <span>4.5% APY {useHysa ? 'Active' : 'Off'}</span>
            </button>

            {/* Horizon selectors */}
            <div className="flex bg-white/[0.04] p-0.5 rounded-lg border border-white/[0.06]">
              {HORIZONS.map((h) => (
                <button
                  key={h.months}
                  onClick={() => setHorizonMonths(h.months)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    horizonMonths === h.months
                      ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="relative h-[260px] sm:h-[300px] w-full">
          <Line data={chartData} options={chartOptions} />
        </div>

        {/* Trajectory Insights Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/[0.06] text-xs">
          <div>
            <p className="text-text-muted">Starting Principal</p>
            <p className="text-sm font-bold text-text-main mt-0.5">{formatMoney(goal.current)}</p>
          </div>
          <div>
            <p className="text-text-muted">Monthly Contribution</p>
            <p className="text-sm font-bold text-accent-green mt-0.5">{formatMoney(effectiveMonthlySavings)}</p>
          </div>
          <div>
            <p className="text-text-muted">Projected at {horizonMonths} Mo.</p>
            <p className="text-sm font-bold text-accent-blue mt-0.5">{formatMoney(projectedFinalSavings)}</p>
          </div>
          <div>
            <p className="text-text-muted">Total Growth</p>
            <p className="text-sm font-bold text-accent-yellow mt-0.5">
              +{formatMoney(Math.max(0, projectedFinalSavings - goal.current))}
            </p>
          </div>
        </div>
      </Card>

      {/* ── Cash Flow Breakdown & Milestones Grid ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Cash Flow Model */}
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
              <DollarSign size={15} className="text-accent-green" />
              Monthly Cash Flow Model
            </h3>
            <span className="text-[11px] text-text-muted">Based on recorded data</span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-white/[0.04] text-xs">
              <span className="text-text-main font-medium">Estimated Monthly Income</span>
              <span className="font-semibold text-accent-green">{formatMoney(avgMonthlyIncome)}</span>
            </div>

            <div className="flex justify-between items-center py-1 text-xs text-text-muted pl-2 border-l-2 border-accent-red/40">
              <span>Recurring Committed Bills</span>
              <span className="text-accent-red font-medium">-{formatMoney(monthlyBills)}</span>
            </div>

            <div className="flex justify-between items-center py-1 text-xs text-text-muted pl-2 border-l-2 border-amber-500/40">
              <span>Grocery Budget Limit</span>
              <span className="text-amber-400 font-medium">-{formatMoney(plannedMonthlyGroceries)}</span>
            </div>

            <div className="flex justify-between items-center py-1 text-xs text-text-muted pl-2 border-l-2 border-accent-blue/40">
              <span>Discretionary Spending Cap ({db?.settings?.spending_percentage || 35}%)</span>
              <span className="text-accent-blue font-medium">-{formatMoney(plannedMonthlyAllowance)}</span>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-white/[0.08] text-xs font-bold">
              <span className="text-text-main">Projected Net Monthly Savings</span>
              <span className={effectiveMonthlySavings >= 0 ? 'text-accent-green text-sm' : 'text-accent-red text-sm'}>
                {formatMoney(effectiveMonthlySavings)}
              </span>
            </div>
          </div>

          {/* Quick Flow Ratio visual bar */}
          <div className="mt-5">
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden flex gap-0.5">
              <div
                title="Bills"
                className="h-full bg-accent-red/70 transition-all duration-500"
                style={{
                  width: `${avgMonthlyIncome > 0 ? Math.min(100, (monthlyBills / avgMonthlyIncome) * 100) : 0}%`,
                }}
              />
              <div
                title="Groceries"
                className="h-full bg-amber-400/70 transition-all duration-500"
                style={{
                  width: `${avgMonthlyIncome > 0 ? Math.min(100, (plannedMonthlyGroceries / avgMonthlyIncome) * 100) : 0}%`,
                }}
              />
              <div
                title="Discretionary"
                className="h-full bg-accent-blue/70 transition-all duration-500"
                style={{
                  width: `${avgMonthlyIncome > 0 ? Math.min(100, (plannedMonthlyAllowance / avgMonthlyIncome) * 100) : 0}%`,
                }}
              />
              <div
                title="Savings"
                className="h-full bg-accent-green transition-all duration-500"
                style={{
                  width: `${savingsRatePct}%`,
                }}
              />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-text-muted">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-accent-red/70 inline-block" /> Bills
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400/70 inline-block" /> Groceries
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-accent-blue/70 inline-block" /> Spending
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-accent-green inline-block" /> Saved ({savingsRatePct.toFixed(0)}%)
              </span>
            </div>
          </div>
        </Card>

        {/* Milestones Roadmap */}
        <Card className="p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                <Sparkles size={15} className="text-accent-yellow" />
                Goal Milestone Checkpoints
              </h3>
              <span className="text-[11px] text-text-muted">{goal.name}</span>
            </div>

            <div className="space-y-3">
              {milestones.length === 0 ? (
                <p className="text-text-muted text-xs py-4 text-center">
                  Set a goal target above zero to see your roadmap.
                </p>
              ) : (
                milestones.map((m) => (
                  <div
                    key={m.pct}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                      m.isReached
                        ? 'bg-accent-green/10 border-accent-green/20 text-accent-green'
                        : 'bg-white/[0.02] border-white/[0.05] text-text-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                          m.isReached ? 'bg-accent-green text-bg-outer' : 'bg-white/[0.06] text-text-muted'
                        }`}
                      >
                        {m.isReached ? <CheckCircle2 size={13} /> : `${m.pct}%`}
                      </div>
                      <div>
                        <p className={`font-semibold ${m.isReached ? 'text-accent-green' : 'text-text-main'}`}>
                          {m.pct}% Checkpoint ({formatMoney(m.amt)})
                        </p>
                        <p className="text-[10px] text-text-muted">
                          {m.isReached ? 'Completed' : `Need ${formatMoney(Math.max(0, m.amt - goal.current))} more`}
                        </p>
                      </div>
                    </div>
                    <span className="font-medium text-[11px]">{m.estArrival}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-text-muted">
            <span>Overall Progress</span>
            <span className="font-semibold text-accent-yellow">{goal.progressPct.toFixed(1)}%</span>
          </div>
        </Card>
      </div>

      {/* ── "What-If" Scenario Interactive Simulator ────────────────────── */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
              <Sliders size={15} className="text-accent-blue" />
              "What-If" Scenario Simulator
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Experiment with adjusting your monthly savings or applying a lump sum to see your goal date accelerate.
            </p>
          </div>
          {(boostMonthly !== 0 || lumpSum !== 0) && (
            <button
              onClick={() => {
                setBoostMonthly(0);
                setLumpSum(0);
              }}
              className="text-xs text-accent-blue hover:underline w-fit"
            >
              Reset simulation
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Monthly boost controls */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Monthly Savings Adjustment:</span>
              <span className="font-bold text-accent-blue">
                {boostMonthly >= 0 ? `+${formatMoney(boostMonthly)}` : formatMoney(boostMonthly)}/mo
              </span>
            </div>
            <div className="flex gap-2">
              {[-100, -50, 0, 50, 100, 200].map((val) => (
                <button
                  key={val}
                  onClick={() => setBoostMonthly(val)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    boostMonthly === val
                      ? 'bg-accent-blue/20 border-accent-blue text-accent-blue'
                      : 'bg-white/[0.03] border-white/[0.06] text-text-muted hover:text-text-main'
                  }`}
                >
                  {val > 0 ? `+${val}` : val === 0 ? 'Normal' : val}
                </button>
              ))}
            </div>
          </div>

          {/* Lump sum deposit controls */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">One-time Lump Sum Deposit:</span>
              <span className="font-bold text-accent-green">+{formatMoney(lumpSum)}</span>
            </div>
            <div className="flex gap-2">
              {[0, 250, 500, 1000, 2500].map((val) => (
                <button
                  key={val}
                  onClick={() => setLumpSum(val)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    lumpSum === val
                      ? 'bg-accent-green/20 border-accent-green text-accent-green'
                      : 'bg-white/[0.03] border-white/[0.06] text-text-muted hover:text-text-main'
                  }`}
                >
                  {val === 0 ? 'None' : `+$${val}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Outcome banner */}
        {(boostMonthly !== 0 || lumpSum !== 0) && (
          <div className="mt-5 p-3.5 rounded-lg bg-accent-blue/10 border border-accent-blue/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-bold text-text-main">
                Simulated Outcome:{' '}
                <span className="text-accent-blue">
                  {scenarioMonthsToGoal !== null ? `${scenarioMonthsToGoal.toFixed(1)} months to goal` : 'N/A'}
                </span>
                {goal.monthsToGoal !== null && scenarioMonthsToGoal !== null && (
                  <span className="text-accent-green ml-2 font-semibold">
                    ({Math.max(0, goal.monthsToGoal - scenarioMonthsToGoal).toFixed(1)} months faster!)
                  </span>
                )}
              </p>
              <p className="text-text-muted mt-0.5">
                New monthly pace: {formatMoney(scenarioMonthlySavings)}/mo | New starting balance: {formatMoney(scenarioStartingBalance)}
              </p>
            </div>
            <span className="text-accent-yellow font-bold text-sm shrink-0">
              +{formatMoney((scenarioMonthlySavings - effectiveMonthlySavings) * 12 + lumpSum)} saved / year
            </span>
          </div>
        )}
      </Card>

      {/* ── Edit Goal Modal ────────────────────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Configure Savings Goal">
        <div className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Goal Name</span>
            <input
              type="text"
              placeholder="e.g. Emergency Fund, New Car, Down Payment…"
              className="input-field"
              value={goalForm.name}
              onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Target Amount</span>
              <input
                type="number"
                step="0.01"
                min="1"
                placeholder="5000.00"
                className="input-field"
                value={goalForm.target}
                onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Current Saved (Starting Balance)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="input-field"
                value={goalForm.current}
                onChange={(e) => setGoalForm({ ...goalForm, current: e.target.value })}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Target Completion Date (Optional)</span>
            <input
              type="date"
              className="input-field"
              value={goalForm.date}
              onChange={(e) => setGoalForm({ ...goalForm, date: e.target.value })}
            />
          </label>

          {formError && <p className="text-accent-red text-xs">{formError}</p>}

          <div className="flex gap-2.5 mt-2">
            <button onClick={saveGoal} className="btn-primary flex-1">
              Save Goal
            </button>
            <button onClick={() => setModalOpen(false)} className="btn-ghost flex-1">
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
