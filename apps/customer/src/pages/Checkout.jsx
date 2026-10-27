import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { VegMark, toast, spring } from '@velan/shared/components/ui.jsx';
import { MapView } from '@velan/shared/map.jsx';
import { addressLine } from '@velan/shared/geo.js';
import { deliveryQuote } from '@velan/shared/domain.js';
import { useAsync } from '@velan/shared/hooks.js';
import { sound, askNotify } from '@velan/shared/effects.js';
import { api, useSession, requireLogin } from '../state/session.js';
import { useSite } from '../state/site.js';
import { cart, useCart, cartLines, cartPayload, clearCart, addOne, removeOne } from '../state/cart.js';
import { trackOrderUpdate } from '../state/orders.js';
import { usePricing } from '../state/pricing.js';
import { BillRows, CouponBox } from '../components/Bill.jsx';
import { FreeDeliveryBar } from '../components/CartDrawer.jsx';
import StoreStatus from '../components/StoreStatus.jsx';
import AddressForm, { emptyDraft, pinConfirmed } from '../components/AddressForm.jsx';

const LABEL_ICON = { home: 'home', work: 'work', other: 'pin' };

function Block({ n, title, children, done }) {
  return (
    <motion.section className="co-block" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: n * 0.08, ease: [0.22, 1, 0.36, 1] }}>
      <header>
        <span className={`co-num ${done ? 'done' : ''}`}>{done ? <Icon name="check" size={16} stroke={2.6} /> : n}</span>
        <h2>{title}</h2>
      </header>
      {children}
    </motion.section>
  );
}

