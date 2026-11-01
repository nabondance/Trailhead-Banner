'use client';

import * as THREE from 'three';
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

/* Northern lights inside the glass, drawn from the user's year: a curtain
   behind the badges running January (left) to December (right), each month
   glowing as bright and tall as that month's achievements. Certification
   months lean gold, stamp months cyan, both fading to violet at the top.
   No achievements in the year: no aurora. */

const AURORA_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const AURORA_FRAGMENT = /* glsl */ `
  uniform sampler2D uMonths;
  uniform float uTime;
  varying vec2 vUv;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  float noise(float x) {
    float i = floor(x);
    return mix(hash(i), hash(i + 1.0), smoothstep(0.0, 1.0, fract(x)));
  }
  void main() {
    float u = 1.0 - vUv.x; // the cylinder runs right to left: January on the left
    vec4 month = texture2D(uMonths, vec2(u, 0.5));
    float level = month.r;
    float certShare = month.g;
    // the curtain sways slowly
    float v = vUv.y + 0.05 * sin(u * 9.0 + uTime * 0.5) + 0.025 * sin(u * 23.0 - uTime * 0.8);
    float top = 0.3 + 0.7 * level;
    float body = smoothstep(0.0, 0.15, v) * (1.0 - smoothstep(top - 0.3, top, v));
    // fine vertical rays drifting sideways
    float rays = (0.55 + 0.45 * noise(u * 95.0 + uTime * 0.35)) * (0.7 + 0.3 * noise(u * 29.0 - uTime * 0.2));
    float sides = smoothstep(0.0, 0.07, vUv.x) * (1.0 - smoothstep(0.93, 1.0, vUv.x));
    float alpha = body * rays * level * sides * 0.75;
    vec3 low = mix(vec3(0.35, 0.8, 1.0), vec3(1.0, 0.82, 0.4), certShare);
    vec3 color = mix(low, vec3(0.58, 0.44, 1.0), smoothstep(0.1, top, v));
    gl_FragColor = vec4(color, alpha);
  }
`;

/* Per-month level (0..1) and certification share, packed in a 12×1 texture
   so the shader gets smooth interpolation between months for free */
function makeMonthsTexture(activity) {
  const certs = activity?.certifications || [];
  const stamps = activity?.stamps || [];
  const totals = Array.from({ length: 12 }, (_, i) => (certs[i] || 0) + (stamps[i] || 0));
  // relative to the busiest month, but a lone achievement never fills the sky
  const scale = Math.max(...totals, 3);
  const data = new Uint8Array(12 * 4);
  totals.forEach((total, i) => {
    data[i * 4] = Math.round(Math.min(1, total / scale) ** 0.6 * 255);
    data[i * 4 + 1] = total ? Math.round(((certs[i] || 0) / total) * 255) : 0;
    data[i * 4 + 3] = 255;
  });
  const tex = new THREE.DataTexture(data, 12, 1, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return { tex, active: totals.some(Boolean) };
}

function Aurora({ activity }) {
  const { tex, active } = useMemo(() => makeMonthsTexture(activity), [activity]);
  const uniforms = useMemo(() => ({ uMonths: { value: tex }, uTime: { value: 0 } }), [tex]);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
  });
  if (!active) return null;
  // a wide arc behind the center of the globe, in the upper glass
  const arc = 2.3;
  return (
    <mesh position={[0, 0.55, 0]} renderOrder={-1}>
      <cylinderGeometry args={[1.45, 1.45, 1.5, 96, 1, true, Math.PI - arc / 2, arc]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={AURORA_VERTEX}
        fragmentShader={AURORA_FRAGMENT}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

export { Aurora, makeMonthsTexture };
