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

/** Scroll to an element id or y position, offsetting the sticky header and category bar. */
export function scrollToTarget(target, offset = null) {
  const el = typeof target === 'string' ? document.getElementById(target) : null;
  const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
  const menuBarH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--menu-bar-h')) || 58;
  const finalOffset = offset !== null ? offset : -(headerH + menuBarH + 20);
  if (lenis) {
    lenis.scrollTo(el || target, { offset: finalOffset, duration: 1.1 });
    return;
  }
  const y = el ? el.getBoundingClientRect().top + window.scrollY + finalOffset : target;
  window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
}

/** Jump straight to the top (a new page). Going through Lenis stops a glide that is still running from pulling the page back down. */
export function jumpToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo(0, 0);
}

export const pauseScroll = (paused) => { if (!lenis) return; if (paused) lenis.stop(); else lenis.start(); };
