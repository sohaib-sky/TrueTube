import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { useCardTexture } from './useCardTexture.js';
import { platformColors } from '../../utils/platformColors.js';

const CARD = { width: 2.4, height: 1.8, depth: 0.26, radius: 0.26 };

/**
 * One platform as a real 3D object: a rounded, thick body plus a textured
 * front plate. Hover lifts it toward the camera, brightens the rim and rotates
 * it slightly toward the pointer. All motion is interpolated in useFrame, so
 * React never re-renders during interaction.
 */
export default function PlatformCard({
  platform,
  position,
  rotation = [0, 0, 0],
  floatSeed = 0,
  introIndex = 0,
  reducedMotion,
  onSelect,
  selected,
}) {
  const group = useRef(null);
  const face = useRef(null);
  const [hovered, setHovered] = useState(false);
  const texture = useCardTexture(platform, 0);
  const { base, deep, light } = platformColors(platform);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;

    const t = state.clock.elapsedTime;
    const idle = reducedMotion ? 0 : 1;

    // Entrance: the collection assembles itself, card by card, instead of
    // snapping into place the moment the scene mounts. Each card holds back by
    // its index, then rises and scales up on an ease-out curve.
    const delay = introIndex * 0.055;
    const raw = reducedMotion ? 1 : Math.min(1, Math.max(0, (t - delay) / 1.05));
    const intro = 1 - (1 - raw) * (1 - raw) * (1 - raw);

    // Target transform: hover pushes the card forward and toward the pointer.
    const targetZ = hovered ? 0.9 : 0;
    const targetScale = (hovered ? 1.09 : 1) * (0.72 + 0.28 * intro);

    g.position.z += (position[2] + targetZ - g.position.z) * Math.min(1, delta * 6);
    const scale = g.scale.x + (targetScale - g.scale.x) * Math.min(1, delta * 6);
    g.scale.setScalar(scale);

    // Gentle float so the universe feels alive, never bouncing.
    g.position.y = position[1] + (1 - intro) * 0.85 + (idle ? Math.sin(t * 0.55 + floatSeed) * 0.08 : 0);
    g.position.x = position[0] + (1 - intro) * 0.12;

    // Slow independent sway.
    g.rotation.y += (rotation[1] + (idle ? Math.sin(t * 0.32 + floatSeed) * 0.12 : 0) - g.rotation.y) * Math.min(1, delta * 3);
    g.rotation.x += (rotation[0] - g.rotation.x) * Math.min(1, delta * 3);
    g.rotation.z += (rotation[2] + (idle ? Math.sin(t * 0.27 + floatSeed * 1.7) * 0.045 : 0) - g.rotation.z) * Math.min(1, delta * 3);

    if (g.userData.body) {
      const target = hovered || selected ? 0.55 : 0.16;
      g.userData.body.emissiveIntensity += (target - g.userData.body.emissiveIntensity) * Math.min(1, delta * 6);
    }

    // The name plate fades in with the card, so the grid reads as assembling.
    if (face.current) face.current.opacity = intro;
  });

  return (
    <group
      ref={group}
      position={position}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = '';
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(platform);
      }}
    >
      {/* Body: real thickness with rounded edges, catching the scene lights. */}
      <RoundedBox
        args={[CARD.width, CARD.height, CARD.depth]}
        radius={CARD.radius}
        smoothness={5}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          ref={(material) => {
            if (group.current && material) group.current.userData.body = material;
          }}
          color={base}
          emissive={light}
          emissiveIntensity={0.16}
          roughness={0.24}
          metalness={0.12}
          clearcoat={0.7}
          clearcoatRoughness={0.25}
        />
      </RoundedBox>

      {/* Front face: the name lives here as a real texture on a real plane. */}
      <mesh position={[0, 0, CARD.depth / 2 + 0.002]}>
        <planeGeometry args={[CARD.width - 0.16, CARD.height - 0.16]} />
        <meshStandardMaterial
          ref={face}
          map={texture}
          emissiveMap={texture}
          emissive="#ffffff"
          emissiveIntensity={hovered || selected ? 0.32 : 0.1}
          roughness={0.32}
          metalness={0.02}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Rim light along the top edge — reads as a physical bevel. */}
      <mesh position={[0, CARD.height / 2 + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[CARD.width - 0.5, 0.1]} />
        <meshBasicMaterial color={light} transparent opacity={hovered || selected ? 0.95 : 0.55} />
      </mesh>
    </group>
  );
}
