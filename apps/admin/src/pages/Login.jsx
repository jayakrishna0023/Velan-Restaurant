import { useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Sign } from '@velan/shared/components/Poster.jsx';
import { LangToggle } from '@velan/shared/components/ui.jsx';
import { useLang } from '@velan/shared/i18n.jsx';
import { sound } from '@velan/shared/effects.js';
import { login } from '../state/ui.js';

const ease = [0.22, 1, 0.36, 1];
// Wood fire under the handi; the same photograph the customer site uses.
const ART = 'https://images.unsplash.com/photo-1515931215890-366d3990cf8d?auto=format&fit=crop&w=1400&q=80';

export default function Login() {
  const L = useLang();
  const { t, tr } = L;
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(phone, password);
      sound.success();
    } catch (err) {
      setError(L.error(err));
      sound.error();
    }
    setBusy(false);
  };

  return (
    <div className="login">
      <motion.section className="login-art kolam-night" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
        <motion.img className="login-photo" src={ART} alt="" initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 6, ease: 'linear' }} />
        <div className="login-glow" />
        <div className="login-art-inner">
          <motion.h1 className="login-brand" initial={{ opacity: 0, y: 18, rotate: -8, scale: 1.2 }} animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.3 }}>
            <Sign size="xl" />
          </motion.h1>
          <motion.p className="login-brand-ta" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, ease, delay: 0.6 }}>
            <span>{tr('Restaurant console', 'உணவக நிர்வாகம்')}</span>
            <em>{L.ta ? 'Velan Biryani Center' : 'வேலன் பிரியாணி சென்டர்'}</em>
          </motion.p>
          <motion.span className="login-divider" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.2, ease, delay: 0.75 }} />
          <motion.ul className="login-points" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.12, delayChildren: 0.9 } } }}>
            {[
              ['board', tr('Live order board with alarms', 'ஒலி எச்சரிக்கையுடன் நேரடி ஆர்டர் பலகை')],
              ['scooter', tr('Track every rider on the map', 'ஒவ்வொரு டெலிவரி பார்ட்னரையும் வரைபடத்தில்')],
              ['chart', tr('Sales, dishes and customers at a glance', 'விற்பனை, உணவுகள், வாடிக்கையாளர்கள் ஒரே பார்வையில்')],
            ].map(([icon, text]) => (
              <motion.li key={icon} variants={{ h: { opacity: 0, x: -14 }, s: { opacity: 1, x: 0, transition: { duration: 0.6, ease } } }}>
                <span><Icon name={icon} size={16} /></span>{text}
              </motion.li>
            ))}
          </motion.ul>
        </div>
        <p className="login-foot">Uniyur · Nerur Bridge Road · Karur</p>
      </motion.section>

      <section className="login-form-side">
        <div className="login-top"><LangToggle /></div>
        <motion.form className="login-card" onSubmit={submit} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.2 }}>
          <div className="login-mobile-mark"><Sign size="lg" /></div>
          <span className="eyebrow">{tr('Owner & staff', 'உரிமையாளர் & பணியாளர்')}</span>
          <h2 className="display login-title">{tr('Vanakkam', 'வணக்கம்')}</h2>
          <p className="muted">{tr('Sign in to run today’s service.', 'இன்றைய சேவையைத் தொடங்க உள்நுழையுங்கள்.')}</p>

          <label className="field">
            <span className="field-label">{t('mobile')}</span>
            <div className="input-group phone-group">
              <span className="phone-prefix">+91</span>
              <input className="input" inputMode="numeric" autoComplete="username" maxLength={10} value={phone} autoFocus
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="98765 43210" />
            </div>
          </label>
          <label className="field">
            <span className="field-label">{t('password')}</span>
            <div className="input-group">
              <Icon name="lock" size={18} className="icon" />
              <input className="input" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="suffix btn btn-ghost btn-icon btn-xs" onClick={() => setShow(!show)} aria-label="Show password">
                <Icon name={show ? 'eyeOff' : 'eye'} size={16} />
              </button>
            </div>
          </label>
          {error && <motion.p className="form-error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}><Icon name="alert" size={15} /> {error}</motion.p>}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || phone.length < 10 || !password}>
            {busy ? <span className="spinner" /> : <>{t('login')} <Icon name="arrowRight" size={18} /></>}
          </button>
          <p className="subtle small login-help">
            <Icon name="shield" size={14} /> {tr('Only the restaurant team can sign in here.', 'உணவகக் குழு மட்டுமே இங்கு உள்நுழைய முடியும்.')}
          </p>
        </motion.form>
      </section>
    </div>
  );
}
