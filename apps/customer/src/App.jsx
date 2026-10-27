import { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster, ConfirmHost, toast } from '@velan/shared/components/ui.jsx';
import { useSocketEvent, useConnected } from '@velan/shared/realtime.js';
import { useLang } from '@velan/shared/i18n.jsx';
import { sound, notify } from '@velan/shared/effects.js';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { useTheme } from '@velan/shared/hooks.js';
import { loadSite, applyMenu, applySettings, applyOffers, useSite } from './state/site.js';
import { restoreSession, useSession } from './state/session.js';
import { trackOrderUpdate } from './state/orders.js';
import { startSmoothScroll, pauseScroll, jumpToTop } from './lib/scroll.js';
import { useCart } from './state/cart.js';
import { ui, useUi } from './state/ui.js';
import ScrollProgress from './components/ScrollProgress.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Preloader from './components/Preloader.jsx';
import CartDrawer from './components/CartDrawer.jsx';
import AuthModal from './components/AuthModal.jsx';
import CartBar from './components/CartBar.jsx';
import ActiveOrderPill from './components/ActiveOrderPill.jsx';
import Home from './pages/Home.jsx';
import Checkout from './pages/Checkout.jsx';
import Track from './pages/Track.jsx';
import Account from './pages/Account.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  const location = useLocation();
  const { t } = useLang();
  const loaded = useSite((s) => s.loaded);
  const error = useSite((s) => s.error);
  const user = useSession((s) => s.user);
  const connected = useConnected();
  const [theme, setTheme] = useTheme('velan.site.theme', 'light');
  const [intro, setIntro] = useState(() => { try { return !sessionStorage.getItem('velan.intro'); } catch { return true; } });

  const cartOpen = useCart((s) => s.open);
  const authOpen = useSession((s) => s.authOpen);
  const dialogOpen = useUi((s) => Boolean(s.dishId) || s.zoneOpen);
  const overlay = cartOpen || authOpen || dialogOpen;

  useEffect(() => { loadSite(); restoreSession(); }, []);
  useEffect(() => startSmoothScroll(), []);
  useEffect(() => { pauseScroll(overlay); }, [overlay]);
  // Jump to the top once the old page has faded out.
  useEffect(() => { const id = setTimeout(jumpToTop, 220); return () => clearTimeout(id); }, [location.pathname]);

  useSocketEvent('menu:update', applyMenu);
  useSocketEvent('settings:update', applySettings);
  useSocketEvent('offers:update', applyOffers);
  useSocketEvent('order:update', (o) => {
    const prev = trackOrderUpdate(o);
    if (prev && !prev.arrivedAt && o.arrivedAt && o.status === 'out_for_delivery') {
      const title = t('tracker.arrived', { n: o.number });
      sound.success();
      notify(title, t('tracker.arrivedSub'), { tag: `${o.id}-arrived` });
      toast(title, { icon: 'home', ms: 6000 });
      return;
    }
    if (prev && prev.status !== o.status) {
      sound.chime();
      const status = o.status === 'delivered' && o.type === 'pickup' ? t('status.pickedUp') : t(`status.${o.status}`);
      notify(t('statusUpdate', { n: o.number, status }), t(`statusLong.${o.status}`), { tag: o.id });
      if (!location.pathname.startsWith('/track/')) toast(t('statusUpdate', { n: o.number, status }), { icon: 'bell' });
    }
  });

  // The hero holds its entrance until the curtain has started to part.
  useEffect(() => { if (!intro) { const id = setTimeout(() => ui.set({ introDone: true }), 350); return () => clearTimeout(id); } return undefined; }, [intro]);
  const finishIntro = () => { setIntro(false); try { sessionStorage.setItem('velan.intro', '1'); } catch { /* ignore */ } };
  const bare = location.pathname.startsWith('/checkout');

  return (
    <>
      <AnimatePresence>{intro && <Preloader ready={loaded || !!error} onDone={finishIntro} />}</AnimatePresence>
      <ScrollProgress />
      <Header minimal={bare} theme={theme} setTheme={setTheme} />
      {error && !loaded ? (
        <div className="boot-error">
          <Icon name="alert" size={36} />
          <p>{t('err.NETWORK')}</p>
          <button className="btn btn-primary" onClick={loadSite}>{t('retry')}</button>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.main id="main" key={location.pathname} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/track/:id" element={<Track />} />
              <Route path="/account" element={<Account />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </motion.main>
        </AnimatePresence>
      )}
      {!bare && <Footer />}
      <CartDrawer />
      <AuthModal />
      {!bare && <CartBar />}
      {user && <ActiveOrderPill />}
      <AnimatePresence>
        {!connected && (
          <motion.div className="offline-bar" initial={{ y: -40 }} animate={{ y: 0 }} exit={{ y: -40 }}>
            <span className="spinner" style={{ width: 14, height: 14 }} /> {t('offline')}
          </motion.div>
        )}
      </AnimatePresence>
      <Toaster />
      <ConfirmHost />
    </>
  );
}
