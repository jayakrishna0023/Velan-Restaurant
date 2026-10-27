// Sales reports for any date range, with CSV export and print.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Seg, toast, Empty, AnimatedNumber } from '@velan/shared/components/ui.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { useAsync } from '@velan/shared/hooks.js';
import { dayKey } from '@velan/shared/domain.js';
import { api } from '../api.js';
import { Page, PageHead, Panel, SkeletonRows, rise } from '../components/common.jsx';
import { BarList, Columns, Donut, shortMoney } from '../charts/charts.jsx';
import { saveText, toCsv } from '../lib/files.js';

const day = (n) => dayKey(Date.now() - n * 864e5);
function monthStart() { const d = dayKey(); return `${d.slice(0, 8)}01`; }

export default function Reports() {
  const L = useLang();
  const { t, tr, money, pick } = L;
  const [preset, setPreset] = useState('30d');
  const [range, setRange] = useState({ from: day(29), to: day(0) });
  const { data, loading } = useAsync(() => api.get(`/admin/reports/sales?from=${range.from}&to=${range.to}`), [range.from, range.to]);

  const choose = (p) => {
    setPreset(p);
    const map = { today: [0, 0], yesterday: [1, 1], '7d': [6, 0], '30d': [29, 0], '90d': [89, 0] };
    if (p === 'month') setRange({ from: monthStart(), to: day(0) });
    else setRange({ from: day(map[p][0]), to: day(map[p][1]) });
  };

  const exportDays = () => {
    saveText(`velan-sales-${range.from}-to-${range.to}.csv`, toCsv(data.days, [
      { label: 'Date', value: (d) => d.day }, { label: 'Orders', value: (d) => d.orders }, { label: 'Item total', value: (d) => d.subtotal },
      { label: 'Discount', value: (d) => d.discount }, { label: 'Delivery fees', value: (d) => d.deliveryFees }, { label: 'Packing', value: (d) => d.packing },
      { label: 'GST', value: (d) => d.tax }, { label: 'Revenue', value: (d) => d.revenue }, { label: 'Cash', value: (d) => d.cash },
      { label: 'UPI', value: (d) => d.upi }, { label: 'Cancelled', value: (d) => d.cancelled },
    ]));
    toast.success(t('exportCsv'));
  };
  const exportItems = () => {
    saveText(`velan-dishes-${range.from}-to-${range.to}.csv`, toCsv(data.items, [
      { label: 'Dish', value: (i) => i.name }, { label: 'Dish (Tamil)', value: (i) => i.nameTa }, { label: 'Plates', value: (i) => i.qty }, { label: 'Revenue', value: (i) => i.revenue },
    ]));
    toast.success(t('exportCsv'));
  };

  const tt = data?.totals || {};
  const cards = data ? [
    ['rupee', tr('Revenue', 'வருவாய்'), tt.revenue || 0, money],
    ['receipt', tr('Orders', 'ஆர்டர்கள்'), tt.orders || 0, (v) => Math.round(v)],
    ['bag', tr('Avg. order', 'சராசரி ஆர்டர்'), data.kpis.aov, money],
    ['tag', tr('Discounts', 'தள்ளுபடிகள்'), tt.discount || 0, money],
    ['scooter', tr('Delivery fees', 'டெலிவரி கட்டணம்'), tt.deliveryFees || 0, money],
    ['percent', tr('GST collected', 'வசூலித்த ஜிஎஸ்டி'), tt.tax || 0, money],
  ] : [];

  return (
    <Page className="reports-page">
      <PageHead title={t('nav.reports')} sub={`${L.date(`${range.from}T06:00:00Z`)} → ${L.date(`${range.to}T06:00:00Z`)}`}>
        <button className="btn btn-outline btn-sm" onClick={() => window.print()}><Icon name="printer" size={15} />{tr('Print', 'அச்சிடு')}</button>
        <button className="btn btn-primary btn-sm" disabled={!data} onClick={exportDays}><Icon name="download" size={15} />{t('exportCsv')}</button>
      </PageHead>

      <div className="filters report-filters">
        <Seg size="sm" value={preset} onChange={choose} options={[
          { value: 'today', label: t('today') }, { value: 'yesterday', label: t('yesterday') }, { value: '7d', label: t('range.7d') },
          { value: 'month', label: tr('This month', 'இந்த மாதம்') }, { value: '30d', label: t('range.30d') }, { value: '90d', label: t('range.90d') },
        ]} />
        <div className="date-range">
          <input type="date" className="input input-sm" value={range.from} max={range.to} onChange={(e) => { setPreset(''); setRange({ ...range, from: e.target.value }); }} />
          <span className="subtle">→</span>
          <input type="date" className="input input-sm" value={range.to} min={range.from} max={day(0)} onChange={(e) => { setPreset(''); setRange({ ...range, to: e.target.value }); }} />
        </div>
      </div>

      {!data ? <SkeletonRows rows={4} height={110} /> : (
        <>
          <div className="report-cards">
            {cards.map(([icon, label, v, fmt]) => (
              <motion.div key={label} className="report-card" variants={rise}>
                <Icon name={icon} size={18} />
                <span className="subtle">{label}</span>
                <b className="num"><AnimatedNumber value={v} format={fmt} /></b>
              </motion.div>
            ))}
          </div>

          <div className="grid-2-1">
            <Panel title={tr('Revenue by day', 'நாள் வாரியான வருவாய்')} icon="chart" className={loading ? 'is-loading' : ''}>
              {data.days.length ? (
                <Columns data={data.days.map((d) => ({ label: d.day, value: d.revenue, sub: tr(`${d.orders} orders`, `${d.orders} ஆர்டர்கள்`) }))}
                  format={money} axis={shortMoney} labelOf={(d, i, long) => L.date(`${d.label}T06:00:00Z`, { weekday: long })} height={260} />
              ) : <Empty icon="chart" title={t('noData')} />}
            </Panel>
            <Panel title={tr('Payments', 'பணம் செலுத்துதல்')} icon="wallet">
              <Donut segments={[
                { label: t('pay.cash'), value: tt.cash || 0, display: money(tt.cash || 0), color: '#d62b1e' },
                { label: t('pay.upi'), value: tt.upi || 0, display: money(tt.upi || 0), color: '#2e4a8a' },
              ]} center={shortMoney(tt.revenue || 0)} sub={tr('collected', 'வசூல்')} size={150} />
              <div className="mini-stats" style={{ marginTop: 14 }}>
                <div><span className="subtle">{tr('Cancelled / rejected', 'ரத்து / நிராகரிப்பு')}</span><b className="num">{tt.cancelled || 0}</b></div>
                <div><span className="subtle">{t('kpi.avgDeliveryMins')}</span><b className="num">{data.kpis.avgDeliveryMins ? L.mins(data.kpis.avgDeliveryMins) : '—'}</b></div>
                <div><span className="subtle">{t('kpi.rating')}</span><b className="num">{data.kpis.rating ? `${data.kpis.rating} ★` : '—'}</b></div>
              </div>
            </Panel>
          </div>

          <div className="grid-2">
            <Panel title={tr('Dish-wise sales', 'உணவு வாரியான விற்பனை')} icon="utensils" action={<button className="btn btn-ghost btn-xs" onClick={exportItems}><Icon name="download" size={13} />CSV</button>}>
              {data.items.length ? (
                <BarList rows={data.items.slice(0, 12).map((i) => ({ key: i.id, label: pick(i, 'name'), image: i.image || '', value: i.revenue, display: `${i.qty} · ${money(i.revenue)}` }))} />
              ) : <Empty icon="utensils" title={t('noData')} />}
            </Panel>
            <Panel title={tr('Daily breakdown', 'தினசரி விவரம்')} icon="calendar" pad={false}>
              <div className="table-wrap" style={{ maxHeight: 520 }}>
                <table className="table compact">
                  <thead><tr><th>{tr('Date', 'தேதி')}</th><th className="r">{tr('Orders', 'ஆர்டர்கள்')}</th><th className="r">{t('pay.cash')}</th><th className="r">{t('pay.upi')}</th><th className="r">{tr('Revenue', 'வருவாய்')}</th></tr></thead>
                  <tbody>
                    {[...data.days].reverse().map((d) => (
                      <tr key={d.day}>
                        <td>{L.date(`${d.day}T06:00:00Z`, { weekday: true })}</td>
                        <td className="r num">{d.orders}{d.cancelled ? <span className="subtle small"> (−{d.cancelled})</span> : null}</td>
                        <td className="r num">{money(d.cash)}</td>
                        <td className="r num">{money(d.upi)}</td>
                        <td className="r num"><b>{money(d.revenue)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td><b>{t('total')}</b></td><td className="r num"><b>{tt.orders || 0}</b></td><td className="r num"><b>{money(tt.cash || 0)}</b></td><td className="r num"><b>{money(tt.upi || 0)}</b></td><td className="r num"><b>{money(tt.revenue || 0)}</b></td></tr></tfoot>
                </table>
              </div>
            </Panel>
          </div>
        </>
      )}
    </Page>
  );
}
