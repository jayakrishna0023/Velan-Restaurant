// Restaurant settings in tabs. Everything applies live — no restart.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import L from 'leaflet';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Switch, toast } from '@velan/shared/components/ui.jsx';
import { TILES, markerIcon } from '@velan/shared/map.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { storeStatus } from '@velan/shared/domain.js';
import { api } from '../api.js';
import { setSettings, useLive } from '../state/live.js';
import { BiField, Field, Page, PageHead } from '../components/common.jsx';

const TABS = [
  ['restaurant', 'store'], ['hours', 'clock'], ['delivery', 'scooter'], ['location', 'pin'], ['announcement', 'bell'], ['account', 'lock'],
];
const FIELDS = {
  restaurant: ['name', 'nameTa', 'tagline', 'taglineTa', 'about', 'aboutTa', 'address', 'addressTa', 'phone', 'whatsapp', 'email', 'instagram', 'upiId', 'fssai', 'gstin'],
  hours: ['openTime', 'closeTime', 'weeklyOff', 'enforceHours', 'isOpen'],
  delivery: ['deliveryRadiusKm', 'baseFee', 'baseKm', 'perKm', 'freeAbove', 'minOrder', 'packingCharge', 'gstPercent', 'avgPrepMins', 'autoAssign', 'riderPayBase', 'riderPayPerKm', 'acceptCash', 'acceptUpi'],
  location: ['lat', 'lng'],
  announcement: ['announcement'],
};

