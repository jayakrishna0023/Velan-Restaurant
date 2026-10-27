// Numbers for the admin dashboard, reports, customers and reviews screens.
// A single restaurant has a few thousand orders a month at most, so we load the
// window once and aggregate in JS — simple, and easy to extend.
import { db, sql } from '../db/database.js';
import { dayKey, istHour, istWeekday, ACTIVE_STATUSES } from '@velan/shared/domain.js';
import { listRiders } from './riders.js';

const VOID = ['rejected', 'cancelled'];
const valid = (o) => !VOID.includes(o.status);
const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const round1 = (v) => (v === null ? null : Math.round(v * 10) / 10);
const mins = (a, b) => (new Date(b) - new Date(a)) / 60000;
const RANGES = { today: 1, '7d': 7, '30d': 30, '90d': 90 };

function ordersBetween(from, to) {
  return db.orders.find('day >= ? AND day <= ?', [from, to]);
}

function kpisOf(list) {
  const ok = list.filter(valid);
  const revenue = sum(ok, (o) => o.bill.total);
  const prep = ok.filter((o) => o.acceptedAt && o.readyAt).map((o) => mins(o.acceptedAt, o.readyAt));
  const deliv = ok.filter((o) => o.type === 'delivery' && o.deliveredAt).map((o) => mins(o.createdAt, o.deliveredAt));
  const rated = ok.filter((o) => o.rating);
  return {
    revenue,
    orders: ok.length,
    aov: ok.length ? Math.round(revenue / ok.length) : 0,
    customers: new Set(ok.map((o) => o.customerId || o.phone || o.id)).size,
    cancelRate: list.length ? round1(((list.length - ok.length) / list.length) * 100) : 0,
    avgPrepMins: round1(avg(prep)),
    avgDeliveryMins: round1(avg(deliv)),
    rating: round1(avg(rated.map((o) => o.rating.food))),
    discounts: sum(ok, (o) => o.bill.discount),
  };
}

function itemTotals(list) {
  const map = new Map();
  for (const o of list.filter(valid)) {
    for (const it of o.items) {
      const cur = map.get(it.id) || { id: it.id, name: it.name, nameTa: it.nameTa, image: it.image, veg: it.veg, qty: 0, revenue: 0 };
      cur.qty += it.qty;
      cur.revenue += it.qty * it.price;
      map.set(it.id, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty);
}

export function overview(rangeKey = 'today') {
  const days = RANGES[rangeKey] || 1;
  const today = dayKey();
  const from = dayKey(Date.now() - (days - 1) * 864e5);
  const prevFrom = dayKey(Date.now() - (2 * days - 1) * 864e5);
  const prevTo = dayKey(Date.now() - days * 864e5);
  const heatFrom = dayKey(Date.now() - 27 * 864e5);
  const all = ordersBetween(prevFrom < heatFrom ? prevFrom : heatFrom, today);
  const cur = all.filter((o) => o.day >= from);
  const prev = all.filter((o) => o.day >= prevFrom && o.day <= prevTo);

  const k = kpisOf(cur);
  const p = kpisOf(prev);
  const kpis = Object.fromEntries(Object.keys(k).map((key) => [key, { value: k[key], prev: p[key] }]));

  // Revenue series: by hour for a single day, otherwise by day.
  let series;
  if (days === 1) {
    series = Array.from({ length: 24 }, (_, h) => ({ label: h, revenue: 0, orders: 0, prevRevenue: 0 }));
    for (const o of cur.filter(valid)) { const h = istHour(o.createdAt); series[h].revenue += o.bill.total; series[h].orders += 1; }
    for (const o of prev.filter(valid)) series[istHour(o.createdAt)].prevRevenue += o.bill.total;
    series = series.slice(10, 24);
  } else {
    series = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = dayKey(Date.now() - i * 864e5);
      const pd = dayKey(Date.now() - (i + days) * 864e5);
      const dayOrders = cur.filter((o) => o.day === d && valid(o));
      series.push({
        label: d,
        revenue: sum(dayOrders, (o) => o.bill.total),
        orders: dayOrders.length,
        prevRevenue: sum(prev.filter((o) => o.day === pd && valid(o)), (o) => o.bill.total),
      });
    }
  }

  // Busy hours: weekday × hour over the last 4 weeks.
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const o of all.filter((x) => x.day >= heatFrom && valid(x))) heat[istWeekday(o.createdAt)][istHour(o.createdAt)] += 1;

  const menu = new Map(db.menu.all().map((m) => [m.id, m]));
  const cats = new Map(db.categories.all().map((c) => [c.id, { id: c.id, name: c.name, nameTa: c.nameTa, revenue: 0, qty: 0 }]));
  for (const it of itemTotals(cur)) {
    const c = cats.get(menu.get(it.id)?.categoryId);
    if (c) { c.revenue += it.revenue; c.qty += it.qty; }
  }

  const ok = cur.filter(valid);
  const split = (f) => ok.reduce((acc, o) => {
    const v = f(o);
    acc[v] = acc[v] || { count: 0, revenue: 0 };
    acc[v].count += 1;
    acc[v].revenue += o.bill.total;
    return acc;
  }, {});

  const riders = listRiders();
  const active = db.orders.find(`status IN (${ACTIVE_STATUSES.map(() => '?').join(',')})`, ACTIVE_STATUSES);
  const lowStock = db.menu.all('sort').filter((m) => m.available !== false && m.stock <= Math.max(3, Math.ceil(m.dailyStock * 0.15)))
    .map((m) => ({ id: m.id, name: m.name, nameTa: m.nameTa, stock: m.stock, dailyStock: m.dailyStock, image: m.image }));
  const reviews = cur.filter((o) => o.rating).sort((a, b) => b.rating.at.localeCompare(a.rating.at)).slice(0, 5)
    .map((o) => ({ id: o.id, number: o.number, customerName: o.customerName, ...o.rating }));

  return {
    range: { key: rangeKey, from, to: today, days },
    kpis,
    series,
    heat,
    topItems: itemTotals(cur).slice(0, 8),
    categories: [...cats.values()].filter((c) => c.qty).sort((a, b) => b.revenue - a.revenue),
    payments: split((o) => o.payment.method),
    sources: split((o) => o.source),
    types: split((o) => o.type),
    live: {
      byStatus: Object.fromEntries(ACTIVE_STATUSES.map((s) => [s, active.filter((o) => o.status === s).length])),
      ridersOnline: riders.filter((r) => r.online && r.active).length,
      ridersBusy: riders.filter((r) => r.online && r.activeOrders > 0).length,
      ridersTotal: riders.filter((r) => r.active).length,
      cashWithRiders: sum(riders, (r) => r.cashInHand),
    },
    lowStock,
    reviews,
  };
}

