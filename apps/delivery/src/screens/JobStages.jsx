// The three stages of a delivery job.
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { useNow } from '@velan/shared/hooks.js';
import { roadKm } from '@velan/shared/domain.js';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { OtpInput, SlideToConfirm, StatusBadge, VegMark, toast } from '@velan/shared/components/ui.jsx';
import { MapView, fetchRoute, googleMapsUrl } from '@velan/shared/map.jsx';
import { sound, vibrate } from '@velan/shared/effects.js';
import { useRider, storePoint } from '../RiderProvider.jsx';
import { metersBetween } from '../lib/geo.js';
import { telHref, waHref } from '../lib/tel.js';
import KitchenTimer from '../components/KitchenTimer.jsx';

const CHECK_KEY = 'velan.rider.checks';
const readChecks = (id) => { try { return JSON.parse(sessionStorage.getItem(CHECK_KEY) || '{}')[id] || {}; } catch { return {}; } };
const saveChecks = (id, v) => {
  try {
    const all = JSON.parse(sessionStorage.getItem(CHECK_KEY) || '{}');
    all[id] = v;
    sessionStorage.setItem(CHECK_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
};

/** Road route that refreshes when the rider drifts far from where it was planned. */
function useLiveRoute(from, to, { replanMeters = 600, frozen = false } = {}) {
  const [route, setRoute] = useState(null);
  const origin = useRef(null);
  useEffect(() => {
    if (!from || !to) return undefined;
    if (route && origin.current && (frozen || metersBetween(origin.current, from) < replanMeters)) return undefined;
    origin.current = from;
    let live = true;
    fetchRoute(from, to).then((r) => { if (live) setRoute(r); });
    return () => { live = false; };
  }, [from?.lat, from?.lng, to?.lat, to?.lng, frozen, replanMeters]); // eslint-disable-line react-hooks/exhaustive-deps
  return route;
}

function MapBox({ markers, route, onFullMap, fitKey, height = 220 }) {
  const { t } = useLang();
  return (
    <div className="r-mapbox" style={{ height }}>
      <MapView className="r-map" style={{ position: 'absolute', inset: 0 }} markers={markers} route={route?.coords} fitKey={fitKey} controls={false} padding={36}
        onMap={(m) => m.scrollWheelZoom.disable()} />
      <button type="button" className="r-map-btn" onClick={onFullMap}><Icon name="maximize" size={16} /> {t('fullMap')}</button>
    </div>
  );
}

// ---------- 1. pick up at the kitchen ----------

export function PickupStage({ order, onFullMap }) {
  const { t, pick, other } = useLang();
  const { settings, position, pickUp } = useRider();
  const store = storePoint(settings);
  const route = useLiveRoute(position, store, { replanMeters: 800 });
  const [checked, setChecked] = useState(() => readChecks(order.id));
  useEffect(() => saveChecks(order.id, checked), [order.id, checked]);
  const now = useNow(15000);

  const done = order.items.filter((it) => checked[it.id]).length;
  const prepTotal = order.acceptedAt && order.readyBy ? new Date(order.readyBy) - new Date(order.acceptedAt) : 0;
  const prepDone = order.status === 'ready' ? 1 : prepTotal ? Math.min(1, Math.max(0, (now - new Date(order.acceptedAt)) / prepTotal)) : 0;
  const markers = [
    store && { id: 'store', kind: 'store', ...store },
    position && { id: 'me', kind: 'rider', lat: position.lat, lng: position.lng, heading: position.heading },
  ].filter(Boolean);
  const toggle = (id) => { vibrate(15); setChecked((c) => ({ ...c, [id]: !c[id] })); };

  return (
    <>
      <section className="r-card r-kitchen-card">
        <div className="row">
          <span className="r-icon-chip"><Icon name="chefHat" size={18} /></span>
          <b className="grow">{t('kitchen')}</b>
          <StatusBadge order={order} live />
        </div>
        <KitchenTimer order={order} big />
        <div className="r-prep"><motion.span initial={{ scaleX: 0 }} animate={{ scaleX: prepDone }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} /></div>
      </section>

      {store && <MapBox markers={markers} route={route} onFullMap={onFullMap} fitKey={`${route ? 'r' : 'n'}-${Boolean(position)}`} />}

      <section className="r-card r-place">
        <span className="r-stop-dot store"><Icon name="store" size={14} /></span>
        <div className="grow">
          <small>{t('pickupFrom')}</small>
          <b>{pick(settings, 'name')}</b>
          <span className="clamp-2">{pick(settings, 'address')}</span>
        </div>
      </section>
      <div className="r-actions">
        <a className={`btn btn-soft ${settings?.phone ? '' : 'is-disabled'}`} href={telHref(settings?.phone)}>
          <Icon name="phone" size={18} /> {t('callRestaurant')}
        </a>
        {store && (
          <a className="btn btn-soft" href={googleMapsUrl(store, null, { navigate: true })} target="_blank" rel="noreferrer">
            <Icon name="navigation" size={18} /> {t('openMaps')}
          </a>
        )}
      </div>

      <section className="r-card r-checklist">
        <div className="row">
          <b className="grow">{t('checklist')}</b>
          <span className={`r-check-count ${done === order.items.length ? 'all' : ''}`}>{done}/{order.items.length}</span>
        </div>
        <p className="subtle">{done === order.items.length ? t('checkedAll') : t('checklistHint')}</p>
        <ul>
          {order.items.map((it) => (
            <li key={it.id}>
              <button type="button" className={checked[it.id] ? 'on' : ''} onClick={() => toggle(it.id)} aria-pressed={!!checked[it.id]}>
                <motion.span className="r-tick" animate={{ scale: checked[it.id] ? [1, 1.25, 1] : 1 }}><Icon name="check" size={15} stroke={3} /></motion.span>
                <VegMark veg={it.veg} />
                <span className="grow">
                  <span className="r-item-name">{pick(it, 'name')}</span>
                  {other(it, 'name') && <small>{other(it, 'name')}</small>}
                  {it.note && <em>“{it.note}”</em>}
                </span>
                <b className="num">× {it.qty}</b>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {order.notes && <p className="r-note"><Icon name="message" size={16} /> <span><b>{t('note')}:</b> {order.notes}</span></p>}

      <div className="r-sheet-foot">
        {order.status !== 'ready' && <p className="r-warn"><Icon name="info" size={16} /> {t('notReady')}</p>}
        <SlideToConfirm label={t('slidePickup')} onConfirm={() => pickUp(order)} />
      </div>
    </>
  );
}

// ---------- 2. drive to the customer ----------

/** How the customer set their pin, and how far the rider should trust it. */
function pinTrust(dest, tr) {
  if (!dest) return null;
  if (dest.confirmed && dest.source === 'gps' && dest.accuracy) return { tone: 'leaf', text: tr('Customer confirmed this pin is their door (GPS ±{m} m)', 'இந்த பின் தங்கள் வாசல் என வாடிக்கையாளர் உறுதிசெய்தார் (GPS ±{m} மீ)', { m: dest.accuracy }) };
  if (dest.confirmed) return { tone: 'leaf', text: tr('Customer confirmed this pin is their door', 'இந்த பின் தங்கள் வாசல் என வாடிக்கையாளர் உறுதிசெய்தார்') };
  if (dest.source === 'gps' && dest.accuracy && dest.accuracy <= 60) return { tone: 'leaf', text: tr('Pin set by the customer’s GPS (±{m} m) — reliable', 'வாடிக்கையாளர் GPS மூலம் பின் (±{m} மீ) — நம்பகமானது', { m: dest.accuracy }) };
  if (dest.source === 'gps') return { tone: 'saffron', text: tr('Pin from a weak GPS fix (±{m} m) — call if unsure', 'பலவீனமான GPS பின் (±{m} மீ) — சந்தேகம் இருந்தால் அழையுங்கள்', { m: dest.accuracy || '?' }) };
  if (dest.source === 'link') return { tone: 'leaf', text: tr('Pin from the customer’s map link', 'வாடிக்கையாளரின் வரைபட இணைப்பிலிருந்து பின்') };
  if (dest.source === 'manual' || dest.source === 'search') return { tone: 'saffron', text: tr('Pin placed from a typed address — confirm by phone near the area', 'உள்ளிட்ட முகவரியிலிருந்து பின் — அருகில் வந்ததும் அழைத்து உறுதிசெய்யுங்கள்') };
  return { tone: 'leaf', text: tr('Customer placed the pin on the map', 'வாடிக்கையாளர் வரைபடத்தில் பின் செய்தார்') };
}

export function DriveStage({ order, onArrived, onFullMap }) {
  const { t, tr, km, mins } = useLang();
  const { settings, position, sim, startSim, stopSim, demo, arrive, me } = useRider();
  const dest = order.address;
  const from = position || storePoint(settings);
  const simming = sim?.orderId === order.id;
  const route = useLiveRoute(from, dest, { frozen: simming });
  const [busy, setBusy] = useState(false);
  const away = from && dest ? roadKm(from, dest) : null;
  const metres = position && dest ? Math.round(metersBetween(position, dest)) : null;
  const near = metres != null && metres <= 120;
  const trust = pinTrust(dest, tr);
  const etaMin = away != null ? Math.max(1, Math.round(away * 3 + 1)) : null;
  const wa = waHref(order.phone, tr(
    'Hello {c}, this is {r} from Velan Biryani Center with your order #{n}. I am about {m} min away.',
    'வணக்கம் {c}, நான் வேலன் பிரியாணி சென்டரிலிருந்து {r}, உங்கள் ஆர்டர் #{n} உடன் வருகிறேன். சுமார் {m} நிமிடத்தில் வருவேன்.',
    { c: order.customerName.split(' ')[0], r: me?.name?.split(' ')[0] || 'your rider', n: order.number, m: etaMin ?? 10 },
  ));
  const fullAddress = [dest?.door && !dest.line.includes(dest.door) ? dest.door : '', dest?.line, dest?.pincode, dest?.landmark].filter(Boolean).join(', ');
  const copy = async () => {
    try { await navigator.clipboard.writeText(fullAddress); vibrate(20); toast.success(tr('Address copied', 'முகவரி நகலெடுக்கப்பட்டது')); } catch { /* ignore */ }
  };
  const arrived = () => { vibrate(30); arrive(order); onArrived(); };
  const markers = [
    dest && { id: 'home', kind: 'home', lat: dest.lat, lng: dest.lng, label: order.customerName.split(' ')[0] },
    position && { id: 'me', kind: 'rider', lat: position.lat, lng: position.lng, heading: position.heading },
    !position && settings && { id: 'store', kind: 'store', ...storePoint(settings) },
  ].filter(Boolean);

  const simulate = async () => {
    if (simming) { stopSim(); return; }
    setBusy(true);
    try { await startSim(order); } finally { setBusy(false); }
  };

  return (
    <>
      <section className="r-eta">
        <div>
          <small>{t('deliverTo')}</small>
          <b className="display">{order.customerName}</b>
        </div>
        {away != null && (
          <div className="r-eta-num">
            <b className="num">{mins(away * 3 + 1)}</b>
            <small className="num">{km(away)}</small>
          </div>
        )}
      </section>

      <MapBox markers={markers} route={route} onFullMap={onFullMap} height={260} fitKey={`${route ? 'r' : 'n'}-${simming}`} />

      {demo && (
        <div className="r-demo">
          <button type="button" className={`btn btn-sm ${simming ? 'btn-danger' : 'btn-outline'}`} onClick={simulate} disabled={busy}>
            {busy ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Icon name={simming ? 'x' : 'navigation'} size={16} />}
            {simming ? t('stopSim') : t('simulate')}
          </button>
          {simming && (
            <div className="r-demo-bar"><motion.span animate={{ scaleX: sim.progress }} transition={{ duration: 1.1, ease: 'linear' }} /></div>
          )}
          {simming && <small className="subtle">{sim.done ? t('arrived') : t('simulating')}</small>}
        </div>
      )}

      {metres != null && (
        <p className={`r-near ${near ? 'is-near' : ''}`}>
          <Icon name={near ? 'home' : 'navigation'} size={16} />
          {near ? tr('You are {m} m from the door pin', 'வாசல் பின்னிலிருந்து {m} மீ தொலைவில் உள்ளீர்கள்', { m: metres })
            : metres < 1000 ? tr('{m} m to the door', 'வாசலுக்கு {m} மீ', { m: metres }) : tr('{k} to the door', 'வாசலுக்கு {k}', { k: km(Math.round(metres / 100) / 10) })}
        </p>
      )}

      <section className="r-card r-place r-dest">
        <span className="r-stop-dot home"><Icon name="home" size={14} /></span>
        <div className="grow">
          <small>{t(`label.${dest?.label || 'home'}`)}</small>
          {dest?.door && <b className="r-door">{dest.door}</b>}
          <b>{dest?.door ? [dest.street, dest.area].filter(Boolean).join(', ') || dest.line : dest?.line}</b>
          {dest?.pincode && <span className="num">{tr('Pincode {p}', 'பின்கோடு {p}', { p: dest.pincode })}</span>}
          {dest?.landmark && <span><Icon name="pin" size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> {dest.landmark}</span>}
          {trust && <span className="r-trust" data-tone={trust.tone}>{trust.text}</span>}
        </div>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={copy} aria-label={tr('Copy address', 'முகவரியை நகலெடு')}><Icon name="copy" size={16} /></button>
      </section>
      {order.notes && <p className="r-note"><Icon name="message" size={16} /> <span><b>{t('note')}:</b> {order.notes}</span></p>}
      <div className="r-actions r-actions-3">
        <a className={`btn btn-soft ${order.phone ? '' : 'is-disabled'}`} href={telHref(order.phone)}>
          <Icon name="phone" size={18} /> {t('callCustomer')}
        </a>
        <a className={`btn btn-soft ${wa ? '' : 'is-disabled'}`} href={wa} target="_blank" rel="noreferrer">
          <Icon name="message" size={18} /> WhatsApp
        </a>
        {dest && (
          <a className="btn btn-soft" href={googleMapsUrl(dest, null, { navigate: true })} target="_blank" rel="noreferrer">
            <Icon name="navigation" size={18} /> {t('openMaps')}
          </a>
        )}
      </div>

      <div className="r-sheet-foot">
        <motion.button type="button" className={`btn btn-gold btn-lg btn-block ${near ? 'r-pulse' : ''}`} whileTap={{ scale: 0.97 }} onClick={arrived}>
          <Icon name="pin" size={20} /> {order.arrivedAt ? t('arrived') : tr('I’ve arrived — tell the customer', 'வந்துவிட்டேன் — வாடிக்கையாளருக்குச் சொல்')}
        </motion.button>
      </div>
    </>
  );
}

// ---------- 3. hand over with the OTP ----------

export function HandoverStage({ order, onBack }) {
  const { t, money, error, pick } = useLang();
  const { settings, deliver } = useRider();
  const [busy, setBusy] = useState(false);
  const [fails, setFails] = useState(0);
  const [err, setErr] = useState(null);
  const paid = order.payment.status === 'paid';
  const cash = order.payment.method === 'cash';
  const upi = settings?.upiId
    ? `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(settings.name)}&am=${order.bill.total}&cu=INR&tn=${encodeURIComponent(`Velan order ${order.number}`)}`
    : null;

  const submit = async (code) => {
    setBusy(true);
    setErr(null);
    try {
      await deliver(order, code);
    } catch (e) {
      setErr(e);
      setFails((f) => f + 1);
      sound.error();
      vibrate([90, 60, 90]);
      setBusy(false);
    }
  };

  return (
    <>
      <motion.section className={`r-collect ${paid ? 'paid' : cash ? 'cash' : 'upi'}`} initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <span className="r-collect-icon"><Icon name={paid ? 'checkCircle' : cash ? 'cash' : 'phoneDevice'} size={24} /></span>
        <small>{paid ? t('alreadyPaid') : cash ? t('collectCash') : t('collectUpi')}</small>
        {!paid && <b className="num">{money(order.bill.total)}</b>}
        {!paid && !cash && settings?.upiId && <span className="r-upi-id">{t('upiTo', { id: settings.upiId })}</span>}
        {!paid && !cash && upi && <a className="btn btn-sm btn-gold" href={upi}><Icon name="phoneDevice" size={16} /> {t('openUpi')}</a>}
      </motion.section>

      <details className="r-card r-mini-items">
        <summary><Icon name="bag" size={16} /> {t('items', { n: order.items.reduce((s, i) => s + i.qty, 0) })}<Icon name="chevronDown" size={16} /></summary>
        <ul>{order.items.map((it) => <li key={it.id}><span>{pick(it, 'name')}</span><b className="num">× {it.qty}</b></li>)}</ul>
      </details>

      <section className="r-otp-card">
        <span className="r-icon-chip big"><Icon name="key" size={22} /></span>
        <h3>{t('enterOtp')}</h3>
        <OtpInput onComplete={submit} error={fails} disabled={busy} />
        {busy && <p className="subtle row" style={{ justifyContent: 'center' }}><span className="spinner" style={{ width: 16, height: 16 }} /> {t('checking')}</p>}
        {err && !busy && <motion.p className="r-otp-err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}><Icon name="alert" size={16} /> {error(err)}</motion.p>}
        <p className="subtle r-otp-hint">{t('otpHint')}</p>
      </section>

      <button type="button" className="btn btn-ghost btn-block" onClick={onBack}><Icon name="arrowLeft" size={18} /> {t('backToDrive')}</button>
    </>
  );
}
