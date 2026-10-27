// Kitchen display: big tickets for the cooks, readable from across the room.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { VelMark, VelSeal } from '@velan/shared/components/Brand.jsx';
import { LangToggle } from '@velan/shared/components/ui.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { useNow } from '@velan/shared/hooks.js';
import { useLive } from '../state/live.js';
import { Age, ItemLines, ReadyTimer, useOrderActions, actionLabel, clock } from '../components/orderBits.jsx';

export default function Kitchen() {
  const L = useLang();
  const { t, tr } = L;
  const active = useLive((s) => s.active);
  const root = useRef(null);
  const [full, setFull] = useState(false);
  const now = useNow(1000);
  const tickets = useMemo(() => active.filter((o) => ['accepted', 'preparing'].includes(o.status))
    .sort((a, b) => (a.readyBy || a.createdAt).localeCompare(b.readyBy || b.createdAt)), [active]);
  const waiting = active.filter((o) => o.status === 'placed').length;
  const ready = active.filter((o) => o.status === 'ready').length;

  // Totals of every dish still to cook.
  const totals = useMemo(() => {
    const m = new Map();
    for (const o of tickets) for (const i of o.items) {
      const cur = m.get(i.id) || { ...i, qty: 0 };
      cur.qty += i.qty;
      m.set(i.id, cur);
    }
    return [...m.values()].sort((a, b) => b.qty - a.qty);
  }, [tickets]);

  useEffect(() => {
    const fn = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', fn);
    return () => document.removeEventListener('fullscreenchange', fn);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else root.current?.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="kds" ref={root} data-theme="dark">
      <header className="kds-head">
        <Link to="/live" className="btn btn-ghost btn-icon btn-sm" aria-label={t('back')}><Icon name="arrowLeft" /></Link>
        <VelMark size={34} />
        <div className="grow">
          <h1>{t('nav.kitchen')}</h1>
          <span className="subtle">{L.time(new Date(now))}</span>
        </div>
        <div className="kds-stats">
          <span className={waiting ? 'hot' : ''}><b className="num">{waiting}</b>{tr('waiting', 'காத்திருப்பு')}</span>
          <span><b className="num">{tickets.length}</b>{tr('cooking', 'சமையலில்')}</span>
          <span><b className="num">{ready}</b>{tr('ready', 'தயார்')}</span>
        </div>
        <LangToggle />
        <button className="btn btn-soft btn-sm" onClick={toggleFull}><Icon name="maximize" size={16} />{full ? tr('Exit full screen', 'முழுத்திரை வெளியேறு') : tr('Full screen', 'முழுத்திரை')}</button>
      </header>

      {totals.length > 0 && (
        <div className="kds-totals">
          <span className="subtle">{tr('To cook', 'சமைக்க வேண்டியவை')}:</span>
          {totals.map((i) => <span key={i.id} className="kds-total"><b className="num">{i.qty}</b>{L.pick(i, 'name')}</span>)}
        </div>
      )}

      {tickets.length === 0 ? (
        <div className="kds-empty">
          <VelSeal size={130} draw />
          <h2>{tr('All caught up', 'அனைத்தும் முடிந்தது')}</h2>
          <p className="subtle">{waiting ? tr(`${waiting} new order(s) waiting to be accepted at the counter`, `${waiting} புதிய ஆர்டர்(கள்) கவுண்டரில் ஏற்கக் காத்திருக்கின்றன`) : tr('New tickets appear here the moment an order is accepted.', 'ஆர்டர் ஏற்கப்பட்டதும் டிக்கெட் இங்கே தோன்றும்.')}</p>
        </div>
      ) : (
        <div className="kds-grid">
          <AnimatePresence>
            {tickets.map((o) => <Ticket key={o.id} order={o} now={now} />)}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function Ticket({ order, now }) {
  const { t, tr } = useLang();
  const act = useOrderActions();
  const [busy, setBusy] = useState(false);
  const next = order.status === 'accepted' ? 'preparing' : 'ready';
  const late = order.readyBy && new Date(order.readyBy) < now;
  return (
    <motion.article layout className={`ticket ${order.status} ${late ? 'late' : ''}`}
      initial={{ opacity: 0, y: 30, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, scale: 0.9, y: -20, transition: { duration: 0.25 } }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
      <div className="ticket-head">
        <b className="ticket-num">#{order.number}</b>
        <span className={`badge`} data-tone={order.type === 'delivery' ? 'blue' : 'saffron'}>{t(`type.${order.type}`)}</span>
        <span className="grow" />
        <Age order={order} />
      </div>
      <div className="ticket-who subtle">{order.customerName} · {t(`source.${order.source}`)}</div>
      <ItemLines items={order.items} big />
      {order.notes && <div className="ticket-note"><Icon name="alert" size={16} /> {order.notes}</div>}
      <ReadyTimer order={order} big />
      <button className={`btn btn-lg btn-block ${next === 'ready' ? 'btn-leaf' : 'btn-gold'}`} disabled={busy}
        onClick={async () => { setBusy(true); await act.setStatus(order, next); setBusy(false); }}>
        <Icon name={next === 'ready' ? 'checkCircle' : 'flame'} size={20} />
        {actionLabel(order, next, t)}
      </button>
      {order.status === 'preparing' && <span className="ticket-cooking">{tr('Cooking', 'சமைக்கிறது')} · {clock(now - new Date(order.timeline.find((e) => e.status === 'preparing')?.at || order.acceptedAt))}</span>}
    </motion.article>
  );
}
