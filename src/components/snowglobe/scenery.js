'use client';

import * as THREE from 'three';
import { useEffect, useMemo, useState } from 'react';
import { GLOBE_RADIUS, CENTER_Y, BASE_TOP_Y, snowBump } from './constants';
import {
  makeEngravedNameTexture,
  makeHighlightTexture,
  makeInteriorGlowTexture,
  makeWoodTexture,
  loadFont,
} from './textures';

/* Single displaced surface: the squashed sphere gets smooth drift bumps baked
   into its vertices, so the snow reads as one wind-blown mound instead of
   separate blobs. Displacement uses the same snowBump() as the physics. */
function SnowMound() {
  const geometry = useMemo(() => {
    const r = GLOBE_RADIUS * 0.96;
    const geo = new THREE.SphereGeometry(r, 64, 32);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) * 0.94;
      const z = pos.getZ(i) * 0.94;
      const y = pos.getY(i);
      let ny = y * 0.18;
      if (y > 0) ny += snowBump(x, z) * (y / r);
      pos.setXYZ(i, x, ny, z);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} position={[0, -GLOBE_RADIUS + 0.24, 0]}>
      <meshStandardMaterial color='#f2f7ff' roughness={0.92} />
    </mesh>
  );
}

/* Glass sphere with rim + specular highlight, and the snow mound floor */
function GlobeShell() {
  const highlightTex = useMemo(() => makeHighlightTexture(), []);
  const interiorGlowTex = useMemo(() => makeInteriorGlowTexture(), []);

  useEffect(
    () => () => {
      highlightTex.dispose();
      interiorGlowTex.dispose();
    },
    [highlightTex, interiorGlowTex]
  );

  return (
    <group position={[0, CENTER_Y, 0]}>
      {/* a quiet pool of winter light, behind the badges and snow */}
      <sprite position={[0, 0.12, -1.5]} scale={[3.45, 3.45, 1]} renderOrder={-1}>
        <spriteMaterial map={interiorGlowTex} transparent opacity={0.78} depthWrite={false} />
      </sprite>
      <mesh renderOrder={10}>
        <sphereGeometry args={[GLOBE_RADIUS + 0.02, 64, 64]} />
        <meshPhongMaterial
          color='#cfe8ff'
          transparent
          opacity={0.08}
          shininess={140}
          specular='#ffffff'
          depthWrite={false}
        />
      </mesh>
      {/* bright rim */}
      <mesh renderOrder={9}>
        <sphereGeometry args={[GLOBE_RADIUS + 0.07, 64, 64]} />
        <meshBasicMaterial color='#bfe0ff' transparent opacity={0.06} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {/* elongated shine hugging the upper-left rim, tilted along the glass curve */}
      <sprite position={[-0.85, 1.05, 1.5]} scale={[1.0, 0.4, 1]} renderOrder={12}>
        <spriteMaterial
          map={highlightTex}
          rotation={0.68}
          transparent
          opacity={0.35}
          depthWrite={false}
          depthTest={false}
        />
      </sprite>
      {/* small crisp shine below it */}
      <sprite position={[-1.15, 0.3, 1.55]} scale={[0.3, 0.2, 1]} renderOrder={12}>
        <spriteMaterial
          map={highlightTex}
          rotation={1.2}
          transparent
          opacity={0.5}
          depthWrite={false}
          depthTest={false}
        />
      </sprite>
      {/* snow floor: one organic drifted surface (matches moundSurfaceY) */}
      <SnowMound />
    </group>
  );
}

/* Wooden base with the username engraved front and center */
function Base({ username }) {
  const [nameTex, setNameTex] = useState(null);
  const woodTex = useMemo(() => makeWoodTexture(), []);

  useEffect(() => () => woodTex.dispose(), [woodTex]);

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
      {/* gold trim, wider than the snow rim so the mound sits in it like a
          bezel — tall enough that its top edge overlaps the mound's curve,
          otherwise a sliver of background shows between snow and ring */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[1.78, 1.84, 0.2, 48]} />
        <meshStandardMaterial color='#d4af37' metalness={0.75} roughness={0.3} />
      </mesh>
      {/* a fine polished edge catches light above the broader gold band */}
      <mesh position={[0, 0.092, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.78, 0.026, 10, 64]} />
        <meshStandardMaterial color='#f2d778' metalness={0.88} roughness={0.2} />
      </mesh>
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[1.84, 2.02, 0.8, 48]} />
        <meshPhysicalMaterial
          map={woodTex}
          bumpMap={woodTex}
          bumpScale={0.012}
          roughness={0.48}
          metalness={0.03}
          clearcoat={0.1}
          clearcoatRoughness={0.72}
        />
      </mesh>
      {/* darker foot grounds the base and gives the tapered body more depth */}
      <mesh position={[0, -0.915, 0]}>
        <cylinderGeometry args={[2.02, 2.055, 0.07, 48]} />
        <meshStandardMaterial color='#28140f' roughness={0.5} />
      </mesh>
      {nameTex &&
        (() => {
          // curved engraving hugging the wood: same taper as the base
          // cylinder, offset outward, arc width sized to the text length
          const height = 0.6;
          const thetaLength = Math.min((height * nameTex.userData.aspect) / 1.96, 2.4);
          return (
            <mesh position={[0, -0.5, 0]}>
              <cylinderGeometry args={[1.9, 2.0, height, 24, 1, true, -thetaLength / 2, thetaLength]} />
              <meshBasicMaterial map={nameTex} transparent depthWrite={false} />
            </mesh>
          );
        })()}
    </group>
  );
}

export { SnowMound, GlobeShell, Base };
