// Maps for every app: Leaflet + OpenStreetMap / Esri tiles, OSRM road routes
// and Nominatim search. No API keys needed.
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';
import { roadKm, haversineKm } from './domain.js';
import { parseLocationText, isShortMapLink, locateBest, accuracyLevel } from './geo.js';
import { useLang } from './i18n.jsx';
import { useDebounced } from './hooks.js';
import { Icon } from './components/Icon.jsx';
import { getApiBase } from './api.js';

export const TILES = {
  street: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap', maxZoom: 19 },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Imagery © Esri', maxZoom: 19 },
  labels: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', maxZoom: 19 },
};

const SVG = {
  store: '<svg width="20" height="20" viewBox="0 0 64 64"><path fill="currentColor" d="M32 6c6 7 10 13.5 9.3 19.3-.6 4.6-4.6 7.6-9.3 10-4.7-2.4-8.7-5.4-9.3-10C22 19.5 26 13 32 6Z"/><rect x="29.5" y="38" width="5" height="22" rx="2.5" fill="currentColor"/><rect x="22" y="37" width="20" height="4" rx="2" fill="currentColor"/></svg>',
  home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10Z"/><path d="M9 22V13h6v9"/></svg>',
  drop: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 7h12l1.2 12.2a2 2 0 0 1-2 2.2H6.8a2 2 0 0 1-2-2.2L6 7Z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/></svg>',
  rider: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 18h7M15.5 18 14 9h3l1.5 6.5M14 9h-2.5M3 14.5h7l1.5 3.5"/></svg>',
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function markerIcon({ kind = 'drop', label, heading }) {
  if (kind === 'rider') {
    return L.divIcon({
      className: '',
      html: `<div class="vrider">${label ? `<span class="vpin-label" style="top:-22px">${esc(label)}</span>` : ''}<div class="vrider-heading" style="transform:rotate(${heading || 0}deg);opacity:${heading == null ? 0 : 1}"></div><div class="vrider-core">${SVG.rider}</div></div>`,
      iconSize: [46, 46],
      iconAnchor: [23, 23],
    });
  }
  return L.divIcon({
    className: '',
    html: `<div class="vpin vpin-${kind}">${label ? `<span class="vpin-label">${esc(label)}</span>` : ''}<div class="vpin-body">${SVG[kind] || SVG.drop}</div></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 46],
  });
}

/** Slide a marker to its new place instead of jumping, so a live rider moves smoothly between updates. */
function glide(marker, to, ms = 1100) {
  cancelAnimationFrame(marker._glide);
  const from = marker.getLatLng();
  if (Math.abs(from.lat - to[0]) + Math.abs(from.lng - to[1]) > 0.02) { marker.setLatLng(to); return; }
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    const e = k * (2 - k);
    marker.setLatLng([from.lat + (to[0] - from.lat) * e, from.lng + (to[1] - from.lng) * e]);
    if (k < 1) marker._glide = requestAnimationFrame(step);
  };
  marker._glide = requestAnimationFrame(step);
}

function setTiles(map, kind) {
  map._velanLayers?.forEach((l) => map.removeLayer(l));
  const layers = [L.tileLayer(TILES[kind].url, { attribution: TILES[kind].attribution, maxZoom: 19 })];
  if (kind === 'satellite') layers.push(L.tileLayer(TILES.labels.url, { maxZoom: 19 }));
  layers.forEach((l) => l.addTo(map));
  map._velanLayers = layers;
  map.getContainer().classList.toggle('satellite', kind === 'satellite');
}

// ---------- routing & search ----------

const routes = new Map();
/** Road route between two points: { coords: [[lat,lng]…], km, mins, approx } */
export async function fetchRoute(from, to) {
  const key = [from.lat, from.lng, to.lat, to.lng].map((v) => Number(v).toFixed(4)).join(',');
  if (routes.has(key)) return routes.get(key);
  try {
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`);
    const j = await r.json();
    const best = j.routes?.[0];
    if (!best) throw new Error('no route');
    const out = { coords: best.geometry.coordinates.map(([lng, lat]) => [lat, lng]), km: best.distance / 1000, mins: (best.duration / 60) * 1.15 };
    routes.set(key, out);
    return out;
  } catch {
    const km = roadKm(from, to);
    return { coords: [[from.lat, from.lng], [to.lat, to.lng]], km, mins: km * 3 + 2, approx: true };
  }
}

export async function searchPlaces(q, near, lang = 'en') {
  const params = new URLSearchParams({ q, format: 'jsonv2', limit: '6', countrycodes: 'in' });
  if (near) params.set('viewbox', `${near.lng - 0.35},${near.lat + 0.35},${near.lng + 0.35},${near.lat - 0.35}`);
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'Accept-Language': lang === 'ta' ? 'ta,en' : 'en' } });
  const list = await r.json();
  return list.map((p) => ({ name: p.display_name, lat: Number(p.lat), lng: Number(p.lon) }));
}

