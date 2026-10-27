import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Seg, Stars, toast } from '@velan/shared/components/ui.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { useAsync, useLocalState } from '@velan/shared/hooks.js';
import { STATUS_TONE } from '@velan/shared/domain.js';
import { api } from '../api.js';
import { onOrder, useLive } from '../state/live.js';
import { useAuth } from '../state/ui.js';
import { Page, PageHead, Panel, Kpi, SkeletonRows, rise } from '../components/common.jsx';
import { ActivityList } from '../components/ActivityDrawer.jsx';
import { AreaChart, BarList, Donut, Heatmap, PALETTE, shortMoney } from '../charts/charts.jsx';

function greeting(L) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  if (h < 12) return L.tr('Good morning', 'காலை வணக்கம்');
  if (h < 16) return L.tr('Good afternoon', 'மதிய வணக்கம்');
  return L.tr('Good evening', 'மாலை வணக்கம்');
}

export default function Dashboard() {
  const L = useLang();
  const { t, tr, money } = L;
  const user = useAuth((s) => s.user);
  const [range, setRange] = useLocalState('velan.admin.range', 'today');
  const { data, loading, reload } = useAsync(() => api.get(`/admin/overview?range=${range}`), [range]);
  const timer = useRef(null);

  // Refresh a few seconds after any order changes, and every minute.
  useEffect(() => {
    const off = onOrder(() => { clearTimeout(timer.current); timer.current = setTimeout(reload, 2500); });
    const id = setInterval(reload, 60000);
    return () => { off(); clearInterval(id); clearTimeout(timer.current); };
  }, [reload]);

  const hourLabel = (h) => (L.ta ? `${((h + 11) % 12) + 1}${h < 12 ? 'கா' : h < 16 ? 'ம' : h < 19 ? 'மா' : 'இ'}` : `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`);
  const labelOf = (d, i, long) => (range === 'today' ? (long ? L.hhmm(`${d.label}:00`) : hourLabel(d.label)) : L.date(`${d.label}T06:00:00Z`, { weekday: long }));

  return (
    <Page className="dashboard">
      <PageHead eyebrow={L.date(new Date(), { weekday: true })} title={<>{greeting(L)}, <span className="gold-text">{user?.name?.split(' ')[0]}</span></>}
        sub={tr('Here is how Velan is doing.', 'வேலன் எப்படி நடக்கிறது என்பது இதோ.')}>
        <Seg value={range} onChange={setRange} options={['today', '7d', '30d', '90d'].map((v) => ({ value: v, label: t(`range.${v}`) }))} />
        <button className="btn btn-soft btn-icon btn-sm" onClick={reload} title={tr('Refresh', 'புதுப்பி')}><Icon name="refresh" size={16} className={loading ? 'spin' : ''} /></button>
      </PageHead>

      {!data ? <DashSkeleton /> : <DashBody data={data} range={range} labelOf={labelOf} hourLabel={hourLabel} />}
    </Page>
  );
}

function DashSkeleton() {
  return (
    <>
      <div className="kpi-grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton" style={{ height: 150 }} />)}</div>
      <div className="grid-2-1"><div className="skeleton" style={{ height: 340 }} /><div className="skeleton" style={{ height: 340 }} /></div>
    </>
  );
}

