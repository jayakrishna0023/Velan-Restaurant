// Smooth scrolling (Lenis) for the website, with a helper to glide to sections.
import Lenis from 'lenis';

let lenis = null;

export function startSmoothScroll() {
  if (lenis || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  lenis = new Lenis({ duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 4), wheelMultiplier: 0.95, touchMultiplier: 1.4 });
  let raf = 0;
  const loop = (time) => { lenis?.raf(time); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  return () => { cancelAnimationFrame(raf); lenis?.destroy(); lenis = null; };
}

/** Scroll to an element id or y position, offsetting the sticky header. */
export function scrollToTarget(target, offset = -88) {
  const el = typeof target === 'string' ? document.getElementById(target) : null;
  if (lenis) {
    lenis.scrollTo(el || target, { offset, duration: 1.3 });
    return;
  }
  const y = el ? el.getBoundingClientRect().top + window.scrollY + offset : target;
  window.scrollTo({ top: y, behavior: 'smooth' });
}

/** Jump straight to the top (a new page). Going through Lenis stops a glide that is still running from pulling the page back down. */
export function jumpToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo(0, 0);
}

export const pauseScroll = (paused) => { if (!lenis) return; if (paused) lenis.stop(); else lenis.start(); };
