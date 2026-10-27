import { Link } from 'react-router';
import { useLang } from '@velan/shared/i18n.jsx';
import { LangToggle } from '@velan/shared/components/ui.jsx';
import { useSite } from '../state/site.js';
import { scrollToTarget } from '../lib/scroll.js';
import { Letters, Reveal } from '../lib/motion.jsx';
import { Sign, Ticker } from '@velan/shared/components/Poster.jsx';

// In development each app has its own dev server port; in production all share one.
const staffOrigin = (port) => (import.meta.env.DEV ? `${window.location.protocol}//${window.location.hostname}:${port}` : '');

export default function Footer() {
  const { t, tr, ta, pick, other, hhmm } = useLang();
  const settings = useSite((s) => s.settings);
  const categories = useSite((s) => s.categories);
  return (
    <footer className="site-footer">
      <Ticker tone="yellow" speed={40} items={[tr('Hot from the handi', 'அண்டாவிலிருந்து சூடாக'), tr('Order now', 'இப்போதே ஆர்டர் செய்யுங்கள்'), tr('Delivery and pickup', 'டெலிவரி & பிக்கப்'), tr('Uniyur · Karur', 'உன்னியூர் · கரூர்')]} />
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <Sign size="lg" />
            <Reveal as="p" className="footer-tag display">{settings ? pick(settings, 'tagline') : ''}</Reveal>
            <Reveal as="p" delay={0.1} className="footer-tag-alt">{settings ? other(settings, 'tagline') : ''}</Reveal>
          </div>
          <div className="footer-cols">
            <div>
              <h4>{t('nav.menu')}</h4>
              {categories.map((c) => (
                <button key={c.id} type="button" onClick={() => scrollToTarget(`cat-${c.id}`, -150)}>{pick(c, 'name')}</button>
              ))}
            </div>
            <div>
              <h4>{t('nav.visit')}</h4>
              <p>{settings ? pick(settings, 'address') : ''}</p>
              {settings && <p>{hhmm(settings.openTime)} – {hhmm(settings.closeTime)}</p>}
            </div>
            <div>
              <h4>{tr('Contact', 'தொடர்பு')}</h4>
              {settings?.phone && <a href={`tel:${settings.phone}`}>{settings.phone}</a>}
              {settings?.email && <a href={`mailto:${settings.email}`}>{settings.email}</a>}
              {settings?.instagram && <a href={`https://instagram.com/${settings.instagram.replace('@', '')}`} target="_blank" rel="noreferrer">Instagram</a>}
              <Link to="/account">{t('nav.orders')}</Link>
            </div>
          </div>
        </div>
        <button type="button" className="footer-giant" onClick={() => scrollToTarget(0)} aria-label={tr('Back to top', 'மேலே செல்ல')}>
          <Letters text="வேலன்" stagger={0.07} duration={0.9} />
          <span className="footer-giant-en">{ta ? 'Velan Biryani Center' : 'Biryani Center · Uniyur'}</span>
        </button>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {settings ? pick(settings, 'name') : 'Velan Biryani Center'}{settings?.fssai ? ` · FSSAI ${settings.fssai}` : ''}</span>
          <span className="footer-staff">
            <a href={`${staffOrigin(5174)}/admin/`}>{tr('Restaurant login', 'உணவக உள்நுழைவு')}</a>
            <a href={`${staffOrigin(5175)}/delivery/`}>{tr('Delivery partners', 'டெலிவரி பார்ட்னர்கள்')}</a>
          </span>
          <LangToggle />
        </div>
        <p className="footer-credit">
          {tr('Developed by', 'உருவாக்கியது')}{' '}
          {/* The developer's name shows on hover, on keyboard focus and on a tap. */}
          <span className="dev-credit" tabIndex={0} aria-describedby="dev-name">
            <b>CypherXpert</b>
            <span className="dev-card" id="dev-name" role="tooltip">
              <small>{tr('Designed & built by', 'வடிவமைத்து உருவாக்கியவர்')}</small>
              <strong>Jayakrishna</strong>
            </span>
          </span>
        </p>
      </div>
    </footer>
  );
}
