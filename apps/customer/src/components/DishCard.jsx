import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { spring } from '@velan/shared/components/ui.jsx';
import { itemBadges } from '@velan/shared/domain.js';
import { useCart, addOne, removeOne } from '../state/cart.js';
import { flyToCart } from '../lib/motion.jsx';

export function Spice({ level }) {
  const { t } = useLang();
  if (!level) return null;
  return (
    <span className="spice" title={t('spicy')} aria-label={`${t('spicy')} ${level}/3`}>
      {[1, 2, 3].map((n) => <Icon key={n} name="flame" size={13} className={n <= level ? 'on' : ''} />)}
    </span>
  );
}

export function Badges({ item }) {
  const { t } = useLang();
  return itemBadges(item).map((b) => <span key={b} className={`dish-badge badge-${b}`}>{t(b)}</span>);
}

/** ADD button that morphs into a − qty + stepper. */
export function AddControl({ item, imgRef, size = 'md' }) {
  const { t } = useLang();
  const qty = useCart((s) => s.lines[item.id] || 0);
  if (item.stock <= 0 || item.available === false) return <span className="sold-pill">{t('soldOut')}</span>;
  return (
    <motion.div layout transition={spring} className={`add-ctl size-${size} ${qty ? 'has' : ''}`}>
      <AnimatePresence initial={false} mode="popLayout">
        {qty === 0 ? (
          <motion.button key="add" type="button" className="add-btn" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            onClick={(e) => { e.stopPropagation(); addOne(item.id); flyToCart(imgRef?.current); }}>
            {t('add')} <Icon name="plus" size={15} stroke={2.4} />
          </motion.button>
        ) : (
          <motion.div key="step" className="stepper" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
            <button type="button" aria-label="−" onClick={(e) => { e.stopPropagation(); removeOne(item.id); }}><Icon name="minus" size={15} stroke={2.4} /></button>
            <span className="num" aria-live="polite">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={qty} initial={{ y: -14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 14, opacity: 0 }} transition={{ duration: 0.18 }} style={{ display: 'inline-block' }}>
                  {qty}
                </motion.span>
              </AnimatePresence>
            </span>
            <button type="button" aria-label="+" disabled={qty >= item.stock} onClick={(e) => { e.stopPropagation(); addOne(item.id); }}><Icon name="plus" size={15} stroke={2.4} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
