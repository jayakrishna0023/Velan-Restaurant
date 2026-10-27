// The opening, set like a shop poster: a ticker of today's facts, a huge
// Tamil-and-English headline, and a steaming plate of biryani stuck on a red
// sun with price and rating stickers round it. Ordering is one button away.
import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { useNow } from '@velan/shared/hooks.js';
import { storeStatus } from '@velan/shared/domain.js';
import { useSite } from '../state/site.js';
import { useUi } from '../state/ui.js';
import { scrollToTarget } from '../lib/scroll.js';
import { Burst, Sticker, Ticker } from '@velan/shared/components/Poster.jsx';
import SearchBox from './SearchBox.jsx';
import Steam from './Steam.jsx';
import { AddControl } from './DishCard.jsx';

// Top-down biryani in a steel bowl, cropped so the bowl fills the round sticker.
const PLATE = 'https://images.unsplash.com/photo-1696950169706-d4533c32f81a?auto=format&fit=crop&crop=focalpoint&fp-x=0.5&fp-y=0.5&fp-z=1.25&w=900&h=900&q=80';

function Line({ play, delay, className, children }) {
  return (
    <span className={`ph-line ${className || ''}`}>
      <motion.span initial={{ y: '105%' }} animate={{ y: play ? '0%' : '105%' }} transition={{ delay, duration: 0.8, ease: [0.2, 0.9, 0.25, 1] }}>
        {children}
      </motion.span>
    </span>
  );
}

function Special({ item }) {
  const { tr, pick, money } = useLang();
  const img = useRef(null);
  if (!item) return null;
  return (
    <Sticker className="ph-special" rotate={2.5} delay={1}>
      <span className="ph-special-img"><img ref={img} src={item.image} alt="" /></span>
      <span className="ph-special-text">
        <small>{tr("Today's special", 'இன்றைய ஸ்பெஷல்')}</small>
        <strong>{pick(item, 'name')}</strong>
        <em className="num">{money(item.price)}</em>
      </span>
      <AddControl item={item} imgRef={img} size="sm" />
    </Sticker>
  );
}

