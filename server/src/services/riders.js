import { db, newId, nowIso, transaction } from '../db/database.js';
import { bus } from '../lib/bus.js';
import { fail } from '../lib/errors.js';
import { dayKey, haversineKm, ACTIVE_STATUSES } from '@velan/shared/domain.js';
import { createUser, publicUser, setPassword, endSessions, validatePhone } from './auth.js';
import { getSettings } from './settings.js';
import { logActivity } from './activity.js';

// Live GPS lives in memory and is written to the rider's record at most every 20 s.
const live = new Map();
const persistedAt = new Map();

export function liveLocation(riderId) {
  return live.get(riderId) || db.users.get(riderId)?.location || null;
}

export function updateLocation(rider, loc) {
  const lat = Number(loc?.lat);
  const lng = Number(loc?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const point = {
    lat, lng,
    heading: loc.heading != null && Number.isFinite(Number(loc.heading)) ? Number(loc.heading) : null,
    speed: loc.speed != null && Number.isFinite(Number(loc.speed)) ? Number(loc.speed) : null,
    accuracy: loc.accuracy != null && Number.isFinite(Number(loc.accuracy)) ? Math.round(Number(loc.accuracy)) : null,
    // 'gps' from the phone, 'manual' when the rider set it by hand, 'demo' for the demo drive.
    source: ['gps', 'manual', 'demo'].includes(loc.source) ? loc.source : 'gps',
    at: nowIso(),
  };
  live.set(rider.id, point);
  if (Date.now() - (persistedAt.get(rider.id) || 0) > 20_000) {
    persistedAt.set(rider.id, Date.now());
    db.users.update(rider.id, { location: point });
  }
  return point;
}

const activeFor = (riderId) => db.orders.count(
  `riderId = ? AND status IN (${ACTIVE_STATUSES.map(() => '?').join(',')})`, [riderId, ...ACTIVE_STATUSES],
);

/** The online rider with the fewest active jobs, nearest to the restaurant. */
export function pickRider() {
  const s = getSettings();
  const candidates = db.users.find("role = 'rider'").filter((r) => r.active && r.online);
  let best = null;
  for (const r of candidates) {
    const loc = liveLocation(r.id);
    const score = activeFor(r.id) * 100 + (loc ? haversineKm(s, loc) : 0);
    if (!best || score < best.score) best = { r, score };
  }
  return best?.r || null;
}

function statsFor(riderId, fromDay) {
  const orders = db.orders.find("riderId = ? AND status = 'delivered' AND day >= ?", [riderId, fromDay]);
  const sum = (f) => orders.reduce((s, o) => s + (f(o) || 0), 0);
  const durations = orders.filter((o) => o.pickedAt && o.deliveredAt)
    .map((o) => (new Date(o.deliveredAt) - new Date(o.pickedAt)) / 60000);
  return {
    deliveries: orders.length,
    km: Math.round(sum((o) => o.distanceKm) * 10) / 10,
    earnings: sum((o) => o.riderPay),
    cash: sum((o) => (o.payment.method === 'cash' ? o.bill.total : 0)),
    upi: sum((o) => (o.payment.method === 'upi' ? o.bill.total : 0)),
    avgMins: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
  };
}

function ratingFor(riderId) {
  const rated = db.orders.find("riderId = ? AND status = 'delivered' AND json_extract(data, '$.rating.delivery') IS NOT NULL", [riderId]);
  if (!rated.length) return { avg: null, count: 0 };
  return { avg: Math.round((rated.reduce((s, o) => s + o.rating.delivery, 0) / rated.length) * 10) / 10, count: rated.length };
}

export function cashInHand(riderId) {
  const orders = db.orders.find("riderId = ? AND status = 'delivered' AND json_extract(data, '$.cashSettled') = 0", [riderId]);
  return { amount: orders.reduce((s, o) => s + o.bill.total, 0), orders };
}

/** Rider list for the admin, with today's numbers. */
/** A rider as the admin sees them: live position, workload and today's numbers. */
export function riderRow(r) {
  return {
    ...publicUser(r),
    location: liveLocation(r.id),
    activeOrders: activeFor(r.id),
    today: statsFor(r.id, dayKey()),
    rating: ratingFor(r.id),
    cashInHand: cashInHand(r.id).amount,
  };
}

export function listRiders() {
  return db.users.find("role = 'rider'", [], { order: 'json_extract(data, \'$.name\')' }).map(riderRow);
}

export function riderView(r) {
  return {
    ...publicUser(r),
    location: liveLocation(r.id),
    activeOrders: activeFor(r.id),
  };
}

/** Everything the delivery app's Earnings and Profile tabs show. */
export function riderSummary(rider) {
  const today = dayKey();
  const weekStart = dayKey(Date.now() - 6 * 864e5);
  const recent = db.orders.find("riderId = ? AND status = 'delivered'", [rider.id], { order: 'createdAt DESC', limit: 30 })
    .map((o) => ({
      id: o.id, number: o.number, deliveredAt: o.deliveredAt, total: o.bill.total, method: o.payment.method,
      distanceKm: o.distanceKm, riderPay: o.riderPay, customerName: o.customerName, area: o.address?.line || '', rating: o.rating?.delivery || null,
    }));
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = dayKey(Date.now() - i * 864e5);
    const exact = db.orders.find("riderId = ? AND status = 'delivered' AND day = ?", [rider.id, d]);
    days.push({
      day: d,
      deliveries: exact.length,
      earnings: exact.reduce((s, o) => s + (o.riderPay || 0), 0),
      km: Math.round(exact.reduce((s, o) => s + (o.distanceKm || 0), 0) * 10) / 10,
    });
  }
  return {
    rider: riderView(db.users.get(rider.id)),
    today: statsFor(rider.id, today),
    week: statsFor(rider.id, weekStart),
    days,
    rating: ratingFor(rider.id),
    cashInHand: cashInHand(rider.id).amount,
    settlements: db.settlements.find('riderId = ?', [rider.id], { order: 'createdAt DESC', limit: 10 }),
    recent,
    pay: { base: getSettings().riderPayBase, perKm: getSettings().riderPayPerKm },
  };
}

