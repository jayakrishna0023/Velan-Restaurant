import crypto from 'node:crypto';
import { db, newId, nowIso, transaction, nextOrderNumber } from '../db/database.js';
import { bus } from '../lib/bus.js';
import { fail, AppError } from '../lib/errors.js';
import {
  allowedNext, computeBill, deliveryQuote, dayKey, storeStatus, statusIndex, ACTIVE_STATUSES, CLOSED_STATUSES, cleanPhone, PHONE_RE,
} from '@velan/shared/domain.js';
import { getSettings } from './settings.js';
import { takeStock, returnStock } from './menu.js';
import { validateCoupon, countCouponUse } from './coupons.js';
import { logActivity } from './activity.js';
import { liveLocation, pickRider, riderRow } from './riders.js';

const otp = () => String(crypto.randomInt(1000, 10000));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Riders' workload and cash change with their orders: tell the admin screens. */
function touchRiders(...ids) {
  for (const id of new Set(ids.filter(Boolean))) {
    const r = db.users.get(id);
    if (r) bus.emit('rider', riderRow(r));
  }
}

const ADDRESS_SOURCES = ['gps', 'pin', 'search', 'link', 'manual'];
const text = (v, max) => String(v ?? '').trim().slice(0, max);

/**
 * A delivery address as stored on orders and saved addresses. Besides the
 * one-line form it keeps the parts (door, street, area, pincode) and how the
 * pin was set, with its GPS accuracy, so the rider knows how far to trust it.
 */