export default function Checkout() {
  const { t, tr, pick, other, money, km, error, hhmm } = useLang();
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const ready = useSession((s) => s.ready);
  const settings = useSite((s) => s.settings);
  const items = useSite((s) => s.items);
  const state = useCart((s) => s);
  const lines = cartLines(state, items);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [saveAddr, setSaveAddr] = useState(true);
  const [payment, setPayment] = useState('cash');
  const [placing, setPlacing] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (ready && !user) requireLogin(null, 'register'); }, [ready, user]);
  const addresses = useAsync(() => (user ? api.get('/me/addresses') : Promise.resolve(null)), [user?.id]);
  const saved = addresses.data || [];
  // Decide only once this customer's addresses have arrived: on a page refresh the
  // session restores a moment after the page, and an empty first answer must not
  // leave checkout stuck on "add a new address".
  useEffect(() => {
    if (addresses.loading || !user || addresses.data == null) return;
    if (saved.length && !selected) { setSelected(saved[0].id); setAdding(false); }
    if (!saved.length) setAdding(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses.loading, addresses.data, user?.id]);

  // Older saved addresses only have a single line; it goes in the first field.
  const editSaved = (a) => {
    setDraft({ ...emptyDraft(), ...a, door: a.door || (a.street || a.area ? '' : a.line), accuracy: a.accuracy ?? null, confirmedAt: a.confirmed ? { lat: a.lat, lng: a.lng } : null });
    setEditingId(a.id);
    setSaveAddr(true);
    setAdding(true);
  };

  const delivery = state.type === 'delivery';
  const chosen = saved.find((a) => a.id === selected);
  const point = delivery ? (adding ? (draft.lat ? draft : null) : chosen) : null;
  const { data: pricing, loading } = usePricing({ lat: point?.lat, lng: point?.lng });
  const quote = pricing?.quote;
  const quoteFor = useMemo(() => (a) => (settings ? deliveryQuote(settings, a, pricing?.bill?.subtotal || 0) : null), [settings, pricing?.bill?.subtotal]);

  const problems = [];
  if (pricing && !pricing.status.open) problems.push(t('err.CLOSED'));
  if (delivery && !point) problems.push(t('err.ADDRESS_REQUIRED'));
  if (delivery && adding && point && !draft.door.trim()) problems.push(tr('Add your house / flat number so the rider finds your door.', 'டெலிவரி பார்ட்னர் வாசலைக் கண்டுபிடிக்க வீட்டு எண்ணைச் சேர்க்கவும்.'));
  if (delivery && adding && point && !pinConfirmed(draft)) problems.push(tr('Confirm the pin on the map is your house.', 'வரைபடத்தில் உள்ள பின் உங்கள் வீடுதான் என உறுதிசெய்யுங்கள்.'));
  if (delivery && quote && !quote.deliverable) problems.push(t('err.OUT_OF_RANGE', { km: settings.deliveryRadiusKm, distance: quote.distanceKm }));
  if (delivery && pricing?.minOrderGap > 0) problems.push(t('minOrderGap', { gap: money(pricing.minOrderGap) }));
  if (pricing?.couponError && state.coupon) problems.push(error(pricing.couponError));

  const place = async () => {
    setErr('');
    setPlacing(true);
    try {
      const typed = { ...draft, line: addressLine(draft), confirmed: pinConfirmed(draft) };
      const address = delivery ? (adding ? typed : chosen) : undefined;
      // Editing a saved address updates it in place instead of saving a copy.
      if (delivery && adding && editingId && saveAddr) await api.put(`/me/addresses/${editingId}`, typed);
      const order = await api.post('/orders', {
        items: cartPayload(state), type: state.type, address, paymentMethod: payment, notes: state.notes,
        coupon: state.coupon || undefined, saveAddress: delivery && adding && saveAddr && !editingId,
      });
      trackOrderUpdate(order);
      clearCart();
      sound.success();
      askNotify().catch(() => {});
      navigate(`/track/${order.id}`, { replace: true, state: { fresh: true } });
    } catch (ex) {
      setErr(error(ex));
      sound.error();
      toast.error(error(ex));
    } finally {
      setPlacing(false);
    }
  };

  if (!lines.length) {
    return (
      <section className="page narrow center-page">
        <Icon name="bag" size={48} className="gold" />
        <h1 className="display">{t('emptyCart')}</h1>
        <p className="muted">{t('emptyCartSub')}</p>
        <Link to="/" className="btn btn-primary">{t('exploreMenu')}</Link>
      </section>
    );
  }

  return (
    <section className="page checkout">
      <div className="container">
        <div className="co-top">
          <Link to="/" className="btn btn-ghost btn-sm"><Icon name="arrowLeft" size={16} /> {t('nav.menu')}</Link>
          <div>
            <h1 className="display">{t('checkout')}</h1>
            <p className="co-alt">{tr('செக்அவுட்', 'Checkout')}</p>
          </div>
          <StoreStatus />
        </div>

        <div className="co-grid">
          <div className="co-main">
            <Block n={1} title={tr('How would you like it?', 'எப்படி வேண்டும்?')} done>
              <div className="co-types">
                {[['delivery', 'scooter', tr('Home delivery', 'வீட்டுக்கு டெலிவரி'), tr('Hot to your door, tracked live', 'சூடாக வீட்டு வாசலுக்கு, நேரலை கண்காணிப்புடன்')],
                  ['pickup', 'store', tr('Pickup', 'நேரில் பெறுதல்'), tr('Ready in about {m} min at the counter', 'சுமார் {m} நிமிடத்தில் கவுண்டரில் தயார்', { m: settings?.avgPrepMins || 20 })]].map(([v, icon, title, sub]) => (
                  <button key={v} type="button" className={`co-type ${state.type === v ? 'on' : ''}`} onClick={() => cart.set({ type: v })}>
                    {state.type === v && <motion.span layoutId="co-type" className="co-type-bg" transition={spring} />}
                    <Icon name={icon} size={26} />
                    <strong>{title}</strong>
                    <small>{sub}</small>
                  </button>
                ))}
              </div>
            </Block>

            <Block n={2} title={delivery ? t('deliveryTo') : t('pickupAt')} done={!delivery || (point && (!adding || (draft.door && pinConfirmed(draft))))}>
              <AnimatePresence mode="wait" initial={false}>
                {delivery ? (
                  <motion.div key="del" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {saved.length > 0 && (
                      <div className="addr-list">
                        {saved.map((a) => {
                          const q = quoteFor(a);
                          const on = !adding && selected === a.id;
                          return (
                            <div key={a.id} className={`addr ${on ? 'on' : ''}`}>
                              <button type="button" className="addr-pick" onClick={() => { setAdding(false); setEditingId(null); setSelected(a.id); }}>
                                <span className="addr-icon"><Icon name={LABEL_ICON[a.label] || 'pin'} size={18} /></span>
                                <span className="grow">
                                  <strong>{t(`label.${a.label}`)}</strong>
                                  <small className="clamp-2">{a.line}{a.landmark ? ` · ${a.landmark}` : ''}</small>
                                </span>
                                {q && <span className="badge" data-tone={q.deliverable ? 'leaf' : 'maroon'}>{km(q.distanceKm)}</span>}
                                <span className="addr-radio" />
                              </button>
                              <button type="button" className="addr-edit" onClick={() => editSaved(a)} aria-label={tr('Edit this address', 'இந்த முகவரியைத் திருத்து')}>
                                <Icon name="edit" size={15} /> <span>{tr('Edit', 'திருத்து')}</span>
                              </button>
                            </div>
                          );
                        })}
                        <button type="button" className={`addr addr-new ${adding && !editingId ? 'on' : ''}`} onClick={() => { setEditingId(null); setDraft(emptyDraft()); setAdding(true); }}>
                          <span className="addr-icon"><Icon name="plus" size={18} /></span>
                          <strong className="grow">{tr('Add a new address', 'புதிய முகவரி சேர்')}</strong>
                        </button>
                      </div>
                    )}
                    <AnimatePresence initial={false}>
                      {adding && settings && (
                        <motion.div key={editingId || 'new'} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                          <AddressForm draft={draft} setDraft={setDraft} settings={settings} quote={quote} saveAddr={saveAddr} setSaveAddr={setSaveAddr}
                            editing={Boolean(editingId)} autoLocate={!saved.length && !editingId} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  <motion.div key="pick" className="pickup-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {settings && <MapView className="pickup-map" markers={[{ id: 's', kind: 'store', lat: settings.lat, lng: settings.lng }]} center={settings} zoom={15} controls={false} interactive={false} />}
                    <div>
                      <strong>{pick(settings, 'name')}</strong>
                      <p className="muted">{pick(settings, 'address')}</p>
                      <p className="subtle">{other(settings, 'address')}</p>
                      <p className="row" style={{ gap: 6, marginTop: 8 }}><Icon name="clock" size={16} /> {hhmm(settings.openTime)} – {hhmm(settings.closeTime)}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Block>

            <Block n={3} title={delivery ? t('payOnDelivery') : t('payAtCounter')} done>
              <div className="pay-options">
                {[['cash', 'cash', t('pay.cash'), delivery ? t('cashDesc') : tr('Pay in cash when you collect', 'பெறும்போது ரொக்கமாக செலுத்துங்கள்')],
                  ['upi', 'phoneDevice', t('pay.upi'), delivery ? t('upiDesc') : tr('Pay by UPI at the counter', 'கவுண்டரில் யுபிஐ மூலம் செலுத்துங்கள்')]]
                  .filter(([v]) => (v === 'cash' ? settings?.acceptCash !== false : settings?.acceptUpi !== false))
                  .map(([v, icon, title, sub]) => (
                    <button key={v} type="button" className={`pay ${payment === v ? 'on' : ''}`} onClick={() => setPayment(v)}>
                      <Icon name={icon} size={24} />
                      <span className="grow"><strong>{title}</strong><small>{sub}</small></span>
                      <span className="addr-radio" />
                    </button>
                  ))}
              </div>
              {payment === 'upi' && settings?.upiId && <p className="subtle" style={{ marginTop: 10, fontSize: 13 }}>UPI: <strong>{settings.upiId}</strong></p>}
              <p className="co-safe"><Icon name="shield" size={16} /> {tr('No card details needed — you pay only when the food reaches you.', 'கார்டு விவரம் தேவையில்லை — உணவு கைக்கு வந்த பிறகே பணம்.')}</p>
            </Block>
          </div>

          <aside className="co-side">
            <div className="co-summary">
              <h3>{t('cart')} <small className="subtle">· {t('items', { n: lines.reduce((s, l) => s + l.qty, 0) })}</small></h3>
              {delivery && <FreeDeliveryBar gap={pricing?.freeDeliveryGap} freeAbove={settings?.freeAbove} />}
              <ul className="co-lines" data-lenis-prevent>
                {lines.map(({ item, qty }) => (
                  <li key={item.id}>
                    <VegMark veg={item.veg} />
                    <span className="grow ellipsis">{pick(item, 'name')}</span>
                    <div className="stepper sm">
                      <button type="button" onClick={() => removeOne(item.id)} aria-label="−"><Icon name="minus" size={13} /></button>
                      <span className="num">{qty}</span>
                      <button type="button" onClick={() => addOne(item.id)} disabled={qty >= item.stock} aria-label="+"><Icon name="plus" size={13} /></button>
                    </div>
                    <span className="num co-line-total">{money(item.price * qty)}</span>
                  </li>
                ))}
              </ul>
              <label className="field">
                <span className="field-label">{t('instructions')}</span>
                <textarea className="textarea" rows={2} value={state.notes} placeholder={t('instructionsHint')} onChange={(e) => cart.set({ notes: e.target.value })} />
              </label>
              <CouponBox pricing={pricing} />
              <BillRows bill={pricing?.bill} type={state.type} loading={loading} quote={quote} />
              <AnimatePresence>
                {(problems.length > 0 || err) && (
                  <motion.ul className="co-problems" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    {[...new Set([...problems, ...(err ? [err] : [])])].map((p) => <li key={p}><Icon name="info" size={15} /> {p}</li>)}
                  </motion.ul>
                )}
              </AnimatePresence>
              <button type="button" className="btn btn-primary btn-lg btn-block co-place" onClick={place}
                disabled={placing || !pricing || problems.length > 0 || pricing.issues?.length > 0}>
                {placing ? <span className="spinner" /> : (
                  <><span>{t('placeOrder')}</span><span className="grow" /><span className="num">{pricing ? money(pricing.bill.total) : ''}</span><Icon name="arrowRight" size={18} /></>
                )}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
