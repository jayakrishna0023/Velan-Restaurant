import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Modal, VegMark } from '@velan/shared/components/ui.jsx';
import { useSite } from '../state/site.js';
import { useUi, openDish } from '../state/ui.js';
import { useCart, addOne } from '../state/cart.js';
import { AddControl, Badges, Spice } from './DishCard.jsx';
import Steam from './Steam.jsx';

export default function DishModal() {
  const { t, tr, pick, other, money, num } = useLang();
  const id = useUi((s) => s.dishId);
  const items = useSite((s) => s.items);
  const categories = useSite((s) => s.categories);
  const qty = useCart((s) => (id ? s.lines[id] || 0 : 0));
  const img = useRef(null);
  const item = items.find((i) => i.id === id);
  const cat = categories.find((c) => c.id === item?.categoryId);
  // Pair savoury dishes with something sweet/cool, and sweets with a biryani.
  const pairs = item
    ? items.filter((i) => i.id !== item.id && i.available !== false && i.stock > 0
      && (item.categoryId === 'cat_sweets' ? i.categoryId === 'cat_biryani' && i.bestseller : i.categoryId === 'cat_sweets' || (i.categoryId === 'cat_starters' && i.bestseller)))
      .slice(0, 3)
    : [];

  return (
    <Modal open={!!item} onClose={() => openDish(null)} width={880} className="dish-modal">
      {item && (
        <div className="dm-grid">
          <div className="dm-media">
            <motion.img ref={img} src={item.image} alt={pick(item, 'name')} initial={{ scale: 1.15 }} animate={{ scale: 1 }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
            {/* Hot dishes steam; sweets and drinks do not. */}
            {item.categoryId !== 'cat_sweets' && <Steam source={{ x: 0.5, y: 0.42, w: 0.5 }} intensity={1.1} />}
            <span className="dish-badges"><Badges item={item} /></span>
            <button type="button" className="dm-close" onClick={() => openDish(null)} aria-label={t('close')}><Icon name="x" size={20} /></button>
          </div>
          <div className="dm-body" data-lenis-prevent>
            <p className="eyebrow">{cat ? pick(cat, 'name') : ''}</p>
            <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
              <h3 className="display dm-title">{pick(item, 'name')}</h3>
              <span style={{ marginTop: 10 }}><VegMark veg={item.veg} title={item.veg ? t('veg') : t('nonveg')} /></span>
            </div>
            <p className="dm-alt">{other(item, 'name')}</p>
            <p className="dm-desc">{pick(item, 'description')}</p>
            {other(item, 'description') && <p className="dm-desc-alt">{other(item, 'description')}</p>}
            <div className="dm-facts">
              {item.spicy > 0 && <div><span>{t('spicy')}</span><Spice level={item.spicy} /></div>}
              {item.sold30d > 0 && <div><span>{tr('Popular', 'பிரபலம்')}</span><strong>{t('soldMonth', { n: num(item.sold30d) })}</strong></div>}
              {item.stock > 0 && item.stock <= 10 && <div><span>{tr('Today', 'இன்று')}</span><strong className="dish-low">{t('onlyLeft', { n: item.stock })}</strong></div>}
            </div>
            <div className="dm-buy">
              <div>
                <span className="price display">{money(item.price)}</span>
                {qty > 0 && <small className="subtle"> × {qty} = {money(item.price * qty)}</small>}
              </div>
              <AddControl item={item} imgRef={img} size="lg" />
            </div>
            {pairs.length > 0 && (
              <div className="dm-pairs">
                <p className="eyebrow">{tr('Goes well with', 'இதனுடன் சேர்த்து')}</p>
                <div className="dm-pairs-row">
                  {pairs.map((p) => (
                    <button key={p.id} type="button" className="pair" onClick={() => openDish(p.id)}>
                      <img src={p.image} alt="" loading="lazy" />
                      <span className="grow">
                        <strong className="ellipsis">{pick(p, 'name')}</strong>
                        <small>{money(p.price)}</small>
                      </span>
                      <span className="pair-add" role="button" tabIndex={0} aria-label={t('add')}
                        onClick={(e) => { e.stopPropagation(); addOne(p.id); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); addOne(p.id); } }}>
                        <Icon name="plus" size={16} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
