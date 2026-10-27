import { db, nowIso } from '../db/database.js';
import { bus } from '../lib/bus.js';
import { fail, AppError } from '../lib/errors.js';
import { logActivity } from './activity.js';

const TYPES = ['percent', 'flat', 'freedelivery'];

export const listCoupons = () => db.coupons.all().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

/** Offers the website may advertise. */
export function publicOffers() {
  const now = nowIso();
  return listCoupons()
    .filter((c) => c.active && c.public && (!c.validTo || c.validTo >= now) && (!c.usageLimit || c.used < c.usageLimit))
    .map(({ code, title, titleTa, type, value, maxDiscount, minOrder, firstOrderOnly, validTo }) =>
      ({ code, title, titleTa, type, value, maxDiscount, minOrder, firstOrderOnly, validTo }));
}

export function saveCoupon(code, input, actor) {
  const id = String(code || input.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  if (!id) fail('BAD_REQUEST');
  const existing = db.coupons.get(id);
  if (!code && existing) fail('CODE_TAKEN', 409);
  const type = TYPES.includes(input.type) ? input.type : existing?.type || 'flat';
  const num = (v, d = 0) => (v === '' || v === null || v === undefined ? d : Math.max(0, Number(v) || 0));
  const coupon = {
    ...(existing || { id, code: id, used: 0, createdAt: nowIso() }),
    title: String(input.title ?? existing?.title ?? '').slice(0, 80),
    titleTa: String(input.titleTa ?? existing?.titleTa ?? '').slice(0, 80),
    type,
    value: type === 'freedelivery' ? 0 : num(input.value ?? existing?.value),
    maxDiscount: num(input.maxDiscount ?? existing?.maxDiscount) || null,
    minOrder: num(input.minOrder ?? existing?.minOrder),
    firstOrderOnly: Boolean(input.firstOrderOnly ?? existing?.firstOrderOnly),
    perUserLimit: num(input.perUserLimit ?? existing?.perUserLimit, 1),
    usageLimit: num(input.usageLimit ?? existing?.usageLimit) || null,
    validTo: input.validTo !== undefined ? (input.validTo || null) : existing?.validTo || null,
    active: Boolean(input.active ?? existing?.active ?? true),
    public: Boolean(input.public ?? existing?.public ?? true),
    updatedAt: nowIso(),
  };
  if (type === 'percent' && (coupon.value <= 0 || coupon.value > 100)) fail('BAD_REQUEST');
  db.coupons.put(coupon);
  logActivity(actor, existing ? 'coupon.update' : 'coupon.create', { code: id });
  bus.emit('offers', publicOffers());
  return coupon;
}

export function deleteCoupon(code, actor) {
  if (!db.coupons.remove(code)) fail('NOT_FOUND', 404);
  logActivity(actor, 'coupon.delete', { code });
  bus.emit('offers', publicOffers());
}

/**
 * Check a code for a cart. Returns the coupon, or throws an AppError
 * (COUPON_*) the checkout shows next to the code box.
 */
export function validateCoupon(rawCode, { user, subtotal, type }) {
  const code = String(rawCode || '').trim().toUpperCase();
  const c = db.coupons.get(code);
  if (!c || !c.active) throw new AppError('COUPON_INVALID');
  if (c.validTo && c.validTo < nowIso()) throw new AppError('COUPON_EXPIRED');
  if (c.usageLimit && c.used >= c.usageLimit) throw new AppError('COUPON_LIMIT');
  if (c.type === 'freedelivery' && type !== 'delivery') throw new AppError('COUPON_DELIVERY');
  if (subtotal < c.minOrder) throw new AppError('COUPON_MIN', 400, { gap: c.minOrder - subtotal, min: c.minOrder });
  if (user) {
    const mine = db.orders.find("customerId = ? AND status NOT IN ('rejected','cancelled')", [user.id]);
    if (c.firstOrderOnly && mine.length) throw new AppError('COUPON_FIRST');
    const uses = mine.filter((o) => o.bill.couponCode === code).length;
    if (c.perUserLimit && uses >= c.perUserLimit) throw new AppError('COUPON_USED');
  }
  return c;
}

export function countCouponUse(code, delta) {
  if (code) db.coupons.update(code, (c) => { c.used = Math.max(0, (c.used || 0) + delta); });
}
