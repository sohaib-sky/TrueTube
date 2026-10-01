import { motion, useReducedMotion } from 'framer-motion';
import { cx } from '../utils/cx.js';
import { fadeUp, SPRING, SPRING_SOFT, SPRING_SNAPPY } from '../animations/variants.js';

const SPRINGS = { soft: SPRING_SOFT, normal: SPRING, snappy: SPRING_SNAPPY };

/**
 * Scroll-triggered reveal.
 *
 * Content is always in the DOM for crawlers and assistive tech; only opacity,
 * transform and filter are animated. The reveal is a real spring (translate +
 * blur + scale), not a CSS transition, and it fires when the element enters the
 * viewport rather than on mount.
 *
 * `stagger` turns the element into a parent that reveals its own `Reveal`
 * children in sequence — that is how every grid on the page cascades.
 */
export default function Reveal({
  children,
  delay = 0,
  y,
  className,
  as = 'div',
  once = true,
  amount = 0.25,
  spring = 'normal',
  stagger: staggerChildren = 0,
}) {
  const reduced = useReducedMotion();
  const MotionTag = motion[as] || motion.div;
  const distance = y ?? 30;

  // Parent mode: only orchestrates the sequence, no transform of its own.
  if (staggerChildren > 0) {
    return (
      <MotionTag
        className={cx(className)}
        initial="hidden"
        whileInView="visible"
        viewport={{ once, amount }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren, delayChildren: delay } },
        }}
      >
        {children}
      </MotionTag>
    );
  }

  const transition = { ...(SPRINGS[spring] ?? SPRING), delay };

  // A per-instance travel distance, without forking the shared variant object.
  const variants =
    y === undefined || reduced
      ? reduced
        ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
        : fadeUp
      : {
          hidden: { ...fadeUp.hidden, y: distance },
          visible: fadeUp.visible,
        };

  return (
    <MotionTag
      className={cx(className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={variants}
      transition={transition}
    >
      {children}
    </MotionTag>
  );
}
