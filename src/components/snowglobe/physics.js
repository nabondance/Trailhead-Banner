'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GLOBE_RADIUS,
  GRAVITY,
  DRAG,
  BOUNCE,
  CENTER,
  MOUND_RX,
  moundSurfaceY,
  proxied,
  randomPointInGlobe,
} from './constants';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const ACHIEVEMENT_COLLISION_PASSES = 2;

/* Give every badge a loose resting destination across the mound. The targets
   do not lock items into a grid: they only add a gentle pull after landing,
   while the collision solver below keeps the visible sprite faces apart. */
function makeRestTarget(index, count) {
  const progress = Math.sqrt((index + 0.7) / Math.max(count, 1));
  const angle = index * GOLDEN_ANGLE;
  const radius = MOUND_RX * 0.68 * progress;
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius * 0.72,
  };
}

/* Sprites always face the camera, so their meaningful overlap is in screen
   space (world X/Y), even when their Z positions differ. Two relaxed passes
   are enough for the small item cap and avoid the rigid, jittery look of a
   full physics engine. */
function spreadAchievementCollisions(items) {
  for (let pass = 0; pass < ACHIEVEMENT_COLLISION_PASSES; pass++) {
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      for (let j = i + 1; j < items.length; j++) {
        const b = items[j];
        let dx = b.pos.x - a.pos.x;
        let dy = b.pos.y - a.pos.y;
        let distSq = dx * dx + dy * dy;
        const minDist = a.collisionRadius + b.collisionRadius;
        if (distSq >= minDist * minDist) continue;

        // Exact overlaps need a stable direction; using the pair indexes keeps
        // the result deterministic instead of adding per-frame random jitter.
        if (distSq < 0.000001) {
          const angle = (i * 17 + j * 31) * GOLDEN_ANGLE;
          dx = Math.cos(angle) * 0.001;
          dy = Math.sin(angle) * 0.001;
          distSq = 0.000001;
        }

        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        const invMassSum = a.invMass + b.invMass;
        const correction = overlap * 0.58;

        a.pos.x -= nx * correction * (a.invMass / invMassSum);
        a.pos.y -= ny * correction * (a.invMass / invMassSum);
        b.pos.x += nx * correction * (b.invMass / invMassSum);
        b.pos.y += ny * correction * (b.invMass / invMassSum);

        // Remove closing velocity with very low restitution. This lets badges
        // softly pile up instead of bouncing indefinitely after every shake.
        const closingSpeed = (b.vel.x - a.vel.x) * nx + (b.vel.y - a.vel.y) * ny;
        if (closingSpeed < 0) {
          const impulse = (-closingSpeed * 1.08) / invMassSum;
          a.vel.x -= nx * impulse * a.invMass;
          a.vel.y -= ny * impulse * a.invMass;
          b.vel.x += nx * impulse * b.invMass;
          b.vel.y += ny * impulse * b.invMass;
        }
      }
    }
  }
}

