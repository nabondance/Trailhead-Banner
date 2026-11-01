import * as THREE from 'three';

/* Globe dimensions and the physics constants shared by every module */
const GLOBE_RADIUS = 2.1;
const CENTER_Y = 0.4;
const DISPLAY_SCALE = 1.08;
const GRAVITY = 0.9; // very slow sink — floaty, underwater feel
const DRAG = 1.15;
const BOUNCE = 0.35;

const CENTER = new THREE.Vector3(0, CENTER_Y, 0);

/* Horizontal radius of the glass sphere at a given height */
function glassRadiusAt(y) {
  const dy = y - CENTER_Y;
  return Math.sqrt(Math.max(GLOBE_RADIUS * GLOBE_RADIUS - dy * dy, 0));
}

// Where the glass enters the wooden base: high, so most of the sphere shows
const GLASS_SEAT_Y = CENTER_Y - 1.55;

// snow mound: squashed sphere at the globe floor, a layer above the seat.
// Its rim is sized to the glass at that height, so the snow meets the glass
// from inside instead of spilling out over the base
const MOUND_CENTER_Y = GLASS_SEAT_Y + 0.2;
const MOUND_RX = glassRadiusAt(MOUND_CENTER_Y) - 0.03;
const MOUND_RY = GLOBE_RADIUS * 0.96 * 0.18;
// snow banks up against the glass: extra height that ramps in near the rim
const MOUND_BANK = 0.26;

const smoothstep = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

/* Extra snow height at relative distance t (0 center → 1 rim), varying
   around the globe so the bank reads as drifts, not an even ring */
function snowBank(t, x, z) {
  const angle = Math.atan2(z, x);
  const drift = 1 + 0.35 * Math.sin(3 * angle + 0.5) + 0.2 * Math.sin(7 * angle - 1.2);
  return MOUND_BANK * drift * smoothstep(0.5, 1, t) ** 1.6;
}

// base group origin; the wood's top edge sits at local y 0.1 (group y scale 0.95)
const BASE_TOP_Y = GLASS_SEAT_Y - 0.095;
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
  return MOUND_CENTER_Y + (MOUND_RY + snowBump(x, z)) * s + snowBank(t, x, z);
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
  GLASS_SEAT_Y,
  BASE_TOP_Y,
  BASE_BOTTOM_Y,
  SCENE_TOP_Y,
  SCENE_HALF_WIDTH,
  glassRadiusAt,
  smoothstep,
  snowBank,
  snowBump,
  moundSurfaceY,
  proxied,
  randomPointInGlobe,
};