export default function Hero() {
  const { t, tr, hhmm, num, pick } = useLang();
  const settings = useSite((s) => s.settings);
  const stats = useSite((s) => s.stats);
  const items = useSite((s) => s.items.filter((i) => i.available !== false));
  const play = useUi((s) => s.introDone);
  useNow(60_000);

  const st = settings ? storeStatus(settings) : null;
  const prep = settings?.avgPrepMins || 20;
  const time = `${prep + 10}–${prep + 20}`;
  const biryanis = items.filter((i) => i.categoryId === 'cat_biryani').map((i) => i.price);
  const from = biryanis.length ? Math.min(...biryanis) : null;
  const special = items.find((i) => i.chefSpecial && i.bestseller && i.stock > 0) || items.find((i) => i.bestseller && i.stock > 0);

  const facts = [
    st?.open ? tr('Open now till {t}', 'இப்போது திறந்துள்ளது · {t} வரை', { t: hhmm(settings.closeTime) })
      : st ? tr('Opens at {t}', '{t}க்கு திறக்கும்', { t: hhmm(settings.openTime) }) : null,
    tr('{m} min to your door', '{m} நிமிடத்தில் உங்கள் வீட்டில்', { m: time }),
    settings?.freeAbove ? tr('Free delivery over ₹{n}', '₹{n}க்கு மேல் இலவச டெலிவரி', { n: settings.freeAbove }) : null,
    tr('Uniyur · Nerur · Karur', 'உன்னியூர் · நெரூர் · கரூர்'),
    tr('Wood-fired dum', 'விறகுத் தீ தம்'),
  ].filter(Boolean);
  const dishes = items.filter((i) => i.bestseller || i.chefSpecial).slice(0, 8).map((i) => pick(i, 'name'));

  return (
    <section className="ph" id="top">
      <Ticker items={facts} tone="red" speed={34} />
      <div className="container ph-grid">
        <div className="ph-text">
          <h1 className="ph-title" aria-label={tr('Hot dum biryani, straight from the handi', 'சூடான தம் பிரியாணி, அண்டாவிலிருந்து நேராக')}>
            <Line play={play} delay={0.05} className="ph-ta">சூடான</Line>
            <Line play={play} delay={0.13} className="ph-ta big">தம் பிரியாணி!</Line>
            <Line play={play} delay={0.24} className="ph-en">Dum biryani</Line>
            <Line play={play} delay={0.33} className="ph-en outline">{tr('Straight from the handi', 'அண்டாவிலிருந்து நேராக')}</Line>
          </h1>
          <motion.p className="ph-lede" initial={{ opacity: 0, y: 14 }} animate={{ opacity: play ? 1 : 0, y: play ? 0 : 14 }} transition={{ delay: 0.5, duration: 0.7 }}>
            {tr('Order in under a minute. Hot at your door in {m} minutes, anywhere around Nerur and Karur.',
              'ஒரு நிமிடத்தில் ஆர்டர் செய்யுங்கள். நெரூர், கரூர் சுற்றுவட்டாரத்தில் {m} நிமிடத்தில் சூடாக உங்கள் வீட்டில்.', { m: time })}
          </motion.p>
          <motion.div className="ph-ctas" initial={{ opacity: 0, y: 14 }} animate={{ opacity: play ? 1 : 0, y: play ? 0 : 14 }} transition={{ delay: 0.62, duration: 0.7 }}>
            <button type="button" className="pbtn pbtn-red pbtn-lg" onClick={() => scrollToTarget('menu', -70)}>{t('orderNow')} <Icon name="arrowRight" size={20} /></button>
            <button type="button" className="pbtn pbtn-plain" onClick={() => scrollToTarget('cat-popular', -150)}>{tr('Most ordered', 'அதிகம் ஆர்டர் ஆனவை')}</button>
          </motion.div>
          <motion.div className="ph-search" initial={{ opacity: 0, y: 14 }} animate={{ opacity: play ? 1 : 0, y: play ? 0 : 14 }} transition={{ delay: 0.74, duration: 0.7 }}>
            <SearchBox suggest />
          </motion.div>
        </div>

        {play && (
          <div className="ph-art">
            <motion.span className="ph-sun" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 120, damping: 16 }} />
            <span className="ph-dots" aria-hidden="true" />
            <Sticker className="ph-plate" rotate={-6} delay={0.25}>
              <img src={PLATE} alt={tr('Mutton dum biryani in a steel bowl', 'எஃகுக் கிண்ணத்தில் மட்டன் தம் பிரியாணி')} />
              <Steam source={{ x: 0.5, y: 0.5, w: 0.55 }} intensity={1.2} />
            </Sticker>
            {from && (
              <Burst className="ph-price" tone="yellow" size={146} rotate={-10} delay={0.55}>
                <small>{tr('from', 'முதல்')}</small><b className="num">₹{from}</b>
              </Burst>
            )}
            {stats?.rating && (
              <Sticker className="ph-tag ph-rating" rotate={7} delay={0.7}>
                <Icon name="star" size={16} /> {stats.rating} <small>{tr('{n} reviews', '{n} மதிப்பீடுகள்', { n: num(stats.ratings) })}</small>
              </Sticker>
            )}
            <Sticker className="ph-tag ph-time" rotate={-5} delay={0.82}><Icon name="scooter" size={17} /> {time} {tr('min', 'நிமி')}</Sticker>
            <Sticker className="ph-stamp" rotate={-13} delay={0.92}>{tr('Uniyur · Karur', 'உன்னியூர் · கரூர்')}</Sticker>
            <Special item={special} />
          </div>
        )}
      </div>
      <Ticker items={dishes} tone="yellow" reverse speed={46} />
    </section>
  );
}
