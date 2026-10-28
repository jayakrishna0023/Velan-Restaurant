-- ====================================================================
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
-- The anon key is public (it ships in the browser): it may only read the menu,
-- categories, settings and public offers. Everything else goes through the API
-- with the service-role key.
ALTER TABLE kv ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_kv" ON kv;
CREATE POLICY "service_role_kv" ON kv FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_all_kv" ON kv;
DROP POLICY IF EXISTS "anon_read_settings" ON kv;
CREATE POLICY "anon_read_settings" ON kv FOR SELECT TO anon USING (key = 'settings');
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_users" ON users;
CREATE POLICY "service_role_users" ON users FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_all_users" ON users;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_sessions" ON sessions;
CREATE POLICY "service_role_sessions" ON sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_all_sessions" ON sessions;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_addresses" ON addresses;
CREATE POLICY "service_role_addresses" ON addresses FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_all_addresses" ON addresses;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_categories" ON categories;
CREATE POLICY "service_role_categories" ON categories FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_all_categories" ON categories;
DROP POLICY IF EXISTS "anon_read_categories" ON categories;
CREATE POLICY "anon_read_categories" ON categories FOR SELECT TO anon USING (true);
ALTER TABLE menu ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_menu" ON menu;
CREATE POLICY "service_role_menu" ON menu FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_all_menu" ON menu;
DROP POLICY IF EXISTS "anon_read_menu" ON menu;
CREATE POLICY "anon_read_menu" ON menu FOR SELECT TO anon USING (true);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_orders" ON orders;
CREATE POLICY "service_role_orders" ON orders FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_all_orders" ON orders;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_coupons" ON coupons;
CREATE POLICY "service_role_coupons" ON coupons FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_all_coupons" ON coupons;
DROP POLICY IF EXISTS "anon_read_public_coupons" ON coupons;
CREATE POLICY "anon_read_public_coupons" ON coupons FOR SELECT TO anon USING (coalesce((data->>'active')::boolean, false) AND coalesce((data->>'public')::boolean, false));
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_settlements" ON settlements;
CREATE POLICY "service_role_settlements" ON settlements FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_all_settlements" ON settlements;
ALTER TABLE activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_activity" ON activity;
CREATE POLICY "service_role_activity" ON activity FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_all_activity" ON activity;

-- ====================================================================
-- SEED DATA (Pre-populates categories, menu, coupons, settings & admin)
-- ====================================================================

