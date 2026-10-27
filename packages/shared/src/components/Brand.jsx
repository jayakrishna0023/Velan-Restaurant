// Brand art: the Vel emblem (compact mark and full seal) and the wordmark.
import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useLang } from '../i18n.jsx';

// ---------- geometry (200 × 200 artboard, centre 100,100) ----------
const r2 = (n) => Math.round(n * 100) / 100;
const polar = (r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [100 + r * Math.cos(a), 100 + r * Math.sin(a)];
};

/** A curry-leaf sprig growing clockwise along a circle from `from`° to `to`°. */
function sprig(r, from, to, step, size) {
  const [x0, y0] = polar(r, from);
  const [x1, y1] = polar(r, to);
  const stem = `M${r2(x0)} ${r2(y0)}A${r} ${r} 0 0 1 ${r2(x1)} ${r2(y1)}`;
  const tangent = (deg) => {
    const a = (deg * Math.PI) / 180;
    return (Math.atan2(Math.cos(a), -Math.sin(a)) * 180) / Math.PI;
  };
  const leaves = [];
  let side = 1;
  for (let a = from + step * 0.55; a < to - step * 0.4; a += step) {
    const [x, y] = polar(r, a);
    leaves.push({ x: r2(x), y: r2(y), rot: r2(tangent(a) + side * 40), s: r2(size / 9) });
    side = -side;
  }
  leaves.push({ x: r2(x1), y: r2(y1), rot: r2(tangent(to)), s: r2((size * 1.15) / 9) });
  return { stem, leaves };
}

const LEAF = 'M0 0C3-3.3 7-2.7 9 0 7 2.7 3 3.3 0 0Z';
const SEAL_SPRIG = sprig(49, 116, 202, 11, 8.6);
const MARK_SPRIG = sprig(68, 118, 206, 14, 13);
const TICKS = Array.from({ length: 120 }, (_, i) => {
  const [ax, ay] = polar(88.5, i * 3);
  const [bx, by] = polar(i % 5 === 0 ? 93.5 : 91.6, i * 3);
  return `M${r2(ax)} ${r2(ay)}L${r2(bx)} ${r2(by)}`;
}).join('');

const CUT = 'var(--velmark-cut, rgba(255,255,255,.4))';

/** The Vel: an engraved spearhead over a lotus collar, crossbar and banded shaft. */
function Vel({ paint }) {
  return (
    <>
      <path d="M100 46C108 56 116 68 115.5 79 115 88 108 93 100 98 92 93 85 88 84.5 79 84 68 92 56 100 46Z" fill={paint} />
      <path d="M100 56.5C105 62.8 109 70.2 108.7 78 108.4 84.3 104.8 88 100 91 95.2 88 91.6 84.3 91.3 78 91 70.2 95 62.8 100 56.5Z" fill="none" stroke={CUT} strokeWidth="1.1" />
      <path d="M100 61V87.5" stroke={CUT} strokeWidth="1" />
      <path d="M100 99.6 104 103.6 100 107.6 96 103.6Z" fill={paint} />
      <path d="M100 108.4C94 108.4 89 110.8 86.4 114.8 91.6 113.6 96 112.4 100 112.4S108.4 113.6 113.6 114.8C111 110.8 106 108.4 100 108.4Z" fill={paint} />
      <rect x="86" y="116.2" width="28" height="2.8" rx="1.4" fill={paint} />
      <circle cx="84.4" cy="117.6" r="2.5" fill={paint} />
      <circle cx="115.6" cy="117.6" r="2.5" fill={paint} />
      <rect x="98.5" y="119.4" width="3" height="34.6" rx="1.5" fill={paint} />
      <rect x="96.5" y="127.4" width="7" height="2" rx="1" fill={paint} />
      <rect x="96.5" y="141.4" width="7" height="2" rx="1" fill={paint} />
      <path d="M100 153.6 103 157.2 100 160.8 97 157.2Z" fill={paint} />
    </>
  );
}

