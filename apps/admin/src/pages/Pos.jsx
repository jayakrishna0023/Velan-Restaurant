// Counter and phone orders: tap dishes, fill the ticket, place.
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Seg, Switch, VegMark, toast, Modal, Empty } from '@velan/shared/components/ui.jsx';
import { LocationPicker } from '@velan/shared/map.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { useDebounced } from '@velan/shared/hooks.js';
import { sound, flowerShower } from '@velan/shared/effects.js';
import { deliveryQuote } from '@velan/shared/domain.js';
import { api } from '../api.js';
import { applyOrder, useLive } from '../state/live.js';
import { openOrder } from '../state/ui.js';
import { Field, Page, PageHead } from '../components/common.jsx';
import { PrepChips, useOrderActions } from '../components/orderBits.jsx';

const blank = () => ({
  lines: {}, source: 'counter', type: 'pickup', customerName: '', phone: '', address: { line: '', landmark: '' }, point: null,
  paymentMethod: 'cash', paid: false, coupon: '', notes: '', prepMins: null, waiveDelivery: false,
});

export default function Pos() {
  const L = useLang();
  const { t, tr, pick, other, money, km } = L;
  const items = useLive((s) => s.items);
  const categories = useLive((s) => s.categories);
  const settings = useLive((s) => s.settings);
  const act = useOrderActions();
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [f, setF] = useState(blank);
  const [price, setPrice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const set = (patch) => setF((x) => ({ ...x, ...(typeof patch === 'function' ? patch(x) : patch) }));

  const shown = useMemo(() => items.filter((m) => m.available !== false && (cat === 'all' || m.categoryId === cat)
    && (!q || `${m.name} ${m.nameTa}`.toLowerCase().includes(q.toLowerCase()))), [items, cat, q]);
  const lines = Object.entries(f.lines).filter(([, n]) => n > 0).map(([id, qty]) => ({ id, qty }));
  const count = lines.reduce((s, l) => s + l.qty, 0);

  const add = (m, d = 1) => {
    const cur = f.lines[m.id] || 0;
    const next = Math.max(0, Math.min(m.stock, cur + d));
    if (d > 0 && cur >= m.stock) { toast.error(t('err.OUT_OF_STOCK', { name: m.name, nameTa: m.nameTa, left: m.stock })); return; }
    sound.tap();
    set({ lines: { ...f.lines, [m.id]: next } });
  };

  // Server-side price for the ticket.
  const priceKey = useDebounced(JSON.stringify({ lines, type: f.type, point: f.point, coupon: f.coupon.trim() }), 250);
  useEffect(() => {
    const k = JSON.parse(priceKey);
    if (!k.lines.length) { setPrice(null); return undefined; }
    let live = true;
    api.post('/cart/price', { items: k.lines, type: k.type, lat: k.point?.lat, lng: k.point?.lng, coupon: k.coupon || undefined })
      .then((p) => { if (live) setPrice(p); }).catch(() => {});
    return () => { live = false; };
  }, [priceKey]);

  const quote = f.type === 'delivery' && f.point && settings ? deliveryQuote(settings, f.point, price?.bill.subtotal || 0) : null;
  const fee = f.waiveDelivery ? 0 : price?.bill.deliveryFee || 0;
  const total = price ? price.bill.total - (f.type === 'delivery' && f.waiveDelivery ? price.bill.deliveryFee : 0) : 0;

  const place = async () => {
    if (!lines.length) return;
    if (f.type === 'delivery' && (!f.point || !f.address.line.trim())) { toast.error(t('err.ADDRESS_REQUIRED')); return; }
    setBusy(true);
    try {
      const o = await api.post('/admin/orders', {
        items: lines, source: f.source, type: f.type, customerName: f.customerName, phone: f.phone,
        address: f.type === 'delivery' ? {
          ...f.address, ...f.point, label: 'home', street: f.address.line,
          line: [f.address.door, f.address.line].map((s) => String(s || '').trim()).filter(Boolean).join(', '),
        } : undefined,
        paymentMethod: f.paymentMethod, paid: f.paid, coupon: f.coupon.trim() || undefined, notes: f.notes,
        prepMins: f.prepMins || settings?.avgPrepMins, waiveDelivery: f.waiveDelivery,
      });
      applyOrder(o);
      sound.success();
      flowerShower({ x: window.innerWidth - 220, y: 160, count: 70 });
      setPlaced(o);
      setF(blank());
    } catch (e) {
      sound.error();
      toast.error(L.error(e));
    }
    setBusy(false);
  };

  return (
    <Page className="pos-page">
      <PageHead title={t('nav.pos')} sub={tr('Counter, walk-in and phone orders go straight to the kitchen.', 'கவுண்டர், நேரடி மற்றும் போன் ஆர்டர்கள் நேராக சமையலறைக்கு.')}>
        <Seg value={f.source} onChange={(v) => set({ source: v })} options={[
          { value: 'counter', label: t('source.counter'), icon: 'store' }, { value: 'phone', label: t('source.phone'), icon: 'phone' },
        ]} />
      </PageHead>

      <div className="pos">
        <section className="pos-menu">
          <div className="pos-tools">
            <div className="input-group grow">
              <Icon name="search" size={16} className="icon" />
              <input className="input input-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Search dishes', 'உணவுகளைத் தேடுக')} />
            </div>
          </div>
          <div className="chip-row">
            <button className="chip" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>{tr('All', 'அனைத்தும்')}</button>
            {categories.map((c) => <button key={c.id} className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{pick(c, 'name')}</button>)}
          </div>
          <motion.div className="pos-grid" layout>
            {shown.map((m) => {
              const n = f.lines[m.id] || 0;
              const out = m.stock <= 0;
              return (
                <motion.button key={m.id} layout type="button" className={`pos-tile ${n ? 'in' : ''} ${out ? 'out' : ''}`} disabled={out}
                  onClick={() => add(m)} whileTap={{ scale: 0.95 }}>
                  <span className="pos-img" style={m.image ? { backgroundImage: `url(${m.image})` } : undefined} />
                  <AnimatePresence>{n > 0 && <motion.span className="pos-qty num" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} key="q">{n}</motion.span>}</AnimatePresence>
                  <span className="pos-tile-body">
                    <span className="row" style={{ gap: 6 }}><VegMark veg={m.veg} /><b className="ellipsis">{pick(m, 'name')}</b></span>
                    <span className="subtle small ellipsis tamil-sub">{other(m, 'name')}</span>
                    <span className="row" style={{ justifyContent: 'space-between' }}>
                      <b className="num">{money(m.price)}</b>
                      <span className={`small num ${m.stock <= 5 ? 'danger-text' : 'subtle'}`}>{out ? t('soldOut') : `${m.stock} ${tr('left', 'மீதம்')}`}</span>
                    </span>
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        </section>

        <aside className="pos-ticket panel">
          <div className="ticket-top">
            <h3><Icon name="receipt" size={18} /> {tr('Ticket', 'டிக்கெட்')}</h3>
            {count > 0 && <button className="btn btn-ghost btn-xs" onClick={() => set({ lines: {} })}>{tr('Clear', 'அழி')}</button>}
          </div>
          {lines.length === 0 ? (
            <Empty icon="bag" title={tr('Tap dishes to add', 'சேர்க்க உணவுகளைத் தொடவும்')} />
          ) : (
            <ul className="ticket-lines">
              <AnimatePresence initial={false}>
                {lines.map((l) => {
                  const m = items.find((x) => x.id === l.id);
                  if (!m) return null;
                  return (
                    <motion.li key={l.id} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20, height: 0 }}>
                      <VegMark veg={m.veg} />
                      <span className="grow ellipsis">{pick(m, 'name')}</span>
                      <span className="stepper">
                        <button onClick={() => add(m, -1)} aria-label="−"><Icon name="minus" size={14} /></button>
                        <b className="num">{l.qty}</b>
                        <button onClick={() => add(m, 1)} aria-label="+"><Icon name="plus" size={14} /></button>
                      </span>
                      <b className="num line-total">{money(m.price * l.qty)}</b>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}

          <div className="ticket-form">
            <div className="grid-2-tight">
              <Field label={t('name')}><input className="input input-sm" value={f.customerName} onChange={(e) => set({ customerName: e.target.value })} placeholder={tr('Walk-in', 'நேரடி வாடிக்கையாளர்')} /></Field>
              <Field label={t('mobile')}><input className="input input-sm" inputMode="numeric" maxLength={10} value={f.phone} onChange={(e) => set({ phone: e.target.value.replace(/\D/g, '') })} placeholder={t('optional')} /></Field>
            </div>
            <Seg value={f.type} onChange={(v) => set({ type: v })} options={[
              { value: 'pickup', label: tr('Takeaway', 'பார்சல்'), icon: 'bag' }, { value: 'delivery', label: t('type.delivery'), icon: 'scooter' },
            ]} className="seg-block" />
            {f.type === 'delivery' && (
              <div className="ticket-address">
                <div className="grid-2-tight">
                  <Field label={tr('Door no. & name', 'வீட்டு எண் & பெயர்')}><input className="input input-sm" value={f.address.door || ''} onChange={(e) => set({ address: { ...f.address, door: e.target.value } })} placeholder="12" /></Field>
                  <Field label={tr('Street, area', 'தெரு, பகுதி')}><input className="input input-sm" value={f.address.line} onChange={(e) => set({ address: { ...f.address, line: e.target.value } })} /></Field>
                </div>
                <Field label={t('landmark')}><input className="input input-sm" value={f.address.landmark} onChange={(e) => set({ address: { ...f.address, landmark: e.target.value } })} /></Field>
                <button type="button" className={`pin-button ${f.point ? 'set' : ''}`} onClick={() => setMapOpen(true)}>
                  <Icon name="pin" size={17} />
                  <span className="grow">{f.point ? tr('Location pinned', 'இருப்பிடம் பின் செய்யப்பட்டது') : tr('Pin the house on the map', 'வீட்டை வரைபடத்தில் பின் செய்க')}</span>
                  {quote && <span className={`badge`} data-tone={quote.deliverable ? 'leaf' : 'maroon'}>{km(quote.distanceKm)}</span>}
                </button>
                <label className="row small"><Switch checked={f.waiveDelivery} onChange={(v) => set({ waiveDelivery: v })} label="waive" /> {tr('Waive delivery fee', 'டெலிவரி கட்டணம் தள்ளுபடி')}</label>
              </div>
            )}
            <div className="grid-2-tight">
              <Seg value={f.paymentMethod} onChange={(v) => set({ paymentMethod: v })} options={[{ value: 'cash', label: t('pay.cash') }, { value: 'upi', label: t('pay.upi') }]} className="seg-block" />
              <label className="row small paid-toggle"><Switch checked={f.paid} onChange={(v) => set({ paid: v })} label={t('pay.paid')} /> {tr('Paid now', 'இப்போது செலுத்தியது')}</label>
            </div>
            <div className="field">
              <span className="field-label">{t('prepTime')}</span>
              <PrepChips value={f.prepMins || settings?.avgPrepMins} onChange={(v) => set({ prepMins: v })} />
            </div>
            <div className="grid-2-tight">
              <Field label={tr('Coupon', 'கூப்பன்')}><input className="input input-sm" value={f.coupon} onChange={(e) => set({ coupon: e.target.value.toUpperCase() })} placeholder="VELAN50" /></Field>
              <Field label={t('notes')}><input className="input input-sm" value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder={tr('Less spicy…', 'காரம் குறைவு…')} /></Field>
            </div>
            {price?.couponError && f.coupon && <p className="form-error small"><Icon name="alert" size={14} /> {L.error(price.couponError)}</p>}
          </div>

          {price && (
            <div className="bill ticket-bill">
              <div className="bill-row"><span>{t('bill.subtotal')}</span><span className="num">{money(price.bill.subtotal)}</span></div>
              {price.bill.packing > 0 && <div className="bill-row"><span>{t('bill.packing')}</span><span className="num">{money(price.bill.packing)}</span></div>}
              {f.type === 'delivery' && <div className="bill-row"><span>{t('bill.deliveryFee')}</span><span className="num">{fee ? money(fee) : t('bill.free')}</span></div>}
              {price.bill.discount > 0 && <div className="bill-row good"><span>{t('bill.discount')}</span><span className="num">−{money(price.bill.discount)}</span></div>}
              {price.bill.tax > 0 && <div className="bill-row"><span>{t('bill.tax')}</span><span className="num">{money(price.bill.tax)}</span></div>}
            </div>
          )}
          <button className="btn btn-primary btn-lg btn-block place-btn" disabled={!lines.length || busy} onClick={place}>
            {busy ? <span className="spinner" /> : <>
              <span>{tr('Place order', 'ஆர்டர் செய்')} · {L.t('items', { n: count })}</span>
              <b className="num">{money(total)}</b>
            </>}
          </button>
        </aside>
      </div>

      <Modal open={mapOpen} onClose={() => setMapOpen(false)} title={tr('Pin the delivery location', 'டெலிவரி இடத்தைப் பின் செய்க')} width={640}
        footer={<button className="btn btn-primary" onClick={() => setMapOpen(false)}>{t('done')}</button>}>
        <p className="pos-map-hint subtle small">
          <Icon name="info" size={14} /> {tr('Customer on WhatsApp? Ask them to share their location and paste the link in the search box. Coordinates like 11.0018, 78.1764 work too.',
            'வாடிக்கையாளர் WhatsApp-இல் உள்ளாரா? இருப்பிடத்தைப் பகிரச் சொல்லி இணைப்பைத் தேடல் பெட்டியில் ஒட்டுங்கள். 11.0018, 78.1764 போன்ற எண்களும் வேலை செய்யும்.')}
        </p>
        <LocationPicker value={f.point} origin={settings} height={400}
          zone={settings ? { lat: settings.lat, lng: settings.lng, radiusKm: settings.deliveryRadiusKm } : null}
          onChange={(pt, meta) => set((cur) => ({
            point: { ...pt, source: meta.source, accuracy: meta.accuracy },
            ...(meta.parts && !cur.address.line ? { address: { ...cur.address, line: [meta.parts.street, meta.parts.area].filter(Boolean).join(', ') || meta.label, pincode: meta.parts.pincode } } : {}),
          }))}>
          {quote && <span className="badge" data-tone={quote.deliverable ? 'leaf' : 'maroon'}>{km(quote.distanceKm)}</span>}
        </LocationPicker>
      </Modal>

      <Modal open={!!placed} onClose={() => setPlaced(null)} width={420}>
        {placed && (
          <div className="placed">
            <motion.div className="placed-check" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 15 }}>
              <Icon name="check" size={38} stroke={2.6} />
            </motion.div>
            <h3 className="display">#{placed.number}</h3>
            <p className="muted">{tr('Sent to the kitchen', 'சமையலறைக்கு அனுப்பப்பட்டது')} · {money(placed.bill.total)}</p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={() => act.print(placed)}><Icon name="printer" size={16} />{t('print')}</button>
              <button className="btn btn-soft" onClick={() => { openOrder(placed.id); setPlaced(null); }}>{t('details')}</button>
              <button className="btn btn-primary" onClick={() => setPlaced(null)}><Icon name="plus" size={16} />{t('nav.pos')}</button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  );
}
