// Live audit feed: who did what, when.
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, Seg } from '@velan/shared/components/ui.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { live, useLive } from '../state/live.js';
import { openOrder, ui, useUi } from '../state/ui.js';
import { activityMeta, activityText } from '../lib/activity.js';

export function ActivityList({ entries, limit = 200 }) {
  const L = useLang();
  return (
    <ul className="feed">
      <AnimatePresence initial={false}>
        {entries.slice(0, limit).map((a) => {
          const { icon, tone } = activityMeta(a);
          return (
            <motion.li key={a.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className={a.data?.id && a.kind.startsWith('order.') ? 'clickable' : ''}
              onClick={() => { if (a.data?.id && a.kind.startsWith('order.')) { openOrder(a.data.id); ui.set({ activity: false }); } }}>
              <span className={`feed-icon tone-${tone}`}><Icon name={icon} size={15} /></span>
              <div className="grow">
                <div className="feed-text">{activityText(a, L)}</div>
                <div className="subtle small">{L.relative(a.at)}{a.actor && a.actor.role !== 'customer' ? ` · ${a.actor.name}` : ''}</div>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

export default function ActivityDrawer() {
  const open = useUi((s) => s.activity);
  const entries = useLive((s) => s.activity);
  const [filter, setFilter] = useState('all');
  const { t, tr } = useLang();
  useEffect(() => { if (open) live.set({ unread: 0 }); }, [open, entries.length]);
  const shown = useMemo(() => entries.filter((a) => {
    if (filter === 'orders') return a.kind.startsWith('order.');
    if (filter === 'menu') return a.kind.startsWith('menu.') || a.kind.startsWith('category.') || a.kind.startsWith('coupon.');
    if (filter === 'team') return a.kind.startsWith('rider.') || a.kind.startsWith('store.') || a.kind.startsWith('settings.');
    return true;
  }), [entries, filter]);
  return (
    <Sheet open={open} onClose={() => ui.set({ activity: false })} label={t('activity')}>
      <div className="sheet-head">
        <span className="panel-icon"><Icon name="activity" size={18} /></span>
        <h3 className="grow">{t('activity')}</h3>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => ui.set({ activity: false })} aria-label={t('close')}><Icon name="x" /></button>
      </div>
      <div style={{ padding: '0 20px 12px' }}>
        <Seg size="sm" value={filter} onChange={setFilter} options={[
          { value: 'all', label: tr('All', 'அனைத்தும்') }, { value: 'orders', label: tr('Orders', 'ஆர்டர்கள்') },
          { value: 'menu', label: tr('Menu', 'மெனு') }, { value: 'team', label: tr('Team', 'குழு') },
        ]} />
      </div>
      <div className="sheet-scroll" style={{ paddingTop: 0 }}>
        <ActivityList entries={shown} />
      </div>
    </Sheet>
  );
}