function DashBody({ data, range, labelOf, hourLabel }) {
  const L = useLang();
  const { t, tr, money, pick } = L;
  const k = data.kpis;
  const s = data.series;
  const activity = useLive((x) => x.activity);
  const settings = useLive((x) => x.settings);

  const spark = (f) => s.map(f);
  const kpis = [
    { key: 'revenue', icon: 'rupee', format: (v) => money(v), spark: spark((d) => d.revenue), tone: 'gold' },
    { key: 'orders', icon: 'receipt', format: (v) => Math.round(v).toLocaleString('en-IN'), spark: spark((d) => d.orders), tone: 'maroon' },
    { key: 'aov', icon: 'bag', format: (v) => money(v), spark: spark((d) => (d.orders ? d.revenue / d.orders : 0)), tone: 'gold' },
    { key: 'customers', icon: 'users', format: (v) => Math.round(v), tone: 'leaf' },
    { key: 'avgDeliveryMins', icon: 'scooter', format: (v) => Math.round(v), suffix: tr(' min', ' நிமி'), invert: true, tone: 'leaf' },
    { key: 'rating', icon: 'star', format: (v) => v.toFixed(1), suffix: ' ★', tone: 'gold' },
  ];

  const segs = data.categories.map((c, i) => ({ label: pick(c, 'name'), value: c.revenue, display: money(c.revenue), color: PALETTE[i % PALETTE.length] }));
  const catTotal = data.categories.reduce((a, c) => a + c.revenue, 0);

  return (
    <>
      <div className="kpi-grid">
        {kpis.map((x) => (
          <Kpi key={x.key} icon={x.icon} label={t(`kpi.${x.key}`)} value={k[x.key].value} prev={k[x.key].prev} format={x.format}
            spark={x.spark} tone={x.tone} invert={x.invert} suffix={x.suffix} />
        ))}
      </div>

      <div className="grid-2-1">
        <Panel title={tr('Revenue', 'வருவாய்')} icon="trendUp"
          sub={range === 'today' ? tr('By hour, compared with yesterday', 'மணி வாரியாக, நேற்றுடன் ஒப்பிட்டு') : tr('By day, compared with the previous period', 'நாள் வாரியாக, முந்தைய காலத்துடன்')}
          action={<span className="legend-inline"><i className="sw gold" />{t(`range.${range}`)}<i className="sw dash" />{tr('Previous', 'முந்தையது')}</span>}>
          <AreaChart data={s.map((d) => ({ label: d.label, value: d.revenue, prev: d.prevRevenue }))} height={290}
            format={money} axis={shortMoney} labelOf={labelOf} valueLabel={t('kpi.revenue')} prevLabel={tr('Previous', 'முந்தையது')} />
        </Panel>
        <LivePanel live={data.live} />
      </div>

      <div className="grid-2-1">
        <Panel title={tr('Busy hours', 'பரபரப்பான நேரங்கள்')} sub={tr('Orders by weekday and hour, last 4 weeks', 'கடந்த 4 வாரங்கள் — நாள் & மணி வாரியாக ஆர்டர்கள்')} icon="clock">
          <Heatmap heat={data.heat} dayName={(d) => L.dayName(d)} hourLabel={hourLabel} unit={tr('orders', 'ஆர்டர்கள்')} />
        </Panel>
        <Panel title={tr('Sales by category', 'பிரிவு வாரியான விற்பனை')} icon="layers">
          {segs.length ? <Donut segments={segs} center={shortMoney(catTotal)} sub={t(`range.${range}`)} /> : <EmptyMini />}
        </Panel>
      </div>

      <div className="grid-3">
        <Panel title={tr('Top dishes', 'அதிகம் விற்ற உணவுகள்')} icon="flame" action={<Link to="/reports" className="btn btn-ghost btn-xs">{t('viewAll')}</Link>}>
          {data.topItems.length ? (
            <BarList rows={data.topItems.slice(0, 6).map((it) => ({
              key: it.id, label: pick(it, 'name'), image: it.image || '', value: it.qty,
              display: `${it.qty} · ${money(it.revenue)}`,
            }))} />
          ) : <EmptyMini />}
        </Panel>
        <Panel title={tr('How people order', 'ஆர்டர் செய்யும் விதம்')} icon="phoneDevice">
          <Split label={tr('Payment', 'பணம் செலுத்துதல்')} parts={[
            { key: 'cash', label: t('pay.cash'), v: data.payments.cash, color: '#d62b1e' },
            { key: 'upi', label: t('pay.upi'), v: data.payments.upi, color: '#2e4a8a' },
          ]} money={money} />
          <Split label={tr('Channel', 'வழி')} parts={[
            { key: 'online', label: t('source.online'), v: data.sources.online, color: '#d62b1e' },
            { key: 'counter', label: t('source.counter'), v: data.sources.counter, color: '#1f7a45' },
            { key: 'phone', label: t('source.phone'), v: data.sources.phone, color: '#f5b323' },
          ]} money={money} />
          <Split label={tr('Order type', 'ஆர்டர் வகை')} parts={[
            { key: 'delivery', label: t('type.delivery'), v: data.types.delivery, color: '#2e4a8a' },
            { key: 'pickup', label: t('type.pickup'), v: data.types.pickup, color: '#d62b1e' },
          ]} money={money} />
          <div className="mini-stats">
            <div><span className="subtle">{t('kpi.avgPrepMins')}</span><b className="num">{data.kpis.avgPrepMins.value ?? '—'}{data.kpis.avgPrepMins.value ? tr(' min', ' நிமி') : ''}</b></div>
            <div><span className="subtle">{t('kpi.cancelRate')}</span><b className="num">{data.kpis.cancelRate.value}%</b></div>
            <div><span className="subtle">{tr('Discounts given', 'வழங்கிய தள்ளுபடி')}</span><b className="num">{money(data.kpis.discounts.value)}</b></div>
          </div>
        </Panel>
        <LowStock items={data.lowStock} />
      </div>

      <div className="grid-2">
        <Panel title={tr('Latest reviews', 'சமீபத்திய மதிப்புரைகள்')} icon="message" action={<Link to="/reviews" className="btn btn-ghost btn-xs">{t('viewAll')}</Link>}>
          {data.reviews.length ? (
            <ul className="mini-reviews">
              {data.reviews.map((r) => (
                <li key={r.id}>
                  <div className="row"><Stars value={r.food} size={14} /><b className="grow ellipsis">{r.customerName}</b><span className="subtle small">#{r.number}</span></div>
                  {r.review ? <p>“{r.review}”</p> : <p className="subtle">{tr('No comment', 'கருத்து இல்லை')}</p>}
                </li>
              ))}
            </ul>
          ) : <EmptyMini />}
        </Panel>
        <Panel title={t('activity')} icon="activity" sub={settings?.name}>
          <ActivityList entries={activity} limit={8} />
        </Panel>
      </div>
    </>
  );
}

