// REST API. Route handlers stay thin: validate the caller, call a service, return JSON.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import { db, newId, nowIso } from '../db/database.js';
import { fail } from '../lib/errors.js';
import { UPLOAD_DIR } from '../config.js';
import { requireRole, rateLimit, tokenOf } from './middleware.js';
import * as auth from '../services/auth.js';
import * as menu from '../services/menu.js';
import * as orders from '../services/orders.js';
import * as riders from '../services/riders.js';
import * as coupons from '../services/coupons.js';
import * as analytics from '../services/analytics.js';
import { publicSettings, updateSettings } from '../services/settings.js';
import { listActivity } from '../services/activity.js';
import { resolveMapLink } from '../services/geo.js';
import { dayKey } from '@velan/shared/domain.js';

export const api = Router();
const admin = requireRole('admin');
const rider = requireRole('rider');
const customer = requireRole('customer');
const anyone = requireRole();

// ---------- public ----------

api.get('/bootstrap', (_req, res) => {
  res.json({
    settings: publicSettings(),
    ...menu.menuPayload(),
    offers: coupons.publicOffers(),
    reviews: analytics.publicReviews(),
    stats: analytics.publicStats(),
  });
});
api.get('/settings', (_req, res) => res.json(publicSettings()));
api.get('/menu', (_req, res) => res.json(menu.menuPayload()));
api.post('/cart/price', (req, res) => res.json(orders.priceCart(req.user?.role === 'customer' ? req.user : null, req.body || {})));
const geoLimit = rateLimit({ windowMs: 10 * 60_000, max: 60 });
api.get('/geo/resolve', geoLimit, async (req, res, next) => {
  try { res.json(await resolveMapLink(req.query.url)); } catch (e) { next(e); }
});

// ---------- auth ----------

const authLimit = rateLimit({ windowMs: 10 * 60_000, max: 25 });
api.post('/auth/register', authLimit, (req, res) => res.status(201).json(auth.register(req.body || {})));
api.post('/auth/login', authLimit, (req, res) => res.json(auth.login(req.body || {})));
api.get('/auth/me', anyone, (req, res) => res.json({ user: auth.publicUser(req.user) }));
api.post('/auth/logout', (req, res) => { auth.logout(tokenOf(req)); res.json({ ok: true }); });
api.post('/auth/password', anyone, (req, res) => { auth.changePassword(req.user, req.body || {}); res.json({ ok: true }); });
api.put('/me', anyone, (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 60) || fail('NAME_REQUIRED');
  const email = String(req.body?.email ?? req.user.email ?? '').trim().slice(0, 120);
  res.json({ user: auth.publicUser(db.users.update(req.user.id, { name, email })) });
});

// ---------- customer ----------

api.get('/me/addresses', customer, (req, res) => res.json(db.addresses.find('userId = ?', [req.user.id], { order: 'json_extract(data, \'$.createdAt\') DESC' })));
api.post('/me/addresses', customer, (req, res) => {
  const a = orders.cleanAddress(req.body) || fail('ADDRESS_REQUIRED');
  res.status(201).json(db.addresses.insert({ id: newId('adr'), userId: req.user.id, ...a, createdAt: nowIso() }));
});
api.put('/me/addresses/:id', customer, (req, res) => {
  const old = db.addresses.get(req.params.id);
  if (!old || old.userId !== req.user.id) fail('NOT_FOUND', 404);
  const a = orders.cleanAddress({ ...old, ...req.body }) || fail('ADDRESS_REQUIRED');
  res.json(db.addresses.put({ ...old, ...a, updatedAt: nowIso() }));
});
api.delete('/me/addresses/:id', customer, (req, res) => {
  const a = db.addresses.get(req.params.id);
  if (!a || a.userId !== req.user.id) fail('NOT_FOUND', 404);
  db.addresses.remove(a.id);
  res.json({ ok: true });
});
api.post('/orders', customer, (req, res) => res.status(201).json(orders.viewOrder(orders.placeOrder(req.user, req.body || {}, 'online'), req.user)));
api.post('/orders/:id/cancel', customer, (req, res) => {
  res.json(orders.viewOrder(orders.transition(req.params.id, req.user, { status: 'cancelled', reason: req.body?.reason }), req.user));
});
api.post('/orders/:id/rate', customer, (req, res) => res.json(orders.viewOrder(orders.rateOrder(req.params.id, req.user, req.body || {}), req.user)));

// ---------- orders (any signed-in role; services enforce visibility) ----------

api.get('/orders', anyone, (req, res) => res.json(orders.listOrders(req.user, req.query)));
api.get('/orders/:id', anyone, (req, res) => res.json(orders.getOrder(req.params.id, req.user)));
api.post('/orders/:id/status', requireRole('admin', 'rider'), (req, res) => {
  res.json(orders.viewOrder(orders.transition(req.params.id, req.user, req.body || {}), req.user));
});
api.post('/orders/:id/assign', admin, (req, res) => res.json(orders.viewOrder(orders.assignRider(req.params.id, req.body?.riderId ?? null, req.user), req.user)));
api.post('/orders/:id/paid', admin, (req, res) => res.json(orders.viewOrder(orders.markPaid(req.params.id, req.user), req.user)));
api.post('/orders/:id/arrived', rider, (req, res) => res.json(orders.viewOrder(orders.markArrived(req.params.id, req.user), req.user)));

