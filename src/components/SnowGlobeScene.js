'use client';

import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { CENTER, DISPLAY_SCALE } from './snowglobe/constants';
import { makeFlakeTexture } from './snowglobe/textures';
import { SceneBackdrop } from './snowglobe/SceneBackdrop';
import { SnapshotHelper, CameraFitter } from './snowglobe/capture';
import { GlobeShell, Base } from './snowglobe/scenery';
import { Achievements, SnowSystem, WobbleGroup } from './snowglobe/physics';

export default function SnowGlobeScene({ achievements, rank, year, username, shakeNonce, onReady }) {
  // supersample 1.5× beyond the display's pixel ratio (capped) for a crisper globe
  const dpr = Math.min(window.devicePixelRatio * 1.5, 3);
  // the rank emblem tumbles with the achievements (the base now carries the username)
  const tumblingItems = useMemo(() => {
    const list = [...(achievements || [])];
    if (rank?.logoUrl) list.push({ type: 'rank', name: rank.title || 'Rank', logoUrl: rank.logoUrl, folder: 'images' });
    return list;
  }, [achievements, rank]);
  const world = useRef({
    items: [],
    snowSystems: [],
    wobble: 0,
    shakeDir: 1,
    shakePos: 0,
    shakeVel: 0,
    dragging: false,
    dragTarget: 0,
    dragPos: 0,
    dragVel: 0,
    prevPosX: 0,
    prevVelX: 0,
  });

  useEffect(() => {
    if (!shakeNonce) return;
    const w = world.current;
    w.wobble = 0.9; // 0.45s sway + settle
    w.shakeDir = Math.random() < 0.5 ? -1 : 1;
    // sideways-biased swirl: a random horizontal direction per item with a mild
    // upward kick, so the contents scatter instead of funneling to the top center
    w.items.forEach((it) => {
      const angle = Math.random() * Math.PI * 2;
      const mag = (2.5 + Math.random() * 2.5) * (it.kick ?? 1);
      it.vel.x += Math.cos(angle) * mag;
      it.vel.z += Math.sin(angle) * mag;
      it.vel.y += (0.6 + Math.random() * 2) * (it.kick ?? 1);
    });
    w.snowSystems.forEach(({ positions, velocities, count, kicks }) => {
      for (let i = 0; i < count; i++) {
        const ix = i * 3;
        const kick = kicks ? kicks[i] : 1;
        // push outward from the vertical axis (plus a mild swirl) so the
        // flurry fills the globe's width — an upward-biased kick funnels
        // every flake into a geyser up the middle
        const px = positions[ix] - CENTER.x;
        const pz = positions[ix + 2] - CENTER.z;
        const r = Math.sqrt(px * px + pz * pz);
        const angle = Math.random() * Math.PI * 2;
        const outX = r > 0.05 ? px / r : Math.cos(angle);
        const outZ = r > 0.05 ? pz / r : Math.sin(angle);
        const mag = (2 + Math.random() * 3) * kick;
        velocities[ix] += outX * mag * 0.7 + Math.cos(angle) * mag * 0.5;
        velocities[ix + 2] += outZ * mag * 0.7 + Math.sin(angle) * mag * 0.5;
        // cap the upward speed: rapid repeated shakes otherwise stack vertical
        // velocity until the whole flurry jams against the dome apex
        velocities[ix + 1] = Math.min(velocities[ix + 1] + (0.5 + Math.random() * 1.4) * kick, 2.6);
      }
    });
  }, [shakeNonce]);

  const startDrag = (e) => {
    world.current.dragging = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const moveDrag = (e) => {
    if (!world.current.dragging) return;
    world.current.dragTarget = THREE.MathUtils.clamp(world.current.dragTarget + e.movementX * 0.005, -0.7, 0.7);
  };
  const endDrag = () => {
    const w = world.current;
    if (!w.dragging) return;
    w.dragging = false;
    w.dragTarget = 0;
    // releasing the globe puffs the snow outward in random horizontal
    // directions — held-drag inertia otherwise herds the flakes against the
    // dome and they drain down the middle as a column
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
  };

  return (
    <div
      style={{ width: '100%', height: '100%', cursor: 'grab', touchAction: 'none' }}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      <Canvas
        fallback={
          <div style={{ textAlign: 'center', paddingTop: '4rem' }}>
            WebGL is not available in this browser — the snow globe needs it.
            <br />
            Check chrome://gpu and that hardware acceleration is enabled.
          </div>
        }
        dpr={dpr}
        camera={{ position: [0, 0.2, 7], fov: 42 }}
        gl={{ preserveDrawingBuffer: true, antialias: true, powerPreference: 'high-performance', alpha: true }}
        onCreated={({ gl }) => {
          // without preventDefault the browser never restores a lost WebGL
          // context and the globe stays blank forever
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            console.warn('[Snowglobe] WebGL context lost — waiting for restore');
          });
          gl.domElement.addEventListener('webglcontextrestored', () => {
            console.warn('[Snowglobe] WebGL context restored');
          });
        }}
      >
        <SceneBackdrop username={username} rankTitle={rank?.title} year={year} />
        <ambientLight intensity={1.1} />
        <directionalLight position={[4, 6, 3]} intensity={2.4} />
        <pointLight position={[0, 3, 2.5]} intensity={12} color='#bcd7ff' />
        <CameraFitter />
        <SnapshotHelper onReady={onReady} />
        <WobbleGroup world={world}>
          <group scale={DISPLAY_SCALE}>
            <GlobeShell />
            <Base username={username} />
            <Achievements world={world} achievements={tumblingItems} />
            {/* ✳ one flake pool — every particle gets its own random size and
                weight (gravity/drag/kick), drawn independently */}
            <SnowSystem world={world} count={680} makeTexture={makeFlakeTexture} />
          </group>
        </WobbleGroup>
      </Canvas>
    </div>
  );
}
