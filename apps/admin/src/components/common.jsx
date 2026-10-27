// Layout pieces used across admin pages.
import { motion } from 'framer-motion';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { AnimatedNumber } from '@velan/shared/components/ui.jsx';
import { initials } from '@velan/shared/hooks.js';
import { useLang } from '@velan/shared/i18n.jsx';
import { Sparkline } from '../charts/charts.jsx';

export const ease = [0.22, 1, 0.36, 1];

/** Fade-up container whose children reveal one after another. */
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
export const rise = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
};

export function Page({ children, className = '' }) {
  return (
    <motion.div className={`page ${className}`} variants={stagger} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

export function PageHead({ title, sub, eyebrow, children }) {
  return (
    <motion.header className="page-head" variants={rise}>
      <div className="grow">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </motion.header>
  );
}

export function Panel({ title, sub, action, children, className = '', pad = true, icon }) {
  return (
    <motion.section className={`panel ${className}`} variants={rise}>
      {(title || action) && (
        <div className="panel-head">
          {icon && <span className="panel-icon"><Icon name={icon} size={17} /></span>}
          <div className="grow">
            {title && <h3>{title}</h3>}
            {sub && <p className="subtle">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={pad ? 'panel-body' : ''}>{children}</div>
    </motion.section>
  );
}

/** Percentage change vs. the previous period. `invert` when lower is better. */
export function Delta({ value, prev, invert = false }) {
  const { tr } = useLang();
  if (prev === null || prev === undefined || value === null || value === undefined) return <span className="delta muted">—</span>;
  if (!prev) return <span className="delta muted">{value ? tr('new', 'புதிது') : '—'}</span>;
  const pct = ((value - prev) / prev) * 100;
  const up = pct >= 0;
  const good = invert ? !up : up;
  return (
    <span className={`delta ${Math.abs(pct) < 0.5 ? 'muted' : good ? 'good' : 'bad'}`}>
      <Icon name={up ? 'trendUp' : 'trendDown'} size={14} />
      {Math.abs(pct) >= 100 ? Math.round(Math.abs(pct)) : Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function Kpi({ icon, label, value, prev, format, invert, spark, tone = 'gold', suffix }) {
  return (
    <motion.div className={`kpi tone-${tone}`} variants={rise} whileHover={{ y: -3 }}>
      <div className="row kpi-top">
        <span className="kpi-icon"><Icon name={icon} size={18} /></span>
        <span className="kpi-label grow" title={label}>{label}</span>
      </div>
      <div className="kpi-value num">
        {value === null || value === undefined ? '—' : <AnimatedNumber value={value} format={format} />}
        {suffix && value !== null && value !== undefined && <small>{suffix}</small>}
      </div>
      <div className="kpi-bottom">
        <Delta value={value} prev={prev} invert={invert} />
        {spark && <Sparkline values={spark} width={84} height={28} color={tone === 'leaf' ? '#1f7a45' : tone === 'maroon' ? '#a81c12' : '#d62b1e'} />}
      </div>
    </motion.div>
  );
}

export function Avatar({ name, size = 40, tone }) {
  const hues = ['var(--gradient-maroon)', 'var(--gradient-leaf)', 'var(--gradient-gold)', 'var(--gradient-saffron)', 'var(--gradient-peacock)'];
  const i = [...(name || '')].reduce((s, c) => s + c.charCodeAt(0), 0) % hues.length;
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36, background: tone || hues[i], color: i === 2 ? 'var(--accent-ink)' : '#fff' }}>
      {initials(name)}
    </span>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

/** English + Tamil inputs side by side. */
export function BiField({ label, value = {}, onChange, field, taField = `${field}Ta`, textarea = false, placeholder = ['', ''] }) {
  const Tag = textarea ? 'textarea' : 'input';
  const cls = textarea ? 'textarea' : 'input';
  return (
    <div className="field bifield">
      <span className="field-label">{label}</span>
      <div className="bifield-grid">
        <div className="bifield-col">
          <span className="bifield-tag">EN</span>
          <Tag className={cls} value={value[field] ?? ''} placeholder={placeholder[0]} onChange={(e) => onChange(field, e.target.value)} />
        </div>
        <div className="bifield-col">
          <span className="bifield-tag ta">த</span>
          <Tag className={`${cls} tamil-input`} value={value[taField] ?? ''} placeholder={placeholder[1]} onChange={(e) => onChange(taField, e.target.value)} />
        </div>
      </div>
    </div>
  );
}

export function SkeletonRows({ rows = 5, height = 52 }) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" style={{ height }} />)}
    </div>
  );
}

export function StatPill({ icon, label, value, tone }) {
  return (
    <div className={`statpill tone-${tone || 'muted'}`}>
      {icon && <Icon name={icon} size={16} />}
      <span className="subtle">{label}</span>
      <b className="num">{value}</b>
    </div>
  );
}

export const tel = (phone) => (phone ? `tel:+91${phone}` : undefined);
export const whatsapp = (phone, text = '') => `https://wa.me/91${phone}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
