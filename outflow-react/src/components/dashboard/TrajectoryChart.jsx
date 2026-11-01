import { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useOutflowStore } from '../../store/useOutflowStore.jsx';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

export default function TrajectoryChart() {
  const { expensesByWeek, fmt } = useOutflowStore();
  const weeks = typeof expensesByWeek === 'function' ? (expensesByWeek(8) || []) : [];

  const labels = weeks.map((w) => w?.label || '');
  const weeklyTotals = weeks.map(
    (w) => (Number(w?.costTotal) || 0) + (Number(w?.personalTotal) || 0) + (Number(w?.groceryTotal) || 0)
  );

  const data = {
    labels,
    datasets: [
      {
        label: 'Weekly Spend',
        data: weeklyTotals,
        fill: true,
        tension: 0.4,
        borderColor: '#38bdf8',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#38bdf8',
        pointBorderColor: '#182234',
        pointBorderWidth: 2,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: canvasCtx, chartArea } = chart;
          if (!chartArea) return 'rgba(56,189,248,0.08)';
          const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(56,189,248,0.22)');
          gradient.addColorStop(1, 'rgba(56,189,248,0.00)');
          return gradient;
        },
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(12,20,36,0.95)',
        titleColor: '#9ca3af',
        bodyColor: '#f9fafb',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx) => ' ' + fmt.format(ctx.parsed.y),
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: { display: false },
        ticks: { color: '#6b7280', font: { size: 11 } },
        border: { display: false },
      },
      y: {
        display: true,
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: '#6b7280',
          font: { size: 11 },
          callback: (v) => fmt.format(v),
        },
        border: { display: false },
        beginAtZero: true,
      },
    },
    interaction: { mode: 'index', intersect: false },
  };

  return (
    <div className="relative h-[160px] w-full">
      <Line data={data} options={options} />
    </div>
  );
}
