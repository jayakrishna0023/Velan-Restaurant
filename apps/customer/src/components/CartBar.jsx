// The order, always one tap away: a bar that rises from the bottom once
// something is in the cart, with the running total, a nudge toward free
// delivery, and the button to open the order.
import { useEffect } from 'react';
import { AnimatePresence, motion, useSpring, useTransform } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { useSite } from '../state/site.js';
import { useCart, cartLines, cartCount, openCart } from '../state/cart.js';
import { useUi } from '../state/ui.js';
import { RollText } from '../lib/motion.jsx';

function Total({ value }) {
  const { money } = useLang();
  const v = useSpring(value, { stiffness: 140, damping: 22 });
  useEffect(() => { v.set(value); }, [v, value]);
  const text = useTransform(v, (n) => money(Math.round(n)));
  return <motion.span className="num">{text}</motion.span>;
}

export default function CartBar() {
  const { t, tr, money } = useLang();
  const state = useCart((s) => s);
  const items = useSite((s) => s.items);
  const settings = useSite((s) => s.settings);
  const plateInView = useUi((s) => s.plateInView);
  const lines = cartLines(state, items);
  const count = cartCount(state);
  const total = lines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const free = state.type === 'delivery' && settings?.freeAbove ? settings.freeAbove : 0;
  const gap = free ? Math.max(0, free - total) : 0;

  return (
    <AnimatePresence>
      {count > 0 && !state.open && !plateInView && (
        <motion.div className="cart-bar" initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
          <motion.button type="button" className="cart-bar-btn" onClick={() => openCart(true)} key={state.bump}
            animate={{ scale: [1, 1.025, 1] }} transition={{ duration: 0.45 }}>
            <span className="cart-bar-imgs">
              <AnimatePresence initial={false}>
                {lines.slice(0, 3).map((l) => (
                  <motion.img key={l.item.id} src={l.item.image} alt="" layout initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} />
                ))}
              </AnimatePresence>
            </span>
            <span className="cart-bar-info">
              <strong>{t('items', { n: count })} · <Total value={total} /></strong>
              <small>
                {free ? (gap > 0 ? tr('Add {m} more for free delivery', 'இலவச டெலிவரிக்கு இன்னும் {m}', { m: money(gap) }) : tr('Free delivery unlocked', 'இலவச டெலிவரி கிடைத்தது'))
                  : t(`type.${state.type}`)}
              </small>
              {free > 0 && <span className="cart-bar-meter"><motion.i animate={{ scaleX: Math.min(1, total / free) }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} /></span>}
            </span>
            <span className="cart-bar-cta"><RollText>{tr('View order', 'ஆர்டரைப் பார்')} <Icon name="arrowRight" size={16} /></RollText></span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
