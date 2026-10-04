import { Suspense, lazy, useMemo } from 'react';
import SectionHead from '../components/SectionHead.jsx';
import DeveloperCredit from '../components/DeveloperCredit.jsx';
import { useSupportedSources } from '../hooks/useSupportedSources.js';
import { motion } from 'framer-motion';
import { stagger, SPRING_SOFT } from '../animations/variants.js';

/**
 * The whole 3D universe (Three.js + React Three Fiber) is code-split, so the
 * rest of the page never downloads the 3D engine until this section needs it.
 */
const PlatformUniverse = lazy(() => import('../components/platforms/PlatformUniverse.jsx'));

function UniverseFallback() {
  return (
    <div className="universe" aria-hidden="true">
      <div className="universe__fallback">
        {Array.from({ length: 16 }).map((_, index) => (
          <span key={index} className="universe__ghost" style={{ animationDelay: `${index * 0.06}s` }} />
        ))}
      </div>
    </div>
  );
}

/**
 * Supported Platforms: a real Three.js universe (perspective camera, physical
 * lights, soft shadows, true 3D cards) rendered straight from the live
 * allowlist, so it can never advertise a source the API would reject.
 */
export default function Platforms() {
  const { status, source, data } = useSupportedSources();
  const count = data?.platforms?.length ?? 0;

  const text = useMemo(() => {
    // Kept to two lines on a laptop. The previous wording ran to three, which
    // pushed the card grid below the fold and made arriving on this page look
    // like it opened into an empty band before anything happened.
    if (status === 'ready' && source === 'live') {
      return 'Every hostname below is accepted. TrueTube attempts the link and reports exactly what the source returns.';
    }
    if (status === 'ready') {
      return 'These hostnames ship with TrueTube. Downloads need the service to be running.';
    }
    return 'These hostnames are read live from the engine, so the list always matches what the server can attempt.';
  }, [status, source]);

  return (
    <section className="section" id="platforms" aria-labelledby="platforms-heading">
      <div className="container">
        <SectionHead
          id="platforms"
          eyebrow="Supported platforms"
          title={status === 'ready' ? `Works with ${count}+ Platforms` : 'Works with every platform'}
          text={text}
          center
        />

        {/* The section's own entrance is a spring, and the universe inside
            reveals on the same beat as the heading finishes settling. */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={stagger(0.12, 0.12)}
        >
          <Suspense fallback={<UniverseFallback />}>
            <PlatformUniverse />
          </Suspense>
        </motion.div>

        <DeveloperCredit align="center" />
      </div>
    </section>
  );
}
