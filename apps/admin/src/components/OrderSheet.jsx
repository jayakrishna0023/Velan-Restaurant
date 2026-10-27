// Full order detail drawer, opened from anywhere with openOrder(id).
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sheet, StatusBadge, Stars, Spinner } from '@velan/shared/components/ui.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { MapView, fetchRoute, googleMapsUrl } from '@velan/shared/map.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { allowedNext } from '@velan/shared/domain.js';
import { api } from '../api.js';
import { onOrder, useLive } from '../state/live.js';
import { ui, useUi } from '../state/ui.js';
import { AcceptBar, BillTable, ItemLines, NextButton, PayBadge, ReadyTimer, RiderSelect, TypeBadge, useOrderActions } from './orderBits.jsx';
import { Avatar, tel, whatsapp } from './common.jsx';

export default function OrderSheet() {
  const id = useUi((s) => s.orderId);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const L = useLang();

  useEffect(() => {
    setOrder(null);
    setError(null);
    if (!id) return undefined;
    let live = true;
    api.get(`/orders/${id}`).then((o) => { if (live) setOrder(o); }).catch((e) => { if (live) setError(e); });
    const off = onOrder((o) => { if (o.id === id) setOrder((prev) => ({ ...prev, ...o })); });
    return () => { live = false; off(); };
  }, [id]);

  return (
    <Sheet open={!!id} onClose={() => ui.set({ orderId: null })} className="order-sheet" label={order ? `#${order.number}` : ''}>
      <div className="sheet-scroll">
        {!order && !error && <div className="sheet-loading"><Spinner size={28} /></div>}
        {error && <div className="empty"><Icon name="alert" size={36} /><p>{L.error(error)}</p></div>}
        {order && <OrderDetail order={order} />}
      </div>
    </Sheet>
  );
}

