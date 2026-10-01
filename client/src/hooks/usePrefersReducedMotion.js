import { useEffect, useState } from 'react';

/**
 * Tracks `prefers-reduced-motion` and mirrors it onto <html> so CSS can
 * respond as well as Framer Motion.
 */
export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event) => setPrefersReducedMotion(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = prefersReducedMotion ? 'true' : 'false';
  }, [prefersReducedMotion]);

  return prefersReducedMotion;
}

export default usePrefersReducedMotion;
