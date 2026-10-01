import { useEffect, useState } from 'react';

/**
 * How close to the top still counts as "at the top".
 *
 * A few pixels of slack, because browsers report fractional scroll positions and
 * the bounce at the very top of a page can dip a pixel or two negative. Without
 * it the banner flickers as that bounce settles.
 */
const TOP_SLACK = 12;

/**
 * Whether the banner should currently be out of the way.
 *
 * The rule is deliberately not direction-aware: the banner belongs to the very
 * top of the document, so it shows there and gets out of the way the moment the
 * reader commits to reading. It comes back only on returning to the top.
 *
 * The earlier version tracked scroll direction, which meant the banner stayed
 * glued to the viewport for the whole length of a section and reappeared
 * mid-article. That is a lot of screen to spend on navigation nobody is using at
 * that moment, and it made the header feel attached to the scroll position
 * rather than to the page.
 *
 * State is derived from scroll position only — the header is `position: fixed`
 * and is merely translated, so nothing in the document flow changes and there
 * is no layout shift when it moves.
 */
export function useHideOnScroll({ disabled = false } = {}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (disabled) {
      setHidden(false);
      return undefined;
    }

    const update = () => {
      setHidden(Math.max(0, window.scrollY) > TOP_SLACK);
    };

    // rAF-coalesced: scroll fires far faster than the compositor can present,
    // and every one of those events would otherwise re-run the comparison.
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [disabled]);

  return hidden;
}

export default useHideOnScroll;
