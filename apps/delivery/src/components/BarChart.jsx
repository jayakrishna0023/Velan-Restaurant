// 7-day earnings bars (animated SVG). days: [{ day: 'YYYY-MM-DD', earnings, deliveries }]
import { useId } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';

export default function BarChart({ days = [] }) {
  const { dayName, money } = useLang();
  const uid = useId().replace(/:/g, '');
  const W = 320;
  const H = 168;
  const top = 26;
  const base = H - 28;
  const max = Math.max(1, ...days.map((d) => d.earnings));
  const slot = W / Math.max(1, days.length);
  const bw = Math.min(30, slot * 0.56);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="r-bars" role="img" aria-label="Earnings, last 7 days">
      <defs>
        <linearGradient id={`gb${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F8E3B0" />
          <stop offset="1" stopColor="#B07A22" />
        </linearGradient>
      </defs>
      {[0.5, 1].map((f) => (
        <line key={f} x1="0" x2={W} y1={base - (base - top) * f} y2={base - (base - top) * f} className="r-bars-grid" />
      ))}
      {days.map((d, i) => {
        const h = d.earnings ? Math.max(6, ((base - top) * d.earnings) / max) : 3;
        const x = i * slot + (slot - bw) / 2;
        const today = i === days.length - 1;
        const wd = new Date(`${d.day}T12:00:00+05:30`).getDay();
        return (
          <g key={d.day}>
            <motion.rect x={x} width={bw} rx={8} fill={today ? `url(#gb${uid})` : 'currentColor'} className={today ? '' : 'r-bars-bar'}
              initial={{ y: base, height: 0 }} animate={{ y: base - h, height: h }}
              transition={{ delay: 0.15 + i * 0.07, type: 'spring', stiffness: 160, damping: 20 }} />
            {(today || d.earnings === max) && d.earnings > 0 && (
              <motion.text x={x + bw / 2} y={base - h - 8} textAnchor="middle" className="r-bars-val"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 + i * 0.05 }}>
                {money(d.earnings)}
              </motion.text>
            )}
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" className={`r-bars-day ${today ? 'today' : ''}`}>{dayName(wd).slice(0, 3)}</text>
          </g>
        );
      })}
    </svg>
  );
}
