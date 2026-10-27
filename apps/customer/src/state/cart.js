// The cart lives in this browser (localStorage). Prices are always re-checked
// by the server (/api/cart/price) before showing totals or placing the order.
import { createStore, useStore } from '@velan/shared/store.js';
import { site } from './site.js';

export const cart = createStore(
  { lines: {}, type: 'delivery', coupon: '', notes: '', open: false, bump: 0 },
  { persist: 'velan.cart' },
);
export const useCart = (sel) => useStore(cart, sel);

export function setQty(id, qty) {
  cart.set((s) => {
    const lines = { ...s.lines };
    if (qty <= 0) delete lines[id];
    else lines[id] = Math.min(50, qty);
    return { ...s, lines, bump: qty > (s.lines[id] || 0) ? s.bump + 1 : s.bump };
  });
}
export const addOne = (id) => setQty(id, (cart.get().lines[id] || 0) + 1);
export const removeOne = (id) => setQty(id, (cart.get().lines[id] || 0) - 1);
export const clearCart = () => cart.set((s) => ({ ...s, lines: {}, coupon: '', notes: '' }));
export const openCart = (open = true) => cart.set({ open });

/** Lines joined with the live menu: [{ item, qty }] (unknown dishes dropped). */
export function cartLines(state = cart.get(), items = site.get().items) {
  return Object.entries(state.lines)
    .map(([id, qty]) => ({ item: items.find((i) => i.id === id), qty }))
    .filter((l) => l.item);
}
export const cartCount = (s) => Object.values(s.lines).reduce((a, b) => a + b, 0);
export const cartPayload = (s = cart.get()) => Object.entries(s.lines).map(([id, qty]) => ({ id, qty }));

/** Add a past order's items back to the cart. */
export function reorder(items) {
  cart.set((s) => {
    const lines = { ...s.lines };
    for (const it of items) lines[it.id] = Math.min(50, (lines[it.id] || 0) + it.qty);
    return { ...s, lines, bump: s.bump + 1 };
  });
}
