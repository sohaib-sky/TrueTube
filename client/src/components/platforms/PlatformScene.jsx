import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import PlatformCard from './PlatformCard.jsx';

const COLUMNS = 4;
const GAP_X = 2.72;
const GAP_Y = 1.98;
/** Real Z layers: the back rows sit further from the camera. */
const ROW_Z = [1.15, 0.7, 0.25, -0.2, -0.65, -1.1];
const ROW_TILT = [0.045, 0.035, 0.02, 0, -0.025, -0.05];

/**
 * Places the platforms in a 4-column grid that still occupies real 3D space:
 * each row has its own Z and a slight tilt, so the collection reads as a
 * floating universe rather than a flat wall.
 *
 * +Y is up in the scene, so the first row (index 0) is given the highest Y to
 * keep the reference's reading order from top-left to bottom-right.
 */
function useLayout(platforms, visibleCount) {
  return useMemo(() => {
    const columns = COLUMNS;
    const rows = Math.ceil(visibleCount / columns) || 1;

    return platforms.slice(0, visibleCount).map((entry, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = (col - (columns - 1) / 2) * GAP_X;
      const y = ((rows - 1) / 2 - row) * GAP_Y;
      const z = ROW_Z[row] ?? -1.4;
      return {
        platform: entry.platform,
        position: [x, y, z],
        rotation: [ROW_TILT[row] ?? 0, 0, 0],
        floatSeed: index * 0.7,
        introIndex: index,
      };
    });
  }, [platforms, visibleCount]);
}

/** The whole collection drifts through 3D space around a central axis. */
function Universe({ platforms, visibleCount, reducedMotion, onSelect, selected }) {
  const group = useRef(null);
  const items = useLayout(platforms, visibleCount);

  useFrame((state) => {
    const g = group.current;
    if (!g || reducedMotion) return;
    const t = state.clock.elapsedTime;
    // 36s per sweep — slow, continuous, cinematic.
    g.rotation.y = Math.sin((t / 36) * Math.PI * 2) * 0.14;
    g.position.x = Math.sin((t / 46) * Math.PI * 2) * 0.16;
    g.position.y = Math.cos((t / 40) * Math.PI * 2) * 0.1;
  });

  return (
    <group ref={group} position={[0, 0.2, 0]}>
      {items.map((item) => (
        <PlatformCard
          key={item.platform}
          platform={item.platform}
          position={item.position}
          rotation={item.rotation}
          floatSeed={item.floatSeed}
          introIndex={item.introIndex}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
          selected={selected === item.platform}
        />
      ))}
    </group>
  );
}

/** Bounding box of the full grid, with a small breathing margin. */
const GRID_WIDTH = (COLUMNS - 1) * GAP_X + 2.9;
const GRID_HEIGHT = 6 * GAP_Y + 1.3;

/**
 * Camera rig: it frames the whole grid, then drifts and parallaxes.
 *
 * The distance is solved from the grid bounds and the current aspect ratio
 * rather than hard-coded, so a narrow phone viewport pulls the camera back
 * instead of cropping the outer columns off.
 */
function CameraRig({ reducedMotion }) {
  const { camera, pointer, size } = useThree();
  const target = useRef({ x: 0, y: 0 });
  const distance = useRef(0);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const idle = reducedMotion ? 0 : 1;

    // Solve the distance that fits the grid in both axes.
    const vFov = (camera.fov * Math.PI) / 180;
    const tan = Math.tan(vFov / 2);
    const aspect = size.width / size.height;
    const needed = Math.max(
      GRID_HEIGHT / 2 / tan,
      GRID_WIDTH / 2 / (tan * aspect),
    ) * 1.04;

    // Only ever pull back, so the frame never breathes in and out.
    distance.current = Math.max(distance.current, needed);
    camera.position.z = distance.current;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    // Pointer parallax, capped to a few degrees of movement.
    target.current.x = THREE.MathUtils.lerp(target.current.x, pointer.x * 0.55, Math.min(1, delta * 2.4));
    target.current.y = THREE.MathUtils.lerp(target.current.y, pointer.y * 0.34, Math.min(1, delta * 2.4));

    const driftX = idle * Math.sin(t * 0.14) * 0.5;
    const driftY = idle * Math.cos(t * 0.11) * 0.22;

    camera.position.x += (target.current.x + driftX - camera.position.x) * Math.min(1, delta * 1.6);
    camera.position.y += (target.current.y + driftY - 0.25 - camera.position.y) * Math.min(1, delta * 1.6);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/** Faint atmospheric dust. Shader-based, so it needs no assets. */
function Atmosphere({ reducedMotion }) {
  return (
    <Sparkles
      count={reducedMotion ? 12 : 46}
      scale={[16, 10, 8]}
      size={1.6}
      speed={reducedMotion ? 0 : 0.18}
      opacity={0.28}
      color="#7dd3fc"
    />
  );
}

/**
 * Only mount the 3D scene once it is close to being read.
 *
 * The section is the heaviest thing on the page, so it is deferred until the
 * reader is within two viewports of it. `rootMargin` does the measuring, not
 * scroll position polling, and the fallback grid holds the space meanwhile.
 */
function useNearViewport(ref, { rootMargin = '600px 0px' } = {}) {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || near) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [near, ref, rootMargin]);

  return near;
}

export default function PlatformScene({
  platforms,
  visibleCount,
  reducedMotion,
  onSelect,
  selected,
}) {
  return (
    <>
      {/* No scene background and no fog: the cards float directly over the
          site's own animated world, with no dark panel between them. */}

      {/* Lighting rig: cool key, warm-ish rim, coloured accents. */}
      <ambientLight intensity={0.55} color="#93b4d8" />
      <directionalLight
        position={[6, 8, 9]}
        intensity={2.1}
        color="#e8f4ff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0012}
      />
      <directionalLight position={[-8, -3, -6]} intensity={0.7} color="#7c5cff" />
      <pointLight position={[0, 0, 6]} intensity={38} distance={22} color="#2dd4bf" />
      <pointLight position={[-7, 4, -4]} intensity={22} distance={20} color="#38bdf8" />

      <CameraRig reducedMotion={reducedMotion} />
      <Atmosphere reducedMotion={reducedMotion} />

      <Universe
        platforms={platforms}
        visibleCount={visibleCount}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
        selected={selected}
      />
    </>
  );
}
