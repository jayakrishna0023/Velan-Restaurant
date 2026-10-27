import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { useTheme, useWakeLock } from '@velan/shared/hooks.js';
import { useConnected } from '@velan/shared/realtime.js';
import { Toaster, ConfirmHost } from '@velan/shared/components/ui.jsx';
import { api } from './api.js';
import { RiderProvider, useRider } from './RiderProvider.jsx';
import { Header, TabBar } from './components/Chrome.jsx';
import { AlertTakeover, Celebration } from './components/Overlays.jsx';
import Login from './screens/Login.jsx';
import Orders from './screens/Orders.jsx';
import Earnings from './screens/Earnings.jsx';
import Profile from './screens/Profile.jsx';
import JobScreen from './screens/Job.jsx';

const TAB_ORDER = ['orders', 'earnings', 'profile'];

function RiderShell({ theme, awake }) {
  const { t } = useLang();
  const r = useRider();
  const connected = useConnected();
  const [tab, setTab] = useState('orders');
  const prev = useRef(tab);
  const dir = TAB_ORDER.indexOf(tab) >= TAB_ORDER.indexOf(prev.current) ? 1 : -1;
  useEffect(() => { prev.current = tab; }, [tab]);
  const openJob = r.orders.find((o) => o.id === r.openJobId);

  const go = (next) => {
    if (next === tab) return;
    setTab(next);
  };

  return (
    <>
      <Header />
      <AnimatePresence>
        {!connected && (
          <motion.div className="r-offline" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> {t('offline')}
          </motion.div>
        )}
      </AnimatePresence>
      <main className="r-main">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div key={tab} custom={dir}
            initial={{ opacity: 0, x: 28 * dir }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 * dir }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
            {tab === 'orders' && <Orders />}
            {tab === 'earnings' && <Earnings />}
            {tab === 'profile' && <Profile theme={theme} awake={awake} />}
          </motion.div>
        </AnimatePresence>
      </main>
      <TabBar tab={tab} onChange={go} badge={r.orders.length} />
      <AnimatePresence>
        {openJob && <JobScreen key={openJob.id} order={openJob} onClose={() => r.setOpenJobId(null)} />}
      </AnimatePresence>
      <AnimatePresence>{r.alertOrder && <AlertTakeover key={r.alertOrder.id} order={r.alertOrder} />}</AnimatePresence>
      <AnimatePresence>{r.celebration && <Celebration key={r.celebration.id} order={r.celebration} />}</AnimatePresence>
    </>
  );
}

export default function App() {
  const [token, setToken] = useState(api.token);
  useEffect(() => api.onToken(setToken), []);
  const theme = useTheme('velan.rider.theme', 'dark');
  // The screen never sleeps while the rider app is open.
  const awake = useWakeLock(true);

  return (
    <div className="r-stage">
      <div className="r-app">
        <AnimatePresence mode="wait">
          {token ? (
            <motion.div key={token} className="r-shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <RiderProvider>
                <RiderShell theme={theme} awake={awake} />
              </RiderProvider>
            </motion.div>
          ) : (
            <Login key="login" />
          )}
        </AnimatePresence>
      </div>
      <Toaster />
      <ConfirmHost />
    </div>
  );
}
