// Bill rows + coupon box, shared by the cart drawer and checkout.
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { AnimatedNumber } from '@velan/shared/components/ui.jsx';
import { cart, useCart } from '../state/cart.js';
import { useSite } from '../state/site.js';
import { offerLine } from '../lib/offers.js';

export function BillRows({ bill, type, loading, quote }) {
  const { t, money } = useLang();
  if (!bill) return <div className="bill"><div className="skeleton" style={{ height: 120 }} /></div>;
  const row = (label, value, cls = '') => (
    <div className={`bill-row ${cls}`}><span>{label}</span><span className="num">{value}</span></div>
  );
  return (
    <div className={`bill ${loading ? 'loading' : ''}`}>
      {row(t('bill.subtotal'), money(bill.subtotal))}
      {bill.packing > 0 && row(t('bill.packing'), money(bill.packing))}
      {type === 'delivery' && row(
        <>{t('bill.deliveryFee')}{quote ? <small> · {quote.distanceKm} km</small> : null}</>,
        bill.deliveryFee === 0 ? <span className="free">{t('bill.free')}</span> : money(bill.deliveryFee),
      )}
      {bill.discount > 0 && row(t('bill.discount'), `− ${money(bill.discount)}`, 'saving')}
      {bill.tax > 0 && row(t('bill.tax'), money(bill.tax))}
      <div className="bill-total">
        <span>{t('bill.total')}</span>
        <span className="display num">₹<AnimatedNumber value={bill.total} duration={0.6} /></span>
      </div>
      {bill.savings > 0 && (
        <motion.p className="bill-savings" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <Icon name="sparkles" size={15} /> {t('youSave', { amount: money(bill.savings) })}
        </motion.p>
      )}
    </div>
  );
}

export function CouponBox({ pricing }) {
  const { t, tr, money, pick, error } = useLang();
  const applied = useCart((s) => s.coupon);
  const offers = useSite((s) => s.offers);
  const [code, setCode] = useState('');
  const [open, setOpen] = useState(false);
  const ok = pricing?.coupon;
  const err = pricing?.couponError;
  const apply = (c) => { cart.set({ coupon: c.trim().toUpperCase() }); setCode(''); setOpen(false); };

  return (
    <div className="coupon">
      <AnimatePresence mode="wait" initial={false}>
        {applied ? (
          <motion.div key="on" className={`coupon-on ${err ? 'bad' : ''}`} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
            <Icon name={err ? 'alert' : 'ticket'} size={20} />
            <span className="grow">
              <strong>{applied}</strong>
              <small>{err ? error(err) : ok ? (pick(ok, 'title') || tr('Coupon applied', 'கூப்பன் பயன்படுத்தப்பட்டது')) : t('loading')}</small>
            </span>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => cart.set({ coupon: '' })}>{t('remove')}</button>
          </motion.div>
        ) : (
          <motion.div key="off" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <form className="coupon-form" onSubmit={(e) => { e.preventDefault(); if (code.trim()) apply(code); }}>
              <div className="input-group grow">
                <Icon name="ticket" size={17} className="icon" />
                <input className="input input-sm" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('coupon')} style={{ textTransform: 'uppercase' }} />
              </div>
              <button type="submit" className="btn btn-sm btn-outline" disabled={!code.trim()}>{t('apply')}</button>
            </form>
            {offers.length > 0 && (
              <button type="button" className="coupon-see" onClick={() => setOpen((v) => !v)}>
                {tr('{n} offers available', '{n} சலுகைகள் உள்ளன', { n: offers.length })} <Icon name={open ? 'chevronUp' : 'chevronDown'} size={15} />
              </button>
            )}
            <AnimatePresence>
              {open && (
                <motion.ul className="coupon-list" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  {offers.map((o) => (
                    <li key={o.code}>
                      <button type="button" onClick={() => apply(o.code)}>
                        <code>{o.code}</code>
                        <span className="grow"><strong>{offerLine(o, { tr, money })}</strong><small>{pick(o, 'title')}</small></span>
                        <span className="coupon-apply">{t('apply')}</span>
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
