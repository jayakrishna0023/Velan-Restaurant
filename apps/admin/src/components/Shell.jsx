// Sidebar, top bar and phone navigation.
import { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { VelMark } from '@velan/shared/components/Brand.jsx';
import { Sign } from '@velan/shared/components/Poster.jsx';
import { LangToggle, toast, spring, confirmDialog } from '@velan/shared/components/ui.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { useConnected } from '@velan/shared/realtime.js';
import { useMediaQuery } from '@velan/shared/hooks.js';
import { api } from '../api.js';
import { setSettings, useLive } from '../state/live.js';
import { logout, prefs, ui, useAuth, usePrefs, useUi } from '../state/ui.js';
import { NAV, pageFor } from './nav.js';
import { Avatar } from './common.jsx';
import { useThemeCtl } from './theme.js';

function useBadges() {
  const active = useLive((s) => s.active);
  const items = useLive((s) => s.items);
  return useMemo(() => ({
    active: active.length,
    placed: active.filter((o) => o.status === 'placed').length,
    lowStock: items.filter((m) => m.available !== false && m.stock <= Math.max(3, Math.ceil(m.dailyStock * 0.15))).length,
  }), [active, items]);
}

export function useStoreToggle() {
  const settings = useLive((s) => s.settings);
  const L = useLang();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (!settings) return;
    const next = !settings.isOpen;
    if (!next) {
      const ok = await confirmDialog({
        title: L.tr('Pause new orders?', 'புதிய ஆர்டர்களை நிறுத்தவா?'),
        body: L.tr('Customers will see the restaurant as closed until you open it again. Orders already placed are not affected.', 'மீண்டும் திறக்கும் வரை வாடிக்கையாளர்களுக்கு உணவகம் மூடியதாகக் காட்டும். ஏற்கனவே வந்த ஆர்டர்கள் பாதிக்கப்படாது.'),
        confirmLabel: L.tr('Pause orders', 'ஆர்டர்களை நிறுத்து'),
        tone: 'danger',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      setSettings(await api.put('/admin/settings', { isOpen: next }));
      toast.success(next ? L.t('storeOpen') : L.t('storePaused'));
    } catch (e) { toast.error(L.error(e)); }
    setBusy(false);
  };
  return { open: settings?.isOpen, status: settings?.status, toggle, busy };
}

export function StoreSwitch({ compact = false }) {
  const { open, status, toggle, busy } = useStoreToggle();
  const { t, tr, hhmm } = useLang();
  const outsideHours = open && status && !status.open;
  return (
    <button type="button" className={`store-switch ${open === undefined ? 'unknown' : open ? 'on' : 'off'} ${compact ? 'compact' : ''}`} onClick={toggle} disabled={busy || open === undefined}
      title={outsideHours ? tr(`Closed by hours · opens ${hhmm(status.opensAt)}`, `நேரப்படி மூடல் · ${hhmm(status.opensAt)}க்கு திறக்கும்`) : undefined}>
      <span className="ss-track"><motion.span className="ss-knob" layout transition={spring} /></span>
      {!compact && <span className="ss-text">{open ? (outsideHours ? tr('Open · outside hours', 'திறப்பு · நேரத்திற்கு வெளியே') : t('storeOpen')) : t('storePaused')}</span>}
    </button>
  );
}

export function Sidebar() {
  const collapsed = usePrefs((s) => s.collapsed);
  const navOpen = useUi((s) => s.nav);
  const mobile = useMediaQuery('(max-width: 960px)');
  const badges = useBadges();
  const user = useAuth((s) => s.user);
  const { t, tr } = useLang();
  const isCollapsed = collapsed && !mobile;

  const body = (
    <motion.aside className={`sidebar kolam-night ${isCollapsed ? 'collapsed' : ''} ${mobile ? 'mobile' : ''}`}
      initial={mobile ? { x: '-100%' } : false} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
      <div className="sb-brand">
        {isCollapsed ? (
          <span className="sb-collapsed-mark"><VelMark size={30} color="#fff3dc" shine={false} /></span>
        ) : (
          <div className="sb-brand-text">
            <Sign />
            <span>{tr('Restaurant console', 'உணவக நிர்வாகம்')}</span>
          </div>
        )}
      </div>
      <nav className="sb-nav">
        {NAV.map((g, gi) => (
          <div key={gi} className="sb-group">
            {g.group && !isCollapsed && <div className="sb-group-label">{t(g.group)}</div>}
            {g.group === null && <div className="sb-sep" />}
            {g.items.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.to === '/'} className="sb-link" title={isCollapsed ? t(it.key) : undefined}
                onClick={() => ui.set({ nav: false })}>
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="sb-active" className="sb-active" transition={spring} />}
                    <Icon name={it.icon} size={19} />
                    {!isCollapsed && <span className="sb-label">{t(it.key)}</span>}
                    {it.badge && badges[it.badge] > 0 && (
                      <span className={`sb-badge ${it.badge === 'active' && badges.placed ? 'hot' : ''}`}>{badges[it.badge]}</span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sb-foot">
        {!isCollapsed && <StoreSwitch />}
        <div className="sb-user">
          <Avatar name={user?.name} size={34} tone="var(--gradient-gold)" />
          {!isCollapsed && <div className="grow ellipsis"><b>{user?.name}</b><span className="ellipsis">+91 {user?.phone}</span></div>}
          {!isCollapsed && <button className="sb-icon-btn" onClick={logout} title={t('logout')}><Icon name="logout" size={17} /></button>}
        </div>
        {!mobile && (
          <button className="sb-collapse" onClick={() => prefs.set({ collapsed: !collapsed })} aria-label="Collapse sidebar">
            <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={16} />
          </button>
        )}
      </div>
    </motion.aside>
  );

  if (!mobile) return body;
  return (
    <AnimatePresence>
      {navOpen && (
        <>
          <motion.div className="overlay" style={{ zIndex: 700 }} onClick={() => ui.set({ nav: false })} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          {body}
        </>
      )}
    </AnimatePresence>
  );
}

export function Topbar() {
  const location = useLocation();
  const page = pageFor(location.pathname);
  const { t, tr } = useLang();
  const connected = useConnected();
  const sound = usePrefs((s) => s.sound);
  const unread = useLive((s) => s.unread);
  const { pref, setPref } = useThemeCtl();
  const nextTheme = { auto: 'light', light: 'dark', dark: 'auto' }[pref];
  return (
    <header className="topbar">
      <button className="btn btn-ghost btn-icon btn-sm tb-menu" onClick={() => ui.set({ nav: true })} aria-label="Menu"><Icon name="menu" /></button>
      <AnimatePresence mode="wait">
        <motion.h2 key={page.key} className="tb-title" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          {t(page.key)}
        </motion.h2>
      </AnimatePresence>
      <button className="tb-search" onClick={() => ui.set({ palette: true })}>
        <Icon name="search" size={16} />
        <span className="grow">{t('searchAnything')}</span>
        <span className="kbd">Ctrl</span><span className="kbd">K</span>
      </button>
      <div className="tb-actions">
        <StoreSwitch compact />
        <span className={`tb-conn ${connected ? 'ok' : 'bad'}`} title={connected ? tr('Live', 'நேரலை') : t('offline')}><i /></span>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => prefs.set({ sound: !sound })} title={sound ? t('soundOn') : t('soundOff')}>
          <Icon name={sound ? 'volume' : 'volumeOff'} size={18} />
        </button>
        <button className="btn btn-ghost btn-icon btn-sm tb-bell" onClick={() => ui.set({ activity: true })} title={t('activity')}>
          <Icon name="bell" size={18} />
          {unread > 0 && <motion.span className="tb-dot" initial={{ scale: 0 }} animate={{ scale: 1 }} key={unread}>{unread > 9 ? '9+' : unread}</motion.span>}
        </button>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setPref(nextTheme)} title={`${t('theme')}: ${t(`theme.${pref}`)}`}>
          <Icon name={pref === 'dark' ? 'moon' : pref === 'light' ? 'sun' : 'gauge'} size={18} />
        </button>
        <LangToggle />
      </div>
    </header>
  );
}

export function MobileNav() {
  const mobile = useMediaQuery('(max-width: 640px)');
  const badges = useBadges();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, tr } = useLang();
  if (!mobile || location.pathname.startsWith('/kitchen')) return null;
  const items = [
    { to: '/', icon: 'grid', label: t('nav.dashboard') },
    { to: '/live', icon: 'board', label: tr('Live', 'நேரடி'), badge: badges.active },
    { to: '/pos', icon: 'plus', label: tr('New', 'புதிது'), primary: true },
    { to: '/menu', icon: 'utensils', label: tr('Menu', 'மெனு') },
  ];
  return (
    <nav className="mnav">
      {items.map((it) => {
        const on = it.to === '/' ? location.pathname === '/' : location.pathname.startsWith(it.to);
        return (
          <button key={it.to} className={`mnav-item ${on ? 'on' : ''} ${it.primary ? 'primary' : ''}`} onClick={() => navigate(it.to)}>
            {on && !it.primary && <motion.span layoutId="mnav-on" className="mnav-pill" transition={spring} />}
            <Icon name={it.icon} size={21} />
            <span>{it.label}</span>
            {it.badge > 0 && <i className="mnav-badge">{it.badge}</i>}
          </button>
        );
      })}
      <button className="mnav-item" onClick={() => ui.set({ nav: true })}>
        <Icon name="menu" size={21} />
        <span>{tr('More', 'மேலும்')}</span>
      </button>
    </nav>
  );
}
