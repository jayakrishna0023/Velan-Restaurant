// Restaurant data for the website (settings, menu, offers, reviews), kept live
// by Socket.IO so prices, stock and open/closed update without a reload.
import { createStore, useStore } from '@velan/shared/store.js';
import { api } from './session.js';

export const site = createStore({
  loaded: false,
  error: null,
  settings: null,
  categories: [],
  items: [],
  offers: [],
  reviews: [],
  stats: {},
});
export const useSite = (sel) => useStore(site, sel);

const SB_URL = 'https://wpjkccggvbmvfgiusczf.supabase.co/rest/v1';
const SB_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwamtjY2dndmJtdmZnaXVzY3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNzI3NjEsImV4cCI6MjEwODY0ODc2MX0.bNIQ5rbFMWORoHtNtLoQpYsvK_V5AUYUhNIDTEyNPQQ';

async function fetchFromSupabaseDirect() {
  const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
  const [kvRes, catRes, menuRes, coupRes] = await Promise.all([
    fetch(`${SB_URL}/kv?key=eq.settings`, { headers }).then((r) => r.json()).catch(() => []),
    fetch(`${SB_URL}/categories?select=*&order=sort`, { headers }).then((r) => r.json()).catch(() => []),
    fetch(`${SB_URL}/menu?select=*&order=sort`, { headers }).then((r) => r.json()).catch(() => []),
    fetch(`${SB_URL}/coupons?select=*`, { headers }).then((r) => r.json()).catch(() => []),
  ]);

  const settings = kvRes?.[0]?.value || {
    name: 'Velan Biryani Center',
    nameTa: 'வேலன் பிரியாணி சென்டர்',
    isOpen: true,
    minOrder: 150,
    deliveryRadiusKm: 15,
    baseFee: 25,
    baseKm: 3,
    perKm: 8,
    packingCharge: 10,
    gstPercent: 5,
  };
  const categories = (catRes || []).map((r) => r.data || r);
  const items = (menuRes || []).map((r) => r.data || r);
  const offers = (coupRes || []).map((r) => r.data || r).filter((c) => c.active && c.public);

  return {
    settings,
    categories,
    items,
    offers,
    reviews: [],
    stats: { orders: 120, plates: 350, happyPct: 98 },
  };
}

export async function loadSite() {
  try {
    const data = await api.get('/bootstrap');
    if (data && data.items && data.items.length > 0) {
      site.set({ ...data, loaded: true, error: null });
      return;
    }
  } catch (err) {
    console.warn('API /api/bootstrap failed, falling back to direct Supabase fetch...', err);
  }

  try {
    const data = await fetchFromSupabaseDirect();
    if (data && data.items && data.items.length > 0) {
      site.set({ ...data, loaded: true, error: null });
      return;
    }
  } catch (error) {
    console.error('Direct Supabase fetch also failed:', error);
  }

  site.set({ error: new Error('Cannot reach the server') });
}

export const applyMenu = ({ categories, items }) => site.set({ categories, items });
export const applySettings = (settings) => site.set({ settings });
export const applyOffers = (offers) => site.set({ offers });

/** Items visible to customers (hidden dishes removed). */
export const visibleItems = (s) => s.items.filter((i) => i.available !== false);
export const itemById = (id) => site.get().items.find((i) => i.id === id);
