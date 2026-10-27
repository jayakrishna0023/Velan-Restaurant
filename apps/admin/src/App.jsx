import { Suspense, lazy, useEffect, useMemo, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster, ConfirmHost, toast } from '@velan/shared/components/ui.jsx';
import { VelSeal } from '@velan/shared/components/Brand.jsx';
import { connect, useConnected, useSocketEvent } from '@velan/shared/realtime.js';
import { useLang } from '@velan/shared/i18n.jsx';
import { useTheme, useWakeLock } from '@velan/shared/hooks.js';
import { sound, notify, askNotify } from '@velan/shared/effects.js';
import { api } from './api.js';
import { applyActivity, applyOrder, applyRider, applyRiderLocation, loadLive, setMenu, setPresence, setSettings, useLive } from './state/live.js';
import { checkAuth, openOrder, useAuth, usePrefs } from './state/ui.js';
import { ThemeCtx } from './components/theme.js';
import { Sidebar, Topbar, MobileNav } from './components/Shell.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import ActivityDrawer from './components/ActivityDrawer.jsx';
import OrderSheet from './components/OrderSheet.jsx';
import Login from './pages/Login.jsx';

// Each page is its own chunk, fetched the first time it is opened.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const LiveBoard = lazy(() => import('./pages/LiveBoard.jsx'));
const Kitchen = lazy(() => import('./pages/Kitchen.jsx'));
const Orders = lazy(() => import('./pages/Orders.jsx'));
const Pos = lazy(() => import('./pages/Pos.jsx'));
const LiveMap = lazy(() => import('./pages/LiveMap.jsx'));
const Menu = lazy(() => import('./pages/Menu.jsx'));
const Riders = lazy(() => import('./pages/Riders.jsx'));
const Customers = lazy(() => import('./pages/Customers.jsx'));
const Offers = lazy(() => import('./pages/Offers.jsx'));
const Reviews = lazy(() => import('./pages/Reviews.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));

export default function App() {
  const [theme, setPref, pref] = useTheme('velan.admin.theme');
  const checked = useAuth((s) => s.checked);
  const user = useAuth((s) => s.user);
  const themeCtl = useMemo(() => ({ theme, pref, setPref }), [theme, pref, setPref]);
  useEffect(() => { checkAuth(); }, []);
  // The counter tablet's screen never sleeps while the console is open.
  useWakeLock(true);

  return (
    <ThemeCtx.Provider value={themeCtl}>
      {!checked ? <Boot /> : user ? <Console /> : <Login />}
      <Toaster />
      <ConfirmHost />
    </ThemeCtx.Provider>
  );
}

function Boot() {
  return (
    <div className="boot">
      <VelSeal size={120} draw />
    </div>
  );
}

/** Keeps the live store in sync with the server. */
function LiveSync() {
  const connected = useConnected();
  const was = useRef(true);
  useSocketEvent('order:update', applyOrder);
  useSocketEvent('menu:update', setMenu);
  useSocketEvent('settings:update', setSettings);
  useSocketEvent('rider:update', applyRider);
  useSocketEvent('rider:location', applyRiderLocation);
  useSocketEvent('rider:presence', setPresence);
  useSocketEvent('activity', applyActivity);
  useEffect(() => {
    if (connected && !was.current) loadLive().catch(() => {});
    was.current = connected;
  }, [connected]);
  return null;
}

/** Rings, notifies and flashes the tab title while new orders wait. */
function OrderAlarm() {
  const active = useLive((s) => s.active);
  const loaded = useLive((s) => s.loaded);
  const soundOn = usePrefs((s) => s.sound);
  const L = useLang();
  // Counter/phone orders are keyed in by staff and go straight to the kitchen.
  const placed = useMemo(() => active.filter((o) => o.status === 'placed' && o.source === 'online'), [active]);
  const seen = useRef(null);

  useEffect(() => {
    if (!loaded) return;
    // Orders already waiting when the console opens ring via the interval below, without a toast each.
    if (seen.current === null) { seen.current = new Set(placed.map((o) => o.id)); return; }
    for (const o of placed) {
      if (seen.current.has(o.id)) continue;
      seen.current.add(o.id);
      if (soundOn) sound.alarm();
      const title = L.tr(`New order #${o.number}`, `புதிய ஆர்டர் #${o.number}`);
      const body = `${o.customerName} · ${L.money(o.bill.total)} · ${L.t(`type.${o.type}`)}`;
      notify(title, body, { tag: o.id });
      toast(title, { sub: body, icon: 'bell', ms: 6000 });
    }
  }, [placed, loaded, soundOn, L]);

  useEffect(() => {
    if (!placed.length || !soundOn) return undefined;
    const id = setInterval(() => sound.alarm(), 12000);
    return () => clearInterval(id);
  }, [placed.length, soundOn]);

  // The tab icon carries a turmeric count badge while orders wait.
  useEffect(() => {
    const links = [...document.querySelectorAll('link[rel="icon"]')];
    const original = links.map((l) => [l, l.href, l.type]);
    if (!placed.length) return undefined;
    let dead = false;
    const img = new Image();
    img.onload = () => {
      if (dead) return;
      const c = Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, 64, 64);
      g.beginPath();
      g.arc(46, 18, 17, 0, Math.PI * 2);
      g.fillStyle = '#f5b323';
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = '#17110e';
      g.stroke();
      g.fillStyle = '#17110e';
      g.font = '800 22px Anek Latin, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(placed.length > 9 ? '9+' : String(placed.length), 46, 19);
      const url = c.toDataURL('image/png');
      links.forEach((l) => { l.type = 'image/png'; l.href = url; });
    };
    img.src = `${import.meta.env.BASE_URL}favicon.svg`;
    return () => { dead = true; original.forEach(([l, href, type]) => { l.href = href; l.type = type; }); };
  }, [placed.length]);

  useEffect(() => {
    const base = 'Velan Console · வேலன் நிர்வாகம்';
    if (!placed.length) { document.title = base; return undefined; }
    let flip = false;
    const msg = L.tr(`(${placed.length}) New order!`, `(${placed.length}) புதிய ஆர்டர்!`);
    const id = setInterval(() => { flip = !flip; document.title = flip ? `🔔 ${msg}` : base; }, 1000);
    return () => { clearInterval(id); document.title = base; };
  }, [placed.length, L]);
  return null;
}

function Console() {
  const location = useLocation();
  const loaded = useLive((s) => s.loaded);
  const collapsed = usePrefs((s) => s.collapsed);
  const L = useLang();
  const kitchen = location.pathname.startsWith('/kitchen');

  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  useEffect(() => {
    connect(api.token);
    loadLive().catch((e) => toast.error(L.error(e)));
    // Browsers only show the permission prompt after a tap.
    const ask = () => { askNotify().catch(() => {}); window.removeEventListener('pointerdown', ask); };
    window.addEventListener('pointerdown', ask);
    // Deep link: /admin/orders?open=<id>
    const open = new URLSearchParams(window.location.search).get('open');
    if (open) openOrder(open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`console ${collapsed ? 'is-collapsed' : ''} ${kitchen ? 'is-kitchen' : ''}`}>
      <LiveSync />
      <OrderAlarm />
      {!kitchen && <Sidebar />}
      <div className="main">
        {!kitchen && <Topbar />}
        {!loaded ? (
          <div className="boot inline"><VelSeal size={96} draw /></div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} className="route" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
              <Suspense fallback={<div className="boot inline"><VelSeal size={96} draw /></div>}>
              <Routes location={location}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/live" element={<LiveBoard />} />
                <Route path="/kitchen" element={<Kitchen />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/pos" element={<Pos />} />
                <Route path="/map" element={<LiveMap />} />
                <Route path="/menu" element={<Menu />} />
                <Route path="/riders" element={<Riders />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/offers" element={<Offers />} />
                <Route path="/reviews" element={<Reviews />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Dashboard />} />
              </Routes>
              </Suspense>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
      <MobileNav />
      <OrderSheet />
      <CommandPalette />
      <ActivityDrawer />
    </div>
  );
}
