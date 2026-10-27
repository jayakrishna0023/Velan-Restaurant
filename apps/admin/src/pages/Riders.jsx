// Delivery team: who is online, what they did today, and the cash they hold.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Modal, Sheet, Switch, Stars, toast, confirmDialog, Empty, AnimatedNumber } from '@velan/shared/components/ui.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { useAsync } from '@velan/shared/hooks.js';
import { api } from '../api.js';
import { live, useLive } from '../state/live.js';
import { openOrder } from '../state/ui.js';
import { Avatar, Field, Page, PageHead, rise, tel, whatsapp } from '../components/common.jsx';

async function refreshRiders() {
  try { live.set({ riders: await api.get('/admin/riders') }); } catch { /* ignore */ }
}

export default function Riders() {
  const L = useLang();
  const { t, tr, money, km } = L;
  const riders = useLive((s) => s.riders);
  const presence = useLive((s) => s.presence);
  const active = useLive((s) => s.active);
  const [form, setForm] = useState(null);
  const [ledger, setLedger] = useState(null);

  useEffect(() => { refreshRiders(); }, []);
  const sorted = [...riders].sort((a, b) => Number(b.active) - Number(a.active) || Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  const totals = riders.reduce((s, r) => ({ cash: s.cash + (r.cashInHand || 0), deliveries: s.deliveries + (r.today?.deliveries || 0), online: s.online + (r.online && r.active ? 1 : 0) }), { cash: 0, deliveries: 0, online: 0 });

  const toggleActive = async (r) => {
    if (r.active) {
      const ok = await confirmDialog({ title: tr(`Disable ${r.name}?`, `${r.name} முடக்கவா?`), body: tr('They are logged out and cannot receive orders until enabled again.', 'மீண்டும் இயக்கும் வரை வெளியேற்றப்படுவார், ஆர்டர்கள் வராது.'), confirmLabel: tr('Disable', 'முடக்கு'), tone: 'danger' });
      if (!ok) return;
    }
    try { await api.put(`/admin/riders/${r.id}`, { active: !r.active }); refreshRiders(); } catch (e) { toast.error(L.error(e)); }
  };

  return (
    <Page>
      <PageHead title={t('nav.riders')} sub={tr(`${totals.online} online now · ${totals.deliveries} deliveries today · ${money(totals.cash)} cash to collect`, `இப்போது ${totals.online} ஆன்லைன் · இன்று ${totals.deliveries} டெலிவரிகள் · ${money(totals.cash)} ரொக்கம் வசூலிக்க வேண்டும்`)}>
        <button className="btn btn-primary btn-sm" onClick={() => setForm({})}><Icon name="plus" size={15} />{tr('Add rider', 'பார்ட்னர் சேர்')}</button>
      </PageHead>

      {sorted.length === 0 && <Empty icon="scooter" title={tr('No delivery partners yet', 'இன்னும் டெலிவரி பார்ட்னர்கள் இல்லை')} action={<button className="btn btn-primary" onClick={() => setForm({})}>{tr('Add rider', 'பார்ட்னர் சேர்')}</button>} />}
      <div className="rider-grid">
        {sorted.map((r) => {
          const jobs = active.filter((o) => o.riderId === r.id);
          const state = !r.active ? 'disabled' : r.online ? (jobs.length ? 'busy' : 'free') : 'offline';
          return (
            <motion.article key={r.id} className={`rider-card state-${state}`} variants={rise} whileHover={{ y: -4 }}>
              <div className="rider-top">
                <span className="rider-av"><Avatar name={r.name} size={52} /><i className={presence[r.id] ? 'ok' : r.online ? 'warn' : 'off'} /></span>
                <div className="grow">
                  <h3>{r.name}</h3>
                  <span className="subtle small num block">+91 {r.phone}</span>
                  <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {r.vehicle && <span className="plate">{r.vehicle}</span>}
                    <span className="badge" data-tone={{ busy: 'blue', free: 'leaf', offline: 'muted', disabled: 'maroon' }[state]}>
                      <span className={`dot ${state === 'busy' || state === 'free' ? 'live' : ''}`} />
                      {{ busy: tr(`On ${jobs.length} job${jobs.length > 1 ? 's' : ''}`, `${jobs.length} வேலையில்`), free: tr('Free', 'காலியாக'), offline: t('offlineWord'), disabled: tr('Disabled', 'முடக்கப்பட்டது') }[state]}
                    </span>
                    {r.rating?.avg && <span className="badge" data-tone="gold"><Icon name="star" size={11} />{r.rating.avg}</span>}
                  </div>
                </div>
                <Switch checked={r.active} onChange={() => toggleActive(r)} label={tr('Active', 'இயக்கம்')} />
              </div>
              <div className="rider-stats">
                <div><span className="subtle">{t('deliveries')}</span><b className="num"><AnimatedNumber value={r.today?.deliveries || 0} /></b></div>
                <div><span className="subtle">{tr('Distance', 'தூரம்')}</span><b className="num">{km(r.today?.km || 0)}</b></div>
                <div><span className="subtle">{t('earnings')}</span><b className="num">{money(r.today?.earnings || 0)}</b></div>
              </div>
              <div className={`rider-cash ${r.cashInHand ? 'has' : ''}`}>
                <Icon name="cash" size={18} />
                <div className="grow"><span className="subtle small">{t('cashInHand')}</span><b className="num">{money(r.cashInHand || 0)}</b></div>
                <button className="btn btn-gold btn-xs" onClick={() => setLedger(r)}>{r.cashInHand ? t('settle') : tr('Ledger', 'கணக்கு')}</button>
              </div>
              {jobs.length > 0 && (
                <div className="rider-jobs">
                  {jobs.map((o) => <button key={o.id} className="chip" onClick={() => openOrder(o.id)}>#{o.number} · {t(`status.${o.status}`)}</button>)}
                </div>
              )}
              <div className="rider-foot">
                <a className="btn btn-ghost btn-xs" href={tel(r.phone)}><Icon name="phone" size={14} />{t('call')}</a>
                <a className="btn btn-ghost btn-xs" href={whatsapp(r.phone)} target="_blank" rel="noreferrer"><Icon name="chat" size={14} />WhatsApp</a>
                <span className="grow" />
                <button className="btn btn-ghost btn-xs" onClick={() => setForm(r)}><Icon name="edit" size={14} />{t('edit')}</button>
              </div>
            </motion.article>
          );
        })}
      </div>

      <RiderForm rider={form} onClose={() => setForm(null)} />
      <Ledger rider={ledger} onClose={() => setLedger(null)} />
    </Page>
  );
}

function RiderForm({ rider, onClose }) {
  const L = useLang();
  const { t, tr } = L;
  const isNew = rider && !rider.id;
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (rider) setF({ name: rider.name || '', phone: rider.phone || '', vehicle: rider.vehicle || '', password: '' }); }, [rider]);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (isNew) await api.post('/admin/riders', f);
      else await api.put(`/admin/riders/${rider.id}`, { name: f.name, phone: f.phone, vehicle: f.vehicle, ...(f.password ? { password: f.password } : {}) });
      toast.success(isNew ? tr('Rider added — share the login with them', 'பார்ட்னர் சேர்க்கப்பட்டார் — உள்நுழைவு விவரத்தைப் பகிருங்கள்') : t('saved'));
      refreshRiders();
      onClose();
    } catch (err) { toast.error(L.error(err)); }
    setBusy(false);
  };
  return (
    <Modal open={!!rider} onClose={onClose} title={isNew ? tr('Add delivery partner', 'டெலிவரி பார்ட்னர் சேர்') : tr('Edit delivery partner', 'டெலிவரி பார்ட்னர் திருத்து')} width={460}>
      <form className="stack" style={{ gap: 14 }} onSubmit={submit}>
        <Field label={t('name')}><input className="input" value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        <Field label={t('mobile')} hint={tr('They log in to the delivery app with this number.', 'இந்த எண்ணுடன் டெலிவரி ஆப்பில் உள்நுழைவார்.')}>
          <input className="input num" inputMode="numeric" maxLength={10} value={f.phone || ''} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '') })} required />
        </Field>
        <Field label={tr('Vehicle number', 'வாகன எண்')}><input className="input" value={f.vehicle || ''} onChange={(e) => setF({ ...f, vehicle: e.target.value.toUpperCase() })} placeholder="TN 47 AB 1234" /></Field>
        <Field label={isNew ? t('password') : tr('New password', 'புதிய கடவுச்சொல்')} hint={isNew ? null : tr('Leave empty to keep the current one.', 'தற்போதையதை வைத்திருக்க காலியாக விடுங்கள்.')}>
          <input className="input" type="text" value={f.password || ''} onChange={(e) => setF({ ...f, password: e.target.value })} required={isNew} minLength={6} autoComplete="new-password" />
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? <span className="spinner" /> : t('save')}</button>
        </div>
      </form>
    </Modal>
  );
}

