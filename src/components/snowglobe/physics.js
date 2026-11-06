'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GLOBE_RADIUS, GRAVITY, DRAG, BOUNCE, CENTER, DISPLAY_SCALE, proxied, randomPointInGlobe } from './constants';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const WHITE = new THREE.Color('#ffffff');
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
/* Keep an item out of a standing obstacle (the quiet-year fir): anywhere
   within its reach sideways, the item moves forward (toward the camera, +z)
   to just in front of it, so it is never hidden behind it. Reaching a full
   half-width past the obstacle keeps the whole flat sprite in front, edges
   included. Airborne items ease forward; a landing snaps to the spot. */
function keepInFront(it, keepOut, ease) {
  const dx = it.pos.x - keepOut.x;
  const reach = keepOut.radius + it.r * Math.max(1, it.aspect);
  if (Math.abs(dx) >= reach) return;
  const frontZ = keepOut.z + Math.sqrt(reach * reach - dx * dx);
  if (it.pos.z >= frontZ) return;
  it.pos.z += (frontZ - it.pos.z) * ease;
  if (it.vel.z < 0) it.vel.z = 0;
}

function Achievements({ world, achievements, floor, keepOut = null }) {
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
      // the achievements are the hero of the globe: big enough to read, and
      // shrinking gently (never below ~55%) as a busy year fills the glass.
      // They still settle half into the snow (floorY below)
      const sizeScale = Math.min(1, Math.max(0.55, Math.sqrt(10 / Math.max(ok.length, 1))));
      const built = ok.map((a) => {
        const size = (a.type === 'rank' ? 0.98 : a.type === 'certification' ? 0.9 : 0.78) * sizeScale;
        const img = a.tex.image;
        const aspect = Math.min(2, Math.max(0.5, img ? img.width / img.height : 1));
        const pos = randomPointInGlobe(GLOBE_RADIUS * 0.7);
        const startFloorY = floor.surfaceY(pos.x, pos.z) + size * 0.28;
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
  }, [achievements, world, floor]);

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
      const floorY = floor.surfaceY(it.pos.x, it.pos.z) + it.r * 0.45;
      if (it.pos.y < floorY) {
        it.pos.y = floorY;
        it.landedThisFrame = true;
      }
    });

    spreadAchievementCollisions(items);

    /* Collision correction can nudge the lower badge into the snow or an
       outer badge past the glass: re-apply the visible resting bounds */
    const applyBounds = (it) => {
      const floorY = floor.surfaceY(it.pos.x, it.pos.z) + it.r * 0.45;
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
      const correctedFloorY = floor.surfaceY(it.pos.x, it.pos.z) + it.r * 0.45;
      if (it.landedThisFrame || it.pos.y < correctedFloorY) it.pos.y = correctedFloorY;
    };

    items.forEach((it, i) => {
      if (keepOut && it.landedThisFrame) {
        // the glass can squeeze a spot in front of the tree back behind it:
        // alternate both rules so the item settles where they agree, which
        // drifts it toward the middle of the globe
        for (let k = 0; k < 6; k++) {
          keepInFront(it, keepOut, 1);
          applyBounds(it);
        }
      } else {
        if (keepOut && !it.embedded) keepInFront(it, keepOut, Math.min(1, d * 8));
        applyBounds(it);
      }

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
        const surfaceY = floor.surfaceY(it.pos.x, it.pos.z);
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
        position={[it.pos.x, floor.surfaceY(it.pos.x, it.pos.z) + 0.018, it.pos.z]}
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
  attribute float phase;
  uniform float uScale;
  uniform float uTime;
  uniform vec3 color;
  uniform vec3 uTint2;
  uniform float uTintMix;
  uniform float uIridescence;
  uniform float uTwinkle;
  varying float vAlpha;
  varying vec3 vColor;
  vec3 hue(float h) {
    return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  }
  void main() {
    // snow style (see SNOW_STYLES): a share of the flakes in a second tint,
    // optional color-shifting iridescence, optional twinkle
    vec3 c = fract(phase * 7.13) < uTintMix ? uTint2 : color;
    vec3 rainbow = mix(vec3(1.0), hue(fract(phase * 0.159 + uTime * 0.12)), 0.6);
    vColor = mix(c, rainbow, uIridescence);
    float glint = pow(max(sin(uTime * 2.1 + phase * 5.0), 0.0), 6.0);
    vAlpha = alpha * (1.0 - uTwinkle * 0.45 + uTwinkle * glint * 0.9);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (1.0 + uTwinkle * glint * 0.35) * (uScale / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;
const SNOW_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform float uOpacity;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, uOpacity * vAlpha) * texture2D(map, gl_PointCoord);
  }
`;

function SnowSystem({
  world,
  floor,
  count,
  makeTexture,
  color = '#dbe8fc',
  tint2 = color,
  tintMix = 0,
  iridescence = 0,
  twinkle = 0,
  minSize = 0.04,
  maxSize = 0.2,
  opacity = 0.9,
  settledOpacity = 0.2,
  gravityScale = 1,
  kickScale = 1,
  // solid: real 3D flakes (thin textured crystals that tumble as they fall and
  // lie flat once landed) instead of camera-facing points
  solid = false,
}) {
  const pointsRef = useRef();
  const meshRef = useRef();
  const tex = useMemo(() => makeTexture(), [makeTexture]);
  const uniforms = useMemo(
    () => ({
      map: { value: tex },
      color: { value: new THREE.Color(color) },
      uTint2: { value: new THREE.Color(tint2) },
      uTintMix: { value: tintMix },
      uIridescence: { value: iridescence },
      uTwinkle: { value: twinkle },
      uTime: { value: 0 },
      uScale: { value: 1000 },
      uOpacity: { value: opacity },
    }),
    [tex, color, tint2, tintMix, iridescence, twinkle, opacity]
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
    // solid flakes: a random tumble axis, speed and starting angle each
    const spinAxes = solid ? new Float32Array(count * 3) : null;
    const spinRates = solid ? new Float32Array(count) : null;
    const spinAngles = solid ? new Float32Array(count) : null;
    for (let i = 0; solid && i < count; i++) {
      const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      spinAxes.set([axis.x, axis.y, axis.z], i * 3);
      spinRates[i] = (0.8 + Math.random() * 1.6) * (Math.random() < 0.5 ? -1 : 1);
      spinAngles[i] = Math.random() * Math.PI * 2;
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
      spinAxes,
      spinRates,
      spinAngles,
      count,
    };
  }, [count, minSize, maxSize, gravityScale, kickScale, solid]);

  // solid flakes: one lit, double-sided material. Each flake's color (snow
  // style tint, iridescence, twinkle) lives in its instance color, which also
  // tints the glow so tinted flakes stay tinted in the shade. The scratch
  // objects are reused every frame.
  const solidMaterial = useMemo(() => {
    if (!solid) return null;
    const material = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: '#ffffff',
      emissiveMap: tex,
      emissiveIntensity: 0.8,
      roughness: 0.3,
      metalness: 0.15,
      transparent: true,
      opacity,
      alphaTest: 0.05,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n  totalEmissiveRadiance *= vColor.rgb;\n#endif'
      );
    };
    return material;
  }, [solid, tex, opacity]);
  // per-flake base color: a share of the flakes in the second tint
  const baseColors = useMemo(() => {
    if (!solid) return null;
    const first = new THREE.Color(color);
    const second = new THREE.Color(tint2);
    return Array.from({ length: count }, (_, i) => {
      const f = (data.driftPhases[i] * 7.13) % 1;
      return f < tintMix ? second : first;
    });
  }, [solid, count, color, tint2, tintMix, data]);
  useEffect(() => () => solidMaterial?.dispose(), [solidMaterial]);
  const scratch = useMemo(
    () => ({
      obj: new THREE.Object3D(),
      axis: new THREE.Vector3(),
      tumble: new THREE.Quaternion(),
      // landed flakes lie flat: the plane's normal (+z) turned to point up
      flat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2),
      color: new THREE.Color(),
      rainbow: new THREE.Color(),
    }),
    []
  );

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

      const surfY = floor.surfaceY(positions[ix], positions[ix + 2]) + 0.02;
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
        if (rh > floor.rx) {
          const s = floor.rx / rh;
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
    if (meshRef.current) {
      // a point's size is in screen terms; this turns it into the same
      // on-screen size for a plane (camera fov 42°) inside the scaled group,
      // plus 25%: a tumbling flake shows less of itself than a flat sticker
      const toWorld = (Math.tan(THREE.MathUtils.degToRad(21)) / DISPLAY_SCALE) * 1.25;
      const { obj, axis, tumble, flat, color: c, rainbow } = scratch;
      const { spinAxes, spinRates, spinAngles } = data;
      for (let i = 0; i < count; i++) {
        const ix = i * 3;
        // tumble while falling, slowing down as the flake settles
        spinAngles[i] += spinRates[i] * d * (1 - settles[i]);
        axis.set(spinAxes[ix], spinAxes[ix + 1], spinAxes[ix + 2]);
        tumble.setFromAxisAngle(axis, spinAngles[i]);
        obj.quaternion.slerpQuaternions(tumble, flat, settles[i]);
        obj.position.set(positions[ix], positions[ix + 1], positions[ix + 2]);
        // a landed flake lies flat and shrinks into the mound; the fainter
        // its settled opacity, the more it shrinks (a plane has no per-flake
        // opacity)
        obj.scale.setScalar(sizes[i] * toWorld * (0.3 + 0.7 * alphas[i]));
        obj.updateMatrix();
        meshRef.current.setMatrixAt(i, obj.matrix);

        // color: same snow style rules as the point shader
        const phase = driftPhases[i];
        c.copy(baseColors[i]);
        if (iridescence > 0) {
          rainbow.setHSL((phase * 0.159 + time * 0.12) % 1, 1, 0.5).lerp(WHITE, 0.4);
          c.lerp(rainbow, iridescence);
        }
        if (twinkle > 0) {
          const glint = Math.pow(Math.max(Math.sin(time * 2.1 + phase * 5), 0), 6);
          c.multiplyScalar(1 - twinkle * 0.3 + twinkle * glint * 0.6);
        }
        meshRef.current.setColorAt(i, c);
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    }
    if (pointsRef.current) {
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      pointsRef.current.geometry.attributes.size.needsUpdate = true;
      pointsRef.current.geometry.attributes.alpha.needsUpdate = true;
      // match PointsMaterial's size attenuation: scale = drawing buffer height / 2
      uniforms.uScale.value = gl.drawingBufferHeight / 2;
      uniforms.uTime.value = time;
    }
  });

  if (solid) {
    return (
      <instancedMesh ref={meshRef} args={[null, null, count]} material={solidMaterial} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
      </instancedMesh>
    );
  }

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach='attributes-position' args={[data.positions, 3]} />
        <bufferAttribute attach='attributes-size' args={[data.sizes, 1]} />
        <bufferAttribute attach='attributes-alpha' args={[data.alphas, 1]} />
        <bufferAttribute attach='attributes-phase' args={[data.driftPhases, 1]} />
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
/* Letting go of the globe (end of a drag, swipe or phone move) puffs the
   snow outward in random horizontal directions — held inertia otherwise
   herds the flakes against the dome and they drain down the middle as a
   column */
function puffSnow(w) {
  w.snowSystems.forEach(({ velocities, count, kicks }) => {
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const kick = kicks ? kicks[i] : 1;
      const angle = Math.random() * Math.PI * 2;
      const mag = (0.8 + Math.random() * 1.6) * kick;
      velocities[ix] += Math.cos(angle) * mag;
      velocities[ix + 2] += Math.sin(angle) * mag;
    }
  });
}

/* The secret turn: one full spin around the vertical axis, eased in and out */
const SPIN_SECONDS = 2.5;
const easeInOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/* The water lags behind the turning glass: in the globe's own frame the
   contents swirl the other way, so give everything a tangential push */
function swirlContents(w, dir) {
  w.items.forEach((it) => {
    const k = it.kick ?? 1;
    it.embedded = false;
    it.landedThisFrame = false;
    const px = it.pos.x - CENTER.x;
    const pz = it.pos.z - CENTER.z;
    it.vel.x += -dir * pz * 3.2 * k;
    it.vel.z += dir * px * 3.2 * k;
    it.vel.y += (0.6 + Math.random() * 0.8) * k;
  });
  w.snowSystems.forEach(({ positions, velocities, count, kicks, settles, alphas, sizes, baseSizes }) => {
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const k = kicks ? kicks[i] : 1;
      const px = positions[ix] - CENTER.x;
      const pz = positions[ix + 2] - CENTER.z;
      velocities[ix] += -dir * pz * 3.6 * k;
      velocities[ix + 2] += dir * px * 3.6 * k;
      velocities[ix + 1] = Math.min(velocities[ix + 1] + (0.4 + Math.random() * 1.2) * k, 2.6);
      if (settles) settles[i] = 0;
      if (alphas) alphas[i] = 1;
      if (sizes && baseSizes) sizes[i] = baseSizes[i];
    }
  });
}

/* Advances the secret turn and publishes its angle as world.spinAngle.
   Rendered before WobbleGroup so its frame runs first: the globe and the
   parts that cancel the turn (glare, northern lights) all read the same
   angle in the same frame. dir +1 = the front swings right. */
function SpinDriver({ world }) {
  useFrame((_, dt) => {
    const w = world.current;
    const rest = w.restAngle || 0; // design lab can hold the globe turned
    if (!w.spin) {
      w.spinAngle = rest;
      return;
    }
    w.spin.t += Math.min(dt, 0.05);
    const p = Math.min(w.spin.t / SPIN_SECONDS, 1);
    w.spinAngle = rest + w.spin.dir * Math.PI * 2 * easeInOutCubic(p);
    if (!w.spin.swirled && p > 0.12) {
      w.spin.swirled = true;
      swirlContents(w, w.spin.dir);
    }
    if (p >= 1) {
      w.spinAngle = rest;
      w.spin = null;
    }
  });
  return null;
}

function WobbleGroup({ world, children }) {
  const ref = useRef();
  useFrame((_, dt) => {
    const w = world.current;
    if (!ref.current) return;
    const d = Math.min(dt, 0.05);

    // phone motion (fresh readings only): the globe moves with the phone's
    // sideways position, in step with the hand and as far as a swipe takes
    // it; the contents then slosh from that real motion (inertia below). Its
    // up/down push jolts the contents directly. When a real move ends, the
    // snow puffs like letting go of a swipe.
    const pm = w.phoneMotion?.current;
    const fresh = pm && performance.now() - pm.t < 150;
    const phoneY = fresh ? pm.y : 0;
    // In a fast back-and-forth shake the hand barely travels but accelerates
    // hard, and that acceleration peaks (opposite sign) exactly when the hand
    // is at the end of its swing: adding it keeps the globe in step and gives
    // a frantic shake the same reach as a swipe.
    const phoneLean = fresh ? THREE.MathUtils.clamp(pm.px * 6 - pm.x * 0.03, -0.75, 0.75) : 0;
    w.phonePeak = Math.max((w.phonePeak || 0) * Math.exp(-d * 1.5), Math.abs(phoneLean));
    if (w.phonePeak > 0.3 && Math.abs(phoneLean) < 0.06) {
      w.phonePeak = 0;
      puffSnow(w);
    }

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

    // the phone's position applies directly (no spring): no lag behind the hand
    const posX = w.dragPos + w.shakePos + phoneLean;
    ref.current.position.x = posX;
    ref.current.rotation.z = -posX * 0.12; // tilt with the motion, pivoting like a held globe

    ref.current.rotation.y = w.spinAngle || 0; // secret turn (SpinDriver)

    if (Math.abs(phoneY) > 2) {
      // contents lag behind a vertical move: pushed down when the phone goes up
      const jolt = -phoneY * d;
      w.items.forEach((it) => {
        if (it.embedded && Math.abs(phoneY) < 8) return;
        it.embedded = false;
        it.vel.y += jolt * 0.35 * (it.kick ?? 1);
      });
      w.snowSystems.forEach(({ velocities, count, kicks, settles }) => {
        for (let i = 0; i < count; i++) {
          velocities[i * 3 + 1] += jolt * 0.45 * (kicks ? kicks[i] : 1);
          if (settles && Math.abs(phoneY) > 6) settles[i] = Math.min(settles[i], 0.5);
        }
      });
    }

    // inertia: contents feel the opposite of the globe's acceleration
    const velNow = (posX - w.prevPosX) / d;
    const impulse = THREE.MathUtils.clamp(-(velNow - w.prevVelX) * 0.85, -1.2, 1.2);
    w.prevPosX = posX;
    w.prevVelX = velNow;
    w.lastImpulse = impulse; // read by the quiet-year fir tree (tree.js)
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

export { Achievements, SnowSystem, SpinDriver, WobbleGroup, puffSnow };
