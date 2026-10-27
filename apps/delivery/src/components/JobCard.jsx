// Compact card for an active delivery on the Orders tab.
import { motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { StatusBadge } from '@velan/shared/components/ui.jsx';
import { useRider } from '../RiderProvider.jsx';
import KitchenTimer from './KitchenTimer.jsx';

export default function JobCard({ order, index = 0 }) {
  const { t, pick, money, km } = useLang();
  const { settings, setOpenJobId } = useRider();
  const count = order.items.reduce((s, i) => s + i.qty, 0);
  const picked = order.status === 'out_for_delivery';
  const pay = order.payment.status === 'paid' ? t('pay.paid') : t(`pay.${order.payment.method}`);
  return (
    <motion.button type="button" className={`r-job ${picked ? 'is-picked' : ''}`} layout
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: index * 0.06, type: 'spring', stiffness: 300, damping: 30 }}
      whileTap={{ scale: 0.98 }} onClick={() => setOpenJobId(order.id)}>
      <div className="r-job-top">
        <span className="r-job-no">#{order.number}</span>
        <StatusBadge order={order} live />
        <span className="grow" />
        <span className="r-job-amt num">{money(order.bill.total)}<small>{pay}</small></span>
      </div>
      <div className="r-route">
        <div className={`r-stop ${picked ? 'done' : 'now'}`}>
          <span className="r-stop-dot store"><Icon name="store" size={13} /></span>
          <div className="grow">
            <b className="ellipsis">{pick(settings, 'name') || t('restaurant')}</b>
            {!picked && <KitchenTimer order={order} />}
            {picked && <small>{t('status.pickedUp')}</small>}
          </div>
        </div>
        <div className="r-stop-line"><span style={{ transform: `scaleY(${picked ? 1 : 0.15})` }} /></div>
        <div className={`r-stop ${picked ? 'now' : ''}`}>
          <span className="r-stop-dot home"><Icon name="home" size={13} /></span>
          <div className="grow">
            <b className="ellipsis">{order.customerName}</b>
            <small className="ellipsis">{order.address?.line}{order.address?.landmark ? ` · ${order.address.landmark}` : ''}</small>
          </div>
        </div>
      </div>
      <div className="r-job-foot">
        <span><Icon name="route" size={15} /> {order.distanceKm != null ? km(order.distanceKm) : '—'}</span>
        <span><Icon name="bag" size={15} /> {t('items', { n: count })}</span>
        <span className="grow" />
        <span className="r-job-open">{t('open')} <Icon name="arrowRight" size={16} /></span>
      </div>
    </motion.button>
  );
}