function OrderDetail({ order }) {
  const L = useLang();
  const { t, tr, money, km } = L;
  const settings = useLive((s) => s.settings);
  const riders = useLive((s) => s.riders);
  const act = useOrderActions();
  const [route, setRoute] = useState(null);
  const canCancel = allowedNext(order, 'admin').includes('cancelled');
  const rider = order.riderId ? riders.find((r) => r.id === order.riderId) : null;
  const riderLoc = rider?.location || order.riderLocation;

  useEffect(() => {
    if (order.type !== 'delivery' || !order.address || !settings) return;
    fetchRoute(settings, order.address).then(setRoute);
  }, [order.id, order.type, order.address, settings]);

  const markers = useMemo(() => {
    if (!settings) return [];
    const m = [{ id: 'store', kind: 'store', lat: settings.lat, lng: settings.lng }];
    if (order.address) m.push({ id: 'home', kind: 'home', lat: order.address.lat, lng: order.address.lng, label: order.customerName.split(' ')[0] });
    if (riderLoc && ['accepted', 'preparing', 'ready', 'out_for_delivery'].includes(order.status)) {
      m.push({ id: 'rider', kind: 'rider', lat: riderLoc.lat, lng: riderLoc.lng, heading: riderLoc.heading, label: order.rider?.name });
    }
    return m;
  }, [settings, order, riderLoc]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <header className="os-head">
        <div className="grow">
          <div className="row" style={{ gap: 10 }}>
            <h2 className="os-number">#{order.number}</h2>
            <StatusBadge order={order} live={['placed', 'out_for_delivery'].includes(order.status)} />
          </div>
          <p className="subtle">{L.dateTime(order.createdAt)} · {L.relative(order.createdAt)}</p>
        </div>
        <button className="btn btn-soft btn-icon btn-sm" onClick={() => act.print(order)} title={t('print')}><Icon name="printer" size={17} /></button>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => ui.set({ orderId: null })} aria-label={t('close')}><Icon name="x" /></button>
      </header>

      <div className="os-chips">
        <TypeBadge order={order} />
        <span className="badge">{t(`source.${order.source}`)}</span>
        <PayBadge order={order} />
        {order.distanceKm !== null && order.distanceKm !== undefined && <span className="badge"><Icon name="route" size={12} />{km(order.distanceKm)}</span>}
        <ReadyTimer order={order} />
      </div>

      {order.status === 'placed' && <div className="os-block"><AcceptBar order={order} /></div>}
      {order.status !== 'placed' && (allowedNext(order, 'admin').length > 0 || order.payment.status !== 'paid') && (
        <div className="os-actions">
          <NextButton order={order} size="" className="grow" />
          <RiderSelect order={order} />
          {order.payment.status !== 'paid' && !['rejected', 'cancelled'].includes(order.status) && (
            <button className="btn btn-outline btn-sm" onClick={() => act.markPaid(order)}><Icon name="cash" size={15} />{t('markPaid')}</button>
          )}
          {canCancel && <button className="btn btn-ghost btn-sm danger-text" onClick={() => act.cancel(order)}>{t('action.cancelled')}</button>}
        </div>
      )}
      {order.cancelReason && (
        <div className="os-alert"><Icon name="info" size={16} /> {order.cancelReason}</div>
      )}

      {order.type === 'delivery' && order.address && (
        <div className="os-map">
          <MapView markers={markers} route={route?.coords} fitKey={`${order.id}-${route ? 1 : 0}`} style={{ height: 210 }} padding={34} />
          {route && <span className="os-map-chip">{km(route.km)} · ~{L.mins(route.mins)}</span>}
        </div>
      )}

      <section className="os-block">
        <div className="row" style={{ gap: 12 }}>
          <Avatar name={order.customerName} size={44} />
          <div className="grow">
            <b>{order.customerName}</b>
            <div className="subtle num">{order.phone ? `+91 ${order.phone}` : tr('No phone', 'தொலைபேசி இல்லை')}</div>
          </div>
          {order.phone && <a className="btn btn-soft btn-icon btn-sm" href={tel(order.phone)} title={t('call')}><Icon name="phone" size={16} /></a>}
          {order.phone && <a className="btn btn-soft btn-icon btn-sm" href={whatsapp(order.phone)} target="_blank" rel="noreferrer" title="WhatsApp"><Icon name="chat" size={16} /></a>}
        </div>
        {order.address && (
          <div className="os-address">
            <Icon name="pin" size={16} />
            <div className="grow">
              <div>{order.address.line}{order.address.pincode ? ` · ${order.address.pincode}` : ''}</div>
              {order.address.landmark && <div className="subtle">{t('landmark')}: {order.address.landmark}</div>}
              <div className="subtle small os-pinfrom">
                {{ gps: order.address.accuracy ? tr('Pinned by GPS ±{m} m', 'GPS பின் ±{m} மீ', { m: order.address.accuracy }) : tr('Pinned by GPS', 'GPS பின்'),
                  link: tr('Pinned from a map link', 'வரைபட இணைப்பிலிருந்து பின்'), manual: tr('Pin from a typed address — check by phone', 'உள்ளிட்ட முகவரியிலிருந்து பின் — தொலைபேசியில் உறுதிசெய்க'),
                  search: tr('Pinned from a map search', 'வரைபடத் தேடலிலிருந்து பின்') }[order.address.source] || tr('Pinned on the map', 'வரைபடத்தில் பின்')}
                {order.address.confirmed && <b className="os-confirmed"> · {tr('customer confirmed the pin', 'வாடிக்கையாளர் பின்னை உறுதிசெய்தார்')}</b>}
                {order.arrivedAt && order.status === 'out_for_delivery' && <b className="os-arrived"> · {tr('Rider is at the door', 'டெலிவரி பார்ட்னர் வாசலில்')}</b>}
              </div>
            </div>
            <a className="btn btn-ghost btn-xs" href={googleMapsUrl(order.address, settings)} target="_blank" rel="noreferrer"><Icon name="navigation" size={13} />{t('directions')}</a>
          </div>
        )}
        {order.type === 'delivery' && !['delivered', 'cancelled', 'rejected'].includes(order.status) && (
          <div className="os-otp">
            <span className="subtle">{tr('Delivery OTP', 'டெலிவரி OTP')}</span>
            <b className="num">{order.otp}</b>
            <span className="subtle small">{tr('Customer tells this to the rider at the door', 'வாசலில் வாடிக்கையாளர் டெலிவரி பார்ட்னரிடம் சொல்வார்')}</span>
          </div>
        )}
        {order.rider && (
          <div className="os-rider">
            <Icon name="scooter" size={16} />
            <span className="grow"><b>{order.rider.name}</b> {order.rider.vehicle && <span className="subtle">· {order.rider.vehicle}</span>}</span>
            <a className="btn btn-ghost btn-xs" href={tel(order.rider.phone)}><Icon name="phone" size={13} />{t('call')}</a>
          </div>
        )}
      </section>

      <section className="os-block">
        <h4 className="os-label">{L.t('items', { n: order.items.reduce((s, i) => s + i.qty, 0) })}</h4>
        <ItemLines items={order.items} />
        <BillTable order={order} />
        {order.notes && <p className="os-notes"><Icon name="message" size={15} /> {order.notes}</p>}
      </section>

      {order.rating && (
        <section className="os-block">
          <h4 className="os-label">{tr('Customer review', 'வாடிக்கையாளர் மதிப்புரை')}</h4>
          <div className="row"><Stars value={order.rating.food} size={18} />{order.rating.delivery && <span className="subtle">· {tr('Delivery', 'டெலிவரி')} {order.rating.delivery}★</span>}</div>
          {order.rating.review && <p className="os-review">“{order.rating.review}”</p>}
        </section>
      )}

      <section className="os-block">
        <h4 className="os-label">{tr('Timeline', 'காலவரிசை')}</h4>
        <ol className="timeline">
          {order.timeline.map((e, i) => (
            <motion.li key={`${e.status}-${e.at}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} data-status={e.status}>
              <span className="tl-dot" />
              <div className="grow">
                <b>{e.status === 'delivered' && order.type === 'pickup' ? t('status.pickedUp') : t(`status.${e.status}`)}</b>
                <span className="subtle"> · {e.name || t(e.by === 'customer' ? 'customer' : e.by === 'rider' ? 'rider' : 'restaurant')}</span>
                {e.note && <div className="subtle small">“{e.note}”</div>}
              </div>
              <span className="subtle num small">{L.time(e.at)}</span>
            </motion.li>
          ))}
        </ol>
        <div className="subtle small" style={{ marginTop: 8 }}>{money(order.bill.total)} · {t(`pay.${order.payment.method}`)} · {t(order.payment.status === 'paid' ? 'pay.paid' : 'pay.pending')}</div>
      </section>
    </motion.div>
  );
}
