// Shared React building blocks with motion.
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, animate, motion, useInView, useMotionValue, useTransform } from 'framer-motion';
import { Icon } from './Icon.jsx';
import { useLang } from '../i18n.jsx';
import { createStore, useStore } from '../store.js';
import { STATUS_TONE } from '../domain.js';

export const spring = { type: 'spring', stiffness: 420, damping: 34 };
export const softSpring = { type: 'spring', stiffness: 260, damping: 30 };

// ---------- toasts ----------

const toasts = createStore({ list: [] });
let toastId = 0;
const dropToast = (id) => toasts.set((s) => ({ list: s.list.filter((t) => t.id !== id) }));
/**
 * toast('Saved') · toast.success(title, sub) · toast.error(title)
 * action: { label, onClick } adds a button (e.g. Undo); such toasts stay longer.
 */
export function toast(title, { sub, tone = 'info', icon, ms, action } = {}) {
  const id = ++toastId;
  toasts.set((s) => ({ list: [...s.list.slice(-3), { id, title, sub, tone, icon, action }] }));
  setTimeout(() => dropToast(id), ms ?? (action ? 8000 : 3200));
}
toast.success = (title, sub) => toast(title, { sub, tone: 'success', icon: 'checkCircle' });
toast.error = (title, sub) => toast(title, { sub, tone: 'error', icon: 'alert', ms: 4500 });

export function Toaster() {
  const { list } = useStore(toasts);
  return createPortal(
    <div className="toaster" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {list.map((t) => (
          <motion.div key={t.id} className="toast" data-tone={t.tone} layout
            initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.18 } }}
            transition={spring}>
            <span className="toast-icon"><Icon name={t.icon || (t.tone === 'success' ? 'checkCircle' : t.tone === 'error' ? 'alert' : 'info')} size={18} /></span>
            <span className="grow">{t.title}{t.sub && <span className="toast-sub">{t.sub}</span>}</span>
            {t.action && (
              <button type="button" className="toast-action" onClick={() => { dropToast(t.id); t.action.onClick(); }}>{t.action.label}</button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

// ---------- dialogs ----------

function useEscape(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const fn = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', fn);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', fn); document.body.style.overflow = prev; };
  }, [open, onClose]);
}

/** Centered dialog. */
export function Modal({ open, onClose, title, children, footer, width = 520, className = '' }) {
  useEscape(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <div className="dialog-wrap">
            <motion.div role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
              className={`dialog ${className}`} style={{ width: `min(${width}px, 100%)` }}
              initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97, transition: { duration: 0.18 } }}
              transition={softSpring}>
              {title !== undefined && (
                <div className="dialog-head">
                  <h3>{title}</h3>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
                </div>
              )}
              <div className="dialog-body">{children}</div>
              {footer && <div className="dialog-foot">{footer}</div>}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Side (desktop) or bottom (phone) sheet. */