export async function reverseGeocode(lat, lng, lang = 'en') {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&lat=${lat}&lon=${lng}`, { headers: { 'Accept-Language': lang === 'ta' ? 'ta,en' : 'en' } });
    const j = await r.json();
    return (j.display_name || '').split(',').slice(0, 3).join(',').trim();
  } catch {
    return '';
  }
}

/**
 * Google Maps directions to `to` (from `from`, or from wherever the phone is). With
 * navigate: true the Google Maps app starts turn-by-turn straight away. No API key needed.
 */
export const googleMapsUrl = (to, from, { navigate = false } = {}) => `https://www.google.com/maps/dir/?api=1${from ? `&origin=${from.lat},${from.lng}` : ''}&destination=${to.lat},${to.lng}&travelmode=driving${navigate ? '&dir_action=navigate' : ''}`;

/** Google Maps showing one point (e.g. where the rider is right now). */
export const googlePlaceUrl = (p) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;

/**
 * A Google map to embed in an iframe: the road route from `from` to `to` (with traffic and
 * Google's own ETA), or just `to` when there is no `from`. Keyless embed URL.
 */
export const googleEmbedUrl = (to, from) => (from
  ? `https://maps.google.com/maps?saddr=${from.lat},${from.lng}&daddr=${to.lat},${to.lng}&dirflg=d&output=embed`
  : `https://maps.google.com/maps?q=${to.lat},${to.lng}&z=16&output=embed`);

// ---------- React components ----------

/**
 * Map with markers and an optional road route.
 * markers: [{ id, kind: 'store'|'home'|'drop'|'rider', lat, lng, label, heading }]
 * route: [[lat,lng]…]  · fitKey: change it to re-fit the view to markers/route.
 * autoFit=false keeps the view the caller sets (e.g. in onMap); wheelZoom=false
 * leaves the mouse wheel to page scrolling.
 */
export function MapView({
  markers = [], route, center, zoom = 14, fitKey, className = '', style, controls = true, satellite = false, onMap, padding = 48,
  interactive = true, autoFit = true, wheelZoom = interactive,
}) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(new Map());
  const routeLayer = useRef(null);
  const [kind, setKind] = useState(satellite ? 'satellite' : 'street');

  useEffect(() => {
    const m = L.map(el.current, {
      zoomControl: false, attributionControl: true, scrollWheelZoom: wheelZoom, dragging: interactive, touchZoom: interactive,
      doubleClickZoom: interactive, keyboard: interactive,
    }).setView(center ? [center.lat, center.lng] : [11.0018, 78.1764], zoom);
    if (controls && interactive) L.control.zoom({ position: 'bottomright' }).addTo(m);
    m.getContainer().classList.add('map-tone');
    map.current = m;
    onMap?.(m);
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; layer.current.clear(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (map.current) setTiles(map.current, kind); }, [kind]);

  // Markers: add, move smoothly, remove.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const seen = new Set();
    for (const mk of markers) {
      if (!Number.isFinite(mk.lat) || !Number.isFinite(mk.lng)) continue;
      seen.add(mk.id);
      const existing = layer.current.get(mk.id);
      if (existing) {
        if (mk.kind === 'rider') glide(existing, [mk.lat, mk.lng]);
        else existing.setLatLng([mk.lat, mk.lng]);
        if (mk.kind === 'rider') {
          const h = existing.getElement()?.querySelector('.vrider-heading');
          if (h && mk.heading != null) { h.style.transform = `rotate(${mk.heading}deg)`; h.style.opacity = 1; }
        }
      } else {
        const marker = L.marker([mk.lat, mk.lng], { icon: markerIcon(mk), keyboard: false, zIndexOffset: mk.kind === 'rider' ? 500 : 0 }).addTo(m);
        if (mk.onClick) marker.on('click', mk.onClick);
        layer.current.set(mk.id, marker);
      }
    }
    for (const [id, marker] of layer.current) {
      if (!seen.has(id)) { m.removeLayer(marker); layer.current.delete(id); }
    }
  }, [markers]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (routeLayer.current) { m.removeLayer(routeLayer.current); routeLayer.current = null; }
    if (route?.length > 1) {
      routeLayer.current = L.layerGroup([
        L.polyline(route, { color: '#1e130e', weight: 8, opacity: 0.18, lineCap: 'round' }),
        L.polyline(route, { color: '#d62b1e', weight: 5, opacity: 0.95, lineCap: 'round' }),
        L.polyline(route, { color: '#fff', weight: 2, opacity: 0.9, className: 'route-line' }),
      ]).addTo(m);
    }
  }, [route]);

  // Fit view when asked.
  useEffect(() => {
    const m = map.current;
    if (!m || !autoFit) return;
    const pts = [...markers.filter((x) => Number.isFinite(x.lat)).map((x) => [x.lat, x.lng]), ...(route || [])];
    if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [padding, padding], maxZoom: 16, animate: true });
    else if (pts.length === 1) m.setView(pts[0], Math.max(m.getZoom(), 15), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return (
    <div className={`vmap ${className}`} style={{ position: 'relative', ...style }}>
      <div ref={el} style={{ position: 'absolute', inset: 0, borderRadius: 'inherit' }} />
      {controls && (
        <button type="button" className="vmap-layer" onClick={() => setKind(kind === 'street' ? 'satellite' : 'street')} aria-label="Map layer">
          <Icon name="layers" size={16} />
        </button>
      )}
    </div>
  );
}