function Ledger({ rider, onClose }) {
  const L = useLang();
  const { t, tr, money } = L;
  const { data, reload } = useAsync(() => (rider ? api.get(`/admin/riders/${rider.id}/ledger`) : Promise.resolve(null)), [rider?.id]);
  const [note, setNote] = useState('');
  const settle = async () => {
    const ok = await confirmDialog({ title: tr(`Received ${money(data.cashInHand)} from ${rider.name}?`, `${rider.name} இடமிருந்து ${money(data.cashInHand)} பெற்றீர்களா?`), confirmLabel: t('settle') });
    if (!ok) return;
    try {
      await api.post(`/admin/riders/${rider.id}/settle`, { note });
      toast.success(tr('Cash settled', 'ரொக்கம் செட்டில் செய்யப்பட்டது'));
      setNote('');
      reload();
      refreshRiders();
    } catch (e) { toast.error(L.error(e)); }
  };
  return (
    <Sheet open={!!rider} onClose={onClose} label={rider?.name}>
      <div className="sheet-head">
        <Avatar name={rider?.name} size={40} />
        <div className="grow"><h3>{rider?.name}</h3><span className="subtle small">{tr('Cash ledger', 'ரொக்கக் கணக்கு')}</span></div>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label={t('close')}><Icon name="x" /></button>
      </div>
      <div className="sheet-scroll">
        {!data ? <div className="skeleton" style={{ height: 160 }} /> : (
          <>
            <div className="ledger-hero">
              <span className="subtle">{t('cashInHand')}</span>
              <b className="display num">{money(data.cashInHand)}</b>
              <span className="subtle small">{tr(`${data.openOrders.length} cash deliveries not yet handed over`, `${data.openOrders.length} ரொக்க டெலிவரிகள் இன்னும் ஒப்படைக்கப்படவில்லை`)}</span>
              {data.cashInHand > 0 && (
                <div className="row" style={{ width: '100%', marginTop: 12 }}>
                  <input className="input input-sm grow" value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr('Note (optional)', 'குறிப்பு (விருப்பம்)')} />
                  <button className="btn btn-leaf btn-sm" onClick={settle}><Icon name="check" size={15} />{t('settle')}</button>
                </div>
              )}
            </div>
            <div className="rider-stats" style={{ margin: '16px 0' }}>
              <div><span className="subtle">{tr('Week deliveries', 'வார டெலிவரிகள்')}</span><b className="num">{data.week.deliveries}</b></div>
              <div><span className="subtle">{tr('Week earnings', 'வார வருமானம்')}</span><b className="num">{money(data.week.earnings)}</b></div>
              <div><span className="subtle">{tr('Avg. ride', 'சராசரி பயணம்')}</span><b className="num">{data.week.avgMins ? L.mins(data.week.avgMins) : '—'}</b></div>
            </div>
            {data.rating.avg && <div className="row" style={{ marginBottom: 14 }}><Stars value={data.rating.avg} size={16} /><span className="subtle small">{data.rating.avg} · {tr(`${data.rating.count} ratings`, `${data.rating.count} மதிப்பீடுகள்`)}</span></div>}
            {data.openOrders.length > 0 && <h4 className="os-label">{tr('Cash to collect', 'வசூலிக்க வேண்டிய ரொக்கம்')}</h4>}
            <ul className="ledger-list">
              {data.openOrders.map((o) => (
                <li key={o.id} onClick={() => openOrder(o.id)}>
                  <b className="num">#{o.number}</b><span className="grow subtle">{o.customerName} · {L.relative(o.deliveredAt)}</span><b className="num">{money(o.total)}</b>
                </li>
              ))}
            </ul>
            <h4 className="os-label" style={{ marginTop: 18 }}>{tr('Settlements', 'செட்டில்மென்ட்கள்')}</h4>
            {data.settlements.length === 0 && <p className="subtle small">{tr('None yet', 'இன்னும் இல்லை')}</p>}
            <ul className="ledger-list">
              {data.settlements.map((s) => (
                <li key={s.id}>
                  <Icon name="checkCircle" size={16} className="good-text" />
                  <span className="grow"><b>{L.dateTime(s.createdAt)}</b><span className="subtle small block">{tr(`${s.count} orders · by ${s.by}`, `${s.count} ஆர்டர்கள் · ${s.by}`)}{s.note ? ` · ${s.note}` : ''}</span></span>
                  <b className="num">{money(s.amount)}</b>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Sheet>
  );
}
