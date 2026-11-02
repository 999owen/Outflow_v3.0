import { useState, useEffect, useRef } from 'react';

/**
 * Reusable animated + interactive weekly bar chart.
 *
 * Props:
 *  weeks        – array of { label, total, key }
 *  maxHeight    – max bar height in px (default 48)
 *  formatMoney  – (number) => string
 *  accentColor  – base color for "this week" bar  (default '#FBBF24')
 *  dimColor     – color for past bars             (default 'rgba(251,191,36,0.25)')
 */
export default function WeeklyBars({
  weeks = [],
  maxHeight = 48,
  formatMoney,
  accentColor = '#FBBF24',
  dimColor = 'rgba(251,191,36,0.25)',
}) {
  const [hovered, setHovered] = useState(null);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef(null);

  // Trigger grow-from-bottom animation on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const weekMax = Math.max(...weeks.map((w) => Number(w?.total) || 0), 1);

  // Brighten a color slightly for hover — works for both hex and rgba
  function brightenColor(color) {
    if (color.startsWith('#')) {
      const num = parseInt(color.slice(1), 16);
      const r = Math.min(255, Math.round(((num >> 16) & 0xff) * 1.0 + 40));
      const g = Math.min(255, Math.round(((num >> 8) & 0xff) * 1.0 + 40));
      const b = Math.min(255, Math.round((num & 0xff) * 1.0 + 40));
      return `rgb(${r},${g},${b})`;
    }
    // for rgba strings bump alpha to 1 and lighten
    return accentColor;
  }

  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}>
      {weeks.map((w, idx) => {
        const totalVal = Number(w?.total) || 0;
        const isThisWeek = w?.label === 'This Week';
        const targetH = Math.max((totalVal / weekMax) * maxHeight, totalVal > 0 ? 4 : 2);
        const isHov = hovered === idx;

        const baseColor = isThisWeek ? accentColor : dimColor;
        const barColor = isHov ? brightenColor(baseColor) : baseColor;
        const barHeight = mounted ? (isHov ? targetH + 3 : targetH) : 0;

        return (
          <div
            key={w?.key || idx}
            className="flex flex-col items-center gap-1"
            style={{ position: 'relative' }}
            onMouseEnter={() => setHovered(idx)}
            onMouseLeave={() => setHovered(null)}
          >
            {/* Tooltip */}
            {isHov && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: 4,
                  background: 'rgba(12,20,36,0.97)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  padding: '3px 8px',
                  whiteSpace: 'nowrap',
                  zIndex: 50,
                  pointerEvents: 'none',
                }}
              >
                <p className="text-[10px] font-semibold text-white">
                  {w?.label}
                </p>
                <p className="text-[10px] text-text-muted">
                  {formatMoney ? formatMoney(totalVal) : `$${totalVal.toFixed(2)}`}
                </p>
              </div>
            )}

            {/* Bar container */}
            <div
              className="flex items-end w-full justify-center"
              style={{ height: maxHeight }}
            >
              <div
                className="w-full rounded-t"
                style={{
                  height: barHeight,
                  background: barColor,
                  transition: 'height 0.55s cubic-bezier(0.34,1.3,0.64,1), background 0.15s ease',
                  transformOrigin: 'bottom',
                  cursor: 'default',
                }}
              />
            </div>

            <span className="text-[9px] text-text-muted text-center leading-tight">
              {w?.label || '—'}
            </span>
            <span className="text-[9px] text-text-muted">
              {formatMoney ? formatMoney(totalVal) : `$${totalVal.toFixed(2)}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
