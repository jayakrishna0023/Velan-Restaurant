// The big online/offline control with live GPS status.
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { useNow } from '@velan/shared/hooks.js';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { confirmDialog } from '@velan/shared/components/ui.jsx';
import { useRider } from '../RiderProvider.jsx';
import ManualLocation from './ManualLocation.jsx';

function onlineFor(since, now, ta) {
  if (!since) return '';
  const m = Math.max(0, Math.round((now - new Date(since)) / 60000));
  if (m < 60) return ta ? `${m} நிமி` : `${m} min`;
  return ta ? `${Math.floor(m / 60)} மணி ${m % 60} நிமி` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

function GpsLine() {
  const { t, tr } = useLang();
  const { gps, sim } = useRider();
  const now = useNow(5000);
  if (sim) return <span className="r-gps" data-tone="gold"><Icon name="navigation" size={14} /> {t('gps.demo')}</span>;
  if (gps.pos?.source === 'manual') {
    const mins = Math.round((now - gps.pos.at) / 60000);
    return (
      <span className="r-gps" data-tone="gold"><Icon name="pin" size={14} /> {mins < 1 ? tr('Location set by hand · just now', 'கையால் அமைத்த இருப்பிடம் · இப்போது') : tr('Location set by hand · {m} min ago', 'கையால் அமைத்த இருப்பிடம் · {m} நிமி முன்', { m: mins })}</span>
    );
  }
  if (gps.error) return <span className="r-gps" data-tone="maroon"><Icon name="alert" size={14} /> {t(`gps.${gps.error}`)}</span>;
  if (gps.pos?.accuracy > 100) return <span className="r-gps" data-tone="gold"><Icon name="alert" size={14} /> {tr('Rough GPS ±{m} m', 'தோராயமான GPS ±{m} மீ', { m: Math.round(gps.pos.accuracy) })}</span>;
  if (gps.pos) return <span className="r-gps" data-tone="leaf"><i className="r-gps-dot" /> {t('gps.ok', { m: Math.round(gps.pos.accuracy || 0) })}</span>;
  return <span className="r-gps"><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> {t('gps.waiting')}</span>;
}

/** GPS state, plus "set my location by hand" whenever GPS is not giving a live fix. */
export function GpsStatus() {
  const { tr } = useLang();
  const { online, gps, sim } = useRider();
  const [manual, setManual] = useState(false);
  if (!online) return null;
  // Offered when GPS is off, still searching, rough (over 100 m), or already set by hand.
  const needsHand = !sim && (gps.error || !gps.pos || gps.pos.source === 'manual' || gps.pos.accuracy > 100);
  return (
    <div className="r-gps-row">
      <GpsLine />
      {needsHand && (
        <button type="button" className="r-gps-manual" onClick={() => setManual(true)}>
          <Icon name="pin" size={14} /> {gps.pos?.source === 'manual' ? tr('Update', 'புதுப்பி') : tr('Set location by hand', 'இருப்பிடத்தைக் கையால் அமை')}
        </button>
      )}
      <ManualLocation open={manual} onClose={() => setManual(false)} />
    </div>
  );
}

export default function OnlineCard() {
  const { t, tr, ta } = useLang();
  const { me, online, setOnline, orders } = useRider();
  const now = useNow(30000);

  const toggle = async () => {
    if (online && orders.length) {
      const ok = await confirmDialog({
        title: t('goOffline'),
        body: tr('You still have an active delivery. Go offline anyway?', 'உங்களிடம் இன்னும் நடப்பு டெலிவரி உள்ளது. இருந்தாலும் ஆஃப்லைன் செல்லவா?'),
        confirmLabel: t('goOffline'),
        tone: 'danger',
      });
      if (!ok) return;
    }
    setOnline(!online);
  };

  return (
    <motion.section className={`r-online ${online ? 'is-on' : ''}`} layout transition={{ type: 'spring', stiffness: 260, damping: 30 }}>
      <div className="r-online-row">
        <div className="r-online-text">
          <span className="r-online-state"><i />{online ? t('online') : t('offlineState')}</span>
          {online && me?.onlineSince && <em className="r-online-for"><Icon name="clock" size={13} /> {onlineFor(me.onlineSince, now, ta)}</em>}
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={online ? 'on' : 'off'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              {online ? t('onlineSub') : t('offlineSub')}
            </motion.p>
          </AnimatePresence>
        </div>
        <motion.button type="button" className="r-power" onClick={toggle} aria-pressed={online} whileTap={{ scale: 0.9 }}
          aria-label={online ? t('goOffline') : t('goOnline')}>
          <span className="r-power-orb">
            {online && <><span className="r-wave" /><span className="r-wave d2" /></>}
            <Icon name="power" size={30} stroke={2.2} />
          </span>
          <span className="r-power-label">{online ? t('goOffline') : t('goOnline')}</span>
        </motion.button>
      </div>
      <GpsStatus />
    </motion.section>
  );
}
