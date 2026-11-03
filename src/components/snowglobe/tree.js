'use client';

/* A fir tree for a quiet year: shown only when the API returns no 2026 item
   at all (no certification, stamp or Agentblazer rank), so the globe still
   has a centerpiece. It bends and swings when the globe is shaken, the top
   more than the foot. The star on top is in the rank's ring metal. */

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { getRankMetals } from './rankMetals';
import { useRingEnvMap } from './scenery';

const TIERS = [
  // [bottom y, height, radius] of each cone, from the bottom up
  [0.18, 0.62, 0.52],
  [0.48, 0.55, 0.42],
  [0.76, 0.48, 0.32],
  [1.02, 0.42, 0.22],
];
const TOP_Y = 1.44;

const GREEN = new THREE.Color('#24533a');
const GREEN_DARK = new THREE.Color('#1b4430');
const BRANCHES = 7; // branch tips around each tier

const hash = (n) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/* A cone with a ragged hem and slightly uneven sides, so it reads as
   branches rather than a party hat. Non-indexed so every facet gets its own
   shade of green, like light catching separate branches. */
function makeTierGeometry(height, radius, seed) {
  const cone = new THREE.ConeGeometry(radius, height, 28, 5, true);
  const pos = cone.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const angle = Math.atan2(z, x);
    const t = (height / 2 - y) / height; // 0 at the tip, 1 at the hem
    const ragged = 1 + 0.12 * Math.sin(angle * BRANCHES + seed) * t + 0.06 * Math.sin(angle * 13 - seed * 2) * t;
    pos.setX(i, x * ragged);
    pos.setZ(i, z * ragged);
    // the hem droops between branch tips
    if (t > 0.95) pos.setY(i, y - 0.05 * (1 + Math.sin(angle * BRANCHES + seed)));
  }
  const geo = cone.toNonIndexed();
  cone.dispose();
  geo.computeVertexNormals();
  const p = geo.attributes.position;
  const faces = p.count / 3;
  const colors = new Float32Array(p.count * 3);
  const shade = new THREE.Color();
  for (let f = 0; f < faces; f++) {
    shade.copy(GREEN).lerp(GREEN_DARK, hash(f * 3.1 + seed) * 0.7);
    for (let k = 0; k < 3; k++) colors.set([shade.r, shade.g, shade.b], (f * 3 + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/* A faceted 3D star, like a tree topper: five points around a raised center
   on both faces, so every facet catches the light differently as it turns */
function makeStarGeometry() {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.055 : 0.13;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    points.push([Math.cos(a) * r, Math.sin(a) * r, 0]);
  }
  const front = [0, 0, 0.05];
  const back = [0, 0, -0.05];
  const vertices = [];
  for (let i = 0; i < 10; i++) {
    const a = points[i];
    const b = points[(i + 1) % 10];
    vertices.push(...front, ...a, ...b, ...back, ...b, ...a);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.computeVertexNormals();
  return geo;
}

function FirTree({ world, floor, rankTitle, position = [-0.7, -0.25] }) {
  const swayRef = useRef();
  const tierRefs = useRef([]);
  const state = useRef({ angleX: 0, angleZ: 0, velX: 0, velZ: 0 });

  const tiers = useMemo(
    () =>
      TIERS.map(([y, h, r], i) => ({
        y: y + h / 2,
        tier: makeTierGeometry(h, r, i * 1.7),
      })),
    []
  );
  const star = useMemo(() => makeStarGeometry(), []);
  useEffect(
    () => () => {
      tiers.forEach((t) => t.tier.dispose());
      star.dispose();
    },
    [tiers, star]
  );
  const metal = useMemo(() => getRankMetals(rankTitle)[0], [rankTitle]);
  // polished metal needs something to reflect: the same room map as the ring
  const envMap = useRingEnvMap();

  const [x, z] = position;
  const baseY = floor.surfaceY(x, z) - 0.12; // planted a little into the snow

  useFrame(({ clock }, dt) => {
    const w = world.current;
    const s = state.current;
    const d = Math.min(dt, 0.05);
    // the globe's sideways jolts (WobbleGroup) push the top the other way; a
    // spring brings it back with a few swings. Small jolts (the globe
    // following a held drag step by step) are ignored, so holding the globe
    // to one side leaves the tree still and only real moves and shakes swing it.
    const raw = w.lastImpulse || 0;
    const push = Math.sign(raw) * Math.max(0, Math.abs(raw) - 0.03);
    s.velZ += (push * 85 - s.angleZ * 30) * d - s.velZ * 3.2 * d;
    s.angleZ = THREE.MathUtils.clamp(s.angleZ + s.velZ * d, -0.4, 0.4);
    s.velX += -s.angleX * 30 * d - s.velX * 2.2 * d;
    s.angleX += s.velX * d;
    if (swayRef.current) {
      swayRef.current.rotation.z = s.angleZ * 0.6;
      // a faint breathing so the tree never looks frozen in place
      swayRef.current.rotation.x = s.angleX + Math.sin(clock.elapsedTime * 0.7) * 0.006;
    }
    // the tree bends: each tier leans a little more than the one below, and
    // lags a touch, so the top whips after the trunk
    tierRefs.current.forEach((tier, i) => {
      if (!tier) return;
      const target = s.angleZ * 0.12 * (i + 1);
      tier.rotation.z += (target - tier.rotation.z) * Math.min(1, d * (14 - i * 2));
    });
  });

  return (
    <group position={[x, baseY, z]} scale={1.3}>
      {/* sway pivots at the trunk's foot */}
      <group ref={swayRef}>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.06, 0.08, 0.3, 8]} />
          <meshStandardMaterial color='#4a2e1c' roughness={0.9} />
        </mesh>
        {tiers.map((t, i) => (
          <group key={i} ref={(el) => (tierRefs.current[i] = el)}>
            <mesh position={[0, t.y, 0]} geometry={t.tier}>
              <meshStandardMaterial vertexColors roughness={0.85} flatShading side={THREE.DoubleSide} />
            </mesh>
            {/* the star sits on the top tier, fixed to it */}
            {i === TIERS.length - 1 && (
              <mesh position={[0, TOP_Y, 0]} geometry={star}>
                <meshStandardMaterial
                  color={metal.color}
                  metalness={1}
                  roughness={0.18}
                  envMap={envMap}
                  envMapIntensity={1.3}
                  flatShading
                />
              </mesh>
            )}
          </group>
        ))}
      </group>
    </group>
  );
}

export { FirTree };
