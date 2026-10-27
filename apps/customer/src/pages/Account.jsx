import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Seg, StatusBadge, Empty, LangToggle, toast, confirmDialog } from '@velan/shared/components/ui.jsx';
import { useAsync, initials } from '@velan/shared/hooks.js';
import { isActive } from '@velan/shared/domain.js';
import { api, session, useSession, requireLogin, logout } from '../state/session.js';
import { useOrders } from '../state/orders.js';
import { reorder, openCart } from '../state/cart.js';

function Orders() {
  const { t, tr, pick, money, dateTime } = useLang();
  const navigate = useNavigate();
  const { list, loaded } = useOrders((s) => s);
  if (!loaded) return <div className="stack">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 96 }} />)}</div>;
  if (!list.length) {
    return <Empty icon="receipt" title={tr('No orders yet', 'இன்னும் ஆர்டர் இல்லை')} action={<Link to="/" className="btn btn-primary">{t('exploreMenu')}</Link>}>
      {tr('Your first biryani is one tap away.', 'உங்கள் முதல் பிரியாணி ஒரு தட்டலில்.')}
    </Empty>;
  }
  return (
    <ul className="acc-orders">
      {list.map((o, i) => (
        <motion.li key={o.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}>
          <Link to={`/track/${o.id}`} className="acc-order">
            <span className="acc-imgs">{o.items.slice(0, 3).map((it) => <img key={it.id} src={it.image} alt="" />)}</span>
            <span className="grow">
              <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <strong>#{o.number}</strong>
                <StatusBadge order={o} live={isActive(o)} />
              </span>
              <small className="ellipsis" style={{ display: 'block' }}>{o.items.map((it) => `${pick(it, 'name')} × ${it.qty}`).join(', ')}</small>
              <small className="subtle">{dateTime(o.createdAt)}</small>
            </span>
            <span className="acc-order-right">
              <strong className="num">{money(o.bill.total)}</strong>
              {isActive(o) ? (
                <span className="btn btn-xs btn-gold">{t('trackLive')}</span>
              ) : (
                <button type="button" className="btn btn-xs btn-soft" onClick={(e) => { e.preventDefault(); reorder(o.items); navigate('/'); openCart(true); }}>
                  <Icon name="refresh" size={13} /> {t('orderAgain')}
                </button>
              )}
            </span>
          </Link>
        </motion.li>
      ))}
    </ul>
  );
}

function Addresses() {
  const { t, tr } = useLang();
  const { data, loading, setData } = useAsync(() => api.get('/me/addresses'), []);
  if (loading && !data) return <div className="skeleton" style={{ height: 120 }} />;
  if (!data?.length) return <Empty icon="pin" title={tr('No saved addresses', 'சேமித்த முகவரி இல்லை')}>{tr('Addresses you save at checkout appear here.', 'செக்அவுட்டில் சேமிக்கும் முகவரிகள் இங்கே வரும்.')}</Empty>;
  const remove = async (a) => {
    if (!(await confirmDialog({ title: tr('Delete this address?', 'இந்த முகவரியை நீக்கவா?'), body: a.line, tone: 'danger', confirmLabel: t('delete') }))) return;
    await api.del(`/me/addresses/${a.id}`);
    setData((list) => list.filter((x) => x.id !== a.id));
  };
  return (
    <ul className="acc-addrs">
      <AnimatePresence>
        {data.map((a) => (
          <motion.li key={a.id} layout exit={{ opacity: 0, x: -20 }} className="card acc-addr">
            <span className="addr-icon"><Icon name={a.label === 'work' ? 'work' : a.label === 'home' ? 'home' : 'pin'} size={18} /></span>
            <span className="grow"><strong>{t(`label.${a.label}`)}</strong><small>{a.line}{a.landmark ? ` · ${a.landmark}` : ''}</small></span>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(a)} aria-label={t('delete')}><Icon name="trash" size={17} /></button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function Settings() {
  const { t, tr, error } = useLang();
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const [name, setName] = useState(user.name);
  const [pw, setPw] = useState({ current: '', next: '' });
  const saveName = async (e) => {
    e.preventDefault();
    try { const { user: u } = await api.put('/me', { name }); session.set({ user: u }); toast.success(t('saved')); } catch (ex) { toast.error(error(ex)); }
  };
  const savePw = async (e) => {
    e.preventDefault();
    try { await api.post('/auth/password', pw); setPw({ current: '', next: '' }); toast.success(t('saved')); } catch (ex) { toast.error(error(ex)); }
  };
  return (
    <div className="acc-settings">
      <form className="card acc-form" onSubmit={saveName}>
        <label className="field"><span className="field-label">{t('name')}</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <button className="btn btn-primary btn-sm" type="submit">{t('save')}</button>
      </form>
      <div className="card acc-form">
        <span className="field-label">{t('language')}</span>
        <LangToggle />
      </div>
      <form className="card acc-form" onSubmit={savePw}>
        <label className="field"><span className="field-label">{tr('Current password', 'தற்போதைய கடவுச்சொல்')}</span><input className="input" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></label>
        <label className="field"><span className="field-label">{tr('New password', 'புதிய கடவுச்சொல்')}</span><input className="input" type="password" minLength={6} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required /></label>
        <button className="btn btn-outline btn-sm" type="submit">{tr('Change password', 'கடவுச்சொல்லை மாற்று')}</button>
      </form>
      <button type="button" className="btn btn-danger" onClick={async () => { await logout(); navigate('/'); }}><Icon name="logout" size={17} /> {t('logout')}</button>
    </div>
  );
}

export default function Account() {
  const { t, tr, money } = useLang();
  const user = useSession((s) => s.user);
  const ready = useSession((s) => s.ready);
  const list = useOrders((s) => s.list);
  const [tab, setTab] = useState('orders');
  useEffect(() => { if (ready && !user) requireLogin(); }, [ready, user]);
  if (!user) return <div className="page-loading"><span className="spinner" /></div>;
  const done = list.filter((o) => o.status === 'delivered');
  return (
    <section className="page account">
      <div className="container narrow">
        <motion.div className="acc-head" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <span className="avatar acc-avatar">{initials(user.name)}</span>
          <div className="grow">
            <p className="eyebrow">{tr('Vanakkam', 'வணக்கம்')}</p>
            <h1 className="display">{user.name}</h1>
            <p className="subtle">+91 {user.phone}</p>
          </div>
          <dl className="acc-stats">
            <div><dt className="display num">{done.length}</dt><dd>{tr('meals', 'உணவுகள்')}</dd></div>
            <div><dt className="display num">{money(done.reduce((s, o) => s + o.bill.total, 0))}</dt><dd>{tr('spent', 'செலவு')}</dd></div>
          </dl>
        </motion.div>
        <div style={{ height: 34 }} />
        <Seg value={tab} onChange={setTab} className="acc-tabs"
          options={[{ value: 'orders', label: t('nav.orders'), icon: 'receipt' }, { value: 'addresses', label: tr('Addresses', 'முகவரிகள்'), icon: 'pin' }, { value: 'settings', label: tr('Settings', 'அமைப்புகள்'), icon: 'sliders' }]} />
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }} className="acc-panel">
            {tab === 'orders' && <Orders />}
            {tab === 'addresses' && <Addresses />}
            {tab === 'settings' && <Settings />}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