// ---------- admin ----------

api.get('/admin/overview', admin, (req, res) => res.json(analytics.overview(req.query.range)));
api.get('/admin/reports/sales', admin, (req, res) => {
  const to = req.query.to || dayKey();
  const from = req.query.from || dayKey(Date.now() - 29 * 864e5);
  res.json(analytics.salesReport(from, to));
});
api.post('/admin/orders', admin, (req, res) => {
  const source = req.body?.source === 'phone' ? 'phone' : 'counter';
  res.status(201).json(orders.viewOrder(orders.placeOrder(req.user, req.body || {}, source), req.user));
});

api.get('/admin/menu', admin, (_req, res) => res.json(menu.menuPayload()));
api.post('/admin/menu', admin, (req, res) => res.status(201).json(menu.createItem(req.body || {}, req.user)));
api.post('/admin/menu/reset-stock', admin, (req, res) => { menu.resetStock(req.user); res.json(menu.menuPayload()); });
api.post('/admin/menu/reorder', admin, (req, res) => { menu.reorderItems(req.body?.ids || []); res.json({ ok: true }); });
api.post('/admin/menu/bulk', admin, (req, res) => { menu.bulkUpdate(req.body?.ids || [], req.body?.patch || {}, req.user); res.json(menu.menuPayload()); });
api.put('/admin/menu/:id', admin, (req, res) => res.json(menu.updateItem(req.params.id, req.body || {}, req.user)));
api.delete('/admin/menu/:id', admin, (req, res) => res.json({ removed: [menu.deleteItem(req.params.id, req.user)] }));
api.post('/admin/menu/bulk-delete', admin, (req, res) => res.json({ removed: menu.deleteItems((req.body?.ids || []).slice(0, 500), req.user) }));
api.post('/admin/menu/restore', admin, (req, res) => res.json({ restored: menu.restoreItems((req.body?.items || []).slice(0, 500), req.user) }));
api.post('/admin/categories', admin, (req, res) => res.status(201).json(menu.saveCategory(null, req.body || {}, req.user)));
api.post('/admin/categories/reorder', admin, (req, res) => { menu.reorderCategories(req.body?.ids || []); res.json({ ok: true }); });
api.put('/admin/categories/:id', admin, (req, res) => res.json(menu.saveCategory(req.params.id, req.body || {}, req.user)));
api.delete('/admin/categories/:id', admin, (req, res) => { menu.deleteCategory(req.params.id, req.user, req.query.moveTo); res.json({ ok: true }); });

api.post('/admin/upload', admin, (req, res) => {
  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(String(req.body?.dataUrl || ''));
  if (!m) fail('IMAGE_INVALID');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 3 * 1024 * 1024) fail('IMAGE_INVALID');
  const name = `dish_${crypto.randomBytes(8).toString('hex')}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  res.status(201).json({ url: `/uploads/${name}` });
});

api.get('/admin/riders', admin, (_req, res) => res.json(riders.listRiders()));
api.post('/admin/riders', admin, (req, res) => res.status(201).json(riders.createRider(req.body || {}, req.user)));
api.put('/admin/riders/:id', admin, (req, res) => res.json(riders.updateRider(req.params.id, req.body || {}, req.user)));
api.get('/admin/riders/:id/ledger', admin, (req, res) => res.json(riders.riderLedger(req.params.id)));
api.post('/admin/riders/:id/settle', admin, (req, res) => res.json(riders.settleCash(req.params.id, req.user, req.body?.note)));

api.get('/admin/customers', admin, (req, res) => res.json(analytics.listCustomers(req.query)));
api.get('/admin/customers/:key', admin, (req, res) => res.json(analytics.customerDetail(req.params.key) || fail('NOT_FOUND', 404)));

api.get('/admin/coupons', admin, (_req, res) => res.json(coupons.listCoupons()));
api.post('/admin/coupons', admin, (req, res) => res.status(201).json(coupons.saveCoupon(null, req.body || {}, req.user)));
api.put('/admin/coupons/:code', admin, (req, res) => res.json(coupons.saveCoupon(req.params.code, req.body || {}, req.user)));
api.delete('/admin/coupons/:code', admin, (req, res) => { coupons.deleteCoupon(req.params.code, req.user); res.json({ ok: true }); });

api.get('/admin/reviews', admin, (req, res) => res.json(analytics.listReviews(req.query)));
api.put('/admin/reviews/:orderId', admin, (req, res) => res.json(orders.moderateReview(req.params.orderId, req.user, req.body || {})));

api.get('/admin/activity', admin, (req, res) => res.json(listActivity({ limit: Math.min(200, Number(req.query.limit) || 60), before: req.query.before })));
api.put('/admin/settings', admin, (req, res) => res.json(updateSettings(req.body || {}, req.user)));

// ---------- delivery partner ----------

api.get('/rider/me', rider, (req, res) => res.json(riders.riderSummary(req.user)));
api.post('/rider/online', rider, (req, res) => res.json(riders.setOnline(req.user, req.body?.online)));

api.use((_req, _res) => fail('NOT_FOUND', 404));
