// The signed-in customer's orders, kept live from Socket.IO.
import { isActive } from '@velan/shared/domain.js';
import { createStore, useStore } from '@velan/shared/store.js';
import { api, session } from './session.js';

export const orders = createStore({ list: [], loaded: false });
export const useOrders = (sel) => useStore(orders, sel);

const SB_URL = 'https://wpjkccggvbmvfgiusczf.supabase.co/rest/v1';
const SB_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwamtjY2dndmJtdmZnaXVzY3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNzI3NjEsImV4cCI6MjEwODY0ODc2MX0.bNIQ5rbFMWORoHtNtLoQpYsvK_V5AUYUhNIDTEyNPQQ';

async function fetchOrdersFallback(user) {
  try {
    const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
    const res = await fetch(`${SB_URL}/orders?select=*&order=created_at.desc&limit=60`, { headers });
    const rows = await res.json();
    return (rows || [])
      .map((r) => r.data || r)
      .filter((o) => o.customerId === user.id || (user.phone && o.phone === user.phone));
  } catch (e) {
    console.warn('Orders fallback fetch error:', e);
    return [];
  }
}

export async function loadOrders() {
  const user = session.get().user;
  if (!user) {
    orders.set({ list: [], loaded: true });
    return;
  }
  try {
    const { orders: list } = await api.get('/orders?limit=60');
    orders.set({ list: list || [], loaded: true });
  } catch (err) {
    console.warn('api.get(/orders) failed, using direct Supabase fallback...', err);
    const fallbackList = await fetchOrdersFallback(user);
    orders.set({ list: fallbackList, loaded: true });
  }
}

/** Merge a pushed order; returns the previous version (or null if new). */
export function trackOrderUpdate(o) {
  const prev = orders.get().list.find((x) => x.id === o.id) || null;
  orders.set((s) => ({ ...s, list: prev ? s.list.map((x) => (x.id === o.id ? { ...x, ...o } : x)) : [o, ...s.list] }));
  return prev;
}

export const activeOrders = (s) => s.list.filter(isActive);

let loadedFor;
session.subscribe(() => {
  const uid = session.get().user?.id;
  if (uid !== loadedFor) {
    loadedFor = uid;
    loadOrders();
  }
});
