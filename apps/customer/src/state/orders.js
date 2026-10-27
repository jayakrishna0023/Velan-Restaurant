// The signed-in customer's orders, kept live from Socket.IO.
import { isActive } from '@velan/shared/domain.js';
import { createStore, useStore } from '@velan/shared/store.js';
import { api, session } from './session.js';

export const orders = createStore({ list: [], loaded: false });
export const useOrders = (sel) => useStore(orders, sel);

export async function loadOrders() {
  if (!session.get().user) { orders.set({ list: [], loaded: true }); return; }
  try {
    const { orders: list } = await api.get('/orders?limit=60');
    orders.set({ list, loaded: true });
  } catch {
    orders.set({ loaded: true });
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
  if (uid !== loadedFor) { loadedFor = uid; loadOrders(); }
});
