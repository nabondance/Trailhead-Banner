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
        // Once an item has entered the snow it becomes part of the settled
        // display. New arrivals move around it; embedded items never get
        // nudged out of place by later collision passes.
        const aInvMass = a.embedded ? 0 : a.invMass;
        const bInvMass = b.embedded ? 0 : b.invMass;
        const invMassSum = aInvMass + bInvMass;
        if (invMassSum === 0) continue;
        const correction = overlap * 0.58;

        a.pos.x -= nx * correction * (aInvMass / invMassSum);
        a.pos.y -= ny * correction * (aInvMass / invMassSum);
        b.pos.x += nx * correction * (bInvMass / invMassSum);
        b.pos.y += ny * correction * (bInvMass / invMassSum);

        // Remove closing velocity with very low restitution. This lets badges
        // softly pile up instead of bouncing indefinitely after every shake.
        const closingSpeed = (b.vel.x - a.vel.x) * nx + (b.vel.y - a.vel.y) * ny;
        if (closingSpeed < 0) {
          const impulse = (-closingSpeed * 1.08) / invMassSum;
          a.vel.x -= nx * impulse * aInvMass;
          a.vel.y -= ny * impulse * aInvMass;
          b.vel.x += nx * impulse * bInvMass;
          b.vel.y += ny * impulse * bInvMass;
        }
      }
    }
  }
}

/* Certs and stamps tumbling inside the globe */
function Achievements({ world, achievements }) {
  const [items, setItems] = useState(null);
  const spritesRef = useRef([]);
  const shadowsRef = useRef([]);
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
      const built = ok.map((a) => {
        const size = (a.type === 'rank' ? 0.72 : a.type === 'certification' ? 0.62 : 0.55) * sizeScale;
        const img = a.tex.image;
        const aspect = Math.min(2, Math.max(0.5, img ? img.width / img.height : 1));
        const pos = randomPointInGlobe(GLOBE_RADIUS * 0.7);
        const startFloorY = moundSurfaceY(pos.x, pos.z) + size * 0.28;
        if (pos.y < startFloorY) pos.y = startFloorY + 0.12 + Math.random() * 0.42;
        // per-type weight + per-item jitter: the rank sinks and settles first,
        // certs follow, agentblazer and stamps flutter longest — different
        // fall rates keep the pile from stacking in one clump
        const typeWeight =
          a.type === 'rank' ? 1.25 : a.type === 'certification' ? 1 : a.type === 'agentblazer' ? 0.85 : 0.7;
        const weight = typeWeight * (0.8 + Math.random() * 0.4);
        return {
          tex: a.tex,
          pos,
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
          embedded: false,
          landedThisFrame: false,
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
      if (it.embedded) {
        it.vel.set(0, 0, 0);
        return;
      }
      it.landedThisFrame = false;
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
        it.landedThisFrame = true;
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
      if (it.landedThisFrame || it.pos.y < correctedFloorY) it.pos.y = correctedFloorY;

      // Resolve the impact collision once, then let the snow hold the item in
      // its final position permanently. Later shakes and inertia skip it.
      if (it.landedThisFrame) {
        it.embedded = true;
        it.vel.set(0, 0, 0);
      }

      const sprite = spritesRef.current[i];
      if (sprite) {
        sprite.position.copy(it.pos);
        sprite.material.rotation += it.spin * d * Math.min(it.vel.length(), 2.5);
      }

      // A soft contact shadow anchors a badge only as it reaches the mound.
      // Airborne pieces stay clean and weightless rather than carrying a dark
      // disc around the globe with them.
      const shadow = shadowsRef.current[i];
      if (shadow) {
        const surfaceY = moundSurfaceY(it.pos.x, it.pos.z);
        const height = Math.max(0, it.pos.y - surfaceY - it.r * 0.45);
        const contact = THREE.MathUtils.clamp(1 - height / Math.max(it.size * 0.7, 0.01), 0, 1);
        shadow.position.set(it.pos.x, surfaceY + 0.018, it.pos.z);
        shadow.scale.set(it.size * 0.72, it.size * 0.34, 1);
        shadow.material.opacity = contact * 0.16;
      }
    });
  });

  if (!items) return null;
  return items.map((it, i) => (
    <group key={i}>
      <mesh
        ref={(el) => (shadowsRef.current[i] = el)}
        position={[it.pos.x, moundSurfaceY(it.pos.x, it.pos.z) + 0.018, it.pos.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[it.size * 0.72, it.size * 0.34, 1]}
        renderOrder={1}
      >
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial color='#71849e' transparent opacity={0} depthWrite={false} />
      </mesh>
      <sprite
        ref={(el) => (spritesRef.current[i] = el)}
        position={it.pos.toArray()}
        scale={[it.size * it.aspect, it.size, 1]}
      >
        <spriteMaterial map={it.tex} transparent depthWrite={false} />
      </sprite>
    </group>
  ));
}

/* Snow particles with their own cheaper physics. Crisp flakes and soft powder
   use separate pools, but share this simulation and the same total particle
   budget. Per-particle size and settling opacity need a tiny shader because
   PointsMaterial only exposes one global size and opacity. */
const SNOW_VERTEX = /* glsl */ `
  attribute float size;
  attribute float alpha;
  uniform float uScale;
  varying float vAlpha;
  void main() {
    vAlpha = alpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (uScale / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;
const SNOW_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 color;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(color, uOpacity * vAlpha) * texture2D(map, gl_PointCoord);
  }
`;