export function cleanAddress(a) {
  if (!a || typeof a !== 'object') return null;
  const lat = Number(a.lat);
  const lng = Number(a.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const door = text(a.door, 60);
  const street = text(a.street, 120);
  const area = text(a.area, 80);
  const line = text(a.line, 200) || [door, street, area].filter(Boolean).join(', ').slice(0, 200);
  if (!line) return null;
  const pincode = text(a.pincode, 6).replace(/\D/g, '');
  const accuracy = Number(a.accuracy);
  return {
    label: ['home', 'work', 'other'].includes(a.label) ? a.label : 'home',
    line,
    door,
    street,
    area,
    pincode: pincode.length === 6 ? pincode : '',
    landmark: text(a.landmark, 120),
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    source: ADDRESS_SOURCES.includes(a.source) ? a.source : 'pin',
    accuracy: Number.isFinite(accuracy) && accuracy > 0 ? Math.round(accuracy) : null,
    // The customer looked at the pin and said "yes, this is my door".
    confirmed: a.confirmed === true,
  };
}

/** Cart lines priced from the live menu. Strict mode throws on stock problems. */
function resolveLines(items, strict) {
  if (!Array.isArray(items)) fail('CART_EMPTY');
  const merged = new Map();
  for (const it of items) {
    const qty = Math.round(Number(it?.qty));
    if (!it?.id || !(qty > 0)) continue;
    const prev = merged.get(it.id);
    merged.set(it.id, { qty: Math.min(50, (prev?.qty || 0) + qty), note: String(it.note || prev?.note || '').slice(0, 120) });
  }
  const lines = [];
  const issues = [];
  for (const [id, { qty, note }] of merged) {
    const m = db.menu.get(id);
    if (!m || m.available === false || m.stock <= 0) {
      const e = { id, code: 'ITEM_UNAVAILABLE', params: { name: m?.name || 'A dish', nameTa: m?.nameTa || '' } };
      if (strict) fail(e.code, 409, e.params);
      issues.push(e);
      continue;
    }
    let q = qty;
    if (m.stock < qty) {
      const e = { id, code: 'OUT_OF_STOCK', params: { name: m.name, nameTa: m.nameTa, left: m.stock } };
      if (strict) fail(e.code, 409, e.params);
      issues.push(e);
      q = m.stock;
    }
    lines.push({ id, name: m.name, nameTa: m.nameTa, price: m.price, qty: q, veg: m.veg, image: m.image, ...(note ? { note } : {}) });
  }
  if (strict && !lines.length) fail('CART_EMPTY');
  return { lines, issues };
}

/** Live price of a cart for the checkout (never throws for cart problems). */
export function priceCart(user, { items = [], type = 'delivery', lat, lng, coupon }) {
  const settings = getSettings();
  const { lines, issues } = resolveLines(items, false);
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  let quote = null;
  if (type === 'delivery' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    quote = deliveryQuote(settings, { lat: Number(lat), lng: Number(lng) }, subtotal);
  }
  let applied = null;
  let couponError = null;
  if (coupon) {
    try {
      applied = validateCoupon(coupon, { user, subtotal, type });
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
      couponError = { code: e.code, params: e.params, error: e.message };
    }
  }
  const bill = computeBill({ lines, settings, type, deliveryFee: quote?.fee ?? (type === 'delivery' ? settings.baseFee : 0), coupon: applied });
  return {
    lines,
    issues,
    bill,
    quote,
    coupon: applied ? { code: applied.code, title: applied.title, titleTa: applied.titleTa, type: applied.type } : null,
    couponError,
    minOrderGap: type === 'delivery' ? Math.max(0, settings.minOrder - subtotal) : 0,
    freeDeliveryGap: settings.freeAbove > 0 ? Math.max(0, settings.freeAbove - subtotal) : null,
    status: storeStatus(settings),
  };
}

/**
 * Create an order. `source` is 'online' for the website, 'counter'/'phone'
 * for orders keyed in by staff (no opening-hours, radius or minimum checks).
 */
export function placeOrder(actor, input, source = 'online') {
  const settings = getSettings();
  const staff = source !== 'online';
  if (!staff && !storeStatus(settings).open) fail('CLOSED', 409);
  const type = input.type === 'pickup' ? 'pickup' : 'delivery';

  return transaction(() => {
    const { lines } = resolveLines(input.items, true);
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    let address = null;
    let distanceKm = null;
    let fee = 0;
    if (type === 'delivery') {
      address = cleanAddress(input.address) || fail('ADDRESS_REQUIRED');
      const q = deliveryQuote(settings, address, subtotal);
      if (!staff && !q.deliverable) fail('OUT_OF_RANGE', 400, { km: settings.deliveryRadiusKm, distance: q.distanceKm });
      if (!staff && subtotal < settings.minOrder) fail('MIN_ORDER', 400, { min: settings.minOrder });
      distanceKm = q.distanceKm;
      fee = staff && input.waiveDelivery ? 0 : q.fee;
    }
    const coupon = input.coupon ? validateCoupon(input.coupon, { user: staff ? null : actor, subtotal, type }) : null;
    const bill = computeBill({ lines, settings, type, deliveryFee: fee, coupon });

    let customerId = null;
    let customerName = actor.name;
    let phone = actor.phone;
    if (staff) {
      customerName = String(input.customerName || '').trim().slice(0, 60) || 'Walk-in';
      phone = cleanPhone(input.phone);
      if (phone && !PHONE_RE.test(phone)) fail('PHONE_INVALID');
      customerId = phone ? db.users.findOne("role = 'customer' AND phone = ?", [phone])?.id || null : null;
    } else {
      customerId = actor.id;
    }

    const now = nowIso();
    const method = input.paymentMethod === 'upi' ? 'upi' : 'cash';
    const order = {
      id: newId('ord'),
      number: nextOrderNumber(),
      source,
      type,
      status: 'placed',
      customerId,
      customerName,
      phone,
      items: lines,
      bill: { ...bill, couponCode: coupon?.code || null },
      payment: { method, status: staff && input.paid ? 'paid' : 'pending', ...(staff && input.paid ? { paidAt: now } : {}) },
      address,
      distanceKm,
      otp: otp(),
      riderId: null,
      prepMins: null,
      readyBy: null,
      notes: String(input.notes || '').trim().slice(0, 300),
      timeline: [{ status: 'placed', at: now, by: actor.role }],
      createdAt: now,
      updatedAt: now,
      day: dayKey(now),
    };
    takeStock(lines);
    countCouponUse(coupon?.code, 1);
    db.orders.insert(order);

    if (!staff && input.saveAddress && address) saveAddressFor(actor, address);
    logActivity(actor, 'order.placed', { id: order.id, number: order.number, total: bill.total, source, customer: customerName });

    // Staff orders go straight to the kitchen (one push, already accepted).
    if (staff && input.autoAccept !== false) {
      return transition(order.id, actor, { status: 'accepted', prepMins: input.prepMins });
    }
    bus.emit('order', order, {});
    return order;
  });
}

function saveAddressFor(user, address) {
  const dup = db.addresses.find('userId = ?', [user.id])
    .find((a) => a.line === address.line && Math.abs(a.lat - address.lat) < 1e-4 && Math.abs(a.lng - address.lng) < 1e-4);
  if (!dup) db.addresses.insert({ id: newId('adr'), userId: user.id, ...address, createdAt: nowIso() });
}

/** Move an order to a new status, enforcing who may do what. */
export function transition(id, actor, { status, prepMins, reason, otp: code }) {
  return transaction(() => {
    const settings = getSettings();
    const o = db.orders.get(id) || fail('NOT_FOUND', 404);
    if (actor.role === 'customer' && o.customerId !== actor.id) fail('NOT_FOUND', 404);
    if (actor.role === 'rider' && o.riderId !== actor.id) fail('NOT_ASSIGNED', 403);
    if (!allowedNext(o, actor.role).includes(status)) {
      fail(actor.role === 'customer' ? 'CANNOT_CANCEL' : 'BAD_TRANSITION', 409);
    }
    if (status === 'delivered' && actor.role === 'rider' && String(code || '').trim() !== o.otp) fail('OTP_WRONG', 400);

    const now = nowIso();
    const from = o.status;
    o.status = status;
    o.updatedAt = now;
    o.timeline.push({ status, at: now, by: actor.role, name: actor.name, ...(reason ? { note: String(reason).slice(0, 200) } : {}) });

    if (statusIndex(status) >= 1 && !o.acceptedAt) {
      o.prepMins = clamp(Math.round(Number(prepMins)) || settings.avgPrepMins, 5, 180);
      o.acceptedAt = now;
      o.readyBy = new Date(Date.now() + o.prepMins * 60000).toISOString();
    }
    if (statusIndex(status) >= 3 && !o.readyAt) o.readyAt = now;
    if (status === 'out_for_delivery') o.pickedAt = now;
    if (status === 'delivered') {
      o.deliveredAt = now;
      if (o.payment.status !== 'paid') o.payment = { ...o.payment, status: 'paid', paidAt: now };
      if (o.riderId && o.type === 'delivery') {
        o.riderPay = Math.round(settings.riderPayBase + settings.riderPayPerKm * (o.distanceKm || 0));
        if (o.payment.method === 'cash') o.cashSettled = false;
      }
    }
    if (status === 'rejected' || status === 'cancelled') {
      o.cancelReason = String(reason || '').slice(0, 200);
      o.cancelledBy = actor.role;
      returnStock(o.items);
      countCouponUse(o.bill.couponCode, -1);
    }
    db.orders.put(o);
    logActivity(actor, `order.${status}`, { id: o.id, number: o.number, from, ...(reason ? { reason } : {}) });
    bus.emit('order', o, {});
    if (['out_for_delivery', 'delivered', 'cancelled', 'rejected'].includes(status)) touchRiders(o.riderId);

    if (status === 'accepted' && settings.autoAssign && o.type === 'delivery' && !o.riderId) {
      const rider = pickRider();
      if (rider) return assignRider(o.id, rider.id, null);
    }
    return o;
  });
}

/** Give an order to a rider ('auto' picks the nearest free one, null unassigns). */
export function assignRider(id, riderId, actor) {
  return transaction(() => {
    const o = db.orders.get(id) || fail('NOT_FOUND', 404);
    if (o.type !== 'delivery' || CLOSED_STATUSES.includes(o.status) || o.status === 'placed') fail('BAD_TRANSITION', 409);
    let rider = null;
    if (riderId === 'auto') {
      rider = pickRider() || fail('NO_RIDER', 409);
    } else if (riderId) {
      rider = db.users.get(riderId);
      if (!rider || rider.role !== 'rider') fail('NOT_FOUND', 404);
      if (!rider.active) fail('RIDER_INACTIVE', 409);
    }
    const prevRiderId = o.riderId;
    o.riderId = rider?.id || null;
    o.assignedAt = rider ? nowIso() : null;
    o.updatedAt = nowIso();
    db.orders.put(o);
    logActivity(actor, rider ? 'order.assigned' : 'order.unassigned', { id: o.id, number: o.number, rider: rider?.name || null, auto: riderId === 'auto' || !actor });
    bus.emit('order', o, { prevRiderId });
    touchRiders(prevRiderId, o.riderId);
    return o;
  });
}

/** The rider taps "I've arrived": the customer is told their food is at the door. */
export function markArrived(id, actor) {
  const o = db.orders.get(id) || fail('NOT_FOUND', 404);
  if (o.riderId !== actor.id) fail('NOT_ASSIGNED', 403);
  if (o.status !== 'out_for_delivery') fail('BAD_TRANSITION', 409);
  const next = db.orders.update(id, (x) => { x.arrivedAt = x.arrivedAt || nowIso(); x.updatedAt = nowIso(); });
  logActivity(actor, 'order.arrived', { id: o.id, number: o.number });
  bus.emit('order', next, {});
  return next;
}

export function markPaid(id, actor) {
  const o = db.orders.update(id, (x) => { x.payment = { ...x.payment, status: 'paid', paidAt: nowIso() }; x.updatedAt = nowIso(); })
    || fail('NOT_FOUND', 404);
  logActivity(actor, 'order.paid', { id: o.id, number: o.number, total: o.bill.total });
  bus.emit('order', o, {});
  return o;
}

export function rateOrder(id, user, { food, delivery, review, tags }) {
  const o = db.orders.get(id);
  if (!o || o.customerId !== user.id) fail('NOT_FOUND', 404);
  if (o.status !== 'delivered') fail('NOT_DELIVERED', 409);
  if (o.rating) fail('ALREADY_RATED', 409);
  const stars = (v) => clamp(Math.round(Number(v)) || 0, 1, 5);
  o.rating = {
    food: stars(food),
    delivery: o.type === 'delivery' && delivery ? stars(delivery) : null,
    review: String(review || '').trim().slice(0, 500),
    tags: Array.isArray(tags) ? tags.slice(0, 6).map((t) => String(t).slice(0, 30)) : [],
    at: nowIso(),
    featured: false,
  };
  db.orders.put(o);
  logActivity(user, 'order.rated', { id: o.id, number: o.number, food: o.rating.food });
  bus.emit('order', o, {});
  return o;
}

export function moderateReview(id, actor, { reply, featured }) {
  const o = db.orders.get(id);
  if (!o?.rating) fail('NOT_FOUND', 404);
  if (reply !== undefined) o.rating.reply = { text: String(reply).trim().slice(0, 400), at: nowIso() };
  if (featured !== undefined) o.rating.featured = Boolean(featured);
  db.orders.put(o);
  logActivity(actor, 'review.update', { number: o.number });
  bus.emit('order', o, {});
  bus.emit('reviews');
  return o;
}

// ---------- reads ----------

export function canSee(user, o) {
  if (!o) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'rider') return o.riderId === user.id;
  return o.customerId === user.id;
}

