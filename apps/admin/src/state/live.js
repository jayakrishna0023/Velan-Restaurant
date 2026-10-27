// Live restaurant state shared by every admin screen: settings, menu, active
// orders, riders and the activity feed. Loaded once after login and kept
// current by Socket.IO events (see LiveSync in App.jsx).
import { createStore, useStore } from '@velan/shared/store.js';
import { isActive } from '@velan/shared/domain.js';
import { api } from '../api.js';

export const live = createStore({
  loaded: false,
  settings: null,
  categories: [],
  items: [],
  active: [],
  riders: [],
  presence: {},
  activity: [],
  unread: 0,
});

/** Select a slice. Selectors must return stored values (never new arrays). */
export const useLive = (selector) => useStore(live, selector);

const byCreated = (a, b) => a.createdAt.localeCompare(b.createdAt);

export async function loadLive() {
  const [settings, menu, active, riders, activity] = await Promise.all([
    api.get('/settings'),
    api.get('/admin/menu'),
    api.get('/orders?active=true&limit=300'),
    api.get('/admin/riders'),
    api.get('/admin/activity?limit=50'),
  ]);
  live.set({
    loaded: true,
    settings,
    categories: menu.categories,
    items: menu.items,
    active: active.orders.sort(byCreated),
    riders,
    activity,
  });
}

// Screens that show closed orders (history, customers…) listen here.
const orderListeners = new Set();
export const onOrder = (fn) => { orderListeners.add(fn); return () => orderListeners.delete(fn); };

export function applyOrder(o) {
  if (!o?.id) return;
  live.set((s) => {
    const rest = s.active.filter((x) => x.id !== o.id);
    return { ...s, active: isActive(o) ? [...rest, o].sort(byCreated) : rest };
  });
  orderListeners.forEach((fn) => fn(o));
}

export function applyRider(r) {
  live.set((s) => {
    const found = s.riders.some((x) => x.id === r.id);
    return {
      ...s,
      riders: found
        ? s.riders.map((x) => (x.id === r.id ? { ...x, ...r } : x))
        : [...s.riders, { today: { deliveries: 0, km: 0, earnings: 0 }, rating: { avg: null, count: 0 }, cashInHand: 0, ...r }],
    };
  });
}

export function applyRiderLocation(p) {
  live.set((s) => ({
    ...s,
    riders: s.riders.map((x) => (x.id === p.riderId ? { ...x, location: { lat: p.lat, lng: p.lng, heading: p.heading, speed: p.speed, accuracy: p.accuracy, at: p.at } } : x)),
  }));
}

export function applyActivity(a) {
  live.set((s) => ({ ...s, activity: [a, ...s.activity].slice(0, 120), unread: s.unread + 1 }));
}

export const setMenu = (m) => live.set({ categories: m.categories, items: m.items });
export const setSettings = (settings) => live.set({ settings });
export const setPresence = (p) => live.set((s) => ({ ...s, presence: { ...s.presence, ...p } }));