function EmptyMini() {
  const { t } = useLang();
  return <div className="empty" style={{ padding: 24 }}><Icon name="plate" size={30} /><span>{t('noData')}</span></div>;
}

function Split({ label, parts, money }) {
  const total = parts.reduce((s, p) => s + (p.v?.count || 0), 0) || 1;
  return (
    <div className="split">
      <div className="split-label subtle">{label}</div>
      <div className="split-bar">
        {parts.map((p, i) => (
          <motion.span key={p.key} style={{ background: p.color }} initial={{ width: 0 }} animate={{ width: `${((p.v?.count || 0) / total) * 100}%` }}
            transition={{ duration: 0.9, delay: 0.15 + i * 0.1, ease: [0.22, 1, 0.36, 1] }} />
        ))}
      </div>
      <div className="split-legend">
        {parts.map((p) => (
          <span key={p.key}><i style={{ background: p.color }} />{p.label} <b className="num">{Math.round(((p.v?.count || 0) / total) * 100)}%</b>
            <span className="subtle num"> · {money(p.v?.revenue || 0)}</span></span>
        ))}
      </div>
    </div>
  );
}

function LivePanel({ live: lv }) {
  const L = useLang();
  const { t, tr, money } = L;
  const statuses = ['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery'];
  const max = Math.max(1, ...statuses.map((x) => lv.byStatus[x]));
  const activeTotal = statuses.reduce((a, x) => a + lv.byStatus[x], 0);
  return (
    <motion.section className="panel live-panel" variants={rise}>
      <div className="panel-head">
        <span className="panel-icon pulse"><Icon name="zap" size={17} /></span>
        <div className="grow"><h3>{tr('Right now', 'இப்போது')}</h3><p className="subtle">{tr(`${activeTotal} orders in progress`, `${activeTotal} ஆர்டர்கள் நடப்பில்`)}</p></div>
        <Link to="/live" className="btn btn-gold btn-xs">{t('nav.live')} <Icon name="arrowRight" size={13} /></Link>
      </div>
      <div className="panel-body">
        <ul className="live-status">
          {statuses.map((x) => (
            <li key={x}>
              <span className="badge" data-tone={STATUS_TONE[x]}><span className="dot" />{t(`status.${x}`)}</span>
              <span className="live-track"><motion.i data-tone={STATUS_TONE[x]} initial={{ width: 0 }} animate={{ width: `${(lv.byStatus[x] / max) * 100}%` }} transition={{ duration: 0.8 }} /></span>
              <b className="num">{lv.byStatus[x]}</b>
            </li>
          ))}
        </ul>
        <div className="live-riders">
          <div><Icon name="scooter" size={18} /><span className="subtle">{tr('Riders online', 'ஆன்லைன் பார்ட்னர்கள்')}</span><b className="num">{lv.ridersOnline}<small>/{lv.ridersTotal}</small></b></div>
          <div><Icon name="route" size={18} /><span className="subtle">{tr('On a delivery', 'டெலிவரியில்')}</span><b className="num">{lv.ridersBusy}</b></div>
          <div><Icon name="cash" size={18} /><span className="subtle">{tr('Cash with riders', 'பார்ட்னர்களிடம் ரொக்கம்')}</span><b className="num">{money(lv.cashWithRiders)}</b></div>
        </div>
        <div className="row quick-links">
          <Link to="/pos" className="btn btn-primary btn-sm grow"><Icon name="plus" size={15} />{t('nav.pos')}</Link>
          <Link to="/kitchen" className="btn btn-soft btn-sm"><Icon name="chefHat" size={15} />{tr('Kitchen', 'சமையலறை')}</Link>
        </div>
      </div>
    </motion.section>
  );
}

