import * as THREE from 'three';

/* Globe dimensions and the physics constants shared by every module */
// Keep the glass visually dominant over the 2.055-wide wooden foot. The
// slight overhang matches traditional globes, where the orb meets or exceeds
// the base silhouette instead of looking perched on an oversized pedestal.
const GLOBE_RADIUS = 2.1;
const CENTER_Y = 0.4;
const DISPLAY_SCALE = 1.08;
const GLOBE_SEAT_DEPTH = 0.4;
const GRAVITY = 0.9; // very slow sink — floaty, underwater feel
const DRAG = 1.15;
const BOUNCE = 0.35;

const CENTER = new THREE.Vector3(0, CENTER_Y, 0);

// snow mound: squashed sphere at the globe floor
const MOUND_CENTER_Y = CENTER_Y - GLOBE_RADIUS + 0.24 + GLOBE_SEAT_DEPTH;
const MOUND_RX = GLOBE_RADIUS * 0.96 * 0.94;
const MOUND_RY = GLOBE_RADIUS * 0.96 * 0.18;

// The base and snow floor rise around the lower sphere so the glass is seated
// in the wood instead of balancing on its narrow bottom pole.
const BASE_TOP_Y = CENTER_Y - GLOBE_RADIUS + 0.1 + GLOBE_SEAT_DEPTH;
const BASE_BOTTOM_Y = BASE_TOP_Y - 0.9;
const SCENE_TOP_Y = CENTER_Y + GLOBE_RADIUS + 0.15; // glass shell + wobble headroom
const SCENE_HALF_WIDTH = 2.5; // base radius + full shake sway

/* Smooth pseudo-noise drifts, shared by the render mesh and the physics floor */
function snowBump(x, z) {
  return (
    0.13 * Math.sin(x * 1.9 + 0.7) * Math.cos(z * 1.6 - 0.4) + 0.07 * Math.sin(x * 3.7 - 1.1) * Math.cos(z * 3.1 + 0.9)
  );
}

/* Height of the snow surface at a given horizontal position */
function moundSurfaceY(x, z) {
  const d = Math.sqrt(x * x + z * z);
  const t = Math.min(d / MOUND_RX, 1);
  const s = Math.sqrt(1 - t * t);
  return MOUND_CENTER_Y + (MOUND_RY + snowBump(x, z)) * s;
}

function proxied(url, folder) {
  // same-origin API path (local artwork) — but not protocol-relative '//host'
  // URLs, which the browser would fetch cross-origin and taint the canvas
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  return `/api/snowglobe/image-proxy?url=${encodeURIComponent(url)}&folder=${folder}`;
}

function randomPointInGlobe(maxRadius) {
  const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
  if (v.lengthSq() > 1) v.normalize().multiplyScalar(Math.random());
  return v.multiplyScalar(maxRadius).add(CENTER);
}

export {
  GLOBE_RADIUS,
  CENTER_Y,
  DISPLAY_SCALE,
  GRAVITY,
  DRAG,
  BOUNCE,
  CENTER,
  MOUND_CENTER_Y,
  MOUND_RX,
  MOUND_RY,
  BASE_TOP_Y,
  BASE_BOTTOM_Y,
  SCENE_TOP_Y,
  SCENE_HALF_WIDTH,
  snowBump,
  moundSurfaceY,
  proxied,
  randomPointInGlobe,
};
