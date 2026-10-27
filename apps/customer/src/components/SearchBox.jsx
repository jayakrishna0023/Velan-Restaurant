// Instant dish search: type in English or Tamil, move with the arrow keys,
// open a dish with Enter, or add it straight from the results.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { VegMark } from '@velan/shared/components/ui.jsx';
import { useSite, visibleItems } from '../state/site.js';
import { openDish } from '../state/ui.js';
import { AddControl } from './DishCard.jsx';

const SUGGEST = [['Mutton biryani', 'மட்டன் பிரியாணி'], ['Chicken 65', 'சிக்கன் 65'], ['Parotta', 'பரோட்டா'], ['Halwa', 'அல்வா']];

function Result({ item, active, onOpen, onHover }) {
  const { pick, other, money } = useLang();
  const img = useRef(null);
  return (
    <li className={`sb-item ${active ? 'on' : ''}`} role="option" aria-selected={active} onPointerEnter={onHover}>
      <button type="button" className="sb-open" onClick={onOpen}>
        <span className="sb-thumb">{item.image && <img ref={img} src={item.image} alt="" />}</span>
        <span className="sb-names">
          <strong><VegMark veg={item.veg} /> {pick(item, 'name')}</strong>
          <small>{other(item, 'name')}</small>
        </span>
        <span className="sb-price num">{money(item.price)}</span>
      </button>
      <AddControl item={item} imgRef={img} size="sm" />
    </li>
  );
}

export default function SearchBox({ autoFocus = false, suggest = false, onDone, className = '' }) {
  const { tr, ta } = useLang();
  const items = useSite(visibleItems);
  const categories = useSite((s) => s.categories);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef(null);
  const input = useRef(null);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const catName = Object.fromEntries(categories.map((c) => [c.id, `${c.name} ${c.nameTa || ''}`.toLowerCase()]));
    return items
      .map((i) => {
        const name = `${i.name} ${i.nameTa || ''}`.toLowerCase();
        const rank = name.startsWith(s) ? 0 : name.includes(s) ? 1 : catName[i.categoryId]?.includes(s) ? 2
          : `${i.description || ''} ${i.descTa || ''}`.toLowerCase().includes(s) ? 3 : 9;
        return { i, rank };
      })
      .filter((r) => r.rank < 9)
      .sort((a, b) => a.rank - b.rank || (b.i.sold30d || 0) - (a.i.sold30d || 0))
      .slice(0, 6)
      .map((r) => r.i);
  }, [q, items, categories]);

  useEffect(() => { setHi(0); }, [q]);
  useEffect(() => { if (autoFocus) input.current?.focus(); }, [autoFocus]);
  // Close on a tap elsewhere, or when the page scrolls on while you are not typing.
  useEffect(() => {
    const away = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const scrolled = () => { if (document.activeElement !== input.current) setOpen(false); };
    document.addEventListener('pointerdown', away);
    window.addEventListener('scroll', scrolled, { passive: true });
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener('scroll', scrolled); };
  }, []);

  const pickDish = (item) => { openDish(item.id); setOpen(false); onDone?.(); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(results.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === 'Enter' && results[hi]) { e.preventDefault(); pickDish(results[hi]); }
    else if (e.key === 'Escape') { if (q) setQ(''); else { input.current?.blur(); onDone?.(); } }
  };
  const show = open && q.trim().length > 0;

  return (
    <div ref={box} className={`sbox ${show ? 'is-open' : ''} ${className}`}>
      <label className="sb-field">
        <Icon name="search" size={19} />
        <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
          placeholder={tr('Search biryani, chicken 65, parotta…', 'பிரியாணி, சிக்கன் 65, பரோட்டா… தேடுக')}
          role="combobox" aria-expanded={show} aria-autocomplete="list" aria-label={tr('Search the menu', 'மெனுவில் தேடுக')} />
        {q && <button type="button" className="sb-clear" onClick={() => { setQ(''); input.current?.focus(); }} aria-label={tr('Clear', 'அழி')}><Icon name="x" size={16} /></button>}
      </label>
      <AnimatePresence>
        {show && (
          <motion.div className="sb-panel" initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}>
            {results.length ? (
              <ul role="listbox">
                {results.map((item, k) => <Result key={item.id} item={item} active={k === hi} onOpen={() => pickDish(item)} onHover={() => setHi(k)} />)}
              </ul>
            ) : (
              <p className="sb-empty">{tr('No dish matches “{q}”.', '“{q}” பொருந்தும் உணவு இல்லை.', { q: q.trim() })}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {suggest && (
        <p className="sb-suggest">
          <span>{tr('Popular:', 'பிரபலம்:')}</span>
          {SUGGEST.map(([en, tam]) => (
            <button key={en} type="button" onClick={() => { setQ(ta ? tam : en); setOpen(true); input.current?.focus(); }}>{ta ? tam : en}</button>
          ))}
        </p>
      )}
    </div>
  );
}
