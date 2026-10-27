// Business rules shared by the server and all three apps. Pure functions only —
// no DOM, no React — so the server can import this file too.

export const STATUSES = ['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
export const CLOSED_STATUSES = ['delivered', 'rejected', 'cancelled'];
export const ACTIVE_STATUSES = STATUSES.slice(0, 5);
export const isActive = (o) => ACTIVE_STATUSES.includes(o.status);
export const statusIndex = (s) => STATUSES.indexOf(s);

// Colour family per status, used by every app for chips, columns and map pins.
export const STATUS_TONE = {
  placed: 'saffron', accepted: 'gold', preparing: 'gold', ready: 'leaf',
  out_for_delivery: 'blue', delivered: 'leaf', rejected: 'maroon', cancelled: 'muted',
};

/** Steps shown on the customer's tracker for an order type. */
export const stepsFor = (type) => (type === 'pickup'
  ? ['placed', 'accepted', 'preparing', 'ready', 'delivered']
  : STATUSES);

/**
 * Which statuses an actor may move an order to from its current status.
 * Riders only pick up and deliver; customers only cancel while "placed".
 */
export function allowedNext(order, role) {
  const { status, type } = order;
  if (CLOSED_STATUSES.includes(status)) return [];
  if (role === 'customer') return status === 'placed' ? ['cancelled'] : [];
  if (role === 'rider') {
    if (type !== 'delivery') return [];
    if (['accepted', 'preparing', 'ready'].includes(status)) return ['out_for_delivery'];
    if (status === 'out_for_delivery') return ['delivered'];
    return [];
  }
  // admin
  const i = statusIndex(status);
  const forward = STATUSES.slice(i + 1).filter((s) => !(type !== 'delivery' && s === 'out_for_delivery'));
  return [...forward, ...(status === 'placed' ? ['rejected'] : []), 'cancelled'];
}

/** The single "next" action an admin usually takes, for one-tap buttons. */
export function primaryNext(order) {
  const map = { placed: 'accepted', accepted: 'preparing', preparing: 'ready' };
  if (map[order.status]) return map[order.status];
  if (order.status === 'ready') return order.type === 'delivery' ? 'out_for_delivery' : 'delivered';
  if (order.status === 'out_for_delivery') return 'delivered';
  return null;
}

// ---------- geography & delivery fee ----------

const toRad = (d) => (d * Math.PI) / 180;
/** Straight-line distance in km. */
export function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** Approximate road distance: straight line × 1.25, rounded to 0.1 km. */
export const roadKm = (a, b) => Math.round(haversineKm(a, b) * 1.25 * 10) / 10;

/** Distance, fee and whether the restaurant delivers to a point. */
export function deliveryQuote(settings, point, subtotal = 0) {
  const distanceKm = roadKm(settings, point);
  const deliverable = distanceKm <= settings.deliveryRadiusKm;
  let fee = settings.baseFee + Math.max(0, Math.ceil(distanceKm - settings.baseKm)) * settings.perKm;
  const free = settings.freeAbove > 0 && subtotal >= settings.freeAbove;
  if (free) fee = 0;
  return { distanceKm, deliverable, fee: Math.round(fee), free };
}

/**
 * The bill for a cart. `lines` are [{ price, qty }]; `coupon` is an already
 * validated coupon ({ type: 'percent'|'flat'|'freedelivery', value, maxDiscount }).
 */
export function computeBill({ lines, settings, type, deliveryFee = 0, coupon = null }) {
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const packing = lines.length ? settings.packingCharge || 0 : 0;
  let fee = type === 'delivery' ? deliveryFee : 0;
  let discount = 0;
  if (coupon) {
    if (coupon.type === 'percent') discount = Math.round((subtotal * coupon.value) / 100);
    else if (coupon.type === 'flat') discount = coupon.value;
    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    discount = Math.min(discount, subtotal);
  }
  const freeDeliverySaving = coupon?.type === 'freedelivery' && type === 'delivery' ? fee : 0;
  fee -= freeDeliverySaving;
  const taxable = Math.max(0, subtotal - discount + packing);
  const tax = Math.round((taxable * (settings.gstPercent || 0)) / 100);
  const total = Math.max(0, Math.round(subtotal + packing + fee - discount + tax));
  return { subtotal, packing, deliveryFee: fee, discount, tax, total, savings: discount + freeDeliverySaving };
}

// ---------- opening hours (Indian Standard Time) ----------

const IST_MS = 330 * 60000;
/** YYYY-MM-DD for a date in IST. */
export const dayKey = (d = new Date()) => new Date(new Date(d).getTime() + IST_MS).toISOString().slice(0, 10);
/** Hour 0–23 in IST. */
export const istHour = (d) => new Date(new Date(d).getTime() + IST_MS).getUTCHours();
/** Weekday 0 (Sun) – 6 in IST. */
export const istWeekday = (d) => new Date(new Date(d).getTime() + IST_MS).getUTCDay();
const istMinutes = (d) => { const x = new Date(new Date(d).getTime() + IST_MS); return x.getUTCHours() * 60 + x.getUTCMinutes(); };
const toMin = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return h * 60 + (m || 0); };

/**
 * Whether orders are being taken now.
 * Returns { open, reason: null|'paused'|'hours'|'weeklyOff', opensAt, closesAt, closingSoon }.
 */
export function storeStatus(settings, now = new Date()) {
  const open = toMin(settings.openTime);
  const close = toMin(settings.closeTime);
  const mins = istMinutes(now);
  const inHours = close > open ? mins >= open && mins < close : mins >= open || mins < close;
  const off = settings.weeklyOff !== null && settings.weeklyOff !== undefined && settings.weeklyOff !== '' && Number(settings.weeklyOff) === istWeekday(now);
  let reason = null;
  if (!settings.isOpen) reason = 'paused';
  else if (settings.enforceHours && off) reason = 'weeklyOff';
  else if (settings.enforceHours && !inHours) reason = 'hours';
  const left = (close - mins + 1440) % 1440;
  return {
    open: !reason,
    reason,
    opensAt: settings.openTime,
    closesAt: settings.closeTime,
    closingSoon: !reason && inHours && left <= 45,
  };
}

/** "Bestseller", "Chef's special" etc. as stable keys for badges. */
export function itemBadges(item) {
  const b = [];
  if (item.bestseller) b.push('bestseller');
  if (item.chefSpecial) b.push('chefSpecial');
  if (item.isNew) b.push('new');
  return b;
}

export const PHONE_RE = /^[6-9]\d{9}$/;
export const cleanPhone = (p) => String(p || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
