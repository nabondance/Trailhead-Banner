'use client';

import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import {
  GLOBE_RADIUS,
  CENTER_Y,
  BASE_TOP_Y,
  BASE_BOTTOM_Y,
  SCENE_TOP_Y,
  SCENE_HALF_WIDTH,
  DISPLAY_SCALE,
} from './constants';

/* Exposes a high-resolution capture: temporarily bumps the renderer's pixel
   ratio, renders one frame, snapshots it, then restores the live settings.
   The on-screen buffer is display-sized — reading it directly gives the
   low-res image, so a snapshot needs its own oversized render. */
function SnapshotHelper({ onReady }) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    if (!onReady) return;
    const capture = (cb, targetWidth = 2160) => {
      // 2160 wide on the 4:5 box → 2160×2700, same as the rewind image
      const canvas = gl.domElement;
      const prevRatio = gl.getPixelRatio();
      gl.setPixelRatio(targetWidth / canvas.clientWidth);
      gl.render(scene, camera);
      canvas.toBlob(cb, 'image/png'); // grabs the bitmap synchronously, encodes async
      gl.setPixelRatio(prevRatio);
      gl.render(scene, camera);
    };
    onReady({ gl, capture });
  }, [gl, scene, camera, onReady]);

  return null;
}

/* Fit the camera so the whole globe + base is in frame at any container aspect,
   then verify the extreme points actually project inside the viewport. */
function CameraFitter() {
  const { camera, size } = useThree();

  useEffect(() => {
    const midY = (SCENE_TOP_Y + BASE_BOTTOM_Y) / 2;
    const halfH = ((SCENE_TOP_Y - BASE_BOTTOM_Y) / 2) * 1.06;
    const halfW = SCENE_HALF_WIDTH * 1.06;
    const aspect = size.width / size.height;
    const vFov = (camera.fov * Math.PI) / 180;
    const distV = halfH / Math.tan(vFov / 2);
    const distH = halfW / (Math.tan(vFov / 2) * aspect);
    // + GLOBE_RADIUS: the sphere bulges toward the camera, the z=0 plane math ignores that
    const dist = Math.max(distV, distH) + GLOBE_RADIUS;
    camera.position.set(0, midY, dist);
    camera.lookAt(0, midY, 0);
    camera.updateProjectionMatrix();

    // crop check: every extreme point must land inside normalized device coords
    const extremes = [
      [0, SCENE_TOP_Y * DISPLAY_SCALE, 0],
      [0, BASE_BOTTOM_Y * DISPLAY_SCALE, 0],
      [-SCENE_HALF_WIDTH * DISPLAY_SCALE, (BASE_TOP_Y - 0.3) * DISPLAY_SCALE, 0],
      [SCENE_HALF_WIDTH * DISPLAY_SCALE, (BASE_TOP_Y - 0.3) * DISPLAY_SCALE, 0],
      [(-GLOBE_RADIUS - 0.07) * DISPLAY_SCALE, CENTER_Y * DISPLAY_SCALE, 0],
      [(GLOBE_RADIUS + 0.07) * DISPLAY_SCALE, CENTER_Y * DISPLAY_SCALE, 0],
      [0, CENTER_Y * DISPLAY_SCALE, (GLOBE_RADIUS + 0.07) * DISPLAY_SCALE],
    ];
    const cropped = extremes.filter(([x, y, z]) => {
      const p = new THREE.Vector3(x, y, z).project(camera);
      return Math.abs(p.x) > 1 || Math.abs(p.y) > 1;
    });
    if (cropped.length > 0) {
      console.warn('[Snowglobe] crop check FAILED for points:', JSON.stringify(cropped));
    } else {
      console.log('[Snowglobe] crop check OK');
    }
  }, [camera, size]);

  return null;
}

export { SnapshotHelper, CameraFitter };
