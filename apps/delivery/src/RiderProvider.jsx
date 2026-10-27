// Everything the rider app knows and does: profile & earnings, settings, active
// jobs, live GPS sharing, the new-job alarm, the demo drive and job actions.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { connect, getSocket, useSocketEvent } from '@velan/shared/realtime.js';
import { useLang } from '@velan/shared/i18n.jsx';
import { toast } from '@velan/shared/components/ui.jsx';
import { sound, vibrate, notify, flowerShower } from '@velan/shared/effects.js';
import { isActive } from '@velan/shared/domain.js';
import { fetchRoute } from '@velan/shared/map.jsx';
import { createTrackFilter } from '@velan/shared/geo.js';
import { api } from './api.js';
import { demoAllowed, metersBetween, sampleRoute } from './lib/geo.js';

const Ctx = createContext(null);
export const useRider = () => useContext(Ctx);

export const storePoint = (s) => (s ? { lat: s.lat, lng: s.lng } : null);

export function RiderProvider({ children }) {
  const i18n = useLang();
  const L = useRef(i18n);
  L.current = i18n;
  useState(() => connect(api.token));

  const [summary, setSummary] = useState(null);
  const [settings, setSettings] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [alertOrder, setAlertOrder] = useState(null);
  const [openJobId, setOpenJobId] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const known = useRef(new Set());
  const ready = useRef(false);

  const raiseAlert = useCallback((o) => {
    setAlertOrder(o);
    notify(L.current.t('alert.notify', { n: o.number }), [o.customerName, o.address?.line].filter(Boolean).join(' · '), { tag: o.id });
  }, []);

  const refreshSummary = useCallback(() => api.get('/rider/me').then(setSummary).catch(() => {}), []);

  const load = useCallback(async () => {
    try {
      const [me, s, list] = await Promise.all([api.get('/rider/me'), api.get('/settings'), api.get('/orders?active=true&limit=50')]);
      setSummary(me);
      setSettings(s);
      const active = list.orders.filter(isActive);
      if (ready.current) {
        const fresh = active.find((o) => !known.current.has(o.id));
        if (fresh) raiseAlert(fresh);
      }
      active.forEach((o) => known.current.add(o.id));
      setOrders(active);
      ready.current = true;
      setLoaded(true);
    } catch (e) {
      if (e.code !== 'UNAUTHORIZED') toast.error(L.current.error(e));
    }
  }, [raiseAlert]);

  useEffect(() => {
    load();
    const onFocus = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [load]);

  // ---------- live updates ----------

  const upsert = (o) => setOrders((list) => {
    const i = list.findIndex((x) => x.id === o.id);
    if (i < 0) return [o, ...list];
    const next = [...list];
    next[i] = o;
    return next;
  });
  const drop = (id) => setOrders((list) => list.filter((x) => x.id !== id));

  useSocketEvent('connect', () => { if (ready.current) load(); });
  useSocketEvent('settings:update', setSettings);
  useSocketEvent('order:update', (o) => {
    if (isActive(o)) {
      upsert(o);
      if (ready.current && !known.current.has(o.id)) {
        known.current.add(o.id);
        raiseAlert(o);
      }
      return;
    }
    drop(o.id);
    if (o.status === 'cancelled' || o.status === 'rejected') {
      toast.error(L.current.t('cancelledToast', { n: o.number }));
      sound.error();
      setAlertOrder((a) => (a?.id === o.id ? null : a));
      setOpenJobId((id) => (id === o.id ? null : id));
    }
    if (o.status === 'delivered') refreshSummary();
  });
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  useSocketEvent('order:removed', ({ id }) => {
    const o = ordersRef.current.find((x) => x.id === id);
    if (o) toast(L.current.t('unassigned', { n: o.number }), { icon: 'info' });
    drop(id);
    known.current.delete(id);
    setAlertOrder((a) => (a?.id === id ? null : a));
    setOpenJobId((cur) => (cur === id ? null : cur));
  });

  // New-job alarm keeps ringing until the rider looks at it (3 min max).
  useEffect(() => {
    if (!alertOrder) return undefined;
    const ring = () => { sound.alarm(); vibrate([350, 150, 350, 150, 600]); };
    ring();
    const id = setInterval(ring, 2800);
    const stop = setTimeout(() => clearInterval(id), 180_000);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [alertOrder]);

  // ---------- online & GPS ----------

  const online = Boolean(summary?.rider?.online);
  const setOnline = useCallback(async (value) => {
    try {
      const r = await api.post('/rider/online', { online: value });
      setSummary((s) => ({ ...s, rider: { ...s?.rider, ...r } }));
      vibrate(value ? [40, 60, 40] : 40);
      if (value) sound.chime();
      toast(L.current.t(value ? 'onlineToast' : 'offlineToast'), { icon: value ? 'power' : 'moon' });
    } catch (e) {
      toast.error(L.current.error(e));
    }
  }, []);

  const [gps, setGps] = useState({ pos: null, error: null });
  const manualRef = useRef(null);
  const last = useRef(null);
  const simulating = useRef(false);
  // On a delivery the customer's map should move smoothly: share every 2.5 s or 8 m.
  const onTheRoad = orders.some((o) => o.status === 'out_for_delivery');
  const pace = useRef(onTheRoad);
  pace.current = onTheRoad;

  const emit = useCallback((p, force = false) => {
    const s = getSocket();
    if (!s?.connected || !p) return;
    const now = Date.now();
    const l = last.current;
    if (!force && l) {
      const [every, far] = pace.current ? [2500, 8] : [5000, 25];
      if (now - l.at < 1000) return;
      if (now - l.at < every && metersBetween(l, p) < far) return;
    }
    s.emit('rider:location', { lat: p.lat, lng: p.lng, heading: p.heading ?? null, speed: p.speed ?? null, accuracy: p.accuracy ?? null, source: p.source || 'gps' });
    last.current = { lat: p.lat, lng: p.lng, at: now };
  }, []);

  useEffect(() => {
    if (!online) { setGps((g) => ({ pos: g.pos, error: null })); return undefined; }
    if (!window.isSecureContext) { setGps((g) => ({ pos: g.pos?.source === 'manual' ? g.pos : null, error: 'insecure' })); return undefined; }
    if (!navigator.geolocation) { setGps((g) => ({ pos: g.pos?.source === 'manual' ? g.pos : null, error: 'unavailable' })); return undefined; }
    // Raw fixes go through the filter: glitches dropped, jitter smoothed, heading and speed filled in.
    const feed = createTrackFilter();
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const pos = feed({
          lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy,
          heading: Number.isFinite(p.coords.heading) ? p.coords.heading : null,
          speed: Number.isFinite(p.coords.speed) ? p.coords.speed : null, at: p.timestamp || Date.now(),
        });
        if (!pos) return;
        pos.source = 'gps';
        // A location the rider set by hand stays until GPS is sharp (±50 m) or 10 minutes pass.
        const hand = manualRef.current;
        if (hand && pos.accuracy > 50 && Date.now() - hand.at < 600_000) return;
        manualRef.current = null;
        setGps({ pos, error: null });
        if (!simulating.current) emit(pos);
      },
      (err) => setGps((g) => ({ ...g, error: err.code === 1 ? 'denied' : 'unavailable' })),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [online, emit]);

  // Without GPS (blocked, no signal, or plain http) the rider can say where they are by hand:
  // a pasted map link, typed coordinates, a search or the map. GPS takes over again when it works.
  const setManualLocation = useCallback((p) => {
    const pos = { lat: p.lat, lng: p.lng, accuracy: null, heading: null, speed: null, at: Date.now(), source: 'manual' };
    manualRef.current = pos;
    setGps((g) => ({ pos, error: g.error }));
    emit(pos, true);
    toast.success(L.current.tr('Location shared with the restaurant and customer', 'இருப்பிடம் உணவகத்துக்கும் வாடிக்கையாளருக்கும் பகிரப்பட்டது'));
  }, [emit]);

  // Heartbeat so the restaurant still sees a parked rider.
  const gpsRef = useRef(gps);
  gpsRef.current = gps;
  useEffect(() => {
    if (!online) return undefined;
    const id = setInterval(() => { if (!simulating.current && gpsRef.current.pos) emit(gpsRef.current.pos, true); }, 15000);
    return () => clearInterval(id);
  }, [online, emit]);

  // ---------- demo drive ----------

  const [sim, setSim] = useState(null);
  const simTimer = useRef(null);
  const stopSim = useCallback(() => {
    clearTimeout(simTimer.current);
    simTimer.current = null;
    simulating.current = false;
    setSim(null);
  }, []);
  const startSim = useCallback(async (order) => {
    stopSim();
    const from = gpsRef.current.pos && metersBetween(gpsRef.current.pos, order.address) < 30000
      ? gpsRef.current.pos
      : storePoint(settings);
    const route = await fetchRoute(from, order.address);
    const pts = sampleRoute(route.coords);
    simulating.current = true;
    let i = 0;
    const step = () => {
      const p = { ...pts[i], accuracy: 6, speed: 7, source: 'demo' };
      setSim({ orderId: order.id, pos: p, progress: i / (pts.length - 1), done: i === pts.length - 1 });
      emit(p, true);
      i += 1;
      if (i < pts.length) simTimer.current = setTimeout(step, 1200);
    };
    step();
  }, [emit, settings, stopSim]);
  useEffect(() => () => clearTimeout(simTimer.current), []);

  const position = sim?.pos || gps.pos;

  // ---------- job actions ----------

  const pickUp = useCallback(async (order) => {
    try {
      const o = await api.post(`/orders/${order.id}/status`, { status: 'out_for_delivery' });
      upsert(o);
      sound.chime();
      vibrate([30, 40, 80]);
      toast.success(L.current.t('pickedToast'));
    } catch (e) {
      toast.error(L.current.error(e));
      throw e;
    }
  }, []);

  /** "I've arrived" — the customer gets a notification that their food is at the door. */
  const arrive = useCallback(async (order) => {
    if (order.arrivedAt) return;
    try {
      upsert(await api.post(`/orders/${order.id}/arrived`));
      toast.success(L.current.tr('Customer told you have arrived', 'நீங்கள் வந்துவிட்டதாக வாடிக்கையாளருக்குத் தெரிவிக்கப்பட்டது'));
    } catch (e) {
      toast.error(L.current.error(e));
    }
  }, []);

  /** Throws the ApiError (e.g. OTP_WRONG) so the OTP boxes can shake. */
  const deliver = useCallback(async (order, otp) => {
    const o = await api.post(`/orders/${order.id}/status`, { status: 'delivered', otp });
    drop(o.id);
    if (sim?.orderId === o.id) stopSim();
    setOpenJobId(null);
    setCelebration(o);
    sound.success();
    vibrate([60, 50, 60, 50, 200]);
    flowerShower({ count: 120 });
    refreshSummary();
    return o;
  }, [sim, stopSim, refreshSummary]);

  const logout = useCallback(async () => {
    try { if (online) await api.post('/rider/online', { online: false }); } catch { /* ignore */ }
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    stopSim();
    getSocket()?.disconnect();
    api.setToken(null);
  }, [online, stopSim]);

  const value = {
    me: summary?.rider || null, summary, settings, orders, loaded, online, setOnline, gps, position, setManualLocation, sim, startSim, stopSim,
    demo: demoAllowed(), openJobId, setOpenJobId, alertOrder, dismissAlert: () => setAlertOrder(null),
    celebration, closeCelebration: () => setCelebration(null), pickUp, arrive, deliver, reload: load, refreshSummary, logout,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
