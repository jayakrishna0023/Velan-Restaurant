import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { LangToggle, ThemeToggle } from '@velan/shared/components/ui.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { useCart, cartCount, openCart } from '../state/cart.js';
import { useSession, requireLogin } from '../state/session.js';
import { scrollToTarget } from '../lib/scroll.js';
import SearchBox from './SearchBox.jsx';
import { Sign } from '@velan/shared/components/Poster.jsx';

const LINKS = [['menu', 'nav.menu'], ['cat-popular', ['Most ordered', 'அதிகம் ஆர்டர் ஆனவை']], ['story', 'nav.story'], ['visit', 'nav.visit']];

/** Search from anywhere: a panel drops from the top with the instant dish search. */
function SearchPanel({ open, onClose }) {
  const { tr } = useLang();
  useEffect(() => {
    if (!open) return undefined;
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="search-scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div className="search-panel" role="dialog" aria-label={tr('Search the menu', 'மெனுவில் தேடுக')} data-lenis-prevent
            initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }} transition={{ type: 'spring', stiffness: 300, damping: 34 }}>
            <div className="container search-panel-in">
              <SearchBox autoFocus suggest onDone={onClose} />
              <button type="button" className="icon-btn" onClick={onClose} aria-label={tr('Close', 'மூடு')}><Icon name="x" size={22} /></button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function Header({ minimal, theme, setTheme }) {
  const { t, tr, pick } = useLang();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const count = useCart(cartCount);
  const bump = useCart((s) => s.bump);
  const user = useSession((s) => s.user);
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const onHome = pathname === '/';
  const label = (key) => (Array.isArray(key) ? tr(key[0], key[1]) : t(key));

  // "/" opens the search from anywhere on the page, unless you are typing.
  useEffect(() => {
    const key = (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || /input|textarea|select/i.test(document.activeElement?.tagName)) return;
      e.preventDefault();
      setSearchOpen(true);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  // Hide after 50px of scrolling down and show after 50px back up. Comparing frame to frame
  // flickered: a smooth scroll slows to a few pixels a frame and the header popped in and out.
  const turn = useRef({ at: 0, hidden: false });
  useMotionValueEvent(scrollY, 'change', (y) => {
    setSolid(y > 40);
    const s = turn.current;
    let hide = s.hidden;
    if (y < 600 || menuOpen) hide = false;
    else if (!s.hidden && y > s.at + 50) hide = true;
    else if (s.hidden && y < s.at - 50) hide = false;
    // `at` is the turning point: the highest the page got while shown, the lowest while hidden.
    if (hide !== s.hidden) { s.hidden = hide; s.at = y; setHidden(hide); } else s.at = hide ? Math.max(s.at, y) : Math.min(s.at, y);
  });
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  // Sticky bars below the header (the menu categories) follow it up and down.
  useEffect(() => { document.documentElement.style.setProperty('--header-h', hidden ? '0px' : '60px'); }, [hidden]);

  const go = (id) => {
    setMenuOpen(false);
    if (onHome) scrollToTarget(id);
    else { navigate('/'); setTimeout(() => scrollToTarget(id), 450); }
  };
  return (
    <>
      <a href="#menu" className="skip-link" onClick={(e) => { e.preventDefault(); go('menu'); }}>{tr('Skip to the menu', 'மெனுவுக்குச் செல்')}</a>
      <motion.header className={`site-header ${solid || !onHome ? 'solid' : ''}`}
        animate={{ y: hidden ? -100 : 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
        <div className="container header-row">
          <Link to="/" className="header-brand" aria-label="Velan Biryani Center" onClick={() => onHome && scrollToTarget(0)}>
            <Sign />
          </Link>
          {!minimal && (
            <nav className="header-nav" aria-label="Sections">
              {LINKS.map(([id, key]) => (
                <button key={id} type="button" onClick={() => go(id)}><span>{label(key)}</span></button>
              ))}
            </nav>
          )}
          <div className="header-actions">
            {!minimal && (
              <button type="button" className="header-search" onClick={() => setSearchOpen(true)} aria-label={tr('Search the menu', 'மெனுவில் தேடுக')}>
                <Icon name="search" size={18} /><span className="hide-sm">{tr('Search', 'தேடு')}</span><kbd className="hide-sm">/</kbd>
              </button>
            )}
            <LangToggle />
            <ThemeToggle theme={theme} onChange={setTheme} className="hide-xs" />
            <button type="button" className="icon-btn hide-sm" aria-label={t('nav.account')}
              onClick={() => (user ? navigate('/account') : requireLogin(() => navigate('/account')))}>
              {user ? <span className="mini-avatar">{(pick(user, 'name') || '?')[0]}</span> : <Icon name="user" size={20} />}
            </button>
            {!minimal && (
              <motion.button type="button" className="cart-btn" data-cart-target onClick={() => openCart(true)}
                key={bump} animate={bump ? { scale: [1, 1.14, 0.96, 1] } : {}} transition={{ duration: 0.5 }}>
                <Icon name="bag" size={19} />
                <span className="hide-xs">{t('cart')}</span>
                <AnimatePresence mode="popLayout">
                  {count > 0 && (
                    <motion.span key={count} className="cart-count" initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }}>
                      {count}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            )}
            {!minimal && (
              <button type="button" className="icon-btn burger" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
                <Icon name={menuOpen ? 'x' : 'menu'} size={22} />
              </button>
            )}
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div className="mobile-menu" initial={{ clipPath: 'circle(0% at 92% 4%)' }} animate={{ clipPath: 'circle(150% at 92% 4%)' }}
            exit={{ clipPath: 'circle(0% at 92% 4%)' }} transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }} data-lenis-prevent>
            <nav>
              {LINKS.map(([id, key], i) => (
                <motion.button key={id} type="button" onClick={() => go(id)} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + i * 0.07, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
                  <span className="display">{label(key)}</span>
                  <Icon name="arrowUpRight" size={26} />
                </motion.button>
              ))}
              <motion.button type="button" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.6 }}
                onClick={() => { setMenuOpen(false); if (user) navigate('/account'); else requireLogin(() => navigate('/account')); }}>
                <span className="display">{user ? t('nav.orders') : t('login')}</span>
                <Icon name="arrowUpRight" size={26} />
              </motion.button>
              <div className="mobile-menu-foot">
                <LangToggle />
                <ThemeToggle theme={theme} onChange={setTheme} />
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
