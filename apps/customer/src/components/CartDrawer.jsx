import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Sheet, Seg, VegMark, Empty } from '@velan/shared/components/ui.jsx';
import { useMediaQuery } from '@velan/shared/hooks.js';
import { useSite } from '../state/site.js';
import { useCart, cart, cartLines, openCart, addOne, removeOne, cartCount } from '../state/cart.js';
import { requireLogin } from '../state/session.js';
import { usePricing } from '../state/pricing.js';
import { BillRows, CouponBox } from './Bill.jsx';

/** "Add ₹120 more for free delivery" bar with a scooter riding along it. */
export function FreeDeliveryBar({ gap, freeAbove }) {
  const { t, money } = useLang();
  if (gap === null || gap === undefined || !freeAbove) return null;
  const pct = Math.min(1, 1 - gap / freeAbove);
  return (
    <div className={`free-bar ${gap === 0 ? 'done' : ''}`}>
      <p>{gap === 0 ? t('freeDeliveryYes') : t('freeDeliveryGap', { gap: money(gap) })}</p>
      <div className="free-track">
        <motion.span className="free-fill" initial={false} animate={{ width: `${pct * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        <motion.span className="free-scooter" initial={false} animate={{ left: `${pct * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }}>
          <Icon name="scooter" size={16} />
        </motion.span>
      </div>
    </div>
  );
}

export default function CartDrawer() {
  const { t, tr, pick, other, money } = useLang();
  const navigate = useNavigate();
  const open = useCart((s) => s.open);
  const state = useCart((s) => s);
  const items = useSite((s) => s.items);
  const settings = useSite((s) => s.settings);
  const phone = useMediaQuery('(max-width: 640px)');
  const lines = cartLines(state, items);
  const count = cartCount(state);
  const { data: pricing, loading } = usePricing();
  const extras = items.filter((i) => i.categoryId === 'cat_sweets' && i.available !== false && i.stock > 0 && !state.lines[i.id]).slice(0, 5);

  const checkout = () => {
    openCart(false);
    requireLogin(() => navigate('/checkout'), 'register');
  };

  return (
    <Sheet open={open} onClose={() => openCart(false)} side={phone ? 'bottom' : 'right'} className="cart-sheet" label={t('cart')}>
      <div className="cart-head">
        <div>
          <h3 className="display">{t('cart')}</h3>
          <small className="subtle">{count ? t('items', { n: count }) : ''}</small>
        </div>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => openCart(false)} aria-label={t('close')}><Icon name="x" /></button>
      </div>

      {lines.length === 0 ? (
        <div className="cart-empty">
          <Empty icon="bag" title={t('emptyCart')}>{t('emptyCartSub')}</Empty>
          <button type="button" className="btn btn-primary" onClick={() => { openCart(false); setTimeout(() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' }), 300); }}>
            {t('exploreMenu')}
          </button>
        </div>
      ) : (
        <>
          <div className="cart-body" data-lenis-prevent>
            <Seg value={state.type} onChange={(type) => cart.set({ type })} className="cart-type"
              options={[{ value: 'delivery', label: t('type.delivery'), icon: 'scooter' }, { value: 'pickup', label: t('type.pickup'), icon: 'store' }]} />
            {state.type === 'delivery' && <FreeDeliveryBar gap={pricing?.freeDeliveryGap} freeAbove={settings?.freeAbove} />}

            <ul className="cart-lines">
              <AnimatePresence initial={false}>
                {lines.map(({ item, qty }) => (
                  <motion.li key={item.id} layout initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30, height: 0, marginBottom: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
                    <img src={item.image} alt="" />
                    <div className="grow">
                      <div className="row" style={{ gap: 6 }}><VegMark veg={item.veg} /><strong className="ellipsis">{pick(item, 'name')}</strong></div>
                      <small className="subtle">{other(item, 'name')}</small>
                      <span className="cart-line-price num">{money(item.price * qty)}</span>
                    </div>
                    <div className="stepper sm">
                      <button type="button" onClick={() => removeOne(item.id)} aria-label="−"><Icon name={qty === 1 ? 'trash' : 'minus'} size={14} /></button>
                      <span className="num">{qty}</span>
                      <button type="button" onClick={() => addOne(item.id)} disabled={qty >= item.stock} aria-label="+"><Icon name="plus" size={14} /></button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>

            {pricing?.issues?.length > 0 && (
              <div className="cart-issues">
                {pricing.issues.map((i) => (
                  <p key={i.id}><Icon name="alert" size={15} /> {t(`err.${i.code}`, i.params)}</p>
                ))}
              </div>
            )}

            {extras.length > 0 && (
              <div className="cart-extras">
                <p className="eyebrow">{t('completeMeal')}</p>
                <div className="cart-extras-row">
                  {extras.map((x) => (
                    <button key={x.id} type="button" className="extra" onClick={() => addOne(x.id)}>
                      <img src={x.image} alt="" loading="lazy" />
                      <span className="ellipsis">{pick(x, 'name')}</span>
                      <small>{money(x.price)} <Icon name="plus" size={13} /></small>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="field">
              <span className="field-label">{t('instructions')}</span>
              <textarea className="textarea" rows={2} value={state.notes} placeholder={t('instructionsHint')} onChange={(e) => cart.set({ notes: e.target.value })} />
            </label>

            <CouponBox pricing={pricing} />
            <p className="eyebrow" style={{ marginTop: 6 }}>{t('billDetails')}</p>
            <BillRows bill={pricing?.bill} type={state.type} loading={loading} />
            {state.type === 'delivery' && <p className="subtle cart-note">{tr('Delivery fee is final once you pin your address.', 'முகவரியைப் பின் செய்த பிறகு டெலிவரி கட்டணம் உறுதியாகும்.')}</p>}
          </div>
          <div className="cart-foot">
            {state.type === 'delivery' && pricing?.minOrderGap > 0 && <p className="cart-warn">{t('minOrderGap', { gap: money(pricing.minOrderGap) })}</p>}
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={checkout}
              disabled={!pricing || (state.type === 'delivery' && pricing.minOrderGap > 0) || !pricing.status?.open}>
              {pricing && !pricing.status?.open ? t('paused') : (
                <><span>{t('checkout')}</span><span className="grow" /><span className="num">{pricing ? money(pricing.bill.total) : ''}</span><Icon name="arrowRight" size={18} /></>
              )}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
