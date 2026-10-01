import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const MAX_INSTANCES = 26000;

/**
 * The generative mark field.
 *
 * Every mark is a real instance in a single draw call. Position, travel,
 * orientation, scale, opacity and shape are all resolved on the GPU from a
 * smooth flow field, so the lattice bends into curved wave formations instead
 * of drifting randomly.
 */

const VERTEX = /* glsl */ `
  attribute vec3 aOffset;   // x, y in field space + depth layer (-1 far … 1 near)
  attribute float aPhase;   // per-instance phase, keeps the motion organic
  attribute float aKind;    // 0 dash · 1 bar · 2 diagonal · 3 plus · 4 dot
  attribute float aScale;
  attribute float aAlpha;

  uniform float uTime;
  uniform float uAspect;

  varying vec2 vUv;
  varying float vKind;
  varying float vAlpha;

  mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }

  // Smooth, layered flow field. Large zones create the sweeping curls; the
  // travelling sines give the field its slow evolution over time.
  float fieldAngle(vec2 p, float t) {
    // A base sweep across x: diagonal strokes on the left, bars in the middle,
    // plus/dot clusters on the right — the reference's reading order.
    float sweep = mix(-1.05, 0.62, smoothstep(-1.15, 1.15, p.x));
    float a = sweep;
    a += sin(p.x * 2.25 + t * 0.42) * 0.6;
    a += cos(p.y * 1.85 - t * 0.34) * 0.5;
    a += sin((p.x + p.y * 0.7) * 1.55 + t * 0.28) * 0.44;

    // Three large curl zones, each breathing on its own slow cycle. This is
    // what makes the field read as moving water rather than a fixed texture.
    vec2 d0 = p - vec2(-0.82, 0.34);
    vec2 d1 = p - vec2(0.78, -0.24);
    vec2 d2 = p - vec2(0.18, 0.92);
    a += exp(-dot(d0, d0) * 1.7) * 1.05 * sin(t * 0.31);
    a += exp(-dot(d1, d1) * 1.9) * -0.95 * cos(t * 0.27);
    a += exp(-dot(d2, d2) * 2.4) * 0.65 * sin(t * 0.36);
    return a;
  }

  void main() {
    float t = uTime;
    vec3 pos = aOffset;
    float ang = fieldAngle(pos.xy, t);
    vec2 dir = vec2(cos(ang), sin(ang));

    // Continuous travel along the local flow vector. A smooth periodic
    // function, not a wrapping one: the mark never jumps or teleports, it
    // slides along a curved path and eases back. The per-instance phase keeps
    // the motion organic rather than synchronised.
    float adv = sin((aPhase + t * 0.05) * 6.2831);
    pos.xy += dir * adv * 0.26;

    // A second, slower sway at a different rate, so paths are curved and the
    // marks never travel in lockstep.
    float travel = sin(t * 0.62 + aPhase * 6.2831) * 0.075;
    pos.xy += dir * travel;

    // Two travelling waves bend the lattice into large sweeping structures.
    pos.x += 0.075 * sin(pos.y * 2.6 + t * 0.62 + aPhase * 0.7);
    pos.y += 0.075 * sin(pos.x * 2.1 - t * 0.5);
    pos.xy *= 1.0 + 0.06 * sin(t * 0.22);

    float depth = aOffset.z;                      // -1 far … 1 near
    pos.z += sin(t * 0.3 + aPhase) * 0.07 * depth;

    // Perspective does the rest: near marks are physically larger. The mark
    // budget is deliberately modest (a few thousand), so each mark has to be
    // large enough for the field to still read as dense.
    float size = aScale * (0.017 + depth * 0.0085) * (1.0 + 0.18 * sin(t * 0.9 + aPhase));

    vec2 corner = position.xy * size;
    vec2 offset = rot(ang) * corner;
    vec3 world = vec3(pos.x * uAspect, pos.y, pos.z) + vec3(offset, 0.0);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);

    vUv = uv;
    vKind = aKind;
    // Depth drives opacity, and a slow per-instance shimmer keeps dense areas
    // breathing instead of looking like a frozen texture. The floor is high
    // enough that even far-layer marks stay legible over the vivid gradient.
    float shimmer = 0.88 + 0.12 * sin(t * 1.1 + aPhase * 9.0);
    vAlpha = aAlpha * (0.68 + 0.32 * (depth * 0.5 + 0.5)) * shimmer;
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 uColor;
  uniform float uOpacity;

  varying vec2 vUv;
  varying float vKind;
  varying float vAlpha;

  void main() {
    vec2 p = vUv - 0.5;
    float arm = 0.34;
    float th = 0.115;
    float m = 0.0;

    if (vKind < 0.5) {
      m = step(abs(p.y), th) * step(abs(p.x), arm);            // dash
    } else if (vKind < 1.5) {
      m = step(abs(p.x), th) * step(abs(p.y), arm);            // bar
    } else if (vKind < 2.5) {
      float d = abs(p.x - p.y) * 0.7071;                        // diagonal
      m = step(d, th) * step(abs((p.x + p.y) * 0.7071), arm);
    } else if (vKind < 3.5) {
      float h = step(abs(p.y), th) * step(abs(p.x), arm);       // plus
      float v = step(abs(p.x), th) * step(abs(p.y), arm);
      m = max(h, v);
    } else {
      m = step(length(p), 0.15);                               // dot
    }

    if (m < 0.5) discard;
    gl_FragColor = vec4(uColor, vAlpha * uOpacity);
  }
`;

