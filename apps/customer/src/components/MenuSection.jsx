// The menu board: every dish is a sticker card (photo, big name, Tamil name,
// price flash and a chunky ADD), sections a tap away in the sticky bar, and
// the parcel bill printing beside it on wide screens.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Switch, Empty, VegMark, spring } from '@velan/shared/components/ui.jsx';
import { useSite, visibleItems } from '../state/site.js';
import { useSession } from '../state/session.js';
import { useOrders } from '../state/orders.js';
import { reorder } from '../state/cart.js';
import { openDish } from '../state/ui.js';
import { scrollToTarget } from '../lib/scroll.js';
import { AddControl, Spice } from './DishCard.jsx';
import Receipt from './Receipt.jsx';

const TILTS = [-1.2, 0.8, -0.5, 1.1, -0.9, 0.6];

function MenuLine({ item, index }) {
  const { t, tr, pick, other, money } = useLang();
  const img = useRef(null);
  const soldOut = item.stock <= 0;
  const tag = item.bestseller ? t('bestseller') : item.chefSpecial ? t('chefSpecial') : item.isNew ? t('new') : null;
  const tilt = TILTS[index % TILTS.length];
  return (
    <motion.li className={`dc ${soldOut ? 'sold' : ''}`} style={{ '--tilt': `${tilt}deg` }}
      initial={{ opacity: 0, y: 30, rotate: tilt * 3 }} whileInView={{ opacity: 1, y: 0, rotate: 0 }}
      viewport={{ once: true, margin: '0px 0px 140px 0px' }} transition={{ type: 'spring', stiffness: 260, damping: 22, delay: (index % 4) * 0.04 }}>
      <button type="button" className="dc-photo" onClick={() => openDish(item.id)} aria-label={pick(item, 'name')}>
        {item.image ? <img ref={img} src={item.image} alt="" loading="lazy" /> : <Icon name="plate" size={34} />}
      </button>
      {tag && <span className="dc-tape">{tag}</span>}
      <div className="dc-body">
        <p className="dc-top">
          <VegMark veg={item.veg} title={item.veg ? t('veg') : t('nonveg')} />
          <Spice level={item.spicy} />
          {!soldOut && item.stock <= 5 && <span className="dc-low">{t('onlyLeft', { n: item.stock })}</span>}
        </p>
        <button type="button" className="dc-name" onClick={() => openDish(item.id)}>{pick(item, 'name')}</button>
        <p className="dc-alt">{other(item, 'name')}</p>
        <p className="dc-desc">{pick(item, 'description')}</p>
        {item.spicy >= 3 && <p className="dc-note">{tr('Very spicy', 'அதிக காரம்')}</p>}
        <div className="dc-foot">
          <span className="dc-price num">{money(item.price)}{item.mrp > item.price && <s>{money(item.mrp)}</s>}</span>
          <AddControl item={item} imgRef={img} />
        </div>
      </div>
    </motion.li>
  );
}

const POPULAR = {
  id: 'popular', name: 'Most ordered', nameTa: 'அதிகம் ஆர்டர் ஆனவை',
  tagline: 'What Uniyur ordered most this month', taglineTa: 'இந்த மாதம் உன்னியூர் அதிகம் ஆர்டர் செய்தவை',
};

