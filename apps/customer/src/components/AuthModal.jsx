import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Modal, Seg, toast } from '@velan/shared/components/ui.jsx';
import { VelSeal } from '@velan/shared/components/Brand.jsx';
import { session, useSession, login, register } from '../state/session.js';

export default function AuthModal() {
  const { t, tr, error } = useLang();
  const open = useSession((s) => s.authOpen);
  const initialMode = useSession((s) => s.authMode);
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', phone: '', password: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setMode(initialMode); setErr(''); } }, [open, initialMode]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: k === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      if (mode === 'login') await login(form.phone, form.password);
      else await register(form.name, form.phone, form.password);
      const name = session.get().user?.name?.split(' ')[0] || '';
      toast.success(t('vanakkam', { name }));
      setForm({ name: '', phone: '', password: '' });
    } catch (ex) {
      setErr(error(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => session.set({ authOpen: false, afterAuth: null })} width={440} className="auth-modal">
      <div className="auth-hero">
        <motion.div initial={{ scale: 0.6, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }}>
          <VelSeal size={80} draw />
        </motion.div>
        <h3 className="display">{mode === 'login' ? t('welcomeBack') : tr('Join the Velan family', 'வேலன் குடும்பத்தில் இணையுங்கள்')}</h3>
        <p className="auth-alt">{mode === 'login' ? 'மீண்டும் வருக · Welcome back' : 'வணக்கம் · Vanakkam'}</p>
      </div>
      <div className="auth-body">
        <Seg value={mode} onChange={(m) => { setMode(m); setErr(''); }} className="auth-seg"
          options={[{ value: 'login', label: t('login') }, { value: 'register', label: t('signup') }]} />
        <form onSubmit={submit} className="auth-form">
          <AnimatePresence initial={false}>
            {mode === 'register' && (
              <motion.label className="field" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                <span className="field-label">{t('yourName')}</span>
                <div className="input-group">
                  <Icon name="user" size={18} className="icon" />
                  <input className="input" value={form.name} onChange={set('name')} autoComplete="name" required={mode === 'register'} />
                </div>
              </motion.label>
            )}
          </AnimatePresence>
          <label className="field">
            <span className="field-label">{t('mobile')}</span>
            <div className="input-group phone-group">
              <span className="phone-prefix">+91</span>
              <input className="input" value={form.phone} onChange={set('phone')} inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" required />
            </div>
          </label>
          <label className="field">
            <span className="field-label">{t('password')}</span>
            <div className="input-group">
              <Icon name="lock" size={18} className="icon" />
              <input className="input" type={show ? 'text' : 'password'} value={form.password} onChange={set('password')}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required />
              <button type="button" className="suffix icon-btn sm" onClick={() => setShow((v) => !v)} aria-label="Show password">
                <Icon name={show ? 'eyeOff' : 'eye'} size={17} />
              </button>
            </div>
          </label>
          <AnimatePresence>
            {err && (
              <motion.p className="form-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Icon name="alert" size={15} /> {err}
              </motion.p>
            )}
          </AnimatePresence>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? <span className="spinner" /> : mode === 'login' ? t('login') : t('signup')}
          </button>
          <p className="auth-switch subtle">
            {mode === 'login' ? t('newHere') : t('haveAccount')}{' '}
            <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? t('signup') : t('login')}</button>
          </p>
        </form>
      </div>
    </Modal>
  );
}
