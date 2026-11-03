'use client';

/* A snowy fir tree for a quiet year: shown only when the API returns no 2026
   item at all (no certification, stamp or Agentblazer rank), so the globe
   still has a centerpiece. It sways when the globe is shaken, the snow on its
   branches slides off, then slowly builds up again. The star on top is in
   the rank's ring metal. */

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { getRankMetals } from './rankMetals';

const TIERS = [
  // [bottom y, height, radius] of each cone, from the bottom up
  [0.18, 0.62, 0.52],
  [0.48, 0.55, 0.42],
  [0.76, 0.48, 0.32],
  [1.02, 0.42, 0.22],
];
const TOP_Y = 1.44;

/* A cone with a ragged hem and slightly uneven sides, so it reads as
   branches rather than a party hat */
function makeTierGeometry(height, radius, seed) {
  const geo = new THREE.ConeGeometry(radius, height, 14, 3, true);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const angle = Math.atan2(z, x);
    const t = (height / 2 - y) / height; // 0 at the tip, 1 at the hem
    const ragged = 1 + 0.12 * Math.sin(angle * 7 + seed) * t + 0.06 * Math.sin(angle * 13 - seed * 2) * t;
    pos.setX(i, x * ragged);
    pos.setZ(i, z * ragged);
    // the hem droops between branch tips
    if (t > 0.95) pos.setY(i, y - 0.05 * (1 + Math.sin(angle * 7 + seed)));
  }
  geo.computeVertexNormals();
  return geo;
}

/* Snow lying on a tier: a thinner, lighter shell over its upper part */
function makeSnowCapGeometry(height, radius, seed) {
  const geo = new THREE.ConeGeometry(radius * 0.86, height * 0.62, 14, 2, true);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const angle = Math.atan2(z, x);
    const lumpy = 1 + 0.1 * Math.sin(angle * 5 + seed * 3);
    pos.setX(i, x * lumpy);
    pos.setZ(i, z * lumpy);
  }
  geo.computeVertexNormals();
  return geo;
}

function makeStarGeometry() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.045 : 0.11;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i) shape.lineTo(x, y);
    else shape.moveTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.035,
    bevelEnabled: true,
    bevelSize: 0.01,
    bevelThickness: 0.01,
  });
  geo.center();
  return geo;
}

function FirTree({ world, floor, rankTitle, position = [-0.7, -0.25] }) {
  const swayRef = useRef();
  const capsRef = useRef([]);
  const state = useRef({ angleX: 0, angleZ: 0, velX: 0, velZ: 0, snow: 1 });

  const tiers = useMemo(
    () =>
      TIERS.map(([y, h, r], i) => ({
        y: y + h / 2,
        capY: y + h * 0.69,
        tier: makeTierGeometry(h, r, i * 1.7),
        cap: makeSnowCapGeometry(h, r, i * 1.7),
      })),
    []
  );
  const star = useMemo(() => makeStarGeometry(), []);
  useEffect(
    () => () => {
      tiers.forEach((t) => {
        t.tier.dispose();
        t.cap.dispose();
      });
      star.dispose();
    },
    [tiers, star]
  );
  const metal = useMemo(() => getRankMetals(rankTitle)[0], [rankTitle]);

  const [x, z] = position;
  const baseY = floor.surfaceY(x, z) - 0.12; // planted a little into the snow

  useFrame(({ clock }, dt) => {
    const w = world.current;
    const s = state.current;
    const d = Math.min(dt, 0.05);
    // the globe's sideways jolts (WobbleGroup) push the top the other way;
    // a spring brings it back with a few damped swings
    const push = w.lastImpulse || 0;
    s.velZ += (push * 9 - s.angleZ * 38) * d - s.velZ * 3.2 * d;
    s.angleZ += s.velZ * d;
    s.velX += -s.angleX * 38 * d - s.velX * 3.2 * d;
    s.angleX += s.velX * d;
    // hard jolts knock the snow off the branches; it builds up again slowly
    if (Math.abs(push) > 0.25) s.snow = Math.max(0, s.snow - Math.abs(push) * d * 6);
    else s.snow = Math.min(1, s.snow + d * 0.06);
    if (swayRef.current) {
      swayRef.current.rotation.z = THREE.MathUtils.clamp(s.angleZ, -0.25, 0.25);
      // a faint breathing so the tree never looks frozen in place
      swayRef.current.rotation.x = s.angleX + Math.sin(clock.elapsedTime * 0.7) * 0.006;
    }
    capsRef.current.forEach((cap) => {
      if (!cap) return;
      cap.visible = s.snow > 0.03;
      cap.scale.set(0.9 + 0.1 * s.snow, 0.35 + 0.65 * s.snow, 0.9 + 0.1 * s.snow);
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
          <group key={i}>
            <mesh position={[0, t.y, 0]} geometry={t.tier}>
              <meshStandardMaterial color='#24533a' roughness={0.85} flatShading side={THREE.DoubleSide} />
            </mesh>
            <mesh ref={(el) => (capsRef.current[i] = el)} position={[0, t.capY, 0]} geometry={t.cap}>
              <meshStandardMaterial color='#f4f8ff' roughness={0.75} flatShading side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, TOP_Y, 0]} geometry={star}>
          <meshStandardMaterial
            color={metal.color}
            metalness={0.6}
            roughness={0.3}
            emissive={metal.color}
            emissiveIntensity={0.35}
          />
        </mesh>
      </group>
    </group>
  );
}

export { FirTree };
