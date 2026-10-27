// Hand-drawn SVG charts in the Velan palette: animated on entry, with hover read-outs.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const PALETTE = ['#d62b1e', '#2e4a8a', '#1f7a45', '#f5b323', '#e06a20', '#7a2a3a', '#78655a'];

function useWidth(initial = 600) {
  const ref = useRef(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.max(160, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Round a maximum up to a tidy axis value (1, 2, 2.5, 5 × 10^n). */
export function niceMax(v) {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

/** Smooth path through points without overshoot (horizontal tangents). */
function smooth(pts) {
  if (!pts.length) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i += 1) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  return d;
}

export const shortMoney = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `₹${Math.round(n)}`);

/**
 * Area chart with an optional dashed comparison line.
 * data: [{ label, value, prev }] · format(value) for the tooltip · axis(value) for ticks
 */
export function AreaChart({ data, height = 260, format = (v) => v, axis = format, labelOf = (d) => d.label, prevLabel, valueLabel }) {
  const [ref, w] = useWidth();
  const uid = useId().replace(/:/g, '');
  const [hover, setHover] = useState(null);
  const pad = { l: 46, r: 14, t: 18, b: 30 };
  const n = data.length;
  const max = niceMax(Math.max(1, ...data.map((d) => Math.max(d.value, d.prev || 0))));
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const x = (i) => pad.l + (n > 1 ? (i * iw) / (n - 1) : iw / 2);
  const y = (v) => pad.t + (1 - v / max) * ih;
  const pts = data.map((d, i) => [x(i), y(d.value)]);
  const prevPts = data.map((d, i) => [x(i), y(d.prev || 0)]);
  const line = smooth(pts);
  const area = n ? `${line} L${x(n - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z` : '';
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 70))));
  const hasPrev = data.some((d) => d.prev);
  const key = data.map((d) => d.value).join(',');

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const i = Math.round(((mx - pad.l) / (iw || 1)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div ref={ref} className="chart" style={{ height }}>
      <svg width={w} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img">
        <defs>
          <linearGradient id={`a${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d62b1e" stopOpacity="0.38" />
            <stop offset="1" stopColor="#d62b1e" stopOpacity="0" />
          </linearGradient>
          {/* user space: a flat line has a zero-height box, and a bounding-box gradient would not paint it */}
          <linearGradient id={`l${uid}`} gradientUnits="userSpaceOnUse" x1={pad.l} x2={w - pad.r} y1="0" y2="0">
            <stop offset="0" stopColor="#e43a2b" />
            <stop offset="1" stopColor="#d62b1e" />
          </linearGradient>
        </defs>
        {ticks.map((k) => (
          <g key={k}>
            <line x1={pad.l} x2={w - pad.r} y1={y(max * k)} y2={y(max * k)} className="chart-grid" />
            <text x={pad.l - 8} y={y(max * k) + 4} textAnchor="end" className="chart-axis">{axis(max * k)}</text>
          </g>
        ))}
        {data.map((d, i) => (i % every === 0 || i === n - 1) && (
          <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="chart-axis">{labelOf(d, i)}</text>
        ))}
        <motion.path key={`a${key}`} d={area} fill={`url(#a${uid})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.35 }} />
        {hasPrev && <path d={smooth(prevPts)} fill="none" className="chart-prev" />}
        <motion.path key={`l${key}`} d={line} fill="none" stroke={`url(#l${uid})`} strokeWidth="2.6" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }} />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="chart-cursor" />
            {hasPrev && <circle cx={x(hover)} cy={y(data[hover].prev || 0)} r="3.5" className="chart-dot-prev" />}
            <circle cx={x(hover)} cy={y(data[hover].value)} r="5.5" className="chart-dot" />
          </g>
        )}
      </svg>
      <AnimatePresence>
        {hover !== null && (
          <motion.div className="chart-tip" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ left: Math.min(w - 170, Math.max(0, x(hover) - 80)), top: Math.max(0, y(data[hover].value) - 74) }}>
            <b>{labelOf(data[hover], hover, true)}</b>
            <span><i className="sw gold" />{valueLabel ? `${valueLabel}: ` : ''}{format(data[hover].value)}</span>
            {hasPrev && <span className="subtle"><i className="sw dash" />{prevLabel ? `${prevLabel}: ` : ''}{format(data[hover].prev || 0)}</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Vertical bars (reports). */
export function Columns({ data, height = 240, format = (v) => v, axis = format, labelOf = (d) => d.label }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { l: 46, r: 8, t: 14, b: 30 };
  const n = data.length || 1;
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const slot = iw / n;
  const bw = Math.max(3, Math.min(34, slot * 0.62));
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 64))));
  return (
    <div ref={ref} className="chart" style={{ height }}>
      <svg width={w} height={height} onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((k) => (
          <g key={k}>
            <line x1={pad.l} x2={w - pad.r} y1={pad.t + (1 - k) * ih} y2={pad.t + (1 - k) * ih} className="chart-grid" />
            <text x={pad.l - 8} y={pad.t + (1 - k) * ih + 4} textAnchor="end" className="chart-axis">{axis(max * k)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = (d.value / max) * ih;
          const cx = pad.l + slot * i + slot / 2;
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)}>
              <rect x={pad.l + slot * i} y={pad.t} width={slot} height={ih} fill="transparent" />
              <motion.rect x={cx - bw / 2} width={bw} rx={Math.min(6, bw / 2)} className={`chart-col ${hover === i ? 'on' : ''}`}
                initial={{ y: pad.t + ih, height: 0 }} animate={{ y: pad.t + ih - h, height: h }}
                transition={{ duration: 0.7, delay: i * 0.015, ease: [0.22, 1, 0.36, 1] }} />
              {(i % every === 0) && <text x={cx} y={height - 8} textAnchor="middle" className="chart-axis">{labelOf(d, i)}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div className="chart-tip" style={{ left: Math.min(w - 160, Math.max(0, pad.l + slot * hover + slot / 2 - 70)), top: 0 }}>
          <b>{labelOf(data[hover], hover, true)}</b>
          <span>{format(data[hover].value)}</span>
          {data[hover].sub && <span className="subtle">{data[hover].sub}</span>}
        </div>
      )}
    </div>
  );
}

