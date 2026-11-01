'use client';

import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  GLOBE_RADIUS,
  CENTER_Y,
  MOUND_CENTER_Y,
  GLASS_SEAT_Y,
  MOUND_RX,
  MOUND_RY,
  BASE_TOP_Y,
  glassRadiusAt,
  smoothstep,
  snowBank,
  snowBump,
} from './constants';
import { makeEngravedNameTexture, makeHighlightTexture, makeSnowTexture, makeWoodTexture, loadFont } from './textures';

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
    float rim = pow(1.0 - clamp(dot(vNormal, vViewDirection), 0.0, 1.0), 2.35);
    gl_FragColor = vec4(uColor, rim * 0.2);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/* Single displaced surface: the squashed sphere gets smooth drift bumps baked
   into its vertices, so the snow reads as one wind-blown mound instead of
   separate blobs. Displacement uses the same snowBump() as the physics. */
function SnowMound() {
  const snowTex = useMemo(() => makeSnowTexture(), []);
  const geometry = useMemo(() => {
    const r = GLOBE_RADIUS * 0.96;
    const geo = new THREE.SphereGeometry(r, 64, 32);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) * (MOUND_RX / r);
      const z = pos.getZ(i) * (MOUND_RX / r);
      const y = pos.getY(i);
      let ny = y * (MOUND_RY / r);
      let stretch = 1;
      if (y < 0) {
        // underside fills the bottom of the glass down into the wood, so
        // the snow reads as one layer resting in the glass
        ny = (y / r) * (MOUND_CENTER_Y - GLASS_SEAT_Y + 0.06);
        const rad = Math.sqrt(x * x + z * z);
        if (rad > 1e-6) stretch = Math.max(glassRadiusAt(MOUND_CENTER_Y + ny) - 0.03, 0) / rad;
      } else {
        if (y > 0) ny += snowBump(x, z) * (y / r);
        // bank the snow up against the glass, and push the raised rim out to
        // follow the glass as it widens upward (matches moundSurfaceY)
        const t = Math.min(Math.sqrt(x * x + z * z) / MOUND_RX, 1);
        ny += snowBank(t, x, z);
        const glassR = glassRadiusAt(MOUND_CENTER_Y + ny) - 0.03;
        stretch = 1 + (glassR / MOUND_RX - 1) * smoothstep(0.5, 1, t);
      }
      pos.setXYZ(i, x * stretch, ny, z * stretch);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      snowTex.dispose();
    },
    [geometry, snowTex]
  );

  return (
    <mesh geometry={geometry} position={[0, MOUND_CENTER_Y - CENTER_Y, 0]}>
      <meshPhysicalMaterial
        map={snowTex}
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
// glare spots in the globe's local space, at rest
const GLARES = [
  { position: [-0.85, 1.05, 1.5], scale: [1.0, 0.4, 1], rotation: 0.68, opacity: 0.35 },
  { position: [-1.15, 0.3, 1.55], scale: [0.3, 0.2, 1], rotation: 1.2, opacity: 0.5 },
];

function GlobeShell({ world }) {
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
    GLARES.forEach((glare, i) => {
      const sprite = glareRefs.current[i];
      if (!sprite) return;
      const [x, y, z] = glare.position;
      sprite.position.set(x * cos - y * sin - sway * 0.3, x * sin + y * cos, z);
      sprite.material.opacity = glare.opacity * (1 + speed * 0.12);
    });
  });

  const highlightTex = useMemo(() => makeHighlightTexture(), []);
  const rimUniforms = useMemo(() => ({ uColor: { value: new THREE.Color('#d8efff') } }), []);

  useEffect(() => () => highlightTex.dispose(), [highlightTex]);

  return (
    <group position={[0, CENTER_Y, 0]}>
      <mesh renderOrder={10}>
        <sphereGeometry args={[GLOBE_RADIUS + 0.02, 64, 64]} />
        <meshPhongMaterial
          color='#cfe8ff'
          transparent
          opacity={0.035}
          shininess={180}
          specular='#ffffff'
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
      {/* snow floor: one organic drifted surface (matches moundSurfaceY) */}
      <SnowMound />
    </group>
  );
}

// the collar's top edge sits just outside the glass (base group: y scaled 0.95)
// Wood body in the base group's local space (the group scales y by 0.95):
// its top edge meets the glass at the seat, and it flares gently to the foot
const WOOD_TOP = 0.1;
const WOOD_BOTTOM = -0.88;
const WOOD_TOP_RADIUS = glassRadiusAt(GLASS_SEAT_Y) + 0.03;
const WOOD_BOTTOM_RADIUS = WOOD_TOP_RADIUS + 0.22;
const woodRadiusAt = (y) =>
  WOOD_BOTTOM_RADIUS + ((WOOD_TOP_RADIUS - WOOD_BOTTOM_RADIUS) * (y - WOOD_BOTTOM)) / (WOOD_TOP - WOOD_BOTTOM);

/* Wooden base with the username engraved front and center */
function Base({ username, woodYears }) {
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

  return (
    <group position={[0, BASE_TOP_Y, 0]} scale={[1, 0.95, 1]}>
      {/* thin gold lip where the wood meets the glass */}
      <mesh position={[0, WOOD_TOP, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[WOOD_TOP_RADIUS, 0.03, 12, 96]} />
        <meshStandardMaterial color='#e8c45c' metalness={0.88} roughness={0.22} />
      </mesh>
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
      <mesh position={[0, -0.915, 0]}>
        <cylinderGeometry args={[WOOD_BOTTOM_RADIUS, WOOD_BOTTOM_RADIUS + 0.035, 0.07, 64]} />
        <meshStandardMaterial color='#28140f' roughness={0.5} />
      </mesh>
      {nameTex &&
        (() => {
          // curved engraving hugging the wood: same taper as the base
          // cylinder, offset outward, arc width sized to the text length
          const height = 0.6;
          const centerY = -0.42;
          const top = woodRadiusAt(centerY + height / 2) + 0.025;
          const bottom = woodRadiusAt(centerY - height / 2) + 0.025;
          const thetaLength = Math.min((height * nameTex.userData.aspect) / ((top + bottom) / 2), 2.4);
          return (
            <mesh position={[0, centerY, 0]}>
              <cylinderGeometry args={[top, bottom, height, 24, 1, true, -thetaLength / 2, thetaLength]} />
              <meshBasicMaterial map={nameTex} transparent depthWrite={false} />
            </mesh>
          );
        })()}
    </group>
  );
}

export { SnowMound, GlobeShell, Base };