const PICKER_TEXT = {
  denied: ['Location is blocked for this site. Allow it in the browser (the lock icon next to the address), or search, paste a map link or drag the map.', 'இந்தத் தளத்துக்கு இருப்பிடம் தடுக்கப்பட்டுள்ளது. உலாவியில் அனுமதியுங்கள் (முகவரிக்கு அருகிலுள்ள பூட்டு), அல்லது தேடுங்கள், வரைபட இணைப்பை ஒட்டுங்கள் அல்லது வரைபடத்தை நகர்த்துங்கள்.'],
  unavailable: ['Your phone could not find a GPS signal. Step outside or near a window and try again, or drag the map.', 'GPS சிக்னல் கிடைக்கவில்லை. வெளியே அல்லது ஜன்னல் அருகே சென்று மீண்டும் முயலுங்கள், அல்லது வரைபடத்தை நகர்த்துங்கள்.'],
  timeout: ['Finding you took too long. Try again or drag the map to your door.', 'இருப்பிடம் கண்டறிய நேரமானது. மீண்டும் முயலுங்கள் அல்லது வரைபடத்தை நகர்த்துங்கள்.'],
  insecure: ['Location needs a secure (https) connection. Search or drag the map instead.', 'இருப்பிடத்துக்கு பாதுகாப்பான (https) இணைப்பு தேவை. தேடுங்கள் அல்லது வரைபடத்தை நகர்த்துங்கள்.'],
  unsupported: ['This browser cannot share location. Search or drag the map instead.', 'இந்த உலாவி இருப்பிடம் பகிராது. தேடுங்கள் அல்லது வரைபடத்தை நகர்த்துங்கள்.'],
  link: ['Could not read that link. Open it in Google Maps, tap Share, and paste the link again.', 'அந்த இணைப்பைப் படிக்க முடியவில்லை. Google Maps-இல் திறந்து, பகிர் அழுத்தி, இணைப்பை மீண்டும் ஒட்டுங்கள்.'],
};

