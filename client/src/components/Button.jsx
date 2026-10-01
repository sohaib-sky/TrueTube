import { forwardRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cx } from '../utils/cx.js';
import { controlHover, controlTap, SPRING_SNAPPY } from '../animations/variants.js';
import { useClickRipple } from '../hooks/useClickRipple.js';

/**
 * Real <button> with real motion.
 *
 * Hover lifts and scales on a spring, tap compresses, and pressing fires a
 * blue ripple from the exact point the pointer landed, plus a short blue glow
 * across the surface. The ripple is what makes the button feel like it is
 * emitting light rather than just dimming.
 *
 * Loading state keeps the label and announces itself to assistive tech.
 */
const Button = forwardRef(function Button(
  {
    variant = 'default',
    size = 'md',
    loading = false,
    disabled = false,
    block = false,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const reduced = useReducedMotion();
  const inert = disabled || loading;
  const { ripples, pressed, gentle, triggerPress, endPress } = useClickRipple();

  return (
    <motion.button
      ref={ref}
      type={type}
      className={cx(
        'btn',
        `btn--${variant}`,
        size !== 'md' && `btn--${size}`,
        block && 'btn--block',
        className,
      )}
      data-pressed={pressed ? 'true' : undefined}
      data-gentle={gentle ? 'true' : undefined}
      disabled={inert}
      aria-busy={loading || undefined}
      /* Hover and tap are the big, decorative movements, so they are the parts
         reduced motion turns off. The press ripple is only a short brightness
         change at the pointer, so its handlers stay attached in both modes —
         dropping them made the button feel completely dead. */
      whileHover={inert || reduced ? undefined : controlHover}
      whileTap={inert || reduced ? undefined : controlTap}
      transition={SPRING_SNAPPY}
      onPointerDown={inert ? undefined : triggerPress}
      onPointerUp={inert ? undefined : endPress}
      onPointerLeave={inert ? undefined : endPress}
      onPointerCancel={inert ? undefined : endPress}
      {...rest}
    >
      {/* One disc per press, anchored to the pointer and removed when it ends.
          Rendered for reduced motion too, just with a shorter, still
          animation: the press has to register either way. */}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="btn__ripple"
          aria-hidden="true"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
          }}
        />
      ))}

      {/* A blue wash over the whole surface, so the glow covers more than the
          disc itself. */}
      <span className="btn__flash" aria-hidden="true" />

      {/* Highlight sweep: travels across the surface on hover. */}
      {!reduced ? <span className="btn__sweep" aria-hidden="true" /> : null}
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
      <span className="btn__label">{children}</span>
    </motion.button>
  );
});

export default Button;
