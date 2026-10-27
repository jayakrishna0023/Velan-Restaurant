// Location helpers shared by the server and the apps: reading coordinates out
// of pasted text or map links, getting an accurate GPS fix, and turning a
// point into address parts. No API keys needed.

const inRange = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
const point = (lat, lng) => (inRange(lat, lng) ? { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 } : null);

/**
 * Coordinates from text: "11.0018, 78.1764", "11.0018 N 78.1764 E", or a
 * Google / Apple / OpenStreetMap link (…@11.00,78.17…, ?q=…, ?ll=…, !3d…!4d…,
 * #map=zoom/lat/lng). Returns { lat, lng } or null. Short links need resolving.
 */
export function parseLocationText(input) {
  const s = decodeURIComponent(String(input || '')).trim();
  if (!s) return null;
  const pats = [
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll|sll|daddr|destination|center|mlat)=(?:loc:)?(-?\d{1,2}\.\d+)[, +]+(-?\d{1,3}\.\d+)/,
    /[?&]mlat=(-?\d{1,2}\.\d+)&mlon=(-?\d{1,3}\.\d+)/,
    /#map=\d+\/(-?\d{1,2}\.\d+)\/(-?\d{1,3}\.\d+)/,
    /\/maps\/(?:place|search|dir)\/[^/]*?(-?\d{1,2}\.\d{3,})[, +]+(-?\d{1,3}\.\d{3,})/,
    /^(-?\d{1,2}\.\d{3,})\s*°?\s*[NS]?\s*[,;\s]\s*(-?\d{1,3}\.\d{3,})\s*°?\s*[EW]?$/i,
  ];
  for (const re of pats) {
    const m = s.match(re);
    if (m) {
      const p = point(Number(m[1]), Number(m[2]));
      if (p) return p;
    }
  }
  return null;
}

/** Links we can expand on the server (short Google Maps links). */
export const isShortMapLink = (s) => /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\//i.test(String(s || '').trim());

/**
 * The best GPS fix the phone can give within `maxWait` ms. It keeps listening
 * and settles as soon as accuracy is within `goodEnough` metres, reporting each
 * improving fix through `onFix`. Rejects with { code: 'denied'|'unavailable'|'timeout'|'insecure'|'unsupported' }.
 */
export function locateBest({ maxWait = 9000, goodEnough = 25, onFix } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { reject({ code: 'unsupported' }); return; }
    if (typeof window !== 'undefined' && window.isSecureContext === false) { reject({ code: 'insecure' }); return; }
    let best = null;
    let done = false;
    const finish = (fn, v) => { if (done) return; done = true; navigator.geolocation.clearWatch(watch); clearTimeout(timer); fn(v); };
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        const fix = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) };
        if (!best || fix.accuracy <= best.accuracy) { best = fix; onFix?.(fix); }
        if (fix.accuracy <= goodEnough) finish(resolve, best);
      },
      (e) => {
        if (best) finish(resolve, best);
        else finish(reject, { code: e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable' });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxWait },
    );
    const timer = setTimeout(() => (best ? finish(resolve, best) : finish(reject, { code: 'timeout' })), maxWait);
  });
}

