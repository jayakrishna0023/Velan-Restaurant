// Add, rename, reorder and delete menu categories.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Modal, toast, confirmDialog } from '@velan/shared/components/ui.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { api } from '../../api.js';
import { useLive } from '../../state/live.js';

export default function CategoryManager({ open, onClose }) {
  const L = useLang();
  const { t, tr } = L;
  const categories = useLive((s) => s.categories);
  const items = useLive((s) => s.items);
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState({ name: '', nameTa: '' });

  useEffect(() => { if (open) setRows(categories.map((c) => ({ ...c }))); }, [open, categories]);

  const edit = (id, k, v) => setRows((r) => r.map((c) => (c.id === id ? { ...c, [k]: v, dirty: true } : c)));
  const fail = (e) => toast.error(L.error(e));

  const save = async (c) => {
    try { await api.put(`/admin/categories/${c.id}`, { name: c.name, nameTa: c.nameTa, tagline: c.tagline, taglineTa: c.taglineTa }); toast.success(t('saved')); } catch (e) { fail(e); }
  };
  const move = async (i, d) => {
    const next = [...rows];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    setRows(next);
    try { await api.post('/admin/categories/reorder', { ids: next.map((c) => c.id) }); } catch (e) { fail(e); }
  };
  // A section with dishes in it can still be deleted: its dishes move to the section chosen here.
  const [moving, setMoving] = useState(null);
  const remove = async (c, moveTo) => {
    const count = items.filter((m) => m.categoryId === c.id).length;
    if (count && !moveTo) { setMoving({ id: c.id, to: rows.find((x) => x.id !== c.id)?.id || '' }); return; }
    const ok = await confirmDialog({
      title: tr(`Delete ${c.name}?`, `${c.nameTa || c.name} நீக்கவா?`),
      body: count ? tr('Its {n} dishes move to the section you chose.', 'இதன் {n} உணவுகள் நீங்கள் தேர்ந்த பிரிவுக்கு நகரும்.', { n: count }) : undefined,
      confirmLabel: t('delete'), tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.del(`/admin/categories/${c.id}${moveTo ? `?moveTo=${encodeURIComponent(moveTo)}` : ''}`);
      setMoving(null);
      toast.success(tr('Category deleted', 'பிரிவு நீக்கப்பட்டது'));
    } catch (e) { fail(e); }
  };
  const add = async () => {
    if (!draft.name.trim()) return;
    try { await api.post('/admin/categories', draft); setDraft({ name: '', nameTa: '' }); toast.success(tr('Category added', 'பிரிவு சேர்க்கப்பட்டது')); } catch (e) { fail(e); }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('categories')} width={640}>
      <ul className="cat-list">
        <AnimatePresence initial={false}>
          {rows.map((c, i) => (
            <motion.li key={c.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}>
              <div className="cat-move">
                <button disabled={i === 0} onClick={() => move(i, -1)} aria-label="Up"><Icon name="chevronUp" size={15} /></button>
                <button disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="Down"><Icon name="chevronDown" size={15} /></button>
              </div>
              <div className="cat-fields">
                <input className="input input-sm" value={c.name} onChange={(e) => edit(c.id, 'name', e.target.value)} />
                <input className="input input-sm tamil-input" value={c.nameTa} onChange={(e) => edit(c.id, 'nameTa', e.target.value)} />
                <input className="input input-sm cat-tag" value={c.tagline || ''} placeholder={tr('Tagline', 'குறிப்பு வரி')} onChange={(e) => edit(c.id, 'tagline', e.target.value)} />
                <input className="input input-sm cat-tag tamil-input" value={c.taglineTa || ''} placeholder={tr('Tagline (Tamil)', 'குறிப்பு வரி (தமிழ்)')} onChange={(e) => edit(c.id, 'taglineTa', e.target.value)} />
              </div>
              <span className="badge" title={tr('Dishes', 'உணவுகள்')}>{items.filter((m) => m.categoryId === c.id).length}</span>
              <button className="btn btn-soft btn-icon btn-sm" disabled={!c.dirty} onClick={() => save(c)} title={t('save')}><Icon name="check" size={16} /></button>
              <button className="btn btn-ghost btn-icon btn-sm danger-text" onClick={() => remove(c)} title={t('delete')}><Icon name="trash" size={16} /></button>
              <AnimatePresence>
                {moving?.id === c.id && (
                  <motion.div className="cat-movebox" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <span>{tr('Move its dishes to', 'இதன் உணவுகளை நகர்த்த வேண்டிய பிரிவு')}</span>
                    <select className="select input-sm" value={moving.to} onChange={(e) => setMoving({ ...moving, to: e.target.value })}>
                      {rows.filter((x) => x.id !== c.id).map((x) => <option key={x.id} value={x.id}>{L.pick(x, 'name')}</option>)}
                    </select>
                    <button className="btn btn-danger btn-sm" disabled={!moving.to} onClick={() => remove(c, moving.to)}><Icon name="trash" size={14} />{tr('Move & delete', 'நகர்த்தி நீக்கு')}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setMoving(null)}>{t('cancel')}</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <div className="cat-add">
        <input className="input input-sm" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={tr('New category (English)', 'புதிய பிரிவு (ஆங்கிலம்)')} />
        <input className="input input-sm tamil-input" value={draft.nameTa} onChange={(e) => setDraft({ ...draft, nameTa: e.target.value })} placeholder={tr('Name in Tamil', 'தமிழில் பெயர்')} />
        <button className="btn btn-primary btn-sm" onClick={add} disabled={!draft.name.trim()}><Icon name="plus" size={15} />{t('add')}</button>
      </div>
    </Modal>
  );
}
