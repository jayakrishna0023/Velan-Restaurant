# Velan Biryani Center · வேலன் பிரியாணி சென்டர்

Online ordering, restaurant management and live delivery tracking for **Velan Biryani Center**,
Nerur Bridge Road, Uniyur (near Nerur), Karur District, Tamil Nadu —
நெரூர் பாலம் சாலை, உன்னியூர், நெரூர் அருகில், கரூர் மாவட்டம்.

Version 2 is a full rebuild: three separate apps on one real-time API, a restrained premium design,
slow and subtle motion, and every screen in **English and தமிழ்** (each title also shows the other script).

| App | URL (production) | For | Dev server |
|---|---|---|---|
| **Customer website** | `/` | Customers | http://localhost:5173 |
| **Admin console** | `/admin` | Owner, counter and kitchen staff | http://localhost:5174/admin/ |
| **Delivery app** | `/delivery` | The restaurant's delivery partners (installable on the phone) | http://localhost:5175/delivery/ |
| **API + live updates** | `/api`, Socket.IO | All three apps | http://localhost:4000 |

---

## Quick start

Requires **Node.js 22.13 or newer** (it uses Node's built-in SQLite; tested on Node 24).

```bash
npm install
```

```bash
npm run dev
```

`npm run dev` starts the API and all three apps together (with hot reload). Open the URLs in the table above.

### Starting logins (local demo data)

| Role | Mobile | Password |
|---|---|---|
| Admin | `9000000000` | `admin123` |
| Delivery partners: Murugan, Karthik, Senthil | `9000000001` / `9000000002` / `9000000003` | `rider123` |
| Demo customer: Kavya Raman | `9876500011` | `demo123` |

Outside production, the first start also creates 56 demo customers and five weeks of past orders and
reviews, so the dashboard, reports, customer segments and reviews have something to show.
Customers can also create their own accounts on the website.

### Production (one port)

```bash
npm run build
```

```bash
npm start
```

The API then serves the built apps itself at `/`, `/admin` and `/delivery` on port 4000 (or `PORT`).
Set `NODE_ENV=production` and `ADMIN_PASSWORD` — see [Configuration](#configuration).

---

## Architecture

```
                ┌──────────────── apps/ (React 19 + Vite, one app per audience) ─────────────────┐
                │  customer/  website · menu · cart · checkout · live tracking · account          │
                │  admin/     dashboard · live board · kitchen · POS · menu · team · CRM · reports │
                │  delivery/  rider PWA · GPS sharing · job flow · OTP hand-over · earnings        │
                └───────────────┬─────────────────────────────────────────────┬─────────────────┘
                                │ imports                                     │ REST /api + Socket.IO
                ┌───────────────▼──────────────┐              ┌───────────────▼──────────────────┐
                │ packages/shared              │◄── imports ──│ server/ (Express 5 + Socket.IO)  │
                │  domain.js  pricing, status   │              │  http/routes.js   thin handlers  │
                │             rules, hours (IST)│              │  services/        business logic │
                │  i18n + dictionary (EN/TA)    │              │  realtime.js      rooms & pushes │
                │  design tokens & components   │              │  db/              SQLite (node:  │
                │  maps, API client, sockets    │              │                   sqlite), seed  │
                └───────────────────────────────┘              └──────────────────────────────────┘
```

- **One source of truth for business rules.** `packages/shared/src/domain.js` (delivery fee, bill and GST,
  allowed status changes, opening hours in IST) is used by the server *and* the apps, so the price a
  customer sees is computed exactly like the price the server charges. The server always re-prices orders.
- **Services announce, the real-time layer delivers.** Services emit on an internal event bus;
  `realtime.js` forwards each change only to the people who should see it (admin room, the customer, the
  assigned rider). Customers see a rider's GPS only while their own order is on the way; riders never see the OTP.
- **SQLite with JSON documents.** Each collection is a table of JSON documents with indexed generated
  columns for the fields we filter on, so the data model can grow without migrations. Writes are transactional.
- **Error codes, not strings.** The API returns `{ error, code, params }`; each app shows the message for
  the code in the visitor's language.

---

## Design: Tamil street poster (all three apps)

The website, the admin console and the rider app all look like a Tamil Nadu shop board or cinema poster. They are
loud, warm and quick to use. References: Crav Burgers (Awwwards Site of the Day, Jun 2026) for the bold two-colour
ordering style, and Fly By Jing for "undesigned" packaging energy.

- **Where the styles live**: tokens, buttons, the sign, tickers and the restyled shared components are in
  `packages/shared/src/styles/poster-kit.css`. Each app's own `styles/poster.css` loads after it.

- **Palette**: chilli red `#d62b1e`, turmeric `#f5b323`, cream paper and near-black ink, with a leaf green for timing.
  Thick dark outlines and hard offset shadows instead of soft ones. The dark theme swaps cream for a charred brown.
- **Type**: Anek Latin and Anek Tamil (a matched Latin and Tamil family, used condensed and heavy) for signboard
  headlines, Manrope and Noto Sans Tamil for reading text, and IBM Plex Mono for the bill.
- **Pieces** (`packages/shared/src/components/Poster.jsx`):
  - **Shop sign:** வேலன் painted on a red board, which is the website's logo.
  - **Tickers:** scrolling bands of today's facts and dishes.
  - **Starburst price flashes.**
  - **Stickers:** they slap on with a bounce.
- **First visit**: the shop's rolling shutter, with the sign painted on it, rattles and rolls up (about one second).
- **Hero**: "சூடான தம் பிரியாணி! / DUM BIRYANI" in huge type, with a steaming plate of biryani stuck on a red sun.
  Around it sit a "from ₹90" burst, rating and delivery-time stickers, and today's special with an ADD button.
  Next to it are an Order now button and instant dish search (English or Tamil, add straight from the results).
- **Menu**: it opens with "Most ordered", then every section. Each dish is a sticker card with a photo, "Bestseller"
  tape, big name, Tamil name, price and a chunky ADD that turns into a − / + counter. Cards tilt when you point at them.
- **Parcel bill** (`Receipt.jsx`): on wide screens a thermal receipt sits beside the menu.
  - It prints a line for each dish you add, and reprints the line when the count changes.
  - Underneath are the total, the free-delivery nudge, tap-to-apply coupons and Place order.
  - On phones a floating order bar does the same job.
- **Further down**: the kitchen's story, a red "method" section, reviews on a turmeric band, the visit section, and a
  red footer with a giant வேலன்.
- **Steam**: `Steam.jsx` draws soft canvas steam over the hero plate and over hot dishes in the dish view.
- **Accessibility**: tickers pause on hover, and everything respects reduced motion. Keyboard focus is always visible,
  and a "Skip to the menu" link comes first.
- **The emblem** (`packages/shared/src/components/Brand.jsx`): `VelMark`, the compact Vel, sits inside the sign.
- **Admin console**:
  - Charcoal sidebar with the red sign; the active page is a red tab.
  - Condensed poster headings; outlined cards with hard shadows.
  - Turmeric segmented switches; charts in chilli, turmeric, leaf and indigo.
  - Light and dark themes.
- **Rider app**:
  - Dark by default, with the commercial yellow number plate.
  - Big outlined controls that read in sunlight; a green "online" board.
  - Takeovers: red for a new job, green for a delivered one.
  - The amount to collect is printed on turmeric.

Photographs are free Unsplash images (`apps/customer/src/images.js`).

---

## What each app does

### Customer website
- Street-poster home page (see Design): instant dish search, delivery time, free-delivery threshold and rating, "Most ordered" first, sticker dish cards, a parcel bill that prints as you add, tap-to-apply coupons, then the kitchen's story and method.
- **Menu**: sticky category bar with scroll-spy, search in English or Tamil, veg-only switch, bestseller / chef's special / new badges, spice level, "N plates this month", live stock ("only 3 left", "sold out"), ADD that morphs into a stepper and flies the photo into the cart, dish detail with "goes well with" suggestions, one-tap "order again".
- **Cart**: delivery/pickup switch, free-delivery progress bar, "complete your meal" add-ons, cooking notes, coupons, server-priced bill.
- **Checkout address** (`AddressForm.jsx`, shared `LocationPicker`). Four ways to set the location:
  - **GPS**: watches several fixes and keeps the most accurate one, with an accuracy ring and a "±12 m" chip.
  - **Drag the pin**.
  - **Search**.
  - **Paste** a Google Maps / WhatsApp location link or plain coordinates.
    Short `maps.app.goo.gl` links are expanded by the server, which only follows Google map hosts.
- **Address details**: street, area and pincode fill themselves from the map, and the door number is required.
  A banner says how much the pin can be trusted. Saved addresses can be edited in place.
  Distance and the "we deliver here" check are live. Cash or UPI on delivery.
- **"Is this your delivery location?"** After GPS finds the customer, a card over the map shows the address it found
  and how exact the fix is, with "Yes, deliver here" / "No, move the pin".
  - If the fix is rough it suggests moving the pin first.
  - A delivery can only be placed once the pin is confirmed, and moving the pin asks again.
  - The order stores `confirmed: true`, and the rider and the restaurant see "customer confirmed this pin".
- **Live tracking**:
  - Animated stage art (pot on the fire, rider on the road, delivered tick) and a kitchen countdown.
  - The rider's live position glides along the road route; positions within 40 m of the road are drawn on it.
  - The ETA is worked out from the road still left.
  - A freshness line: "Live GPS · updated 5 s ago · ±10 m", "set by hand", or "last seen 2 min ago".
  - **Google Maps** tab: Google's own route and traffic from the rider to the door, embedded without an API key.
    It reloads only after the rider has moved 150 m.
  - "Open in Google Maps" button; rider name, vehicle and call button.
  - **"Your rider is at your door"** notice with the OTP; the delivery OTP itself.
  - Cancel while pending, a soft chime on delivery, rating with tags, reorder.
- Account (orders, addresses, settings), "do we deliver to you?" checker, smooth scrolling, offline banner, browser notifications, story, reviews and visit sections with the delivery zone on the map.
- **Footer credit**: "Developed by CypherXpert"; hovering (or tapping) the name shows a sticker with "Jayakrishna".
  This is on the website only.
- **Scrolling**: smooth scroll (Lenis) without fights.
  - The header hides after 50 px of scrolling down and returns after 50 px up, so it no longer flickers when a glide slows.
  - The category bar scrolls only sideways.
  - Page changes jump to the top through Lenis.
  - Reveals start just before content reaches the screen, so a fast scroll never lands on a blank section.

### Admin console
- **Shell**: charcoal sidebar with live badges, Open/Paused switch, connection dot, sound toggle, activity feed, light/dark/auto theme, EN/தமிழ், and a **Ctrl/⌘ K command palette** (go anywhere, find an order, pause the store, reset stock). Works on tablets and phones.
- **New-order alarm**: rings every 12 s while an online order waits. It also:
  - shows a browser notification and flashes the tab title;
  - puts a **turmeric count badge on the tab icon**.
- **Screen stays on** while the console is open (tablet at the counter), using the Screen Wake Lock API.
  The wake lock is taken again whenever the tab comes back to the front.
- **Live map**: each rider shows "live GPS ±m", "set by hand" or "last seen", with a Google Maps button.
- **Dashboard**: today / 7 / 30 / 90 days; KPI cards with change vs the previous period and sparklines; revenue curve vs the previous period; busy-hours heatmap; sales by category; top dishes; payment, channel and type splits; "right now" panel; low stock with one-tap refill; latest reviews; live activity.
- **Live board** (New → In kitchen → Ready → On the way): drag cards between columns, kitchen-time chips, accept/reject with reasons, ready-by countdowns that turn red, rider assignment or **auto-assign**, and an order drawer with map and route, call/WhatsApp, OTP, timeline, mark paid, cancel and **58 mm bill printing**.
- **Kitchen display**: full-screen tickets with big quantities, Tamil names, a "to cook" total and bump buttons.
- **New order (counter / phone)**:
  - Fast dish grid; takeaway or delivery; cash/UPI, paid, coupon, kitchen time.
  - Delivery address: door, street, landmark, and the same location picker with the delivery zone drawn.
    Paste the customer's WhatsApp location link to place the pin exactly.
- **Live map** of riders and deliveries · **Order history** with filters and CSV.
- **Menu & stock**:
  - Inline prices, stock steppers, show/hide, badges, reset today's stock.
  - **Add** a dish anywhere ("Add dish here" per section) or **duplicate** one.
  - **Drag** dishes into order.
  - **Delete** one or many, with an **Undo** toast.
  - Bulk show/hide, sold out and **move to another section**.
  - **Export / import CSV** for editing the whole menu in a spreadsheet.
  - Sections: add, rename, reorder, and **"move dishes & delete"**.
  - Bilingual dish editor with photo upload (resized in the browser).
- **Delivery team**: rider cards (free/busy/offline, today's numbers, rating, cash in hand), add/edit/disable, **cash ledger and settlement**.
- **Customers**: VIP / regular / new / at-risk / occasional segments, lifetime value, favourite dishes, and a WhatsApp win-back offer for at-risk customers.
- **Offers** (percent, flat, free delivery, limits, expiry) · **Reviews** (reply, feature on the website) · **Reports** (ranges, totals, daily and dish-wise tables, CSV, print).
- **Settings**: restaurant texts in both languages and contacts, hours, delivery pricing and rider pay, draggable restaurant pin with radius, website announcement, password.

### Delivery app
- Installable app (dark by default) that is also a **full website**:
  - Phone: bottom tabs.
  - Tablet: full width with centred content.
  - Laptop: a left rail with the sign, a two-column dashboard, jobs as a card grid, and job details in a side panel.
  - Sign-in: the welcome sits beside the form.
- **Screen stays on** the whole time the app is open, shown in Profile.
  - On https or localhost it uses the Screen Wake Lock API.
  - On plain http (a phone on the shop Wi-Fi) it plays a tiny silent looping video, which phones also treat as "keep awake".
  - A website cannot raise the brightness; it can only stop the screen from dimming and locking.
- **Accurate live location**:
  - The phone's GPS goes through a constant-velocity Kalman filter (`createTrackFilter` in `packages/shared/src/geo.js`).
  - It drops multipath "teleports" and fixes far worse than recent ones.
  - It smooths jitter without trailing behind a moving bike, and works out heading and speed when the phone doesn't give them.
  - On a delivery the position is shared every 2.5 s or 8 m (otherwise every 5 s or 25 m), with a 15 s heartbeat.
- **Set location by hand** when GPS is off, blocked, still searching or rough (over ±100 m).
  - Type latitude and longitude, paste a Google Maps link, search, or drag the map.
  - The hand-set point is kept until GPS is sharp (±50 m) or 10 minutes pass.
- **Navigate** opens Google Maps turn-by-turn straight away from the phone's own position.
- Full-screen new-order alert with sound and vibration.
- Job flow:
  1. Kitchen countdown and items checklist.
  2. **Slide to pick up**.
  3. Road route with ETA and a live **"metres to the door"** readout.
  4. The door number in big type, with pincode and landmark, and **how far to trust the pin**: customer confirmed it,
     customer GPS ±m, pinned by hand, or typed only. Copy address; Call, **WhatsApp** and Navigate buttons.
  5. **"I've arrived"** (it pulses when you are close), which tells the customer.
  6. Amount to collect (cash or UPI link).
  7. **4-digit OTP** hand-over with celebration and earnings.
- Earnings (today, week, 7-day chart, cash in hand, settlements), profile, language and theme.
- **Demo drive** (on localhost or with `?demo`): moves the rider along the real route so you can watch the customer's tracker from a desk.

---

## First-time setup for the restaurant

In **Admin → Settings**:
1. **Contact**: the phone number, WhatsApp, UPI ID, FSSAI and GSTIN are empty — fill them in (they appear on the website, bills and the rider app).
2. **Location**: drag the restaurant pin to the exact shop entrance. All distances and fees are measured from it.
3. **Texts** in both languages, **hours**, **delivery pricing** (radius, base fee, per km, free-delivery limit, minimum order, packing, GST %).
4. **Delivery team**: remove the demo riders and add your real riders.
5. **Admin password**: change it.

In **Admin → Menu**: check prices and daily quantities, and **upload real photos**. The starting photos are
free Unsplash placeholders, each checked to show the dish or its closest match. Kothu parotta, bread halwa and
jigarthanda have no true match on Unsplash, so replace those first.

Every morning press **Reset today's stock** (Admin → Menu) and ask riders to go online.

---

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | API port (and the apps after `npm run build`) |
| `NODE_ENV` | — | `production`: https redirect, HSTS, no demo data |
| `ADMIN_PASSWORD` | `admin123` (random and printed in production) | Admin password on first start |
| `ADMIN_PHONE` | `9000000000` | Admin login number on first start |
| `DATA_DIR` | `server/data` | Database (`velan.db`) and uploaded photos |
| `SEED_DEMO` | `true` outside production | Demo riders, customers and order history on first start |
| `VELAN_API` | `http://localhost:4000` | Where the dev servers proxy `/api` and Socket.IO |

Everything else (fees, radius, hours, texts, location, open/paused) is changed live in Admin → Settings.

**Data and backups**: everything lives in `server/data/` (`velan.db` plus `uploads/`). Copy that folder to back up.
`npm run reset` deletes it, and a fresh database is created on the next start.

**GPS needs HTTPS.** Phones share location only with `https://` sites or `localhost`. Host behind HTTPS
(Railway, Render, Fly.io, or a VPS with Caddy/Nginx) with a persistent disk for `DATA_DIR`.

**Maps** use OpenStreetMap tiles, Esri satellite imagery, OSRM road routes and Nominatim search — no API keys.
They suit one restaurant's traffic; switch providers in `packages/shared/src/map.jsx` for heavy use.

---

## Project structure

```
velan/
├── package.json              workspaces + scripts (dev, build, start, reset)
├── server/src/
│   ├── index.js              HTTP server, static apps, error handling
│   ├── config.js             env settings
│   ├── realtime.js           Socket.IO rooms and pushes
│   ├── http/                 routes.js (REST API), middleware.js (auth, rate limit, headers)
│   ├── services/             auth, settings, menu, orders, riders, coupons, analytics, activity
│   ├── db/                   database.js (SQLite collections), seed.js, images.js
│   └── lib/                  errors.js (codes), bus.js (event bus)
├── packages/shared/src/
│   ├── domain.js             pricing, status rules, opening hours (used by server and apps)
│   ├── i18n.jsx, dict.js     English/Tamil engine and shared words
│   ├── api.js, realtime.js, store.js, hooks.js, effects.js (sounds, notifications, flower shower)
│   ├── map.jsx               MapView, LocationPicker, routing and search
│   ├── components/           Icon set, Vel mark & wordmark, dialogs, toasts, controls
│   └── styles/               design tokens (light/dark), base, components, maps
└── apps/
    ├── customer/src/         pages/, components/, state/, lib/ (motion, smooth scroll), styles/
    ├── admin/src/
    └── delivery/src/
```

**Stack**: Node.js, Express 5, Socket.IO 4, SQLite (`node:sqlite`), bcryptjs · React 19, Vite 7,
Framer Motion 12, Leaflet 1.9, Lenis · Fonts: Anek Latin and Anek Tamil, Manrope, IBM Plex Mono and Noto Sans Tamil (website); Cormorant Garamond, Manrope and Noto Serif / Sans Tamil (admin, delivery).

---

## API summary

All endpoints return JSON; authenticated calls send `Authorization: Bearer <token>`.

| Area | Endpoints |
|---|---|
| Public | `GET /api/bootstrap` (settings, menu, offers, reviews, stats) · `POST /api/cart/price` |
| Auth | `POST /api/auth/register` · `POST /api/auth/login` (`role`: customer/admin/rider) · `GET /api/auth/me` · `POST /api/auth/logout` · `POST /api/auth/password` · `PUT /api/me` |
| Customer | `GET/POST /api/me/addresses` · `PUT/DELETE /api/me/addresses/:id` · `POST /api/orders` · `POST /api/orders/:id/cancel` · `POST /api/orders/:id/rate` |
| Maps | `GET /api/geo/resolve?url=` (map link or coordinates → lat/lng; Google map hosts only, rate-limited) |
| Orders (any role) | `GET /api/orders` · `GET /api/orders/:id` · `POST /api/orders/:id/status` · `POST /api/orders/:id/assign` · `POST /api/orders/:id/paid` |
| Admin | `/api/admin/overview` · `reports/sales` · `orders` (counter/phone) · `menu` (+ `bulk`, `bulk-delete`, `restore`, `reorder`, `reset-stock`) · `categories` (`DELETE …?moveTo=`) · `upload` · `riders` (+ `ledger`, `settle`) · `customers` · `coupons` · `reviews` · `activity` · `settings` |
| Rider | `GET /api/rider/me` · `POST /api/rider/online` · `POST /api/orders/:id/arrived` |

Socket.IO events: `order:update`, `order:removed`, `menu:update`, `settings:update`, `offers:update`,
`rider:update`, `rider:location`, `rider:presence`, `activity`. Riders send `rider:location`
(`{ lat, lng, accuracy, speed, heading, source }`, where `source` is `gps`, `manual` or `demo`; out-of-range coordinates are dropped).

Each app has a poster-style tab icon (`public/favicon.svg`, plus 48 px, 180 px Apple, and 192/512 px install icons) and an
install manifest. The website icon is red, the console icon ink black, and the delivery icon number-plate yellow.

---

Credits: map data © OpenStreetMap contributors · imagery © Esri · routing OSRM · geocoding Nominatim ·
placeholder photos from Unsplash (free licence).
Made for Velan Biryani Center, Uniyur 🙏
