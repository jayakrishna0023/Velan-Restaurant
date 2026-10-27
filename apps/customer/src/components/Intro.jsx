// "The house": a short statement in large type, beside two overlapping
// photographs that drift at different speeds as you scroll.
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { TEMPLE } from '../images.js';
import { Reveal, SplitWords, WipeImage } from '../lib/motion.jsx';

export default function Intro() {
  const { tr, ta } = useLang();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const yBig = useTransform(scrollYProgress, [0, 1], ['6%', '-6%']);
  const ySmall = useTransform(scrollYProgress, [0, 1], ['22%', '-18%']);

  const facts = [
    [tr('Seeraga samba', 'சீரக சம்பா'), tr('short-grain rice that drinks in the masala', 'மசாலாவை உறிஞ்சும் சிறுமணி அரிசி')],
    [tr('Wood-fired dum', 'விறகுத் தீ தம்'), tr('handis sealed with dough, coals on the lid', 'மாவால் மூடிய அண்டா, மேலே தணல்')],
    [tr('Ground each morning', 'தினமும் காலையில் அரைப்பது'), tr('whole spices, roasted and stone-ground', 'முழு மசாலா, வறுத்து அம்மியில் அரைத்தது')],
  ];

  return (
    <section ref={ref} className="intro" id="story">
      <div className="container intro-grid">
        <div className="intro-text">
          <Reveal as="p" className="eyebrow">{tr('The house', 'எங்கள் வீடு')}</Reveal>
          <h2 className="intro-statement display">
            <SplitWords inView stagger={0.028} delay={0.05} text={ta
              ? 'காவிரிக் கரையில் ஒரு பிரியாணி வீடு — சீரக சம்பா, விடியலில் அரைத்த மசாலா, விறகுத் தீயில் மாவால் மூடிய அண்டா.'
              : 'A biryani house on the banks of the Kaveri — seeraga samba, spices ground at dawn, and a handi sealed with dough over a wood fire.'} />
          </h2>
          <Reveal as="p" delay={0.16} className="intro-alt">
            {ta
              ? 'A biryani house on the banks of the Kaveri.'
              : 'காவிரிக் கரையில் ஒரு பிரியாணி வீடு.'}
          </Reveal>
          <Reveal as="p" delay={0.22} className="intro-body">
            {tr('We cook a small number of handis each day and open them only as orders come in. When a dish is finished, it is finished — so it reaches you as it left the fire.',
              'ஒவ்வொரு நாளும் குறைந்த அளவிலான அண்டாக்களையே சமைக்கிறோம்; ஆர்டர் வரும்போது மட்டுமே திறக்கிறோம். தீர்ந்தால் தீர்ந்ததுதான் — அதனால் தீயிலிருந்து வந்தபடியே உங்களை வந்தடைகிறது.')}
          </Reveal>
          <ul className="intro-facts">
            {facts.map(([title, body], k) => (
              <Reveal as="li" key={k} delay={0.3 + k * 0.08}>
                <strong>{title}</strong>
                <span>{body}</span>
              </Reveal>
            ))}
          </ul>
        </div>
        <div className="intro-media" aria-hidden="true">
          <motion.div className="intro-img big" style={{ y: yBig }}><WipeImage src={TEMPLE.spiceMarket} /></motion.div>
          <motion.div className="intro-img small" style={{ y: ySmall }}><WipeImage src={TEMPLE.biryaniHandi} from="left" delay={0.35} /></motion.div>
        </div>
      </div>
    </section>
  );
}
