import { db, sql, newId, nowIso, transaction } from '../db/database.js';
import { bus } from '../lib/bus.js';
import { fail } from '../lib/errors.js';
import { dayKey } from '@velan/shared/domain.js';
import { logActivity } from './activity.js';

const TEXT = ['name', 'nameTa', 'description', 'descTa', 'image', 'categoryId'];
const INTS = ['price', 'stock', 'dailyStock', 'spicy', 'sort', 'serves'];
const BOOLS = ['veg', 'bestseller', 'chefSpecial', 'isNew', 'available'];

function clean(input, base) {
  const out = { ...base };
  for (const k of TEXT) if (k in input) out[k] = String(input[k] ?? '').trim().slice(0, k.startsWith('desc') ? 400 : 200);
  for (const k of INTS) {
    if (!(k in input)) continue;
    const v = Math.round(Number(input[k]));
    if (!Number.isFinite(v) || v < 0) fail('BAD_REQUEST');
    out[k] = k === 'spicy' ? Math.min(3, v) : v;
  }
  if ('mrp' in input) out.mrp = input.mrp ? Math.max(0, Math.round(Number(input.mrp))) || null : null;
  for (const k of BOOLS) if (k in input) out[k] = Boolean(input[k]);
  if (!out.name) fail('NAME_REQUIRED');
  if (out.categoryId && !db.categories.get(out.categoryId)) fail('BAD_REQUEST');
  return out;
}

// ---------- reads ----------

export const listCategories = () => db.categories.all('sort');

let popularity = { at: 0, map: {} };
/** Plates sold per dish over the last 30 days (cached for a minute). */
export function popularityMap() {
  if (Date.now() - popularity.at < 60_000) return popularity.map;
  const since = dayKey(Date.now() - 30 * 864e5);
  const rows = sql.prepare(`
    SELECT json_extract(j.value, '$.id') AS id, SUM(json_extract(j.value, '$.qty')) AS qty
    FROM orders, json_each(orders.data, '$.items') AS j
    WHERE orders.day >= ? AND orders.status NOT IN ('rejected', 'cancelled')
    GROUP BY 1`).all(since);
  popularity = { at: Date.now(), map: Object.fromEntries(rows.map((r) => [r.id, r.qty])) };
  return popularity.map;
}

export function listMenu() {
  const pop = popularityMap();
  return db.menu.all('sort').map((m) => ({ ...m, sold30d: pop[m.id] || 0 }));
}

export const menuPayload = () => ({ categories: listCategories(), items: listMenu() });
const changed = () => { popularity.at = 0; bus.emit('menu', menuPayload()); };

// ---------- dishes ----------

export function createItem(input, actor) {
  const item = clean(input, {
    id: newId('dish'), categoryId: listCategories()[0]?.id || '', name: '', nameTa: '', description: '', descTa: '',
    price: 0, mrp: null, veg: false, spicy: 1, bestseller: false, chefSpecial: false, isNew: true, available: true,
    stock: 30, dailyStock: 30, image: '', serves: 1, sort: db.menu.count(), createdAt: nowIso(),
  });
  item.updatedAt = nowIso();
  db.menu.insert(item);
  logActivity(actor, 'menu.create', { id: item.id, name: item.name });
  changed();
  return item;
}

export function updateItem(id, input, actor) {
  const existing = db.menu.get(id) || fail('NOT_FOUND', 404);
  const item = clean(input, existing);
  item.updatedAt = nowIso();
  db.menu.put(item);
  const priceChanged = 'price' in input && input.price !== existing.price;
  logActivity(actor, priceChanged ? 'menu.price' : 'menu.update', {
    id, name: item.name, ...(priceChanged ? { from: existing.price, to: item.price } : {}),
  });
  changed();
  return item;
}

/** Delete dishes; returns what was removed so the admin can undo. */
export function deleteItems(ids, actor) {
  const removed = [];
  transaction(() => {
    for (const id of ids) {
      const item = db.menu.get(id);
      if (!item) continue;
      db.menu.remove(id);
      removed.push(item);
    }
  });
  if (!removed.length) fail('NOT_FOUND', 404);
  logActivity(actor, 'menu.delete', { count: removed.length, name: removed.map((m) => m.name).join(', ').slice(0, 120) });
  changed();
  return removed;
}

