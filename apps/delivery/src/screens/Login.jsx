// Rider sign-in with an animated brand splash.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Sign } from '@velan/shared/components/Poster.jsx';
import { LangToggle } from '@velan/shared/components/ui.jsx';
import { sound } from '@velan/shared/effects.js';
import { api } from '../api.js';
import { demoAllowed } from '../lib/geo.js';

const rise = (delay) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 1, ease: [0.22, 1, 0.36, 1] } });
// Temple tower at dusk, the same photograph the customer site uses.
const ART = 'https://images.unsplash.com/photo-1541173061692-bbec3dc2bf85?auto=format&fit=crop&w=900&q=80';

export default function Login() {
  const { t, tr, error } = useLang();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post('/auth/login', { phone, password, role: 'rider' });
      sound.chime();
      api.setToken(r.token);
    } catch (x) {
      setErr(x);
      sound.error();
      setBusy(false);
    }
  };

  return (
    <motion.div className="r-login" key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="r-login-art" aria-hidden="true">
        <motion.img src={ART} alt="" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }} />
      </div>
      <div className="r-login-top">
        <LangToggle />
      </div>
      <div className="r-login-brand">
        <motion.div {...rise(0.1)}>
          <Sign size="lg" />
        </motion.div>
        <motion.span className="eyebrow" {...rise(0.25)}>{t('app.partner')}</motion.span>
        <motion.h1 className="display" {...rise(0.35)}>{t('app.name')}</motion.h1>
        <motion.p {...rise(0.45)}>{t('login.sub')}</motion.p>
      </div>
      <motion.form className="r-login-card" onSubmit={submit} {...rise(0.55)}>
        <h2>{t('login.title')}</h2>
        <div className="field">
          <label htmlFor="r-phone">{t('mobile')}</label>
          <div className="input-group r-phone">
            <span className="icon r-cc">+91</span>
            <input id="r-phone" className="input" inputMode="numeric" autoComplete="tel" maxLength={14} value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ''))} placeholder="98765 43210" required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="r-pass">{t('password')}</label>
          <div className="input-group">
            <Icon name="lock" size={18} className="icon" />
            <input id="r-pass" className="input" type={show ? 'text' : 'password'} autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required style={{ paddingRight: 48 }} />
            <button type="button" className="suffix btn btn-ghost btn-icon btn-sm" onClick={() => setShow(!show)} aria-label={t('showPassword')}>
              <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
            </button>
          </div>
        </div>
        {err && <motion.p className="r-login-err" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}><Icon name="alert" size={16} /> {error(err)}</motion.p>}
        <button className="btn btn-gold btn-lg btn-block" disabled={busy}>
          {busy ? <span className="spinner" /> : <>{t('login.button')} <Icon name="arrowRight" size={20} /></>}
        </button>
        <p className="r-login-help">
          {demoAllowed() ? t('login.demo', { phone: '9000000001' }) : t('login.help')}
        </p>
      </motion.form>
      <p className="r-login-foot">{tr('Velan Biryani Center · Uniyur', 'வேலன் பிரியாணி சென்டர் · உன்னியூர்')}</p>
    </motion.div>
  );
}
