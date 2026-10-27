// Sounds (Web Audio, no files), browser notifications, vibration and a
// marigold "flower shower" burst for celebrations.

let ctx = null;
const audio = () => {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};
// Browsers allow sound only after a tap; unlock on the first one.
if (typeof window !== 'undefined') {
  const unlock = () => { audio(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

function tone(freq, start, dur, { type = 'sine', gain = 0.22 } = {}) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sound = {
  /** Temple-bell like chime for status updates. */
  chime() { tone(880, 0, 0.9, { gain: 0.16 }); tone(1320, 0.0, 0.7, { gain: 0.06 }); tone(1174.7, 0.16, 0.9, { gain: 0.12 }); },
  /** Urgent two-tone alert for new orders / new deliveries. */
  alarm() { [0, 0.22, 0.44].forEach((s) => { tone(988, s, 0.18, { type: 'square', gain: 0.09 }); tone(740, s + 0.11, 0.16, { type: 'square', gain: 0.08 }); }); },
  success() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.09, 0.5, { gain: 0.12 })); },
  tap() { tone(1200, 0, 0.06, { gain: 0.05 }); },
  error() { tone(220, 0, 0.25, { type: 'sawtooth', gain: 0.06 }); tone(180, 0.12, 0.3, { type: 'sawtooth', gain: 0.06 }); },
};

export const vibrate = (pattern) => { try { navigator.vibrate?.(pattern); } catch { /* ignore */ } };

export async function askNotify() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

export function notify(title, body, { tag, icon } = {}) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
    new Notification(title, { body, tag, icon: icon || '/favicon.svg', renotify: Boolean(tag) });
  } catch { /* ignore */ }
}

/** Marigold petals and gold sparks bursting from a point (or the top of the screen). */
export function flowerShower({ x, y, count = 90 } = {}) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  Object.assign(c.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2000 });
  document.body.appendChild(c);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const colors = ['#F28C28', '#F6B13B', '#E35D1C', '#FFD166', '#d99a2b', '#B3261E', '#FCEBC0'];
  const ox = x ?? innerWidth / 2;
  const oy = y ?? -20;
  const burst = y !== undefined;
  const parts = Array.from({ length: count }, () => {
    const a = burst ? Math.random() * Math.PI * 2 : Math.PI / 2 + (Math.random() - 0.5) * 1.2;
    const v = burst ? 4 + Math.random() * 7 : 2 + Math.random() * 3;
    return {
      x: burst ? ox : Math.random() * innerWidth, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (burst ? 4 : 0),
      r: 4 + Math.random() * 6, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3, color: colors[(Math.random() * colors.length) | 0],
      petal: Math.random() < 0.7, life: 0, max: 120 + Math.random() * 80, sway: Math.random() * 6.28,
    };
  });
  let frame = 0;
  const tick = () => {
    frame += 1;
    g.clearRect(0, 0, innerWidth, innerHeight);
    let alive = 0;
    for (const p of parts) {
      p.life += 1;
      if (p.life > p.max) continue;
      alive += 1;
      p.vy += 0.12;
      p.vx *= 0.985;
      p.vy = Math.min(p.vy, 3.2);
      p.sway += 0.05;
      p.x += p.vx + Math.sin(p.sway) * 0.6;
      p.y += p.vy;
      p.rot += p.vr;
      g.save();
      g.globalAlpha = Math.min(1, (p.max - p.life) / 30);
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = p.color;
      g.beginPath();
      if (p.petal) g.ellipse(0, 0, p.r, p.r * 0.45, 0, 0, Math.PI * 2);
      else g.rect(-p.r / 3, -p.r / 3, p.r / 1.5, p.r / 1.5);
      g.fill();
      g.restore();
    }
    if (alive && frame < 400) requestAnimationFrame(tick);
    else c.remove();
  };
  requestAnimationFrame(tick);
}
