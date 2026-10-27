import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db, newId, nowIso } from '../db/database.js';
import { fail } from '../lib/errors.js';
import { SESSION_DAYS } from '../config.js';
import { PHONE_RE, cleanPhone } from '@velan/shared/domain.js';

// Session tokens are random; only their SHA-256 is stored.
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('base64url');

/** The user as the apps may see it (never the password hash). */
export function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}

export function validatePhone(phone) {
  const p = cleanPhone(phone);
  if (!PHONE_RE.test(p)) fail('PHONE_INVALID');
  return p;
}

export function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 6) fail('PASSWORD_SHORT');
  return pw;
}

export function createUser({ role, name, phone, password, ...extra }) {
  const n = String(name || '').trim().slice(0, 60);
  if (!n) fail('NAME_REQUIRED');
  const p = validatePhone(phone);
  validatePassword(password);
  if (db.users.findOne('role = ? AND phone = ?', [role, p])) fail('PHONE_TAKEN', 409);
  return db.users.insert({
    id: newId(role === 'customer' ? 'cus' : role),
    role,
    name: n,
    phone: p,
    passwordHash: bcrypt.hashSync(password, 10),
    active: true,
    createdAt: nowIso(),
    ...extra,
  });
}

export function startSession(user) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  db.sessions.insert({
    id: hashToken(token),
    userId: user.id,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_DAYS * 864e5).toISOString(),
  });
  return { token, user: publicUser(user) };
}

export function register({ name, phone, password }) {
  return startSession(createUser({ role: 'customer', name, phone, password }));
}

export function login({ phone, password, role = 'customer' }) {
  const p = cleanPhone(phone);
  const user = db.users.findOne('role = ? AND phone = ?', [role, p]);
  if (!user || !bcrypt.compareSync(String(password || ''), user.passwordHash)) fail('LOGIN_FAILED', 401);
  if (!user.active) fail('ACCOUNT_DISABLED', 403);
  return startSession(user);
}

export function userForToken(token) {
  if (!token) return null;
  const s = db.sessions.get(hashToken(token));
  if (!s) return null;
  if (s.expiresAt < nowIso()) { db.sessions.remove(s.id); return null; }
  const user = db.users.get(s.userId);
  return user && user.active ? user : null;
}

export function logout(token) {
  if (token) db.sessions.remove(hashToken(token));
}

export function changePassword(user, { current, next }) {
  if (!bcrypt.compareSync(String(current || ''), user.passwordHash)) fail('WRONG_PASSWORD', 400);
  validatePassword(next);
  db.users.update(user.id, { passwordHash: bcrypt.hashSync(next, 10) });
}

export function setPassword(userId, password) {
  validatePassword(password);
  db.users.update(userId, { passwordHash: bcrypt.hashSync(password, 10) });
}

/** Drop every session of a user (after disabling an account). */
export function endSessions(userId) {
  for (const s of db.sessions.find('userId = ?', [userId])) db.sessions.remove(s.id);
}
