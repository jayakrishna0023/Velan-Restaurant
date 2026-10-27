// Profile tab: who I am, language, theme, alert sound, notifications, logout.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { LangToggle, Seg, Stars, confirmDialog } from '@velan/shared/components/ui.jsx';
import { initials } from '@velan/shared/hooks.js';
import { askNotify, sound, vibrate } from '@velan/shared/effects.js';
import { useRider } from '../RiderProvider.jsx';
import { telHref } from '../lib/tel.js';

const permission = () => ('Notification' in window ? Notification.permission : 'unsupported');

function Row({ icon, label, children, i }) {
  return (
    <motion.li initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
      <span className="r-icon-chip"><Icon name={icon} size={18} /></span>
      <span className="grow r-row-label">{label}</span>
      {children}
    </motion.li>
  );
}

export default function Profile({ theme, awake }) {
  const { t, tr, pick } = useLang();
  const { me, summary, settings, logout } = useRider();
  const [, setTheme, pref] = theme;
  const [perm, setPerm] = useState(permission);

  const signOut = async () => {
    const ok = await confirmDialog({ title: t('logout'), body: t('logoutConfirm'), confirmLabel: t('logout'), tone: 'danger' });
    if (ok) logout();
  };

  return (
    <div className="r-screen r-profile">
      <motion.section className="r-me" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="r-me-avatar"><span>{initials(me?.name)}</span></div>
        <h2 className="display">{me?.name}</h2>
        <p className="num">+91 {me?.phone?.replace(/(\d{5})(\d{5})/, '$1 $2')}</p>
        <div className="r-me-tags">
          {me?.vehicle && <span className="r-plate">{me.vehicle}</span>}
          {summary?.rating?.avg && <span className="r-me-rating"><Stars value={summary.rating.avg} size={13} /> {summary.rating.avg.toFixed(1)}</span>}
        </div>
      </motion.section>

      <ul className="r-settings">
        <Row icon="languages" label={t('language')} i={0}><LangToggle /></Row>
        <Row icon={pref === 'light' ? 'sun' : 'moon'} label={t('theme')} i={1}>
          <Seg size="sm" value={pref} onChange={setTheme} options={[
            { value: 'light', label: t('light') }, { value: 'dark', label: t('dark') }, { value: 'auto', label: t('auto') },
          ]} />
        </Row>
        <Row icon="volume" label={t('soundCheck')} i={2}>
          <button type="button" className="btn btn-soft btn-sm" onClick={() => { sound.alarm(); vibrate([200, 100, 200]); }}>
            <Icon name="bell" size={15} /> {t('playAlert')}
          </button>
        </Row>
        <Row icon="bell" label={t('notifications')} i={3}>
          {perm === 'granted' && <span className="badge" data-tone="leaf"><span className="dot" />{t('notifOn')}</span>}
          {perm === 'denied' && <span className="badge" data-tone="maroon">{t('notifBlocked')}</span>}
          {perm === 'unsupported' && <span className="badge">{t('notifUnsupported')}</span>}
          {perm === 'default' && (
            <button type="button" className="btn btn-gold btn-sm" onClick={async () => { await askNotify(); setPerm(permission()); }}>{t('allow')}</button>
          )}
        </Row>
        <Row icon="sun" label={tr('Screen stays on', 'திரை அணையாது')} i={4}>
          {awake === 'off'
            ? <span className="badge" data-tone="saffron">{tr('Tap once to keep it on', 'அணையாமல் இருக்க ஒருமுறை தொடவும்')}</span>
            : <span className="badge" data-tone="leaf"><span className="dot" />{tr('On', 'ஆன்')}</span>}
        </Row>
        <Row icon="store" label={pick(settings, 'name') || t('restaurantPhone')} i={5}>
          {settings?.phone ? (
            <a className="btn btn-soft btn-sm" href={telHref(settings.phone)}><Icon name="phone" size={15} /> {t('call')}</a>
          ) : <span className="subtle">—</span>}
        </Row>
      </ul>

      <p className="r-tip"><Icon name="phoneDevice" size={16} /> {t('install')}</p>

      <button type="button" className="btn btn-outline btn-block r-logout" onClick={signOut}><Icon name="logout" size={18} /> {t('logout')}</button>
      <p className="r-version">{t('version')}</p>
    </div>
  );
}
