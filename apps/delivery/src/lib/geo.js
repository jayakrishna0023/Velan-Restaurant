import { haversineKm } from '@velan/shared/domain.js';

const toRad = (d) => (d * Math.PI) / 180;

/** Compass bearing in degrees from a to b. */
export function bearing(a, b) {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export const metersBetween = (a, b) => haversineKm(a, b) * 1000;

/**
 * Evenly spaced points along a route ([[lat,lng]…]) for the demo drive,
 * each with a heading.
 */
export function sampleRoute(coords) {
  const pts = coords.map(([lat, lng]) => ({ lat, lng }));
  if (pts.length < 2) return pts;
  const cum = [0];
  for (let i = 1; i < pts.length; i += 1) cum.push(cum[i - 1] + metersBetween(pts[i - 1], pts[i]));
  const total = cum[cum.length - 1];
  const steps = Math.min(70, Math.max(12, Math.ceil(total / 70)));
  const out = [];
  let seg = 1;
  for (let s = 0; s <= steps; s += 1) {
    const d = (total * s) / steps;
    while (seg < pts.length - 1 && cum[seg] < d) seg += 1;
    const a = pts[seg - 1];
    const b = pts[seg];
    const span = cum[seg] - cum[seg - 1] || 1;
    const f = Math.min(1, Math.max(0, (d - cum[seg - 1]) / span));
    out.push({ lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f, heading: bearing(a, b) });
  }
  return out;
}

/** Demo tools are offered on a laptop (localhost) or with ?demo in the address. */
export const demoAllowed = () => ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
  || new URLSearchParams(location.search).has('demo');