/** Both sprigs; leaves grow in one after another when `grow` is set. */
function Sprigs({ data, paint, stem, grow, delay = 0, tempo = 1 }) {
  const half = (key) => (
    <g key={key} transform={key === 'r' ? 'translate(200 0) scale(-1 1)' : undefined}>
      <motion.path d={data.stem} fill="none" stroke={paint} strokeWidth={stem} strokeLinecap="round"
        {...(grow ? { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 1.2 * tempo, delay, ease: [0.65, 0, 0.35, 1] } } : {})} />
      {data.leaves.map((l, i) => (
        <g key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.rot}) scale(${l.s})`}>
          <motion.path d={LEAF} fill={paint} style={{ originX: 0, originY: 0.5 }}
            {...(grow ? { initial: { scale: 0 }, animate: { scale: 1 }, transition: { delay: delay + (0.25 + i * 0.09) * tempo, duration: 0.6 * tempo, ease: [0.2, 0.7, 0.2, 1] } } : {})} />
        </g>
      ))}
    </g>
  );
  return <>{half('l')}{half('r')}</>;
}

/** A band of light that sweeps across the brass every few seconds. */
function Sheen({ id, highlight, delay, period }) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="200" y2="200" gradientTransform="translate(-210 -210)">
      <stop offset="0" stopColor="currentColor" />
      <stop offset="0.42" stopColor="currentColor" />
      <stop offset="0.5" stopColor={highlight} />
      <stop offset="0.58" stopColor="currentColor" />
      <stop offset="1" stopColor="currentColor" />
      <animateTransform attributeName="gradientTransform" type="translate" values="-210 -210;210 210;210 210"
        keyTimes="0;0.3;1" dur={`${period}s`} begin={`${delay}s`} repeatCount="indefinite" />
    </linearGradient>
  );
}

/**
 * Compact emblem for headers, buttons and icons: a double ring with four
 * studs, the Vel and two curry-leaf sprigs. `plain` keeps only the Vel.
 */
export function VelMark({ size = 44, className = '', plain = false, color = 'var(--velmark, #ab8646)', shine = true, highlight = '#f6e6bf' }) {
  const uid = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const live = shine && !reduce;
  const paint = live ? `url(#vm${uid})` : 'currentColor';
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className={`velmark ${className}`} aria-hidden="true" style={{ color }}>
      {live && <defs><Sheen id={`vm${uid}`} highlight={highlight} delay={1.2} period={7} /></defs>}
      {!plain && (
        <>
          <circle cx="100" cy="100" r="95" fill="none" stroke={paint} strokeWidth="4" />
          <circle cx="100" cy="100" r="85.5" fill="none" stroke={paint} strokeWidth="1.6" />
          {[0, 90, 180, 270].map((a) => {
            const [x, y] = polar(90.2, a);
            return <circle key={a} cx={r2(x)} cy={r2(y)} r="2.2" fill={paint} />;
          })}
          <Sprigs data={MARK_SPRIG} paint={paint} stem={2} />
        </>
      )}
      <g transform={plain ? 'translate(100 103) scale(1.55) translate(-100 -103)' : 'translate(100 103) scale(1.24) translate(-100 -103)'}>
        <Vel paint={paint} />
      </g>
    </svg>
  );
}

/**
 * The full seal: a ticked bezel that turns slowly, "VELAN BIRYANI CENTER"
 * across the top, வேலன் பிரியாணி சென்டர் across the bottom, and the Vel
 * between curry-leaf sprigs. `draw` animates it in (preloader, sign-in).
 */
export function VelSeal({ size = 160, className = '', color = 'var(--velmark, #ab8646)', spin = true, draw = false, tempo = 1, shine = true, highlight = '#f6e6bf' }) {
  const uid = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const live = !reduce;
  const paint = shine && live ? `url(#vs${uid})` : 'currentColor';
  const grow = draw && live;
  // `tempo` scales every duration and delay of the draw-in (0.5 = twice as fast).
  const ring = (delay) => (grow ? { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 1.6 * tempo, delay: delay * tempo, ease: [0.65, 0, 0.35, 1] } } : {});
  const fade = (delay, from = {}) => (grow ? { initial: { opacity: 0, ...from }, animate: { opacity: 1, y: 0, rotate: 0, scale: 1 }, transition: { duration: 1.2 * tempo, delay: delay * tempo, ease: [0.2, 0.7, 0.2, 1] } } : {});
  const text = { fontFamily: 'var(--font-ui)', fontSize: 10.6, fontWeight: 600 };
  const tamil = { fontFamily: 'var(--font-tamil)', fontSize: 10.8, fontWeight: 500 };
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className={`velseal ${className}`} aria-hidden="true" style={{ color, overflow: 'visible' }}>
      <defs>
        {shine && live && <Sheen id={`vs${uid}`} highlight={highlight} delay={draw ? 2.6 : 1.2} period={6.5} />}
        <path id={`top${uid}`} d="M31.4 75A73 73 0 0 1 168.6 75" fill="none" />
        <path id={`bot${uid}`} d="M20.6 128.9A84.5 84.5 0 0 0 179.4 128.9" fill="none" />
      </defs>
      <motion.circle cx="100" cy="100" r="97" fill="none" stroke={paint} strokeWidth="1.4" strokeLinecap="round" {...ring(0)} />
      <motion.g {...fade(0.35)}>
        <motion.path d={TICKS} stroke={paint} strokeWidth="0.8" fill="none"
          animate={spin && live ? { rotate: 360 } : undefined} style={{ originX: 0.5, originY: 0.5 }}
          transition={{ duration: 120, repeat: Infinity, ease: 'linear' }} />
      </motion.g>
      <motion.g {...fade(0.7, { rotate: -14 })} style={{ originX: 0.5, originY: 0.5 }}>
        <text fill={paint} style={text}>
          <textPath href={`#top${uid}`} startOffset="50%" textAnchor="middle" textLength="168" lengthAdjust="spacing">VELAN BIRYANI CENTER</textPath>
        </text>
        <text fill={paint} style={tamil}>
          <textPath href={`#bot${uid}`} startOffset="50%" textAnchor="middle">வேலன் பிரியாணி சென்டர்</textPath>
        </text>
        {[180, 0].map((a) => {
          const [x, y] = polar(78, a);
          return <path key={a} d="M0-3.2 1.1-1.1 3.2 0 1.1 1.1 0 3.2-1.1 1.1-3.2 0-1.1-1.1Z" fill={paint} transform={`translate(${r2(x)} ${r2(y)})`} />;
        })}
      </motion.g>
      <motion.circle cx="100" cy="100" r="63" fill="none" stroke={paint} strokeWidth="1.1" strokeLinecap="round" {...ring(0.45)} />
      <motion.circle cx="100" cy="100" r="60.4" fill="none" stroke={paint} strokeWidth="0.5" strokeLinecap="round" {...ring(0.6)} />
      <Sprigs data={SEAL_SPRIG} paint={paint} stem={1.1} grow={grow} delay={1.1 * tempo} tempo={tempo} />
      <motion.g {...fade(0.95, { y: 10 })}>
        <g transform="translate(100 103) scale(0.9) translate(-100 -103)"><Vel paint={paint} /></g>
      </motion.g>
    </svg>
  );
}

/** Mark + "Velan / Biryani Center" in the current language. */
export function Wordmark({ size = 42, tone = 'auto', sub = true, className = '' }) {
  const { ta } = useLang();
  return (
    <span className={`wordmark ${className}`} data-tone={tone} style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      <VelMark size={size} />
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ fontFamily: ta ? 'var(--font-tamil)' : 'var(--font-display)', fontWeight: 500, fontSize: size * (ta ? 0.46 : 0.66), letterSpacing: ta ? 0 : '0.04em' }}>
          {ta ? 'வேலன்' : 'Velan'}
        </span>
        {sub && (
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: Math.max(8.5, size * 0.2), fontWeight: 600, letterSpacing: ta ? '0.02em' : '0.3em', textTransform: 'uppercase', opacity: 0.7, marginTop: ta ? 5 : 6 }}>
            {ta ? 'பிரியாணி சென்டர்' : 'Biryani Center'}
          </span>
        )}
      </span>
    </span>
  );
}
