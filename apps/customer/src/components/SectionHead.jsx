import { useLang } from '@velan/shared/i18n.jsx';
import { Reveal, SplitWords } from '../lib/motion.jsx';

/**
 * Section heading: small spaced capitals, the title in the chosen language
 * and the other language beneath it. title / eyebrow / lede are
 * [English, Tamil] pairs.
 */
export default function SectionHead({ eyebrow, title, lede, align = 'left', dark = false, children }) {
  const { ta } = useLang();
  const main = ta ? title[1] : title[0];
  const second = ta ? title[0] : title[1];
  return (
    <div className={`section-head align-${align} ${dark ? 'on-dark' : ''}`}>
      {eyebrow && <Reveal as="p" className="eyebrow">{ta ? eyebrow[1] : eyebrow[0]}</Reveal>}
      <h2 className="section-title display"><SplitWords text={main} inView delay={0.06} /></h2>
      <Reveal as="p" delay={0.12} className={`section-transcript ${ta ? 'en' : 'ta'}`}>{second}</Reveal>
      {lede && <Reveal as="p" delay={0.18} className="section-lede">{ta ? lede[1] : lede[0]}</Reveal>}
      {children}
    </div>
  );
}
