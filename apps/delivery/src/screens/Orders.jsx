// Orders tab: online control, today at a glance, active jobs or a waiting scene.
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { AnimatedNumber } from '@velan/shared/components/ui.jsx';
import { useRider } from '../RiderProvider.jsx';
import OnlineCard from '../components/OnlineCard.jsx';
import JobCard from '../components/JobCard.jsx';
import Scene from '../components/Scene.jsx';

export default function Orders() {
  const { t, money } = useLang();
  const { orders, online, summary, loaded } = useRider();
  const today = summary?.today;
  return (
    <div className="r-screen r-orders">
      <OnlineCard />
      <div className="r-strip">
        <div><Icon name="checkCircle" size={18} /><b className="num"><AnimatedNumber value={today?.deliveries || 0} /></b><small>{t('todayDone')}</small></div>
        <div><Icon name="wallet" size={18} /><b className="num"><AnimatedNumber value={today?.earnings || 0} format={(n) => money(n)} /></b><small>{t('todayEarned')}</small></div>
        <div><Icon name="cash" size={18} /><b className="num"><AnimatedNumber value={summary?.cashInHand || 0} format={(n) => money(n)} /></b><small>{t('cashToGive')}</small></div>
      </div>
      {!loaded ? (
        <div className="stack" style={{ gap: 12 }}>
          <div className="skeleton" style={{ height: 150, borderRadius: 24 }} />
          <div className="skeleton" style={{ height: 150, borderRadius: 24 }} />
        </div>
      ) : orders.length ? (
        <section className="r-jobs-section">
          <h3 className="r-section-title">{t('activeJobs')} <motion.span key={orders.length} className="r-count" initial={{ scale: 0.5 }} animate={{ scale: 1 }}>{orders.length}</motion.span></h3>
          <div className="stack r-jobs" style={{ gap: 14 }}>
            <AnimatePresence initial={false}>
              {orders.map((o, i) => <JobCard key={o.id} order={o} index={i} />)}
            </AnimatePresence>
          </div>
        </section>
      ) : (
        <Scene online={online} />
      )}
    </div>
  );
}
