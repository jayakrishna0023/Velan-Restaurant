// The tracker's emblem: a thin brass ring with the stage's line icon. While
// the order is in progress a fine arc travels slowly around the ring; on
// delivery the ring closes and a check mark is drawn.
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@velan/shared/components/Icon.jsx';

const ICON = { placed: 'receipt', accepted: 'checkCircle', preparing: 'pot', ready: 'bag', out_for_delivery: 'scooter', rejected: 'x', cancelled: 'x' };

export default function StatusArt({ status }) {
  const done = status === 'delivered';
  const off = status === 'rejected' || status === 'cancelled';
  return (
    <div className={`status-art ${off ? 'off' : ''}`}>
      <svg viewBox="0 0 120 120" className="status-ring" aria-hidden="true">
        <circle cx="60" cy="60" r="56" className="sr-track" />
        {!done && !off && <circle cx="60" cy="60" r="56" className="sr-arc" />}
        {done && (
          <motion.circle cx="60" cy="60" r="56" className="sr-full" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: [0.2, 0.7, 0.2, 1] }} />
        )}
      </svg>
      <AnimatePresence mode="wait">
        <motion.span key={status} className="status-icon" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
          {done ? (
            <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
              <motion.path d="M12 25l8 8 16-17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: 0.6 }} />
            </svg>
          ) : (
            <Icon name={ICON[status] || 'clock'} size={38} stroke={1.3} />
          )}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
