// Restaurant data for the website (settings, menu, offers, reviews), kept live
// by Socket.IO so prices, stock and open/closed update without a reload.
import { createStore, useStore } from '@velan/shared/store.js';
import { api } from './session.js';

export const site = createStore({
  loaded: false, error: null, settings: null, categories: [], items: [], offers: [], reviews: [], stats: {},
});
export const useSite = (sel) => useStore(site, sel);

export async function loadSite() {
  try {
    const data = await api.get('/bootstrap');
    site.set({ ...data, loaded: true, error: null });
  } catch (error) {
    site.set({ error });
  }
}

export const applyMenu = ({ categories, items }) => site.set({ categories, items });
export const applySettings = (settings) => site.set({ settings });
export const applyOffers = (offers) => site.set({ offers });

/** Items visible to customers (hidden dishes removed). */
export const visibleItems = (s) => s.items.filter((i) => i.available !== false);
export const itemById = (id) => site.get().items.find((i) => i.id === id);
