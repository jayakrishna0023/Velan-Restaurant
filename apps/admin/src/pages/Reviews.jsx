// Customer reviews: reply, and feature the best ones on the website.
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Seg, Stars, toast, Empty, AnimatedNumber } from '@velan/shared/components/ui.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { useAsync } from '@velan/shared/hooks.js';
import { api } from '../api.js';
import { openOrder } from '../state/ui.js';
import { Avatar, Page, PageHead, Panel, SkeletonRows } from '../components/common.jsx';

export default function Reviews() {
  const L = useLang();
  const { t, tr } = L;
  const [filter, setFilter] = useState('all');
  const { data, setData } = useAsync(() => api.get(`/admin/reviews?filter=${filter}`), [filter]);
  const [limit, setLimit] = useState(30);

  const update = async (r, body) => {
    try {
      const o = await api.put(`/admin/reviews/${r.orderId}`, body);
      setData((d) => ({ ...d, reviews: d.reviews.map((x) => (x.orderId === r.orderId ? { ...x, ...o.rating } : x)) }));
      toast.success(body.reply !== undefined ? tr('Reply saved', 'பதில் சேமிக்கப்பட்டது') : body.featured ? tr('Featured on the website', 'இணையதளத்தில் காட்டப்படுகிறது') : tr('Removed from the website', 'இணையதளத்திலிருந்து நீக்கப்பட்டது'));
    } catch (e) { toast.error(L.error(e)); }
  };

  const s = data?.summary;
  const maxDist = s ? Math.max(1, ...s.distribution) : 1;
  return (
    <Page>
      <PageHead title={t('nav.reviews')} sub={tr('Featured reviews are shown on the website.', 'சிறப்பு மதிப்புரைகள் இணையதளத்தில் காட்டப்படும்.')} />
      {s && (
        <div className="review-summary">
          <Panel className="rs-score">
            <span className="eyebrow">{tr('Food', 'உணவு')}</span>
            <b className="display rs-big num"><AnimatedNumber value={s.food || 0} format={(v) => v.toFixed(1)} /></b>
            <Stars value={s.food || 0} size={20} />
            <span className="subtle small">{tr(`${s.count} ratings`, `${s.count} மதிப்பீடுகள்`)}</span>
          </Panel>
          <Panel className="rs-score">
            <span className="eyebrow">{tr('Delivery', 'டெலிவரி')}</span>
            <b className="display rs-big num"><AnimatedNumber value={s.delivery || 0} format={(v) => v.toFixed(1)} /></b>
            <Stars value={s.delivery || 0} size={20} />
            <span className="subtle small">{tr('Rider & packing', 'பார்ட்னர் & பேக்கிங்')}</span>
          </Panel>
          <Panel className="rs-dist" title={tr('Rating spread', 'மதிப்பீடு பரவல்')}>
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} className="dist-row">
                <span className="num">{n} ★</span>
                <span className="dist-track"><motion.i className={n <= 2 ? 'low' : n === 3 ? 'mid' : ''} initial={{ width: 0 }} animate={{ width: `${(s.distribution[n - 1] / maxDist) * 100}%` }} transition={{ duration: 0.9, delay: (5 - n) * 0.08 }} /></span>
                <b className="num">{s.distribution[n - 1]}</b>
              </div>
            ))}
          </Panel>
        </div>
      )}
      <div className="menu-tools">
        <Seg size="sm" value={filter} onChange={setFilter} options={[
          { value: 'all', label: tr('All', 'அனைத்தும்') }, { value: 'low', label: tr('3★ and below', '3★ மற்றும் குறைவு') },
          { value: 'unreplied', label: tr('Needs a reply', 'பதில் தேவை') }, { value: 'featured', label: tr('Featured', 'சிறப்பு') },
        ]} />
      </div>
      {!data ? <SkeletonRows rows={4} height={120} /> : data.reviews.length === 0 ? (
        <Empty icon="message" title={tr('No reviews here', 'இங்கு மதிப்புரைகள் இல்லை')} />
      ) : (
        <div className="review-grid">
          <AnimatePresence>
            {data.reviews.slice(0, limit).map((r, i) => <ReviewCard key={r.orderId} r={r} i={i} onUpdate={update} />)}
          </AnimatePresence>
        </div>
      )}
      {data && data.reviews.length > limit && <div className="pager"><button className="btn btn-soft btn-sm" onClick={() => setLimit(limit + 30)}>{tr('Show more', 'மேலும் காட்டு')}</button></div>}
    </Page>
  );
}

function ReviewCard({ r, i, onUpdate }) {
  const L = useLang();
  const { tr, pick } = L;
  const [reply, setReply] = useState('');
  const [open, setOpen] = useState(false);
  return (
    <motion.article className={`review-card ${r.food <= 2 ? 'low' : ''} ${r.featured ? 'featured' : ''}`} layout
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
      <div className="row">
        <Avatar name={r.customerName} size={38} />
        <div className="grow">
          <b>{r.customerName}</b>
          <span className="subtle small block">{L.date(r.at)} · <button className="link" onClick={() => openOrder(r.orderId)}>#{r.number}</button></span>
        </div>
        <button className={`feature-btn ${r.featured ? 'on' : ''}`} onClick={() => onUpdate(r, { featured: !r.featured })}
          title={r.featured ? tr('Featured on website', 'இணையதளத்தில் உள்ளது') : tr('Feature on website', 'இணையதளத்தில் காட்டு')}>
          <Icon name="sparkles" size={16} />
        </button>
      </div>
      <div className="row" style={{ gap: 10, margin: '10px 0 6px' }}>
        <Stars value={r.food} size={16} />
        {r.delivery && <span className="subtle small row" style={{ gap: 4 }}><Icon name="scooter" size={13} />{r.delivery}★</span>}
      </div>
      {r.review ? <p className="review-text">“{r.review}”</p> : <p className="subtle small">{tr('Rated without a comment', 'கருத்து இல்லாமல் மதிப்பிட்டார்')}</p>}
      <div className="review-items subtle small">{r.items.map((it) => `${it.qty}× ${pick(it, 'name')}`).join(' · ')}</div>
      {r.reply ? (
        <div className="review-reply"><Icon name="store" size={14} /><div><b>{tr('Your reply', 'உங்கள் பதில்')}</b><p>{r.reply.text}</p></div></div>
      ) : r.review ? (
        open ? (
          <div className="reply-box">
            <textarea className="textarea" rows={2} value={reply} onChange={(e) => setReply(e.target.value)} autoFocus
              placeholder={r.food >= 4 ? tr('Thank you so much! See you again…', 'மிக்க நன்றி! மீண்டும் சந்திப்போம்…') : tr('Sorry about that — we will…', 'மன்னிக்கவும் — நாங்கள்…')} />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-xs" onClick={() => setOpen(false)}>{L.t('cancel')}</button>
              <button className="btn btn-primary btn-xs" disabled={!reply.trim()} onClick={() => onUpdate(r, { reply })}><Icon name="arrowRight" size={13} />{tr('Reply', 'பதில்')}</button>
            </div>
          </div>
        ) : <button className="btn btn-soft btn-xs" onClick={() => setOpen(true)}><Icon name="message" size={13} />{tr('Reply', 'பதில்')}</button>
      ) : null}
    </motion.article>
  );
}
