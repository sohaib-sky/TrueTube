import { motion } from 'framer-motion';
import { Gauge, Lock, MonitorSmartphone, ShieldCheck, Zap } from 'lucide-react';
import { useTilt } from '../hooks/useTilt.js';
import DeveloperCredit from '../components/DeveloperCredit.jsx';
import { fadeUp, stagger, SPRING_SOFT } from '../animations/variants.js';

const FEATURES = [
  {
    icon: Zap,
    tint: 'linear-gradient(150deg, #a7f3d0, #10b981)',
    glow: 'rgba(16, 185, 129, 0.55)',
    title: 'Ultra Fast',
    text: 'Get your media in seconds, not minutes.',
  },
  {
    icon: ShieldCheck,
    tint: 'linear-gradient(150deg, #a5b4fc, #6366f1)',
    glow: 'rgba(99, 102, 241, 0.55)',
    title: '100% Free',
    text: 'No hidden fees, no registration.',
  },
  {
    icon: MonitorSmartphone,
    tint: 'linear-gradient(150deg, #7dd3fc, #3b82f6)',
    glow: 'rgba(59, 130, 246, 0.55)',
    title: 'All Devices',
    text: 'Works on mobile, tablet and desktop.',
  },
  {
    icon: Gauge,
    tint: 'linear-gradient(150deg, #f0abfc, #a855f7)',
    glow: 'rgba(168, 85, 247, 0.55)',
    title: 'High Quality',
    text: 'Download in the highest quality the source provides.',
  },
  {
    icon: Lock,
    tint: 'linear-gradient(150deg, #5eead4, #0ea5e9)',
    glow: 'rgba(14, 165, 233, 0.55)',
    title: 'Safe & Secure',
    text: 'No cookies, no credentials, no stored files.',
  },
];

function FeatureCard({ feature }) {
  const { tiltProps } = useTilt({ max: 7, scale: 1.03, lift: 7 });

  return (
    // The cell reveals (variant-driven y/scale); the card inside it tilts
    // (motion-value-driven). Two elements, so neither system overwrites the
    // other's transform.
    <motion.div className="feature-cell" variants={fadeUp} transition={SPRING_SOFT}>
      <article className="feature" {...tiltProps}>
        <span
          className="feature__icon glossy-tile"
          style={{ '--tile-tint': feature.tint, '--tile-glow': feature.glow }}
        >
          <feature.icon size={24} strokeWidth={1.9} />
        </span>
        <h2 className="feature__title">{feature.title}</h2>
        <p className="feature__text">{feature.text}</p>
      </article>
    </motion.div>
  );
}

export default function Features() {
  return (
    <section className="section section--tight" id="features" aria-labelledby="features-heading">
      <div className="container">
        {/* The grid is the stagger parent, so the five cards cascade in the
            moment the section enters the viewport. */}
        <motion.div
          className="features"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={stagger(0.1, 0.05)}
        >
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </motion.div>

        <DeveloperCredit align="center" />
      </div>
    </section>
  );
}
