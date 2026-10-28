import fs from 'node:fs';
import { db, kv } from '../server/src/db/database.js';

let sql = `-- ====================================================================
-- VELAN BIRYANI CENTER - SUPABASE POSTGRESQL SCHEMA
-- Run this SQL in your Supabase Dashboard: SQL Editor -> New query -> Run
-- ====================================================================

-- 1. KEY-VALUE SETTINGS & COUNTERS
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USERS (Admin, Delivery Partners, Customers)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  role TEXT GENERATED ALWAYS AS (data->>'role') STORED,
  phone TEXT GENERATED ALWAYS AS (data->>'phone') STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE INDEX IF NOT EXISTS users_phone_idx ON users(phone);

-- 3. SESSIONS (Auth tokens)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  user_id TEXT GENERATED ALWAYS AS (data->>'userId') STORED,
  expires_at TEXT GENERATED ALWAYS AS (data->>'expiresAt') STORED
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

-- 4. ADDRESSES (Customer saved addresses)
CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  user_id TEXT GENERATED ALWAYS AS (data->>'userId') STORED
);
CREATE INDEX IF NOT EXISTS addresses_user_id_idx ON addresses(user_id);

-- 5. CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  sort INTEGER GENERATED ALWAYS AS ((data->>'sort')::integer) STORED
);
CREATE INDEX IF NOT EXISTS categories_sort_idx ON categories(sort);

-- 6. MENU DISHES
CREATE TABLE IF NOT EXISTS menu (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  category_id TEXT GENERATED ALWAYS AS (data->>'categoryId') STORED,
  sort INTEGER GENERATED ALWAYS AS ((data->>'sort')::integer) STORED
);
CREATE INDEX IF NOT EXISTS menu_category_id_idx ON menu(category_id);
CREATE INDEX IF NOT EXISTS menu_sort_idx ON menu(sort);

-- 7. ORDERS (Live & History)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  number INTEGER GENERATED ALWAYS AS ((data->>'number')::integer) STORED,
  status TEXT GENERATED ALWAYS AS (data->>'status') STORED,
  day TEXT GENERATED ALWAYS AS (data->>'day') STORED,
  customer_id TEXT GENERATED ALWAYS AS (data->>'customerId') STORED,
  rider_id TEXT GENERATED ALWAYS AS (data->>'riderId') STORED,
  created_at TEXT GENERATED ALWAYS AS (data->>'createdAt') STORED,
  phone TEXT GENERATED ALWAYS AS (data->>'phone') STORED
);
CREATE INDEX IF NOT EXISTS orders_number_idx ON orders(number);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_day_idx ON orders(day);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders(customer_id);
CREATE INDEX IF NOT EXISTS orders_rider_id_idx ON orders(rider_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at);
CREATE INDEX IF NOT EXISTS orders_phone_idx ON orders(phone);

-- 8. COUPONS
DROP TABLE IF EXISTS coupons CASCADE;
CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

-- 9. SETTLEMENTS (Rider cash/payouts)
CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  rider_id TEXT GENERATED ALWAYS AS (data->>'riderId') STORED,
  created_at TEXT GENERATED ALWAYS AS (data->>'createdAt') STORED
);
CREATE INDEX IF NOT EXISTS settlements_rider_id_idx ON settlements(rider_id);

-- 10. ACTIVITY AUDIT LOG
CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  at TEXT GENERATED ALWAYS AS (data->>'at') STORED
);
CREATE INDEX IF NOT EXISTS activity_at_idx ON activity(at);

-- ROW LEVEL SECURITY & POLICIES
`;

// The anon key is public (it ships in the browser): it may only read the menu,
// categories, settings and public offers. Everything else goes through the API
// with the service-role key.
const anonRead = {
  kv: ['anon_read_settings', "key = 'settings'"],
  categories: ['anon_read_categories', 'true'],
  menu: ['anon_read_menu', 'true'],
  coupons: ['anon_read_public_coupons', "coalesce((data->>'active')::boolean, false) AND coalesce((data->>'public')::boolean, false)"],
};

const tables = ['kv', 'users', 'sessions', 'addresses', 'categories', 'menu', 'orders', 'coupons', 'settlements', 'activity'];
for (const t of tables) {
  sql += `ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;\n`;
  sql += `DROP POLICY IF EXISTS "service_role_${t}" ON ${t};\n`;
  sql += `CREATE POLICY "service_role_${t}" ON ${t} FOR ALL TO service_role USING (true) WITH CHECK (true);\n`;
  sql += `DROP POLICY IF EXISTS "anon_all_${t}" ON ${t};\n`;
  if (anonRead[t]) sql += `DROP POLICY IF EXISTS "${anonRead[t][0]}" ON ${t};\nCREATE POLICY "${anonRead[t][0]}" ON ${t} FOR SELECT TO anon USING (${anonRead[t][1]});\n`;
}

sql += '\n-- ====================================================================\n';
sql += '-- SEED DATA (Pre-populates categories, menu, coupons, settings & admin)\n';
sql += '-- ====================================================================\n\n';

const escape = (val) => "'" + JSON.stringify(val).replace(/'/g, "''") + "'";

// Categories
const cats = db.categories.all();
for (const c of cats) {
  sql += `INSERT INTO categories (id, data) VALUES ('${c.id}', ${escape(c)}) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;\n`;
}
sql += '\n';

// Menu items
const menu = db.menu.all();
for (const m of menu) {
  sql += `INSERT INTO menu (id, data) VALUES ('${m.id}', ${escape(m)}) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;\n`;
}
sql += '\n';

// Coupons
const coupons = db.coupons.all();
for (const cp of coupons) {
  sql += `INSERT INTO coupons (id, data) VALUES ('${cp.id}', ${escape(cp)}) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;\n`;
}
sql += '\n';

// Settings & counters
const settings = kv.get('settings');
if (settings) {
  sql += `INSERT INTO kv (key, value) VALUES ('settings', ${escape(settings)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;\n`;
}
sql += `INSERT INTO kv (key, value) VALUES ('counter:order', '1000'::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;\n`;
sql += `INSERT INTO kv (key, value) VALUES ('seeded', 'true'::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;\n\n`;

// Users
const users = db.users.find("role IN ('admin', 'rider')");
for (const u of users) {
  sql += `INSERT INTO users (id, data) VALUES ('${u.id}', ${escape(u)}) ON CONFLICT (id) DO NOTHING;\n`;
}

const demoCus = db.users.findOne("phone = '9876500011'");
if (demoCus) {
  sql += `INSERT INTO users (id, data) VALUES ('${demoCus.id}', ${escape(demoCus)}) ON CONFLICT (id) DO NOTHING;\n`;
}

fs.writeFileSync('supabase_schema.sql', sql, 'utf8');
console.log('Successfully wrote supabase_schema.sql');