/** The order as a given viewer may see it. */
export function viewOrder(o, viewer) {
  const out = { ...o };
  if (viewer.role === 'rider') delete out.otp;
  if (viewer.role === 'customer') { delete out.riderPay; delete out.cashSettled; }
  if (o.riderId) {
    const r = db.users.get(o.riderId);
    out.rider = r ? { id: r.id, name: r.name, phone: r.phone, vehicle: r.vehicle || '' } : null;
    if (viewer.role !== 'customer' || o.status === 'out_for_delivery') out.riderLocation = liveLocation(o.riderId);
  }
  return out;
}

export function listOrders(user, q = {}) {
  const where = [];
  const params = [];
  if (user.role === 'customer') { where.push('customerId = ?'); params.push(user.id); }
  if (user.role === 'rider') { where.push('riderId = ?'); params.push(user.id); }
  if (q.active === 'true' || q.active === true) where.push(`status IN (${ACTIVE_STATUSES.map(() => '?').join(',')})`), params.push(...ACTIVE_STATUSES);
  if (q.status) { const s = String(q.status).split(','); where.push(`status IN (${s.map(() => '?').join(',')})`); params.push(...s); }
  if (q.day) { where.push('day = ?'); params.push(q.day); }
  if (q.from) { where.push('day >= ?'); params.push(q.from); }
  if (q.to) { where.push('day <= ?'); params.push(q.to); }
  if (user.role === 'admin' && q.riderId) { where.push('riderId = ?'); params.push(q.riderId); }
  if (user.role === 'admin' && q.customerId) { where.push('customerId = ?'); params.push(q.customerId); }
  if (q.source) { where.push("json_extract(data, '$.source') = ?"); params.push(q.source); }
  if (q.q) {
    const term = `%${String(q.q).trim().replace(/^#/, '')}%`;
    where.push("(CAST(number AS TEXT) LIKE ? OR phone LIKE ? OR json_extract(data, '$.customerName') LIKE ?)");
    params.push(term, term, term);
  }
  const w = where.join(' AND ') || '1=1';
  const limit = clamp(Number(q.limit) || 50, 1, 500);
  const offset = Math.max(0, Number(q.offset) || 0);
  return {
    total: db.orders.count(w, params),
    orders: db.orders.find(w, params, { order: 'createdAt DESC', limit, offset }).map((o) => viewOrder(o, user)),
  };
}

export function getOrder(id, user) {
  const o = db.orders.get(id);
  if (!canSee(user, o)) fail('NOT_FOUND', 404);
  return viewOrder(o, user);
}
