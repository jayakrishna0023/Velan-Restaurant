// Full-screen moments: the new-delivery alarm and the delivered celebration.
import { motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { AnimatedNumber } from '@velan/shared/components/ui.jsx';
import { useRider } from '../RiderProvider.jsx';

const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0, transition: { duration: 0.2 } } };

export function AlertTakeover({ order }) {
  const { t, money, km, time } = useLang();
  const { dismissAlert, setOpenJobId } = useRider();
  const count = order.items.reduce((s, i) => s + i.qty, 0);
  const view = () => { dismissAlert(); setOpenJobId(order.id); };
  return (
    <motion.div className="r-takeover r-alert" role="alertdialog" aria-label={t('alert.title')} {...fade}>
      <div className="r-alert-bg" />
      <motion.div className="r-alert-rings" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 16 }}>
        <span /><span /><span />
        <motion.div className="r-alert-icon" animate={{ rotate: [0, -10, 10, -6, 6, 0] }} transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 1.9 }}>
          <Icon name="bell" size={44} stroke={2} />
        </motion.div>
      </motion.div>
      <motion.div className="r-alert-copy" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
        <span className="eyebrow">#{order.number}</span>
        <h2 className="display">{t('alert.title')}</h2>
        <p>{t('alert.sub')}</p>
      </motion.div>
      <motion.div className="r-alert-card" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}>
        <div className="r-alert-grid">
          <div><small>{t('total')}</small><b className="num">{money(order.bill.total)}</b><em>{order.payment.status === 'paid' ? t('pay.paid') : t(`pay.${order.payment.method}`)}</em></div>
          <div><small>{t('distance')}</small><b className="num">{order.distanceKm != null ? km(order.distanceKm) : '—'}</b><em>{t('items', { n: count })}</em></div>
          <div><small>{t('kitchen')}</small><b className="num">{order.readyBy ? time(order.readyBy) : '—'}</b><em>{t(`status.${order.status}`)}</em></div>
        </div>
        <div className="r-alert-drop">
          <Icon name="pin" size={18} />
          <span className="grow"><b>{order.customerName}</b><small className="clamp-2">{order.address?.line}</small></span>
        </div>
      </motion.div>
      <motion.div className="r-alert-actions" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }}>
        <button type="button" className="btn btn-gold btn-lg btn-block" onClick={view}>{t('alert.view')} <Icon name="arrowRight" size={20} /></button>
        <button type="button" className="btn btn-ghost btn-block r-alert-later" onClick={dismissAlert}>{t('alert.later')}</button>
      </motion.div>
    </motion.div>
  );
}

export function Celebration({ order }) {
  const { t, money } = useLang();
  const { closeCelebration } = useRider();
  const cash = order.payment.method === 'cash' && order.type === 'delivery';
  return (
    <motion.div className="r-takeover r-celebrate" {...fade}>
      <motion.svg width="120" height="120" viewBox="0 0 120 120" className="r-check" initial="hidden" animate="show">
        <motion.circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"
          variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1, transition: { duration: 0.7, ease: [0.65, 0, 0.35, 1] } } }} />
        <motion.path d="M38 62l15 15 30-32" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"
          variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1, transition: { duration: 0.45, delay: 0.6 } } }} />
      </motion.svg>
      <motion.h2 className="display" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>{t('deliveredTitle')}</motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}>{t('deliveredSub', { n: order.number })}</motion.p>
      <motion.span className="r-rule" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.7, duration: 0.9 }} />
      {order.riderPay != null && (
        <motion.div className="r-earned" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.8, type: 'spring', stiffness: 260, damping: 14 }}>
          <span className="gold-text num">+<AnimatedNumber value={order.riderPay} format={(n) => money(n)} duration={1.2} /></span>
          <small>{t('earned')}</small>
        </motion.div>
      )}
      {cash && <motion.p className="r-collected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}><Icon name="cash" size={16} /> {t('collected', { amt: money(order.bill.total) })}</motion.p>}
      <motion.button type="button" className="btn btn-gold btn-lg btn-block" onClick={closeCelebration}
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.1 }}>
        {t('backToOrders')}
      </motion.button>
    </motion.div>
  );
}
