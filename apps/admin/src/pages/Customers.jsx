// Customer list with segments (VIP, regulars, at risk…) and a profile drawer.
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Sheet, StatusBadge, Empty } from '@velan/shared/components/ui.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { useAsync, useDebounced } from '@velan/shared/hooks.js';
import { api } from '../api.js';
import { openOrder } from '../state/ui.js';
import { Avatar, Page, PageHead, Panel, SkeletonRows, tel, whatsapp } from '../components/common.jsx';

const SEGMENTS = ['all', 'vip', 'regular', 'new', 'at_risk', 'occasional'];
const TONE = { vip: 'gold', regular: 'leaf', new: 'blue', at_risk: 'maroon', occasional: 'muted' };

export default function Customers() {
  const L = useLang();
  const { t, tr, money } = L;
  const [segment, setSegment] = useState('all');
  const [sort, setSort] = useState('spent');
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const [open, setOpen] = useState(null);
  const { data, loading } = useAsync(() => api.get(`/admin/customers?segment=${segment}&sort=${sort}&q=${encodeURIComponent(dq)}`), [segment, sort, dq]);
  const [limit, setLimit] = useState(60);

  const hint = {
    vip: tr('12+ orders or ₹6,000+ spent', '12+ ஆர்டர்கள் அல்லது ₹6,000+ செலவு'),
    regular: tr('4 or more orders', '4 அல்லது அதற்கு மேல் ஆர்டர்கள்'),
    new: tr('First order in the last 2 weeks', 'கடந்த 2 வாரத்தில் முதல் ஆர்டர்'),
    at_risk: tr('Used to order, quiet for 3+ weeks — send them an offer', 'முன்பு ஆர்டர் செய்தவர்கள், 3+ வாரம் இல்லை — சலுகை அனுப்புங்கள்'),
    occasional: tr('Orders now and then', 'அவ்வப்போது ஆர்டர் செய்பவர்கள்'),
  };

  return (
    <Page>
      <PageHead title={t('nav.customers')} sub={data ? tr(`${data.counts.all} customers`, `${data.counts.all} வாடிக்கையாளர்கள்`) : ' '} />
      <div className="segment-tabs">
        {SEGMENTS.map((s) => (
          <button key={s} className={`segment-tab ${segment === s ? 'on' : ''}`} data-tone={TONE[s]} onClick={() => setSegment(s)}>
            {segment === s && <motion.span layoutId="seg-tab" className="segment-tab-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <span>{t(`seg.${s}`)}</span>
            <b className="num">{data?.counts[s] ?? 0}</b>
          </button>
        ))}
      </div>
      {segment !== 'all' && <p className="segment-hint subtle"><Icon name="info" size={14} /> {hint[segment]}</p>}

      <Panel pad={false}>
        <div className="filters">
          <div className="input-group grow" style={{ maxWidth: 360 }}>
            <Icon name="search" size={16} className="icon" />
            <input className="input input-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Name or phone', 'பெயர் அல்லது போன்')} />
          </div>
          <select className="select input-sm" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="spent">{tr('Top spenders', 'அதிகம் செலவு செய்தவர்')}</option>
            <option value="orders">{tr('Most orders', 'அதிக ஆர்டர்கள்')}</option>
            <option value="recent">{tr('Recently ordered', 'சமீபத்தில் ஆர்டர் செய்தவர்')}</option>
            <option value="name">{tr('Name', 'பெயர்')}</option>
          </select>
        </div>
        {!data ? <div style={{ padding: 20 }}><SkeletonRows rows={8} /></div> : data.customers.length === 0 ? (
          <Empty icon="users" title={tr('No customers here', 'இங்கு வாடிக்கையாளர்கள் இல்லை')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('customer')}</th><th>{tr('Segment', 'பிரிவு')}</th><th className="r">{tr('Orders', 'ஆர்டர்கள்')}</th>
                  <th className="r">{tr('Spent', 'செலவு')}</th><th className="r">{tr('Avg. order', 'சராசரி')}</th><th>{tr('Last order', 'கடைசி ஆர்டர்')}</th><th>{tr('Rating', 'மதிப்பீடு')}</th>
                </tr>
              </thead>
              <tbody className={loading ? 'loading' : ''}>
                {data.customers.slice(0, limit).map((c) => (
                  <tr key={c.key} onClick={() => setOpen(c.key)}>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <Avatar name={c.name} size={34} />
                        <div><b>{c.name}</b><span className="subtle small block num">{c.phone}{!c.registered && <span> · {tr('counter', 'கவுண்டர்')}</span>}</span></div>
                      </div>
                    </td>
                    <td><span className="badge" data-tone={TONE[c.segment]}>{t(`seg.${c.segment}`)}</span></td>
                    <td className="r num">{c.orders}</td>
                    <td className="r num"><b>{money(c.spent)}</b></td>
                    <td className="r num">{money(c.aov)}</td>
                    <td className="subtle">{c.lastAt ? L.relative(c.lastAt) : '—'}</td>
                    <td>{c.avgRating ? <span className="num">{c.avgRating} ★</span> : <span className="subtle">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.customers.length > limit && (
              <div className="pager"><button className="btn btn-soft btn-sm" onClick={() => setLimit(limit + 60)}>{tr('Show more', 'மேலும் காட்டு')}</button></div>
            )}
          </div>
        )}
      </Panel>
      <CustomerSheet id={open} onClose={() => setOpen(null)} />
    </Page>
  );
}

function CustomerSheet({ id, onClose }) {
  const L = useLang();
  const { t, tr, money, pick } = L;
  const { data } = useAsync(() => (id ? api.get(`/admin/customers/${encodeURIComponent(id)}`) : Promise.resolve(null)), [id]);
  const c = data?.customer;
  const firstName = c?.name?.split(' ')[0] || '';
  const offerText = tr(`Vanakkam ${firstName}! We miss you at Velan Biryani Center. Use code VELAN50 for ₹50 off your next order.`, `வணக்கம் ${firstName}! வேலன் பிரியாணி சென்டர் உங்களை நினைக்கிறது. அடுத்த ஆர்டருக்கு VELAN50 குறியீட்டில் ₹50 தள்ளுபடி.`);
  const stats = useMemo(() => (c ? [
    [tr('Lifetime value', 'மொத்த மதிப்பு'), money(c.spent)],
    [tr('Orders', 'ஆர்டர்கள்'), c.orders],
    [tr('Avg. order', 'சராசரி'), money(c.aov)],
    [tr('Customer since', 'முதல் ஆர்டர்'), c.firstAt ? L.date(c.firstAt) : '—'],
  ] : []), [c, L, money, tr]);
  return (
    <Sheet open={!!id} onClose={onClose} label={c?.name}>
      <div className="sheet-head">
        <span />
        <h3 className="grow">{tr('Customer', 'வாடிக்கையாளர்')}</h3>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label={t('close')}><Icon name="x" /></button>
      </div>
      <div className="sheet-scroll">
        {!c ? <SkeletonRows rows={5} height={60} /> : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="cust-hero">
              <Avatar name={c.name} size={64} />
              <div className="grow">
                <h2 className="display">{c.name}</h2>
                <span className="subtle num">+91 {c.phone}</span>
                <div className="row" style={{ gap: 6, marginTop: 6 }}>
                  <span className="badge" data-tone={TONE[c.segment]}>{t(`seg.${c.segment}`)}</span>
                  {c.avgRating && <span className="badge" data-tone="gold">{c.avgRating} ★</span>}
                </div>
              </div>
            </div>
            <div className="row" style={{ gap: 8, margin: '14px 0' }}>
              <a className="btn btn-soft btn-sm" href={tel(c.phone)}><Icon name="phone" size={15} />{t('call')}</a>
              <a className="btn btn-leaf btn-sm" href={whatsapp(c.phone, c.segment === 'at_risk' ? offerText : '')} target="_blank" rel="noreferrer"><Icon name="chat" size={15} />WhatsApp</a>
            </div>
            <div className="cust-stats">
              {stats.map(([k, v]) => <div key={k}><span className="subtle small">{k}</span><b className="num">{v}</b></div>)}
            </div>
            {data.favorites.length > 0 && (
              <>
                <h4 className="os-label">{tr('Favourite dishes', 'விருப்ப உணவுகள்')}</h4>
                <div className="fav-list">
                  {data.favorites.map((f) => (
                    <span key={f.id} className="fav">{f.image && <img src={f.image} alt="" />}<span className="ellipsis">{pick(f, 'name')}</span><b className="num">×{f.qty}</b></span>
                  ))}
                </div>
              </>
            )}
            {data.addresses.length > 0 && (
              <>
                <h4 className="os-label">{tr('Saved addresses', 'சேமித்த முகவரிகள்')}</h4>
                <ul className="ledger-list">
                  {data.addresses.map((a) => <li key={a.id}><Icon name={a.label === 'work' ? 'work' : 'home'} size={16} /><span className="grow">{a.line}{a.landmark && <span className="subtle small block">{a.landmark}</span>}</span></li>)}
                </ul>
              </>
            )}
            <h4 className="os-label">{tr('Orders', 'ஆர்டர்கள்')}</h4>
            <ul className="ledger-list">
              {data.orders.map((o) => (
                <li key={o.id} onClick={() => openOrder(o.id)}>
                  <b className="num">#{o.number}</b>
                  <span className="grow subtle small">{L.date(o.createdAt)} · {o.items.map((i) => `${i.qty}× ${pick(i, 'name')}`).join(', ')}</span>
                  <StatusBadge order={o} />
                  <b className="num">{money(o.bill.total)}</b>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </div>
    </Sheet>
  );
}
