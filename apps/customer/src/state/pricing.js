import { useEffect, useState } from 'react';
import { api } from './session.js';
import { useCart, cartPayload } from './cart.js';
import { useSite } from './site.js';

/**
 * Server-priced bill for the current cart. Re-runs when the cart, order type,
 * delivery point or coupon changes (debounced).
 */
export function usePricing({ lat, lng } = {}) {
  const state = useCart((s) => s);
  const items = useSite((s) => s.items);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify([state.lines, state.type, state.coupon, lat, lng, items.length]);

  useEffect(() => {
    let live = true;
    if (!Object.keys(state.lines).length) { setData(null); return undefined; }
    setLoading(true);
    const id = setTimeout(() => {
      api.post('/cart/price', { items: cartPayload(state), type: state.type, coupon: state.coupon || undefined, lat, lng })
        .then((d) => { if (live) setData(d); })
        .catch(() => {})
        .finally(() => { if (live) setLoading(false); });
    }, 220);
    return () => { live = false; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading };
}
