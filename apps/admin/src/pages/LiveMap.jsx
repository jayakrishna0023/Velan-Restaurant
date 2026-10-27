// Every rider and every active delivery on one map.
import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { StatusBadge, Empty } from '@velan/shared/components/ui.jsx';
import { MapView, googlePlaceUrl } from '@velan/shared/map.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { useNow } from '@velan/shared/hooks.js';
import { roadKm } from '@velan/shared/domain.js';
import { useLive } from '../state/live.js';
import { openOrder } from '../state/ui.js';
import { Avatar, tel } from '../components/common.jsx';

export default function LiveMap() {
  const L = useLang();
  const { t, tr, km } = L;
  const riders = useLive((s) => s.riders);
  const presence = useLive((s) => s.presence);
  const active = useLive((s) => s.active);
  const settings = useLive((s) => s.settings);
  const map = useRef(null);
  const [focus, setFocus] = useState(null);
  const now = useNow(10000);

  const deliveries = useMemo(() => active.filter((o) => o.type === 'delivery' && o.address), [active]);
  const markers = useMemo(() => {
    const m = [{ id: 'store', kind: 'store', lat: settings.lat, lng: settings.lng, label: 'Velan' }];
    for (const o of deliveries) m.push({ id: o.id, kind: o.status === 'out_for_delivery' ? 'home' : 'drop', lat: o.address.lat, lng: o.address.lng, label: `#${o.number}`, onClick: () => openOrder(o.id) });
    for (const r of riders) if (r.active && r.location) m.push({ id: `r-${r.id}`, kind: 'rider', lat: r.location.lat, lng: r.location.lng, heading: r.location.heading, label: r.name });
    return m;
  }, [deliveries, riders, settings]);

  const fly = (p, key) => { setFocus(key); map.current?.flyTo([p.lat, p.lng], 16, { duration: 1 }); };
  const jobsOf = (r) => active.filter((o) => o.riderId === r.id);

  return (
    <div className="mapview-page">
      <MapView className="mapview-map" markers={markers} fitKey={markers.length ? 'init' : ''} padding={70} style={{ position: 'absolute', inset: 0, borderRadius: 0 }}
        onMap={(m) => {
          map.current = m;
          // Keep the pins clear of the side panel on wide screens (skipped if the map is already gone).
          let gone = false;
          m.on('unload', () => { gone = true; });
          setTimeout(() => { if (!gone && window.innerWidth > 960) m.panBy([-180, 0], { animate: false }); }, 600);
        }} />
      <motion.aside className="map-side" initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <div className="map-side-head">
          <h3>{t('nav.map')}</h3>
          <span className="subtle small">{tr(`${riders.filter((r) => r.online).length} riders online · ${deliveries.length} deliveries`, `${riders.filter((r) => r.online).length} பார்ட்னர்கள் ஆன்லைன் · ${deliveries.length} டெலிவரிகள்`)}</span>
        </div>
        <div className="map-side-scroll">
          <h4 className="os-label">{t('nav.riders')}</h4>
          {riders.filter((r) => r.active).map((r) => {
            const jobs = jobsOf(r);
            const fresh = r.location?.at && now - new Date(r.location.at) < 120000;
            return (
              <button key={r.id} className={`map-rider ${focus === r.id ? 'on' : ''}`} onClick={() => r.location && fly(r.location, r.id)}>
                <span className="map-rider-av">
                  <Avatar name={r.name} size={38} />
                  <i className={r.online ? (presence[r.id] ? 'ok' : 'warn') : 'off'} />
                </span>
                <span className="grow" style={{ textAlign: 'left' }}>
                  <b>{r.name}</b>
                  <span className="subtle small block">
                    {r.online ? (jobs.length ? tr(`${jobs.length} active · `, `${jobs.length} செயலில் · `) : tr('Free · ', 'காலியாக · ')) : `${t('offlineWord')} · `}
                    {r.location ? (r.location.source === 'manual' ? tr('set by hand', 'கையால் அமைத்தது') : fresh ? tr('live GPS', 'நேரலை GPS') : `${tr('seen', 'கடைசி')} ${L.relative(r.location.at)}`) : tr('no GPS yet', 'GPS இல்லை')}
                    {r.location?.accuracy && fresh ? ` ±${r.location.accuracy} m` : ''}
                    {r.location && settings ? ` · ${km(roadKm(settings, r.location))}` : ''}
                  </span>
                </span>
                {r.location && (
                  <a className="btn btn-ghost btn-icon btn-xs" href={googlePlaceUrl(r.location)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                    title={tr('See on Google Maps', 'Google Maps-இல் பார்')} aria-label={tr('See on Google Maps', 'Google Maps-இல் பார்')}><Icon name="navigation" size={14} /></a>
                )}
                {r.phone && <a className="btn btn-ghost btn-icon btn-xs" href={tel(r.phone)} onClick={(e) => e.stopPropagation()}><Icon name="phone" size={14} /></a>}
              </button>
            );
          })}
          <h4 className="os-label" style={{ marginTop: 16 }}>{tr('Active deliveries', 'நடப்பு டெலிவரிகள்')}</h4>
          {deliveries.length === 0 && <Empty icon="scooter" title={tr('No deliveries right now', 'இப்போது டெலிவரி இல்லை')} />}
          {deliveries.map((o) => (
            <div key={o.id} className={`map-order ${focus === o.id ? 'on' : ''}`} onClick={() => fly(o.address, o.id)} role="button" tabIndex={0}>
              <div className="row" style={{ gap: 8 }}>
                <b className="num">#{o.number}</b>
                <StatusBadge order={o} />
                <span className="grow" />
                <button className="btn btn-ghost btn-xs" onClick={(e) => { e.stopPropagation(); openOrder(o.id); }}>{t('details')}</button>
              </div>
              <span className="subtle small ellipsis block">{o.customerName} · {o.address.line}</span>
              <span className="small block">{o.rider ? <><Icon name="scooter" size={12} /> {o.rider.name}</> : <span className="danger-text">{t('unassigned')}</span>} · {km(o.distanceKm)}</span>
            </div>
          ))}
        </div>
      </motion.aside>
    </div>
  );
}
