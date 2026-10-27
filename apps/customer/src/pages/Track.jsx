import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Ring, Seg, Stars, VegMark, toast, confirmDialog } from '@velan/shared/components/ui.jsx';
import { MapView, fetchRoute, googleEmbedUrl, googleMapsUrl, googlePlaceUrl } from '@velan/shared/map.jsx';
import { snapToRoute } from '@velan/shared/geo.js';
import { stepsFor, isActive, haversineKm } from '@velan/shared/domain.js';
import { useNow, initials } from '@velan/shared/hooks.js';
import { useSocketEvent } from '@velan/shared/realtime.js';
import { askNotify, sound } from '@velan/shared/effects.js';
import { api, useSession, requireLogin } from '../state/session.js';
import { useSite } from '../state/site.js';
import { useOrders, trackOrderUpdate } from '../state/orders.js';
import { reorder, openCart } from '../state/cart.js';
import StatusArt from '../components/StatusArt.jsx';
import { BillRows } from '../components/Bill.jsx';

const STEP_ICON = { placed: 'receipt', accepted: 'checkCircle', preparing: 'pot', ready: 'bag', out_for_delivery: 'scooter', delivered: 'home' };
const TAGS = [['Hot & fresh', 'சூடாக, புதிதாக'], ['Great taste', 'அருமையான சுவை'], ['Good quantity', 'நல்ல அளவு'], ['Neat packing', 'நேர்த்தியான பேக்கிங்'], ['Polite rider', 'பண்பான டெலிவரி'], ['On time', 'சரியான நேரம்']];

function Countdown({ to, total }) {
  const { tr } = useLang();
  const now = useNow(1000);
  const left = Math.max(0, new Date(to) - now);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <Ring value={total ? 1 - left / (total * 60000) : 0} size={92} stroke={7} color="var(--gold-400)" track="rgba(255,255,255,.12)">
      <span className="cd-num num">{left ? `${m}:${String(s).padStart(2, '0')}` : tr('Soon', 'விரைவில்')}</span>
    </Ring>
  );
}

/** How fresh and how exact the rider's position is: live GPS, set by hand, or last seen a while ago. */
function RiderFreshness({ rider, snapped }) {
  const { tr } = useLang();
  const now = useNow(5000);
  const secs = rider.at ? Math.max(0, Math.round((now - new Date(rider.at)) / 1000)) : null;
  const ago = secs == null ? '' : secs < 60 ? tr('{s} s ago', '{s} வி முன்', { s: secs }) : tr('{m} min ago', '{m} நிமி முன்', { m: Math.round(secs / 60) });
  const stale = secs != null && secs > 75;
  let text;
  if (rider.source === 'manual') text = tr('The rider set their location by hand · {ago}', 'டெலிவரி பார்ட்னர் இருப்பிடத்தைக் கையால் அமைத்தார் · {ago}', { ago });
  else if (stale) text = tr('Last seen {ago}. The rider may be in a low-signal spot.', 'கடைசியாக {ago} பார்க்கப்பட்டது. சிக்னல் குறைவான இடத்தில் இருக்கலாம்.', { ago });
  else text = [tr('Live GPS · updated {ago}', 'நேரலை GPS · {ago} புதுப்பிக்கப்பட்டது', { ago }), rider.accuracy ? `±${rider.accuracy} m` : '', snapped ? tr('on the road', 'சாலையில்') : ''].filter(Boolean).join(' · ');
  return (
    <p className={`tk-fresh ${stale ? 'is-stale' : ''} ${rider.source === 'manual' ? 'is-manual' : ''}`}>
      <i className="tk-fresh-dot" /> {text}
    </p>
  );
}