INSERT INTO categories (id, data) VALUES ('cat_biryani', '{"id":"cat_biryani","name":"Dum Biryani","nameTa":"தம் பிரியாணி","tagline":"Sealed handi, slow fire, seeraga samba","taglineTa":"மாவு மூடிய அண்டா, மெல்லிய தீ, சீரக சம்பா","sort":0}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO categories (id, data) VALUES ('cat_starters', '{"id":"cat_starters","name":"Starters & Fry","nameTa":"ஸ்டார்ட்டர்ஸ் & வறுவல்","tagline":"Crackling, fiery, Kongu style","taglineTa":"மொறுமொறு, காரசாரம், கொங்கு ஸ்டைல்","sort":1}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO categories (id, data) VALUES ('cat_parotta', '{"id":"cat_parotta","name":"Parotta & Kothu","nameTa":"பரோட்டா & கொத்து","tagline":"Flaky layers off the hot tawa","taglineTa":"சூடான தோசைக்கல்லில் அடுக்கு பரோட்டா","sort":2}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO categories (id, data) VALUES ('cat_rice', '{"id":"cat_rice","name":"Fried Rice & Noodles","nameTa":"ஃபிரைடு ரைஸ் & நூடுல்ஸ்","tagline":"Wok-tossed on a roaring flame","taglineTa":"பெருந்தீயில் வாணலியில் வதக்கியது","sort":3}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO categories (id, data) VALUES ('cat_sweets', '{"id":"cat_sweets","name":"Sweets & Drinks","nameTa":"இனிப்பு & பானங்கள்","tagline":"Cool down after the spice","taglineTa":"காரத்துக்குப் பின் குளிர்ச்சி","sort":4}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;

INSERT INTO menu (id, data) VALUES ('dish_Rp8Bzd4ocA', '{"id":"dish_Rp8Bzd4ocA","categoryId":"cat_biryani","name":"Chicken Dum Biryani","nameTa":"சிக்கன் தம் பிரியாணி","description":"Seeraga samba rice and tender chicken layered in a dough-sealed handi. Served with onion raita and brinjal gravy.","descTa":"சீரக சம்பா அரிசியும் மென்மையான சிக்கனும் மாவு மூடிய அண்டாவில் தம். வெங்காய ரைத்தா, கத்திரிக்காய் கிரேவியுடன்.","price":160,"mrp":null,"veg":false,"spicy":2,"bestseller":true,"chefSpecial":false,"isNew":false,"available":true,"stock":54,"dailyStock":80,"image":"https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":0,"createdAt":"2026-10-23T13:12:23.096Z","updatedAt":"2026-10-23T13:19:29.967Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_DKeBvUS7RA', '{"id":"dish_DKeBvUS7RA","categoryId":"cat_biryani","name":"Mutton Dum Biryani","nameTa":"மட்டன் தம் பிரியாணி","description":"Slow-cooked tender goat meat with whole spices — our signature. Served with raita and dalcha.","descTa":"முழு மசாலாவுடன் மெதுவாக வெந்த ஆட்டுக்கறி — எங்கள் சிறப்பு. ரைத்தா, தால்சாவுடன்.","price":260,"mrp":null,"veg":false,"spicy":2,"bestseller":true,"chefSpecial":true,"isNew":false,"available":true,"stock":16,"dailyStock":40,"image":"https://images.unsplash.com/photo-1696950169706-d4533c32f81a?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":1,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:29.994Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_HA-Kk1R69w', '{"id":"dish_HA-Kk1R69w","categoryId":"cat_biryani","name":"Nattu Kozhi Biryani","nameTa":"நாட்டுக்கோழி பிரியாணி","description":"Country chicken from local farms, pepper-forward masala and a deeper, rustic flavour.","descTa":"உள்ளூர் பண்ணை நாட்டுக்கோழி, மிளகு மணக்கும் மசாலா — ஆழமான கிராமத்து சுவை.","price":240,"mrp":null,"veg":false,"spicy":3,"bestseller":false,"chefSpecial":true,"isNew":false,"available":true,"stock":25,"dailyStock":25,"image":"https://images.unsplash.com/photo-1680359870819-22556317ce22?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":2,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.014Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_2FewTXYoZA', '{"id":"dish_2FewTXYoZA","categoryId":"cat_biryani","name":"Egg Biryani","nameTa":"முட்டை பிரியாணி","description":"Biryani rice with two masala-roasted boiled eggs.","descTa":"மசாலாவில் வறுத்த இரண்டு வேகவைத்த முட்டைகளுடன் பிரியாணி.","price":120,"mrp":null,"veg":false,"spicy":1,"bestseller":false,"chefSpecial":false,"isNew":false,"available":true,"stock":40,"dailyStock":40,"image":"https://images.unsplash.com/photo-1724331567781-223844aff732?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":3,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.035Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_Otp49eaCbg', '{"id":"dish_Otp49eaCbg","categoryId":"cat_biryani","name":"Chicken 65 Biryani","nameTa":"சிக்கன் 65 பிரியாணி","description":"Our dum biryani crowned with fiery Chicken 65 — two favourites, one plate.","descTa":"தம் பிரியாணி மேல் காரசார சிக்கன் 65 — இரண்டு விருப்பங்கள், ஒரே தட்டில்.","price":190,"mrp":null,"veg":false,"spicy":3,"bestseller":false,"chefSpecial":false,"isNew":true,"available":true,"stock":30,"dailyStock":30,"image":"https://images.unsplash.com/photo-1579112965143-9139ed2a522a?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":4,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.059Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_hFHGNe15ew', '{"id":"dish_hFHGNe15ew","categoryId":"cat_biryani","name":"Kuska","nameTa":"குஸ்கா","description":"Fragrant biryani rice without meat — light, aromatic and comforting.","descTa":"இறைச்சி இல்லாத மணமான பிரியாணி சாதம் — லேசானது, சுவையானது.","price":90,"mrp":null,"veg":true,"spicy":1,"bestseller":false,"chefSpecial":false,"isNew":false,"available":true,"stock":38,"dailyStock":40,"image":"https://images.unsplash.com/photo-1733764430476-99f24c5f3d35?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":5,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.092Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_J0f22UcK7w', '{"id":"dish_J0f22UcK7w","categoryId":"cat_starters","name":"Chicken 65","nameTa":"சிக்கன் 65","description":"Crispy, deep-red fried chicken with curry leaves and green chilli.","descTa":"கறிவேப்பிலை, பச்சை மிளகாயுடன் மொறுமொறுப்பான சிவப்பு வறுத்த சிக்கன்.","price":140,"mrp":null,"veg":false,"spicy":3,"bestseller":true,"chefSpecial":false,"isNew":false,"available":true,"stock":37,"dailyStock":50,"image":"https://images.unsplash.com/photo-1757445060056-6d6aeec73de4?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":6,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.122Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_Y9BigsvWFg', '{"id":"dish_Y9BigsvWFg","categoryId":"cat_starters","name":"Pallipalayam Chicken","nameTa":"பள்ளிபாளையம் சிக்கன்","description":"A Kongu classic: chicken roasted with coconut slivers, shallots and dry red chillies.","descTa":"கொங்கு ஸ்பெஷல்: தேங்காய்ப் பூ, சின்ன வெங்காயம், காய்ந்த மிளகாயுடன் வறுத்த சிக்கன்.","price":180,"mrp":null,"veg":false,"spicy":3,"bestseller":false,"chefSpecial":true,"isNew":false,"available":true,"stock":23,"dailyStock":25,"image":"https://images.unsplash.com/photo-1736239092878-95523f1b1d25?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":7,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.153Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_f0hWB9swpQ', '{"id":"dish_f0hWB9swpQ","categoryId":"cat_starters","name":"Pepper Chicken","nameTa":"பெப்பர் சிக்கன்","description":"Dry roast with freshly crushed black pepper and curry leaves.","descTa":"புதிதாக இடித்த கருமிளகு, கறிவேப்பிலையுடன் உலர் வறுவல்.","price":160,"mrp":null,"veg":false,"spicy":2,"bestseller":false,"chefSpecial":false,"isNew":false,"available":true,"stock":29,"dailyStock":30,"image":"https://images.unsplash.com/photo-1716551028663-eb6435eca4b4?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":8,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.184Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_TQRzd0rGcg', '{"id":"dish_TQRzd0rGcg","categoryId":"cat_starters","name":"Chilli Chicken","nameTa":"சில்லி சிக்கன்","description":"Chicken tossed with green chilli, onion and capsicum.","descTa":"பச்சை மிளகாய், வெங்காயம், குடைமிளகாயுடன் வதக்கிய சிக்கன்.","price":150,"mrp":null,"veg":false,"spicy":3,"bestseller":false,"chefSpecial":false,"isNew":false,"available":true,"stock":29,"dailyStock":30,"image":"https://images.unsplash.com/photo-1710508774177-7ac2f3492675?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":9,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.216Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_WANIZ4ZUsw', '{"id":"dish_WANIZ4ZUsw","categoryId":"cat_starters","name":"Mutton Chukka","nameTa":"மட்டன் சுக்கா","description":"Bone-in mutton dry-roasted with shallots, pepper and roasted spices.","descTa":"சின்ன வெங்காயம், மிளகு, வறுத்த மசாலாவுடன் உலர் வறுவல் ஆட்டுக்கறி.","price":240,"mrp":null,"veg":false,"spicy":3,"bestseller":true,"chefSpecial":false,"isNew":false,"available":true,"stock":19,"dailyStock":20,"image":"https://images.unsplash.com/photo-1727867168767-c67974f68508?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":10,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.247Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_TL_9LXvAjA', '{"id":"dish_TL_9LXvAjA","categoryId":"cat_starters","name":"Kaveri Fish Fry","nameTa":"காவிரி மீன் வறுவல்","description":"Fresh river fish marinated in red masala and shallow-fried crisp.","descTa":"சிவப்பு மசாலாவில் ஊறிய புதிய ஆற்று மீன், மொறுமொறுப்பாக வறுத்தது.","price":180,"mrp":null,"veg":false,"spicy":2,"bestseller":false,"chefSpecial":false,"isNew":true,"available":true,"stock":20,"dailyStock":20,"image":"https://images.unsplash.com/photo-1765265432607-cdc1060294ba?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":11,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.262Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_UohtUninow', '{"id":"dish_UohtUninow","categoryId":"cat_starters","name":"Chicken Lollipop","nameTa":"சிக்கன் லாலிபாப்","description":"Frenched chicken wings, fried crisp and tossed in a spicy glaze.","descTa":"காரமான சாஸில் புரட்டிய மொறுமொறு சிக்கன் விங்ஸ்.","price":170,"mrp":null,"veg":false,"spicy":2,"bestseller":false,"chefSpecial":false,"isNew":false,"available":true,"stock":25,"dailyStock":25,"image":"https://images.unsplash.com/photo-1696950171387-dc808171711e?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":12,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.294Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_pEFK5T74bQ', '{"id":"dish_pEFK5T74bQ","categoryId":"cat_starters","name":"Gobi 65","nameTa":"கோபி 65","description":"Crispy fried cauliflower florets with curry leaves.","descTa":"கறிவேப்பிலையுடன் மொறுமொறுப்பாக வறுத்த காலிஃப்ளவர்.","price":100,"mrp":null,"veg":true,"spicy":2,"bestseller":false,"chefSpecial":false,"isNew":false,"available":true,"stock":30,"dailyStock":30,"image":"https://images.unsplash.com/photo-1676976197084-a7b35e0d2537?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":13,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.326Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_JACRFTkb8w', '{"id":"dish_JACRFTkb8w","categoryId":"cat_parotta","name":"Parotta (2 pcs)","nameTa":"பரோட்டா (2)","description":"Soft, flaky layered parotta with hot salna.","descTa":"சூடான சால்னாவுடன் மென்மையான அடுக்கு பரோட்டா.","price":40,"mrp":null,"veg":true,"spicy":0,"bestseller":true,"chefSpecial":false,"isNew":false,"available":true,"stock":100,"dailyStock":100,"image":"https://images.unsplash.com/photo-1683533743190-89c9b19f9ea6?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":14,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.358Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_L-1CCd7DYA', '{"id":"dish_L-1CCd7DYA","categoryId":"cat_parotta","name":"Bun Parotta","nameTa":"பன் பரோட்டா","description":"Thick, fluffy Madurai-style bun parotta with salna.","descTa":"சால்னாவுடன் தடிமனான மதுரை ஸ்டைல் பன் பரோட்டா.","price":50,"mrp":null,"veg":true,"spicy":0,"bestseller":false,"chefSpecial":false,"isNew":false,"available":true,"stock":40,"dailyStock":40,"image":"https://images.unsplash.com/photo-1668357530437-72a12c660f94?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":15,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.390Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_SN4wESab7g', '{"id":"dish_SN4wESab7g","categoryId":"cat_parotta","name":"Chicken Kothu Parotta","nameTa":"சிக்கன் கொத்து பரோட்டா","description":"Shredded parotta beaten on the tawa with chicken, egg and salna.","descTa":"சிக்கன், முட்டை, சால்னாவுடன் தோசைக்கல்லில் கொத்திய பரோட்டா.","price":140,"mrp":null,"veg":false,"spicy":2,"bestseller":true,"chefSpecial":false,"isNew":false,"available":true,"stock":34,"dailyStock":40,"image":"https://images.unsplash.com/photo-1716801551616-c458ec2a9b92?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":16,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.420Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish__MY1i40bDg', '{"id":"dish__MY1i40bDg","categoryId":"cat_parotta","name":"Egg Kothu Parotta","nameTa":"முட்டை கொத்து பரோட்டா","description":"Shredded parotta tossed with egg, onion and spices.","descTa":"முட்டை, வெங்காயம், மசாலாவுடன் கொத்திய பரோட்டா.","price":110,"mrp":null,"veg":false,"spicy":2,"bestseller":false,"chefSpecial":false,"isNew":false,"available":true,"stock":40,"dailyStock":40,"image":"https://images.unsplash.com/photo-1678684277767-dfc70d6c362e?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":17,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.435Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_UoZLbcr72A', '{"id":"dish_UoZLbcr72A","categoryId":"cat_parotta","name":"Double Omelette","nameTa":"டபுள் ஆம்லெட்","description":"Two-egg omelette with onion and green chilli.","descTa":"வெங்காயம், பச்சை மிளகாயுடன் இரண்டு முட்டை ஆம்லெட்.","price":40,"mrp":null,"veg":false,"spicy":1,"bestseller":false,"chefSpecial":false,"isNew":false,"available":true,"stock":50,"dailyStock":50,"image":"https://images.unsplash.com/photo-1736239092482-e57ef9b26f15?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":18,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.465Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_1g9lc04HJg', '{"id":"dish_1g9lc04HJg","categoryId":"cat_rice","name":"Chicken Fried Rice","nameTa":"சிக்கன் ஃபிரைடு ரைஸ்","description":"Wok-tossed rice with chicken, egg and vegetables.","descTa":"சிக்கன், முட்டை, காய்கறிகளுடன் வாணலியில் வதக்கிய சாதம்.","price":130,"mrp":null,"veg":false,"spicy":1,"bestseller":false,"chefSpecial":false,"isNew":false,"available":true,"stock":40,"dailyStock":40,"image":"https://images.unsplash.com/photo-1638502182261-7be714a565ce?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":19,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.479Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_PCS67JcqTA', '{"id":"dish_PCS67JcqTA","categoryId":"cat_rice","name":"Egg Fried Rice","nameTa":"முட்டை ஃபிரைடு ரைஸ்","description":"Fried rice with scrambled egg and spring onion.","descTa":"முட்டை, வெங்காயத்தாளுடன் ஃபிரைடு ரைஸ்.","price":110,"mrp":null,"veg":false,"spicy":1,"bestseller":false,"chefSpecial":false,"isNew":false,"available":true,"stock":28,"dailyStock":30,"image":"https://images.unsplash.com/photo-1609570324378-ec0c4c9b6ba8?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":20,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.495Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_Oj5MO5YEQA', '{"id":"dish_Oj5MO5YEQA","categoryId":"cat_rice","name":"Veg Fried Rice","nameTa":"வெஜ் ஃபிரைடு ரைஸ்","description":"Fried rice with carrot, beans, cabbage and peas.","descTa":"கேரட், பீன்ஸ், முட்டைகோஸ், பட்டாணியுடன் ஃபிரைடு ரைஸ்.","price":100,"mrp":null,"veg":true,"spicy":1,"bestseller":false,"chefSpecial":false,"isNew":false,"available":true,"stock":30,"dailyStock":30,"image":"https://images.unsplash.com/photo-1664717698774-84f62382613b?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":21,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.510Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_GJkxcq5vhw', '{"id":"dish_GJkxcq5vhw","categoryId":"cat_rice","name":"Chicken Noodles","nameTa":"சிக்கன் நூடுல்ஸ்","description":"Hakka noodles with chicken and crunchy vegetables.","descTa":"சிக்கன், மொறுமொறு காய்கறிகளுடன் ஹக்கா நூடுல்ஸ்.","price":130,"mrp":null,"veg":false,"spicy":1,"bestseller":false,"chefSpecial":false,"isNew":false,"available":true,"stock":30,"dailyStock":30,"image":"https://images.unsplash.com/photo-1781332152753-1199601d73d2?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":22,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.526Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_ijrvCToq7Q', '{"id":"dish_ijrvCToq7Q","categoryId":"cat_rice","name":"Veg Noodles","nameTa":"வெஜ் நூடுல்ஸ்","description":"Noodles with crunchy vegetables and soy.","descTa":"மொறுமொறு காய்கறிகளுடன் நூடுல்ஸ்.","price":100,"mrp":null,"veg":true,"spicy":1,"bestseller":false,"chefSpecial":false,"isNew":false,"available":true,"stock":25,"dailyStock":25,"image":"https://images.unsplash.com/photo-1617622141573-2e00d8818f3f?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":23,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.542Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_jJ1Qtz18fg', '{"id":"dish_jJ1Qtz18fg","categoryId":"cat_sweets","name":"Bread Halwa","nameTa":"பிரெட் அல்வா","description":"The classic biryani-shop finish: bread slow-cooked in ghee, sugar and cashews.","descTa":"பிரியாணிக்குப் பின் கட்டாயம்: நெய், சர்க்கரை, முந்திரியுடன் மெதுவாக கிண்டிய பிரெட் அல்வா.","price":50,"mrp":null,"veg":true,"spicy":0,"bestseller":true,"chefSpecial":false,"isNew":false,"available":true,"stock":38,"dailyStock":40,"image":"https://images.unsplash.com/photo-1517244683847-7456b63c5969?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":24,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.558Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_qnvlvMPqKg', '{"id":"dish_qnvlvMPqKg","categoryId":"cat_sweets","name":"Jigarthanda","nameTa":"ஜிகர்தண்டா","description":"Madurai’s famous cooler — milk, almond gum, rose syrup and ice cream.","descTa":"மதுரையின் புகழ்பெற்ற குளிர்பானம் — பால், பாதாம் பிசின், ரோஸ் சிரப், ஐஸ்கிரீம்.","price":80,"mrp":null,"veg":true,"spicy":0,"bestseller":false,"chefSpecial":false,"isNew":true,"available":true,"stock":30,"dailyStock":30,"image":"https://images.unsplash.com/photo-1630823186728-b17c9f82a32d?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":25,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.567Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_KnK1twY53w', '{"id":"dish_KnK1twY53w","categoryId":"cat_sweets","name":"Rose Milk","nameTa":"ரோஸ் மில்க்","description":"Chilled milk with rose syrup and sabja seeds.","descTa":"ரோஸ் சிரப், சப்ஜா விதைகளுடன் குளிர்ந்த பால்.","price":45,"mrp":null,"veg":true,"spicy":0,"bestseller":false,"chefSpecial":false,"isNew":false,"available":true,"stock":40,"dailyStock":40,"image":"https://images.unsplash.com/photo-1622268348720-507f204d29b4?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":26,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.589Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_YrMDRsycKg', '{"id":"dish_YrMDRsycKg","categoryId":"cat_sweets","name":"Lime Juice","nameTa":"எலுமிச்சை ஜூஸ்","description":"Fresh lime juice — sweet or salt.","descTa":"புதிய எலுமிச்சை ஜூஸ் — இனிப்பு அல்லது உப்பு.","price":30,"mrp":null,"veg":true,"spicy":0,"bestseller":false,"chefSpecial":false,"isNew":false,"available":true,"stock":50,"dailyStock":50,"image":"https://images.unsplash.com/photo-1507281549113-040fcfef650e?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":27,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.605Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO menu (id, data) VALUES ('dish_QvDL9BPTfw', '{"id":"dish_QvDL9BPTfw","categoryId":"cat_sweets","name":"Goli Soda","nameTa":"கோலி சோடா","description":"The marble-bottle soda — paneer or lemon flavour.","descTa":"கோலி பாட்டில் சோடா — பன்னீர் அல்லது எலுமிச்சை சுவை.","price":25,"mrp":null,"veg":true,"spicy":0,"bestseller":false,"chefSpecial":false,"isNew":false,"available":true,"stock":60,"dailyStock":60,"image":"https://images.unsplash.com/photo-1694654358946-60cdcb979f22?auto=format&fit=crop&w=900&h=700&q=75","serves":1,"sort":28,"createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:19:30.620Z"}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;

INSERT INTO coupons (id, data) VALUES ('VELAN50', '{"id":"VELAN50","maxDiscount":null,"firstOrderOnly":false,"usageLimit":null,"validTo":null,"active":true,"public":true,"used":27,"titleTa":"₹399க்கு மேல் ₹50 தள்ளுபடி","createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:12:23.098Z","code":"VELAN50","title":"₹50 off on orders above ₹399","type":"flat","value":50,"minOrder":399,"perUserLimit":3}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO coupons (id, data) VALUES ('FIRST20', '{"id":"FIRST20","maxDiscount":100,"firstOrderOnly":true,"usageLimit":null,"validTo":null,"active":true,"public":true,"used":3,"titleTa":"முதல் ஆர்டருக்கு 20% தள்ளுபடி (₹100 வரை)","createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:12:23.098Z","code":"FIRST20","title":"20% off your first order (up to ₹100)","type":"percent","value":20,"minOrder":149,"perUserLimit":1}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
INSERT INTO coupons (id, data) VALUES ('FREEDEL', '{"id":"FREEDEL","maxDiscount":null,"firstOrderOnly":false,"usageLimit":null,"validTo":null,"active":true,"public":true,"used":5,"titleTa":"₹299க்கு மேல் இலவச டெலிவரி","createdAt":"2026-10-23T13:12:23.098Z","updatedAt":"2026-10-23T13:12:23.098Z","code":"FREEDEL","title":"Free delivery above ₹299","type":"freedelivery","value":0,"minOrder":299,"perUserLimit":5}') ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;

INSERT INTO kv (key, value) VALUES ('settings', '{"name":"Velan Biryani Center","nameTa":"வேலன் பிரியாணி சென்டர்","tagline":"Dum biryani, slow-cooked the Uniyur way","taglineTa":"உன்னியூர் சுவையில் தம் பிரியாணி","about":"On Nerur Bridge Road by the Kaveri, we seal every handi with dough and let the biryani finish on slow dum — seeraga samba rice, country spices ground every morning, and meat bought fresh from local farms.","aboutTa":"காவிரிக் கரையோரம், நெரூர் பாலம் சாலையில் — ஒவ்வொரு அண்டாவையும் மாவால் மூடி, மெல்லிய தம்மில் பிரியாணி தயாராகிறது. சீரக சம்பா அரிசி, தினமும் அரைக்கும் நாட்டு மசாலா, உள்ளூர் பண்ணைகளின் புதிய இறைச்சி.","address":"Nerur Bridge Road, Uniyur, near Nerur, Karur District, Tamil Nadu","addressTa":"நெரூர் பாலம் சாலை, உன்னியூர், நெரூர் அருகில், கரூர் மாவட்டம், தமிழ்நாடு","phone":"","whatsapp":"","email":"","instagram":"","upiId":"","fssai":"","gstin":"","lat":11.0018182,"lng":78.1764149,"openTime":"11:00","closeTime":"22:30","weeklyOff":null,"enforceHours":false,"isOpen":true,"acceptCash":true,"acceptUpi":true,"deliveryRadiusKm":10,"baseFee":20,"baseKm":2,"perKm":6,"freeAbove":499,"minOrder":100,"packingCharge":0,"gstPercent":0,"avgPrepMins":20,"autoAssign":false,"riderPayBase":25,"riderPayPerKm":5,"announcement":{"active":true,"text":"Sunday special: Mutton biryani with bread halwa","textTa":"ஞாயிறு ஸ்பெஷல்: மட்டன் பிரியாணி + பிரெட் அல்வா"}}') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
INSERT INTO kv (key, value) VALUES ('counter:order', '1000'::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
INSERT INTO kv (key, value) VALUES ('seeded', 'true'::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO users (id, data) VALUES ('admin_kgvAV8j5JQ', '{"id":"admin_kgvAV8j5JQ","role":"admin","name":"Velan Admin","phone":"9000000000","passwordHash":"$2b$10$VoSqG4IpJCTtAoS.APtBQesXc4nGnoMoqzmsL38Uj8s4DzuUrGAyW","active":true,"createdAt":"2026-10-23T13:12:23.098Z"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO users (id, data) VALUES ('rider_HlPDkvBTgw', '{"id":"rider_HlPDkvBTgw","role":"rider","name":"Murugan","phone":"9000000001","passwordHash":"$2b$10$stzPqifdIqCznhgRCvRM4OHwEjTNCgkJ1P0pm4KALlYj352nzXy5K","active":true,"createdAt":"2026-10-23T13:12:23.098Z","vehicle":"TN 47 AK 2231","online":false}') ON CONFLICT (id) DO NOTHING;
INSERT INTO users (id, data) VALUES ('rider_DTpvPcZ9Sw', '{"id":"rider_DTpvPcZ9Sw","role":"rider","name":"Karthik","phone":"9000000002","passwordHash":"$2b$10$PDEaT5dbmXqNxPvM/hmDD.Qpbq2yDadsmgLqUl3hKBSESxTQ9/tjO","active":true,"createdAt":"2026-10-23T13:12:23.098Z","vehicle":"TN 47 BC 0918","online":true,"onlineSince":"2026-10-27T05:10:08.802Z","location":{"lat":12.955142,"lng":77.702739,"heading":null,"speed":null,"accuracy":128,"source":"gps","at":"2026-10-27T05:16:36.401Z"}}') ON CONFLICT (id) DO NOTHING;
INSERT INTO users (id, data) VALUES ('rider_lerngIaqvw', '{"id":"rider_lerngIaqvw","role":"rider","name":"Senthil","phone":"9000000003","passwordHash":"$2b$10$yDSzYtlCkEeiv2p0TZRafOsHddWLjFCkAHax./C9JySZ2dglUp7mu","active":true,"createdAt":"2026-10-23T13:12:23.098Z","vehicle":"TN 47 AZ 5504","online":false,"onlineSince":null,"location":{"lat":11.0026522,"lng":78.1755354,"heading":300,"speed":6,"accuracy":8,"source":"gps","at":"2026-10-27T05:18:26.977Z"}}') ON CONFLICT (id) DO NOTHING;
INSERT INTO users (id, data) VALUES ('cus_wqx5WONZfA', '{"id":"cus_wqx5WONZfA","role":"customer","name":"Kavya Raman","phone":"9876500011","passwordHash":"$2b$08$3gun.F6UbD2Tw4ENK0JnyO2lwzcDToZJvUWJhNKH1z7XNMqCQEvsG","active":true,"createdAt":"2026-08-24T13:12:23.406Z"}') ON CONFLICT (id) DO NOTHING;
