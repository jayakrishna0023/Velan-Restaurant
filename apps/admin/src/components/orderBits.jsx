// Small pieces of an order shared by the board, kitchen screen, POS and detail drawer.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { toast, confirmDialog, VegMark } from '@velan/shared/components/ui.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { useNow } from '@velan/shared/hooks.js';
import { sound } from '@velan/shared/effects.js';
import { allowedNext, primaryNext } from '@velan/shared/domain.js';
import { api } from '../api.js';
import { applyOrder, live, useLive } from '../state/live.js';
import { printBill } from '../lib/print.js';

const pad = (n) => String(n).padStart(2, '0');
export const clock = (ms) => {
  const s = Math.max(0, Math.round(Math.abs(ms) / 1000));
  return s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : `${Math.floor(s / 60)}:${pad(s % 60)}`;
};

/** Every order action, with toasts and error messages in the current language. */
export function useOrderActions() {
  const L = useLang();
  const { tr } = L;
  const run = async (fn, ok) => {
    try {
      const o = await fn();
      if (o?.id) applyOrder(o);
      if (ok) toast.success(ok);
      return o;
    } catch (e) {
      sound.error();
      toast.error(L.error(e));
      return null;
    }
  };
  const setStatus = (o, status, extra = {}) => run(() => api.post(`/orders/${o.id}/status`, { status, ...extra }));
  return {
    setStatus,
    accept: (o, prepMins) => run(() => api.post(`/orders/${o.id}/status`, { status: 'accepted', prepMins }),
      tr(`#${o.number} accepted · ready in ${prepMins} min`, `#${o.number} ஏற்கப்பட்டது · ${prepMins} நிமிடத்தில் தயார்`)),
    async reject(o) {
      const reason = await confirmDialog({
        title: tr(`Reject order #${o.number}?`, `ஆர்டர் #${o.number} நிராகரிக்கவா?`),
        body: tr('The customer is told right away and the stock goes back.', 'வாடிக்கையாளருக்கு உடனே தெரிவிக்கப்படும்; இருப்பு திரும்பச் சேரும்.'),
        input: tr('Reason (optional)', 'காரணம் (விருப்பம்)'),
        choices: [tr('Item finished', 'உணவு தீர்ந்தது'), tr('Kitchen too busy', 'சமையலறை நெரிசல்'), tr('Outside delivery area', 'டெலிவரி பகுதிக்கு வெளியே'), tr('Closing soon', 'விரைவில் மூடுகிறோம்')],
        confirmLabel: L.t('action.rejected'),
        tone: 'danger',
      });
      if (!reason) return null;
      return setStatus(o, 'rejected', { reason: typeof reason === 'string' ? reason : '' });
    },
    async cancel(o) {
      const reason = await confirmDialog({
        title: tr(`Cancel order #${o.number}?`, `ஆர்டர் #${o.number} ரத்து செய்யவா?`),
        body: tr('Stock is returned and the customer and rider are told.', 'இருப்பு திரும்பும்; வாடிக்கையாளருக்கும் டெலிவரி பார்ட்னருக்கும் தெரிவிக்கப்படும்.'),
        input: tr('Reason', 'காரணம்'),
        confirmLabel: L.t('action.cancelled'),
        cancelLabel: tr('Keep order', 'ஆர்டரை வைத்திரு'),
        tone: 'danger',
      });
      if (!reason) return null;
      return setStatus(o, 'cancelled', { reason: typeof reason === 'string' ? reason : '' });
    },
    assign: (o, riderId) => run(() => api.post(`/orders/${o.id}/assign`, { riderId: riderId || null }),
      riderId ? tr(`Rider assigned to #${o.number}`, `#${o.number}க்கு டெலிவரி பார்ட்னர் ஒதுக்கப்பட்டார்`) : null),
    markPaid: (o) => run(() => api.post(`/orders/${o.id}/paid`), tr('Marked as paid', 'செலுத்தியதாகக் குறிக்கப்பட்டது')),
    print: (o) => printBill(o, live.get().settings, L),
  };
}

export const actionLabel = (o, status, t) => (status === 'delivered' && o.type === 'pickup' ? t('action.pickedUp') : t(`action.${status}`));

/** Time since the order came in. */
export function Age({ order }) {
  const now = useNow(15000);
  const { tr } = useLang();
  const m = Math.max(0, Math.floor((now - new Date(order.createdAt)) / 60000));
  return <span className={`age ${m >= 30 ? 'late' : m >= 15 ? 'warn' : ''}`}><Icon name="clock" size={13} />{m < 1 ? tr('now', 'இப்போது') : `${m}${tr('m', 'நி')}`}</span>;
}

/** Ready-by countdown; turns red when the kitchen runs late. */
export function ReadyTimer({ order, big = false }) {
  const now = useNow(1000);
  const { t } = useLang();
  if (!order.readyBy || !['accepted', 'preparing'].includes(order.status)) return null;
  const left = new Date(order.readyBy) - now;
  const total = (order.prepMins || 20) * 60000;
  const late = left < 0;
  return (
    <span className={`ready-timer ${late ? 'late' : left < 180000 ? 'soon' : ''} ${big ? 'big' : ''}`}>
      <span className="ready-bar"><i style={{ width: `${late ? 100 : Math.min(100, (1 - left / total) * 100)}%` }} /></span>
      <Icon name="timer" size={big ? 18 : 13} />
      {late ? t('overdue', { t: clock(left) }) : t('readyIn', { t: clock(left) })}
    </span>
  );
}

