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

const smoothstep = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

/* The snow floor of one globe: a squashed sphere resting above the seat,
   with drifts banked up against the glass. Its rim is sized to the glass at
   that height, so the snow meets the glass from inside.

   `level` (0..1) sets how deep it is: the user's progress toward their next
   Trailhead rank, so the globe fills up as they near it (1 = All Star
   Ranger). The mesh, the glints and the physics all read this same object,
   so flakes and badges land exactly on the visible surface. */
function makeSnowFloor(level = 0.45) {
  const l = Math.min(Math.max(Number.isFinite(level) ? level : 0.45, 0), 1);
  const centerY = GLASS_SEAT_Y + 0.06 + l * 0.36;
  const rx = glassRadiusAt(centerY) - 0.03;
  const ry = GLOBE_RADIUS * 0.96 * 0.18 * (0.6 + l * 0.65);
  const bankHeight = 0.26 * (0.55 + l * 0.7);

  /* Extra snow height at relative distance t (0 center → 1 rim), varying
     around the globe so the bank reads as drifts, not an even ring */
  const bank = (t, x, z) => {
    const angle = Math.atan2(z, x);
    const drift = 1 + 0.35 * Math.sin(3 * angle + 0.5) + 0.2 * Math.sin(7 * angle - 1.2);
    return bankHeight * drift * smoothstep(0.5, 1, t) ** 1.6;
  };

  /* Height of the snow surface at a given horizontal position */
  const surfaceY = (x, z) => {
    const d = Math.sqrt(x * x + z * z);
    const t = Math.min(d / rx, 1);
    const s = Math.sqrt(1 - t * t);
    return centerY + (ry + snowBump(x, z)) * s + bank(t, x, z);
  };

  return { level: l, centerY, rx, ry, bank, surfaceY };
}

// base group origin; the wood's top edge sits at local y 0.1 (group y scale 0.95)
const BASE_TOP_Y = GLASS_SEAT_Y - 0.095;
const BASE_BOTTOM_Y = BASE_TOP_Y - 0.95 * 0.95; // foot bottom (local -0.95, y scale 0.95)
const SCENE_TOP_Y = CENTER_Y + GLOBE_RADIUS + 0.15; // glass shell + wobble headroom
const SCENE_HALF_WIDTH = 2.5; // base radius + full shake sway

/* Smooth pseudo-noise drifts, shared by the render mesh and the physics floor */
function snowBump(x, z) {
  return (
    0.13 * Math.sin(x * 1.9 + 0.7) * Math.cos(z * 1.6 - 0.4) + 0.07 * Math.sin(x * 3.7 - 1.1) * Math.cos(z * 3.1 + 0.9)
  );
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
  GLASS_SEAT_Y,
  BASE_TOP_Y,
  BASE_BOTTOM_Y,
  SCENE_TOP_Y,
  SCENE_HALF_WIDTH,
  glassRadiusAt,
  smoothstep,
  makeSnowFloor,
  snowBump,
  proxied,
  randomPointInGlobe,
};