export default function Settings() {
  const Lg = useLang();
  const { t, tr } = Lg;
  const settings = useLive((s) => s.settings);
  const [tab, setTab] = useState('restaurant');
  const [f, setF] = useState(settings);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF((cur) => (cur && dirtyKeys(cur, settings).length ? cur : settings)); }, [settings]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const dirty = useMemo(() => (f && settings ? dirtyKeys(f, settings) : []), [f, settings]);

  const save = async () => {
    setBusy(true);
    try {
      const body = Object.fromEntries(dirty.map((k) => [k, f[k]]));
      const next = await api.put('/admin/settings', body);
      setSettings(next);
      setF(next);
      toast.success(tr('Settings saved — live on the website', 'அமைப்புகள் சேமிக்கப்பட்டன — இணையதளத்தில் உடனே'));
    } catch (e) { toast.error(Lg.error(e)); }
    setBusy(false);
  };

  const label = {
    restaurant: tr('Restaurant', 'உணவகம்'), hours: tr('Hours', 'நேரம்'), delivery: tr('Delivery & pricing', 'டெலிவரி & விலை'),
    location: tr('Location', 'இருப்பிடம்'), announcement: tr('Announcement', 'அறிவிப்பு'), account: tr('Account', 'கணக்கு'),
  };

  if (!f) return null;
  return (
    <Page className="settings-page">
      <PageHead title={t('nav.settings')} sub={tr('Changes apply instantly to the website, the rider app and this console.', 'மாற்றங்கள் இணையதளம், டெலிவரி ஆப், இந்த நிர்வாகத்தில் உடனே பொருந்தும்.')} />
      <div className="settings">
        <nav className="settings-nav">
          {TABS.map(([k, icon]) => {
            const changed = FIELDS[k]?.some((x) => dirty.includes(x));
            return (
              <button key={k} className={`settings-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
                {tab === k && <motion.span layoutId="settings-tab" className="settings-tab-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <Icon name={icon} size={17} />
                <span className="grow">{label[k]}</span>
                {changed && <i className="dirty-dot" />}
              </button>
            );
          })}
        </nav>
        <AnimatePresence mode="wait">
          <motion.div key={tab} className="settings-body panel" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22 }}>
            <h3 className="settings-title">{label[tab]}</h3>
            {tab === 'restaurant' && <RestaurantTab f={f} set={set} />}
            {tab === 'hours' && <HoursTab f={f} set={set} />}
            {tab === 'delivery' && <DeliveryTab f={f} set={set} />}
            {tab === 'location' && <LocationTab f={f} set={set} />}
            {tab === 'announcement' && <AnnouncementTab f={f} set={set} />}
            {tab === 'account' && <AccountTab />}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {dirty.length > 0 && (
          <motion.div className="save-bar" initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 90, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
            <Icon name="info" size={18} />
            <span className="grow">{tr(`${dirty.length} unsaved change${dirty.length > 1 ? 's' : ''}`, `${dirty.length} சேமிக்காத மாற்றம்`)}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setF(settings)}>{tr('Discard', 'கைவிடு')}</button>
            <button className="btn btn-gold btn-sm" onClick={save} disabled={busy}>{busy ? <span className="spinner" /> : <><Icon name="check" size={15} />{t('saveChanges')}</>}</button>
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  );
}

function dirtyKeys(a, b) {
  return Object.values(FIELDS).flat().filter((k) => JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null));
}

function RestaurantTab({ f, set }) {
  const { tr } = useLang();
  const text = (k, label, props = {}) => <Field label={label}><input className="input" value={f[k] || ''} onChange={(e) => set(k, e.target.value)} {...props} /></Field>;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <BiField label={tr('Restaurant name', 'உணவகப் பெயர்')} value={f} field="name" onChange={set} />
      <BiField label={tr('Tagline', 'குறிப்பு வாசகம்')} value={f} field="tagline" onChange={set} />
      <BiField label={tr('Our story (website)', 'எங்கள் கதை (இணையதளம்)')} value={f} field="about" onChange={set} textarea />
      <BiField label={tr('Address', 'முகவரி')} value={f} field="address" onChange={set} textarea />
      <div className="grid-2-tight">
        {text('phone', tr('Phone (shown to customers)', 'தொலைபேசி (வாடிக்கையாளருக்கு)'), { inputMode: 'tel', placeholder: '98765 43210' })}
        {text('whatsapp', 'WhatsApp', { inputMode: 'tel' })}
        {text('email', tr('Email', 'மின்னஞ்சல்'), { type: 'email' })}
        {text('instagram', 'Instagram', { placeholder: '@velanbiryani' })}
        {text('upiId', tr('UPI ID (for payments)', 'யுபிஐ ஐடி (பணம் பெற)'), { placeholder: 'velan@okaxis' })}
        {text('fssai', tr('FSSAI licence no.', 'FSSAI உரிம எண்'))}
        {text('gstin', 'GSTIN')}
      </div>
    </div>
  );
}

function HoursTab({ f, set }) {
  const L = useLang();
  const { tr, t, hhmm } = L;
  const st = storeStatus(f);
  const reason = { paused: t('paused'), hours: tr('Closed — outside opening hours', 'மூடப்பட்டுள்ளது — நேரத்திற்கு வெளியே'), weeklyOff: tr('Closed — weekly holiday', 'மூடப்பட்டுள்ளது — வார விடுமுறை') };
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className={`status-preview ${st.open ? 'open' : 'closed'}`}>
        <span className="dot" />
        <div className="grow">
          <span className="subtle small">{tr('Customers see right now', 'இப்போது வாடிக்கையாளர்கள் காண்பது')}</span>
          <b>{st.open ? `${t('openNow')} · ${t('closesAt', { time: hhmm(f.closeTime) })}` : reason[st.reason]}</b>
        </div>
      </div>
      <label className="flag-card on-off">
        <Icon name="power" size={18} />
        <span className="grow"><b>{tr('Taking orders', 'ஆர்டர்கள் ஏற்கிறது')}</b><span className="subtle small block">{tr('Master switch — also in the top bar.', 'முதன்மை சுவிட்ச் — மேல் பட்டியிலும் உள்ளது.')}</span></span>
        <Switch checked={f.isOpen} onChange={(v) => set('isOpen', v)} label="open" />
      </label>
      <div className="grid-3-tight">
        <Field label={tr('Opens at', 'திறக்கும் நேரம்')}><input type="time" className="input" value={f.openTime} onChange={(e) => set('openTime', e.target.value)} /></Field>
        <Field label={tr('Closes at', 'மூடும் நேரம்')}><input type="time" className="input" value={f.closeTime} onChange={(e) => set('closeTime', e.target.value)} /></Field>
        <Field label={tr('Weekly holiday', 'வார விடுமுறை')}>
          <select className="select" value={f.weeklyOff ?? ''} onChange={(e) => set('weeklyOff', e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">{tr('None — open all week', 'இல்லை — வாரம் முழுவதும்')}</option>
            {[0, 1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{L.dayName(d, false)}</option>)}
          </select>
        </Field>
      </div>
      <label className="flag-card">
        <Icon name="clock" size={18} />
        <span className="grow"><b>{tr('Close automatically outside these hours', 'இந்த நேரத்திற்கு வெளியே தானாக மூடு')}</b><span className="subtle small block">{tr('When off, the website takes orders whenever the master switch is on.', 'அணைத்திருந்தால், முதன்மை சுவிட்ச் இயங்கும் வரை ஆர்டர்கள் வரும்.')}</span></span>
        <Switch checked={f.enforceHours} onChange={(v) => set('enforceHours', v)} label="hours" />
      </label>
    </div>
  );
}

function DeliveryTab({ f, set }) {
  const L = useLang();
  const { tr, money, km } = L;
  const n = (k, label, suffix) => (
    <Field label={label}>
      <div className="input-suffix"><input className="input num" inputMode="decimal" value={f[k] ?? ''} onChange={(e) => set(k, e.target.value === '' ? '' : Number(e.target.value.replace(/[^\d.]/g, '')))} />{suffix && <span>{suffix}</span>}</div>
    </Field>
  );
  const fee = (d, sub) => (f.freeAbove > 0 && sub >= f.freeAbove ? 0 : Number(f.baseFee) + Math.max(0, Math.ceil(d - f.baseKm)) * Number(f.perKm));
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="grid-3-tight">
        {n('deliveryRadiusKm', tr('Delivery radius', 'டெலிவரி வரம்பு'), 'km')}
        {n('baseFee', tr('Base fee', 'அடிப்படைக் கட்டணம்'), '₹')}
        {n('baseKm', tr('Base fee covers', 'அடிப்படை தூரம்'), 'km')}
        {n('perKm', tr('Per extra km', 'கூடுதல் கி.மீ.க்கு'), '₹')}
        {n('freeAbove', tr('Free delivery above', 'இலவச டெலிவரி — மேல்'), '₹')}
        {n('minOrder', tr('Minimum order', 'குறைந்தபட்ச ஆர்டர்'), '₹')}
        {n('packingCharge', tr('Packing charge', 'பேக்கிங் கட்டணம்'), '₹')}
        {n('gstPercent', tr('GST', 'ஜிஎஸ்டி'), '%')}
        {n('avgPrepMins', tr('Default kitchen time', 'இயல்பு சமையல் நேரம்'), tr('min', 'நிமி'))}
      </div>
      <div className="fee-preview">
        <span className="subtle small">{tr('Fee preview for a ₹250 order', '₹250 ஆர்டருக்கான கட்டணம்')}</span>
        <div className="fee-row">
          {[1, 3, 5, 8, Number(f.deliveryRadiusKm) || 10].map((d, i) => (
            <div key={i} className={d > f.deliveryRadiusKm ? 'out' : ''}><span className="subtle small">{km(d)}</span><b className="num">{d > f.deliveryRadiusKm ? '—' : money(fee(d, 250))}</b></div>
          ))}
        </div>
      </div>
      <h4 className="os-label">{tr('Payments', 'பணம் செலுத்துதல்')}</h4>
      <div className="flag-grid">
        <label className={`flag-card ${f.acceptCash ? 'on' : ''}`}><Icon name="cash" size={18} /><span className="grow">{tr('Cash on delivery', 'டெலிவரியில் ரொக்கம்')}</span><Switch checked={f.acceptCash} onChange={(v) => set('acceptCash', v)} label="cash" /></label>
        <label className={`flag-card ${f.acceptUpi ? 'on' : ''}`}><Icon name="phoneDevice" size={18} /><span className="grow">{tr('UPI on delivery', 'டெலிவரியில் யுபிஐ')}</span><Switch checked={f.acceptUpi} onChange={(v) => set('acceptUpi', v)} label="upi" /></label>
      </div>
      <h4 className="os-label">{tr('Delivery team', 'டெலிவரி குழு')}</h4>
      <label className={`flag-card ${f.autoAssign ? 'on' : ''}`}>
        <Icon name="zap" size={18} />
        <span className="grow"><b>{tr('Auto-assign riders', 'தானியங்கி ஒதுக்கீடு')}</b><span className="subtle small block">{tr('When an order is accepted, give it to the nearest free rider.', 'ஆர்டர் ஏற்றதும் அருகில் உள்ள காலியான பார்ட்னருக்கு வழங்கு.')}</span></span>
        <Switch checked={f.autoAssign} onChange={(v) => set('autoAssign', v)} label="auto" />
      </label>
      <div className="grid-3-tight">
        {n('riderPayBase', tr('Rider pay per delivery', 'ஒரு டெலிவரிக்கு ஊதியம்'), '₹')}
        {n('riderPayPerKm', tr('Rider pay per km', 'கி.மீ.க்கு ஊதியம்'), '₹')}
        <div className="fee-mini"><span className="subtle small">{tr('A 4 km delivery pays', '4 கி.மீ டெலிவரிக்கு')}</span><b className="num">{money(Number(f.riderPayBase) + Number(f.riderPayPerKm) * 4)}</b></div>
      </div>
    </div>
  );
}

function LocationTab({ f, set }) {
  const { tr } = useLang();
  const el = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const circle = useRef(null);
  const cb = useRef(set);
  cb.current = set;
  const straight = (km) => (Number(km) || 0) * 1000 / 1.25;

  useEffect(() => {
    const m = L.map(el.current, { zoomControl: true }).setView([f.lat, f.lng], 13);
    L.tileLayer(TILES.street.url, { attribution: TILES.street.attribution, maxZoom: 19 }).addTo(m);
    m.getContainer().classList.add('map-tone');
    circle.current = L.circle([f.lat, f.lng], { radius: straight(f.deliveryRadiusKm), color: '#d62b1e', weight: 2, fillColor: '#d62b1e', fillOpacity: 0.09, dashArray: '6 8' }).addTo(m);
    marker.current = L.marker([f.lat, f.lng], { draggable: true, icon: markerIcon({ kind: 'store', label: tr('Drag me', 'என்னை இழுக்கவும்') }) }).addTo(m);
    marker.current.on('drag', (e) => circle.current.setLatLng(e.target.getLatLng()));
    marker.current.on('dragend', (e) => {
      const p = e.target.getLatLng();
      cb.current('lat', Number(p.lat.toFixed(7)));
      cb.current('lng', Number(p.lng.toFixed(7)));
    });
    m.fitBounds(circle.current.getBounds(), { padding: [16, 16] });
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    // The tab slides in; fit again once it has its final size.
    const settle = setTimeout(() => { m.invalidateSize(); m.fitBounds(circle.current.getBounds(), { padding: [16, 16] }); }, 450);
    return () => { clearTimeout(settle); ro.disconnect(); m.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    marker.current?.setLatLng([f.lat, f.lng]);
    circle.current?.setLatLng([f.lat, f.lng]);
  }, [f.lat, f.lng]);
  useEffect(() => { circle.current?.setRadius(straight(f.deliveryRadiusKm)); }, [f.deliveryRadiusKm]);

  const here = () => navigator.geolocation?.getCurrentPosition((p) => {
    set('lat', Number(p.coords.latitude.toFixed(7)));
    set('lng', Number(p.coords.longitude.toFixed(7)));
    map.current?.flyTo([p.coords.latitude, p.coords.longitude], 16);
  }, () => toast.error(tr('Location permission is off', 'இருப்பிட அனுமதி இல்லை')), { enableHighAccuracy: true });

  return (
    <div className="stack" style={{ gap: 14 }}>
      <p className="muted">{tr('Drag the pin to the shop entrance. All distances and delivery fees are measured from here. The dashed circle is your delivery area.', 'பின்னை கடை வாசலுக்கு இழுக்கவும். அனைத்து தூரமும் கட்டணமும் இங்கிருந்தே கணக்கிடப்படும். புள்ளிக்கோட்டு வட்டம் டெலிவரி பகுதி.')}</p>
      <div ref={el} className="loc-map" />
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-soft btn-sm" onClick={here}><Icon name="locate" size={15} />{tr('I am at the shop — use my location', 'நான் கடையில் உள்ளேன் — என் இருப்பிடம்')}</button>
        <span className="subtle small num">{f.lat?.toFixed?.(6)}, {f.lng?.toFixed?.(6)}</span>
      </div>
    </div>
  );
}

function AnnouncementTab({ f, set }) {
  const { tr, ta } = useLang();
  const a = f.announcement || { active: false, text: '', textTa: '' };
  const upd = (k, v) => set('announcement', { ...a, [k]: v });
  return (
    <div className="stack" style={{ gap: 16 }}>
      <p className="muted">{tr('A thin banner at the top of the website — for specials, holidays or delays.', 'இணையதளத்தின் மேல் ஒரு சிறு அறிவிப்பு — சிறப்பு உணவு, விடுமுறை, தாமதம்.')}</p>
      <label className={`flag-card ${a.active ? 'on' : ''}`}><Icon name="bell" size={18} /><span className="grow">{tr('Show the banner', 'அறிவிப்பைக் காட்டு')}</span><Switch checked={a.active} onChange={(v) => upd('active', v)} label="active" /></label>
      <BiField label={tr('Message', 'செய்தி')} value={a} field="text" onChange={upd} placeholder={['Sunday special: Mutton biryani', 'ஞாயிறு ஸ்பெஷல்: மட்டன் பிரியாணி']} />
      <div className="field">
        <span className="field-label">{tr('Preview', 'முன்னோட்டம்')}</span>
        <div className={`announce-preview ${a.active ? '' : 'off'}`}>
          <Icon name="sparkles" size={15} />
          <span>{(ta ? a.textTa || a.text : a.text) || tr('Your message here', 'உங்கள் செய்தி இங்கே')}</span>
        </div>
      </div>
    </div>
  );
}

function AccountTab() {
  const L = useLang();
  const { t, tr } = L;
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (f.next !== f.again) { toast.error(tr('The new passwords do not match', 'புதிய கடவுச்சொற்கள் பொருந்தவில்லை')); return; }
    setBusy(true);
    try {
      await api.post('/auth/password', { current: f.current, next: f.next });
      toast.success(tr('Password changed', 'கடவுச்சொல் மாற்றப்பட்டது'));
      setF({ current: '', next: '', again: '' });
    } catch (err) { toast.error(L.error(err)); }
    setBusy(false);
  };
  return (
    <form className="stack" style={{ gap: 14, maxWidth: 420 }} onSubmit={submit}>
      <Field label={tr('Current password', 'தற்போதைய கடவுச்சொல்')}><input className="input" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required /></Field>
      <Field label={tr('New password', 'புதிய கடவுச்சொல்')} hint={t('err.PASSWORD_SHORT')}><input className="input" type="password" autoComplete="new-password" minLength={6} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} required /></Field>
      <Field label={tr('New password again', 'புதிய கடவுச்சொல் மீண்டும்')}><input className="input" type="password" autoComplete="new-password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} required /></Field>
      <div><button className="btn btn-primary" disabled={busy}>{busy ? <span className="spinner" /> : <><Icon name="key" size={16} />{tr('Change password', 'கடவுச்சொல்லை மாற்று')}</>}</button></div>
    </form>
  );
}
