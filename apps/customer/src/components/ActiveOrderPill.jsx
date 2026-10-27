import { Link, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Ring } from '@velan/shared/components/ui.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { stepsFor } from '@velan/shared/domain.js';
import { useOrders, activeOrders } from '../state/orders.js';

/** Floating live-order chip, shown everywhere except the tracker itself. */
export default function ActiveOrderPill() {
  const { t, status } = useLang();
  const { pathname } = useLocation();
  const active = useOrders(activeOrders);
  const o = active[0];
  const show = o && !pathname.startsWith('/track/') && !pathname.startsWith('/checkout');
  const steps = o ? stepsFor(o.type) : [];
  const progress = o ? (steps.indexOf(o.status) + 1) / steps.length : 0;
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="order-pill-wrap" initial={{ opacity: 0, y: 40, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
          <Link to={`/track/${o.id}`} className="order-pill">
            <Ring value={progress} size={44} stroke={4} color="var(--gold-400)" track="rgba(255,255,255,.15)">
              <Icon name={o.status === 'out_for_delivery' ? 'scooter' : o.status === 'placed' ? 'clock' : 'pot'} size={18} />
            </Ring>
            <span className="grow">
              <small>{t('orderNo', { n: o.number })}{active.length > 1 ? ` +${active.length - 1}` : ''}</small>
              <strong>{status(o)}</strong>
            </span>
            <span className="order-pill-cta">{t('trackLive')} <Icon name="arrowRight" size={15} /></span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
