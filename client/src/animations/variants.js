/**
 * Shared Framer Motion vocabulary.
 *
 * Everything the page animates draws from this file so the motion feels like one
 * system instead of a pile of one-off transitions. Motion UI's feel comes from
 * spring physics rather than fixed durations, so the defaults here are springs.
 *
 * MotionConfig (reducedMotion="user") in App.jsx strips transforms and layout
 * animation for users who prefer reduced motion, so these variants degrade
 * safely on their own.
 */

/** Cinematic overshoot-free settle for large type. */
export const SPRING = { type: 'spring', stiffness: 120, damping: 20, mass: 0.9 };
/** Faster spring for small controls — links, chips, icons. */
export const SPRING_SNAPPY = { type: 'spring', stiffness: 320, damping: 26, mass: 0.6 };
/** Very soft spring for slow, expensive surfaces (panels, cards). */
export const SPRING_SOFT = { type: 'spring', stiffness: 90, damping: 22, mass: 1.1 };

/** Kept for the handful of places that genuinely need an eased curve. */
export const EASE = [0.22, 1, 0.36, 1];

/**
 * The house reveal: opacity + translateY + blur + a touch of scale.
 * Text visibly travels into place instead of merely fading in.
 */
export const fadeUp = {
  hidden: { opacity: 0, y: 30, scale: 0.975, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: SPRING,
  },
};

/** A slower, wider variant for the biggest type on the page. */
export const fadeUpLarge = {
  hidden: { opacity: 0, y: 46, scale: 0.965, filter: 'blur(14px)' },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 90, damping: 19, mass: 1.05 },
  },
};

/** Masked line reveal: the line slides up from behind its own overflow clip. */
export const maskedLine = {
  hidden: { y: '110%', opacity: 0, filter: 'blur(10px)' },
  visible: {
    y: '0%',
    opacity: 1,
    filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 105, damping: 18, mass: 1 },
  },
};

/**
 * The same masked slide, without the blur filter.
 *
 * The accent headline is filled with `background-clip: text`, and in Chromium a
 * `filter` on an ancestor collapses that clip — the gradient disappears and
 * only the inherited text-shadow is left, which reads as flat grey. The line
 * still travels, fades and scales; it just does not blur.
 */
export const maskedLinePlain = {
  hidden: { y: '110%', opacity: 0, scale: 0.98 },
  visible: {
    y: '0%',
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 105, damping: 18, mass: 1 },
  },
};

/** Small elements: chips, icons, step numbers. */
export const popIn = {
  hidden: { opacity: 0, y: 14, scale: 0.86, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: SPRING_SNAPPY,
  },
};

/** Depth for glass surfaces: they rise and settle, like they have mass. */
export const riseIn = {
  hidden: { opacity: 0, y: 44, scale: 0.97, filter: 'blur(10px)' },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: SPRING_SOFT,
  },
};

/** Parent containers: reveal children in sequence. */
export const stagger = (children = 0.09, delay = 0.04) => ({
  hidden: {},
  visible: { transition: { staggerChildren: children, delayChildren: delay } },
});

/** Section headings reveal label → heading → description. */
export const headStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.06 } },
};

/** Hover / tap feedback for controls. */
export const controlHover = { scale: 1.03, y: -2 };
export const controlTap = { scale: 0.97, y: 0 };
