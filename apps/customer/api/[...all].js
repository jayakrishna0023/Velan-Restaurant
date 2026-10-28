import bcrypt from 'bcryptjs';
import {
  getSb,
  setCors,
  handleOptions,
  getUserFromReq,
  createSession,
  publicUser,
  cleanPhone,
  PHONE_RE,
  newId,
  nowIso,
  dayKey,
  randomOtp,
  computeBill,
  deliveryQuote,
  parseJson,
  hashToken,
  allowedNext,
  canSee,
  viewOrder,
  ACTIVE_STATUSES,
} from './_lib.js';

const deny = (res, status, code, error) => res.status(status).json({ code, error });
const unauthorized = (res) => deny(res, 401, 'UNAUTHORIZED', 'Not signed in');
const forbidden = (res) => deny(res, 403, 'FORBIDDEN', 'Not allowed');

export default async function handler(req, res) {
  setCors(req, res);
  if (handleOptions(req, res)) return;

  const urlObj = new URL(req.url, 'http://localhost');
  let pathname = urlObj.pathname;
  if (!pathname.startsWith('/api')) {
    pathname = `/api${pathname.startsWith('/') ? '' : '/'}${pathname}`;
  }

  const method = req.method;
  const sb = getSb();

  try {
    // ----------------------------------------------------
    // GET /api/bootstrap
    // ----------------------------------------------------
    if (method === 'GET' && pathname === '/api/bootstrap') {
      const [{ data: kv }, { data: cat }, { data: menu }, { data: coup }] = await Promise.all([
        sb.from('kv').select('*'),
        sb.from('categories').select('*').order('sort'),
        sb.from('menu').select('*').order('sort'),
        sb.from('coupons').select('*'),
      ]);

      const settings = kv?.find((r) => r.key === 'settings')?.value || {};
      const categories = (cat || []).map((r) => r.data || r);
      const items = (menu || []).map((r) => r.data || r);
      const offers = (coup || []).map((r) => r.data || r).filter((c) => c.active && c.public);

      return res.status(200).json({
        settings,
        categories,
        items,
        offers,
        reviews: [],
        stats: { orders: 120, plates: 350, happyPct: 98 },
      });
    }

    // ----------------------------------------------------
    // GET /api/settings
    // ----------------------------------------------------
    if (method === 'GET' && pathname === '/api/settings') {
      const { data: kv } = await sb.from('kv').select('*').eq('key', 'settings').maybeSingle();
      const settings = kv?.value || {};
      return res.status(200).json(settings);
    }

    // ----------------------------------------------------
    // POST /api/cart/price
    // ----------------------------------------------------
    if (method === 'POST' && pathname === '/api/cart/price') {
      const body = await parseJson(req);
      const { data: kv } = await sb.from('kv').select('*').eq('key', 'settings').maybeSingle();
      const settings = kv?.value || {};

      const { data: menuRows } = await sb.from('menu').select('*');
      const menuMap = new Map((menuRows || []).map((r) => [r.id, r.data || r]));

      const rawItems = Array.isArray(body.items) ? body.items : [];
      const lines = [];
      const issues = [];

      for (const it of rawItems) {
        const m = menuMap.get(it.id);
        if (!m || m.available === false || m.stock <= 0) {
          issues.push({ id: it.id, code: 'ITEM_UNAVAILABLE', params: { name: m?.name || 'A dish' } });
          continue;
        }
        lines.push({
          id: m.id,
          name: m.name,
          nameTa: m.nameTa,
          price: m.price,
          qty: Math.max(1, Math.min(50, Number(it.qty) || 1)),
          veg: m.veg,
          image: m.image,
          note: it.note || '',
        });
      }

      const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
      let quote = null;
      if (body.type === 'delivery' && Number.isFinite(Number(body.lat)) && Number.isFinite(Number(body.lng))) {
        quote = deliveryQuote(settings, { lat: Number(body.lat), lng: Number(body.lng) }, subtotal);
      }

      let appliedCoupon = null;
      if (body.coupon) {
        const { data: coupRow } = await sb.from('coupons').select('*').eq('id', body.coupon).maybeSingle();
        const c = coupRow?.data || coupRow;
        if (c && c.active && (!c.minOrder || subtotal >= c.minOrder)) {
          appliedCoupon = c;
        }
      }

      const deliveryFee = quote?.fee ?? (body.type === 'delivery' ? (settings.baseFee || 25) : 0);
      const bill = computeBill({ lines, settings, type: body.type, deliveryFee, coupon: appliedCoupon });

      return res.status(200).json({
        lines,
        issues,
        bill,
        quote,
        coupon: appliedCoupon ? { code: appliedCoupon.code, title: appliedCoupon.title, titleTa: appliedCoupon.titleTa, type: appliedCoupon.type } : null,
        minOrderGap: body.type === 'delivery' ? Math.max(0, (settings.minOrder || 150) - subtotal) : 0,
        freeDeliveryGap: settings.freeAbove > 0 ? Math.max(0, settings.freeAbove - subtotal) : null,
        status: { open: settings.isOpen !== false },
      });
    }

    // ----------------------------------------------------
    // POST /api/auth/login
    // ----------------------------------------------------
    if (method === 'POST' && pathname === '/api/auth/login') {
      const body = await parseJson(req);
      const phone = cleanPhone(body.phone);
      const role = body.role || 'customer';

      const { data: rows } = await sb.from('users').select('*');
      const user = (rows || []).map((r) => r.data || r).find((u) => cleanPhone(u.phone) === phone && (!role || u.role === role));

      if (!user) {
        return res.status(401).json({ code: 'LOGIN_FAILED', error: 'Invalid phone or password' });
      }

      const pw = String(body.password || '');
      const valid = !!user.passwordHash && user.active !== false && bcrypt.compareSync(pw, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ code: 'LOGIN_FAILED', error: 'Invalid phone or password' });
      }

      const session = await createSession(user);
      return res.status(200).json(session);
    }

    // ----------------------------------------------------
    // POST /api/auth/register
    // ----------------------------------------------------
    if (method === 'POST' && pathname === '/api/auth/register') {
      const body = await parseJson(req);
      const phone = cleanPhone(body.phone);
      if (!PHONE_RE.test(phone)) {
        return res.status(400).json({ code: 'PHONE_INVALID', error: 'Invalid phone number' });
      }

      const password = String(body.password || '');
      if (password.length < 6) {
        return res.status(400).json({ code: 'PASSWORD_SHORT', error: 'Password must be at least 6 characters' });
      }

      const { data: existingRows } = await sb.from('users').select('*');
      const exists = (existingRows || []).map((r) => r.data || r).some((u) => u.role === 'customer' && cleanPhone(u.phone) === phone);
      if (exists) {
        return res.status(409).json({ code: 'PHONE_TAKEN', error: 'Phone number already registered' });
      }

      const uId = newId('cus');
      const newUser = {
        id: uId,
        role: 'customer',
        name: String(body.name || '').trim().slice(0, 60) || 'Food Lover',
        phone,
        passwordHash: bcrypt.hashSync(password, 10),
        active: true,
        createdAt: nowIso(),
      };

      await sb.from('users').upsert({ id: uId, data: newUser });
      const session = await createSession(newUser);
      return res.status(201).json(session);
    }

    // ----------------------------------------------------
    // GET /api/auth/me
    // ----------------------------------------------------
    if (method === 'GET' && pathname === '/api/auth/me') {
      const user = await getUserFromReq(req);
      if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', error: 'Not signed in' });
      return res.status(200).json({ user: publicUser(user) });
    }

    // ----------------------------------------------------
    // POST /api/auth/logout
    // ----------------------------------------------------
    if (method === 'POST' && pathname === '/api/auth/logout') {
      const auth = req.headers?.authorization || '';
      if (auth.startsWith('Bearer ')) await sb.from('sessions').delete().eq('id', hashToken(auth.slice(7).trim()));
      return res.status(200).json({ ok: true });
    }

    // ----------------------------------------------------
    // GET /api/me/addresses & POST /api/me/addresses
    // ----------------------------------------------------
    if (pathname.startsWith('/api/me/addresses')) {
      const user = await getUserFromReq(req);
      if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', error: 'Not signed in' });

      if (method === 'GET') {
        const { data: rows } = await sb.from('addresses').select('*');
        const userAddresses = (rows || [])
          .map((r) => r.data || r)
          .filter((a) => a.userId === user.id)
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        return res.status(200).json(userAddresses);
      }

      if (method === 'POST') {
        const body = await parseJson(req);
        const aId = newId('adr');
        const address = {
          id: aId,
          userId: user.id,
          label: body.label || 'Home',
          line: body.line || '',
          area: body.area || '',
          landmark: body.landmark || '',
          lat: Number(body.lat) || 0,
          lng: Number(body.lng) || 0,
          createdAt: nowIso(),
        };
        await sb.from('addresses').upsert({ id: aId, data: address });
        return res.status(201).json(address);
      }

      if (method === 'DELETE') {
        const id = pathname.split('/').pop();
        const { data: aRow } = await sb.from('addresses').select('*').eq('id', id).maybeSingle();
        if (!aRow || (aRow.data || aRow).userId !== user.id) return deny(res, 404, 'NOT_FOUND', 'Address not found');
        await sb.from('addresses').delete().eq('id', id);
        return res.status(200).json({ ok: true });
      }
    }

    // ----------------------------------------------------
    // ORDERS: /api/orders
    // ----------------------------------------------------
    if (pathname === '/api/orders') {
      const user = await getUserFromReq(req);

      // GET /api/orders
      if (method === 'GET') {
        if (!user) return unauthorized(res);
        const { data: rows } = await sb.from('orders').select('*');
        let list = (rows || []).map((r) => r.data || r).filter((o) => canSee(user, o));

        // Active filter
        if (urlObj.searchParams.get('active') === 'true') {
          list = list.filter((o) => ACTIVE_STATUSES.includes(o.status));
        }

        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        const limit = Number(urlObj.searchParams.get('limit')) || 100;
        return res.status(200).json({ orders: list.slice(0, limit).map((o) => viewOrder(o, user)) });
      }

      // POST /api/orders (place order)
      if (method === 'POST') {
        const body = await parseJson(req);
        const { data: kv } = await sb.from('kv').select('*').eq('key', 'settings').maybeSingle();
        const settings = kv?.value || {};

        const { data: menuRows } = await sb.from('menu').select('*');
        const menuMap = new Map((menuRows || []).map((r) => [r.id, r.data || r]));

        if (settings.isOpen === false) return deny(res, 409, 'STORE_CLOSED', 'The restaurant is not taking orders right now');
        const type = body.type === 'pickup' ? 'pickup' : 'delivery';

        // Prices and names always come from the menu, never from the browser.
        const lines = [];
        for (const it of Array.isArray(body.items) ? body.items : []) {
          const m = menuMap.get(it.id);
          const qty = Math.max(1, Math.min(50, Math.round(Number(it.qty)) || 1));
          if (!m || m.available === false || (typeof m.stock === 'number' && m.stock < qty)) {
            return res.status(409).json({ code: 'ITEM_UNAVAILABLE', error: 'A dish is no longer available', params: { name: m?.name || 'A dish' } });
          }
          lines.push({ id: m.id, name: m.name, nameTa: m.nameTa || '', price: Number(m.price) || 0, qty, veg: m.veg, image: m.image || '', note: String(it.note || '').slice(0, 120) });
        }
        if (!lines.length) return deny(res, 400, 'CART_EMPTY', 'Your cart is empty');

        const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
        let quote = null;
        if (type === 'delivery') {
          const lat = Number(body.address?.lat);
          const lng = Number(body.address?.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || (!lat && !lng)) return deny(res, 400, 'ADDRESS_REQUIRED', 'Choose a delivery location');
          quote = deliveryQuote(settings, { lat, lng }, subtotal);
          if (!quote.deliverable) return deny(res, 409, 'OUT_OF_RANGE', 'We do not deliver to this location yet');
          if (subtotal < (settings.minOrder || 150)) return res.status(409).json({ code: 'MIN_ORDER', error: 'Order is below the minimum', params: { amount: settings.minOrder || 150 } });
        }

        let coupon = null;
        if (body.coupon) {
          const { data: coupRow } = await sb.from('coupons').select('*').eq('id', body.coupon).maybeSingle();
          const c = coupRow?.data || coupRow;
          if (c && c.active && (!c.minOrder || subtotal >= c.minOrder)) coupon = c;
        }

        const fee = type === 'delivery' ? quote.fee : 0;
        const bill = computeBill({ lines, settings, type, deliveryFee: fee, coupon });
        if (coupon) bill.couponCode = coupon.code || coupon.id;

        // Same counter the Express server uses (kv 'counter:order').
        const { data: counterRow } = await sb.from('kv').select('*').eq('key', 'counter:order').maybeSingle();
        const orderNumber = (Number(counterRow?.value) || 1000) + 1;
        await sb.from('kv').upsert({ key: 'counter:order', value: orderNumber });

        // Take the dishes out of today's stock.
        await Promise.all(lines.map((l) => {
          const m = menuMap.get(l.id);
          if (typeof m.stock !== 'number') return null;
          return sb.from('menu').upsert({ id: m.id, data: { ...m, stock: Math.max(0, m.stock - l.qty), sold: (m.sold || 0) + l.qty } });
        }));
        const oId = newId('ord');
        const now = nowIso();

        const order = {
          id: oId,
          number: orderNumber,
          source: 'online',
          type,
          status: 'placed',
          customerId: user?.id || null,
          customerName: user?.name || body.customerName || 'Customer',
          phone: cleanPhone(user?.phone || body.phone),
          items: lines,
          bill,
          payment: { method: body.paymentMethod === 'upi' ? 'upi' : 'cash', status: 'pending' },
          address: type === 'delivery' ? body.address : null,
          distanceKm: quote?.distanceKm || null,
          otp: randomOtp(),
          riderId: null,
          prepMins: null,
          readyBy: null,
          notes: String(body.notes || '').slice(0, 300),
          timeline: [{ status: 'placed', at: now, by: user?.role || 'customer' }],
          createdAt: now,
          updatedAt: now,
          day: dayKey(),
        };

        await sb.from('orders').upsert({ id: oId, data: order });
        return res.status(201).json(viewOrder(order, user));
      }
    }

    // ----------------------------------------------------
    // GET & UPDATE SINGLE ORDER: /api/orders/:id/*
    // ----------------------------------------------------
    if (pathname.startsWith('/api/orders/')) {
      const parts = pathname.slice('/api/orders/'.length).split('/');
      const orderId = parts[0];
      const action = parts[1]; // status, assign, paid, arrived, cancel, rate

      const { data: row } = await sb.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (!row) return res.status(404).json({ code: 'NOT_FOUND', error: 'Order not found' });
      const order = row.data || row;
      const user = await getUserFromReq(req);
      if (!user) return unauthorized(res);
      if (!canSee(user, order)) return deny(res, 404, 'NOT_FOUND', 'Order not found');

      if (!action) {
        // GET /api/orders/:id
        return res.status(200).json(viewOrder(order, user));
      }

      const body = await parseJson(req);
      const now = nowIso();
      const isAdmin = user.role === 'admin';
      const isOwnRider = user.role === 'rider' && order.riderId === user.id;
      const isOwnCustomer = user.role === 'customer' && canSee(user, order);

      if (action === 'status') {
        const nextStatus = body.status;
        if (user.role === 'rider' && !isOwnRider) return deny(res, 403, 'NOT_ASSIGNED', 'This order is not assigned to you');
        if (!allowedNext(order, user.role).includes(nextStatus)) return deny(res, 409, 'BAD_TRANSITION', 'That status change is not allowed');
        if (nextStatus === 'delivered' && user.role === 'rider' && String(body.otp || '').trim() !== order.otp) {
          return deny(res, 400, 'OTP_WRONG', 'Wrong OTP');
        }
        order.status = nextStatus;
        if (body.prepMins) order.prepMins = Math.max(5, Math.min(180, Math.round(Number(body.prepMins)) || 20));
        if (nextStatus === 'out_for_delivery') order.pickedAt = now;
        if (nextStatus === 'delivered') {
          order.deliveredAt = now;
          if (order.payment?.status !== 'paid') order.payment = { ...order.payment, status: 'paid', paidAt: now };
        }
        if (['rejected', 'cancelled'].includes(nextStatus)) {
          order.cancelReason = String(body.reason || '').slice(0, 200);
          order.cancelledBy = user.role;
        }
        order.timeline = order.timeline || [];
        order.timeline.push({ status: nextStatus, at: now, by: user.role, name: user.name });
        order.updatedAt = now;
      } else if (action === 'assign') {
        if (!isAdmin) return forbidden(res);
        order.riderId = body.riderId || null;
        if (body.riderId) {
          const { data: rRow } = await sb.from('users').select('*').eq('id', body.riderId).maybeSingle();
          const r = rRow?.data || rRow;
          order.riderName = r?.name || 'Delivery Partner';
          order.riderPhone = r?.phone || '';
        } else {
          order.riderName = null;
          order.riderPhone = null;
        }
        order.updatedAt = now;
      } else if (action === 'paid') {
        if (!isAdmin) return forbidden(res);
        order.payment = { ...order.payment, status: 'paid', paidAt: now };
        order.updatedAt = now;
      } else if (action === 'arrived') {
        if (!isOwnRider || order.status !== 'out_for_delivery') return forbidden(res);
        order.arrivedAt = now;
        order.updatedAt = now;
      } else if (action === 'cancel') {
        if (!isOwnCustomer || !allowedNext(order, 'customer').includes('cancelled')) return deny(res, 409, 'CANNOT_CANCEL', 'This order can no longer be cancelled');
        order.status = 'cancelled';
        order.cancelReason = String(body.reason || 'Cancelled by customer').slice(0, 200);
        order.timeline = order.timeline || [];
        order.timeline.push({ status: 'cancelled', at: now, by: 'customer' });
        order.updatedAt = now;
      } else if (action === 'rate') {
        if (!isOwnCustomer || order.status !== 'delivered') return forbidden(res);
        order.rating = { food: body.food, delivery: body.delivery, review: body.review, tags: body.tags, at: now };
        order.updatedAt = now;
      } else {
        return deny(res, 404, 'NOT_FOUND', 'Unknown action');
      }

      await sb.from('orders').upsert({ id: orderId, data: order });
      return res.status(200).json(viewOrder(order, user));
    }

    // ----------------------------------------------------
    // ADMIN ENDPOINTS
    // ----------------------------------------------------
    if (pathname.startsWith('/api/admin/')) {
      const admin = await getUserFromReq(req);
      if (!admin) return unauthorized(res);
      if (admin.role !== 'admin') return forbidden(res);
      const sub = pathname.slice('/api/admin/'.length);

      // GET /api/admin/menu
      if (sub === 'menu') {
        if (method === 'GET') {
          const [{ data: cat }, { data: menu }] = await Promise.all([
            sb.from('categories').select('*').order('sort'),
            sb.from('menu').select('*').order('sort'),
          ]);
          return res.status(200).json({
            categories: (cat || []).map((r) => r.data || r),
            items: (menu || []).map((r) => r.data || r),
          });
        }
        if (method === 'POST') {
          const body = await parseJson(req);
          const mId = newId('dish');
          const item = { id: mId, ...body, createdAt: nowIso() };
          await sb.from('menu').upsert({ id: mId, data: item });
          return res.status(201).json(item);
        }
      }

      // PUT/DELETE /api/admin/menu/:id
      if (sub.startsWith('menu/')) {
        const id = sub.slice('menu/'.length);
        if (id === 'reset-stock' && method === 'POST') {
          const { data: menuRows } = await sb.from('menu').select('*');
          for (const row of menuRows || []) {
            const it = row.data || row;
            it.stock = it.dailyStock || 50;
            await sb.from('menu').upsert({ id: it.id, data: it });
          }
          return res.status(200).json({ ok: true });
        }
        if (method === 'PUT') {
          const body = await parseJson(req);
          const { data: row } = await sb.from('menu').select('*').eq('id', id).maybeSingle();
          const item = { ...(row?.data || row), ...body, updatedAt: nowIso() };
          await sb.from('menu').upsert({ id, data: item });
          return res.status(200).json(item);
        }
        if (method === 'DELETE') {
          await sb.from('menu').delete().eq('id', id);
          return res.status(200).json({ ok: true, removed: [id] });
        }
      }

      // /api/admin/categories
      if (sub === 'categories' || sub.startsWith('categories/')) {
        if (method === 'GET') {
          const { data: rows } = await sb.from('categories').select('*').order('sort');
          return res.status(200).json((rows || []).map((r) => r.data || r));
        }
        if (method === 'POST') {
          const body = await parseJson(req);
          const cId = newId('cat');
          const cat = { id: cId, ...body, sort: 99 };
          await sb.from('categories').upsert({ id: cId, data: cat });
          return res.status(201).json(cat);
        }
      }

      // /api/admin/riders
      if (sub === 'riders' || sub.startsWith('riders/')) {
        if (method === 'GET') {
          const { data: rows } = await sb.from('users').select('*');
          const riders = (rows || []).map((r) => r.data || r).filter((u) => u.role === 'rider');
          return res.status(200).json(riders.map(publicUser));
        }
      }

      // /api/admin/overview
      if (sub.startsWith('overview')) {
        const { data: rows } = await sb.from('orders').select('*');
        const orders = (rows || []).map((r) => r.data || r);
        const revenue = orders.filter((o) => o.status === 'delivered').reduce((s, o) => s + (o.bill?.total || 0), 0);
        return res.status(200).json({
          sales: revenue,
          orders: orders.length,
          delivered: orders.filter((o) => o.status === 'delivered').length,
          active: orders.filter((o) => ['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery'].includes(o.status)).length,
          recent: orders.slice(0, 10),
        });
      }

      // /api/admin/settings
      if (sub === 'settings') {
        if (method === 'PUT') {
          const body = await parseJson(req);
          const { data: kv } = await sb.from('kv').select('*').eq('key', 'settings').maybeSingle();
          const current = kv?.value || {};
          const updated = { ...current, ...body };
          await sb.from('kv').upsert({ key: 'settings', value: updated });
          return res.status(200).json(updated);
        }
      }

      // /api/admin/coupons
      if (sub === 'coupons' || sub.startsWith('coupons/')) {
        if (method === 'GET') {
          const { data: rows } = await sb.from('coupons').select('*');
          return res.status(200).json((rows || []).map((r) => r.data || r));
        }
      }

      // /api/admin/activity
      if (sub.startsWith('activity')) {
        return res.status(200).json([]);
      }
    }

    // ----------------------------------------------------
    // RIDER ENDPOINTS: /api/rider/*
    // ----------------------------------------------------
    if (pathname.startsWith('/api/rider/')) {
      const user = await getUserFromReq(req);
      if (!user || user.role !== 'rider') return res.status(403).json({ code: 'FORBIDDEN', error: 'Rider access required' });

      if (pathname === '/api/rider/me') {
        const { data: rows } = await sb.from('orders').select('*');
        const orders = (rows || []).map((r) => r.data || r).filter((o) => o.riderId === user.id && ['out_for_delivery', 'ready', 'preparing', 'accepted'].includes(o.status));
        return res.status(200).json({ rider: publicUser(user), activeOrders: orders });
      }

      if (pathname === '/api/rider/online') {
        const body = await parseJson(req);
        user.online = !!body.online;
        await sb.from('users').upsert({ id: user.id, data: user });
        return res.status(200).json({ ok: true, online: user.online });
      }
    }

    // Fallback 404
    return res.status(404).json({ code: 'NOT_FOUND', error: `Route ${method} ${pathname} not found` });
  } catch (err) {
    console.error('API Serverless Error:', err);
    return res.status(500).json({ code: 'SERVER_ERROR', error: err.message || 'Internal server error' });
  }
}
