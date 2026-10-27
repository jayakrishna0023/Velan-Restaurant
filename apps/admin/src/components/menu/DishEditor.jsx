// Add or edit a dish: bilingual names, price, stock, badges and photo.
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Sheet, Seg, Switch, toast, VegMark } from '@velan/shared/components/ui.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { api } from '../../api.js';
import { useLive } from '../../state/live.js';
import { BiField, Field } from '../common.jsx';
import { resizeImage } from '../../lib/files.js';

const EMPTY = {
  name: '', nameTa: '', description: '', descTa: '', categoryId: '', price: '', mrp: '', dailyStock: 30, stock: 30,
  veg: false, spicy: 1, serves: 1, bestseller: false, chefSpecial: false, isNew: true, available: true, image: '',
};

export default function DishEditor({ item, onClose }) {
  const L = useLang();
  const { t, tr, pick } = L;
  const categories = useLive((s) => s.categories);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const file = useRef(null);
  // item is a dish to edit, 'new', or { isNew: true, ...prefill } (a copy, or a new dish in a chosen category).
  const isNew = item === 'new' || Boolean(item?.isDraft);

  useEffect(() => {
    if (!item) return;
    if (item === 'new') setF({ ...EMPTY, categoryId: categories[0]?.id || '' });
    else setF({ ...EMPTY, ...item, categoryId: item.categoryId || categories[0]?.id || '', mrp: item.mrp || '' });
  }, [item, categories]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const upload = async (fl) => {
    if (!fl) return;
    setUploading(true);
    try {
      const dataUrl = await resizeImage(fl, 1200, 0.85);
      const { url } = await api.post('/admin/upload', { dataUrl });
      set('image', url);
      toast.success(tr('Photo uploaded', 'படம் பதிவேற்றப்பட்டது'));
    } catch (e) {
      toast.error(e.code ? L.error(e) : t('err.IMAGE_INVALID'));
    }
    setUploading(false);
  };

  const submit = async () => {
    setBusy(true);
    const body = {
      ...f,
      price: Number(f.price) || 0,
      mrp: f.mrp ? Number(f.mrp) : null,
      dailyStock: Number(f.dailyStock) || 0,
      stock: Number(f.stock) || 0,
      serves: Number(f.serves) || 1,
    };
    delete body.id; delete body.sold30d; delete body.createdAt; delete body.updatedAt; delete body.sort; delete body.isDraft;
    try {
      if (isNew) await api.post('/admin/menu', body);
      else await api.put(`/admin/menu/${item.id}`, body);
      toast.success(isNew ? tr('Dish added to the menu', 'உணவு மெனுவில் சேர்க்கப்பட்டது') : tr('Dish saved', 'உணவு சேமிக்கப்பட்டது'));
      onClose();
    } catch (e) { toast.error(L.error(e)); }
    setBusy(false);
  };

  return (
    <Sheet open={!!item} onClose={onClose} className="editor-sheet" label={isNew ? t('newDish') : f.name}>
      <div className="sheet-head">
        <span className="panel-icon"><Icon name={isNew ? 'plus' : 'edit'} size={17} /></span>
        <h3 className="grow">{isNew ? t('newDish') : pick(f, 'name')}</h3>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label={t('close')}><Icon name="x" /></button>
      </div>
      <div className="sheet-scroll editor">
        <div className={`photo-drop ${drag ? 'drag' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]); }}
          onClick={() => file.current?.click()} role="button" tabIndex={0}>
          {f.image ? <motion.img key={f.image} src={f.image} alt="" initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} /> : null}
          <div className={`photo-drop-cta ${f.image ? 'over' : ''}`}>
            {uploading ? <span className="spinner" /> : <Icon name="upload" size={22} />}
            <span>{f.image ? tr('Replace photo', 'படத்தை மாற்று') : tr('Drop a photo or tap to upload', 'படத்தை இங்கே இடுங்கள் அல்லது தொட்டுப் பதிவேற்றுங்கள்')}</span>
            <span className="subtle small">{tr('JPG, PNG or WebP — resized automatically', 'JPG, PNG, WebP — தானாக அளவு மாற்றப்படும்')}</span>
          </div>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files[0])} />
        </div>
        <Field label={tr('Or photo address (URL)', 'அல்லது பட முகவரி (URL)')}>
          <input className="input input-sm" value={f.image} onChange={(e) => set('image', e.target.value)} placeholder="https://…" />
        </Field>

        <BiField label={t('name')} value={f} field="name" onChange={set} placeholder={['Chicken Dum Biryani', 'சிக்கன் தம் பிரியாணி']} />
        <BiField label={tr('Description', 'விளக்கம்')} value={f} field="description" taField="descTa" textarea onChange={set} />

        <div className="grid-2-tight">
          <Field label={t('categories')}>
            <select className="select input-sm" value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{pick(c, 'name')}</option>)}
            </select>
          </Field>
          <Field label={tr('Food type', 'உணவு வகை')}>
            <Seg size="sm" value={f.veg ? 'veg' : 'nonveg'} onChange={(v) => set('veg', v === 'veg')} options={[
              { value: 'veg', label: <><VegMark veg /> {t('veg')}</> }, { value: 'nonveg', label: <><VegMark veg={false} /> {t('nonveg')}</> },
            ]} />
          </Field>
        </div>

        <div className="grid-3-tight">
          <Field label={`${t('price')} (₹)`}><input className="input input-sm num" inputMode="numeric" value={f.price} onChange={(e) => set('price', e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label={tr('Strike price (₹)', 'அடித்த விலை (₹)')} hint={t('optional')}><input className="input input-sm num" inputMode="numeric" value={f.mrp} onChange={(e) => set('mrp', e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label={tr('Serves', 'பேருக்கு')}><input className="input input-sm num" inputMode="numeric" value={f.serves} onChange={(e) => set('serves', e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label={t('dailyStock')}><input className="input input-sm num" inputMode="numeric" value={f.dailyStock} onChange={(e) => set('dailyStock', e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label={tr('Left today', 'இன்று மீதம்')}><input className="input input-sm num" inputMode="numeric" value={f.stock} onChange={(e) => set('stock', e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label={tr('Spice', 'காரம்')}>
            <div className="spice-pick">
              {[0, 1, 2, 3].map((n) => (
                <button key={n} type="button" className={f.spicy === n ? 'on' : ''} onClick={() => set('spicy', n)} title={String(n)}>
                  {n === 0 ? '—' : Array.from({ length: n }, (_, i) => <Icon key={i} name="flame" size={12} />)}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="flag-grid">
          {[['available', 'eye', t('visible')], ['bestseller', 'flame', t('bestseller')], ['chefSpecial', 'chefHat', t('chefSpecial')], ['isNew', 'sparkles', t('isNew')]].map(([k, icon, label]) => (
            <label key={k} className={`flag-card ${f[k] ? 'on' : ''}`}>
              <Icon name={icon} size={18} />
              <span className="grow">{label}</span>
              <Switch checked={f[k]} onChange={(v) => set(k, v)} label={label} />
            </label>
          ))}
        </div>
      </div>
      <div className="sheet-foot">
        <button className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
        <button className="btn btn-primary grow" onClick={submit} disabled={busy || !f.name.trim()}>
          {busy ? <span className="spinner" /> : <><Icon name="check" size={17} />{isNew ? t('add') : t('saveChanges')}</>}
        </button>
      </div>
    </Sheet>
  );
}
