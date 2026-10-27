// Earnings tab: today, the last 7 days, cash to hand over and recent deliveries.
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { AnimatedNumber, Empty, Stars } from '@velan/shared/components/ui.jsx';
import { useRider } from '../RiderProvider.jsx';
import BarChart from '../components/BarChart.jsx';

const card = (i) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.05 + i * 0.06, type: 'spring', stiffness: 260, damping: 28 } });

export default function Earnings() {
  const { t, money, km, mins, time, date, relative } = useLang();
  const { summary, refreshSummary } = useRider();
  useEffect(() => { refreshSummary(); }, [refreshSummary]);

  if (!summary) {
    return (
      <div className="r-screen">
        <div className="skeleton" style={{ height: 190, borderRadius: 28 }} />
        <div className="skeleton" style={{ height: 230, borderRadius: 24 }} />
      </div>
    );
  }
  const { today, week, days, cashInHand, settlements, recent, rating, pay } = summary;
  const weekEarnings = days.reduce((s, d) => s + d.earnings, 0);

  return (
    <div className="r-screen r-earnings">
      <motion.section className="r-earn-hero" {...card(0)}>
        <span className="eyebrow">{t('todayLabel')}</span>
        <div className="r-earn-big num">
          <AnimatedNumber value={today.earnings} format={(n) => money(n)} />
        </div>
        <span className="r-earn-rule"><Icon name="info" size={14} /> {t('payRule', { base: pay.base, perKm: pay.perKm })}</span>
        <div className="r-earn-stats">
          <div><b className="num"><AnimatedNumber value={today.deliveries} /></b><small>{t('deliveries')}</small></div>
          <div><b className="num">{km(today.km)}</b><small>{t('distance')}</small></div>
          <div><b className="num">{today.avgMins != null ? mins(today.avgMins) : '—'}</b><small>{t('avgTime')}</small></div>
        </div>
      </motion.section>

      <motion.section className="r-card r-week" {...card(1)}>
        <div className="row">
          <div className="grow">
            <small className="subtle">{t('weekTotal')}</small>
            <b className="r-week-total num">{money(weekEarnings)}</b>
          </div>
          <div className="r-week-meta">
            <span><b className="num">{week.deliveries}</b> {t('deliveries')}</span>
            <span><b className="num">{km(week.km)}</b></span>
          </div>
        </div>
        <BarChart days={days} />
      </motion.section>

      <motion.section className={`r-card r-cash ${cashInHand ? 'due' : ''}`} {...card(2)}>
        <span className="r-icon-chip"><Icon name={cashInHand ? 'cash' : 'checkCircle'} size={20} /></span>
        <div className="grow">
          <small>{t('cashInHand')}</small>
          <b className="num">{cashInHand ? money(cashInHand) : t('allSettled')}</b>
          {cashInHand > 0 && <p>{t('cashHint')}</p>}
        </div>
      </motion.section>

      <motion.section className="r-card r-rating" {...card(3)}>
        <span className="r-icon-chip"><Icon name="star" size={20} /></span>
        <div className="grow">
          <small>{t('rating')}</small>
          {rating.avg ? (
            <div className="row" style={{ gap: 8 }}><b className="num">{rating.avg.toFixed(1)}</b><Stars value={rating.avg} size={16} /><span className="subtle">· {t('ratingCount', { n: rating.count })}</span></div>
          ) : <b>{t('noRating')}</b>}
        </div>
      </motion.section>

      <motion.section {...card(4)}>
        <h3 className="r-section-title">{t('recent')}</h3>
        {recent.length ? (
          <ul className="r-list">
            {recent.map((r) => (
              <li key={r.id}>
                <span className={`r-pay-chip ${r.method}`}><Icon name={r.method === 'cash' ? 'cash' : 'phoneDevice'} size={16} /></span>
                <div className="grow">
                  <b>#{r.number} · {r.customerName}</b>
                  <small className="ellipsis">{date(r.deliveredAt)} · {time(r.deliveredAt)} · {r.distanceKm != null ? km(r.distanceKm) : ''}</small>
                  {r.rating && <Stars value={r.rating} size={12} />}
                </div>
                <div className="r-list-amt">
                  <b className="num">+{money(r.riderPay || 0)}</b>
                  <small className="num">{money(r.total)}</small>
                </div>
              </li>
            ))}
          </ul>
        ) : <Empty icon="scooter" title={t('noDeliveries')} />}
      </motion.section>

      {settlements.length > 0 && (
        <motion.section {...card(5)}>
          <h3 className="r-section-title">{t('settlements')}</h3>
          <ul className="r-list">
            {settlements.map((s) => (
              <li key={s.id}>
                <span className="r-pay-chip settled"><Icon name="checkCircle" size={16} /></span>
                <div className="grow">
                  <b>{relative(s.createdAt)}</b>
                  <small>{t('orders', { n: s.count })}{s.note ? ` · ${s.note}` : ''}</small>
                </div>
                <b className="num">{money(s.amount)}</b>
              </li>
            ))}
          </ul>
        </motion.section>
      )}
    </div>
  );
}