export function Sparkline({ values = [], width = 110, height = 34, color = '#d62b1e' }) {
  const uid = useId().replace(/:/g, '');
  if (values.length < 2) return <svg width={width} height={height} />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 3 - ((v - min) / (max - min || 1)) * (height - 6)]);
  const line = smooth(pts);
  return (
    <svg width={width} height={height} className="spark" aria-hidden="true">
      <defs>
        <linearGradient id={`s${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.3" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#s${uid})`} />
      <motion.path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: 'easeOut' }} />
    </svg>
  );
}

/** 7 × 24 busy-hours grid. heat[weekday][hour] = orders. */
export function Heatmap({ heat, dayName, hourLabel, unit }) {
  const [hover, setHover] = useState(null);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const used = useMemo(() => {
    const hours = [];
    for (let h = 0; h < 24; h += 1) if (heat.some((row) => row[h] > 0)) hours.push(h);
    const lo = Math.min(11, ...hours);
    const hi = Math.max(22, ...hours);
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }, [heat]);
  const max = Math.max(1, ...heat.flat());
  return (
    <div className="heat">
      <div className="heat-grid" style={{ gridTemplateColumns: `max-content repeat(${used.length}, minmax(14px, 1fr))` }}>
        {order.map((d, r) => (
          <div key={d} className="heat-row" style={{ display: 'contents' }}>
            <span className="heat-day">{dayName(d)}</span>
            {used.map((h, c) => {
              const v = heat[d][h];
              const a = v ? 0.12 + 0.88 * (v / max) : 0;
              return (
                <motion.span key={h} className="heat-cell" onMouseEnter={() => setHover({ d, h, v })} onMouseLeave={() => setHover(null)}
                  style={{ background: v ? `rgba(210,154,53,${a})` : undefined, boxShadow: v / max > 0.75 ? '0 0 0 1px rgba(168,116,31,.5) inset' : undefined }}
                  initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: (r * used.length + c) * 0.002, duration: 0.3 }} />
              );
            })}
          </div>
        ))}
        <span />
        {used.map((h) => <span key={h} className="heat-hour">{h % 3 === 0 ? hourLabel(h) : ''}</span>)}
      </div>
      <div className="heat-foot">
        <span className="subtle">{hover ? `${dayName(hover.d)} · ${hourLabel(hover.h)} — ${hover.v} ${unit}` : ' '}</span>
        <span className="heat-scale"><i style={{ opacity: 0.2 }} /><i style={{ opacity: 0.45 }} /><i style={{ opacity: 0.7 }} /><i /></span>
      </div>
    </div>
  );
}

/** Donut with legend. segments: [{ label, value, color }] */
export function Donut({ segments, size = 168, thickness = 20, center, sub }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const [hover, setHover] = useState(null);
  let acc = 0;
  return (
    <div className="donut">
      <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={thickness} />
          {segments.map((s, i) => {
            const len = (s.value / total) * c;
            const off = acc;
            acc += len;
            return (
              <motion.circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color || PALETTE[i % PALETTE.length]}
                strokeWidth={hover === i ? thickness + 6 : thickness} strokeDashoffset={-off}
                initial={{ strokeDasharray: `0 ${c}` }} animate={{ strokeDasharray: `${Math.max(0, len - 2)} ${c}` }}
                transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer', transition: 'stroke-width .2s' }} />
            );
          })}
        </svg>
        <div className="donut-center">
          <b>{hover !== null ? `${Math.round((segments[hover].value / total) * 100)}%` : center}</b>
          <span>{hover !== null ? segments[hover].label : sub}</span>
        </div>
      </div>
      <ul className="legend">
        {segments.map((s, i) => (
          <li key={s.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={hover === i ? 'on' : ''}>
            <i style={{ background: s.color || PALETTE[i % PALETTE.length] }} />
            <span className="grow ellipsis">{s.label}</span>
            <b className="num">{s.display ?? s.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bar list. rows: [{ key, label, sub, value, display, image }] */
export function BarList({ rows, color = 'gold' }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="barlist">
      {rows.map((r, i) => (
        <li key={r.key}>
          {r.image !== undefined && (r.image ? <img src={r.image} alt="" loading="lazy" /> : <span className="barlist-ph" />)}
          <div className="grow">
            <div className="row" style={{ gap: 8 }}>
              <span className="grow ellipsis barlist-label">{r.label}</span>
              <b className="num">{r.display ?? r.value}</b>
            </div>
            <div className="barlist-track">
              <motion.span className={`barlist-fill ${color}`} initial={{ width: 0 }} animate={{ width: `${(r.value / max) * 100}%` }}
                transition={{ duration: 0.9, delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] }} />
            </div>
            {r.sub && <span className="subtle barlist-sub">{r.sub}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
