// Kanban of every order in progress. Drag a card to move it along.
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Seg, Switch, toast } from '@velan/shared/components/ui.jsx';
import { VelMark } from '@velan/shared/components/Brand.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { allowedNext } from '@velan/shared/domain.js';
import { api } from '../api.js';
import { setSettings, useLive } from '../state/live.js';
import { openOrder } from '../state/ui.js';
import { Page, PageHead } from '../components/common.jsx';
import { AcceptBar, Age, ItemLines, NextButton, PayBadge, ReadyTimer, RiderSelect, TypeBadge, useOrderActions } from '../components/orderBits.jsx';

const COLUMNS = [
  { key: 'new', statuses: ['placed'], icon: 'bell', tone: 'saffron' },
  { key: 'kitchen', statuses: ['accepted', 'preparing'], icon: 'flame', tone: 'gold' },
  { key: 'ready', statuses: ['ready'], icon: 'package', tone: 'leaf' },
  { key: 'out', statuses: ['out_for_delivery'], icon: 'scooter', tone: 'blue' },
];

export default function LiveBoard() {
  const L = useLang();
  const { t, tr } = L;
  const active = useLive((s) => s.active);
  const settings = useLive((s) => s.settings);
  const [type, setType] = useState('all');
  const [q, setQ] = useState('');
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);
  const act = useOrderActions();

  const shown = useMemo(() => active.filter((o) => (type === 'all' || o.type === type)
    && (!q || String(o.number).includes(q.replace('#', '')) || o.customerName.toLowerCase().includes(q.toLowerCase()) || (o.phone || '').includes(q))), [active, type, q]);

  const drop = async (col) => {
    const o = active.find((x) => x.id === dragging);
    setDragging(null);
    setOver(null);
    if (!o) return;
    let target = null;
    if (col === 'kitchen') target = o.status === 'placed' ? 'accepted' : o.status === 'accepted' ? 'preparing' : null;
    if (col === 'ready') target = 'ready';
    if (col === 'out') target = o.type === 'delivery' ? 'out_for_delivery' : null;
    if (col === 'done') target = 'delivered';
    if (!target || target === o.status) return;
    if (!allowedNext(o, 'admin').includes(target)) { toast.error(t('err.BAD_TRANSITION')); return; }
    await act.setStatus(o, target, target === 'accepted' ? { prepMins: settings?.avgPrepMins } : {});
  };

  const toggleAuto = async (v) => {
    try { setSettings(await api.put('/admin/settings', { autoAssign: v })); } catch (e) { toast.error(L.error(e)); }
  };

  return (
    <Page className="board-page">
      <PageHead title={t('nav.live')} sub={tr('Drag a card to the next column, or use its button.', 'அட்டையை அடுத்த நெடுவரிசைக்கு இழுக்கவும், அல்லது பொத்தானை அழுத்தவும்.')}>
        <div className="input-group board-search">
          <Icon name="search" size={16} className="icon" />
          <input className="input input-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Order no., name or phone', 'ஆர்டர் எண், பெயர், போன்')} />
        </div>
        <Seg size="sm" value={type} onChange={setType} options={[
          { value: 'all', label: tr('All', 'அனைத்தும்') }, { value: 'delivery', label: t('type.delivery') }, { value: 'pickup', label: t('type.pickup') },
        ]} />
        <label className="auto-assign">
          <Switch checked={settings?.autoAssign} onChange={toggleAuto} label={tr('Auto-assign riders', 'தானியங்கி ஒதுக்கீடு')} />
          <span>{tr('Auto-assign', 'தானியங்கி ஒதுக்கீடு')}</span>
        </label>
        <Link to="/pos" className="btn btn-primary btn-sm"><Icon name="plus" size={15} />{t('nav.pos')}</Link>
      </PageHead>

      <div className="board">
        {COLUMNS.map((c) => {
          const list = shown.filter((o) => c.statuses.includes(o.status));
          return (
            <section key={c.key} className={`board-col tone-${c.tone} ${over === c.key ? 'over' : ''} ${dragging ? 'dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); if (over !== c.key) setOver(c.key); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); }}
              onDrop={(e) => { e.preventDefault(); drop(c.key); }}>
              <header className="board-col-head">
                <span className="col-icon"><Icon name={c.icon} size={16} /></span>
                <h3>{t(`col.${c.key}`)}</h3>
                <motion.span key={list.length} className="col-count num" initial={{ scale: 1.4 }} animate={{ scale: 1 }}>{list.length}</motion.span>
              </header>
              <div className="board-col-body">
                <AnimatePresence initial={false}>
                  {list.map((o) => (
                    <BoardCard key={o.id} order={o} dragging={dragging === o.id}
                      onDragStart={() => setDragging(o.id)} onDragEnd={() => { setDragging(null); setOver(null); }} />
                  ))}
                </AnimatePresence>
                {list.length === 0 && (
                  <div className="col-empty">
                    <VelMark size={44} shine={false} className="col-empty-mark" />
                    <span>{c.key === 'new' ? tr('Waiting for orders…', 'ஆர்டர்களுக்காகக் காத்திருக்கிறது…') : tr('Nothing here', 'இங்கு எதுவும் இல்லை')}</span>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <AnimatePresence>
        {dragging && (
          <motion.div className={`done-zone ${over === 'done' ? 'over' : ''}`} initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            onDragOver={(e) => { e.preventDefault(); setOver('done'); }} onDragLeave={() => setOver(null)} onDrop={(e) => { e.preventDefault(); drop('done'); }}>
            <Icon name="checkCircle" size={22} /> {tr('Drop here to mark delivered / handed over', 'டெலிவரி / ஒப்படைத்ததாகக் குறிக்க இங்கே விடவும்')}
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  );
}

function BoardCard({ order, onDragStart, onDragEnd, dragging }) {
  const { tr, money, km } = useLang();
  const more = order.items.length - 4;
  return (
    <motion.div layout="position" layoutId={order.id} initial={{ opacity: 0, scale: 0.94, y: 10 }} animate={{ opacity: dragging ? 0.4 : 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.2 } }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
      <div className={`ocard status-${order.status}`} draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', order.id); onDragStart(); }}
        onDragEnd={onDragEnd} onClick={() => openOrder(order.id)} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') openOrder(order.id); }}>
        {order.status === 'placed' && <span className="ocard-ping" />}
        <div className="ocard-head">
          <b className="ocard-num">#{order.number}</b>
          <Age order={order} />
          <span className="grow" />
          <TypeBadge order={order} />
        </div>
        <div className="ocard-who">
          <span className="grow ellipsis"><b>{order.customerName}</b>{order.address && <span className="subtle"> · {order.address.line}</span>}</span>
          {order.distanceKm !== null && order.distanceKm !== undefined && <span className="subtle small num">{km(order.distanceKm)}</span>}
        </div>
        <ItemLines items={order.items.slice(0, 4)} />
        {more > 0 && <div className="subtle small">+{more} {tr('more', 'மேலும்')}</div>}
        {order.notes && <div className="ocard-note"><Icon name="message" size={13} /> {order.notes}</div>}
        <ReadyTimer order={order} />
        <RiderSelect order={order} />
        <div className="ocard-foot">
          <b className="num">{money(order.bill.total)}</b>
          <PayBadge order={order} />
          <span className="grow" />
          {order.status !== 'placed' && <NextButton order={order} size="btn-xs" />}
        </div>
        {order.status === 'placed' && <AcceptBar order={order} compact />}
      </div>
    </motion.div>
  );
}