/* Certs and stamps tumbling inside the globe */
function Achievements({ world, achievements }) {
  const [items, setItems] = useState(null);
  const spritesRef = useRef([]);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    Promise.all(
      achievements
        .filter((a) => a.logoUrl)
        .map(
          (a) =>
            new Promise((resolve) =>
              loader.load(
                proxied(a.logoUrl, a.folder),
                (tex) => {
                  tex.colorSpace = THREE.SRGBColorSpace;
                  resolve({ ...a, tex });
                },
                undefined,
                () => resolve(null) // broken image: drop the item, keep the globe alive
              )
            )
        )
    ).then((loaded) => {
      if (cancelled) return;
      const ok = loaded.filter(Boolean);
      const sizeScale = Math.min(1, Math.sqrt(14 / Math.max(ok.length, 1)));
      const typePriority = { rank: 0, agentblazer: 1, certification: 2, stamp: 3 };
      const spreadOrder = [...ok].sort((a, b) => (typePriority[a.type] ?? 99) - (typePriority[b.type] ?? 99));
      const spreadIndex = new Map(spreadOrder.map((item, index) => [item, index]));
      const built = ok.map((a, index) => {
        const size = (a.type === 'rank' ? 0.72 : a.type === 'certification' ? 0.62 : 0.55) * sizeScale;
        const img = a.tex.image;
        const aspect = Math.min(2, Math.max(0.5, img ? img.width / img.height : 1));
        // per-type weight + per-item jitter: the rank sinks and settles first,
        // certs follow, agentblazer and stamps flutter longest — different
        // fall rates keep the pile from stacking in one clump
        const typeWeight =
          a.type === 'rank' ? 1.25 : a.type === 'certification' ? 1 : a.type === 'agentblazer' ? 0.85 : 0.7;
        const weight = typeWeight * (0.8 + Math.random() * 0.4);
        const restTarget = makeRestTarget(spreadIndex.get(a) ?? index, ok.length);
        return {
          tex: a.tex,
          pos: randomPointInGlobe(GLOBE_RADIUS * 0.7),
          vel: new THREE.Vector3(0, 0, 0),
          spin: (Math.random() - 0.5) * 2,
          size,
          aspect,
          r: size / 2,
          gravity: GRAVITY * weight,
          drag: DRAG / weight,
          kick: 1 / weight,
          invMass: 1 / weight,
          collisionRadius: Math.max(size, size * aspect) * 0.38,
          restX: restTarget.x,
          restZ: restTarget.z,
        };
      });
      world.current.items = built;
      setItems(built);
    });
    return () => {
      cancelled = true;
      world.current.items = [];
    };
  }, [achievements, world]);

  useFrame((_, dt) => {
    if (!items) return;
    const d = Math.min(dt, 0.05);
    items.forEach((it, i) => {
      it.vel.y -= it.gravity * d;
      it.vel.multiplyScalar(Math.exp(-it.drag * d));
      it.pos.addScaledVector(it.vel, d);

      // keep inside the glass sphere while flying; near the floor the sphere
      // sits above the outer snow, so only the mound disc bounds them there
      // (same geometry trap as the snow — see the SnowSystem comment)
      tmp.copy(it.pos).sub(CENTER);
      if (tmp.y > -0.35) {
        const maxR = GLOBE_RADIUS - it.r - 0.05;
        if (tmp.length() > maxR) {
          tmp.normalize();
          it.pos.copy(CENTER).addScaledVector(tmp, maxR);
          const vn = it.vel.dot(tmp);
          if (vn > 0) it.vel.addScaledVector(tmp, -(1 + BOUNCE) * vn);
        }
      } else {
        // same lower-region rule as the snow: horizontal squeeze to the glass
        // cross-section at this height, no lifting
        const maxR = GLOBE_RADIUS - it.r - 0.05;
        const rhMax = Math.sqrt(Math.max(maxR * maxR - tmp.y * tmp.y, 0.04));
        const rh = Math.sqrt(it.pos.x * it.pos.x + it.pos.z * it.pos.z);
        if (rh > rhMax) {
          const s = rhMax / rh;
          it.pos.x *= s;
          it.pos.z *= s;
          it.vel.x *= 0.7;
          it.vel.z *= 0.7;
        }
      }

      // settle into the snow: rest half a radius deep, snow friction kills sliding
      const floorY = moundSurfaceY(it.pos.x, it.pos.z) + it.r * 0.45;
      if (it.pos.y < floorY) {
        it.pos.y = floorY;
        if (it.vel.y < 0) it.vel.y *= -BOUNCE * 0.5;
        it.vel.x *= 0.88;
        it.vel.z *= 0.88;

        // A gentle fan-out across the mound prevents every item from draining
        // into the same central heap. Shakes still overpower this attraction.
        it.vel.x += (it.restX - it.pos.x) * 1.8 * d;
        it.vel.z += (it.restZ - it.pos.z) * 1.8 * d;
      }
    });

    spreadAchievementCollisions(items);

    items.forEach((it, i) => {
      // Collision correction can nudge the lower badge into the snow or an
      // outer badge past the glass. Re-apply the visible resting bounds once.
      const floorY = moundSurfaceY(it.pos.x, it.pos.z) + it.r * 0.45;
      if (it.pos.y < floorY) it.pos.y = floorY;

      tmp.copy(it.pos).sub(CENTER);
      const maxR = GLOBE_RADIUS - it.r - 0.05;
      if (tmp.y > -0.35) {
        if (tmp.length() > maxR) {
          tmp.normalize();
          it.pos.copy(CENTER).addScaledVector(tmp, maxR);
        }
      } else {
        const rhMax = Math.sqrt(Math.max(maxR * maxR - tmp.y * tmp.y, 0.04));
        const rh = Math.sqrt(it.pos.x * it.pos.x + it.pos.z * it.pos.z);
        if (rh > rhMax) {
          const scale = rhMax / rh;
          it.pos.x *= scale;
          it.pos.z *= scale;
        }
      }
      const correctedFloorY = moundSurfaceY(it.pos.x, it.pos.z) + it.r * 0.45;
      if (it.pos.y < correctedFloorY) it.pos.y = correctedFloorY;

      const sprite = spritesRef.current[i];
      if (sprite) {
        sprite.position.copy(it.pos);
        sprite.material.rotation += it.spin * d * Math.min(it.vel.length(), 2.5);
      }
    });
  });

  if (!items) return null;
  return items.map((it, i) => (
    <sprite
      key={i}
      ref={(el) => (spritesRef.current[i] = el)}
      position={it.pos.toArray()}
      scale={[it.size * it.aspect, it.size, 1]}
    >
      <spriteMaterial map={it.tex} transparent depthWrite={false} />
    </sprite>
  ));
}

