import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wpjkccggvbmvfgiusczf.supabase.co';
const PUBLIC_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwamtjY2dndmJtdmZnaXVzY3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNzI3NjEsImV4cCI6MjEwODY0ODc2MX0.bNIQ5rbFMWORoHtNtLoQpYsvK_V5AUYUhNIDTEyNPQQ';
// Server-side key. Must be the service-role (secret) key once the anon role is locked
// out of the tables; the public anon key only works for public reads.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || PUBLIC_ANON_KEY;
if (!process.env.SUPABASE_KEY && !process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[api] SUPABASE_SERVICE_ROLE_KEY is not set: writes to Supabase will be refused.');
}

let client = null;
export function getSb() {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  }
  return client;
}

export function setCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-role');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    setCors(req, res);
    res.status(204).end();
    return true;
  }
  return false;
}

export const hashToken = (t) => crypto.createHash('sha256').update(t).digest('base64url');
export const newId = (prefix) => `${prefix}_${crypto.randomBytes(7).toString('base64url')}`;
export const nowIso = () => new Date().toISOString();
export const randomOtp = () => String(crypto.randomInt(1000, 10000));

export function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}

// Same rules as packages/shared/src/domain.js (copied so the function bundles on its own).
export const STATUSES = ['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
export const CLOSED_STATUSES = ['delivered', 'rejected', 'cancelled'];
export const ACTIVE_STATUSES = STATUSES.slice(0, 5);

/** Which statuses an actor may move an order to from its current status. */
export function allowedNext(order, role) {
  const { status, type } = order;
  if (CLOSED_STATUSES.includes(status)) return [];
  if (role === 'customer') return status === 'placed' ? ['cancelled'] : [];
  if (role === 'rider') {
    if (type !== 'delivery') return [];
    if (['accepted', 'preparing', 'ready'].includes(status)) return ['out_for_delivery'];
    if (status === 'out_for_delivery') return ['delivered'];
    return [];
  }
  const i = STATUSES.indexOf(status);
  const forward = STATUSES.slice(i + 1).filter((s) => !(type !== 'delivery' && s === 'out_for_delivery'));
  return [...forward, ...(status === 'placed' ? ['rejected'] : []), 'cancelled'];
}

/** Whether a signed-in user may see an order. */
export function canSee(user, o) {
  if (!user || !o) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'rider') return o.riderId === user.id || (!o.riderId && o.type === 'delivery' && ['accepted', 'preparing', 'ready'].includes(o.status));
  return o.customerId === user.id || (!!user.phone && cleanPhone(o.phone) === cleanPhone(user.phone));
}

/** The order as a given viewer may see it (riders never see the OTP). */
export function viewOrder(o, user) {
  const out = { ...o };
  if (user?.role === 'rider') delete out.otp;
  if (user?.role === 'customer') { delete out.riderPay; delete out.cashSettled; }
  return out;
}

export const cleanPhone = (p) => String(p || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
export const PHONE_RE = /^[6-9]\d{9}$/;

export const IST_MS = 330 * 60000;
export const dayKey = (d = new Date()) => new Date(new Date(d).getTime() + IST_MS).toISOString().slice(0, 10);

const toRad = (d) => (d * Math.PI) / 180;
export function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const roadKm = (a, b) => Math.round(haversineKm(a, b) * 1.25 * 10) / 10;

export function deliveryQuote(settings, point, subtotal = 0) {
  const distanceKm = roadKm(settings, point);
  const deliverable = distanceKm <= (settings.deliveryRadiusKm || 15);
  let fee = (settings.baseFee || 25) + Math.max(0, Math.ceil(distanceKm - (settings.baseKm || 3))) * (settings.perKm || 8);
  const free = settings.freeAbove > 0 && subtotal >= settings.freeAbove;
  if (free) fee = 0;
  return { distanceKm, deliverable, fee: Math.round(fee), free };
}

export function computeBill({ lines, settings, type, deliveryFee = 0, coupon = null }) {
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const packing = lines.length ? (settings.packingCharge || 10) : 0;
  let fee = type === 'delivery' ? deliveryFee : 0;
  let discount = 0;
  if (coupon) {
    if (coupon.type === 'percent') discount = Math.round((subtotal * (coupon.value || 0)) / 100);
    else if (coupon.type === 'flat') discount = coupon.value || 0;
    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    discount = Math.min(discount, subtotal);
  }
  const freeDeliverySaving = coupon?.type === 'freedelivery' && type === 'delivery' ? fee : 0;
  fee -= freeDeliverySaving;
  const taxable = Math.max(0, subtotal - discount + packing);
  const tax = Math.round((taxable * (settings.gstPercent || 5)) / 100);
  const total = Math.max(0, Math.round(subtotal + packing + fee - discount + tax));
  return { subtotal, packing, deliveryFee: fee, discount, tax, total, savings: discount + freeDeliverySaving };
}

export async function getUserFromReq(req) {
  const auth = req.headers?.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;

  try {
    const sb = getSb();
    const tokenHash = hashToken(token);
    const { data: session } = await sb.from('sessions').select('*').eq('id', tokenHash).maybeSingle();
    if (!session) return null;

    const sessionData = session.data || session;
    if (sessionData.expiresAt && new Date(sessionData.expiresAt) < new Date()) {
      await sb.from('sessions').delete().eq('id', tokenHash);
      return null;
    }

    const { data: userRow } = await sb.from('users').select('*').eq('id', sessionData.userId).maybeSingle();
    if (!userRow) return null;
    const user = userRow.data || userRow;
    return user.active !== false ? user : null;
  } catch (err) {
    console.error('getUserFromReq error:', err);
    return null;
  }
}

export async function createSession(user) {
  const sb = getSb();
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const expiresAt = new Date(now + 30 * 864e5).toISOString();
  const sId = hashToken(token);
  const sData = { id: sId, userId: user.id, createdAt: new Date(now).toISOString(), expiresAt };

  await sb.from('sessions').upsert({ id: sId, data: sData });
  return { token, user: publicUser(user) };
}

export function parseJson(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}
