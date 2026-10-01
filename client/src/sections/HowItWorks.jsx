import { motion, useReducedMotion } from 'framer-motion';
import { Download, Link2, SlidersHorizontal } from 'lucide-react';
import { useTilt } from '../hooks/useTilt.js';
import DeveloperCredit from '../components/DeveloperCredit.jsx';
import { fadeUp, popIn, SPRING_SOFT } from '../animations/variants.js';

const STEPS = [
  {
    title: 'Paste Link',
    text: 'Copy the video URL from any supported platform.',
    icon: Link2,
    tint: 'linear-gradient(150deg, #7dd3fc, #38bdf8)',
  },
  {
    title: 'Choose Quality',
    text: 'Select the format and resolution the source offers.',
    icon: SlidersHorizontal,
    tint: 'linear-gradient(150deg, #a5b4fc, #818cf8)',
  },
  {
    title: 'Download',
    text: 'The file is streamed to you and deleted server-side.',
    icon: Download,
    tint: 'linear-gradient(150deg, #5eead4, #22d3ee)',
  },
];

/**
 * Numbered step rail.
 *
 * The panel rises on a soft spring when it enters view, then the eye is walked
 * down the rail: title, then step by step, and inside each step the number,
 * icon, heading and description appear in that order.
 *
 * Tilt and reveal live on two separate elements on purpose — Motion composes
 * every transform it owns into one matrix per element, so a single element
 * cannot both animate `y`/`scale` from a variant and receive tilt from a
 * motion value. The outer element tilts (and carries the panel's children with
 * it), the inner element performs the reveal.
 */
export default function HowItWorks() {
  const reduced = useReducedMotion();
  const { tiltProps } = useTilt({ max: 3.5, scale: 1.005, lift: 6, perspective: 1800 });

  const panelVariants = reduced
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 46, scale: 0.975, filter: 'blur(10px)' },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          transition: { ...SPRING_SOFT, staggerChildren: 0.15, delayChildren: 0.08 },
        },
      };

  const stepVariants = reduced
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 34, scale: 0.96, filter: 'blur(7px)' },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          transition: { ...SPRING_SOFT, staggerChildren: 0.06, delayChildren: 0.04 },
        },
      };

  // Pass-through parents that only add a stagger, so their children cascade.
  const cascade = (children, delayChildren = 0) =>
    reduced
      ? undefined
      : { hidden: {}, visible: { transition: { staggerChildren: children, delayChildren } } };

  return (
    <section className="section section--tight" id="how" aria-labelledby="how-heading">
      <div className="container">
        <motion.div className="steps-tilt" {...tiltProps}>
          <motion.div
            className="steps-panel"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={panelVariants}
          >
            <motion.h2 className="steps-panel__title" id="how-heading" variants={fadeUp}>
              How It Works
            </motion.h2>

            <motion.ol className="steps" variants={cascade(0.13)}>
              {STEPS.map((step, index) => (
                <motion.li className="step" key={step.title} variants={stepVariants}>
                  <motion.span className="step__rail" variants={reduced ? undefined : popIn}>
                    <motion.span className="step__number" variants={reduced ? undefined : popIn}>
                      {index + 1}
                    </motion.span>
                  </motion.span>

                  <motion.span
                    className="step__icon glossy-tile"
                    style={{ '--tile-tint': step.tint }}
                    aria-hidden="true"
                    variants={reduced ? undefined : popIn}
                  >
                    <motion.span
                      className="step__icon-inner"
                      initial={false}
                      whileHover={reduced ? undefined : { rotate: -10, scale: 1.12 }}
                      transition={SPRING_SOFT}
                    >
                      <step.icon size={20} strokeWidth={1.9} />
                    </motion.span>
                  </motion.span>

                  <motion.div variants={cascade(0.07)}>
                    <motion.h3 className="step__title" variants={fadeUp}>
                      {step.title}
                    </motion.h3>
                    <motion.p className="step__text" variants={fadeUp}>
                      {step.text}
                    </motion.p>
                  </motion.div>
                </motion.li>
              ))}
            </motion.ol>
          </motion.div>
        </motion.div>

        <DeveloperCredit align="center" />
      </div>
    </section>
  );
}
