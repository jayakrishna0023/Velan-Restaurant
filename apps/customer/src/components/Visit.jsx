import { useMemo, useState } from 'react';
import L from 'leaflet';
import { motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Modal } from '@velan/shared/components/ui.jsx';
import { MapView, LocationPicker, googleMapsUrl } from '@velan/shared/map.jsx';
import { deliveryQuote } from '@velan/shared/domain.js';
import { useSite } from '../state/site.js';
import { useUi, openZone } from '../state/ui.js';
import { Reveal } from '../lib/motion.jsx';
import SectionHead from './SectionHead.jsx';
import StoreStatus from './StoreStatus.jsx';
import { TEMPLE } from '../images.js';

/** "Do we deliver to you?" — pin a place, see distance and fee. */
export function ZoneModal() {
  const { t, tr, km, money } = useLang();
  const open = useUi((s) => s.zoneOpen);
  const settings = useSite((s) => s.settings);
  const [point, setPoint] = useState(null);
  const quote = point && settings ? deliveryQuote(settings, point, 0) : null;
  return (
    <Modal open={open} onClose={() => openZone(false)} title={tr('Do we deliver to you?', 'உங்களுக்கு டெலிவரி உண்டா?')} width={620}>
      {settings && (
        <LocationPicker origin={settings} onChange={(p) => setPoint(p)} height={360}>
          {quote && (
            <motion.span key={quote.deliverable ? 'y' : 'n'} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="badge" data-tone={quote.deliverable ? 'leaf' : 'maroon'}>
              {quote.deliverable ? t('deliverable') : t('notDeliverable')} · {km(quote.distanceKm)}
            </motion.span>
          )}
        </LocationPicker>
      )}
      {quote && settings && (
        <p className="muted" style={{ marginTop: 14, fontSize: 14 }}>
          {quote.deliverable
            ? tr('Delivery fee {fee} (free on orders above {free}). Minimum order {min}.', 'டெலிவரி கட்டணம் {fee} ({free}க்கு மேல் இலவசம்). குறைந்தபட்ச ஆர்டர் {min}.',
              { fee: money(quote.fee), free: money(settings.freeAbove), min: money(settings.minOrder) })
            : tr('We deliver within {r} km. You can still order for pickup.', '{r} கி.மீ.க்குள் மட்டும் டெலிவரி. பிக்கப் ஆர்டர் செய்யலாம்.', { r: settings.deliveryRadiusKm })}
        </p>
      )}
    </Modal>
  );
}

export default function Visit() {
  const { t, tr, pick, other, hhmm, dayName } = useLang();
  const settings = useSite((s) => s.settings);
  const markers = useMemo(() => (settings ? [{ id: 'store', kind: 'store', lat: settings.lat, lng: settings.lng, label: tr('Velan', 'வேலன்') }] : []), [settings, tr]);
  if (!settings) return null;
  // Straight-line radius of the delivery zone (road distance ≈ straight line × 1.25).
  const addCircle = (map) => {
    const zone = L.circle([settings.lat, settings.lng], { radius: (settings.deliveryRadiusKm * 1000) / 1.25, color: '#8c6b34', weight: 1, fillColor: '#ab8646', fillOpacity: 0.05, dashArray: '4 6' }).addTo(map);
    map.fitBounds(zone.getBounds(), { padding: [10, 10] });
  };
  const wa = (settings.whatsapp || settings.phone || '').replace(/\D/g, '');
  return (
    <section className="visit" id="visit">
      <div className="visit-photo">
        <img src={TEMPLE.village} alt="" loading="lazy" />
        <div className="container">
          <SectionHead dark eyebrow={['Visit us', 'எங்களைத் தேடி வாருங்கள்']} title={['On Nerur Bridge Road, Uniyur', 'உன்னியூர், நெரூர் பாலம் சாலையில்']} />
        </div>
      </div>
      <div className="container">
        <div className="visit-grid">
          <Reveal className="visit-card">
            <StoreStatus />
            <div className="visit-item">
              <Icon name="pin" size={20} />
              <div>
                <strong>{pick(settings, 'address')}</strong>
                <small>{other(settings, 'address')}</small>
              </div>
            </div>
            <div className="visit-item">
              <Icon name="clock" size={20} />
              <div>
                <strong>{hhmm(settings.openTime)} – {hhmm(settings.closeTime)}</strong>
                <small>{settings.weeklyOff !== null && settings.weeklyOff !== undefined
                  ? tr('Closed on {d}', '{d} விடுமுறை', { d: dayName(Number(settings.weeklyOff), false) })
                  : tr('Open all seven days', 'வாரத்தின் ஏழு நாளும் திறந்திருக்கும்')}</small>
              </div>
            </div>
            <div className="visit-item">
              <Icon name="scooter" size={20} />
              <div>
                <strong>{tr('Delivery within {r} km', '{r} கி.மீ. வரை டெலிவரி', { r: settings.deliveryRadiusKm })}</strong>
                <small>{tr('Nerur, Uniyur, Vangal, Thirumukkudalur and around', 'நெரூர், உன்னியூர், வாங்கல், திருமுக்கூடலூர் சுற்றுவட்டாரம்')}</small>
              </div>
            </div>
            <div className="visit-actions">
              <a className="btn btn-primary" href={googleMapsUrl(settings)} target="_blank" rel="noreferrer"><Icon name="navigation" size={17} /> {t('directions')}</a>
              {settings.phone && <a className="btn btn-outline" href={`tel:${settings.phone}`}><Icon name="phone" size={17} /> {t('call')}</a>}
              {wa && <a className="btn btn-outline" href={`https://wa.me/91${wa.slice(-10)}`} target="_blank" rel="noreferrer"><Icon name="chat" size={17} /> WhatsApp</a>}
              <button type="button" className="btn btn-soft" onClick={() => openZone(true)}><Icon name="locate" size={17} /> {tr('Check delivery', 'டெலிவரி சரிபார்')}</button>
            </div>
          </Reveal>
          <Reveal delay={0.15} className="visit-map-wrap">
            <MapView className="visit-map" markers={markers} center={settings} zoom={12} autoFit={false} wheelZoom={false} onMap={addCircle} />
            <span className="visit-map-tag"><Icon name="temple" size={15} /> {tr('Near Nerur · on the Kaveri', 'நெரூர் அருகே · காவிரிக் கரை')}</span>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