function SnowSystem({
  world,
  count,
  makeTexture,
  color = '#dbe8fc',
  minSize = 0.04,
  maxSize = 0.2,
  opacity = 0.9,
  settledOpacity = 0.2,
  gravityScale = 1,
  kickScale = 1,
}) {
  const pointsRef = useRef();
  const tex = useMemo(() => makeTexture(), [makeTexture]);
  const uniforms = useMemo(
    () => ({
      map: { value: tex },
      color: { value: new THREE.Color(color) },
      uScale: { value: 1000 },
      uOpacity: { value: opacity },
    }),
    [tex, color, opacity]
  );
  const data = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const baseSizes = new Float32Array(count);
    const alphas = new Float32Array(count).fill(1);
    const settles = new Float32Array(count);
    const gravities = new Float32Array(count);
    const drags = new Float32Array(count);
    const kicks = new Float32Array(count);
    const driftPhases = new Float32Array(count);
    const driftRates = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const p = randomPointInGlobe(GLOBE_RADIUS * 0.92);
      positions.set([p.x, p.y, p.z], i * 3);
      const size = minSize + Math.random() * (maxSize - minSize);
      sizes[i] = size;
      baseSizes[i] = size;
      // weight drawn independently of size: gravity up, drag and shake
      // response down as a flake gets heavier. Gravity floor keeps even the
      // lightest dust falling visibly instead of hanging near-motionless.
      const weight = Math.random();
      gravities[i] = (0.14 + weight * 0.45) * gravityScale;
      drags[i] = 1.1 - weight * 0.7;
      kicks[i] = (1.35 - weight * 0.65) * kickScale;
      driftPhases[i] = (i * GOLDEN_ANGLE) % (Math.PI * 2);
      driftRates[i] = 0.65 + ((i * 37) % 101) / 160;
    }
    return {
      positions,
      velocities,
      sizes,
      baseSizes,
      alphas,
      settles,
      gravities,
      drags,
      kicks,
      driftPhases,
      driftRates,
      count,
    };
  }, [count, minSize, maxSize, gravityScale, kickScale]);

  useEffect(() => () => tex.dispose(), [tex]);

  useEffect(() => {
    world.current.snowSystems.push(data);
    return () => {
      world.current.snowSystems = world.current.snowSystems.filter((s) => s !== data);
    };
  }, [world, data]);

  useFrame(({ gl, clock }, dt) => {
    const d = Math.min(dt, 0.05);
    const { positions, velocities, sizes, baseSizes, alphas, settles, gravities, drags, driftPhases, driftRates } =
      data;
    const time = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const decay = Math.exp(-drags[i] * d);
      velocities[ix + 1] -= gravities[i] * d;
      // Smooth, seeded currents give every mote a coherent path. Per-frame
      // randomness made the old snow shimmer in place instead of drifting.
      const phase = driftPhases[i];
      const rate = driftRates[i];
      velocities[ix] += (Math.sin(time * rate + phase) * 0.18 + Math.sin(time * 0.37 + phase * 1.7) * 0.06) * d;
      velocities[ix + 2] += Math.cos(time * rate * 0.83 + phase * 1.3) * 0.16 * d;
      velocities[ix] *= decay;
      velocities[ix + 1] *= decay;
      velocities[ix + 2] *= decay;
      positions[ix] += velocities[ix] * d;
      positions[ix + 1] += velocities[ix + 1] * d;
      positions[ix + 2] += velocities[ix + 2] * d;

      const surfY = moundSurfaceY(positions[ix], positions[ix + 2]) + 0.02;
      const airborne = positions[ix + 1] > surfY + 0.03;

      // Once landed, flakes slowly compress into the mound instead of
      // remaining as a permanent layer of bright dots. A new shake resets
      // this progress and makes the full flake visible again.
      settles[i] = airborne ? Math.max(0, settles[i] - d * 3.5) : Math.min(1, settles[i] + d * 0.7);
      alphas[i] = 1 - settles[i] * (1 - settledOpacity);
      sizes[i] = baseSizes[i] * (1 - settles[i] * 0.42);

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
              velocities[ix] += Math.sin(phase) * 0.8;
              velocities[ix + 2] += Math.cos(phase) * 0.8;
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
        const settledY = surfY - settles[i] * 0.018;
        if (positions[ix + 1] < settledY) {
          positions[ix + 1] = settledY;
          velocities[ix] *= 0.1;
          velocities[ix + 1] = 0;
          velocities[ix + 2] *= 0.1;
        }
      }
    }
    if (pointsRef.current) {
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      pointsRef.current.geometry.attributes.size.needsUpdate = true;
      pointsRef.current.geometry.attributes.alpha.needsUpdate = true;
      // match PointsMaterial's size attenuation: scale = drawing buffer height / 2
      uniforms.uScale.value = gl.drawingBufferHeight / 2;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach='attributes-position' args={[data.positions, 3]} />
        <bufferAttribute attach='attributes-size' args={[data.sizes, 1]} />
        <bufferAttribute attach='attributes-alpha' args={[data.alphas, 1]} />
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
        if (it.embedded) {
          // Settled pieces stay locked during tiny spring corrections. A real
          // drag or shake breaks them free so they can tumble and land again.
          if (Math.abs(impulse) < 0.18) return;
          it.embedded = false;
          it.landedThisFrame = false;
          it.vel.y += (0.45 + Math.abs(impulse) * 0.35) * (it.kick ?? 1);
        }
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
