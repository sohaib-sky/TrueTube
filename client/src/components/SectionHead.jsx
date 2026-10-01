import { motion, useReducedMotion } from 'framer-motion';
import { cx } from '../utils/cx.js';
import { fadeUp, headStagger, popIn } from '../animations/variants.js';

/**
 * Section heading that reveals itself in sequence: label → heading →
 * description, driven by a parent stagger that fires when the section enters
 * the viewport. Each part travels, un-blurs and settles on its own spring, so
 * the block assembles instead of fading in as one lump.
 */
export default function SectionHead({ id, eyebrow, title, text, center = false, className }) {
  const reduced = useReducedMotion();
  const headingId = id ? `${id}-heading` : undefined;

  return (
    <motion.div
      className={cx('section-head', center && 'section-head--center', className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.35 }}
      variants={reduced ? { hidden: {}, visible: {} } : headStagger}
    >
      {eyebrow ? (
        <motion.span className="section-head__eyebrow" variants={reduced ? fadeUp : popIn}>
          {eyebrow}
        </motion.span>
      ) : null}
      <motion.h2 className="section-head__title" id={headingId} variants={fadeUp}>
        {title}
      </motion.h2>
      {text ? (
        <motion.p className="section-head__text" variants={fadeUp}>
          {text}
        </motion.p>
      ) : null}
    </motion.div>
  );
}
