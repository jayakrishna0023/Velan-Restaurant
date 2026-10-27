// Motion helpers for the website: scroll reveals, split headlines, image
// wipes, rolling button labels, magnetic buttons and the fly-to-cart effect.
import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';

export const ease = [0.2, 0.7, 0.2, 1];
// Reveals start a little before things reach the screen, so a quick scroll never lands on blank space.
const REVEAL_MARGIN = '0px 0px 120px 0px';
export const curtain = [0.76, 0, 0.24, 1];

/** Split text into user-perceived characters, so Tamil letters stay whole. */
export function graphemes(text) {
  const s = String(text);
  if (typeof Intl !== 'undefined' && Intl.Segmenter) return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].map((g) => g.segment);
  return [...s];
}

/**
 * Text whose letters rise out of a mask one after another. Plays when `play`
 * turns true, or on scrolling into view when `play` is left undefined.
 */
export function Letters({ text, className, delay = 0, stagger = 0.045, duration = 1.1, play, as = 'span' }) {
  const M = motion[as];
  const trigger = play === undefined
    ? { initial: 'hidden', whileInView: 'show', viewport: { once: true, margin: REVEAL_MARGIN } }
    : { initial: 'hidden', animate: play ? 'show' : 'hidden' };
  return (
    <M className={className} aria-label={text} {...trigger}>
      {graphemes(text).map((ch, i) => (
        <span key={i} className="lt-mask" aria-hidden="true">
          <motion.span className="lt" variants={{ hidden: { y: '115%' }, show: { y: '0%', transition: { duration, ease, delay: delay + i * stagger } } }}>
            {ch === ' ' ? ' ' : ch}
          </motion.span>
        </span>
      ))}
    </M>
  );
}

/** Add `is-in` to an element the first time it scrolls into view (for CSS-driven reveals). */
export function useInViewClass(margin = '0px 0px 80px 0px') {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, inView];
}

/** A photograph that wipes open from below while it settles from a slight zoom. */
export function WipeImage({ src, alt = '', className = '', from = 'bottom', delay = 0, children }) {
  const [ref, inView] = useInViewClass();
  return (
    <div ref={ref} className={`wipe wipe-${from} ${inView ? 'is-in' : ''} ${className}`} style={{ '--wipe-delay': `${delay}s` }}>
      {src && <img src={src} alt={alt} loading="lazy" />}
      {children}
    </div>
  );
}

/** A label that rolls up to a copy of itself on hover (CSS-driven). */
export function RollText({ children }) {
  return (
    <span className="roll">
      <span className="roll-a">{children}</span>
      <span className="roll-b" aria-hidden="true">{children}</span>
    </span>
  );
}

/**
 * Piecewise-linear map of a scroll MotionValue (numbers only), clamped at the
 * ends. Unlike a range-array useTransform this is a plain function, so
 * framer-motion never hands it to the browser's scroll timeline — which
 * measures the whole page, not the section, and leaves fades stuck.
 */
export function useRange(mv, input, output) {
  return useTransform(mv, (v) => {
    if (v <= input[0]) return output[0];
    for (let i = 1; i < input.length; i += 1) {
      if (v <= input[i]) {
        const k = (v - input[i - 1]) / (input[i] - input[i - 1] || 1);
        return output[i - 1] + (output[i] - output[i - 1]) * k;
      }
    }
    return output[output.length - 1];
  });
}

export const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.8, ease, delay: i * 0.08 } }),
};

/** Reveal children when scrolled into view. */
export function Reveal({ children, delay = 0, y = 18, className, as = 'div', once = true, ...rest }) {
  const M = motion[as];
  return (
    <M className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: REVEAL_MARGIN }} transition={{ duration: 0.8, ease, delay }} {...rest}>
      {children}
    </M>
  );
}

/** Headline whose words rise from a mask one after another. */
export function SplitWords({ text, className, delay = 0, stagger = 0.07, as = 'span', inView = false, play }) {
  const words = String(text).split(' ');
  const M = motion[as];
  const trigger = play !== undefined ? { animate: play ? 'show' : 'hidden' }
    : inView ? { whileInView: 'show', viewport: { once: true, margin: REVEAL_MARGIN } } : { animate: 'show' };
  return (
    <M className={className} initial="hidden" {...trigger} aria-label={text}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} aria-hidden="true" style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', paddingBottom: '0.08em', marginBottom: '-0.08em' }}>
          <motion.span style={{ display: 'inline-block', willChange: 'transform' }}
            variants={{ hidden: { y: '110%', rotate: 4 }, show: { y: '0%', rotate: 0, transition: { duration: 0.9, ease, delay: delay + i * stagger } } }}>
            {w}{i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </M>
  );
}

/** Button that leans toward the pointer. */
export function Magnetic({ children, strength = 0.35, className }) {
  const ref = useRef(null);
  const x = useSpring(0, { stiffness: 250, damping: 18 });
  const y = useSpring(0, { stiffness: 250, damping: 18 });
  const reduce = useReducedMotion();
  return (
    <motion.span ref={ref} className={className} style={{ display: 'inline-flex', x, y }}
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== 'mouse') return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * strength);
        y.set((e.clientY - r.top - r.height / 2) * strength);
      }}
      onPointerLeave={() => { x.set(0); y.set(0); }}>
      {children}
    </motion.span>
  );
}

/** 3D tilt following the pointer, with a moving glare. */
export function Tilt({ children, className, max = 8, style }) {
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [max, -max]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(mx, [0, 1], [-max, max]), { stiffness: 200, damping: 20 });
  const glareX = useTransform(mx, (v) => `${v * 100}%`);
  const glareY = useTransform(my, (v) => `${v * 100}%`);
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} style={{ ...style, rotateX: reduce ? 0 : rx, rotateY: reduce ? 0 : ry, transformPerspective: 900 }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => { mx.set(0.5); my.set(0.5); }}>
      {children}
      <motion.span className="tilt-glare" style={{ '--gx': glareX, '--gy': glareY }} />
    </motion.div>
  );
}

/** Fly a copy of an image from `fromEl` onto the plate when it is on screen, else into the cart button. */
export function flyToCart(fromEl) {
  const plate = document.querySelector('[data-plate-target]');
  const pr = plate?.getBoundingClientRect();
  const onScreen = pr && pr.width > 0 && pr.bottom > 0 && pr.top < window.innerHeight;
  const target = onScreen ? plate : document.querySelector('[data-cart-target]');
  if (!fromEl || !target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const a = fromEl.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  if (!a.width || !b.width) return;
  const ghost = fromEl.cloneNode(true);
  const size = Math.min(a.width, a.height, 120);
  Object.assign(ghost.style, {
    position: 'fixed', left: `${a.left + a.width / 2 - size / 2}px`, top: `${a.top + a.height / 2 - size / 2}px`,
    width: `${size}px`, height: `${size}px`, objectFit: 'cover', borderRadius: '50%', zIndex: 3000, pointerEvents: 'none',
    boxShadow: '0 20px 40px -10px rgba(0,0,0,.5)', margin: 0,
  });
  document.body.appendChild(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  ghost.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.45}px, ${dy * 0.2 - 90}px) scale(.7)`, opacity: 1, offset: 0.45 },
    { transform: `translate(${dx}px, ${dy}px) scale(.12)`, opacity: 0.6 },
  ], { duration: 820, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => ghost.remove();
}