function RateCard({ order }) {
  const { t, tr, ta } = useLang();
  const [food, setFood] = useState(0);
  const [del, setDel] = useState(0);
  const [tags, setTags] = useState([]);
  const [review, setReview] = useState('');
  const [busy, setBusy] = useState(false);
  if (order.rating) {
    return (
      <div className="card tk-card rate-done">
        <Icon name="heart" size={22} className="gold" />
        <div><strong>{t('rateThanks')}</strong><Stars value={order.rating.food} size={16} /></div>
      </div>
    );
  }
  const submit = async () => {
    setBusy(true);
    try {
      const o = await api.post(`/orders/${order.id}/rate`, { food, delivery: del || undefined, review, tags });
      trackOrderUpdate(o);
      toast.success(t('rateThanks'));
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <motion.div className="card tk-card rate" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <h3 className="display">{t('rateTitle')}</h3>
      <div className="rate-row"><span>{t('rateFood')}</span><Stars value={food} onChange={setFood} size={30} /></div>
      {order.type === 'delivery' && <div className="rate-row"><span>{t('rateDelivery')}</span><Stars value={del} onChange={setDel} size={30} /></div>}
      <div className="rate-tags">
        {TAGS.map(([en, tam]) => {
          const label = ta ? tam : en;
          const on = tags.includes(en);
          return <button key={en} type="button" className="chip" aria-pressed={on} onClick={() => setTags(on ? tags.filter((x) => x !== en) : [...tags, en])}>{label}</button>;
        })}
      </div>
      <textarea className="textarea" rows={3} value={review} onChange={(e) => setReview(e.target.value)} placeholder={tr('Tell us what you loved (or what we can fix)…', 'பிடித்ததைச் சொல்லுங்கள் (அல்லது சரிசெய்ய வேண்டியதை)…')} />
      <button type="button" className="btn btn-primary" disabled={!food || busy} onClick={submit}>{busy ? <span className="spinner" /> : tr('Submit review', 'சமர்ப்பி')}</button>
    </motion.div>
  );
}

export default function Track() {
  const { id } = useParams();
  const { state: navState } = useLocation();
  const navigate = useNavigate();
  const { t, tr, pick, money, km, time, dateTime, status, error } = useLang();
  const user = useSession((s) => s.user);
  const ready = useSession((s) => s.ready);
  const settings = useSite((s) => s.settings);
  const cached = useOrders((s) => s.list.find((o) => o.id === id));
  const [order, setOrder] = useState(cached || null);
  const [failed, setFailed] = useState(null);
  const [rider, setRider] = useState(null);
  const [route, setRoute] = useState(null);
  const [view, setView] = useState('live');
  const lastRouteAt = useRef({ t: 0, at: null });
  const prevStatus = useRef(order?.status);

  useEffect(() => { if (ready && !user) requireLogin(); }, [ready, user]);
  useEffect(() => {
    if (!user) return;
    api.get(`/orders/${id}`).then((o) => { setOrder(o); setRider(o.riderLocation || null); trackOrderUpdate(o); }).catch(setFailed);
  }, [id, user]);
  useEffect(() => { if (cached) setOrder((o) => ({ ...o, ...cached })); }, [cached]);

  useSocketEvent('order:update', (o) => { if (o.id === id) { setOrder(o); if (o.riderLocation) setRider(o.riderLocation); } });
  useSocketEvent('rider:location', (p) => { if (p.orderId === id) setRider(p); });

  // Celebrate delivery once.
  useEffect(() => {
    if (order && prevStatus.current && prevStatus.current !== 'delivered' && order.status === 'delivered') sound.success();
    prevStatus.current = order?.status;
  }, [order?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const home = order?.address;
  const onTheWay = order?.status === 'out_for_delivery';
  // Route: rider → home while on the way, otherwise restaurant → home. The rider is matched onto
  // it between fetches, so a new route is only needed when the status changes, the rider turns
  // off it (another road), or a minute has passed.
  useEffect(() => {
    if (!order || !settings || !home) return;
    const from = onTheWay && rider ? rider : settings;
    const prev = lastRouteAt.current;
    const off = route?.coords ? snapToRoute(from, route.coords)?.off ?? Infinity : Infinity;
    if (prev.status === order.status && prev.rider === Boolean(rider) && off < 60 && Date.now() - prev.t < 60_000) return;
    lastRouteAt.current = { t: Date.now(), at: from, status: order.status, rider: Boolean(rider) };
    fetchRoute(from, home).then(setRoute);
  }, [order?.status, rider, settings, home]); // eslint-disable-line react-hooks/exhaustive-deps

  // Where to draw the rider: on the road when the fix is within 40 m of it (GPS drifts into
  // fields and rooftops), and how much road is left for the ETA.
  const snap = useMemo(() => (onTheWay && rider && route?.coords ? snapToRoute(rider, route.coords) : null), [onTheWay, rider, route]);
  const shown = rider && snap && snap.off < 40 ? { ...rider, lat: snap.lat, lng: snap.lng } : rider;
  const leftKm = route ? (snap && snap.off < 150 ? (snap.total - snap.along) / 1000 : route.km) : null;

  const markers = useMemo(() => {
    if (!order || !settings) return [];
    const m = [{ id: 'store', kind: 'store', lat: settings.lat, lng: settings.lng, label: tr('Velan', 'வேலன்') }];
    if (home) m.push({ id: 'home', kind: 'home', lat: home.lat, lng: home.lng, label: t('map.you') });
    if (shown && onTheWay) m.push({ id: 'rider', kind: 'rider', lat: shown.lat, lng: shown.lng, heading: shown.heading });
    return m;
  }, [order, settings, home, shown?.lat, shown?.lng, shown?.heading, onTheWay, t, tr]); // eslint-disable-line react-hooks/exhaustive-deps

  // The Google view reloads its frame only when the rider has moved 150 m, not on every update.
  const [embedFrom, setEmbedFrom] = useState(null);
  useEffect(() => {
    if (!onTheWay || !shown) return;
    setEmbedFrom((p) => (!p || haversineKm(p, shown) > 0.15 ? { lat: shown.lat, lng: shown.lng } : p));
  }, [onTheWay, shown?.lat, shown?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) {
    return (
      <section className="page narrow center-page">
        <Icon name="alert" size={42} className="gold" />
        <h1 className="display">{error(failed)}</h1>
        <Link to="/account" className="btn btn-primary">{t('nav.orders')}</Link>
      </section>
    );
  }
  if (!order) return <div className="page-loading"><span className="spinner" /></div>;

  const steps = stepsFor(order.type);
  const idx = steps.indexOf(order.status);
  const closed = ['rejected', 'cancelled'].includes(order.status);
  const at = (s) => order.timeline.find((x) => x.status === s)?.at;
  const showMap = order.type === 'delivery' && isActive(order) && settings;
  const arrived = order.status === 'out_for_delivery' && order.arrivedAt;
  // Minutes for the road still left, at the route's own pace.
  const etaMins = onTheWay && route && !arrived ? Math.max(1, Math.round(route.mins * (route.km > 0 ? Math.min(1, leftKm / route.km) : 1))) : null;
  const mapFrom = onTheWay && (embedFrom || shown) ? (embedFrom || shown) : settings;

  const cancel = async () => {
    const reason = await confirmDialog({ title: tr('Cancel this order?', 'இந்த ஆர்டரை ரத்து செய்யவா?'), body: tr('You can cancel only until the restaurant accepts it.', 'உணவகம் ஏற்கும் வரை மட்டுமே ரத்து செய்யலாம்.'), tone: 'danger', confirmLabel: tr('Yes, cancel', 'ஆம், ரத்து செய்') });
    if (!reason) return;
    try { const o = await api.post(`/orders/${order.id}/cancel`, {}); setOrder(o); trackOrderUpdate(o); } catch (e) { toast.error(error(e)); }
  };

  return (
    <section className="page track">
      <div className="container">
        <div className="tk-top">
          <Link to="/account" className="btn btn-ghost btn-sm"><Icon name="arrowLeft" size={16} /> {t('nav.orders')}</Link>
          <span className="subtle">{t('orderNo', { n: order.number })} · {dateTime(order.createdAt)}</span>
        </div>

        <div className={`tk-hero ${closed ? 'closed' : ''}`}>
          <div className="tk-hero-bg kolam-bg" aria-hidden="true" />
          <StatusArt status={order.status} />
          <div className="tk-hero-text">
            {navState?.fresh && order.status === 'placed' && (
              <motion.p className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{tr('Order placed — thank you!', 'ஆர்டர் செய்யப்பட்டது — நன்றி!')}</motion.p>
            )}
            <AnimatePresence mode="wait">
              <motion.h1 key={`${order.status}-${Boolean(arrived)}`} className="display" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
                {arrived ? tr('Your rider is at your door!', 'உங்கள் டெலிவரி பார்ட்னர் வாசலில் உள்ளார்!') : t(`statusLong.${order.status}`)}
              </motion.h1>
            </AnimatePresence>
            {arrived && order.otp && (
              <motion.p className="tk-arrived" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <Icon name="key" size={16} /> {tr('Share your OTP {o} to receive the food', 'உணவைப் பெற OTP {o} பகிருங்கள்', { o: order.otp })}
              </motion.p>
            )}
            <p className="tk-sub">
              {status(order)}
              {order.cancelReason ? ` · ${order.cancelReason}` : ''}
              {order.status === 'out_for_delivery' && etaMins ? ` · ${t('arrivingIn')} ~${etaMins} ${tr('min', 'நிமி')}` : ''}
            </p>
            {order.status === 'placed' && (
              <button type="button" className="btn btn-sm btn-glass" onClick={cancel}><Icon name="x" size={15} /> {tr('Cancel order', 'ஆர்டரை ரத்து செய்')}</button>
            )}
          </div>
          {['accepted', 'preparing'].includes(order.status) && order.readyBy && (
            <div className="tk-count">
              <small>{t('readyIn')}</small>
              <Countdown to={order.readyBy} total={order.prepMins} />
            </div>
          )}
          {etaMins && (
            <div className="tk-count">
              <small>{t('arrivingIn')}</small>
              <Ring value={0.65} size={92} stroke={7} color="var(--gold-400)" track="rgba(255,255,255,.12)">
                <span className="cd-num num">{etaMins}<small> {tr('min', 'நிமி')}</small></span>
              </Ring>
            </div>
          )}
        </div>

        {!closed && (
          <ol className="tk-steps">
            {steps.map((s, i) => {
              const done = i <= idx;
              return (
                <li key={s} className={`${done ? 'done' : ''} ${i === idx ? 'current' : ''}`}>
                  <span className="tk-dot"><Icon name={STEP_ICON[s]} size={17} /></span>
                  <strong>{s === 'delivered' && order.type === 'pickup' ? t('status.pickedUp') : t(`status.${s}`)}</strong>
                  <small>{at(s) ? time(at(s)) : ''}</small>
                  {i < steps.length - 1 && <span className="tk-bar"><motion.span initial={false} animate={{ scaleX: i < idx ? 1 : 0 }} transition={{ duration: 0.8 }} /></span>}
                </li>
              );
            })}
          </ol>
        )}

        <div className="tk-grid">
          <div className="tk-col">
            {order.type === 'delivery' && isActive(order) && order.otp && (
              <motion.div className="card tk-card otp-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div>
                  <p className="eyebrow">{t('otpTitle')}</p>
                  <p className="subtle">{t('otpHint')}</p>
                </div>
                <div className="otp-digits">
                  {order.otp.split('').map((d, i) => (
                    <motion.span key={i} initial={{ rotateX: 90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ delay: 0.2 + i * 0.1 }}>{d}</motion.span>
                  ))}
                </div>
              </motion.div>
            )}
            {showMap && (
              <div className="card tk-card tk-map-card">
                <div className="tk-map-bar">
                  <Seg size="sm" value={view} onChange={setView} options={[
                    { value: 'live', label: tr('Live map', 'நேரலை வரைபடம்') },
                    { value: 'google', label: 'Google Maps' },
                  ]} />
                  {home && (
                    <a className="btn btn-outline btn-sm" href={onTheWay && shown ? googleMapsUrl(home, shown) : googlePlaceUrl(home)} target="_blank" rel="noreferrer">
                      <Icon name="navigation" size={15} /> {tr('Open in Google Maps', 'Google Maps-இல் திற')}
                    </a>
                  )}
                </div>
                {view === 'live' ? (
                  <MapView className="tk-map" markers={markers} route={route?.coords} wheelZoom={false} fitKey={`${order.status}-${rider ? 'r' : ''}-${route ? 'route' : ''}`} />
                ) : (
                  <iframe className="tk-map tk-gmap" title={tr('Google Maps route', 'Google Maps வழி')} src={googleEmbedUrl(home, mapFrom)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
                )}
                {onTheWay && (rider ? <RiderFreshness rider={rider} snapped={Boolean(snap && snap.off < 40)} /> : (
                  <p className="tk-map-note subtle">{tr('Waiting for the rider’s live location…', 'டெலிவரி பார்ட்னரின் இருப்பிடத்துக்காகக் காத்திருக்கிறது…')}</p>
                ))}
              </div>
            )}
            {order.rider && isActive(order) && (
              <div className="card tk-card rider-card">
                <span className="avatar">{initials(order.rider.name)}</span>
                <div className="grow">
                  <small className="subtle">{t('rider')}</small>
                  <strong>{order.rider.name}</strong>
                  {order.rider.vehicle && <small className="plate">{order.rider.vehicle}</small>}
                </div>
                <a className="btn btn-leaf btn-icon" href={`tel:${order.rider.phone}`} aria-label={t('call')}><Icon name="phone" size={18} /></a>
              </div>
            )}
            {order.status === 'delivered' && <RateCard order={order} />}
            {isActive(order) && (
              <button type="button" className="btn btn-ghost btn-sm notify-btn" onClick={() => askNotify().then((ok) => ok && toast.success(tr('We will notify you at each step.', 'ஒவ்வொரு நிலையிலும் அறிவிப்போம்.')))}>
                <Icon name="bell" size={16} /> {t('notify')}
              </button>
            )}
          </div>

          <div className="tk-col">
            <div className="card tk-card">
              <h3>{tr('Order details', 'ஆர்டர் விவரம்')}</h3>
              <ul className="tk-items">
                {order.items.map((i) => (
                  <li key={i.id}>
                    <VegMark veg={i.veg} />
                    <span className="grow">{pick(i, 'name')} <span className="subtle">× {i.qty}</span></span>
                    <span className="num">{money(i.price * i.qty)}</span>
                  </li>
                ))}
              </ul>
              <BillRows bill={order.bill} type={order.type} quote={order.distanceKm ? { distanceKm: order.distanceKm } : null} />
              <div className="tk-facts">
                <p><Icon name={order.payment.method === 'upi' ? 'phoneDevice' : 'cash'} size={16} /> {t(`pay.${order.payment.method}`)} · {t(`pay.${order.payment.status}`)}</p>
                {home && <p><Icon name="pin" size={16} /> {home.line}{home.landmark ? ` · ${home.landmark}` : ''}{order.distanceKm ? ` · ${km(order.distanceKm)}` : ''}</p>}
                {order.notes && <p><Icon name="message" size={16} /> {order.notes}</p>}
              </div>
              <div className="tk-actions">
                {settings?.phone && <a className="btn btn-outline btn-sm" href={`tel:${settings.phone}`}><Icon name="phone" size={15} /> {tr('Call restaurant', 'உணவகத்தை அழை')}</a>}
                <button type="button" className="btn btn-soft btn-sm" onClick={() => { reorder(order.items); navigate('/'); openCart(true); }}>
                  <Icon name="refresh" size={15} /> {t('orderAgain')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
