import { useOutflowStore } from '../../store/useOutflowStore.jsx';
import Card from '../ui/Card.jsx';
import { useState, useRef, useCallback } from 'react';
import { ExternalLink } from 'lucide-react';

const BILL_COLORS = ['#60A5FA','#4ADE80','#F87171','#FBBF24','#A78BFA','#F472B6','#34D399','#38BDF8'];

// Lighten a hex color by mixing with white
function lightenHex(hex, amount = 0.3) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * amount));
  const g = Math.min(255, Math.round(((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * amount));
  const b = Math.min(255, Math.round((num & 0xff) + (255 - (num & 0xff)) * amount));
  return `rgb(${r},${g},${b})`;
}

// Custom SVG doughnut with hover interactivity
function InteractiveDoughnut({ bills, colors, formatMoney, totalCommitted }) {
  const [hovered, setHovered] = useState(null);
  const svgRef = useRef(null);

  const size = 80;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 36;
  const innerR = 26;
  const hoverGrow = 4;

  const total = bills.reduce((acc, b, i) => acc + (Number(b._cost) || 0), 0) || 1;

  // Build arc segments
  const segments = [];
  let startAngle = -Math.PI / 2;
  bills.forEach((b, i) => {
    const val = Number(b._cost) || 0;
    const sweep = (val / total) * 2 * Math.PI;
    segments.push({ bill: b, color: colors[i % colors.length], startAngle, sweep, val });
    startAngle += sweep;
  });

  function donut(seg, isHovered) {
    const r  = isHovered ? outerR + hoverGrow : outerR;
    const ir = isHovered ? innerR + hoverGrow : innerR;
    const start = seg.startAngle;
    const end   = start + seg.sweep;
    const large = seg.sweep > Math.PI ? 1 : 0;

    // Outer arc endpoints
    const ox1 = cx + r * Math.cos(start);
    const oy1 = cy + r * Math.sin(start);
    const ox2 = cx + r * Math.cos(end);
    const oy2 = cy + r * Math.sin(end);

    // Inner arc endpoints (traced counter-clockwise back to start)
    const ix1 = cx + ir * Math.cos(end);
    const iy1 = cy + ir * Math.sin(end);
    const ix2 = cx + ir * Math.cos(start);
    const iy2 = cy + ir * Math.sin(start);

    return [
      `M ${ox1} ${oy1}`,                              // move to outer-start
      `A ${r} ${r} 0 ${large} 1 ${ox2} ${oy2}`,       // outer arc → clockwise
      `L ${ix1} ${iy1}`,                               // line to inner-end
      `A ${ir} ${ir} 0 ${large} 0 ${ix2} ${iy2}`,     // inner arc ← counter-clockwise
      'Z',
    ].join(' ');
  }

  const hovSeg = hovered !== null ? segments[hovered] : null;
  const pct = hovSeg ? ((hovSeg.val / total) * 100).toFixed(1) : null;

  // Build a hit-area path at a fixed size slightly larger than the max hover size.
  // This never changes, so growing/shrinking the visual path can't trigger
  // a mouse-enter/leave feedback loop.
  function hitPath(seg) {
    const r  = outerR + hoverGrow + 3;   // slightly beyond max visual size
    const ir = Math.max(innerR - 3, 0);  // slightly inside the hole
    const start = seg.startAngle;
    const end   = start + seg.sweep;
    const large = seg.sweep > Math.PI ? 1 : 0;
    const ox1 = cx + r * Math.cos(start), oy1 = cy + r * Math.sin(start);
    const ox2 = cx + r * Math.cos(end),   oy2 = cy + r * Math.sin(end);
    const ix1 = cx + ir * Math.cos(end),  iy1 = cy + ir * Math.sin(end);
    const ix2 = cx + ir * Math.cos(start),iy2 = cy + ir * Math.sin(start);
    return [
      `M ${ox1} ${oy1}`,
      `A ${r} ${r} 0 ${large} 1 ${ox2} ${oy2}`,
      `L ${ix1} ${iy1}`,
      `A ${ir} ${ir} 0 ${large} 0 ${ix2} ${iy2}`,
      'Z',
    ].join(' ');
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ overflow: 'visible' }}
      >
        {/* Visual layer — pointer-events disabled so it never interferes */}
        {segments.map((seg, i) => (
          <path
            key={i}
            d={donut(seg, hovered === i)}
            fill={hovered === i ? lightenHex(seg.color, 0.25) : seg.color}
            style={{
              transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
              filter: hovered === i ? `drop-shadow(0 0 4px ${seg.color}88)` : 'none',
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Hit-area layer — fixed size, transparent, handles all mouse events */}
        {segments.map((seg, i) => (
          <path
            key={'hit-' + i}
            d={hitPath(seg)}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {hovSeg ? (
          <div className="flex flex-col items-center leading-tight">
            <span className="text-[9px] font-bold text-white">{pct}%</span>
            <span className="text-[8px] text-text-muted">{formatMoney(hovSeg.val)}</span>
          </div>
        ) : (
          <span className="text-[10px] text-text-muted font-semibold text-center leading-tight">
            {bills.length}<br />bills
          </span>
        )}
      </div>
      {/* Tooltip */}
      {hovSeg && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            background: 'rgba(12,20,36,0.97)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            padding: '4px 8px',
            whiteSpace: 'nowrap',
          }}
        >
          <p className="text-[10px] font-semibold text-white">{hovSeg.bill?.name}</p>
          <p className="text-[10px] text-text-muted">{pct}% · {formatMoney(hovSeg.val)}</p>
        </div>
      )}
    </div>
  );
}

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

  // Attach cost to each bill for the custom doughnut
  const billsWithCost = activeBills.map((b) => ({ ...b, _cost: getBillCost(b) }));

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
          {/* Interactive doughnut */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative shrink-0" style={{ width: 80, height: 80 }}>
              <InteractiveDoughnut
                bills={billsWithCost}
                colors={BILL_COLORS}
                formatMoney={formatMoney}
                totalCommitted={totalCommitted}
              />
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