/** Low-frequency density so the field is never uniform. */
function density(x, y) {
  const wave = Math.sin(x * 1.7 + 0.6) * 0.5 + Math.cos(y * 2.1 - 0.4) * 0.5;
  const band = Math.sin((x * 0.9 + y * 1.4) * 1.3);
  return Math.min(1, 0.42 + 0.34 * (wave * 0.5 + 0.5) + 0.3 * (band * 0.5 + 0.5));
}

export default function MarkField({ count = 9000, reducedMotion = false, color = '#ffffff' }) {
  const material = useRef(null);
  const { viewport } = useThree();

  const { geometry, uniforms } = useMemo(() => {
    const base = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = base.index;
    geometry.setAttribute('position', base.attributes.position);
    geometry.setAttribute('uv', base.attributes.uv);

    const offsets = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const kinds = new Float32Array(count);
    const scales = new Float32Array(count);
    const alphas = new Float32Array(count);

    const cols = Math.ceil(Math.sqrt(count * 1.7));
    const rows = Math.ceil(count / cols);
    const aspect = 1.78;

    let written = 0;
    for (let row = 0; row < rows && written < count; row += 1) {
      for (let col = 0; col < cols && written < count; col += 1) {
        const x = ((col + 0.5) / cols) * 2 - 1;
        const y = ((row + 0.5) / rows) * 2 - 1;

        // Density shaping: skip marks in sparse regions.
        if (density(x, y) < ((row * 31 + col * 17) % 100) / 190) continue;

        const layerSeed = ((row * 7 + col * 13) % 100) / 100;
        const depth = layerSeed < 0.55 ? -1 : layerSeed < 0.9 ? 0 : 1;

        offsets[written * 3] = x * aspect;
        offsets[written * 3 + 1] = y;
        offsets[written * 3 + 2] = depth * 0.62;
        phases[written] = ((row * 13 + col * 29) % 97) / 97;
        scales[written] = 0.72 + (((row * 5 + col * 11) % 100) / 100) * 0.85;

        // Shape follows the horizontal region, like the reference: diagonal
        // strokes on the left, bars in the middle, plus/dots on the right.
        const t = (x + 1) / 2;
        const pick = ((row * 3 + col * 19) % 100) / 100;
        if (t < 0.34) kinds[written] = pick < 0.62 ? 0 : 2;
        else if (t < 0.66) kinds[written] = pick < 0.55 ? 1 : 0;
        else kinds[written] = pick < 0.42 ? 3 : pick < 0.78 ? 0 : 4;

        alphas[written] = 0.55 + (((row * 11 + col * 23) % 100) / 100) * 0.45;
        written += 1;
      }
    }

    geometry.instanceCount = written;
    geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    geometry.setAttribute('aKind', new THREE.InstancedBufferAttribute(kinds, 1));
    geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));
    geometry.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(alphas, 1));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);

    const uniforms = {
      uTime: { value: 0 },
      uAspect: { value: 1.78 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 1 },
    };

    return { geometry, uniforms };
  }, [count, color]);

  useFrame((state, delta) => {
    const mat = material.current;
    if (!mat) return;
    // Reduced motion: the field still breathes, but only barely.
    if (!reducedMotion) mat.uniforms.uTime.value += delta;
    mat.uniforms.uAspect.value = viewport.aspect || 1.78;
  });

  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={2}>
      <shaderMaterial
        ref={material}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

export { MAX_INSTANCES };
