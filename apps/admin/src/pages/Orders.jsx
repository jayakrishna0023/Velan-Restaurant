// Every order, filterable, with CSV export.
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Seg, StatusBadge, toast, Empty } from '@velan/shared/components/ui.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { useAsync, useDebounced } from '@velan/shared/hooks.js';
import { dayKey } from '@velan/shared/domain.js';
import { api } from '../api.js';
import { onOrder } from '../state/live.js';
import { openOrder } from '../state/ui.js';
import { Page, PageHead, Panel, SkeletonRows } from '../components/common.jsx';
import { PayBadge, TypeBadge } from '../components/orderBits.jsx';
import { saveText, toCsv } from '../lib/files.js';

const PAGE = 25;
const day = (n) => dayKey(Date.now() - n * 864e5);

export default function Orders() {
  const L = useLang();
  const { t, tr, money } = L;
  const [preset, setPreset] = useState('7d');
  const [from, setFrom] = useState(day(6));
  const [to, setTo] = useState(day(0));
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const dq = useDebounced(q, 300);

  const applyPreset = (p) => {
    setPreset(p);
    if (p === 'today') { setFrom(day(0)); setTo(day(0)); }
    if (p === 'yesterday') { setFrom(day(1)); setTo(day(1)); }
    if (p === '7d') { setFrom(day(6)); setTo(day(0)); }
    if (p === '30d') { setFrom(day(29)); setTo(day(0)); }
  };
  useEffect(() => { setPage(0); }, [from, to, status, source, dq]);

  const query = useMemo(() => {
    const p = new URLSearchParams({ from, to, limit: String(PAGE), offset: String(page * PAGE) });
    if (status) p.set('status', status);
    if (source) p.set('source', source);
    if (dq) p.set('q', dq);
    return p.toString();
  }, [from, to, status, source, dq, page]);
  const { data, loading, setData } = useAsync(() => api.get(`/orders?${query}`), [query]);

  useEffect(() => onOrder((o) => setData((d) => (d ? { ...d, orders: d.orders.map((x) => (x.id === o.id ? { ...x, ...o } : x)) } : d))), [setData]);

  const exportCsv = async () => {
    try {
      const p = new URLSearchParams(query);
      p.set('limit', '500');
      p.set('offset', '0');
      const all = await api.get(`/orders?${p}`);
      const csv = toCsv(all.orders, [
        { label: 'Order', value: (o) => o.number },
        { label: 'Date', value: (o) => o.day },
        { label: 'Time', value: (o) => L.time(o.createdAt) },
        { label: 'Customer', value: (o) => o.customerName },
        { label: 'Phone', value: (o) => o.phone },
        { label: 'Type', value: (o) => o.type },
        { label: 'Source', value: (o) => o.source },
        { label: 'Status', value: (o) => o.status },
        { label: 'Items', value: (o) => o.items.map((i) => `${i.qty}x ${i.name}`).join('; ') },
        { label: 'Subtotal', value: (o) => o.bill.subtotal },
        { label: 'Delivery fee', value: (o) => o.bill.deliveryFee },
        { label: 'Discount', value: (o) => o.bill.discount },
        { label: 'Coupon', value: (o) => o.bill.couponCode || '' },
        { label: 'Tax', value: (o) => o.bill.tax },
        { label: 'Total', value: (o) => o.bill.total },
        { label: 'Payment', value: (o) => o.payment.method },
        { label: 'Paid', value: (o) => o.payment.status },
        { label: 'Rider', value: (o) => o.rider?.name || '' },
        { label: 'Distance km', value: (o) => o.distanceKm ?? '' },
      ]);
      saveText(`velan-orders-${from}-to-${to}.csv`, csv);
      toast.success(tr(`Exported ${all.orders.length} orders`, `${all.orders.length} ஆர்டர்கள் பதிவிறக்கப்பட்டன`));
    } catch (e) { toast.error(L.error(e)); }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;
  return (
    <Page>
      <PageHead title={t('nav.orders')} sub={data ? tr(`${data.total} orders found`, `${data.total} ஆர்டர்கள்`) : ' '}>
        <button className="btn btn-outline btn-sm" onClick={exportCsv}><Icon name="download" size={15} />{t('exportCsv')}</button>
      </PageHead>

      <Panel pad={false}>
        <div className="filters">
          <Seg size="sm" value={preset} onChange={applyPreset} options={[
            { value: 'today', label: t('today') }, { value: 'yesterday', label: t('yesterday') },
            { value: '7d', label: t('range.7d') }, { value: '30d', label: t('range.30d') },
          ]} />
          <div className="date-range">
            <input type="date" className="input input-sm" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPreset(''); }} />
            <span className="subtle">→</span>
            <input type="date" className="input input-sm" value={to} min={from} onChange={(e) => { setTo(e.target.value); setPreset(''); }} />
          </div>
          <select className="select input-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{tr('All statuses', 'அனைத்து நிலைகள்')}</option>
            {['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'rejected', 'cancelled'].map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </select>
          <select className="select input-sm" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">{tr('All channels', 'அனைத்து வழிகள்')}</option>
            {['online', 'counter', 'phone'].map((s) => <option key={s} value={s}>{t(`source.${s}`)}</option>)}
          </select>
          <div className="input-group grow" style={{ minWidth: 200 }}>
            <Icon name="search" size={16} className="icon" />
            <input className="input input-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Order no., name or phone', 'ஆர்டர் எண், பெயர், போன்')} />
          </div>
        </div>

        {!data && loading ? <div style={{ padding: 20 }}><SkeletonRows rows={8} /></div> : data?.orders.length === 0 ? (
          <Empty icon="receipt" title={tr('No orders match', 'பொருந்தும் ஆர்டர்கள் இல்லை')}>{tr('Try a different date range or filter.', 'வேறு தேதி அல்லது வடிகட்டியை முயற்சிக்கவும்.')}</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th><th>{tr('When', 'நேரம்')}</th><th>{t('customer')}</th><th>{tr('Items', 'பொருட்கள்')}</th>
                  <th>{tr('Type', 'வகை')}</th><th className="r">{t('total')}</th><th>{tr('Payment', 'பணம்')}</th><th>{tr('Status', 'நிலை')}</th><th>{t('rider')}</th>
                </tr>
              </thead>
              <tbody className={loading ? 'loading' : ''}>
                {data?.orders.map((o, i) => (
                  <motion.tr key={o.id} onClick={() => openOrder(o.id)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.012 }}>
                    <td><b className="num">#{o.number}</b></td>
                    <td className="nowrap"><span>{L.date(o.createdAt)}</span><span className="subtle small block">{L.time(o.createdAt)}</span></td>
                    <td><b>{o.customerName}</b><span className="subtle small block num">{o.phone}</span></td>
                    <td className="items-cell"><span className="clamp-2">{o.items.map((i) => `${i.qty}× ${L.pick(i, 'name')}`).join(', ')}</span></td>
                    <td><TypeBadge order={o} /><span className="subtle small block">{t(`source.${o.source}`)}</span></td>
                    <td className="r num"><b>{money(o.bill.total)}</b>{o.bill.discount > 0 && <span className="subtle small block">−{money(o.bill.discount)}</span>}</td>
                    <td><PayBadge order={o} /></td>
                    <td><StatusBadge order={o} /></td>
                    <td className="subtle">{o.rider?.name || '—'}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > PAGE && (
          <div className="pager">
            <button className="btn btn-soft btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}><Icon name="chevronLeft" size={15} />{tr('Previous', 'முந்தையது')}</button>
            <span className="subtle num">{page + 1} / {pages}</span>
            <button className="btn btn-soft btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>{t('next')}<Icon name="chevronRight" size={15} /></button>
          </div>
        )}
      </Panel>
    </Page>
  );
}
