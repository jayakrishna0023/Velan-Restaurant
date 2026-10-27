// Menu & stock: add, edit, copy, delete (with undo), reorder by dragging, and
// export / import the whole menu as a spreadsheet. Prices, stock and
// visibility are edited in place and update the website live.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Seg, Switch, VegMark, toast, confirmDialog, Empty } from '@velan/shared/components/ui.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { api } from '../api.js';
import { setMenu, useLive } from '../state/live.js';
import { Page, PageHead, StatPill } from '../components/common.jsx';
import DishEditor from '../components/menu/DishEditor.jsx';
import CategoryManager from '../components/menu/CategoryManager.jsx';
import { download, parseCsv, toCsv } from '../lib/csv.js';

const low = (m) => m.stock <= Math.max(3, Math.ceil(m.dailyStock * 0.15));
const COLUMNS = ['id', 'category', 'name', 'nameTa', 'price', 'mrp', 'dailyStock', 'stock', 'veg', 'spicy', 'bestseller', 'chefSpecial', 'isNew', 'available', 'description', 'descTa', 'image'];
const yes = (v) => /^(1|true|yes|y|ஆம்)$/i.test(String(v).trim());

export default function Menu() {
  const L = useLang();
  const { t, tr, pick } = L;
  const items = useLive((s) => s.items);
  const categories = useLive((s) => s.categories);
  const [q, setQ] = useState('');
  const [view, setView] = useState('all');
  const [selected, setSelected] = useState(() => new Set());
  const [editing, setEditing] = useState(null);
  const [cats, setCats] = useState(false);
  const [order, setOrder] = useState({});
  const fileRef = useRef(null);
  const canDrag = view === 'all' && !q;

  // Local order per category while dragging; reset whenever the live menu changes.
  useEffect(() => { setOrder({}); }, [items]);

  const filtered = useMemo(() => items.filter((m) => {
    if (q && !`${m.name} ${m.nameTa}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (view === 'hidden') return m.available === false;
    if (view === 'low') return m.available !== false && low(m);
    if (view === 'out') return m.stock === 0;
    return true;
  }), [items, q, view]);

  const stats = useMemo(() => ({
    total: items.length,
    shown: items.filter((m) => m.available !== false).length,
    low: items.filter((m) => m.available !== false && low(m)).length,
    out: items.filter((m) => m.stock === 0).length,
  }), [items]);

  const toggleSel = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const save = async (m, patch, ok) => {
    try {
      await api.put(`/admin/menu/${m.id}`, patch);
      if (ok) toast.success(ok);
    } catch (e) { toast.error(L.error(e)); }
  };

  // Deleting never needs a second thought: every delete can be undone from the toast.
  const offerUndo = (removed) => {
    const names = removed.map((m) => pick(m, 'name'));
    toast(removed.length === 1 ? tr('Deleted {n}', '{n} நீக்கப்பட்டது', { n: names[0] }) : tr('Deleted {c} dishes', '{c} உணவுகள் நீக்கப்பட்டன', { c: removed.length }), {
      tone: 'info', icon: 'trash',
      action: {
        label: tr('Undo', 'திரும்பப் பெறு'),
        onClick: async () => {
          try { await api.post('/admin/menu/restore', { items: removed }); toast.success(tr('Put back on the menu', 'மெனுவில் மீண்டும் சேர்க்கப்பட்டது')); } catch (e) { toast.error(L.error(e)); }
        },
      },
    });
  };
  const remove = async (ids) => {
    try {
      const { removed } = ids.length === 1 ? await api.del(`/admin/menu/${ids[0]}`) : await api.post('/admin/menu/bulk-delete', { ids });
      setSelected((s) => { const n = new Set(s); ids.forEach((id) => n.delete(id)); return n; });
      offerUndo(removed);
    } catch (e) { toast.error(L.error(e)); }
  };

  const duplicate = (m) => setEditing({
    ...m, id: undefined, isDraft: true, name: tr('{n} (copy)', '{n} (நகல்)', { n: m.name }), nameTa: m.nameTa ? `${m.nameTa} (நகல்)` : '',
    bestseller: false, chefSpecial: false, isNew: true, stock: m.dailyStock,
  });

  const bulk = async (kind) => {
    const ids = [...selected];
    if (kind === 'delete') {
      const ok = await confirmDialog({ title: tr('Delete {c} dishes?', '{c} உணவுகளை நீக்கவா?', { c: ids.length }), body: tr('You can undo this for a few seconds afterwards.', 'சில விநாடிகளுக்கு இதைத் திரும்பப் பெறலாம்.'), confirmLabel: t('delete'), tone: 'danger' });
      if (ok) remove(ids);
      return;
    }
    try {
      if (kind === 'restock') {
        await Promise.all(ids.map((id) => { const m = items.find((x) => x.id === id); return api.put(`/admin/menu/${id}`, { stock: m.dailyStock }); }));
      } else {
        const patch = { show: { available: true }, hide: { available: false }, out: { stock: 0 } }[kind];
        setMenu(await api.post('/admin/menu/bulk', { ids, patch }));
      }
      toast.success(tr(`Updated ${ids.length} dishes`, `${ids.length} உணவுகள் புதுப்பிக்கப்பட்டன`));
      setSelected(new Set());
    } catch (e) { toast.error(L.error(e)); }
  };

  const moveToCategory = async (categoryId) => {
    if (!categoryId) return;
    try {
      setMenu(await api.post('/admin/menu/bulk', { ids: [...selected], patch: { categoryId } }));
      toast.success(tr('Moved {c} dishes', '{c} உணவுகள் நகர்த்தப்பட்டன', { c: selected.size }));
      setSelected(new Set());
    } catch (e) { toast.error(L.error(e)); }
  };

  const resetStock = async () => {
    const ok = await confirmDialog({
      title: t('resetStock'),
      body: tr('Every dish goes back to its daily quantity. Do this each morning before service.', 'ஒவ்வொரு உணவும் அதன் தினசரி அளவுக்குத் திரும்பும். தினமும் காலையில் செய்யுங்கள்.'),
      confirmLabel: t('resetStock'),
    });
    if (!ok) return;
    try { setMenu(await api.post('/admin/menu/reset-stock')); toast.success(tr('Stock reset for today', 'இன்றைய இருப்பு மீட்டமைக்கப்பட்டது')); } catch (e) { toast.error(L.error(e)); }
  };

  // Dragging reorders a section; the whole menu order is saved once the drag ends.
  const listFor = (c) => order[c.id] || filtered.filter((m) => m.categoryId === c.id);
  const saveOrder = async () => {
    const ids = categories.flatMap((c) => (order[c.id] || items.filter((m) => m.categoryId === c.id)).map((m) => m.id));
    try { await api.post('/admin/menu/reorder', { ids }); } catch (e) { toast.error(L.error(e)); }
  };

  const exportCsv = () => {
    const catName = Object.fromEntries(categories.map((c) => [c.id, c.name]));
    const rows = categories.flatMap((c) => items.filter((m) => m.categoryId === c.id)).map((m) => ({ ...m, category: catName[m.categoryId] || '', mrp: m.mrp || '' }));
    download(`velan-menu-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, COLUMNS));
    toast.success(tr('Menu downloaded — open it in Excel or Google Sheets', 'மெனு பதிவிறக்கப்பட்டது — Excel அல்லது Google Sheets-இல் திறக்கவும்'));
  };

  const importCsv = async (file) => {
    if (!file) return;
    const rows = parseCsv(await file.text()).filter((r) => r.name);
    fileRef.current.value = '';
    if (!rows.length) { toast.error(tr('No dishes found in that file. Keep the header row from an exported menu.', 'அந்தக் கோப்பில் உணவுகள் இல்லை. ஏற்றுமதி செய்த மெனுவின் தலைப்பு வரியை வைத்திருங்கள்.')); return; }
    const byId = new Map(items.map((m) => [m.id, m]));
    const byName = new Map(items.map((m) => [m.name.trim().toLowerCase(), m]));
    const known = rows.filter((r) => byId.has(r.id) || byName.has(r.name.toLowerCase())).length;
    const ok = await confirmDialog({
      title: tr('Import {n} dishes?', '{n} உணவுகளை இறக்குமதி செய்யவா?', { n: rows.length }),
      body: tr('{u} existing dishes will be updated and {a} new ones added. Nothing is deleted.', '{u} உணவுகள் புதுப்பிக்கப்படும், {a} புதியவை சேர்க்கப்படும். எதுவும் நீக்கப்படாது.', { u: known, a: rows.length - known }),
      confirmLabel: tr('Import', 'இறக்குமதி'),
    });
    if (!ok) return;
    const catId = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));
    let added = 0;
    let updated = 0;
    const failed = [];
    for (const r of rows) {
      try {
        let categoryId = catId.get((r.category || '').toLowerCase());
        if (!categoryId && r.category) {
          const c = await api.post('/admin/categories', { name: r.category });
          categoryId = c.id;
          catId.set(r.category.toLowerCase(), c.id);
        }
        const body = {
          name: r.name, nameTa: r.nameTa, description: r.description, descTa: r.descTa, image: r.image,
          price: Number(r.price) || 0, mrp: r.mrp ? Number(r.mrp) : null, dailyStock: Number(r.dailyStock) || 0, stock: Number(r.stock) || 0,
          spicy: Math.min(3, Number(r.spicy) || 0), veg: yes(r.veg), bestseller: yes(r.bestseller), chefSpecial: yes(r.chefSpecial),
          isNew: yes(r.isNew), available: r.available === '' ? true : yes(r.available), ...(categoryId ? { categoryId } : {}),
        };
        const existing = byId.get(r.id) || byName.get(r.name.toLowerCase());
        if (existing) { await api.put(`/admin/menu/${existing.id}`, body); updated += 1; } else { await api.post('/admin/menu', body); added += 1; }
      } catch { failed.push(r.name); }
    }
    toast[failed.length ? 'error' : 'success'](
      tr('{u} updated, {a} added', '{u} புதுப்பிக்கப்பட்டன, {a} சேர்க்கப்பட்டன', { u: updated, a: added }),
      failed.length ? tr('Could not import: {n}', 'இறக்குமதி ஆகவில்லை: {n}', { n: failed.slice(0, 4).join(', ') }) : undefined,
    );
  };

  return (
    <Page className="menu-page">
      <PageHead title={t('nav.menu')} sub={tr('Add, copy, delete and drag dishes into order — the website updates live.', 'உணவுகளைச் சேர், நகலெடு, நீக்கு, இழுத்து வரிசைப்படுத்து — இணையதளம் உடனே மாறும்.')}>
        <button className="btn btn-soft btn-sm" onClick={() => setCats(true)}><Icon name="list" size={15} />{t('categories')}</button>
        <button className="btn btn-soft btn-sm" onClick={exportCsv} title={tr('Download the menu as a spreadsheet', 'மெனுவை விரிதாளாகப் பதிவிறக்கு')}><Icon name="download" size={15} />{tr('Export', 'ஏற்றுமதி')}</button>
        <button className="btn btn-soft btn-sm" onClick={() => fileRef.current?.click()} title={tr('Add or update dishes from a spreadsheet', 'விரிதாளிலிருந்து உணவுகளைச் சேர் / புதுப்பி')}><Icon name="upload" size={15} />{tr('Import', 'இறக்குமதி')}</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => importCsv(e.target.files[0])} />
        <button className="btn btn-outline btn-sm" onClick={resetStock}><Icon name="refresh" size={15} />{t('resetStock')}</button>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Icon name="plus" size={15} />{t('newDish')}</button>
      </PageHead>

      <motion.div className="menu-stats" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <StatPill icon="utensils" label={tr('Dishes', 'உணவுகள்')} value={stats.total} />
        <StatPill icon="eye" label={t('visible')} value={stats.shown} tone="leaf" />
        <StatPill icon="alert" label={tr('Running low', 'இருப்பு குறைவு')} value={stats.low} tone="gold" />
        <StatPill icon="x" label={t('soldOut')} value={stats.out} tone="maroon" />
      </motion.div>

      <div className="menu-tools">
        <div className="input-group grow" style={{ maxWidth: 360 }}>
          <Icon name="search" size={16} className="icon" />
          <input className="input input-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Search dishes', 'உணவுகளைத் தேடுக')} />
        </div>
        <Seg size="sm" value={view} onChange={setView} options={[
          { value: 'all', label: tr('All', 'அனைத்தும்') }, { value: 'low', label: tr('Low', 'குறைவு') },
          { value: 'out', label: t('soldOut') }, { value: 'hidden', label: t('hidden') },
        ]} />
        {canDrag && <span className="subtle small menu-drag-hint"><Icon name="grip" size={14} /> {tr('Drag the handle to reorder', 'வரிசை மாற்ற கைப்பிடியை இழுக்கவும்')}</span>}
      </div>

      {filtered.length === 0 && <Empty icon="utensils" title={tr('No dishes match', 'பொருந்தும் உணவுகள் இல்லை')} />}
      {categories.map((c) => {
        const list = listFor(c);
        if (!list.length && !canDrag) return null;
        return (
          <motion.section key={c.id} className="menu-cat" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <header className="menu-cat-head">
              <h3>{pick(c, 'name')}</h3>
              <span className="tamil-sub">{L.other(c, 'name')}</span>
              <span className="badge">{list.length}</span>
              <span className="grow" />
              {list.length > 0 && (
                <button className="btn btn-ghost btn-xs" onClick={() => setSelected((s) => { const n = new Set(s); const all = list.every((m) => n.has(m.id)); list.forEach((m) => (all ? n.delete(m.id) : n.add(m.id))); return n; })}>
                  {tr('Select all', 'அனைத்தையும் தேர்வு செய்')}
                </button>
              )}
              <button className="btn btn-soft btn-xs" onClick={() => setEditing({ isDraft: true, categoryId: c.id })}><Icon name="plus" size={13} />{tr('Add dish here', 'இங்கே உணவு சேர்')}</button>
            </header>
            {list.length === 0 ? (
              <p className="menu-cat-empty subtle small">{tr('No dishes in this section yet.', 'இந்தப் பிரிவில் இன்னும் உணவுகள் இல்லை.')}</p>
            ) : (
              <Reorder.Group as="div" axis="y" className="dish-list" values={list} onReorder={(next) => setOrder((o) => ({ ...o, [c.id]: next }))}>
                {list.map((m) => (
                  <DishRow key={m.id} m={m} draggable={canDrag} onDragEnd={saveOrder} selected={selected.has(m.id)} onSelect={() => toggleSel(m.id)}
                    onEdit={() => setEditing(m)} onCopy={() => duplicate(m)} onDelete={() => remove([m.id])} save={save} />
                ))}
              </Reorder.Group>
            )}
          </motion.section>
        );
      })}

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div className="bulk-bar" initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 90, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
            <b className="num">{selected.size}</b> <span>{tr('selected', 'தேர்வு')}</span>
            <span className="grow" />
            <button className="btn btn-soft btn-sm" onClick={() => bulk('show')}><Icon name="eye" size={15} />{tr('Show', 'காட்டு')}</button>
            <button className="btn btn-soft btn-sm" onClick={() => bulk('hide')}><Icon name="eyeOff" size={15} />{tr('Hide', 'மறை')}</button>
            <button className="btn btn-soft btn-sm" onClick={() => bulk('out')}><Icon name="x" size={15} />{t('soldOut')}</button>
            <button className="btn btn-gold btn-sm" onClick={() => bulk('restock')}><Icon name="refresh" size={15} />{tr('Refill', 'நிரப்பு')}</button>
            <select className="select input-sm bulk-move" value="" onChange={(e) => moveToCategory(e.target.value)} aria-label={tr('Move to section', 'பிரிவுக்கு நகர்த்து')}>
              <option value="">{tr('Move to…', 'நகர்த்து…')}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{pick(c, 'name')}</option>)}
            </select>
            <button className="btn btn-danger btn-sm" onClick={() => bulk('delete')}><Icon name="trash" size={15} />{t('delete')}</button>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSelected(new Set())} aria-label={t('close')}><Icon name="x" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <DishEditor item={editing} onClose={() => setEditing(null)} />
      <CategoryManager open={cats} onClose={() => setCats(false)} />
    </Page>
  );
}

