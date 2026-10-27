// Full-screen navigation map with live position.
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { roadKm } from '@velan/shared/domain.js';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { MapView, fetchRoute, googleMapsUrl } from '@velan/shared/map.jsx';
import { useRider, storePoint } from '../RiderProvider.jsx';
import { metersBetween } from '../lib/geo.js';

export default function FullMap({ order, onClose }) {
  const { t, pick, km, mins } = useLang();
  const { settings, position } = useRider();
  const picked = order.status === 'out_for_delivery';
  const store = storePoint(settings);
  const dest = picked ? order.address : store;
  const [route, setRoute] = useState(null);
  const [fit, setFit] = useState(0);
  const lastFit = useRef(null);

  useEffect(() => {
    const from = position || store;
    if (!from || !dest) return undefined;
    let live = true;
    fetchRoute(from, dest).then((r) => { if (live) setRoute(r); });
    return () => { live = false; };
  }, [picked]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the rider in view: re-fit after moving ~250 m.
  useEffect(() => {
    if (!position) return;
    if (!lastFit.current || metersBetween(lastFit.current, position) > 250) {
      lastFit.current = position;
      setFit((f) => f + 1);
    }
  }, [position]);

  const markers = [
    store && { id: 'store', kind: 'store', ...store },
    order.address && { id: 'home', kind: 'home', lat: order.address.lat, lng: order.address.lng, label: order.customerName.split(' ')[0] },
    position && { id: 'me', kind: 'rider', lat: position.lat, lng: position.lng, heading: position.heading, label: t('you') },
  ].filter(Boolean);
  const away = position && dest ? roadKm(position, dest) : null;

  return (
    <motion.div className="r-fullmap" initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.03 }} transition={{ duration: 0.3 }}>
      <MapView className="r-fullmap-map" style={{ position: 'absolute', inset: 0 }} markers={markers} route={route?.coords} fitKey={`${fit}-${route ? 1 : 0}`} padding={70} />
      <button type="button" className="r-fab r-fab-back" onClick={onClose} aria-label={t('close')}><Icon name="x" size={22} /></button>
      <button type="button" className="r-fab r-fab-center" onClick={() => setFit((f) => f + 1)} aria-label="Recenter"><Icon name="locate" size={22} /></button>
      <motion.div className="r-fullmap-card" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
        <span className={`r-stop-dot ${picked ? 'home' : 'store'}`}><Icon name={picked ? 'home' : 'store'} size={14} /></span>
        <div className="grow">
          <b className="ellipsis">{picked ? order.customerName : pick(settings, 'name')}</b>
          <small className="ellipsis">{picked ? order.address?.line : pick(settings, 'address')}</small>
          {away != null && <small className="r-fullmap-eta num">{t('awayEta', { mins: mins(away * 3 + 1), km: km(away) })}</small>}
        </div>
        {dest && (
          <a className="btn btn-gold btn-icon" href={googleMapsUrl(dest, null, { navigate: true })} target="_blank" rel="noreferrer" aria-label={t('openMaps')}>
            <Icon name="navigation" size={20} />
          </a>
        )}
      </motion.div>
    </motion.div>
  );
}
