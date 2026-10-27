// Street-poster pieces used across the website: the painted shop sign,
// scrolling ticker bands, starburst price stickers and slap-on stickers.
import { motion } from 'framer-motion';
import { VelMark } from './Brand.jsx';
import { useLang } from '../i18n.jsx';

/** The shop sign: வேலன் painted on a chilli-red board, the Vel beside it. */
export function Sign({ size = 'md', className = '' }) {
  const { ta } = useLang();
  return (
    <span className={`sign sign-${size} ${className}`}>
      <span className="sign-mark"><VelMark size={size === 'xl' ? 64 : size === 'lg' ? 46 : 32} color="#fff3dc" shine={false} /></span>
      <span className="sign-text">
        <b lang="ta">வேலன்</b>
        <small>{ta ? 'பிரியாணி சென்டர்' : 'Biryani Center'}</small>
      </span>
    </span>
  );
}

/** A painted band of words that scrolls forever; it pauses on hover and for reduced motion. */
export function Ticker({ items, tone = 'red', reverse = false, speed = 38, className = '' }) {
  const row = items.map((t, i) => <span key={i} className="tick-item">{t}<i aria-hidden="true">✸</i></span>);
  return (
    <div className={`ticker tone-${tone} ${reverse ? 'rev' : ''} ${className}`} style={{ '--tick-speed': `${speed}s` }}>
      <div className="tick-track" aria-hidden="true">{row}{row}</div>
      <span className="sr-only">{items.join(' · ')}</span>
    </div>
  );
}

const burstPoints = (n) => Array.from({ length: n * 2 }, (_, i) => {
  const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
  const r = i % 2 ? 0.8 : 1;
  return `${(Math.cos(a) * r).toFixed(3)},${(Math.sin(a) * r).toFixed(3)}`;
}).join(' ');

/** A starburst sticker, like a price flash on a shop poster. */
export function Burst({ children, tone = 'yellow', size = 128, points = 14, rotate = -8, className = '', delay = 0 }) {
  return (
    <motion.span className={`burst tone-${tone} ${className}`} style={{ width: size, height: size }}
      initial={{ scale: 1.6, rotate: rotate - 30, opacity: 0 }} animate={{ scale: 1, rotate, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 360, damping: 13, delay }} whileHover={{ rotate: rotate + 14, scale: 1.06 }}>
      <svg viewBox="-1.05 -1.05 2.1 2.1" aria-hidden="true"><polygon points={burstPoints(points)} /></svg>
      <span className="burst-text">{children}</span>
    </motion.span>
  );
}

/** Anything slapped on like a sticker: it lands with a bounce and wobbles when you point at it. */
export function Sticker({ children, rotate = 0, delay = 0, className = '', as = 'span', ...rest }) {
  const M = motion[as];
  return (
    <M className={`sticker ${className}`} initial={{ scale: 1.45, rotate: rotate - 12, opacity: 0 }} animate={{ scale: 1, rotate, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 340, damping: 15, delay }} whileHover={{ rotate: rotate + 3, scale: 1.04 }} {...rest}>
      {children}
    </M>
  );
}