function DishRow({ m, selected, onSelect, onEdit, onCopy, onDelete, save, draggable, onDragEnd }) {
  const L = useLang();
  const { t, tr, pick, other } = L;
  const drag = useDragControls();
  const [price, setPrice] = useState(m.price);
  useEffect(() => setPrice(m.price), [m.price]);
  const pct = m.dailyStock ? Math.min(100, (m.stock / m.dailyStock) * 100) : 0;
  const commitPrice = () => {
    const v = Math.round(Number(price));
    if (!Number.isFinite(v) || v < 0) { setPrice(m.price); return; }
    if (v !== m.price) save(m, { price: v }, tr(`${m.name}: ₹${m.price} → ₹${v}`, `${m.nameTa || m.name}: ₹${m.price} → ₹${v}`));
  };
  const flag = (k) => save(m, { [k]: !m[k] });
  return (
    <Reorder.Item as="div" value={m} dragListener={false} dragControls={drag} onDragEnd={onDragEnd}
      className={`dish-row ${m.available === false ? 'is-hidden' : ''} ${selected ? 'is-selected' : ''}`}
      whileDrag={{ scale: 1.015, boxShadow: '0 18px 40px -18px rgba(0,0,0,0.45)', zIndex: 5 }}>
      {draggable ? (
        <button className="dish-grip" onPointerDown={(e) => drag.start(e)} aria-label={tr('Drag to reorder', 'வரிசை மாற்ற இழுக்கவும்')} title={tr('Drag to reorder', 'வரிசை மாற்ற இழுக்கவும்')}><Icon name="grip" size={16} /></button>
      ) : <span className="dish-grip off" />}
      <label className="dish-check"><input type="checkbox" checked={selected} onChange={onSelect} /><span /></label>
      <button className="dish-thumb" onClick={onEdit} style={m.image ? { backgroundImage: `url(${m.image})` } : undefined} aria-label={t('edit')}>
        {!m.image && <Icon name="image" size={20} />}
      </button>
      <div className="dish-name">
        <div className="row" style={{ gap: 7 }}><VegMark veg={m.veg} /><b className="ellipsis">{pick(m, 'name')}</b></div>
        <span className="tamil-sub ellipsis">{other(m, 'name')}</span>
        <div className="dish-flags">
          {[['bestseller', 'flame'], ['chefSpecial', 'chefHat'], ['isNew', 'sparkles']].map(([k, icon]) => (
            <button key={k} className={`flag ${m[k] ? 'on' : ''}`} onClick={() => flag(k)} title={t(k)}><Icon name={icon} size={12} />{t(k)}</button>
          ))}
        </div>
      </div>
      <div className="dish-price">
        <span className="field-label">{t('price')}</span>
        <div className="price-input"><span>₹</span>
          <input className="num" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
            onBlur={commitPrice} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        </div>
      </div>
      <div className="dish-stock">
        <span className="field-label">{t('stock')} <span className="subtle">/ {m.dailyStock}</span></span>
        <div className="stepper">
          <button onClick={() => save(m, { stock: Math.max(0, m.stock - 1) })} aria-label="−"><Icon name="minus" size={14} /></button>
          <b className={`num ${m.stock === 0 ? 'danger-text' : ''}`}>{m.stock}</b>
          <button onClick={() => save(m, { stock: m.stock + 1 })} aria-label="+"><Icon name="plus" size={14} /></button>
        </div>
        <span className="stock-bar"><motion.i animate={{ width: `${pct}%` }} className={pct <= 15 ? 'low' : pct <= 40 ? 'mid' : ''} /></span>
      </div>
      <div className="dish-vis">
        <Switch checked={m.available !== false} onChange={(v) => save(m, { available: v }, v ? tr('Shown on the menu', 'மெனுவில் காட்டப்படுகிறது') : tr('Hidden from the menu', 'மெனுவிலிருந்து மறைக்கப்பட்டது'))} label={t('visible')} />
        <span className="subtle small">{m.available === false ? t('hidden') : t('visible')}</span>
      </div>
      <div className="dish-actions">
        <span className="subtle small num" title={tr('Plates sold in 30 days', '30 நாளில் விற்றவை')}><Icon name="trendUp" size={13} /> {m.sold30d || 0}</span>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onEdit} title={t('edit')}><Icon name="edit" size={16} /></button>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onCopy} title={tr('Duplicate', 'நகலெடு')}><Icon name="copy" size={16} /></button>
        <button className="btn btn-ghost btn-icon btn-sm danger-text" onClick={onDelete} title={t('delete')}><Icon name="trash" size={16} /></button>
      </div>
    </Reorder.Item>
  );
}
