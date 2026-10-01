import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * The atmospheric colour field.
 *
 * A single full-screen plane with a procedural gradient: cyan / electric blue
 * on the left, lavender / violet / purple through the centre, pink / magenta /
 * coral centre-right, orange / amber on the right. The bands drift extremely
 * slowly and never re-seed.
 */

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Full-screen quad, pinned just behind the camera.
    gl_Position = vec4(position.xy, 0.999, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uAspect;
  uniform float uIntensity;

  varying vec2 vUv;

  vec3 ramp(float t) {
    vec3 c0 = vec3(0.145, 0.741, 0.961);  // cyan
    vec3 c1 = vec3(0.204, 0.514, 0.965);  // electric blue
    vec3 c2 = vec3(0.541, 0.541, 0.937);  // lavender
    vec3 c3 = vec3(0.702, 0.329, 0.929);  // violet
    vec3 c4 = vec3(0.949, 0.263, 0.600);  // magenta
    vec3 c5 = vec3(0.996, 0.443, 0.302);  // coral
    vec3 c6 = vec3(0.988, 0.729, 0.180);  // amber

    vec3 col = mix(c0, c1, smoothstep(0.00, 0.17, t));
    col = mix(col, c2, smoothstep(0.17, 0.36, t));
    col = mix(col, c3, smoothstep(0.36, 0.52, t));
    col = mix(col, c4, smoothstep(0.52, 0.68, t));
    col = mix(col, c5, smoothstep(0.68, 0.84, t));
    col = mix(col, c6, smoothstep(0.84, 1.00, t));
    return col;
  }

  void main() {
    vec2 p = vUv;

    // Two independent slow cycles warp the ramp horizontally and vertically,
    // so the colour regions drift and breathe instead of sitting still. Slow
    // enough to stay cinematic, fast enough to be visibly alive.
    float drift = sin(uTime * 0.09) * 0.075 + cos(uTime * 0.061) * 0.045;
    float lift = sin(uTime * 0.047 + 1.7) * 0.055;

    // A gentle domain warp: the bands are never perfectly straight.
    float warp = sin(p.y * 2.4 + uTime * 0.12) * 0.05 + sin(p.y * 5.1 - uTime * 0.08) * 0.022;

    float t = clamp(p.x * 0.9 + (p.y - 0.5) * 0.2 + drift + warp + 0.06, 0.0, 1.0);

    vec3 col = ramp(t);

    // Soft large-scale banding, like the reference's sweeping structures.
    float band = sin(p.y * 3.1 + uTime * 0.09 + t * 5.0) * 0.5 + 0.5;
    col *= 0.86 + 0.26 * band;

    // Broad light pools keep the field from looking flat, and they wander too.
    vec2 pa = vec2(0.22 + drift * 1.4, 0.78 + lift);
    vec2 pb = vec2(0.78 - lift, 0.2 + drift * 0.6);
    float pool = exp(-dot((p - pa) * vec2(1.4, 1.1), (p - pa) * vec2(1.4, 1.1)) * 2.4);
    col += vec3(0.05, 0.09, 0.12) * pool;
    float pool2 = exp(-dot((p - pb) * vec2(1.2, 1.3), (p - pb) * vec2(1.2, 1.3)) * 2.0);
    col += vec3(0.12, 0.06, 0.0) * pool2;

    // Vignette so the edges settle for the UI.
    vec2 d = (p - 0.5) * vec2(uAspect, 1.0);
    col *= 1.0 - 0.34 * smoothstep(0.35, 1.05, length(d));

    gl_FragColor = vec4(col * uIntensity, 1.0);
  }
`;

export default function GradientField({ reducedMotion = false, intensity = 1 }) {
  const material = useRef(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAspect: { value: 1.78 },
      uIntensity: { value: intensity },
    }),
    [intensity],
  );

  useFrame((state, delta) => {
    if (material.current && !reducedMotion) material.current.uniforms.uTime.value += delta;
  });

  return (
    <mesh frustumCulled={false} renderOrder={0}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
