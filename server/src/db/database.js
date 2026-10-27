// SQLite through Node's built-in driver (no native add-ons to compile).
// Each collection is a table of JSON documents; the fields we filter or sort on
// are exposed as indexed generated columns, so queries stay fast and the
// document shape can grow without migrations.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { DB_FILE, UPLOAD_DIR } from '../config.js';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const sql = new DatabaseSync(DB_FILE);
sql.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 4000;
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

const statements = new Map();
const prepared = (q) => {
  let s = statements.get(q);
  if (!s) { s = sql.prepare(q); statements.set(q, s); }
  return s;
};

export const newId = (prefix) => `${prefix}_${crypto.randomBytes(7).toString('base64url')}`;
export const nowIso = () => new Date().toISOString();

export const kv = {
  get(key, fallback = null) {
    const row = prepared('SELECT value FROM kv WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : fallback;
  },
  set(key, value) {
    prepared('INSERT INTO kv(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, JSON.stringify(value));
    return value;
  },
};

let depth = 0;
/** Run fn atomically. Nested calls join the outer transaction. */
export function transaction(fn) {
  if (depth > 0) return fn();
  depth += 1;
  sql.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    sql.exec('COMMIT');
    return result;
  } catch (err) {
    sql.exec('ROLLBACK');
    throw err;
  } finally {
    depth -= 1;
  }
}

/**
 * A table of JSON documents.
 * @param {string} name table name
 * @param {Record<string,string>} indexed document fields exposed as indexed columns, e.g. { status: 'TEXT' }
 */
export function collection(name, indexed = {}) {
  sql.exec(`CREATE TABLE IF NOT EXISTS ${name} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
  const existing = new Set(sql.prepare(`PRAGMA table_xinfo(${name})`).all().map((c) => c.name));
  for (const [col, type] of Object.entries(indexed)) {
    if (!existing.has(col)) {
      sql.exec(`ALTER TABLE ${name} ADD COLUMN ${col} ${type} GENERATED ALWAYS AS (json_extract(data, '$.${col}')) VIRTUAL`);
    }
    sql.exec(`CREATE INDEX IF NOT EXISTS ${name}_${col} ON ${name}(${col})`);
  }
  const parse = (row) => (row ? JSON.parse(row.data) : null);

  return {
    get: (id) => parse(prepared(`SELECT data FROM ${name} WHERE id = ?`).get(id)),
    insert(doc) {
      prepared(`INSERT INTO ${name}(id, data) VALUES (?, ?)`).run(doc.id, JSON.stringify(doc));
      return doc;
    },
    put(doc) {
      prepared(`INSERT INTO ${name}(id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`)
        .run(doc.id, JSON.stringify(doc));
      return doc;
    },
    /** Apply a patch object, or a function that mutates/returns the document. */
    update(id, patch) {
      const doc = this.get(id);
      if (!doc) return null;
      const next = typeof patch === 'function' ? (patch(doc) ?? doc) : Object.assign(doc, patch);
      prepared(`UPDATE ${name} SET data = ? WHERE id = ?`).run(JSON.stringify(next), id);
      return next;
    },
    remove: (id) => prepared(`DELETE FROM ${name} WHERE id = ?`).run(id).changes > 0,
    find(where = '1=1', params = [], { order, limit, offset } = {}) {
      let q = `SELECT data FROM ${name} WHERE ${where}`;
      if (order) q += ` ORDER BY ${order}`;
      if (limit) q += ` LIMIT ${Number(limit)}`;
      if (offset) q += ` OFFSET ${Number(offset)}`;
      return prepared(q).all(...params).map(parse);
    },
    findOne(where, params = [], opts = {}) {
      return this.find(where, params, { ...opts, limit: 1 })[0] || null;
    },
    count: (where = '1=1', params = []) => prepared(`SELECT COUNT(*) AS n FROM ${name} WHERE ${where}`).get(...params).n,
    all: (order) => prepared(`SELECT data FROM ${name}${order ? ` ORDER BY ${order}` : ''}`).all().map(parse),
  };
}

export const db = {
  users: collection('users', { role: 'TEXT', phone: 'TEXT' }),
  sessions: collection('sessions', { userId: 'TEXT', expiresAt: 'TEXT' }),
  addresses: collection('addresses', { userId: 'TEXT' }),
  categories: collection('categories', { sort: 'INTEGER' }),
  menu: collection('menu', { categoryId: 'TEXT', sort: 'INTEGER' }),
  orders: collection('orders', {
    number: 'INTEGER', status: 'TEXT', day: 'TEXT', customerId: 'TEXT', riderId: 'TEXT', createdAt: 'TEXT', phone: 'TEXT',
  }),
  coupons: collection('coupons', { active: 'INTEGER' }),
  settlements: collection('settlements', { riderId: 'TEXT', createdAt: 'TEXT' }),
  activity: collection('activity', { at: 'TEXT' }),
};

/** Next sequential order number (human friendly, e.g. #1042). */
export function nextOrderNumber() {
  const n = kv.get('counter:order', 1000) + 1;
  kv.set('counter:order', n);
  return n;
}
