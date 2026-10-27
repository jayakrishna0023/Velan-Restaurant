// What people said at the table: one large quote at a time, crossfading
// on its own, with the rating set in plain type beside it.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Stars } from '@velan/shared/components/ui.jsx';
import { useSite } from '../state/site.js';
import { Reveal, ease } from '../lib/motion.jsx';
import SectionHead from './SectionHead.jsx';

export default function Reviews() {
  const { tr, pick, date } = useLang();
  const reviews = useSite((s) => s.reviews);
  const stats = useSite((s) => s.stats);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || reviews.length < 2) return undefined;
    const id = setInterval(() => setI((x) => (x + 1) % reviews.length), 6500);
    return () => clearInterval(id);
  }, [paused, reviews.length]);
  if (!reviews.length) return null;
  const r = reviews[i % reviews.length];
  const tamil = /[஀-௿]/.test(r.review);
  return (
    <section className="reviews" id="reviews" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="container rv-grid">
        <div className="rv-side">
          <SectionHead eyebrow={['Said at the table', 'சாப்பிட்டவர்கள் சொன்னது']} title={['In their words', 'அவர்கள் வார்த்தைகளில்']} />
          <Reveal className="rv-rating">
            <span className="rv-num num">{stats.rating ? stats.rating.toFixed(1) : '—'}</span>
            <span>
              <Stars value={stats.rating || 0} size={18} />
              <small>{tr('from {n} orders delivered and rated', '{n} டெலிவரி ஆர்டர்களின் மதிப்பீடு', { n: stats.ratings || 0 })}</small>
            </span>
          </Reveal>
        </div>
        <div className="rv-stage">
          <span className="rv-mark" aria-hidden="true">“</span>
          <AnimatePresence mode="wait">
            <motion.figure key={i} className="rv-quote" initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -18, filter: 'blur(6px)' }} transition={{ duration: 0.8, ease }}>
              <blockquote className={tamil ? 'ta' : ''}>{r.review}</blockquote>
              <figcaption>
                <strong>{r.name}</strong>
                <span>{r.items.map((it) => pick(it, 'name')).join(' · ')}</span>
                <span>{date(r.day)}</span>
              </figcaption>
              {r.reply && <p className="rv-reply">{tr('Velan replied:', 'வேலன் பதில்:')} {r.reply}</p>}
            </motion.figure>
          </AnimatePresence>
          <div className="rv-dots">
            {reviews.map((_, k) => (
              <button key={k} type="button" aria-label={`${k + 1}`} className={k === i % reviews.length ? 'on' : ''} onClick={() => setI(k)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
