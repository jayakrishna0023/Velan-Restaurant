// Coupons and offers, shown as tickets.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Modal, Seg, Switch, toast, confirmDialog, Empty } from '@velan/shared/components/ui.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { useAsync } from '@velan/shared/hooks.js';
import { api } from '../api.js';
import { BiField, Field, Page, PageHead, rise } from '../components/common.jsx';

export function offerSummary(c, L) {
  const { tr, money } = L;
  if (c.type === 'percent') return c.maxDiscount ? tr(`${c.value}% off up to ${money(c.maxDiscount)}`, `${c.value}% தள்ளுபடி (${money(c.maxDiscount)} வரை)`) : tr(`${c.value}% off`, `${c.value}% தள்ளுபடி`);
  if (c.type === 'flat') return tr(`${money(c.value)} off`, `${money(c.value)} தள்ளுபடி`);
  return tr('Free delivery', 'இலவச டெலிவரி');
}

export default function Offers() {
  const L = useLang();
  const { t, tr, money, pick } = L;
  const { data, reload, setData } = useAsync(() => api.get('/admin/coupons'), []);
  const [edit, setEdit] = useState(null);

  const patch = async (c, body) => {
    try {
      const next = await api.put(`/admin/coupons/${c.code}`, body);
      setData((list) => list.map((x) => (x.code === c.code ? next : x)));
    } catch (e) { toast.error(L.error(e)); }
  };
  const remove = async (c) => {
    const ok = await confirmDialog({ title: tr(`Delete ${c.code}?`, `${c.code} நீக்கவா?`), body: tr('Customers can no longer use this code.', 'வாடிக்கையாளர்கள் இனி இந்தக் குறியீட்டைப் பயன்படுத்த முடியாது.'), confirmLabel: t('delete'), tone: 'danger' });
    if (!ok) return;
    try { await api.del(`/admin/coupons/${c.code}`); reload(); toast.success(tr('Coupon deleted', 'கூப்பன் நீக்கப்பட்டது')); } catch (e) { toast.error(L.error(e)); }
  };

  return (
    <Page>
      <PageHead title={t('nav.offers')} sub={tr('Public offers appear on the website; private codes work only when shared.', 'பொது சலுகைகள் இணையதளத்தில் தெரியும்; தனிக் குறியீடுகள் பகிர்ந்தால் மட்டும்.')}>
        <button className="btn btn-primary btn-sm" onClick={() => setEdit({})}><Icon name="plus" size={15} />{tr('New coupon', 'புதிய கூப்பன்')}</button>
      </PageHead>
      {data?.length === 0 && <Empty icon="ticket" title={tr('No coupons yet', 'இன்னும் கூப்பன்கள் இல்லை')} />}
      <div className="coupon-grid">
        <AnimatePresence>
          {data?.map((c) => {
            const expired = c.validTo && c.validTo < new Date().toISOString();
            const pct = c.usageLimit ? Math.min(100, (c.used / c.usageLimit) * 100) : null;
            return (
              <motion.article key={c.code} layout variants={rise} initial="hidden" animate="show" exit={{ opacity: 0, scale: 0.95 }}
                className={`coupon ${c.active && !expired ? '' : 'off'} type-${c.type}`} whileHover={{ y: -4, rotate: -0.3 }}>
                <div className="coupon-left">
                  <Icon name={c.type === 'freedelivery' ? 'scooter' : c.type === 'percent' ? 'percent' : 'rupee'} size={26} />
                  <b className="coupon-value">{c.type === 'percent' ? `${c.value}%` : c.type === 'flat' ? `₹${c.value}` : tr('FREE', 'இலவசம்')}</b>
                  <span>{c.type === 'freedelivery' ? tr('delivery', 'டெலிவரி') : tr('off', 'தள்ளுபடி')}</span>
                </div>
                <div className="coupon-right">
                  <div className="row" style={{ gap: 8 }}>
                    <code className="coupon-code">{c.code}</code>
                    {!c.public && <span className="badge"><Icon name="lock" size={11} />{tr('Private', 'தனி')}</span>}
                    {expired && <span className="badge" data-tone="maroon">{tr('Expired', 'காலாவதி')}</span>}
                    <span className="grow" />
                    <Switch checked={c.active} onChange={(v) => patch(c, { active: v })} label={tr('Active', 'இயக்கம்')} />
                  </div>
                  <p className="coupon-title">{pick(c, 'title') || offerSummary(c, L)}</p>
                  <ul className="coupon-rules subtle small">
                    <li>{offerSummary(c, L)}</li>
                    {c.minOrder > 0 && <li>{tr(`On orders above ${money(c.minOrder)}`, `${money(c.minOrder)}க்கு மேல்`)}</li>}
                    {c.firstOrderOnly && <li>{tr('First order only', 'முதல் ஆர்டருக்கு மட்டும்')}</li>}
                    {c.perUserLimit > 0 && <li>{tr(`${c.perUserLimit}× per customer`, `ஒருவருக்கு ${c.perUserLimit} முறை`)}</li>}
                    {c.validTo && <li>{tr('Valid till', 'செல்லுபடி')} {L.date(c.validTo)}</li>}
                  </ul>
                  <div className="coupon-usage">
                    <span className="subtle small">{tr('Used', 'பயன்பாடு')} <b className="num">{c.used}</b>{c.usageLimit ? ` / ${c.usageLimit}` : ''}</span>
                    {pct !== null && <span className="stock-bar"><motion.i initial={{ width: 0 }} animate={{ width: `${pct}%` }} /></span>}
                  </div>
                  <div className="row coupon-actions">
                    <button className="btn btn-ghost btn-xs" onClick={() => { navigator.clipboard?.writeText(c.code); toast.success(t('copied')); }}><Icon name="copy" size={13} />{c.code}</button>
                    <span className="grow" />
                    <button className="btn btn-ghost btn-icon btn-xs" onClick={() => setEdit(c)} title={t('edit')}><Icon name="edit" size={14} /></button>
                    <button className="btn btn-ghost btn-icon btn-xs danger-text" onClick={() => remove(c)} title={t('delete')}><Icon name="trash" size={14} /></button>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
      <CouponForm coupon={edit} onClose={() => setEdit(null)} onSaved={reload} />
    </Page>
  );
}

function CouponForm({ coupon, onClose, onSaved }) {
  const L = useLang();
  const { t, tr } = L;
  const isNew = coupon && !coupon.code;
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!coupon) return;
    setF({
      code: coupon.code || '', type: coupon.type || 'flat', value: coupon.value ?? 50, maxDiscount: coupon.maxDiscount || '', minOrder: coupon.minOrder ?? 199,
      firstOrderOnly: coupon.firstOrderOnly || false, perUserLimit: coupon.perUserLimit ?? 1, usageLimit: coupon.usageLimit || '',
      validTo: coupon.validTo ? coupon.validTo.slice(0, 10) : '', active: coupon.active ?? true, public: coupon.public ?? true,
      title: coupon.title || '', titleTa: coupon.titleTa || '',
    });
  }, [coupon]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const body = { ...f, validTo: f.validTo ? new Date(`${f.validTo}T23:59:59+05:30`).toISOString() : null };
    try {
      if (isNew) await api.post('/admin/coupons', body);
      else await api.put(`/admin/coupons/${coupon.code}`, body);
      toast.success(t('saved'));
      onSaved();
      onClose();
    } catch (err) { toast.error(L.error(err)); }
    setBusy(false);
  };
  const num = (k) => (e) => set(k, e.target.value.replace(/\D/g, ''));
  return (
    <Modal open={!!coupon} onClose={onClose} title={isNew ? tr('New coupon', 'புதிய கூப்பன்') : coupon?.code} width={600}>
      <form className="stack" style={{ gap: 14 }} onSubmit={submit}>
        <div className="grid-2-tight">
          <Field label={tr('Code', 'குறியீடு')}>
            <input className="input num coupon-input" value={f.code || ''} disabled={!isNew} onChange={(e) => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="SUNDAY30" required maxLength={16} />
          </Field>
          <Field label={tr('Type', 'வகை')}>
            <Seg size="sm" value={f.type} onChange={(v) => set('type', v)} options={[
              { value: 'flat', label: '₹' }, { value: 'percent', label: '%' }, { value: 'freedelivery', label: tr('Free delivery', 'இலவச டெலிவரி') },
            ]} />
          </Field>
        </div>
        <BiField label={tr('Title shown to customers', 'வாடிக்கையாளருக்குத் தெரியும் தலைப்பு')} value={f} field="title" onChange={set}
          placeholder={['₹50 off on orders above ₹399', '₹399க்கு மேல் ₹50 தள்ளுபடி']} />
        <div className="grid-3-tight">
          {f.type !== 'freedelivery' && <Field label={f.type === 'percent' ? tr('Percent off', 'சதவீதம்') : tr('Amount off (₹)', 'தள்ளுபடி (₹)')}><input className="input input-sm num" value={f.value ?? ''} onChange={num('value')} /></Field>}
          {f.type === 'percent' && <Field label={tr('Max discount (₹)', 'அதிகபட்சம் (₹)')}><input className="input input-sm num" value={f.maxDiscount ?? ''} onChange={num('maxDiscount')} /></Field>}
          <Field label={tr('Min. order (₹)', 'குறைந்தபட்ச ஆர்டர் (₹)')}><input className="input input-sm num" value={f.minOrder ?? ''} onChange={num('minOrder')} /></Field>
          <Field label={tr('Uses per customer', 'ஒருவருக்கு முறை')}><input className="input input-sm num" value={f.perUserLimit ?? ''} onChange={num('perUserLimit')} /></Field>
          <Field label={tr('Total uses', 'மொத்த பயன்பாடு')} hint={tr('Empty = unlimited', 'காலி = வரம்பில்லை')}><input className="input input-sm num" value={f.usageLimit ?? ''} onChange={num('usageLimit')} /></Field>
          <Field label={tr('Valid till', 'செல்லுபடி தேதி')}><input type="date" className="input input-sm" value={f.validTo || ''} onChange={(e) => set('validTo', e.target.value)} /></Field>
        </div>
        <div className="flag-grid">
          {[['active', 'power', tr('Active', 'இயக்கம்')], ['public', 'eye', tr('Show on website', 'இணையதளத்தில் காட்டு')], ['firstOrderOnly', 'gift', tr('First order only', 'முதல் ஆர்டருக்கு மட்டும்')]].map(([k, icon, label]) => (
            <label key={k} className={`flag-card ${f[k] ? 'on' : ''}`}><Icon name={icon} size={18} /><span className="grow">{label}</span><Switch checked={f[k]} onChange={(v) => set(k, v)} label={label} /></label>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-primary" disabled={busy || !f.code}>{busy ? <span className="spinner" /> : t('save')}</button>
        </div>
      </form>
    </Modal>
  );
}
