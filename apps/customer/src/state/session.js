// Customer login session + API client.
import { createApi } from '@velan/shared/api.js';
import { createStore, useStore } from '@velan/shared/store.js';
import { connect } from '@velan/shared/realtime.js';

export const api = createApi('velan.customer.token');
export const session = createStore({ user: null, ready: false, authOpen: false, authMode: 'login', afterAuth: null });

export const useSession = (sel) => useStore(session, sel);

export async function restoreSession() {
  if (!api.token) { session.set({ ready: true }); connect(null); return; }
  try {
    const { user } = await api.get('/auth/me');
    session.set({ user: user.role === 'customer' ? user : null, ready: true });
  } catch {
    session.set({ user: null, ready: true });
  }
  connect(api.token);
}

function signedIn({ token, user }) {
  api.setToken(token);
  session.set({ user, authOpen: false });
  connect(token);
  const next = session.get().afterAuth;
  session.set({ afterAuth: null });
  next?.();
}

export const login = async (phone, password) => signedIn(await api.post('/auth/login', { phone, password, role: 'customer' }));
export const register = async (name, phone, password) => signedIn(await api.post('/auth/register', { name, phone, password }));

export async function logout() {
  await api.post('/auth/logout').catch(() => {});
  api.setToken(null);
  session.set({ user: null });
  connect(null);
}

/** Open the login sheet; run `then` once signed in. */
export function requireLogin(then, mode = 'login') {
  if (session.get().user) { then?.(); return; }
  session.set({ authOpen: true, authMode: mode, afterAuth: then || null });
}
