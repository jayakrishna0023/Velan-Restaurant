// Ctrl/⌘K: jump to a page, find an order by number, or run a quick action.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { toast, confirmDialog, StatusBadge } from '@velan/shared/components/ui.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { useDebounced } from '@velan/shared/hooks.js';
import { api } from '../api.js';
import { setMenu } from '../state/live.js';
import { openOrder, ui, useUi } from '../state/ui.js';
import { ALL_PAGES } from './nav.js';
import { useStoreToggle } from './Shell.jsx';
import { useThemeCtl } from './theme.js';

export default function CommandPalette() {
  const open = useUi((s) => s.palette);
  useEffect(() => {
    const fn = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ui.set((s) => ({ ...s, palette: !s.palette }));
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);
  return createPortal(
    <AnimatePresence>
      {open && <Palette onClose={() => ui.set({ palette: false })} />}
    </AnimatePresence>,
    document.body,
  );
}

function Palette({ onClose }) {
  const L = useLang();
  const { t, tr, setLang, lang } = L;
  const navigate = useNavigate();
  const store = useStoreToggle();
  const { setPref, theme } = useThemeCtl();
  const [q, setQ] = useState('');
  const [index, setIndex] = useState(0);
  const [orders, setOrders] = useState([]);
  const input = useRef(null);
  const dq = useDebounced(q, 220);

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const term = dq.trim().replace(/^#/, '');
    if (!term || (!/^\d+$/.test(term) && term.length < 3)) { setOrders([]); return undefined; }
    let live = true;
    api.get(`/orders?q=${encodeURIComponent(term)}&limit=5`).then((r) => { if (live) setOrders(r.orders); }).catch(() => {});
    return () => { live = false; };
  }, [dq]);

  const items = useMemo(() => {
    const go = (to) => () => { navigate(to); onClose(); };
    const actions = [
      { id: 'pos', icon: 'plus', label: tr('New counter / phone order', 'புதிய கவுண்டர் / போன் ஆர்டர்'), run: go('/pos') },
      { id: 'store', icon: 'power', label: store.open ? tr('Pause new orders', 'புதிய ஆர்டர்களை நிறுத்து') : tr('Open for orders', 'ஆர்டர்களுக்குத் திற'), run: () => { onClose(); store.toggle(); } },
      {
        id: 'restock', icon: 'refresh', label: t('resetStock'), run: async () => {
          onClose();
          const ok = await confirmDialog({ title: t('resetStock'), body: tr('Every dish goes back to its daily quantity.', 'ஒவ்வொரு உணவும் அதன் தினசரி அளவுக்குத் திரும்பும்.'), confirmLabel: t('resetStock') });
          if (!ok) return;
          try { setMenu(await api.post('/admin/menu/reset-stock')); toast.success(tr('Stock reset for today', 'இன்றைய இருப்பு மீட்டமைக்கப்பட்டது')); } catch (e) { toast.error(L.error(e)); }
        },
      },
      { id: 'kitchen', icon: 'chefHat', label: tr('Open kitchen display', 'சமையலறைத் திரையைத் திற'), run: go('/kitchen') },
      { id: 'theme', icon: theme === 'dark' ? 'sun' : 'moon', label: theme === 'dark' ? tr('Switch to light theme', 'வெளிச்ச தீமுக்கு மாற்று') : tr('Switch to dark theme', 'இருள் தீமுக்கு மாற்று'), run: () => { setPref(theme === 'dark' ? 'light' : 'dark'); onClose(); } },
      { id: 'lang', icon: 'languages', label: lang === 'ta' ? 'Switch to English' : 'தமிழுக்கு மாற்று', run: () => { setLang(lang === 'ta' ? 'en' : 'ta'); onClose(); } },
    ];
    const pages = ALL_PAGES.map((p) => ({ id: p.to, icon: p.icon, label: t(p.key), hint: tr('Page', 'பக்கம்'), run: go(p.to) }));
    const found = orders.map((o) => ({
      id: o.id, icon: 'receipt', label: `#${o.number} · ${o.customerName}`, hint: L.money(o.bill.total), order: o,
      run: () => { openOrder(o.id); onClose(); },
    }));
    const term = q.trim().toLowerCase();
    const match = (x) => !term || x.label.toLowerCase().includes(term);
    return [
      ...found.map((x) => ({ ...x, section: tr('Orders', 'ஆர்டர்கள்') })),
      ...actions.filter(match).map((x) => ({ ...x, section: tr('Actions', 'செயல்கள்') })),
      ...pages.filter(match).map((x) => ({ ...x, section: tr('Go to', 'செல்') })),
    ];
  }, [q, orders, store, theme, lang, L, navigate, onClose, setLang, setPref, t, tr]);

  useEffect(() => { setIndex(0); }, [q, orders.length]);

  const onKey = (e) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') items[index]?.run();
  };

  let lastSection = null;
  return (
    <>
      <motion.div className="overlay" style={{ zIndex: 950 }} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div className="palette" role="dialog" aria-modal="true" initial={{ opacity: 0, y: -16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}>
        <div className="palette-input">
          <Icon name="search" size={20} />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder={tr('Type a page, action or order number (e.g. 1042)…', 'பக்கம், செயல் அல்லது ஆர்டர் எண் (எ.கா. 1042)…')} />
          <span className="kbd">Esc</span>
        </div>
        <ul className="palette-list">
          {items.length === 0 && <li className="palette-empty subtle">{tr('No matches', 'பொருத்தம் இல்லை')}</li>}
          {items.map((it, i) => {
            const head = it.section !== lastSection ? it.section : null;
            lastSection = it.section;
            return (
              <li key={`${it.section}-${it.id}`}>
                {head && <div className="palette-section">{head}</div>}
                <button className={`palette-item ${i === index ? 'on' : ''}`} onMouseEnter={() => setIndex(i)} onClick={it.run}>
                  <span className="palette-icon"><Icon name={it.icon} size={17} /></span>
                  <span className="grow ellipsis">{it.label}</span>
                  {it.order && <StatusBadge order={it.order} />}
                  {it.hint && <span className="subtle small">{it.hint}</span>}
                  {i === index && <Icon name="arrowRight" size={15} className="subtle" />}
                </button>
              </li>
            );
          })}
        </ul>
      </motion.div>
    </>
  );
}
