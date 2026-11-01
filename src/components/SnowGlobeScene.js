'use client';

import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { CENTER, DISPLAY_SCALE, makeSnowFloor } from './snowglobe/constants';
import { getSnowStyle, getSparkles, getSnowfall } from './snowglobe/snowStyles';
import { makeBigFlakeTexture, makeFlakeTexture, makePowderTexture } from './snowglobe/textures';
import { SceneBackdrop } from './snowglobe/SceneBackdrop';
import { SnapshotHelper, CameraFitter } from './snowglobe/capture';
import { GlobeShell, Base } from './snowglobe/scenery';
import { Achievements, SnowSystem, SpinDriver, WobbleGroup } from './snowglobe/physics';

export default function SnowGlobeScene({
  achievements,
  rank,
  year,
  username,
  woodYears,
  snowLevel,
  topRank,
  agentblazerTitle,
  isMvp,
  activity,
  stats,
  shakeNonce,
  spinLocked = false,
  // design lab only: hold the globe turned (π = the back) and trigger a turn
  viewAngle = 0,
  spinNonce = 0,
  onReady,
}) {
  // floor depth from rank progress, snow kind from the year's Agentblazer rank
  const floor = useMemo(() => makeSnowFloor(snowLevel), [snowLevel]);
  const snowStyle = getSnowStyle(agentblazerTitle);
  const sparkles = useMemo(() => getSparkles(snowStyle, topRank), [snowStyle, topRank]);
  // falling snow: more flakes for more badges (all-time)
  const snowfall = getSnowfall(stats?.badges);
  const bigFlakes = Number.isFinite(stats?.superbadges) ? Math.max(0, stats.superbadges) : 0;
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
    spin: null,
  });

  /* Secret: 10 drags, swipes or arrow presses the same way in a row (each
     within 1.5 s of the last) turn the globe once around in that direction.
     Never while a video records, so it can't spoil the clip. */
  const spinLockedRef = useRef(spinLocked);
  spinLockedRef.current = spinLocked;
  const streak = useRef({ dir: 0, count: 0, last: 0 });
  const countMove = (dir) => {
    const w = world.current;
    if (w.spin || spinLockedRef.current) return;
    const now = performance.now();
    const s = streak.current;
    s.count = s.dir === dir && now - s.last < 1500 ? s.count + 1 : 1;
    s.dir = dir;
    s.last = now;
    if (s.count >= 10) {
      s.count = 0;
      w.spin = { dir, t: 0, swirled: false };
    }
  };
  const dragStartX = useRef(null);

  useEffect(() => {
    world.current.restAngle = viewAngle;
  }, [viewAngle]);
  useEffect(() => {
    if (spinNonce) world.current.spin = { dir: 1, t: 0, swirled: false };
  }, [spinNonce]);

  useEffect(() => {
    if (!shakeNonce) return;
    const w = world.current;
    w.wobble = 0.9; // 0.45s sway + settle
    w.shakeDir = Math.random() < 0.5 ? -1 : 1;
    // sideways-biased swirl: a random horizontal direction per item with a mild
    // upward kick, so the contents scatter instead of funneling to the top center
    w.items.forEach((it) => {
      if (it.embedded) return;
      const angle = Math.random() * Math.PI * 2;
      const mag = (2.5 + Math.random() * 2.5) * (it.kick ?? 1);
      it.vel.x += Math.cos(angle) * mag;
      it.vel.z += Math.sin(angle) * mag;
      it.vel.y += (0.6 + Math.random() * 2) * (it.kick ?? 1);
    });
    w.snowSystems.forEach(({ positions, velocities, count, kicks, settles, alphas, sizes, baseSizes }) => {
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
        if (settles) settles[i] = 0;
        if (alphas) alphas[i] = 1;
        if (sizes && baseSizes) sizes[i] = baseSizes[i];
      }
    });
  }, [shakeNonce]);

  const startDrag = (e) => {
    dragStartX.current = e.clientX;
    world.current.dragging = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const moveDrag = (e) => {
    if (!world.current.dragging) return;
    world.current.dragTarget = THREE.MathUtils.clamp(world.current.dragTarget + e.movementX * 0.005, -0.7, 0.7);
  };
  const endDrag = (e) => {
    const w = world.current;
    if (!w.dragging) return;
    // a drag or swipe of 30px or more counts toward the secret turn
    if (dragStartX.current != null && Number.isFinite(e?.clientX)) {
      const dx = e.clientX - dragStartX.current;
      if (Math.abs(dx) >= 30) countMove(Math.sign(dx));
    }
    dragStartX.current = null;
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

  // Arrow keys move the globe like a held drag: ← / → push it to that side,
  // releasing springs it back with the same snow puff as letting go of the
  // mouse. Ignored while typing in a field.
  const endDragRef = useRef(endDrag);
  endDragRef.current = endDrag;
  const countMoveRef = useRef(countMove);
  countMoveRef.current = countMove;
  useEffect(() => {
    const held = new Set();
    const isTyping = (target) => target?.closest?.('input, textarea, select, [contenteditable="true"]');
    const onKeyDown = (e) => {
      if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || isTyping(e.target)) return;
      e.preventDefault(); // no horizontal page scroll
      if (!e.repeat) countMoveRef.current(e.key === 'ArrowLeft' ? -1 : 1);
      held.add(e.key);
      const w = world.current;
      w.dragging = true;
      w.dragTarget = e.key === 'ArrowLeft' ? -0.55 : 0.55;
    };
    const onKeyUp = (e) => {
      if (!held.delete(e.key) || held.size) return;
      endDragRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  return (
    <div
      // pan-y: vertical swipes still scroll the page on phones (the globe fills
      // most of the screen there), horizontal drags shake the globe
      style={{ width: '100%', height: '100%', cursor: 'grab', touchAction: 'pan-y' }}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onPointerCancel={endDrag}
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
        <SpinDriver world={world} />
        <WobbleGroup world={world}>
          <group scale={DISPLAY_SCALE}>
            <GlobeShell world={world} floor={floor} sparkles={sparkles} activity={activity} />
            <Base
              username={username}
              woodYears={woodYears}
              rankTitle={rank?.title}
              isMvp={isMvp}
              stats={stats}
              year={year}
            />
            <Achievements world={world} achievements={tumblingItems} floor={floor} />
            {/* Two visual layers (300 to 1,000 particles, from the badge
                count): defined flakes carry the foreground while softer
                powder adds depth. */}
            <SnowSystem
              key={`flakes-${snowfall.flakes}`}
              world={world}
              floor={floor}
              count={snowfall.flakes}
              makeTexture={makeFlakeTexture}
              minSize={0.055}
              maxSize={0.18}
              opacity={0.9}
              settledOpacity={0.22}
              {...snowStyle.flakes}
            />
            <SnowSystem
              key={`powder-${snowfall.powder}`}
              world={world}
              floor={floor}
              count={snowfall.powder}
              makeTexture={makePowderTexture}
              minSize={0.025}
              maxSize={0.095}
              opacity={0.68}
              settledOpacity={0.06}
              gravityScale={0.72}
              kickScale={1.12}
              {...snowStyle.powder}
            />
            {/* one big gold-edged flake per superbadge: falls slower and
                stays fully visible once it lands, so they can be counted */}
            {bigFlakes > 0 && (
              <SnowSystem
                key={`superbadges-${bigFlakes}`}
                world={world}
                floor={floor}
                count={bigFlakes}
                makeTexture={makeBigFlakeTexture}
                {...snowStyle.flakes}
                minSize={0.3}
                maxSize={0.4}
                opacity={1}
                settledOpacity={1}
                gravityScale={0.7}
              />
            )}
          </group>
        </WobbleGroup>
      </Canvas>
    </div>
  );
}
