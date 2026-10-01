import { useEffect } from 'react';

/** Prevents background scrolling while the mobile navigation is open. */
export function useLockBodyScroll(active) {
  useEffect(() => {
    if (!active) return undefined;

    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [active]);
}

export default useLockBodyScroll;
