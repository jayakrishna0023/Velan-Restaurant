// Today's coupons as tickets; tapping one applies it to the order.
import { motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { toast } from '@velan/shared/components/ui.jsx';
import { useSite } from '../state/site.js';
import { cart, useCart } from '../state/cart.js';
import { offerLine } from '../lib/offers.js';
import { ease } from '../lib/motion.jsx';

export default function OffersStrip() {
  const { tr, pick, money } = useLang();
  const offers = useSite((s) => s.offers);
  const applied = useCart((s) => s.coupon);
  if (!offers.length) return null;
  return (
    <section className="offers" aria-label={tr('Offers', 'சலுகைகள்')}>
      <div className="container offers-row">
        {offers.slice(0, 3).map((o, i) => {
          const on = applied === o.code;
          return (
            <motion.button key={o.code} type="button" className={`ticket ${on ? 'on' : ''}`} aria-pressed={on}
              onClick={() => { cart.set({ coupon: o.code }); toast.success(tr('{c} will be applied at checkout', '{c} செக்அவுட்டில் சேர்க்கப்படும்', { c: o.code })); }}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '0px 0px 120px 0px' }} transition={{ delay: i * 0.06, duration: 0.5, ease }}>
              <span className="ticket-icon"><Icon name={o.type === 'percent' || o.type === 'flat' ? 'percent' : 'scooter'} size={20} /></span>
              <span className="ticket-body">
                <strong>{offerLine(o, { tr, money })}</strong>
                <small>{pick(o, 'title') || (o.minOrder ? tr('On orders over {m}', '{m}க்கு மேல்', { m: money(o.minOrder) }) : '')}</small>
              </span>
              <span className="ticket-code">
                <b>{o.code}</b>
                <em>{on ? <><Icon name="check" size={13} /> {tr('Applied', 'சேர்க்கப்பட்டது')}</> : tr('Tap to apply', 'சேர்க்க தட்டவும்')}</em>
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
