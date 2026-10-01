import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * A click ripple, anchored to where the pointer actually landed.
 *
 * Two things happen at once, and both are cheap: a blue disc expands from the
 * press point and fades, and a soft blue glow lifts off the surface. The glow
 * is what makes it read as "light" rather than a grey ripple; the disc is what
 * makes it read as coming *from* the finger.
 *
 * Pass an `owner` when one hook drives several buttons, so each ripple is
 * tagged with the surface it belongs to and the caller can filter.
 *
 * Reduced motion is respected by making the effect *smaller*, not by removing
 * it: the disc barely grows and everything happens in a fraction of the time.
 * Dropping the feedback entirely left the button looking broken on any machine
 * with animations switched off at the OS level — which is a common setting and
 * not a request for a dead control.
 *
 * @returns {{ ripples: object[], pressed: boolean, pressedId: string|null, gentle: boolean, triggerPress: (event: React.PointerEvent<HTMLElement>, owner?: string) => void, endPress: () => void }}
 */
/** How long the feedback lasts when reduced motion is requested. */
const GENTLE_MS = 260;

export function useClickRipple(duration = 900) {
  const reduced = useReducedMotion();
  const nextId = useRef(0);
  const [ripples, setRipples] = useState([]);
  const [pressed, setPressed] = useState(false);
  const [pressedId, setPressedId] = useState(null);
  const timers = useRef(new Set());

  // Timers outlive the component if a ripple is still running when it unmounts,
  // which would then setState on a dead element.
  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
      timers.current.clear();
    },
    [],
  );

  const triggerPress = useCallback(
    (event, owner = null) => {
      // `pressed` and `pressedId` are tracked apart on purpose: a single button
      // passes no owner, so deriving the flag from the id alone would leave the
      // glow switched off while the ripple still played.
      setPressed(true);
      setPressedId(owner);

      // The rect is read from the event's own node, so a re-render between
      // press and release cannot aim the disc at the wrong element.
      const node = event.currentTarget;
      if (!node?.getBoundingClientRect) return;

      const rect = node.getBoundingClientRect();
      const id = (nextId.current += 1);
      const life = reduced ? GENTLE_MS : duration;

      setRipples((current) => [
        ...current,
        {
          id,
          owner,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          // A press near a corner must still cover the surface, so the disc is
          // sized from the furthest corner rather than a fixed diameter.
          size: Math.max(
            rect.width,
            rect.height,
            Math.hypot(
              Math.max(event.clientX - rect.left, rect.right - event.clientX),
              Math.max(event.clientY - rect.top, rect.bottom - event.clientY),
            ),
          ),
        },
      ]);

      const timer = setTimeout(() => {
        timers.current.delete(timer);
        setRipples((current) => current.filter((r) => r.id !== id));
      }, life);
      timers.current.add(timer);
    },
    [duration, reduced],
  );

  const endPress = useCallback(() => {
    setPressed(false);
    setPressedId(null);
  }, []);

  return { ripples, pressed, pressedId, gentle: reduced, triggerPress, endPress };
}

export default useClickRipple;
