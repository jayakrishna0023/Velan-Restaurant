// A delivery address, set the way that suits the customer: GPS, search,
// a pasted Google Maps link, dragging the pin, or typing it out and finding
// it on the map. The pin fills in street, area and pincode; the customer adds
// the door number. Shows how much the pin can be trusted and whether we deliver there.
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Seg, Switch } from '@velan/shared/components/ui.jsx';
import { LocationPicker, searchPlaces } from '@velan/shared/map.jsx';
import { accuracyLevel } from '@velan/shared/geo.js';
import { haversineKm } from '@velan/shared/domain.js';

const AUTO = ['street', 'area', 'pincode'];

export const emptyDraft = () => ({ label: 'home', door: '', street: '', area: '', pincode: '', landmark: '', lat: null, lng: null, source: 'pin', accuracy: null, confirmedAt: null });

/** The customer said "yes, this is my door" for the pin where it is now (moving it asks again). */
export const pinConfirmed = (d) => Boolean(d.lat && d.confirmedAt && haversineKm(d, d.confirmedAt) * 1000 < 5);

export default function AddressForm({ draft, setDraft, settings, quote, saveAddr, setSaveAddr, editing, autoLocate }) {
  const { t, tr, km, money, lang } = useLang();
  const [target, setTarget] = useState(null);
  const [finding, setFinding] = useState('');
  // Fields the customer has typed into stop being filled from the pin.
  const touched = useRef(new Set());

  const onPin = (p, meta) => setDraft((d) => {
    const next = { ...d, lat: p.lat, lng: p.lng, source: meta.source, accuracy: meta.accuracy ?? (meta.source === d.source ? d.accuracy : null) };
    if (meta.parts) {
      for (const k of AUTO) if (!touched.current.has(k) && meta.parts[k]) next[k] = meta.parts[k];
      if (!touched.current.has('door') && !d.door && meta.parts.door) next.door = meta.parts.door;
    }
    return next;
  });
  const field = (k) => (e) => {
    touched.current.add(k);
    const v = k === 'pincode' ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value;
    setDraft((d) => ({ ...d, [k]: v }));
  };

  // Typed address → best match on the map, searched near the restaurant.
  const findOnMap = async () => {
    const q = [draft.street, draft.area, draft.pincode, 'Tamil Nadu'].filter(Boolean).join(', ');
    if (!draft.street && !draft.area && !draft.pincode) { setFinding(tr('Type a street, area or pincode first.', 'முதலில் தெரு, ஊர் அல்லது பின்கோடு உள்ளிடுங்கள்.')); return; }
    setFinding('busy');
    try {
      const hits = await searchPlaces(q, settings, lang);
      if (!hits.length) { setFinding(tr('Could not find that on the map. Drag the map to your street instead.', 'வரைபடத்தில் கிடைக்கவில்லை. வரைபடத்தை உங்கள் தெருவுக்கு நகர்த்துங்கள்.')); return; }
      setTarget({ ...hits[0], source: 'manual', key: Date.now() });
      setFinding(tr('Found it. Now move the pin onto your door.', 'கண்டுபிடிக்கப்பட்டது. இப்போது பின்னை உங்கள் வாசலில் வையுங்கள்.'));
    } catch {
      setFinding(tr('Map search is not reachable right now. Drag the map instead.', 'வரைபடத் தேடல் இப்போது கிடைக்கவில்லை. வரைபடத்தை நகர்த்துங்கள்.'));
    }
  };

  const confirm = (p) => setDraft((d) => ({ ...d, confirmedAt: p || { lat: d.lat, lng: d.lng } }));
  const confirmed = pinConfirmed(draft);
  const level = draft.source === 'gps' ? accuracyLevel(draft.accuracy) : null;
  const trust = !draft.lat ? null
    : draft.source === 'gps' ? (level === 'exact' || level === 'good'
      ? { tone: 'leaf', icon: 'locate', text: tr('Pinned by GPS, accurate to ±{m} m', 'GPS மூலம் பின், ±{m} மீ துல்லியம்', { m: draft.accuracy }) }
      : { tone: 'saffron', icon: 'alert', text: tr('GPS is rough (±{m} m). Drag the map so the pin sits on your door.', 'GPS தோராயமானது (±{m} மீ). பின் வாசலில் இருக்கும்படி நகர்த்துங்கள்.', { m: draft.accuracy }) })
      : draft.source === 'link' ? { tone: 'leaf', icon: 'pin', text: tr('Pinned from your map link', 'உங்கள் வரைபட இணைப்பிலிருந்து பின்') }
        : draft.source === 'manual' || draft.source === 'search' ? { tone: 'saffron', icon: 'pin', text: tr('Pinned near the address you typed. Check the pin is on your door.', 'நீங்கள் உள்ளிட்ட முகவரிக்கு அருகில் பின். வாசலில் உள்ளதா எனப் பாருங்கள்.') }
          : { tone: 'leaf', icon: 'pin', text: tr('Pinned on the map', 'வரைபடத்தில் பின் செய்யப்பட்டது') };

  return (
    <div className="addr-form">
      <LocationPicker value={draft.lat ? draft : null} origin={settings} zone={settings ? { lat: settings.lat, lng: settings.lng, radiusKm: settings.deliveryRadiusKm } : null}
        onChange={onPin} height={360} autoLocate={autoLocate} target={target} onConfirm={confirm}>
        {quote && (
          <span className="badge" data-tone={quote.deliverable ? 'leaf' : 'maroon'}>
            {quote.deliverable ? t('deliverable') : t('notDeliverable')} · {km(quote.distanceKm)}
          </span>
        )}
      </LocationPicker>

      <AnimatePresence>
        {trust && (
          <motion.p className="addr-trust" data-tone={trust.tone} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Icon name={trust.icon} size={16} /> {trust.text}
            {quote?.deliverable && <span className="grow" />}
            {quote?.deliverable && <span className="addr-fee">{quote.free ? tr('Free delivery', 'இலவச டெலிவரி') : tr('Delivery {f}', 'டெலிவரி {f}', { f: money(quote.fee) })}</span>}
          </motion.p>
        )}
      </AnimatePresence>
      {draft.lat && (
        <div className={`addr-confirm ${confirmed ? 'is-done' : ''}`}>
          {confirmed ? (
            <span><Icon name="check" size={16} /> {tr('You confirmed this is your door. The rider will come to this pin.', 'இதுதான் உங்கள் வாசல் என உறுதிசெய்தீர்கள். டெலிவரி பார்ட்னர் இந்த பின்னுக்கு வருவார்.')}</span>
          ) : (
            <>
              <span><Icon name="pin" size={16} /> {tr('Is the pin exactly on your house?', 'பின் சரியாக உங்கள் வீட்டின் மேல் உள்ளதா?')}</span>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => confirm()}>
                <Icon name="check" size={15} /> {tr('Yes, this is the right place', 'ஆம், இதுதான் சரியான இடம்')}
              </button>
            </>
          )}
        </div>
      )}

      <div className="addr-fields">
        <label className="field addr-door">
          <span className="field-label">{tr('House / flat no. & name', 'வீட்டு எண் & பெயர்')} <b className="req">*</b></span>
          <input className="input" value={draft.door} onChange={field('door')} placeholder={tr('12, Velan Illam', '12, வேலன் இல்லம்')} autoComplete="address-line1" />
        </label>
        <label className="field">
          <span className="field-label">{tr('Street', 'தெரு')}</span>
          <input className="input" value={draft.street} onChange={field('street')} placeholder={tr('Kovil Street', 'கோவில் தெரு')} autoComplete="address-line2" />
        </label>
        <label className="field">
          <span className="field-label">{tr('Area / village', 'பகுதி / ஊர்')}</span>
          <input className="input" value={draft.area} onChange={field('area')} placeholder={tr('Nerur, Karur', 'நெரூர், கரூர்')} autoComplete="address-level2" />
        </label>
        <label className="field addr-pin">
          <span className="field-label">{tr('Pincode', 'பின்கோடு')}</span>
          <input className="input num" inputMode="numeric" value={draft.pincode} onChange={field('pincode')} placeholder="639004" autoComplete="postal-code" />
        </label>
        <label className="field addr-wide">
          <span className="field-label">{t('landmark')} <small className="subtle">({t('optional')})</small></span>
          <input className="input" value={draft.landmark} onChange={field('landmark')} placeholder={tr('Opposite the Pillaiyar temple, blue gate', 'பிள்ளையார் கோவில் எதிரில், நீல கேட்')} />
        </label>
        <div className="addr-find addr-wide">
          <button type="button" className="btn btn-outline btn-sm" onClick={findOnMap} disabled={finding === 'busy'}>
            {finding === 'busy' ? <span className="spinner" style={{ width: 15, height: 15 }} /> : <Icon name="search" size={15} />} {tr('Find typed address on map', 'உள்ளிட்ட முகவரியை வரைபடத்தில் காட்டு')}
          </button>
          {finding && finding !== 'busy' && <small className="subtle">{finding}</small>}
        </div>
        <div className="addr-save addr-wide">
          <Seg size="sm" value={draft.label} onChange={(label) => setDraft((d) => ({ ...d, label }))}
            options={['home', 'work', 'other'].map((v) => ({ value: v, label: t(`label.${v}`) }))} />
          <label className="row subtle" style={{ fontSize: 13, gap: 8 }}>
            <Switch checked={saveAddr} onChange={setSaveAddr} label={tr('Save address', 'முகவரியைச் சேமி')} />
            {editing ? tr('Update my saved address', 'சேமித்த முகவரியைப் புதுப்பி') : tr('Save for next time', 'அடுத்த முறைக்கு சேமி')}
          </label>
        </div>
      </div>
    </div>
  );
}
