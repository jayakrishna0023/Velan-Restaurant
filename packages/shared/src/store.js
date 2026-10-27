// A tiny external store (useSyncExternalStore) with optional localStorage persistence.
import { useSyncExternalStore, useRef } from 'react';

export function createStore(initial, { persist } = {}) {
  let state = initial;
  if (persist) {
    try {
      const saved = localStorage.getItem(persist);
      if (saved) state = { ...initial, ...JSON.parse(saved) };
    } catch { /* ignore */ }
  }
  const listeners = new Set();
  return {
    get: () => state,
    set(next) {
      state = typeof next === 'function' ? next(state) : { ...state, ...next };
      if (persist) { try { localStorage.setItem(persist, JSON.stringify(state)); } catch { /* ignore */ } }
      listeners.forEach((l) => l());
    },
    subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  };
}

function shallowEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && Object.is(a[k], b[k]));
}

/**
 * Read a store; pass a selector to re-render only when that slice changes.
 * Selectors may build new arrays/objects (filter, map): results are compared
 * shallowly, so an equal result keeps the previous reference.
 */
export function useStore(store, selector = (s) => s) {
  const sel = useRef(selector);
  sel.current = selector;
  const cache = useRef({ has: false, value: undefined });
  const snapshot = () => {
    const next = sel.current(store.get());
    const c = cache.current;
    if (c.has && shallowEqual(c.value, next)) return c.value;
    cache.current = { has: true, value: next };
    return next;
  };
  return useSyncExternalStore(store.subscribe, snapshot, snapshot);
}
