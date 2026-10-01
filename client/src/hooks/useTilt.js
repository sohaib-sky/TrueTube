import { useCallback } from 'react';
import { useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';

/**
 * Mouse-follow 3D tilt, built on Framer Motion values.
 *
 * Driving the rotation with motion values (rather than writing
 * `element.style.transform` by hand) is what lets tilt and variant animation
 * live on the same element: Motion composes every transform it owns into a
 * single matrix, so the two systems never overwrite each other.
 *
 * The springs give the surface a little weight instead of snapping to the
 * pointer. Touch pointers and users who prefer reduced motion get no tilt.
 */
export function useTilt({ max = 7, scale = 1.03, lift = 6, perspective = 1100 } = {}) {
  const reduced = useReducedMotion();

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const active = useMotionValue(0);

  const spring = { stiffness: 220, damping: 22, mass: 0.6 };
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [max, -max]), spring);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-max, max]), spring);
  const scaleValue = useSpring(useTransform(active, [0, 1], [1, scale]), spring);
  const liftValue = useSpring(useTransform(active, [0, 1], [0, -lift]), spring);

  const onPointerMove = useCallback(
    (event) => {
      if (event.pointerType === 'touch' || reduced) return;
      const rect = event.currentTarget.getBoundingClientRect();
      px.set((event.clientX - rect.left) / rect.width - 0.5);
      py.set((event.clientY - rect.top) / rect.height - 0.5);
      active.set(1);
    },
    [active, px, py, reduced],
  );

  const onPointerLeave = useCallback(() => {
    px.set(0);
    py.set(0);
    active.set(0);
  }, [active, px, py]);

  const tiltProps = reduced
    ? {}
    : {
        onPointerMove,
        onPointerLeave,
        style: {
          rotateX,
          rotateY,
          scale: scaleValue,
          y: liftValue,
          transformPerspective: perspective,
          transformStyle: 'preserve-3d',
        },
      };

  return { tiltProps };
}

export default useTilt;
