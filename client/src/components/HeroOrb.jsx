import { useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { Camera, Film, Globe, Heart, Layers, Music, Radio, Tv, Zap } from 'lucide-react';
import { EASE } from '../animations/variants.js';

/** Seconds for one full revolution. */
const ORBIT_DURATION = 30;
const ORBIT_TILT = -20;

/**
 * Eight spheres on a tilted 3D ring. The angular offset drives a negative CSS
 * animation delay so each sphere's depth animation stays perfectly in sync
 * with the ring — no JavaScript per frame.
 */
const ORBS = [
  { icon: Film, color: '#dc2626', deep: '#7f1d1d', glow: 'rgba(220,38,38,.55)', label: 'Video' },
  { icon: Camera, color: '#d99a2b', deep: '#7c4a12', glow: 'rgba(217,154,43,.5)', label: 'Photos' },
  { icon: Heart, color: '#db2777', deep: '#831843', glow: 'rgba(219,39,119,.5)', label: 'Favourites' },
  { icon: Tv, color: '#7c3aed', deep: '#4c1d95', glow: 'rgba(124,58,237,.55)', label: 'Live' },
  { icon: Layers, color: '#94a3b8', deep: '#475569', glow: 'rgba(148,163,184,.42)', label: 'Layers' },
  { icon: Radio, color: '#16a34a', deep: '#14532d', glow: 'rgba(22,163,74,.5)', label: 'Audio' },
  { icon: Globe, color: '#2563eb', deep: '#1e3a8a', glow: 'rgba(37,99,235,.55)', label: 'Web' },
  { icon: Music, color: '#0891b2', deep: '#164e63', glow: 'rgba(8,145,178,.5)', label: 'Music' },
];

/**
 * The hero centrepiece: a real 3D orbital system.
 *
 * Depth comes from CSS 3D only — `perspective` on the stage, a `preserve-3d`
 * ring that rotates on the Y axis, and every sphere pushed out on Z. The
 * browser then sorts them in 3D, so spheres pass correctly in front of and
 * behind the centre. Framer Motion handles interaction (entrance, mouse
 * parallax, hover) rather than the per-frame work.
 */
export default function HeroOrb() {
  const reduced = useReducedMotion();
  const sceneRef = useRef(null);

  // Mouse parallax — small, spring-damped, never fights the orbit.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateY = useSpring(mx, { stiffness: 60, damping: 20, mass: 0.6 });
  const rotateX = useSpring(my, { stiffness: 60, damping: 20, mass: 0.6 });

  const onPointerMove = (event) => {
    if (reduced) return;
    const rect = sceneRef.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set(((event.clientX - rect.left) / rect.width - 0.5) * 12);
    my.set(((event.clientY - rect.top) / rect.height - 0.5) * -8);
  };

  const resetPointer = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <motion.div
      ref={sceneRef}
      className="orbit"
      aria-hidden="true"
      onPointerMove={onPointerMove}
      onPointerLeave={resetPointer}
      style={reduced ? undefined : { rotateX, rotateY }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: EASE }}
    >
      <div className="orbit__stage">
        {/* No halo and no ring: the composition sits directly on the site's
            animated world, so nothing large and circular is drawn behind it. */}
        <div
          className="orbit__ring"
          style={
            reduced
              ? undefined
              : {
                  animation: `orbit-spin ${ORBIT_DURATION}s linear infinite`,
                  '--orbit-tilt': `${ORBIT_TILT}deg`,
                }
          }
        >
          {ORBS.map(({ icon: Icon, color, deep, glow, label }, index) => {
            const angle = index * (360 / ORBS.length);
            // The sphere reaches the front of the orbit when the ring has
            // turned (360 - angle), so the depth animation is delayed to match.
            const depthDelay = -(((360 - angle) % 360) / 360) * ORBIT_DURATION;

            return (
              <div
                key={label}
                className="orbit__slot"
                style={{
                  '--slot-angle': `${angle}deg`,
                  '--depth-delay': `${depthDelay}s`,
                  '--orb-color': color,
                  '--orb-deep': deep,
                  '--orb-glow': glow,
                }}
              >
                {/* Counters the ring rotation so the sphere always faces the
                    camera — a flat disc would otherwise be squashed edge-on.
                    No animation delay: the angle offset cancels itself. */}
                <div
                  className="orbit__billboard"
                  style={reduced ? undefined : { '--billboard-from': `${-angle}deg` }}
                >
                  <motion.div
                    className="orbit__sphere"
                    whileHover={reduced ? undefined : { scale: 1.14 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                  >
                    <span className="orbit__specular" />
                    <Icon className="orbit__icon" strokeWidth={1.9} />
                    <span className="orbit__shade" />
                    <span className="orbit__tooltip">{label}</span>
                  </motion.div>
                </div>
              </div>
            );
          })}
        </div>

        <motion.div
          className="orbit__core"
          whileHover={reduced ? undefined : { scale: 1.03 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        >
          <span className="orbit__core-face" />
          <span className="orbit__core-back" />
          <Zap className="orbit__core-icon" strokeWidth={1.7} />
        </motion.div>
      </div>
    </motion.div>
  );
}
