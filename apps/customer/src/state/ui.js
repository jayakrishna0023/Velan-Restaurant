import { createStore, useStore } from '@velan/shared/store.js';

/** Which dish detail / delivery checker is open, and whether the opening intro has finished. */
export const ui = createStore({ dishId: null, zoneOpen: false, introDone: false, plateInView: false });
export const useUi = (sel) => useStore(ui, sel);
export const openDish = (dishId) => ui.set({ dishId });
export const openZone = (zoneOpen = true) => ui.set({ zoneOpen });