function LowStock({ items }) {
  const L = useLang();
  const { t, tr, pick } = L;
  const restock = async (it) => {
    try {
      await api.put(`/admin/menu/${it.id}`, { stock: it.dailyStock });
      toast.success(tr(`${it.name} restocked`, `${it.nameTa || it.name} இருப்பு நிரப்பப்பட்டது`));
    } catch (e) { toast.error(L.error(e)); }
  };
  const liveItems = useLive((s) => s.items);
  const rows = useMemo(() => items.map((it) => liveItems.find((m) => m.id === it.id) || it)
    .filter((m) => m.stock <= Math.max(3, Math.ceil(m.dailyStock * 0.15))), [items, liveItems]);
  return (
    <Panel title={tr('Running low', 'இருப்பு குறைவு')} icon="alert" action={<Link to="/menu" className="btn btn-ghost btn-xs">{t('nav.menu')}</Link>}>
      {rows.length === 0 ? (
        <div className="empty" style={{ padding: 22 }}><Icon name="checkCircle" size={30} /><span>{tr('Everything is well stocked', 'அனைத்தும் போதுமான இருப்பில்')}</span></div>
      ) : (
        <ul className="low-stock">
          {rows.slice(0, 6).map((m) => (
            <li key={m.id}>
              {m.image ? <img src={m.image} alt="" loading="lazy" /> : <span className="barlist-ph" />}
              <div className="grow">
                <b className="ellipsis">{pick(m, 'name')}</b>
                <span className={`subtle small ${m.stock === 0 ? 'danger-text' : ''}`}>{m.stock === 0 ? t('soldOut') : tr(`${m.stock} of ${m.dailyStock} left`, `${m.dailyStock}இல் ${m.stock} மீதம்`)}</span>
              </div>
              <button className="btn btn-soft btn-xs" onClick={() => restock(m)}><Icon name="refresh" size={13} />{tr('Refill', 'நிரப்பு')}</button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
