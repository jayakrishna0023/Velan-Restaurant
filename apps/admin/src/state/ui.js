// Console preferences (persisted) and transient UI state (open drawers, palette).
import { createStore, useStore } from '@velan/shared/store.js';
import { api } from '../api.js';

export const prefs = createStore({ sound: true, collapsed: false }, { persist: 'velan.admin.prefs' });
export const usePrefs = (sel) => useStore(prefs, sel);

export const ui = createStore({ orderId: null, palette: false, activity: false, nav: false });
export const useUi = (sel) => useStore(ui, sel);
export const openOrder = (id) => ui.set({ orderId: id });

export const auth = createStore({ user: null, checked: false });
export const useAuth = (sel) => useStore(auth, sel);

export async function checkAuth() {
  if (!api.token) { auth.set({ user: null, checked: true }); return; }
  try {
    const { user } = await api.get('/auth/me');
    if (user.role !== 'admin') { api.setToken(null); auth.set({ user: null, checked: true }); return; }
    auth.set({ user, checked: true });
  } catch {
    auth.set({ user: null, checked: true });
  }
}

export async function login(phone, password) {
  const { token, user } = await api.post('/auth/login', { phone, password, role: 'admin' });
  api.setToken(token);
  auth.set({ user, checked: true });
}

export async function logout() {
  try { await api.post('/auth/logout'); } catch { /* ignore */ }
  api.setToken(null);
  auth.set({ user: null, checked: true });
}

// A 401 anywhere clears the token; show the login screen.
api.onToken((t) => { if (!t) auth.set({ user: null, checked: true }); });