export default function MenuSection() {
  const { t, tr, pick, other, money } = useLang();
  const categories = useSite((s) => s.categories);
  const items = useSite(visibleItems);
  const user = useSession((s) => s.user);
  const past = useOrders((s) => s.list.filter((o) => o.status === 'delivered').slice(0, 3));
  const [query, setQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [active, setActive] = useState(null);
  const bar = useRef(null);
  const barWrapRef = useRef(null);

  useEffect(() => {
    const updateBarH = () => {
      if (barWrapRef.current) {
        const h = Math.round(barWrapRef.current.getBoundingClientRect().height);
        document.documentElement.style.setProperty('--menu-bar-h', `${h}px`);
      }
    };
    updateBarH();
    window.addEventListener('resize', updateBarH);
    return () => window.removeEventListener('resize', updateBarH);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => items.filter((i) => (!vegOnly || i.veg)
    && (!q || [i.name, i.nameTa, i.description, i.descTa].some((f) => f?.toLowerCase().includes(q)))), [items, vegOnly, q]);
  // "Most ordered" leads the menu: the month's four best sellers, then every section in order.
  const popular = q ? [] : [...filtered].sort((a, b) => (b.sold30d || 0) - (a.sold30d || 0)).slice(0, 4);
  const groups = [
    ...(popular.length ? [{ cat: POPULAR, list: popular }] : []),
    ...categories.map((c) => ({ cat: c, list: filtered.filter((i) => i.categoryId === c.id) })),
  ].filter((g) => g.list.length);

  useEffect(() => {
    const els = groups.map((g) => document.getElementById(`cat-${g.cat.id}`)).filter(Boolean);
    if (!els.length) return undefined;
    const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
    const menuBarH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--menu-bar-h')) || 58;
    const topMargin = -(headerH + menuBarH + 20);
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(vis.target.id.slice(4));
    }, { rootMargin: `${topMargin}px 0px -60% 0px` });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.map((g) => g.cat.id).join()]);

  // Centre the active section's chip by scrolling the bar sideways only. scrollIntoView would
  // also move the page, fighting the smooth scroll and making it jump.
  useEffect(() => {
    const box = bar.current;
    const el = box?.querySelector(`[data-cat="${active}"]`);
    if (el) box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
  }, [active]);

  return (
    <section className="menu-section" id="menu">
      <div className="container menu-intro">
        <h2 className="poster-title">
          <span lang="ta">இன்றைய மெனு</span>
          <span>Today&apos;s menu</span>
        </h2>
        <p className="menu-note"><span className="live-dot" />{tr('Counts are live from the kitchen. When a handi is finished, it is finished.', 'எண்ணிக்கை சமையலறையிலிருந்து நேரலையில். அண்டா தீர்ந்தால், தீர்ந்ததுதான்.')}</p>
      </div>

      <div className="menu-bar-wrap" ref={barWrapRef}>
        <div className="container menu-bar">
          <div className="menu-cats" ref={bar} role="tablist">
            {groups.map((g) => (
              <button key={g.cat.id} type="button" role="tab" data-cat={g.cat.id} aria-selected={active === g.cat.id}
                className="menu-cat" onClick={() => scrollToTarget(`cat-${g.cat.id}`)}>
                <span>{pick(g.cat, 'name')}</span>
                {active === g.cat.id && <motion.span layoutId="menu-cat-line" className="menu-cat-line" transition={spring} />}
              </button>
            ))}
          </div>
          <div className="menu-tools">
            <div className="input-group menu-search">
              <Icon name="search" size={17} className="icon" />
              <input className="input input-sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr('Search the menu…', 'மெனுவில் தேடுக…')} />
              {query && <button type="button" className="suffix icon-btn sm" onClick={() => setQuery('')} aria-label={t('close')}><Icon name="x" size={15} /></button>}
            </div>
            <label className="veg-toggle">
              <span>{tr('Veg only', 'சைவம் மட்டும்')}</span>
              <Switch checked={vegOnly} onChange={setVegOnly} label={tr('Veg only', 'சைவம் மட்டும்')} />
            </label>
          </div>
        </div>
      </div>

      <div className="container menu-layout">
        <div className="menu-main">
          {user && past.length > 0 && !q && (
            <div className="again">
              <p className="eyebrow">{t('orderAgain')}</p>
              <div className="again-row">
                {past.map((o) => (
                  <button key={o.id} type="button" className="again-card" onClick={() => reorder(o.items)}>
                    <span className="again-imgs">{o.items.slice(0, 3).map((i) => <img key={i.id} src={i.image} alt="" />)}</span>
                    <span className="grow">
                      <strong className="ellipsis">{o.items.map((i) => pick(i, 'name')).join(', ')}</strong>
                      <small>{money(o.bill.total)} · #{o.number}</small>
                    </span>
                    <Icon name="refresh" size={17} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {groups.length === 0 && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Empty icon="search" title={tr('Nothing matches that', 'பொருத்தமானது எதுவும் இல்லை')}>
                  {tr('Try another word — or ask us, we might make it.', 'வேறு சொல்லில் தேடுங்கள் — அல்லது எங்களைக் கேளுங்கள்.')}
                </Empty>
              </motion.div>
            )}
          </AnimatePresence>

          {groups.map((g) => (
            <div key={g.cat.id} id={`cat-${g.cat.id}`} className="menu-group">
              <div className="menu-group-head">
                <h3 className="display">{pick(g.cat, 'name')}</h3>
                <span className="menu-group-alt">{other(g.cat, 'name')}</span>
                <span className="menu-group-rule" />
                <span className="menu-group-tag">{pick(g.cat, 'tagline')}</span>
              </div>
              <ul className="menu-list">
                {g.list.map((item, i) => <MenuLine key={item.id} item={item} index={i} />)}
              </ul>
            </div>
          ))}
        </div>
        <Receipt />
      </div>
    </section>
  );
}