export function salesReport(from, to) {
  const list = ordersBetween(from, to);
  const days = new Map();
  for (const o of list) {
    const d = days.get(o.day) || { day: o.day, orders: 0, revenue: 0, subtotal: 0, discount: 0, deliveryFees: 0, packing: 0, tax: 0, cash: 0, upi: 0, cancelled: 0 };
    if (valid(o)) {
      d.orders += 1;
      d.revenue += o.bill.total;
      d.subtotal += o.bill.subtotal;
      d.discount += o.bill.discount;
      d.deliveryFees += o.bill.deliveryFee;
      d.packing += o.bill.packing;
      d.tax += o.bill.tax;
      d[o.payment.method] += o.bill.total;
    } else d.cancelled += 1;
    days.set(o.day, d);
  }
  const rows = [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
  const totals = rows.reduce((t, r) => {
    for (const [key, v] of Object.entries(r)) if (typeof v === 'number') t[key] = (t[key] || 0) + v;
    return t;
  }, {});
  return { from, to, days: rows, items: itemTotals(list), totals, kpis: kpisOf(list) };
}

// ---------- customers ----------

function segmentOf(c) {
  const since = c.lastAt ? (Date.now() - new Date(c.lastAt)) / 864e5 : null;
  if (c.orders >= 2 && since > 21) return 'at_risk';
  if (c.orders >= 12 || c.spent >= 6000) return 'vip';
  if (c.orders >= 4) return 'regular';
  const firstAge = c.firstAt ? (Date.now() - new Date(c.firstAt)) / 864e5 : (Date.now() - new Date(c.createdAt || 0)) / 864e5;
  if (firstAge <= 14) return 'new';
  return 'occasional';
}

function customerIndex() {
  const map = new Map();
  for (const u of db.users.find("role = 'customer'")) {
    map.set(u.id, { key: u.id, id: u.id, name: u.name, phone: u.phone, registered: true, createdAt: u.createdAt, orders: 0, spent: 0, firstAt: null, lastAt: null, ratings: [] });
  }
  for (const o of db.orders.all('createdAt')) {
    if (!valid(o)) continue;
    const key = o.customerId || (o.phone ? `p:${o.phone}` : null);
    if (!key) continue;
    const c = map.get(key) || { key, id: null, name: o.customerName, phone: o.phone, registered: false, createdAt: o.createdAt, orders: 0, spent: 0, firstAt: null, lastAt: null, ratings: [] };
    c.orders += 1;
    c.spent += o.bill.total;
    c.firstAt = c.firstAt || o.createdAt;
    c.lastAt = o.createdAt;
    if (o.rating) c.ratings.push(o.rating.food);
    map.set(key, c);
  }
  return [...map.values()].map(({ ratings, ...c }) => ({
    ...c, avgRating: round1(avg(ratings)), aov: c.orders ? Math.round(c.spent / c.orders) : 0, segment: segmentOf(c),
  }));
}

export function listCustomers({ q, segment, sort = 'spent' } = {}) {
  let list = customerIndex();
  const counts = list.reduce((acc, c) => { acc[c.segment] = (acc[c.segment] || 0) + 1; return acc; }, { all: list.length });
  if (segment && segment !== 'all') list = list.filter((c) => c.segment === segment);
  if (q) {
    const t = String(q).toLowerCase();
    list = list.filter((c) => c.name?.toLowerCase().includes(t) || c.phone?.includes(t));
  }
  const by = { spent: (a, b) => b.spent - a.spent, orders: (a, b) => b.orders - a.orders, recent: (a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''), name: (a, b) => a.name.localeCompare(b.name) };
  list.sort(by[sort] || by.spent);
  return { customers: list, counts };
}

export function customerDetail(key) {
  const c = customerIndex().find((x) => x.key === key);
  if (!c) return null;
  const orders = key.startsWith('p:')
    ? db.orders.find('phone = ?', [key.slice(2)], { order: 'createdAt DESC', limit: 100 })
    : db.orders.find('customerId = ?', [key], { order: 'createdAt DESC', limit: 100 });
  return {
    customer: c,
    orders,
    favorites: itemTotals(orders).slice(0, 5),
    addresses: c.id ? db.addresses.find('userId = ?', [c.id]) : [],
  };
}

// ---------- reviews ----------

const reviewRow = (o) => ({
  orderId: o.id, number: o.number, customerName: o.customerName, items: o.items.map((i) => ({ name: i.name, nameTa: i.nameTa, qty: i.qty })),
  riderId: o.riderId, day: o.day, type: o.type, ...o.rating,
});

export function listReviews({ filter = 'all' } = {}) {
  const rated = db.orders.find("json_extract(data, '$.rating') IS NOT NULL", [], { order: "json_extract(data, '$.rating.at') DESC", limit: 500 });
  const dist = [1, 2, 3, 4, 5].map((s) => rated.filter((o) => o.rating.food === s).length);
  let rows = rated;
  if (filter === 'low') rows = rated.filter((o) => o.rating.food <= 3);
  if (filter === 'unreplied') rows = rated.filter((o) => o.rating.review && !o.rating.reply);
  if (filter === 'featured') rows = rated.filter((o) => o.rating.featured);
  const withDelivery = rated.filter((o) => o.rating.delivery);
  return {
    summary: {
      count: rated.length,
      food: round1(avg(rated.map((o) => o.rating.food))),
      delivery: round1(avg(withDelivery.map((o) => o.rating.delivery))),
      distribution: dist,
    },
    reviews: rows.map(reviewRow),
  };
}

/** Reviews for the website: featured ones first, then recent glowing ones. */
export function publicReviews() {
  const rated = db.orders.find(
    "json_extract(data, '$.rating.food') >= 4 AND length(json_extract(data, '$.rating.review')) > 12",
    [], { order: "json_extract(data, '$.rating.at') DESC", limit: 60 },
  );
  rated.sort((a, b) => Number(b.rating.featured) - Number(a.rating.featured));
  const seen = new Set();
  const unique = rated.filter((o) => { const k = o.rating.review.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  return unique.slice(0, 12).map((o) => ({
    name: o.customerName.split(' ')[0], rating: o.rating.food, review: o.rating.review, day: o.day,
    items: o.items.slice(0, 2).map((i) => ({ name: i.name, nameTa: i.nameTa })), reply: o.rating.reply?.text || null,
  }));
}

export function publicStats() {
  const row = sql.prepare(`SELECT COUNT(*) AS n, AVG(json_extract(data, '$.rating.food')) AS avg
    FROM orders WHERE json_extract(data, '$.rating.food') IS NOT NULL`).get();
  return {
    rating: row.avg ? Math.round(row.avg * 10) / 10 : null,
    ratings: row.n,
    served: db.orders.count("status = 'delivered'"),
    customers: db.users.count("role = 'customer'"),
  };
}