export const deleteItem = (id, actor) => deleteItems([id], actor)[0];

/** Put deleted dishes back exactly as they were (same id, so past orders still match). */
export function restoreItems(items, actor) {
  const restored = [];
  transaction(() => {
    for (const raw of Array.isArray(items) ? items : []) {
      if (!raw?.id || db.menu.get(raw.id)) continue;
      const cat = db.categories.get(raw.categoryId) ? raw.categoryId : listCategories()[0]?.id || '';
      const item = { ...clean(raw, { ...raw, categoryId: cat }), id: String(raw.id).slice(0, 40), updatedAt: nowIso() };
      delete item.sold30d;
      db.menu.insert(item);
      restored.push(item);
    }
  });
  if (restored.length) {
    logActivity(actor, 'menu.restore', { count: restored.length, name: restored.map((m) => m.name).join(', ').slice(0, 120) });
    changed();
  }
  return restored;
}

/** Same change for many dishes (hide, show, mark sold out, restock…). */
export function bulkUpdate(ids, patch, actor) {
  transaction(() => {
    for (const id of ids) {
      const it = db.menu.get(id);
      if (it) db.menu.put({ ...clean(patch, it), updatedAt: nowIso() });
    }
  });
  logActivity(actor, 'menu.bulk', { count: ids.length, patch });
  changed();
}

export function reorderItems(ids) {
  transaction(() => ids.forEach((id, i) => db.menu.update(id, { sort: i })));
  changed();
}

export function resetStock(actor) {
  transaction(() => {
    for (const m of db.menu.all()) db.menu.update(m.id, { stock: m.dailyStock });
  });
  logActivity(actor, 'menu.restock', {});
  changed();
}

// ---------- categories ----------

export function saveCategory(id, input, actor) {
  const base = id ? db.categories.get(id) || fail('NOT_FOUND', 404) : { id: newId('cat'), sort: db.categories.count() };
  const cat = {
    ...base,
    name: String(input.name ?? base.name ?? '').trim().slice(0, 60),
    nameTa: String(input.nameTa ?? base.nameTa ?? '').trim().slice(0, 60),
    tagline: String(input.tagline ?? base.tagline ?? '').trim().slice(0, 120),
    taglineTa: String(input.taglineTa ?? base.taglineTa ?? '').trim().slice(0, 120),
  };
  if ('sort' in input) cat.sort = Math.round(Number(input.sort)) || 0;
  if (!cat.name) fail('NAME_REQUIRED');
  db.categories.put(cat);
  logActivity(actor, id ? 'category.update' : 'category.create', { name: cat.name });
  changed();
  return cat;
}

/** Delete a category. Its dishes must be moved first, or `moveTo` names the category that takes them. */
export function deleteCategory(id, actor, moveTo) {
  const cat = db.categories.get(id) || fail('NOT_FOUND', 404);
  const dishes = db.menu.find('categoryId = ?', [id]);
  if (dishes.length) {
    if (!moveTo || moveTo === id || !db.categories.get(moveTo)) fail('CATEGORY_NOT_EMPTY', 409);
    transaction(() => dishes.forEach((m) => db.menu.update(m.id, { categoryId: moveTo, updatedAt: nowIso() })));
  }
  db.categories.remove(id);
  logActivity(actor, 'category.delete', { name: cat.name });
  changed();
}

export function reorderCategories(ids) {
  transaction(() => ids.forEach((id, i) => db.categories.update(id, { sort: i })));
  changed();
}

// ---------- stock movements (called inside order transactions) ----------

export function takeStock(lines) {
  for (const l of lines) db.menu.update(l.id, (m) => { m.stock = Math.max(0, m.stock - l.qty); });
  changed();
}

export function returnStock(lines) {
  for (const l of lines) db.menu.update(l.id, (m) => { m.stock += l.qty; });
  changed();
}
