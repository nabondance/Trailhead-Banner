'use client';

import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLOBE_RADIUS, CENTER_Y, GLASS_SEAT_Y, BASE_TOP_Y, glassRadiusAt, smoothstep, snowBump } from './constants';
import {
  makeEngravedNameTexture,
  makeMakerMarkTexture,
  makeHighlightTexture,
  makeMvpRosetteTexture,
  makePlaqueTexture,
  makeSnowTexture,
  makeWoodTexture,
  loadFont,
} from './textures';
import { getRankMetals } from './rankMetals';
import { Aurora } from './aurora';

const GLASS_RIM_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDirection;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDirection = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const GLASS_RIM_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying vec3 vNormal;
  varying vec3 vViewDirection;
  void main() {
    // a thin, crisp bright edge where the glass is seen side-on
    float rim = pow(1.0 - clamp(dot(vNormal, vViewDirection), 0.0, 1.0), 6.0);
    gl_FragColor = vec4(uColor, rim * 0.55);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/* Single displaced surface: the squashed sphere gets smooth drift bumps baked
   into its vertices, so the snow reads as one wind-blown mound instead of
   separate blobs. Displacement uses the same snowBump() as the physics. */
function SnowMound({ floor }) {
  const snowTex = useMemo(() => makeSnowTexture(), []);
  const geometry = useMemo(() => {
    const r = GLOBE_RADIUS * 0.96;
    const geo = new THREE.SphereGeometry(r, 64, 32);
    const pos = geo.attributes.position;
    // vertex tint: pure white on the drift crests, cool blue in the hollows
    // and on the sides seen through the glass, like snow in soft shade
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) * (floor.rx / r);
      const z = pos.getZ(i) * (floor.rx / r);
      const y = pos.getY(i);
      let ny = y * (floor.ry / r);
      let stretch = 1;
      let shade = 0;
      if (y < 0) {
        // underside fills the bottom of the glass down into the wood, so
        // the snow reads as one layer resting in the glass
        ny = (y / r) * (floor.centerY - GLASS_SEAT_Y + 0.06);
        const rad = Math.sqrt(x * x + z * z);
        if (rad > 1e-6) stretch = Math.max(glassRadiusAt(floor.centerY + ny) - 0.03, 0) / rad;
        shade = 0.6;
      } else {
        if (y > 0) ny += snowBump(x, z) * (y / r);
        // bank the snow up against the glass, and push the raised rim out to
        // follow the glass as it widens upward (matches floor.surfaceY)
        const t = Math.min(Math.sqrt(x * x + z * z) / floor.rx, 1);
        ny += floor.bank(t, x, z);
        const glassR = glassRadiusAt(floor.centerY + ny) - 0.03;
        stretch = 1 + (glassR / floor.rx - 1) * smoothstep(0.5, 1, t);
        // hollows between drifts, plus the dip at the foot of the bank
        const hollow = smoothstep(0.04, -0.14, snowBump(x, z)) * 0.7;
        const trough = smoothstep(0.55, 0.78, t) * (1 - smoothstep(0.85, 0.97, t)) * 0.35;
        shade = Math.min(hollow + trough, 0.75);
      }
      pos.setXYZ(i, x * stretch, ny, z * stretch);
      colors[i * 3] = 1 - shade * 0.3;
      colors[i * 3 + 1] = 1 - shade * 0.19;
      colors[i * 3 + 2] = 1 - shade * 0.04;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [floor]);

  useEffect(
    () => () => {
      geometry.dispose();
      snowTex.dispose();
    },
    [geometry, snowTex]
  );

  return (
    <mesh geometry={geometry} position={[0, floor.centerY - CENTER_Y, 0]}>
      <meshPhysicalMaterial
        map={snowTex}
        vertexColors
        color='#f7fbff'
        roughness={0.88}
        metalness={0}
        clearcoat={0.04}
        clearcoatRoughness={0.72}
      />
    </mesh>
  );
}

/* Glass sphere with rim + specular highlight, and the snow mound floor */
const SPARKLE_VERTEX = /* glsl */ `
  attribute float aPhase;
  attribute float aSpeed;
  uniform float uTime;
  uniform float uScale;
  uniform float uRate;
  varying float vGlint;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // mostly dark, with a brief sharp glint now and then
    vGlint = pow(max(sin(uTime * aSpeed * uRate + aPhase), 0.0), 14.0);
    gl_PointSize = (0.08 + vGlint * 0.07) * uScale / -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const SPARKLE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vGlint;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    // soft core plus a thin four-point star
    float core = smoothstep(0.5, 0.0, d);
    float star = max(smoothstep(0.06, 0.0, abs(p.x)), smoothstep(0.06, 0.0, abs(p.y))) * smoothstep(0.5, 0.1, d);
    float alpha = (core * core + star * 0.6) * vGlint;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

const DRAWING_BUFFER_SIZE = new THREE.Vector2();

/* Glints on the snow surface: tiny ice crystals catching the light, each
   twinkling on its own rhythm. Fixed points on the mound (deterministic
   layout), drawn additively so they only ever brighten the snow. */
function SnowSparkles({ floor, count = 280, color = '#fffaeb', rate = 1 }) {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScale: { value: 500 },
      uColor: { value: new THREE.Color(color) },
      uRate: { value: rate },
    }),
    [color, rate]
  );
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // golden-angle spiral: even coverage without clumps
      const t = Math.sqrt((i + 0.5) / count) * 0.8;
      const angle = i * 2.39996;
      const x = Math.cos(angle) * t * floor.rx;
      const z = Math.sin(angle) * t * floor.rx;
      positions[i * 3] = x;
      positions[i * 3 + 1] = floor.surfaceY(x, z) + 0.012 - CENTER_Y;
      positions[i * 3 + 2] = z;
      phases[i] = (Math.sin(i * 12.9898) * 43758.5453) % (Math.PI * 2);
      speeds[i] = 0.6 + ((Math.sin(i * 78.233) + 1) / 2) * 1.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    return geo;
  }, [count, floor]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points
      geometry={geometry}
      renderOrder={2}
      // size in drawing-buffer pixels, read at render time so high-res
      // captures (which bump the pixel ratio) keep the same look
      onBeforeRender={(renderer) => {
        uniforms.uScale.value = renderer.getDrawingBufferSize(DRAWING_BUFFER_SIZE).y / 2;
      }}
    >
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={SPARKLE_VERTEX}
        fragmentShader={SPARKLE_FRAGMENT}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// glare spots in the globe's local space, at rest
const GLARES = [
  { position: [-0.85, 1.05, 1.5], scale: [1.0, 0.4, 1], rotation: 0.68, opacity: 0.35 },
  { position: [-1.15, 0.3, 1.55], scale: [0.3, 0.2, 1], rotation: 1.2, opacity: 0.5 },
];

function GlobeShell({ world, floor, sparkles, activity }) {
  const glareRefs = useRef([]);

  // The glare is a reflection of a fixed light, so it must not ride along
  // with the glass: undo the globe's tilt around its center and let the spot
  // lag the sideways sway, so it slides across the glass when shaken, and
  // flare slightly while the globe is moving.
  useFrame(() => {
    const w = world?.current;
    if (!w) return;
    const sway = w.dragPos + w.shakePos;
    const tilt = sway * 0.12; // WobbleGroup tilts by -sway * 0.12
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    const speed = Math.min(Math.abs(w.dragVel + w.shakeVel), 3);
    // the secret turn spins the glass, not the light: undo it as well
    const spin = w.spinAngle || 0;
    const spinCos = Math.cos(spin);
    const spinSin = Math.sin(spin);
    GLARES.forEach((glare, i) => {
      const sprite = glareRefs.current[i];
      if (!sprite) return;
      const [x0, y, z0] = glare.position;
      const x = x0 * spinCos - z0 * spinSin;
      const z = x0 * spinSin + z0 * spinCos;
      sprite.position.set(x * cos - y * sin - sway * 0.3, x * sin + y * cos, z);
      sprite.material.opacity = glare.opacity * (1 + speed * 0.12);
    });
  });

  const highlightTex = useMemo(() => makeHighlightTexture(), []);
  const envMap = useRingEnvMap();
  const rimUniforms = useMemo(() => ({ uColor: { value: new THREE.Color('#d8efff') } }), []);

  useEffect(() => () => highlightTex.dispose(), [highlightTex]);

  return (
    <group position={[0, CENTER_Y, 0]}>
      {/* Glass = reflections only, added on top of the scene (no haze): a
          soft studio room mirrored with real glass Fresnel, faint through the
          middle and strong toward the edges. The far wall's inside reflects
          too, more faintly, which gives the glass its thickness. */}
      <mesh renderOrder={8}>
        <sphereGeometry args={[GLOBE_RADIUS - 0.01, 64, 64]} />
        <meshPhysicalMaterial
          color='#000000'
          roughness={0.08}
          metalness={0}
          ior={1.5}
          envMap={envMap}
          envMapIntensity={0.22}
          side={THREE.BackSide}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh renderOrder={10}>
        <sphereGeometry args={[GLOBE_RADIUS + 0.02, 64, 64]} />
        <meshPhysicalMaterial
          color='#000000'
          roughness={0.04}
          metalness={0}
          ior={1.5}
          envMap={envMap}
          envMapIntensity={0.85}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Fresnel rim: clear through the center, reflective at glancing angles */}
      <mesh renderOrder={9}>
        <sphereGeometry args={[GLOBE_RADIUS + 0.055, 64, 64]} />
        <shaderMaterial
          uniforms={rimUniforms}
          vertexShader={GLASS_RIM_VERTEX}
          fragmentShader={GLASS_RIM_FRAGMENT}
          transparent
          depthWrite={false}
        />
      </mesh>
      {/* shine spots: an elongated one hugging the upper-left rim and a
          small crisp one below it (positioned per frame, see useFrame) */}
      {GLARES.map((glare, i) => (
        <sprite
          key={i}
          ref={(el) => {
            glareRefs.current[i] = el;
          }}
          position={glare.position}
          scale={glare.scale}
          renderOrder={12}
        >
          <spriteMaterial
            map={highlightTex}
            rotation={glare.rotation}
            transparent
            opacity={glare.opacity}
            depthWrite={false}
            depthTest={false}
          />
        </sprite>
      ))}
      {/* northern lights from the year's monthly activity */}
      <Aurora activity={activity} world={world} />
      {/* snow floor: one organic drifted surface (matches floor.surfaceY) */}
      <SnowMound floor={floor} />
      <SnowSparkles floor={floor} {...sparkles} />
    </group>
  );
}

// the collar's top edge sits just outside the glass (base group: y scaled 0.95)
// Wood body in the base group's local space (the group scales y by 0.95):
// its top edge meets the glass at the seat, and it flares gently to the foot
const WOOD_TOP = 0.1;
const WOOD_BOTTOM = -0.78;
// dark foot under the wood, tall enough to carry the engraved stats plaque
const FOOT_BOTTOM = -0.95;
// Like a real globe in cross-section: the glass comes down to exactly the
// wood's top edge, and the rank ring sits over that joint on the outside,
// half on the glass foot and half on the wood's flared side.
const sphereRadiusAt = (y, radius) => {
  const dy = y - CENTER_Y;
  return Math.sqrt(Math.max(radius * radius - dy * dy, 0));
};
const WOOD_TOP_RADIUS = sphereRadiusAt(GLASS_SEAT_Y, GLOBE_RADIUS + 0.02); // glass shell radius
const RING_HALF_THICKNESS = 0.045;
// ring center: a bit below the joint, and pushed out just enough that no
// part of its upper half is inside the glass (which flares out above)
const RING_CENTER_Y = GLASS_SEAT_Y - RING_HALF_THICKNESS * 0.25;
const RING_RADIUS = Array.from({ length: 13 }, (_, i) => (i / 12) * Math.PI).reduce(
  (r, a) =>
    Math.max(
      r,
      sphereRadiusAt(RING_CENTER_Y + RING_HALF_THICKNESS * Math.sin(a), GLOBE_RADIUS + 0.03) -
        RING_HALF_THICKNESS * Math.cos(a)
    ),
  0
);
const WOOD_BOTTOM_RADIUS = WOOD_TOP_RADIUS + 0.22;
const woodRadiusAt = (y) =>
  WOOD_BOTTOM_RADIUS + ((WOOD_TOP_RADIUS - WOOD_BOTTOM_RADIUS) * (y - WOOD_BOTTOM)) / (WOOD_TOP - WOOD_BOTTOM);

/* One strand of a braided ring: a helix wound around the ring's circle, so
   several strands with spread phases twist together like a rope */
class BraidStrand extends THREE.Curve {
  constructor(ringRadius, braidRadius, twists, phase) {
    super();
    this.ringRadius = ringRadius;
    this.braidRadius = braidRadius;
    this.twists = twists;
    this.phase = phase;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const theta = t * Math.PI * 2;
    const a = theta * this.twists + this.phase;
    const r = this.ringRadius + this.braidRadius * Math.cos(a);
    return target.set(Math.cos(theta) * r, this.braidRadius * Math.sin(a), Math.sin(theta) * r);
  }
}

/* Reflections for the ring only: a soft studio room baked into a PMREM map.
   Metal is defined by what it reflects; without it, the ring is flat color.
   Scoped to the ring so the glass, snow and wood keep their current look. */
function useRingEnvMap() {
  const { gl } = useThree();
  const envMap = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const texture = pmrem.fromScene(room, 0.04).texture;
    room.dispose?.();
    pmrem.dispose();
    return texture;
  }, [gl]);
  useEffect(() => () => envMap.dispose(), [envMap]);
  return envMap;
}

/* The rank ring: one solid metal for the first ranks, then a braid with one
   strand per star (see rankMetals.js) */
function RankRing({ radius, y, metals }) {
  const envMap = useRingEnvMap();
  const strands = useMemo(() => {
    if (metals.length < 2) return null;
    const braidRadius = 0.024;
    const tube = metals.length === 2 ? 0.02 : Math.max(0.013, braidRadius * Math.sin(Math.PI / metals.length) * 1.2);
    const twists = 40;
    return metals.map((metal, i) => ({
      metal,
      geometry: new THREE.TubeGeometry(
        new BraidStrand(radius, braidRadius, twists, (i / metals.length) * Math.PI * 2),
        twists * 16,
        tube,
        8,
        true
      ),
    }));
  }, [radius, metals]);

  useEffect(() => () => strands?.forEach((s) => s.geometry.dispose()), [strands]);

  if (!strands) {
    const [metal] = metals;
    return (
      <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.04, 16, 128]} />
        <meshStandardMaterial
          color={metal.color}
          metalness={metal.metalness}
          roughness={metal.roughness}
          emissive={metal.emissive || '#000000'}
          emissiveIntensity={metal.emissiveIntensity || 0}
          envMap={envMap}
          envMapIntensity={1.1}
        />
      </mesh>
    );
  }
  return (
    <group position={[0, y, 0]}>
      {strands.map(({ metal, geometry }) => (
        <mesh key={metal.name} geometry={geometry}>
          <meshStandardMaterial
            color={metal.color}
            metalness={metal.metalness}
            roughness={metal.roughness}
            emissive={metal.emissive || '#000000'}
            emissiveIntensity={metal.emissiveIntensity || 0}
            envMap={envMap}
            envMapIntensity={1.1}
          />
        </mesh>
      ))}
    </group>
  );
}

/* MVP prize rosette pinned on the wood beside the engraved name, curved to
   hug the tapered base like the engraving (banner MVP ribbon colors) */
const ROSETTE_HEIGHT = 0.8;

function MvpRosette({ rightEdge }) {
  const loaded = useFontsLoaded('Anta', '/assets/fonts/Anta-Regular.ttf');
  const tex = useMemo(() => (loaded ? makeMvpRosetteTexture() : null), [loaded]);
  useEffect(() => () => tex?.dispose(), [tex]);
  if (!tex) return null;
  const centerY = -0.42;
  const top = woodRadiusAt(centerY + ROSETTE_HEIGHT / 2) + 0.03;
  const bottom = woodRadiusAt(centerY - ROSETTE_HEIGHT / 2) + 0.03;
  const width = ROSETTE_HEIGHT * tex.userData.aspect;
  const thetaLength = width / ((top + bottom) / 2);
  const angle = rightEdge - thetaLength / 2;
  return (
    <mesh position={[0, centerY, 0]}>
      <cylinderGeometry args={[top, bottom, ROSETTE_HEIGHT, 24, 1, true, angle - thetaLength / 2, thetaLength]} />
      <meshStandardMaterial map={tex} transparent alphaTest={0.05} roughness={0.55} side={THREE.DoubleSide} />
    </mesh>
  );
}

function useFontsLoaded(family, url) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadFont(family, url).then(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [family, url]);
  return loaded;
}

/* "848 BADGES · 412,000 POINTS · 120 TRAILS" engraved on the foot, centered
   at the front, hugging its slight taper. Skipped when there are no stats. */
const formatCount = (n) => Number(n).toLocaleString('en-US');

function FootPlaque({ stats }) {
  const loaded = useFontsLoaded('Anta', '/assets/fonts/Anta-Regular.ttf');
  const text = useMemo(() => {
    if (!stats) return null;
    const parts = [
      [stats.badges, 'badge'],
      [stats.points, 'point'],
      [stats.trails, 'trail'],
    ]
      .filter(([n]) => Number.isFinite(n))
      .map(([n, label]) => `${formatCount(n)} ${label}${n === 1 ? '' : 's'}`.toUpperCase());
    return parts.length ? parts.join('  ·  ') : null;
  }, [stats]);
  const tex = useMemo(() => (loaded && text ? makePlaqueTexture(text) : null), [loaded, text]);
  useEffect(() => () => tex?.dispose(), [tex]);
  if (!tex) return null;
  const height = 0.115;
  const centerY = (WOOD_BOTTOM + FOOT_BOTTOM) / 2;
  const t = (centerY + height / 2 - WOOD_BOTTOM) / (FOOT_BOTTOM - WOOD_BOTTOM);
  const b = (centerY - height / 2 - WOOD_BOTTOM) / (FOOT_BOTTOM - WOOD_BOTTOM);
  const top = WOOD_BOTTOM_RADIUS + 0.035 * t + 0.006;
  const bottom = WOOD_BOTTOM_RADIUS + 0.035 * b + 0.006;
  const thetaLength = Math.min((height * tex.userData.aspect) / ((top + bottom) / 2), 2.6);
  return (
    <mesh position={[0, centerY, 0]}>
      <cylinderGeometry args={[top, bottom, height, 48, 1, true, -thetaLength / 2, thetaLength]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

// engraved username: centered on the front of the wood
const NAME_HEIGHT = 0.6;
const NAME_CENTER_Y = -0.42;
const NAME_MAX_ARC = 1.35; // ~77°: wider than this, the ends curve out of view

/* Maker's mark burned into the back of the wood, opposite the name: only
   seen when the globe turns around */
const MARK_HEIGHT = 0.5;
function MakerMark({ year }) {
  const loaded = useFontsLoaded('Anta', '/assets/fonts/Anta-Regular.ttf');
  const tex = useMemo(() => (loaded ? makeMakerMarkTexture(year) : null), [loaded, year]);
  useEffect(() => () => tex?.dispose(), [tex]);
  if (!tex) return null;
  const top = woodRadiusAt(NAME_CENTER_Y + MARK_HEIGHT / 2) + 0.004;
  const bottom = woodRadiusAt(NAME_CENTER_Y - MARK_HEIGHT / 2) + 0.004;
  const thetaLength = MARK_HEIGHT / ((top + bottom) / 2);
  return (
    <mesh position={[0, NAME_CENTER_Y, 0]}>
      {/* centered on the back: three.js measures theta from +z (the front) */}
      <cylinderGeometry args={[top, bottom, MARK_HEIGHT, 24, 1, true, Math.PI - thetaLength / 2, thetaLength]} />
      {/* lit like the wood around it, so it reads as burned in, not printed on */}
      <meshStandardMaterial map={tex} transparent depthWrite={false} roughness={0.8} />
    </mesh>
  );
}

/* Wooden base with the username engraved front and center */
function Base({ username, woodYears, rankTitle, isMvp, stats, year }) {
  const metals = useMemo(() => getRankMetals(rankTitle), [rankTitle]);
  const [nameTex, setNameTex] = useState(null);
  // the username seeds this globe's own piece of wood; years on Trailhead
  // set its growth rings
  const woodTex = useMemo(() => makeWoodTexture({ username, years: woodYears }), [username, woodYears]);

  useEffect(
    () => () => {
      woodTex.map.dispose();
      woodTex.bumpMap.dispose();
    },
    [woodTex]
  );

  // bake the engraving only once the font is loaded, so measureText
  // sizes the arc for the real glyphs instead of the serif fallback
  useEffect(() => {
    if (!username) return undefined;
    let cancelled = false;
    loadFont('Great Vibes', '/assets/fonts/GreatVibes-Regular.ttf').then(() => {
      if (!cancelled) setNameTex(makeEngravedNameTexture(username));
    });
    return () => {
      cancelled = true;
    };
  }, [username]);

  // Engraving size: full height for most names; a long name shrinks so it
  // always stays on the readable front (at most NAME_MAX_ARC radians wide)
  // instead of wrapping around the sides of the base
  const nameLayout = useMemo(() => {
    if (!nameTex) return null;
    const radius = woodRadiusAt(NAME_CENTER_Y) + 0.025;
    const naturalArc = (NAME_HEIGHT * nameTex.userData.aspect) / radius;
    const shrink = Math.min(1, NAME_MAX_ARC / naturalArc);
    return { height: NAME_HEIGHT * shrink, arc: naturalArc * shrink };
  }, [nameTex]);
  // half the engraving's arc (radians), so the MVP rosette can sit beside it
  const nameHalfArc = nameLayout ? nameLayout.arc / 2 : 0.6;

  return (
    <group position={[0, BASE_TOP_Y, 0]} scale={[1, 0.95, 1]}>
      {/* rank ring where the wood meets the glass */}
      <RankRing radius={RING_RADIUS} y={(RING_CENTER_Y - BASE_TOP_Y) / 0.95} metals={metals} />
      {/* engraved stats plaque on the foot */}
      <FootPlaque stats={stats} />
      <MakerMark year={year} />
      {/* MVP rosette just left of the (always centered) name */}
      {isMvp && <MvpRosette rightEdge={-nameHalfArc - 0.04} />}
      {/* thetaStart π: the texture's wrap point faces away from the camera
          (three.js starts cylinders at +z, dead center in front) */}
      <mesh position={[0, (WOOD_TOP + WOOD_BOTTOM) / 2, 0]}>
        <cylinderGeometry
          args={[WOOD_TOP_RADIUS, WOOD_BOTTOM_RADIUS, WOOD_TOP - WOOD_BOTTOM, 64, 1, false, Math.PI, Math.PI * 2]}
        />
        <meshPhysicalMaterial
          map={woodTex.map}
          bumpMap={woodTex.bumpMap}
          bumpScale={0.6}
          roughness={0.62}
          metalness={0}
          // satin varnish: a soft sheen over the grain, not a plastic gloss
          clearcoat={0.35}
          clearcoatRoughness={0.38}
        />
      </mesh>
      {/* darker foot grounds the base and gives the tapered body more depth */}
      <mesh position={[0, (WOOD_BOTTOM + FOOT_BOTTOM) / 2, 0]}>
        <cylinderGeometry args={[WOOD_BOTTOM_RADIUS, WOOD_BOTTOM_RADIUS + 0.035, WOOD_BOTTOM - FOOT_BOTTOM, 96]} />
        <meshStandardMaterial color='#28140f' roughness={0.5} />
      </mesh>
      {nameTex &&
        (() => {
          // curved engraving hugging the wood: same taper as the base
          // cylinder, offset outward, arc width sized to the text length
          const { height } = nameLayout;
          const top = woodRadiusAt(NAME_CENTER_Y + height / 2) + 0.025;
          const bottom = woodRadiusAt(NAME_CENTER_Y - height / 2) + 0.025;
          const thetaLength = (height * nameTex.userData.aspect) / ((top + bottom) / 2);
          return (
            <mesh position={[0, NAME_CENTER_Y, 0]}>
              <cylinderGeometry args={[top, bottom, height, 24, 1, true, -thetaLength / 2, thetaLength]} />
              <meshBasicMaterial map={nameTex} transparent depthWrite={false} />
            </mesh>
          );
        })()}
    </group>
  );
}

export { SnowMound, GlobeShell, Base, RankRing, useRingEnvMap };