/* Snow particles with their own cheaper physics — one pool where every flake
   gets an independent random size and weight (gravity/drag/shake response),
   so dust that drifts and chunks that plummet are all mixed together.
   Per-flake size needs a tiny shader: PointsMaterial only has a global size. */
const SNOW_VERTEX = /* glsl */ `
  attribute float size;
  uniform float uScale;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (uScale / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;
const SNOW_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 color;
  void main() {
    gl_FragColor = vec4(color, 0.9) * texture2D(map, gl_PointCoord);
  }
`;

function SnowSystem({ world, count, makeTexture, color = '#dbe8fc' }) {
  const pointsRef = useRef();
  const tex = useMemo(() => makeTexture(), [makeTexture]);
  const uniforms = useMemo(
    () => ({ map: { value: tex }, color: { value: new THREE.Color(color) }, uScale: { value: 1000 } }),
    [tex, color]
  );
  const data = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const gravities = new Float32Array(count);
    const drags = new Float32Array(count);
    const kicks = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const p = randomPointInGlobe(GLOBE_RADIUS * 0.92);
      positions.set([p.x, p.y, p.z], i * 3);
      sizes[i] = 0.04 + Math.random() * 0.16;
      // weight drawn independently of size: gravity up, drag and shake
      // response down as a flake gets heavier. Gravity floor keeps even the
      // lightest dust falling visibly instead of hanging near-motionless.
      const weight = Math.random();
      gravities[i] = 0.14 + weight * 0.45;
      drags[i] = 1.1 - weight * 0.7;
      kicks[i] = 1.35 - weight * 0.65;
    }
    return { positions, velocities, sizes, gravities, drags, kicks, count };
  }, [count]);

  useEffect(() => {
    world.current.snowSystems.push(data);
    return () => {
      world.current.snowSystems = world.current.snowSystems.filter((s) => s !== data);
    };
  }, [world, data]);

  useFrame(({ gl }, dt) => {
    const d = Math.min(dt, 0.05);
    const { positions, velocities, gravities, drags } = data;
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const decay = Math.exp(-drags[i] * d);
      velocities[ix + 1] -= gravities[i] * d;
      // faint turbulence: flakes flutter as they fall, and any flakes the
      // dome funnels toward the top pole disperse instead of raining down
      // the center axis as a visible column
      velocities[ix] += (Math.random() - 0.5) * 0.5 * d;
      velocities[ix + 2] += (Math.random() - 0.5) * 0.5 * d;
      velocities[ix] *= decay;
      velocities[ix + 1] *= decay;
      velocities[ix + 2] *= decay;
      positions[ix] += velocities[ix] * d;
      positions[ix + 1] += velocities[ix + 1] * d;
      positions[ix + 2] += velocities[ix + 2] * d;

      const surfY = moundSurfaceY(positions[ix], positions[ix + 2]) + 0.02;
      const airborne = positions[ix + 1] > surfY + 0.03;

      if (airborne) {
        // the glass bound is a sphere only in the upper flight region — lower
        // down the sphere sits ABOVE the outer snow (the mound skirt pokes
        // past the glass into the bezel), and clamping falling flakes there
        // pinned them mid-air and slid them toward the bottom pole, so below
        // the cutoff only the mound disc bounds them and they land freely
        const dy = positions[ix + 1] - CENTER.y;
        if (dy > -0.35) {
          const dx = positions[ix] - CENTER.x;
          const dz = positions[ix + 2] - CENTER.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const maxR = GLOBE_RADIUS * 0.96;
          if (dist > maxR) {
            const s = maxR / dist;
            positions[ix] = CENTER.x + dx * s;
            positions[ix + 1] = CENTER.y + dy * s;
            positions[ix + 2] = CENTER.z + dz * s;
            velocities[ix] *= 0.2;
            velocities[ix + 1] *= 0.2;
            velocities[ix + 2] *= 0.2;
            // flakes pressed against the dome near the apex slide to the pole
            // and later drain down the axis as a visible snow tornado —
            // scatter them sideways instead
            if (dy > maxR * 0.7) {
              velocities[ix] += (Math.random() - 0.5) * 1.6;
              velocities[ix + 2] += (Math.random() - 0.5) * 1.6;
            }
          }
        } else {
          // below the cutoff the glass narrows: squeeze only HORIZONTALLY to
          // the sphere's cross-section at this height (never lift — lifting
          // was the old ratchet), so flakes stay inside the visible glass
          // while still falling freely onto the snow
          const maxR = GLOBE_RADIUS * 0.96;
          const rhMax = Math.sqrt(Math.max(maxR * maxR - dy * dy, 0.01));
          const rh = Math.sqrt(positions[ix] * positions[ix] + positions[ix + 2] * positions[ix + 2]);
          if (rh > rhMax) {
            const s = rhMax / rh;
            positions[ix] *= s;
            positions[ix + 2] *= s;
            velocities[ix] *= 0.3;
            velocities[ix + 2] *= 0.3;
          }
        }
      } else {
        // grounded: stay on the mound disc and settle onto the surface
        const rh = Math.sqrt(positions[ix] * positions[ix] + positions[ix + 2] * positions[ix + 2]);
        if (rh > MOUND_RX) {
          const s = MOUND_RX / rh;
          positions[ix] *= s;
          positions[ix + 2] *= s;
          velocities[ix] *= 0.2;
          velocities[ix + 2] *= 0.2;
        }
        if (positions[ix + 1] < surfY) {
          positions[ix + 1] = surfY;
          velocities[ix] *= 0.1;
          velocities[ix + 1] = 0;
          velocities[ix + 2] *= 0.1;
        }
      }
    }
    if (pointsRef.current) {
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      // match PointsMaterial's size attenuation: scale = drawing buffer height / 2
      uniforms.uScale.value = gl.drawingBufferHeight / 2;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach='attributes-position' args={[data.positions, 3]} />
        <bufferAttribute attach='attributes-size' args={[data.sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={SNOW_VERTEX}
        fragmentShader={SNOW_FRAGMENT}
        transparent
        depthWrite={false}
      />
    </points>
  );
}

/* Moves the whole globe: follows the pointer while dragging (spring-back on
   release), wobbles after a shake — and feeds the globe's acceleration back
   into the contents as inertia, so dragging sloshes items and snow like a
   real hand-held snow globe. */
function WobbleGroup({ world, children }) {
  const ref = useRef();
  useFrame((_, dt) => {
    const w = world.current;
    if (!ref.current) return;
    const d = Math.min(dt, 0.05);

    // spring the globe toward the pointer target (or back to center)
    const target = w.dragging ? w.dragTarget : 0;
    w.dragVel += (target - w.dragPos) * 60 * d - w.dragVel * 10 * d;
    w.dragPos += w.dragVel * d;

    // shake: one deliberate sway to a random side, then the spring settles
    // the globe back to center with a small natural overshoot
    let shakeTarget = 0;
    if (w.wobble > 0) {
      w.wobble = Math.max(0, w.wobble - d);
      shakeTarget = w.wobble > 0.45 ? w.shakeDir * 0.55 : 0;
    }
    w.shakeVel += (shakeTarget - w.shakePos) * 28 * d - w.shakeVel * 6 * d;
    w.shakePos += w.shakeVel * d;

    const posX = w.dragPos + w.shakePos;
    ref.current.position.x = posX;
    ref.current.rotation.z = -posX * 0.12; // tilt with the motion, pivoting like a held globe

    // inertia: contents feel the opposite of the globe's acceleration
    const velNow = (posX - w.prevPosX) / d;
    const impulse = THREE.MathUtils.clamp(-(velNow - w.prevVelX) * 0.85, -1.2, 1.2);
    w.prevPosX = posX;
    w.prevVelX = velNow;
    if (Math.abs(impulse) > 0.001) {
      w.items.forEach((it) => {
        it.vel.x += impulse * (it.kick ?? 1);
        it.vel.y += Math.abs(impulse) * 0.3 * Math.random() * (it.kick ?? 1);
      });
      w.snowSystems.forEach(({ velocities, count, kicks }) => {
        for (let i = 0; i < count; i++) {
          const ix = i * 3;
          const kick = kicks ? kicks[i] : 1;
          velocities[ix] += impulse * 0.7 * kick;
          velocities[ix + 1] += Math.abs(impulse) * 0.25 * Math.random() * kick;
        }
      });
    }
  });
  return <group ref={ref}>{children}</group>;
}

export { Achievements, SnowSystem, WobbleGroup };
