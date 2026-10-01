import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { motion, useReducedMotion } from 'framer-motion';
import ErrorBoundary from '../ErrorBoundary.jsx';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion.js';
import { useSupportedSources } from '../../hooks/useSupportedSources.js';
import { SPRING_SOFT } from '../../animations/variants.js';

const PlatformScene = lazy(() => import('./PlatformScene.jsx'));

/** The 3D scene needs WebGL; devices without it get the static layout. */
function hasWebGL() {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function SceneFallback({ count }) {
  return (
    <div className="universe__fallback">
      {Array.from({ length: count }).map((_, index) => (
        <span key={index} className="universe__ghost" style={{ animationDelay: `${(index % 16) * 0.06}s` }} />
      ))}
    </div>
  );
}

/**
 * The Supported Platforms universe: a real Three.js scene (React Three Fiber)
 * with a perspective camera, physical lights, soft shadows and real 3D cards.
 *
 * The scene has no container of its own — it is fully transparent, so the cards
 * float directly over the site's animated flow-field background. The complete
 * supported-platform list is always shown; there is no collapse.
 *
 * The canvas is mounted only once the section is close to being read. That
 * matters here: the background already holds a WebGL context, and standing up a
 * second one immediately means two renderers competing during the first paint.
 */
export default function PlatformUniverse() {
  const { status, data } = useSupportedSources();
  const reducedMotion = usePrefersReducedMotion();
  const [selected, setSelected] = useState(null);
  const [mounted, setMounted] = useState(false);
  const hostRef = useRef(null);

  // Resolved once, during the first render, so the canvas never has to mount
  // and then be torn down on a device without WebGL.
  const webgl = useMemo(() => hasWebGL(), []);

  const platforms = useMemo(() => data?.platforms ?? [], [data]);
  const ready = status === 'ready' && platforms.length > 0;

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMounted(true);
          observer.disconnect();
        }
      },
      // Two viewports ahead: the scene is always finished before it is read.
      { rootMargin: '120% 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const handleSelect = useCallback((platform) => {
    setSelected((current) => (current === platform ? null : platform));
  }, []);

  const showScene = ready && webgl && mounted;

  return (
    <motion.div
      className="universe"
      ref={hostRef}
      initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.15 }}
      transition={SPRING_SOFT}
    >
      {showScene ? (
        <ErrorBoundary fallback={<SceneFallback count={platforms.length} />}>
          <Canvas
            className="universe__canvas"
            shadows
            dpr={[1, 1.75]}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            onCreated={({ gl }) => gl.setClearAlpha(0)}
            camera={{ position: [0, 0.2, 19.6], fov: 38, near: 0.1, far: 90 }}
          >
            <Suspense fallback={null}>
              <PlatformScene
                platforms={platforms}
                visibleCount={platforms.length}
                reducedMotion={reducedMotion}
                onSelect={handleSelect}
                selected={selected}
              />
            </Suspense>
          </Canvas>
        </ErrorBoundary>
      ) : (
        <SceneFallback count={platforms.length || 16} />
      )}

      {/* Keyboard/assistive status only — no panel, no background, no button. */}
      <p className="universe__status" role="status">
        {selected ? (
          <>
            <span className="quickaccess__dot" aria-hidden="true" />
            {selected} selected — platform filtering coming next.
          </>
        ) : (
          'Hover a platform to bring it forward · click to select'
        )}
      </p>
    </motion.div>
  );
}