export function Sheet({ open, onClose, side = 'right', children, className = '', label }) {
  useEscape(open, onClose);
  const from = side === 'right' ? { x: '100%' } : { y: '100%' };
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <div className="sheet-wrap">
            <motion.aside role="dialog" aria-modal="true" aria-label={label} className={`sheet sheet-${side} ${className}`}
              initial={from} animate={{ x: 0, y: 0 }} exit={{ ...from, transition: { duration: 0.28, ease: [0.65, 0, 0.35, 1] } }}
              transition={{ type: 'spring', stiffness: 300, damping: 34 }}
              drag={side === 'bottom' ? 'y' : false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => { if (side === 'bottom' && (info.offset.y > 120 || info.velocity.y > 600)) onClose?.(); }}>
              {side === 'bottom' && <div className="sheet-grip" />}
              {children}
            </motion.aside>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Promise-based confirm: await confirmDialog({ title, body, confirm, tone }) */
const confirmStore = createStore({ req: null });
export function confirmDialog(opts) {
  return new Promise((resolve) => confirmStore.set({ req: { ...opts, resolve } }));
}
export function ConfirmHost() {
  const { req } = useStore(confirmStore);
  const { t } = useLang();
  const [text, setText] = useState('');
  useEffect(() => setText(''), [req]);
  const done = (v) => { req?.resolve(v); confirmStore.set({ req: null }); };
  return (
    <Modal open={!!req} onClose={() => done(false)} title={req?.title} width={440}
      footer={<>
        <button className="btn btn-ghost" onClick={() => done(false)}>{req?.cancelLabel || t('cancel')}</button>
        <button className={`btn ${req?.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
          onClick={() => done(req?.input ? text || true : true)}>{req?.confirmLabel || t('confirm')}</button>
      </>}>
      {req?.body && <p className="muted" style={{ marginBottom: req?.input ? 14 : 0 }}>{req.body}</p>}
      {req?.input && (
        <input className="input" autoFocus placeholder={req.input} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') done(text || true); }} />
      )}
      {req?.choices && (
        <div className="row" style={{ flexWrap: 'wrap', marginTop: 12 }}>
          {req.choices.map((c) => <button key={c} className="chip" onClick={() => done(c)}>{c}</button>)}
        </div>
      )}
    </Modal>
  );
}

// ---------- controls ----------

/** Segmented control with a sliding thumb. options: [{ value, label }] */
export function Seg({ value, onChange, options, className = '', size }) {
  const id = useId();
  return (
    <div className={`seg ${className}`} role="group" style={size === 'sm' ? { padding: 3 } : undefined}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
          style={size === 'sm' ? { height: 28, padding: '0 11px', fontSize: 12 } : undefined}>
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="seg-thumb" transition={spring} />}
          {o.icon && <Icon name={o.icon} size={15} style={{ display: 'inline', verticalAlign: '-3px', marginRight: o.label ? 6 : 0 }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LangToggle({ className = '' }) {
  const { lang, setLang } = useLang();
  const id = useId();
  return (
    <div className={`lang-toggle ${className}`} role="group" aria-label="Language">
      {[['en', 'EN'], ['ta', 'த']].map(([v, label]) => (
        <button key={v} type="button" aria-pressed={lang === v} onClick={() => setLang(v)} className={v === 'ta' ? 'ta' : ''} title={v === 'ta' ? 'தமிழ்' : 'English'}>
          {lang === v && <motion.span layoutId={`lang-${id}`} className="thumb" transition={spring} />}
          {label}
        </button>
      ))}
    </div>
  );
}

/** Sun/moon button that flips between the light (plaster) and dark (indigo night) themes. */
export function ThemeToggle({ theme, onChange, className = '' }) {
  const { tr } = useLang();
  const dark = theme === 'dark';
  return (
    <button type="button" className={`theme-toggle ${className}`} onClick={() => onChange(dark ? 'light' : 'dark')}
      aria-label={dark ? tr('Light theme', 'வெளிர் தீம்') : tr('Dark theme', 'இருண்ட தீம்')} title={dark ? tr('Light theme', 'வெளிர் தீம்') : tr('Dark theme', 'இருண்ட தீம்')}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={theme} initial={{ rotate: -90, scale: 0.5, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.3 }} style={{ display: 'grid' }}>
          <Icon name={dark ? 'moon' : 'sun'} size={19} />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export function Switch({ checked, onChange, label, disabled }) {
  return (
    <label className="switch" title={label}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </label>
  );
}

export const VegMark = ({ veg, title }) => <span className={`veg-mark ${veg ? '' : 'nonveg'}`} title={title} aria-label={title} />;

export function StatusBadge({ order, live = false }) {
  const { status } = useLang();
  const tone = STATUS_TONE[order.status];
  return (
    <span className="badge" data-tone={tone}>
      <span className={`dot ${live ? 'live' : ''}`} />
      {status(order)}
    </span>
  );
}

/** Counts up to `value` when scrolled into view. */
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString('en-IN'), duration = 1.1, className }) {
  const ref = useRef(null);
  // Vertical margin only: numbers near the left/right screen edge must still count as visible.
  const inView = useInView(ref, { once: true, margin: '-40px 0px' });
  const [shown, setShown] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    if (!inView) return undefined;
    const target = Number(value) || 0;
    const start = current.current;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || start === target) {
      current.current = target;
      setShown(target);
      return undefined;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / (duration * 1000));
      const v = start + (target - start) * (1 - (1 - p) ** 4);
      current.current = v;
      setShown(p < 1 ? v : target);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);
  return <span ref={ref} className={className}>{format(shown)}</span>;
}

export function Stars({ value = 0, onChange, size = 22 }) {
  const [hover, setHover] = useState(0);
  if (!onChange) {
    return (
      <span className="stars" aria-label={`${value} / 5`}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Icon key={s} name="star" size={size} stroke={1.5} style={{ fill: s <= Math.round(value) ? 'currentColor' : 'none', opacity: s <= Math.round(value) ? 1 : 0.35 }} />
        ))}
      </span>
    );
  }
  return (
    <span className="stars" role="radiogroup" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button" role="radio" aria-checked={value === s} data-on={s <= (hover || value)} aria-label={`${s}`}
          onMouseEnter={() => setHover(s)} onClick={() => onChange(s)}>
          <Icon name="star" size={size} stroke={1.5} style={{ fill: s <= (hover || value) ? 'currentColor' : 'none' }} />
        </button>
      ))}
    </span>
  );
}

/** Four boxes for the delivery OTP. Calls onComplete(code) when filled. */
export function OtpInput({ length = 4, onComplete, error, disabled }) {
  const [vals, setVals] = useState(Array(length).fill(''));
  const refs = useRef([]);
  const [shake, setShake] = useState(false);
  useEffect(() => {
    if (!error) return;
    setShake(true);
    setVals(Array(length).fill(''));
    refs.current[0]?.focus();
    const id = setTimeout(() => setShake(false), 500);
    return () => clearTimeout(id);
  }, [error, length]);
  const set = (i, v) => {
    const digits = v.replace(/\D/g, '');
    if (digits.length > 1) {
      const next = digits.slice(0, length).split('');
      while (next.length < length) next.push('');
      setVals(next);
      if (next.every(Boolean)) onComplete?.(next.join(''));
      refs.current[Math.min(length - 1, digits.length)]?.focus();
      return;
    }
    const next = [...vals];
    next[i] = digits;
    setVals(next);
    if (digits && i < length - 1) refs.current[i + 1]?.focus();
    if (next.every(Boolean)) onComplete?.(next.join(''));
  };
  return (
    <div className={`otp ${shake ? 'shake' : ''}`}>
      {vals.map((v, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el; }} value={v} inputMode="numeric" autoComplete="one-time-code" maxLength={length}
          disabled={disabled} aria-label={`Digit ${i + 1}`}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Backspace' && !vals[i] && i > 0) refs.current[i - 1]?.focus(); }} />
      ))}
    </div>
  );
}

/** Circular progress (0–1). */
export function Ring({ value = 0, size = 64, stroke = 6, color = 'var(--accent)', track = 'var(--line)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg className="ring" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</div>
    </div>
  );
}

export function Empty({ icon = 'plate', title, children, action }) {
  return (
    <div className="empty">
      <Icon name={icon} size={42} stroke={1.4} />
      {title && <h4>{title}</h4>}
      {children && <p style={{ maxWidth: 340 }}>{children}</p>}
      {action}
    </div>
  );
}

export const Spinner = ({ size = 22, style }) => <span className="spinner" style={{ width: size, height: size, ...style }} />;

/** Hold-to-confirm / swipe-to-confirm button for riders (prevents accidental taps). */
export function SlideToConfirm({ label, onConfirm, tone = 'gold', disabled }) {
  const track = useRef(null);
  const x = useMotionValue(0);
  const [done, setDone] = useState(false);
  const progress = useTransform(x, (v) => {
    const max = (track.current?.offsetWidth || 300) - 60;
    return Math.min(1, v / max);
  });
  const textOpacity = useTransform(progress, [0, 0.6], [1, 0]);
  useEffect(() => { if (!disabled) { setDone(false); x.set(0); } }, [label, disabled, x]);
  return (
    <div ref={track} className={`slide-confirm tone-${tone} ${disabled ? 'disabled' : ''}`} aria-disabled={disabled}>
      <motion.div className="slide-fill" style={{ scaleX: progress }} />
      <motion.span className="slide-label" style={{ opacity: textOpacity }}>{label}</motion.span>
      <motion.button type="button" className="slide-knob" aria-label={label} disabled={disabled || done}
        drag={disabled || done ? false : 'x'} dragConstraints={track} dragElastic={0} dragMomentum={false} style={{ x }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setDone(true); onConfirm(); } }}
        onDragEnd={() => {
          const max = (track.current?.offsetWidth || 300) - 60;
          if (x.get() > max * 0.82) {
            animate(x, max, { duration: 0.15 });
            setDone(true);
            Promise.resolve(onConfirm()).catch(() => {}).finally(() => { setTimeout(() => { setDone(false); animate(x, 0, spring); }, 600); });
          } else animate(x, 0, spring);
        }}>
        {done ? <Spinner size={20} /> : <Icon name="arrowRight" size={22} />}
      </motion.button>
    </div>
  );
}