// ---------- live tracking ----------

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
/** Metres between two { lat, lng } points. */
export function metres(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** Compass bearing from a to b, 0–360°. */
export function bearing(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/**
 * Cleans a rider's stream of GPS fixes before it is shared:
 * - drops a fix far less accurate than the ones just before it;
 * - drops "teleports" faster than `maxSpeed` m/s (multipath bounces off buildings),
 *   but accepts the new place if the phone keeps insisting on it;
 * - smooths jitter with a constant-velocity Kalman filter (position and speed on each
 *   axis, in metres) that trusts each fix by its accuracy, so a moving rider is not
 *   drawn trailing behind and a parked one stops wobbling;
 * - works out heading and speed from movement when the phone does not give them.
 * feed({ lat, lng, accuracy, speed, heading, at }) → the cleaned point, or null when dropped.
 * `accel` is how sharply a bike in town changes speed (m/s²).
 */
export function createTrackFilter({ maxSpeed = 33, accel = 1.2 } = {}) {
  let s = null;
  let o = null;
  let last = null;
  let rejects = 0;
  // Each axis keeps [position, velocity] and its 2×2 covariance.
  const axis = (p, r) => ({ x: p, v: 0, p00: r, p01: 0, p10: 0, p11: 25 });
  const step = (a, z, r, dt) => {
    a.x += a.v * dt;
    const q = accel * accel;
    const p00 = a.p00 + dt * (a.p10 + a.p01) + dt * dt * a.p11 + q * dt ** 4 / 4;
    const p01 = a.p01 + dt * a.p11 + q * dt ** 3 / 2;
    const p10 = a.p10 + dt * a.p11 + q * dt ** 3 / 2;
    const p11 = a.p11 + q * dt * dt;
    const k0 = p00 / (p00 + r);
    const k1 = p10 / (p00 + r);
    const y = z - a.x;
    a.x += k0 * y;
    a.v += k1 * y;
    a.p00 = (1 - k0) * p00; a.p01 = (1 - k0) * p01;
    a.p10 = p10 - k1 * p00; a.p11 = p11 - k1 * p01;
  };
  return function feed(fix) {
    const acc = Math.max(3, Number(fix.accuracy) || 50);
    const at = fix.at || Date.now();
    if (s) {
      const dt = Math.max(0.5, (at - s.at) / 1000);
      const jump = metres(s, fix);
      const sd = Math.sqrt(s.ex.p00);
      const teleport = jump > acc + sd + 25 && jump / dt > maxSpeed;
      const worse = acc > 100 && sd < 35 && dt < 25;
      if ((teleport || worse) && rejects < 3) { rejects += 1; return null; }
      if (rejects >= 3 || dt > 60) s = null;
      rejects = 0;
    }
    if (!s) {
      // Metres east/north of the first fix.
      o = { lat: fix.lat, lng: fix.lng, kx: Math.cos(rad(fix.lat)) * R * Math.PI / 180, ky: R * Math.PI / 180 };
      s = { ex: axis(0, acc * acc), ny: axis(0, acc * acc), at };
    } else {
      const dt = Math.max(0.1, (at - s.at) / 1000);
      step(s.ex, (fix.lng - o.lng) * o.kx, acc * acc, dt);
      step(s.ny, (fix.lat - o.lat) * o.ky, acc * acc, dt);
      s.at = at;
    }
    s.lat = o.lat + s.ny.x / o.ky;
    s.lng = o.lng + s.ex.x / o.kx;
    const sd = Math.sqrt((s.ex.p00 + s.ny.p00) / 2);
    const pos = { lat: Math.round(s.lat * 1e6) / 1e6, lng: Math.round(s.lng * 1e6) / 1e6, accuracy: Math.round(Math.min(acc, sd)), at };
    const moved = last ? metres(last, pos) : 0;
    const dt = last ? Math.max(0.5, (at - last.at) / 1000) : 1;
    pos.speed = Number.isFinite(fix.speed) && fix.speed !== null ? fix.speed : last ? Math.round((moved / dt) * 10) / 10 : null;
    pos.heading = Number.isFinite(fix.heading) && fix.heading !== null && (pos.speed ?? 0) > 1 ? fix.heading
      : last && moved > 8 ? Math.round(bearing(last, pos)) : last?.heading ?? null;
    if (!last || moved > 8 || at - last.at > 10000) last = pos;
    return pos;
  };
}

/**
 * The closest point on a route (an array of [lat, lng]) to p, and how far along the
 * route it is. → { lat, lng, off (metres from the route), along (metres from the start), total }
 */
export function snapToRoute(p, coords) {
  if (!p || !coords || coords.length < 2) return null;
  // Flat projection around p is accurate to centimetres over a town.
  const kx = Math.cos(rad(p.lat)) * R * Math.PI / 180;
  const ky = R * Math.PI / 180;
  const xy = ([lat, lng]) => [(lng - p.lng) * kx, (lat - p.lat) * ky];
  let best = null;
  let along = 0;
  let total = 0;
  for (let i = 1; i < coords.length; i += 1) {
    const [ax, ay] = xy(coords[i - 1]);
    const [bx, by] = xy(coords[i]);
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (len * len))) : 0;
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const off = Math.hypot(cx, cy);
    if (!best || off < best.off) best = { lat: p.lat + cy / ky, lng: p.lng + cx / kx, off, along: along + t * len };
    along += len;
  }
  total = along;
  return { ...best, total };
}

/** One-line address from its parts. */
export const addressLine = (a) => [a.door, a.street, a.area].map((s) => String(s || '').trim()).filter(Boolean).join(', ');

/** How far to trust a fix, in words the customer understands. */
export const accuracyLevel = (m) => (m == null ? null : m <= 20 ? 'exact' : m <= 60 ? 'good' : m <= 200 ? 'rough' : 'poor');
