// "Set my location by hand" for when GPS is blocked, has no signal, or the app is
// opened over plain http: type latitude and longitude, paste a Google Maps link,
// search, or drag the map, then share that point as the rider's position.
import { useState } from 'react';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Modal } from '@velan/shared/components/ui.jsx';
import { LocationPicker } from '@velan/shared/map.jsx';
import { parseLocationText } from '@velan/shared/geo.js';
import { useRider } from '../RiderProvider.jsx';

export default function ManualLocation({ open, onClose }) {
  const { tr } = useLang();
  const { position, settings, setManualLocation } = useRider();
  const [point, setPoint] = useState(null);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [target, setTarget] = useState(null);
  const [bad, setBad] = useState(false);

  // Accepts "11.0018" + "78.1764" in two boxes, or "11.0018, 78.1764" pasted into the first.
  const go = () => {
    const p = parseLocationText(lng ? `${lat}, ${lng}` : lat);
    setBad(!p);
    if (p) setTarget({ ...p, source: 'manual', key: Date.now(), zoom: 18 });
  };
  const share = () => {
    if (!point) return;
    setManualLocation(point);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} width={560} className="r-manual" title={tr('Set my location', 'என் இருப்பிடத்தை அமை')}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{tr('Cancel', 'ரத்து')}</button>
          <button type="button" className="btn btn-gold" onClick={share} disabled={!point}>
            <Icon name="navigation" size={17} /> {tr('Share this location', 'இந்த இருப்பிடத்தைப் பகிர்')}
          </button>
        </>
      )}>
      <p className="subtle r-manual-help">
        {tr('Use this when GPS is not working. Type the latitude and longitude, paste a Google Maps link in the search box, or drag the map so the pin sits where you are.',
          'GPS வேலை செய்யாதபோது இதைப் பயன்படுத்துங்கள். அட்சரேகை, தீர்க்கரேகையை உள்ளிடுங்கள், Google Maps இணைப்பைத் தேடலில் ஒட்டுங்கள், அல்லது பின் நீங்கள் இருக்கும் இடத்தில் வரும்படி வரைபடத்தை நகர்த்துங்கள்.')}
      </p>
      <div className="r-manual-coords">
        <label className="field">
          <span className="field-label">{tr('Latitude', 'அட்சரேகை')}</span>
          <input className="input num" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="11.0018" onKeyDown={(e) => e.key === 'Enter' && go()} />
        </label>
        <label className="field">
          <span className="field-label">{tr('Longitude', 'தீர்க்கரேகை')}</span>
          <input className="input num" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="78.1764" onKeyDown={(e) => e.key === 'Enter' && go()} />
        </label>
        <button type="button" className="btn btn-soft" onClick={go} disabled={!lat}><Icon name="pin" size={16} /> {tr('Go', 'செல்')}</button>
      </div>
      {bad && <p className="r-manual-bad"><Icon name="alert" size={15} /> {tr('Those are not valid coordinates. Example: 11.0018 and 78.1764', 'சரியான ஆயத்தொலைவுகள் இல்லை. உதாரணம்: 11.0018, 78.1764')}</p>}
      {open && (
        <LocationPicker value={position ? { lat: position.lat, lng: position.lng } : null} origin={settings}
          onChange={(p) => setPoint(p)} height={320} target={target} />
      )}
      {point && <p className="subtle r-manual-at num"><Icon name="pin" size={14} /> {point.lat.toFixed(6)}, {point.lng.toFixed(6)}</p>}
    </Modal>
  );
}
