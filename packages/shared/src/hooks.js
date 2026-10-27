import { useCallback, useEffect, useRef, useState } from 'react';

/** Re-render every `ms` (for countdowns and "5 min ago"). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function useMediaQuery(query) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const fn = () => setMatch(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [query]);
  return match;
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/**
 * Load data with an async function; returns { data, error, loading, reload, setData }.
 * Re-runs when `deps` change.
 */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const seq = useRef(0);
  const run = useCallback(() => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    return Promise.resolve()
      .then(fn)
      .then((data) => { if (id === seq.current) setState({ data, error: null, loading: false }); return data; })
      .catch((error) => { if (id === seq.current) setState((s) => ({ ...s, error, loading: false })); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  const setData = useCallback((data) => setState((s) => ({ ...s, data: typeof data === 'function' ? data(s.data) : data })), []);
  return { ...state, reload: run, setData };
}

/** Persisted state in localStorage (per browser). */
export function useLocalState(key, initial) {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem(key); return s !== null ? JSON.parse(s) : initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } }, [key, v]);
  return [v, setV];
}

/** Light/dark theme stored per app; 'auto' follows the phone. */
export function useTheme(key, fallback = 'auto') {
  const [pref, setPref] = useLocalState(key, fallback);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = pref === 'auto' ? (systemDark ? 'dark' : 'light') : pref;
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return [theme, setPref, pref];
}

// A one-second silent clip made in the browser (no file to ship). Phones keep the screen on
// while a video plays, which is the fallback where the Wake Lock API is not allowed.
let silentClip = null;
function silentVideoUrl() {
  if (!silentClip) {
    silentClip = new Promise((resolve, reject) => {
      if (typeof MediaRecorder === 'undefined') { reject(new Error('no recorder')); return; }
      const canvas = Object.assign(document.createElement('canvas'), { width: 16, height: 16 });
      const g = canvas.getContext('2d');
      const rec = new MediaRecorder(canvas.captureStream(15));
      const parts = [];
      rec.ondataavailable = (e) => parts.push(e.data);
      rec.onstop = () => resolve(URL.createObjectURL(new Blob(parts, { type: rec.mimeType })));
      let n = 0;
      const draw = () => { g.fillStyle = n++ % 2 ? '#000' : '#010101'; g.fillRect(0, 0, 16, 16); if (rec.state === 'recording') requestAnimationFrame(draw); };
      rec.start();
      draw();
      setTimeout(() => rec.stop(), 1000);
    });
  }
  return silentClip;
}

/**
 * Keep the screen on and lit while `on`. Uses the Screen Wake Lock API where the page may
 * (https or localhost), takes it back whenever the app returns to the front, and otherwise
 * plays a tiny silent looping video. Browsers cannot raise brightness, only stop dimming.
 * Returns 'lock', 'video' or 'off'.
 */
export function useWakeLock(on) {
  const [mode, setMode] = useState('off');
  useEffect(() => {
    if (!on) { setMode('off'); return undefined; }
    let dead = false;
    let lock = null;
    let video = null;
    const playVideo = () => {
      if (dead) return;
      if (video) { video.play().catch(() => {}); return; }
      silentVideoUrl().then((src) => {
        if (dead || video) return;
        video = Object.assign(document.createElement('video'), { src, muted: true, loop: true, playsInline: true });
        video.setAttribute('playsinline', '');
        video.setAttribute('aria-hidden', 'true');
        Object.assign(video.style, { position: 'fixed', left: '0', bottom: '0', width: '16px', height: '16px', opacity: '0.01', pointerEvents: 'none', zIndex: '-1' });
        document.body.appendChild(video);
        video.play().then(() => !dead && setMode('video')).catch(() => {});
      }).catch(() => {});
    };
    const take = () => {
      if (dead || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      if (!('wakeLock' in navigator) || !window.isSecureContext) { playVideo(); return; }
      navigator.wakeLock.request('screen').then((l) => {
        if (dead) { l.release(); return; }
        lock = l;
        setMode('lock');
        l.addEventListener('release', () => { if (!dead) setMode('off'); });
      }).catch(playVideo);
    };
    take();
    // The lock drops whenever the app goes to the background; take it again on return, and on
    // the first tap for browsers that only allow it after the user has touched the page.
    const back = () => take();
    const tap = () => { take(); if (video?.paused) video.play().catch(() => {}); };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('focus', back);
    window.addEventListener('pointerdown', tap);
    return () => {
      dead = true;
      lock?.release().catch(() => {});
      if (video) { video.pause(); video.remove(); }
      document.removeEventListener('visibilitychange', back);
      window.removeEventListener('focus', back);
      window.removeEventListener('pointerdown', tap);
    };
  }, [on]);
  return mode;
}

export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