/** Address parts for a point (door, street, area, town, pincode) from OpenStreetMap. */
export async function reverseDetails(lat, lng, lang = 'en') {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`, { headers: { 'Accept-Language': lang === 'ta' ? 'ta,en' : 'en' } });
    const j = await r.json();
    const a = j.address || {};
    const street = a.road || a.pedestrian || a.footway || a.residential || '';
    const area = a.neighbourhood || a.suburb || a.village || a.hamlet || a.quarter || a.town || '';
    const town = a.town || a.city || a.village || a.county || '';
    return {
      door: a.house_number || '',
      street,
      area: area === town ? area : [area, town].filter(Boolean).join(', '),
      pincode: (a.postcode || '').replace(/\D/g, '').slice(0, 6),
      label: (j.display_name || '').split(',').slice(0, 3).join(',').trim(),
    };
  } catch {
    return null;
  }
}

/** Fly a map to a point and mark how it got there. */
function goTo(m, p, zoom = 18) {
  if (!m) return;
  m.flyTo([p.lat, p.lng], zoom, { duration: 1.1 });
}

/**
 * Pin-drop location picker. The customer moves the map under a fixed pin, or:
 * - "Use my location" listens to GPS for a few seconds and keeps the best fix,
 *   drawing its accuracy as a ring;
 * - the search box takes a street or landmark, typed coordinates, or a shared
 *   Google Maps link (short links are expanded by the server);
 * - `zone` ({ lat, lng, radiusKm }) draws the delivery area and the shop.
 * onChange({ lat, lng }, { label, parts, source, accuracy }) — source is
 * 'gps' | 'search' | 'link' | 'pin'.
 */
export function LocationPicker({ value, onChange, origin, zone, height = 320, autoLocate = false, target, onConfirm, children }) {
  const { t, tr, lang } = useLang();
  // After GPS finds the customer, ask "is this your location?" over the map (when onConfirm is given).
  const [ask, setAsk] = useState(false);
  const map = useRef(null);
  const ring = useRef(null);
  const zoneLayer = useRef(null);
  const [moving, setMoving] = useState(false);
  const [label, setLabel] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState('');
  const [kind, setKind] = useState('street');
  const [gps, setGps] = useState(null);
  const [problem, setProblem] = useState('');
  const debounced = useDebounced(query, 450);
  const start = value || origin || { lat: 11.0018, lng: 78.1764 };
  const cb = useRef(onChange);
  cb.current = onChange;
  const seq = useRef(0);
  const nextSource = useRef(value?.source || 'pin');
  const fix = useRef(null);

  const report = async (lat, lng) => {
    const id = ++seq.current;
    const source = nextSource.current;
    nextSource.current = 'pin';
    // A GPS fix stays trusted only while the pin sits inside its accuracy ring.
    const gpsFix = fix.current;
    const near = gpsFix && haversineKm(gpsFix, { lat, lng }) * 1000 <= Math.max(15, gpsFix.accuracy);
    const accuracy = source === 'gps' || (near && source === 'pin') ? gpsFix?.accuracy ?? null : null;
    const src = source === 'pin' && near ? 'gps' : source;
    cb.current?.({ lat, lng }, { label: '', parts: null, source: src, accuracy });
    const parts = await reverseDetails(lat, lng, lang);
    if (id !== seq.current) return;
    setLabel(parts?.label || '');
    cb.current?.({ lat, lng }, { label: parts?.label || '', parts, source: src, accuracy });
  };

  const drawRing = (f) => {
    const m = map.current;
    if (!m) return;
    if (ring.current) m.removeLayer(ring.current);
    ring.current = f ? L.layerGroup([
      L.circle([f.lat, f.lng], { radius: f.accuracy, color: '#2f6fdb', weight: 1.5, fillColor: '#2f6fdb', fillOpacity: 0.12, interactive: false }),
      L.circleMarker([f.lat, f.lng], { radius: 7, color: '#fff', weight: 3, fillColor: '#2f6fdb', fillOpacity: 1, interactive: false }),
    ]).addTo(m) : null;
  };

  const locate = async () => {
    setProblem('');
    setAsk(false);
    setBusy('gps');
    setGps({ accuracy: null });
    try {
      const best = await locateBest({
        maxWait: 10000,
        goodEnough: 20,
        onFix: (f) => {
          fix.current = f;
          setGps(f);
          drawRing(f);
          nextSource.current = 'gps';
          goTo(map.current, f, f.accuracy > 300 ? 15 : f.accuracy > 80 ? 17 : 18);
        },
      });
      fix.current = best;
      setGps(best);
      drawRing(best);
      nextSource.current = 'gps';
      goTo(map.current, best, best.accuracy > 300 ? 15 : best.accuracy > 80 ? 17 : 18);
      // Ask once the map has settled on the fix (moving the map closes the question).
      if (onConfirm) setTimeout(() => setAsk(true), 1300);
    } catch (e) {
      setGps(null);
      setProblem(tr(...(PICKER_TEXT[e?.code] || PICKER_TEXT.unavailable)));
    } finally {
      setBusy('');
    }
  };

  const onMap = (m) => {
    map.current = m;
    m.setView([start.lat, start.lng], value ? 18 : 15);
    m.on('movestart', () => setMoving(true));
    m.on('dragstart', () => setAsk(false));
    m.on('moveend', () => {
      setMoving(false);
      const c = m.getCenter();
      report(Number(c.lat.toFixed(6)), Number(c.lng.toFixed(6)));
    });
    if (value) report(value.lat, value.lng);
    if (zone && Number.isFinite(zone.lat)) {
      zoneLayer.current = L.layerGroup([
        L.circle([zone.lat, zone.lng], { radius: zone.radiusKm * 1000 / 1.25, color: '#d62b1e', weight: 2, dashArray: '6 8', fillColor: '#d62b1e', fillOpacity: 0.04, interactive: false }),
        L.marker([zone.lat, zone.lng], { icon: markerIcon({ kind: 'store' }), interactive: false, keyboard: false }),
      ]).addTo(m);
    }
    if (autoLocate && !value) locate();
  };

  useEffect(() => {
    if (map.current) setTiles(map.current, kind);
  }, [kind]);

  // The page can move the pin too (e.g. after finding a typed address): target = { lat, lng, source, key }.
  useEffect(() => {
    if (!target?.key || !map.current) return;
    nextSource.current = target.source || 'manual';
    goTo(map.current, target, target.zoom || 17);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.key]);

  // Typed coordinates or a full map link jump straight there; a short link is
  // expanded by the server; anything else is a place search.
  const parsed = parseLocationText(debounced);
  const shortLink = isShortMapLink(debounced);
  useEffect(() => {
    let live = true;
    if (parsed || shortLink || debounced.trim().length < 3) { setResults(null); return undefined; }
    setBusy('search');
    searchPlaces(debounced, origin, lang)
      .then((r) => { if (live) setResults(r); })
      .catch(() => { if (live) setResults([]); })
      .finally(() => { if (live) setBusy(''); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, origin, lang]);

  const useLink = async () => {
    setProblem('');
    setAsk(false);
    if (parsed) { nextSource.current = 'link'; goTo(map.current, parsed); setQuery(''); return; }
    setBusy('link');
    try {
      const apiBase = getApiBase();
      const r = await fetch(`${apiBase}/api/geo/resolve?url=${encodeURIComponent(debounced.trim())}`);
      if (!r.ok) throw new Error('link');
      const p = await r.json();
      nextSource.current = 'link';
      goTo(map.current, p);
      setQuery('');
    } catch {
      setProblem(tr(...PICKER_TEXT.link));
    } finally {
      setBusy('');
    }
  };

  const level = accuracyLevel(gps?.accuracy);
  const rough = gps?.accuracy && level !== 'exact' && level !== 'good';
  const confirmHere = () => {
    setAsk(false);
    const c = map.current?.getCenter();
    if (c) onConfirm?.({ lat: Number(c.lat.toFixed(6)), lng: Number(c.lng.toFixed(6)) });
  };
  const movePin = () => { setAsk(false); setProblem(tr('Drag the map so the pin sits on your house, then confirm below.', 'பின் உங்கள் வீட்டின் மேல் இருக்கும்படி வரைபடத்தை நகர்த்தி, கீழே உறுதிசெய்யுங்கள்.')); };

  return (
    <div className="vpicker" style={{ height }} data-lenis-prevent>
      <MapView className="vpicker-map" onMap={onMap} controls={false} style={{ position: 'absolute', inset: 0 }} />
      <div className="vpicker-search">
        <div className="input-group">
          <Icon name="search" size={18} className="icon" />
          <input className="input input-sm" value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (parsed || shortLink)) { e.preventDefault(); useLink(); } }}
            placeholder={tr('Search a street or landmark, or paste a Google Maps link', 'தெரு, அடையாளம் தேடுக அல்லது Google Maps இணைப்பை ஒட்டுக')} />
          {(busy === 'search' || busy === 'link') && <span className="suffix spinner" style={{ width: 16, height: 16, right: 12 }} />}
        </div>
        <AnimatePresence>
          {(parsed || shortLink) && query && (
            <motion.button type="button" className="vpicker-linkhit" onClick={useLink} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Icon name="pin" size={16} />
              {parsed ? tr('Go to {lat}, {lng}', '{lat}, {lng} இடத்துக்குச் செல்', { lat: parsed.lat.toFixed(5), lng: parsed.lng.toFixed(5) }) : tr('Open this map link', 'இந்த வரைபட இணைப்பைத் திற')}
              <Icon name="arrowRight" size={15} />
            </motion.button>
          )}
          {results && (
            <motion.ul className="vpicker-results" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              {results.length === 0 && <li className="subtle">{t('map.noResults')}</li>}
              {results.map((r) => (
                <li key={`${r.lat},${r.lng}`}>
                  <button type="button" onClick={() => { setResults(null); setQuery(''); setAsk(false); nextSource.current = 'search'; goTo(map.current, r, 17); }}>
                    <Icon name="pin" size={16} /> <span className="clamp-2">{r.name}</span>
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
      <div className={`vpicker-pin ${moving ? 'up' : ''}`} aria-hidden="true">
        <div className="vpin vpin-home"><div className="vpin-body" dangerouslySetInnerHTML={{ __html: SVG.home }} /></div>
        <span className="vpicker-shadow" />
      </div>
      <div className="vpicker-tools">
        <button type="button" className="btn btn-sm vpicker-tool" onClick={() => setKind(kind === 'street' ? 'satellite' : 'street')}>
          <Icon name="layers" size={16} /> {kind === 'street' ? t('map.satellite') : t('map.street')}
        </button>
        <button type="button" className="btn btn-sm vpicker-tool vpicker-gps" onClick={locate} disabled={busy === 'gps'}>
          {busy === 'gps' ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Icon name="locate" size={16} />} {t('map.useLocation')}
        </button>
      </div>
      <AnimatePresence>
        {ask && (
          <motion.div className="vpicker-ask" role="dialog" aria-live="polite" aria-label={tr('Confirm your location', 'உங்கள் இருப்பிடத்தை உறுதிசெய்யுங்கள்')}
            initial={{ opacity: 0, y: 18, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
            <b className="vpicker-ask-title">{tr('Is this your delivery location?', 'இதுதான் உங்கள் டெலிவரி இடமா?')}</b>
            <span className="vpicker-ask-place"><Icon name="pin" size={15} /> {label || tr('Finding the address…', 'முகவரி தேடுகிறது…')}</span>
            {gps?.accuracy && (
              <small className={`vpicker-acc acc-${level}`}>
                {rough ? tr('GPS is rough here (±{m} m). Move the pin onto your house for an exact delivery.', 'இங்கு GPS தோராயமானது (±{m} மீ). சரியான டெலிவரிக்கு பின்னை உங்கள் வீட்டின் மேல் வையுங்கள்.', { m: gps.accuracy })
                  : tr('Found by GPS, accurate to ±{m} m', 'GPS மூலம் கண்டறியப்பட்டது, ±{m} மீ துல்லியம்', { m: gps.accuracy })}
              </small>
            )}
            <div className="vpicker-ask-actions">
              {rough ? (
                <>
                  <button type="button" className="btn btn-primary btn-sm" onClick={movePin}><Icon name="pin" size={15} /> {tr('Move the pin', 'பின்னை நகர்த்து')}</button>
                  <button type="button" className="btn btn-soft btn-sm" onClick={confirmHere}>{tr('It is correct', 'இது சரிதான்')}</button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-primary btn-sm" onClick={confirmHere}><Icon name="check" size={15} /> {tr('Yes, deliver here', 'ஆம், இங்கே டெலிவரி')}</button>
                  <button type="button" className="btn btn-soft btn-sm" onClick={movePin}>{tr('No, move the pin', 'இல்லை, பின்னை நகர்த்து')}</button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="vpicker-foot">
        <AnimatePresence mode="wait" initial={false}>
          {problem ? (
            <motion.span key="p" className="vpicker-problem" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Icon name="alert" size={15} /> {problem}
            </motion.span>
          ) : busy === 'gps' ? (
            <motion.span key="g" className="vpicker-status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <span className="vpicker-pulse" /> {gps?.accuracy ? tr('Finding you… accurate to ±{m} m so far', 'இருப்பிடம் தேடுகிறது… இதுவரை ±{m} மீ', { m: gps.accuracy }) : t('map.locating')}
            </motion.span>
          ) : (
            <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {gps?.accuracy && !moving && (
                <b className={`vpicker-acc acc-${level}`}>
                  {level === 'exact' || level === 'good' ? tr('GPS ±{m} m', 'GPS ±{m} மீ', { m: gps.accuracy }) : tr('Rough GPS ±{m} m · drag to your door', 'தோராயமான GPS ±{m} மீ · வாசலுக்கு நகர்த்தவும்', { m: gps.accuracy })}
                </b>
              )}
              {moving ? t('map.hint') : label ? `${t('map.detected')}: ${label}` : t('map.hint')}
            </motion.span>
          )}
        </AnimatePresence>
        {children}
      </div>
    </div>
  );
}
