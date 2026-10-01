import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import GradientField from './GradientField.jsx';
import MarkField from './MarkField.jsx';

/**
 * Device-aware quality. Counts sit inside the budget the design calls for:
 * thousands of marks on desktop, a couple of thousand on a tablet, a light
 * field on a phone. Nothing here creates DOM nodes — every mark is one
 * instance in a single GPU draw call.
 */
function detectQuality() {
  if (typeof window === 'undefined') return 'medium';
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const width = window.innerWidth;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;

  if (width < 700 || cores <= 4 || memory <= 2) return 'low';
  if (width < 1200 || cores <= 8 || coarse) return 'medium';
  return 'high';
}

const PROFILE = {
  high: { marks: 6000, dpr: 2, gradient: 1.16, marksOpacity: 1 },
  medium: { marks: 3200, dpr: 1.75, gradient: 1.12, marksOpacity: 0.97 },
  low: { marks: 1400, dpr: 1.5, gradient: 1.06, marksOpacity: 0.92 },
};

/**
 * Camera rig — a real perspective camera with restrained parallax.
 * Mouse and scroll only nudge it; the composition never swings.
 */
function CameraRig({ reducedMotion }) {
  const { camera, pointer, size } = useThree();
  const target = useRef({ x: 0, y: 0, z: 2 });
  const scroll = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      scroll.current = window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    const k = Math.min(1, delta * 1.6);
    const depth = scroll.current;

    target.current.x = pointer.x * 0.16;
    target.current.y = -pointer.y * 0.11 + depth * 0.1;
    target.current.z = 2 - depth * 0.22;

    camera.position.x += (target.current.x - camera.position.x) * k;
    camera.position.y += (target.current.y - camera.position.y) * k;
    camera.position.z += (target.current.z - camera.position.z) * k;
    camera.lookAt(0, 0, 0);
    camera.fov = 55;
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
  });

  return null;
}

export default function WorldBackground({ reducedMotion = false }) {
  const [quality, setQuality] = useState('high');
  const profile = useMemo(() => PROFILE[quality], [quality]);

  useEffect(() => {
    setQuality(detectQuality());
  }, []);

  return (
    <div className="bg" aria-hidden="true">
      {/* CSS atmosphere is always present, so a WebGL failure degrades to a
          still gradient instead of a blank screen. */}
      <div className="bg__fallback" />
      <Canvas
        className="bg__canvas"
        dpr={[1, profile.dpr]}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 2], fov: 55, near: 0.1, far: 40 }}
      >
        <CameraRig reducedMotion={reducedMotion} />
        <GradientField reducedMotion={reducedMotion} intensity={profile.gradient} />
        <MarkField
          count={profile.marks}
          reducedMotion={reducedMotion}
          color="#ffffff"
        />
      </Canvas>
      <div className="bg__scrim" />
    </div>
  );
}

export { PROFILE };
