// "The method": four steps from the river to the leaf. The photograph on the
// left stays in place; as each step reaches the middle of the screen its
// picture wipes up over the last one and settles from a slow zoom.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { TEMPLE } from '../images.js';
import { curtain, ease, Reveal, SplitWords } from '../lib/motion.jsx';

const STEPS = [
  { img: 'kaveri',
    en: ['Bought at dawn', 'Goat and country chicken from farms along the river at Nerur and Vangal, bought fresh each morning — never frozen.'],
    ta: ['விடியலில் வாங்குவது', 'நெரூர், வாங்கல் ஆற்றங்கரைப் பண்ணைகளிலிருந்து தினமும் காலையில் வாங்கும் ஆட்டுக்கறி, நாட்டுக்கோழி — உறைய வைத்ததல்ல.'] },
  { img: 'spiceMarket',
    en: ['Ground by hand', 'Cardamom, clove, cinnamon, star anise and Karur chillies, roasted on an iron pan and stone-ground before ten.'],
    ta: ['கையால் அரைப்பது', 'ஏலம், கிராம்பு, பட்டை, அன்னாசிப்பூ, கரூர் மிளகாய் — இரும்புச் சட்டியில் வறுத்து, பத்து மணிக்குள் அம்மியில் அரைக்கிறோம்.'] },
  { img: 'woodfire',
    en: ['Sealed for dum', 'Seeraga samba and meat are layered in the handi, the lid sealed with dough and live coals laid on top.'],
    ta: ['தம் போடுவது', 'சீரக சம்பாவும் இறைச்சியும் அண்டாவில் அடுக்கி, மூடியை மாவால் மூடி, மேலே தணல் வைக்கிறோம்.'] },
  { img: 'bananaLeafFeast',
    en: ['Opened for you', 'The seal breaks only when your order comes in, and it leaves the kitchen with raita and brinjal gravy.'],
    ta: ['உங்களுக்காகத் திறப்பது', 'உங்கள் ஆர்டர் வந்ததும்தான் முத்திரை உடைகிறது; ரைத்தா, கத்திரிக்காய் கிரேவியுடன் புறப்படுகிறது.'] },
];

export default function Method() {
  const { tr, ta } = useLang();
  const [active, setActive] = useState(0);
  const refs = useRef([]);
  useEffect(() => {
    // Warm the cache so a wipe never uncovers an empty frame.
    STEPS.forEach((s) => { const img = new Image(); img.src = TEMPLE[s.img]; });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(Number(e.target.dataset.step)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <section className="method">
      <div className="container method-grid">
        <div className="method-media">
          <div className="method-frame">
            <AnimatePresence initial={false}>
              <motion.div key={active} className="method-layer" initial={{ clipPath: 'inset(100% 0% 0% 0%)' }} animate={{ clipPath: 'inset(0% 0% 0% 0%)' }}
                exit={{ scale: 1.02, transition: { duration: 1.3 } }} transition={{ duration: 1.25, ease: curtain }}>
                <motion.img src={TEMPLE[STEPS[active].img]} alt="" initial={{ scale: 1.2 }} animate={{ scale: 1 }} transition={{ duration: 2.6, ease }} />
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="method-count num">
            <span className="roll-digits">
              <AnimatePresence initial={false}>
                <motion.b key={active} initial={{ y: '100%' }} animate={{ y: '0%' }} exit={{ y: '-100%' }} transition={{ duration: 0.8, ease: curtain }}>0{active + 1}</motion.b>
              </AnimatePresence>
            </span>
            <span className="method-count-of"> / 0{STEPS.length}</span>
            <span className="method-count-bar"><motion.i animate={{ scaleX: (active + 1) / STEPS.length }} transition={{ duration: 1, ease }} /></span>
          </div>
        </div>
        <div className="method-steps">
          <Reveal as="p" className="eyebrow">{tr('The method', 'செய்முறை')}</Reveal>
          <h2 className="method-title display"><SplitWords text={tr('From the river to the leaf', 'ஆற்றிலிருந்து இலை வரை')} inView /></h2>
          <ol>
            {STEPS.map((s, i) => {
              const [title, body] = ta ? s.ta : s.en;
              const [alt] = ta ? s.en : s.ta;
              return (
                <li key={s.img} ref={(el) => { refs.current[i] = el; }} data-step={i} className={i === active ? 'on' : ''}
                  onMouseEnter={() => setActive(i)}>
                  <span className="method-no num">0{i + 1}</span>
                  <div>
                    <h3 className="display">{title}</h3>
                    <p className="method-alt">{alt}</p>
                    <p className="method-body">{body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
