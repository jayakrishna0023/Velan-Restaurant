// Steam rising off hot food. Soft puffs leave the surface of the dish, swell,
// sway on a slow air current and thin out, drawn from one pre-rendered sprite
// on a canvas laid over the photograph. It pauses off screen and in background
// tabs, and stays off for reduced motion.
import { useEffect, useRef } from 'react';

function puffSprite() {
  const s = document.createElement('canvas');
  s.width = 128;
  s.height = 128;
  const g = s.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.5)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.3)');
  grad.addColorStop(0.65, 'rgba(255,255,255,0.09)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return s;
}

/**
 * `source` is where the steam leaves the food, as fractions of the canvas:
 * centre x, surface y and the width of the steaming area.
 */
export default function Steam({ source = { x: 0.5, y: 0.6, w: 0.4 }, intensity = 1, className = '' }) {
  const ref = useRef(null);
  const src = useRef(source);
  src.current = source;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const sprite = puffSprite();
    let W = 0;
    let H = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = r.width;
      H = r.height;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const parts = [];
    let raf = 0;
    let last = 0;
    let carry = 0;
    let inView = true;
    const scale = () => Math.max(0.6, H / 640);

    const spawn = () => {
      const s = src.current;
      parts.push({
        x: (s.x + (Math.random() - 0.5) * s.w) * W,
        y: s.y * H + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 5,
        vy: -(16 + Math.random() * 20) * scale(),
        r: (8 + Math.random() * 12) * scale(),
        grow: (22 + Math.random() * 26) * scale(),
        life: 0,
        ttl: 4 + Math.random() * 3.5,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.35,
        a: 0.2 + Math.random() * 0.24,
        seed: Math.random() * 100,
      });
    };

    const frame = (now) => {
      if (!inView || document.hidden) { raf = 0; return; }
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      carry += dt * 13 * intensity;
      while (carry > 1 && parts.length < 90) { spawn(); carry -= 1; }
      ctx.clearRect(0, 0, W, H);
      const t = now / 1000;
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const p = parts[i];
        p.life += dt;
        const k = p.life / p.ttl;
        if (k >= 1) { parts.splice(i, 1); continue; }
        // A slow air current: the higher the puff, the more it sways and curls.
        const sway = (Math.sin(t * 0.55 + p.seed + p.y * 0.011) * 16 + Math.sin(t * 1.4 + p.seed * 1.7) * 6) * scale();
        p.vx += (sway * (0.25 + k) - p.vx) * dt * 0.9;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy *= 1 - dt * 0.12;
        p.rot += p.spin * dt;
        const r = p.r + p.grow * k;
        ctx.globalAlpha = Math.min(1, p.a * intensity * Math.sin(Math.PI * Math.min(1, k * 1.1)) ** 1.4);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, 1.7 - k * 0.6);
        ctx.drawImage(sprite, -r, -r, r * 2, r * 2);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!raf && inView && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };
    const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; start(); });
    io.observe(canvas);
    document.addEventListener('visibilitychange', start);
    start();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', start);
    };
  }, [intensity]);

  return <canvas ref={ref} className={`steam ${className}`} aria-hidden="true" />;
}