export function PrepChips({ value, onChange }) {
  return (
    <div className="prep-chips">
      {[10, 15, 20, 30, 45].map((m) => (
        <button key={m} type="button" className="chip" aria-pressed={value === m} onClick={() => onChange(m)}>{m}′</button>
      ))}
    </div>
  );
}

/** Accept (with kitchen time) + reject, for a new order. */
export function AcceptBar({ order, compact = false }) {
  const settings = useLive((s) => s.settings);
  const [prep, setPrep] = useState(settings?.avgPrepMins || 20);
  const [busy, setBusy] = useState(false);
  const act = useOrderActions();
  const { t } = useLang();
  return (
    <div className={`accept-bar ${compact ? 'compact' : ''}`} onClick={(e) => e.stopPropagation()}>
      <PrepChips value={prep} onChange={setPrep} />
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => act.reject(order)}>{t('action.rejected')}</button>
        <button className="btn btn-leaf btn-sm grow" disabled={busy}
          onClick={async () => { setBusy(true); await act.accept(order, prep); setBusy(false); }}>
          <Icon name="check" size={16} /> {t('action.accepted')} · {prep}′
        </button>
      </div>
    </div>
  );
}

/** The one-tap "next step" button (start cooking, mark ready, send out…). */
export function NextButton({ order, size = 'btn-sm', className = '' }) {
  const next = primaryNext(order);
  const act = useOrderActions();
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  if (!next || next === 'accepted') return null;
  const tone = next === 'delivered' ? 'btn-leaf' : next === 'ready' ? 'btn-gold' : 'btn-primary';
  return (
    <button className={`btn ${tone} ${size} ${className}`} disabled={busy}
      onClick={async (e) => { e.stopPropagation(); setBusy(true); await act.setStatus(order, next); setBusy(false); }}>
      {busy ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Icon name={next === 'ready' ? 'checkCircle' : next === 'preparing' ? 'flame' : next === 'out_for_delivery' ? 'scooter' : 'check'} size={16} />}
      {actionLabel(order, next, t)}
    </button>
  );
}

export function RiderSelect({ order, className = '' }) {
  const riders = useLive((s) => s.riders);
  const presence = useLive((s) => s.presence);
  const act = useOrderActions();
  const { t, tr } = useLang();
  if (order.type !== 'delivery' || order.status === 'placed' || !allowedNext(order, 'admin').length) return null;
  const usable = riders.filter((r) => r.active);
  return (
    <label className={`rider-select ${order.riderId ? 'has' : ''} ${className}`} onClick={(e) => e.stopPropagation()}>
      <Icon name="scooter" size={15} />
      <select className="select input-sm" value={order.riderId || ''} onChange={(e) => act.assign(order, e.target.value)}>
        <option value="">{t('unassigned')}</option>
        <option value="auto">⚡ {t('autoAssign')}</option>
        {usable.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} · {r.online ? t('online') : t('offlineWord')}{presence[r.id] ? ' ●' : ''}{r.activeOrders ? ` · ${r.activeOrders} ${tr('active', 'செயலில்')}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ItemLines({ items, big = false }) {
  const { pick, other } = useLang();
  return (
    <ul className={`item-lines ${big ? 'big' : ''}`}>
      {items.map((i) => (
        <li key={i.id}>
          <span className="qty num">{i.qty}×</span>
          <VegMark veg={i.veg} />
          <span className="grow">
            {pick(i, 'name')}
            {big && other(i, 'name') && <small className="tamil-sub">{other(i, 'name')}</small>}
            {i.note && <em className="item-note">“{i.note}”</em>}
          </span>
          {!big && <span className="num subtle">₹{(i.qty * i.price).toLocaleString('en-IN')}</span>}
        </li>
      ))}
    </ul>
  );
}

export function BillTable({ order }) {
  const { t, money } = useLang();
  const b = order.bill;
  const row = (label, v, cls = '') => <div className={`bill-row ${cls}`}><span>{label}</span><span className="num">{v}</span></div>;
  return (
    <div className="bill">
      {row(t('bill.subtotal'), money(b.subtotal))}
      {b.packing > 0 && row(t('bill.packing'), money(b.packing))}
      {order.type === 'delivery' && row(t('bill.deliveryFee'), b.deliveryFee ? money(b.deliveryFee) : t('bill.free'))}
      {b.discount > 0 && row(`${t('bill.discount')}${b.couponCode ? ` · ${b.couponCode}` : ''}`, `−${money(b.discount)}`, 'good')}
      {b.tax > 0 && row(t('bill.tax'), money(b.tax))}
      {row(t('total'), money(b.total), 'total')}
    </div>
  );
}

export function PayBadge({ order }) {
  const { t } = useLang();
  const paid = order.payment.status === 'paid';
  return (
    <span className="badge" data-tone={paid ? 'leaf' : order.payment.method === 'upi' ? 'blue' : 'gold'}>
      <Icon name={order.payment.method === 'upi' ? 'phoneDevice' : 'cash'} size={12} />
      {t(`pay.${order.payment.method}`)}{paid ? ' ✓' : ''}
    </span>
  );
}

export function TypeBadge({ order }) {
  const { t } = useLang();
  return (
    <span className="badge" data-tone={order.type === 'delivery' ? 'blue' : 'saffron'}>
      <Icon name={order.type === 'delivery' ? 'scooter' : 'bag'} size={12} />
      {t(`type.${order.type}`)}
    </span>
  );
}

export const MotionCard = motion.div;
