// The order as a parcel bill: a thermal receipt beside the menu that prints a
// line for every dish you add (and reprints it when the count changes), with
// the total, the free-delivery nudge, today's coupons and the order button.
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { toast } from '@velan/shared/components/ui.jsx';
import { useNow } from '@velan/shared/hooks.js';
import { useSite } from '../state/site.js';
import { cart, useCart, cartLines, cartCount, openCart, addOne, removeOne } from '../state/cart.js';
import { requireLogin } from '../state/session.js';
import { ui } from '../state/ui.js';
import { offerLine } from '../lib/offers.js';

export default function Receipt() {
  const { tr, pick, money, dateTime } = useLang();
  const navigate = useNavigate();
  const state = useCart((s) => s);
  const items = useSite((s) => s.items);
  const settings = useSite((s) => s.settings);
  const offers = useSite((s) => s.offers);
  const now = useNow(60_000);
  const lines = cartLines(state, items);
  const count = cartCount(state);
  const total = lines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const free = state.type === 'delivery' && settings?.freeAbove ? settings.freeAbove : 0;
  const gap = free ? Math.max(0, free - total) : 0;
  const feed = useAnimationControls();
  const ref = useRef(null);

  // The paper jumps a little as the printer feeds a new line.
  useEffect(() => {
    if (state.bump) feed.start({ y: [-7, 2, 0], transition: { duration: 0.45, delay: 0.5 } });
  }, [state.bump, feed]);

  // While the bill is on screen the floating order bar steps aside.
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => ui.set({ plateInView: e.isIntersecting }));
    if (ref.current) io.observe(ref.current);
    return () => { io.disconnect(); ui.set({ plateInView: false }); };
  }, []);

  const checkout = () => requireLogin(() => navigate('/checkout'), 'register');

  return (
    <aside ref={ref} className="rcpt" aria-label={tr('Your order', 'உங்கள் ஆர்டர்')}>
      <motion.div className="rcpt-paper" animate={feed} data-plate-target>
        <header className="rcpt-head">
          <b>VELAN BIRYANI CENTER</b>
          <span lang="ta">வேலன் பிரியாணி சென்டர்</span>
          <span>Uniyur · Karur</span>
          <strong>{tr('Parcel bill', 'பார்சல் பில்')}</strong>
          <small>{dateTime(now)}</small>
        </header>

        {lines.length ? (
          <ul className="rcpt-lines">
            <AnimatePresence initial={false}>
              {lines.map((l) => (
                <motion.li key={l.item.id} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
                  <span className="rcpt-print" key={l.qty}>
                    <span className="rcpt-qty">{l.qty}×</span>
                    <span className="rcpt-name">{pick(l.item, 'name')}</span>
                    <span className="rcpt-amt">{money(l.item.price * l.qty)}</span>
                  </span>
                  <span className="rcpt-ctl">
                    <button type="button" onClick={() => removeOne(l.item.id)} aria-label={tr('One less', 'ஒன்று குறை')}><Icon name="minus" size={13} stroke={2.4} /></button>
                    <button type="button" onClick={() => addOne(l.item.id)} disabled={l.qty >= l.item.stock} aria-label={tr('One more', 'இன்னொன்று')}><Icon name="plus" size={13} stroke={2.4} /></button>
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <p className="rcpt-empty">{tr('Nothing printed yet. Tap ADD on any dish.', 'இன்னும் எதுவும் இல்லை. எந்த உணவிலும் “சேர்” தட்டுங்கள்.')}</p>
        )}

        <dl className="rcpt-sum">
          <div><dt>{tr('Items', 'உணவுகள்')}</dt><dd>{count}</dd></div>
          {free > 0 && (
            <div><dt>{tr('Delivery', 'டெலிவரி')}</dt><dd>{gap > 0 ? tr('{m} more = free', 'இன்னும் {m} = இலவசம்', { m: money(gap) }) : tr('Free', 'இலவசம்')}</dd></div>
          )}
        </dl>
        <div className="rcpt-total"><span>{tr('Total', 'மொத்தம்')}</span><b className="num">{money(total)}</b></div>

        {offers.length > 0 && (
          <div className="rcpt-coupons">
            {offers.slice(0, 3).map((o) => (
              <button key={o.code} type="button" className={state.coupon === o.code ? 'on' : ''} aria-pressed={state.coupon === o.code}
                onClick={() => { cart.set({ coupon: o.code }); toast.success(tr('{c} will be applied at checkout', '{c} செக்அவுட்டில் சேர்க்கப்படும்', { c: o.code })); }}>
                <b>{o.code}</b><span>{offerLine(o, { tr, money })}</span>{state.coupon === o.code && <Icon name="check" size={13} />}
              </button>
            ))}
          </div>
        )}
        <span className="rcpt-barcode" aria-hidden="true" />
        <p className="rcpt-thanks">நன்றி! · Thank you!</p>
      </motion.div>

      {lines.length > 0 && (
        <>
          <button type="button" className="pbtn pbtn-red pbtn-block" onClick={checkout}>
            {tr('Place order', 'ஆர்டர் செய்')} · <span className="num">{money(total)}</span> <Icon name="arrowRight" size={18} />
          </button>
          <button type="button" className="rcpt-more" onClick={() => openCart(true)}>{tr('Add notes, switch to pickup or review', 'குறிப்பு, பிக்கப் அல்லது சரிபார்')}</button>
        </>
      )}
    </aside>
  );
}