export function setOnline(rider, online) {
  const r = db.users.update(rider.id, { online: Boolean(online), onlineSince: online ? nowIso() : null });
  logActivity(rider, online ? 'rider.online' : 'rider.offline', {});
  bus.emit('rider', riderRow(r));
  return riderView(r);
}

export function createRider(input, actor) {
  const r = createUser({
    role: 'rider', name: input.name, phone: input.phone, password: input.password,
    vehicle: String(input.vehicle || '').toUpperCase().slice(0, 20), online: false,
  });
  logActivity(actor, 'rider.create', { name: r.name });
  bus.emit('rider', riderRow(r));
  return riderView(r);
}

export function updateRider(id, input, actor) {
  const r = db.users.get(id);
  if (!r || r.role !== 'rider') fail('NOT_FOUND', 404);
  const patch = {};
  if (input.name !== undefined) patch.name = String(input.name).trim().slice(0, 60) || r.name;
  if (input.vehicle !== undefined) patch.vehicle = String(input.vehicle).toUpperCase().slice(0, 20);
  if (input.phone !== undefined && input.phone !== r.phone) {
    patch.phone = validatePhone(input.phone);
    if (db.users.findOne("role = 'rider' AND phone = ? AND id != ?", [patch.phone, id])) fail('PHONE_TAKEN', 409);
  }
  if (input.active !== undefined) {
    patch.active = Boolean(input.active);
    if (!patch.active) { patch.online = false; endSessions(id); }
  }
  const next = db.users.update(id, patch);
  if (input.password) setPassword(id, input.password);
  logActivity(actor, 'rider.update', { name: next.name });
  bus.emit('rider', riderRow(next));
  return riderView(next);
}

/** Admin received the cash a rider collected: settle all open cash orders. */
export function settleCash(riderId, actor, note = '') {
  return transaction(() => {
    const rider = db.users.get(riderId);
    if (!rider || rider.role !== 'rider') fail('NOT_FOUND', 404);
    const { amount, orders } = cashInHand(riderId);
    if (!orders.length) fail('NOTHING_TO_SETTLE', 409);
    const s = {
      id: newId('set'), riderId, amount, orderIds: orders.map((o) => o.id), count: orders.length,
      note: String(note || '').slice(0, 200), createdAt: nowIso(), by: actor.name,
    };
    db.settlements.insert(s);
    for (const o of orders) db.orders.update(o.id, { cashSettled: true, settlementId: s.id });
    logActivity(actor, 'rider.settled', { name: rider.name, amount });
    bus.emit('rider', riderRow(rider));
    return s;
  });
}

export function riderLedger(riderId) {
  const r = db.users.get(riderId);
  if (!r || r.role !== 'rider') fail('NOT_FOUND', 404);
  const { amount, orders } = cashInHand(riderId);
  return {
    rider: riderView(r),
    cashInHand: amount,
    openOrders: orders.map((o) => ({ id: o.id, number: o.number, total: o.bill.total, deliveredAt: o.deliveredAt, customerName: o.customerName })),
    settlements: db.settlements.find('riderId = ?', [riderId], { order: 'createdAt DESC', limit: 50 }),
    week: statsFor(riderId, dayKey(Date.now() - 6 * 864e5)),
    rating: ratingFor(riderId),
  };
}
