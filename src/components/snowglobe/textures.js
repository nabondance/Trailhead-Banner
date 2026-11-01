import * as THREE from 'three';

/* Canvas-generated textures and font/image loaders for the snow globe */

/* Six-spoke asterisk — the ✳-style flakes from the reference CSS snow globe */
function makeFlakeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(32 + Math.cos(a) * 24, 32 + Math.sin(a) * 24);
    ctx.lineTo(32 - Math.cos(a) * 24, 32 - Math.sin(a) * 24);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}

/* Snow crystal for superbadges: a translucent hexagonal ice plate at the
   heart, six tapered arms with two levels of side branches, a gold edge (the
   superbadge color of the standard banner, #f9a825) under white ice. Drawn
   for the 3D tumbling flakes, so it reads as a crystal from any angle. */
function makeBigFlakeTexture() {
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const c = S / 2;
  const arm = S * 0.46;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const branch = (x, y, angle, length, width) => {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  };
  const drawArms = (scale) => {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 - Math.PI / 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      // main arm, thicker at the root
      branch(c, c, a, arm * 0.92, 9 * scale);
      branch(c + dx * arm * 0.5, c + dy * arm * 0.5, a, arm * 0.5, 6 * scale);
      // side branches (dendrites), longer near the middle of the arm
      for (const [at, len] of [
        [0.34, 0.3],
        [0.56, 0.26],
        [0.76, 0.16],
      ]) {
        const bx = c + dx * arm * at;
        const by = c + dy * arm * at;
        for (const side of [-1, 1]) {
          const b = a + side * 1.0;
          branch(bx, by, b, arm * len, 5 * scale);
          // tiny twigs on the longest branches
          if (len > 0.2) {
            const tx = bx + Math.cos(b) * arm * len * 0.55;
            const ty = by + Math.sin(b) * arm * len * 0.55;
            branch(tx, ty, a, arm * 0.09, 3.5 * scale);
          }
        }
      }
    }
  };
  const hexagon = (r) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 - Math.PI / 2;
      const x = c + Math.cos(a) * r;
      const y = c + Math.sin(a) * r;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
  };

  // gold edge: the same crystal drawn wider underneath
  ctx.strokeStyle = 'rgba(249,168,37,0.95)';
  ctx.fillStyle = 'rgba(249,168,37,0.95)';
  drawArms(2.1);
  hexagon(S * 0.14);
  ctx.fill();

  // ice: bright arms, a translucent plate with a faceted inner hexagon
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  drawArms(1);
  hexagon(S * 0.11);
  ctx.fillStyle = 'rgba(225,240,255,0.75)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.stroke();
  hexagon(S * 0.05);
  ctx.strokeStyle = 'rgba(190,220,255,0.9)';
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* Soft powder motes fill the gaps between the crisp flakes. Keeping these
   round and diffuse makes the flurry feel layered instead of like a field of
   identical symbols. */
function makePowderTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const powder = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  powder.addColorStop(0, 'rgba(255,255,255,0.92)');
  powder.addColorStop(0.35, 'rgba(238,247,255,0.62)');
  powder.addColorStop(1, 'rgba(210,230,255,0)');
  ctx.fillStyle = powder;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* Pale blue-gray variation for the wind-sculpted mound. The geometry provides
   the large drifts; this supplies just enough grain and fine streaking for the
   light to read as snow rather than a flat white surface. */
function makeSnowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const base = ctx.createLinearGradient(0, 0, 0, canvas.height);
  base.addColorStop(0, '#ffffff');
  base.addColorStop(0.5, '#f0f6ff');
  base.addColorStop(1, '#cfdeef');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 420; i++) {
    const x = ((Math.sin(i * 91.73) + 1) / 2) * canvas.width;
    const y = ((Math.sin(i * 47.19 + 1.8) + 1) / 2) * canvas.height;
    const radius = 0.35 + ((Math.sin(i * 13.11) + 1) / 2) * 1.15;
    ctx.fillStyle = i % 4 === 0 ? 'rgba(124,160,202,0.08)' : 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // fine grain: thousands of tiny bright and cool specks, so the snow reads
  // as packed crystals up close instead of smooth plaster
  for (let i = 0; i < 6000; i++) {
    const x = (((Math.sin(i * 12.9898) * 43758.5453) % 1) + 1) % 1;
    const y = (((Math.sin(i * 78.233) * 24634.6345) % 1) + 1) % 1;
    const bright = i % 3 !== 0;
    ctx.fillStyle = bright ? 'rgba(255,255,255,0.4)' : 'rgba(140,170,210,0.2)';
    ctx.fillRect(x * canvas.width, y * canvas.height, bright ? 1.4 : 1.1, bright ? 1.4 : 1.1);
  }

  for (let line = 0; line < 7; line++) {
    const baseY = 90 + line * 44;
    ctx.beginPath();
    for (let x = -20; x <= canvas.width + 20; x += 12) {
      const y = baseY + Math.sin(x * 0.018 + line * 1.4) * (5 + line * 0.7);
      if (x === -20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = line % 2 ? 'rgba(119,154,196,0.055)' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/* Username engraved in gold on the wooden base: gold-leaf gradient letters
   set in a dark groove (shadow above = inset, lit from above). The @ is
   drawn smaller than the name, like a signature flourish. */
function makeEngravedNameTexture(username) {
  const canvas = document.createElement('canvas');
  // Great Vibes: flowing connected calligraphy with tall swashes
  const nameFont = '400 115px "Great Vibes", cursive';
  const atFont = '400 70px "Great Vibes", cursive';
  const gap = 6;
  let ctx = canvas.getContext('2d');
  ctx.font = atFont;
  const atW = ctx.measureText('@').width;
  ctx.font = nameFont;
  const nameW = ctx.measureText(username).width;
  canvas.width = Math.max(Math.ceil(atW + gap + nameW) + 100, 200);
  canvas.height = 220;
  ctx = canvas.getContext('2d');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const startX = (canvas.width - (atW + gap + nameW)) / 2;
  const drawLayer = (fillStyle, y) => {
    ctx.fillStyle = fillStyle;
    ctx.font = atFont;
    ctx.fillText('@', startX, y + 10);
    ctx.font = nameFont;
    ctx.fillText(username, startX + atW + gap, y);
  };
  // dark groove rim above the letters
  drawLayer('rgba(20,10,4,0.9)', 104);
  // gold leaf: light catches the top, deepens toward the bottom
  const gold = ctx.createLinearGradient(0, 50, 0, 170);
  gold.addColorStop(0, '#f6dd8b');
  gold.addColorStop(0.5, '#d4af37');
  gold.addColorStop(1, '#96751c');
  drawLayer(gold, 110);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.aspect = canvas.width / canvas.height;
  return tex;
}

/* Maker's mark burned into the back of the wood (only seen when the globe
   turns): a round pyrography stamp, double ring, snowflake, THB and the year.
   Dark brown with soft scorched edges; alpha only where the wood is burned. */
function makeMakerMarkTexture(year) {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const c = S / 2;
  ctx.strokeStyle = ctx.fillStyle = 'rgba(38,16,6,0.88)';
  ctx.shadowColor = 'rgba(30,12,4,0.7)';
  ctx.shadowBlur = 10; // scorched halo around every line
  ctx.lineCap = 'round';

  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(c, c, c - 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(c, c, c - 50, 0, Math.PI * 2);
  ctx.stroke();

  // six-armed snowflake above the letters
  const fx = c;
  const fy = c - 112;
  const arm = 44;
  ctx.lineWidth = 7;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + dx * arm, fy + dy * arm);
    // a small V on each arm
    const bx = fx + dx * arm * 0.6;
    const by = fy + dy * arm * 0.6;
    for (const side of [-1, 1]) {
      const b = a + side * 0.7;
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(b) * 16, by + Math.sin(b) * 16);
    }
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '400 130px Anta, sans-serif';
  ctx.fillText('THB', c, c + 22);
  ctx.font = '400 54px Anta, sans-serif';
  ctx.fillText(String(year), c, c + 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* Big soft specular blob — sells the glass more than transparency does */
function makeHighlightTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.25)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

/* Value noise that repeats every `period` cells along x, so a texture built
   from it wraps around the cylindrical base without a seam. */
function wrappedNoise(x, y, period, seed) {
  const hash = (ix, iy) => {
    const wx = ((ix % period) + period) % period;
    let h = Math.imul(wx, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/* Fractal noise (0..1) over the unit texture square: `cellsX` lattice cells
   around the base, doubled per octave so every octave still wraps. */
function wrappedFbm(u, v, cellsX, cellsY, octaves, seed) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const f = 2 ** o;
    sum += wrappedNoise(u * cellsX * f, v * cellsY * f, cellsX * f, seed + o) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

/* FNV-1a string hash → uint32 seed (a char-code sum would give "ab" and
   "ba" the same wood) */
function hashString(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
}

/* Small seeded PRNG (mulberry32) returning floats in [0, 1) */
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Growth rings across the base's height for a given number of years on
   Trailhead: young accounts get a few wide rings, veterans dense old growth */
function woodRingCount(years) {
  const y = Number.isFinite(years) && years > 0 ? years : 1;
  return Math.min(Math.max(4 + y * 2, 6), 26);
}

/* Turned walnut for the base, generated per pixel: growth rings bent by
   low-frequency noise (the arches and flames of real figure), uneven ring
   spacing and strength, broad heartwood color streaks, and fine pores
   stretched along the grain. Returns a color map plus a matching bump map
   so latewood lines and pores sit slightly recessed under the varnish.
   u runs around the base (wraps), v runs bottom (0) to top (1).

   Each Trailblazer gets their own piece of wood: the username seeds the
   grain and the knots, and their years on Trailhead set the ring count. */
function makeWoodTexture({ username = '', years = 1 } = {}) {
  const seed = hashString(username.toLowerCase() || 'trailhead');
  const random = seededRandom(seed);
  const rings = woodRingCount(years);
  // warp strengths scale with ring density, so the figure keeps its shape
  // and the rings never fold over each other at low counts
  const warpScale = rings / 15;
  const W = 2048;
  const H = 256;
  const color = new Uint8Array(W * H * 4);
  const bump = new Uint8Array(W * H * 4);

  const light = [146, 94, 58];
  const mid = [104, 63, 38];
  const dark = [70, 41, 25];
  const late = [40, 22, 13];
  const knotDark = [46, 24, 14];
  const knotLight = [92, 52, 29];

  // Wood eyes (knots). u = 0.5 faces the camera (the base cylinder starts
  // at the back) and the engraved username sits around it, so visible knots
  // go in the low and high bands beside the name, mirrored at random; one
  // more sits at the back. Sizes are in base units (~9.8 around, 0.93 tall).
  const CIRCUMFERENCE = 9.8;
  const HEIGHT = 0.93;
  const between = (min, max) => min + random() * (max - min);
  const makeKnot = (u, v, rx) => ({ u, v, rx, ry: rx * between(0.27, 0.36), seed: seed + Math.floor(random() * 1000) });
  const side = random() < 0.5 ? 1 : -1;
  const knots = [
    makeKnot(0.5 - side * between(0.06, 0.1), between(0.08, 0.17), between(0.14, 0.22)),
    makeKnot(0.5 + side * between(0.07, 0.11), between(0.8, 0.88), between(0.1, 0.16)),
    makeKnot(between(0.0, 0.1), between(0.3, 0.7), between(0.15, 0.22)),
  ];
  // about one in three pieces shows a single front knot
  if (random() < 0.35) knots.splice(1, 1);

  for (let j = 0; j < H; j++) {
    const v = (j + 0.5) / H;
    for (let i = 0; i < W; i++) {
      const u = (i + 0.5) / W;

      // ring coordinate: `rings` rings up the base, bent by two scales of warp so
      // the lines sweep into broad waves and the odd cathedral arch
      // (warp strengths are kept low enough vertically that rings never
      // fold back on themselves — folds smear into dark blotches)
      const sweep = wrappedFbm(u, v, 2, 0.7, 3, seed + 11) - 0.5;
      const warp = wrappedFbm(u, v, 6, 2, 3, seed + 17) - 0.5;
      // growth rate drifts with height, so ring spacing is uneven
      const growth = wrappedFbm(0.5, v, 1, 2, 3, seed + 29) - 0.5;
      let r = v * rings + (growth * 3.5 + sweep * 6 + warp * 2.2) * warpScale;

      // knots: rings part around each eye (pushed up above it, down below
      // it, fading with distance), and inside it its own rings take over
      let knotMask = 0;
      let knotShade = 0;
      let knotRim = 0;
      for (const knot of knots) {
        const dx = ((((u - knot.u) % 1) + 1.5) % 1) - 0.5; // wrapped around the base
        const nx = (dx * CIRCUMFERENCE) / knot.rx;
        const ny = ((v - knot.v) * HEIGHT) / knot.ry;
        const e = Math.sqrt(nx * nx + ny * ny);
        if (e > 9) continue;
        r -= 1.3 * Math.max(warpScale, 0.6) * Math.tanh(ny * 0.9) * Math.exp(-(nx * nx) / 10 - (ny * ny) / 14);
        if (e < 1.15) {
          // slightly irregular outline so the eye isn't a perfect ellipse
          const edge = e * (1 + (wrappedNoise(Math.atan2(ny, nx) * 2 + 10, 0.5, 1e6, knot.seed + 91) - 0.5) * 0.18);
          const inside = 1 - smoothstep(0.92, 1.0, edge);
          const knotRings = (edge * 4.5 + wrappedNoise(nx * 2 + 20, ny * 2, 1e6, knot.seed) * 0.6) % 1;
          knotMask = Math.max(knotMask, inside);
          knotShade = 0.35 + 0.4 * smoothstep(0.4, 1, knotRings) + 0.25 * (1 - smoothstep(0, 0.35, edge));
          knotRim = Math.max(knotRim, smoothstep(0.75, 0.97, edge) * (1 - smoothstep(0.97, 1.12, edge)));
        }
      }
      const ring = Math.floor(r);
      const p = r - ring;
      // per-ring character: some growth years are wider, darker or bolder
      const ringRand = wrappedNoise(ring * 7.31, 0.5, 1e6, seed + 37);
      const ringTone = wrappedNoise(ring * 3.17, 4.5, 1e6, seed + 41);
      // earlywood darkens gradually into a narrow latewood line with soft edges
      const peak = 0.86 + ringRand * 0.06;
      const lateWood = smoothstep(0.5 + ringRand * 0.2, peak, p) * (1 - smoothstep(peak, 1, p)) ** 0.7;
      // a faint secondary line inside some rings (false rings) breaks the rhythm
      const falseRing = ringRand > 0.6 ? smoothstep(0.08, 0, Math.abs(p - 0.42)) * 0.35 : 0;

      // broad color streaks across the timber
      const streak = wrappedFbm(u, v, 3, 0.8, 3, seed + 51);
      // pores: tiny dark dashes along the grain
      const pore = smoothstep(0.8, 0.97, wrappedNoise(u * 700, (r * 14) / warpScale, 700, seed + 67));
      // fibers: faint long strands that keep flat areas from looking painted
      const fiber = wrappedNoise(u * 260, (r * 9) / warpScale, 260, seed + 79) - 0.5;

      const k = (j * W + i) * 4;
      const tone = 0.88 + 0.12 * v; // slightly darker toward the foot
      for (let c = 0; c < 3; c++) {
        let value = mix(light[c], mid[c], smoothstep(0.3, 0.7, streak * 0.7 + ringTone * 0.3));
        value = mix(value, dark[c], smoothstep(0.6, 0.85, streak) * 0.5);
        value = mix(value, late[c], lateWood * (0.35 + ringRand * 0.35) + falseRing * 0.25);
        value *= 1 - pore * 0.16;
        value *= 1 + fiber * 0.07;
        // knot: darker heartwood with its own rings, a near-black rim
        const knotColor = mix(knotLight[c], knotDark[c], knotShade);
        value = mix(value, knotColor, knotMask);
        value = mix(value, late[c] * 0.7, knotRim * 0.85);
        color[k + c] = Math.max(0, Math.min(255, Math.round(value * tone)));
      }
      color[k + 3] = 255;

      const height = 1 - lateWood * 0.35 - pore * 0.3 + fiber * 0.05 - knotRim * 0.5 - knotMask * knotShade * 0.15;
      const h = Math.max(0, Math.min(255, Math.round(height * 220)));
      bump[k] = h;
      bump[k + 1] = h;
      bump[k + 2] = h;
      bump[k + 3] = 255;
    }
  }

  const finish = (tex) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  };
  const map = finish(new THREE.DataTexture(color, W, H, THREE.RGBAFormat));
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = finish(new THREE.DataTexture(bump, W, H, THREE.RGBAFormat));
  return { map, bumpMap };
}

/* Trophy plaque line engraved on the dark foot: all-time stats in muted gold
   Anta capitals, e.g. "848 BADGES · 412,000 POINTS · 120 TRAILS" */
function makePlaqueTexture(text) {
  const canvas = document.createElement('canvas');
  let ctx = canvas.getContext('2d');
  const font = '44px Anta, sans-serif';
  ctx.font = font;
  ctx.letterSpacing = '4px';
  canvas.width = Math.ceil(ctx.measureText(text).width) + 40;
  canvas.height = 72;
  ctx = canvas.getContext('2d');
  ctx.font = font;
  ctx.letterSpacing = '4px';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // dark groove under the letters, then the gold fill
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const gold = ctx.createLinearGradient(0, 14, 0, 58);
  gold.addColorStop(0, '#f1d58a');
  gold.addColorStop(0.55, '#c9a24a');
  gold.addColorStop(1, '#8a6a24');
  ctx.fillStyle = gold;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.userData.aspect = canvas.width / canvas.height;
  return tex;
}

/* MVP prize rosette, in the colors of the banner's MVP ribbon
   (assets/ribbons/mvp.svg): pleated navy and light-blue rosette, "MVP" in
   Anta on the center disc, two V-cut tails. Transparent around it. */
function makeMvpRosetteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext('2d');
  const cx = 256;
  const cy = 250;
  const navy = '#0d2b4e';
  const blue = '#40a2db';

  // tails first, behind the rosette
  [-1, 1].forEach((side) => {
    ctx.save();
    ctx.translate(cx + side * 62, cy + 120);
    ctx.rotate(side * 0.2);
    const w = 108;
    const h = 380;
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.lineTo(0, h - 62);
    ctx.lineTo(-w / 2, h);
    ctx.closePath();
    const tail = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    tail.addColorStop(0, '#0a2240');
    tail.addColorStop(0.5, '#173f6e');
    tail.addColorStop(1, '#0a2240');
    ctx.fillStyle = tail;
    ctx.fill();
    ctx.fillStyle = blue;
    ctx.fillRect(-w / 2 + 12, 0, 9, h - 24);
    ctx.fillRect(w / 2 - 21, 0, 9, h - 24);
    ctx.restore();
  });

  // pleated outer ring: alternating light and shadow wedges with a wavy edge
  const pleats = 32;
  for (let i = 0; i < pleats; i++) {
    const a0 = (i / pleats) * Math.PI * 2;
    const a1 = ((i + 1) / pleats) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a0) * 212, cy + Math.sin(a0) * 212);
    ctx.quadraticCurveTo(
      cx + Math.cos(am) * 240,
      cy + Math.sin(am) * 240,
      cx + Math.cos(a1) * 212,
      cy + Math.sin(a1) * 212
    );
    ctx.closePath();
    ctx.fillStyle = i % 2 ? '#123866' : '#1d4f8a';
    ctx.fill();
  }
  // light-blue pleated inner ring
  for (let i = 0; i < pleats; i++) {
    const a0 = (i / pleats) * Math.PI * 2;
    const a1 = ((i + 1) / pleats) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 158, a0, a1);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? '#3a93c9' : '#5cb6e6';
    ctx.fill();
  }
  // center disc with a soft dome highlight
  const disc = ctx.createRadialGradient(cx - 30, cy - 40, 10, cx, cy, 120);
  disc.addColorStop(0, '#1f5491');
  disc.addColorStop(1, navy);
  ctx.beginPath();
  ctx.arc(cx, cy, 116, 0, Math.PI * 2);
  ctx.fillStyle = disc;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, 104, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '86px Anta, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MVP', cx, cy + 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.userData.aspect = canvas.width / canvas.height;
  return tex;
}

/* Rank accent palette, mirrored from drawUtils.getRankAccentColor (drawUtils
   imports @napi-rs/canvas, which cannot load in the browser bundle) */
const RANK_ACCENTS = {
  Scout: '#F7C948',
  Hiker: '#F5A623',
  Explorer: '#F26B50',
  Adventurer: '#E84D30',
  Mountaineer: '#D93B4A',
  Expeditioner: '#C42E5C',
  Ranger: '#2196E8',
  'Double Star Ranger': '#3D6BDB',
  'Triple Star Ranger': '#5347C4',
  'Four Star Ranger': '#7142B8',
  'Five Star Ranger': '#9234A8',
  'All Star Ranger': '#B5278F',
};

/* Repo fonts for canvas text (Dela Gothic One = the rewind's display font,
   Great Vibes = the base engraving). Server-side canvases register TTFs via
   FontUtils; the browser needs them loaded through the FontFace API first. */
const fontsReady = {};
function loadFont(family, url, descriptors) {
  if (!fontsReady[family]) {
    fontsReady[family] = new FontFace(family, `url(${url})`, descriptors)
      .load()
      .then((loaded) => document.fonts.add(loaded))
      .catch(() => {
        /* font unavailable — the canvas falls back to the system stack */
      });
  }
  return fontsReady[family];
}

/* Seeded scene backdrop in the rewind style: #181818 base with flowing
   rank-colored curves, deterministic per username — same recipe as
   drawGeometricElements (seed = char codes, random via sin). Baked into
   scene.background so it shows through the glass AND lands in captures,
   which are otherwise composited on black. */
function makeBackdropTexture(username, rankTitle, year) {
  // 4:5 portrait design space, matching the globe box so nothing stretches.
  // The texture itself is supersampled to the snapshot resolution (2160×2700)
  // — at 1× it upscales ~2.8× onto the render buffer and everything in the
  // backdrop (title, year, watermark) comes out visibly pixelated.
  const W = 768;
  const H = 960;
  const SS = 2160 / W;
  const canvas = document.createElement('canvas');
  canvas.width = W * SS;
  canvas.height = H * SS;
  const ctx = canvas.getContext('2d');
  ctx.scale(SS, SS);
  const accent = RANK_ACCENTS[rankTitle] || '#22C3B5';
  const seed = (username || 'default').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (index) => (Math.sin(seed + index * 1.414) + 1) / 2;

  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#1d1d22');
  base.addColorStop(1, '#141418');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // flowing quadratic curves, rewind-style, kept clear of the globe center
  ctx.strokeStyle = accent;
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const y0 = random(i * 7 + 1) * H;
    ctx.globalAlpha = 0.12 + random(i * 7 + 2) * 0.16;
    ctx.lineWidth = 3 + random(i * 7 + 3) * 8;
    ctx.beginPath();
    ctx.moveTo(-60, y0);
    ctx.quadraticCurveTo(
      W * (0.2 + random(i * 7 + 4) * 0.3),
      y0 - 150 + random(i * 7 + 5) * 300,
      W * (0.5 + random(i * 7 + 6) * 0.2),
      y0 + 100 - random(i * 7 + 7) * 200
    );
    ctx.quadraticCurveTo(W * 0.85, y0 - 120 + random(i * 7 + 8) * 240, W + 60, y0 + 60 - random(i * 7 + 9) * 120);
    ctx.stroke();
  }

  // rewind-style flowing wave groups (drawFullFlowingPattern): bundles of
  // parallel sine lines sweeping the frame — a horizontal band, a diagonal,
  // and a vertical band, coordinates scaled from the 2160×2700 poster
  const wave = (type, seedOffset, base) => {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.13;
    for (let i = 0; i < 4; i++) {
      const amplitude = 22 + random(seedOffset + i) * 14;
      const phase = random(seedOffset + i + 20) * 6;
      ctx.beginPath();
      if (type === 'horizontal') {
        const baseY = base + i * 11;
        for (let x = -40; x <= W + 40; x += 8) {
          const progress = (x + 40) / (W + 80);
          const y = baseY + Math.sin(progress * Math.PI * 4 + phase) * amplitude;
          if (x === -40) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      } else if (type === 'vertical') {
        const baseX = base + i * 11;
        for (let y = -40; y <= H + 40; y += 8) {
          const progress = (y + 40) / (H + 80);
          const x = baseX + Math.sin(progress * Math.PI * 3 + phase) * amplitude;
          if (y === -40) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      } else {
        const angle = Math.atan2(H + 200, W + 200);
        const distance = Math.hypot(W + 200, H + 200);
        const perpX = Math.cos(angle + Math.PI / 2) * 11 * i;
        const perpY = Math.sin(angle + Math.PI / 2) * 11 * i;
        for (let dd = 0; dd <= distance; dd += 8) {
          const progress = dd / distance;
          const waveOffset = Math.sin(progress * Math.PI * 3 + phase) * amplitude;
          const x = -100 + Math.cos(angle) * dd + perpX + Math.cos(angle + Math.PI / 2) * waveOffset;
          const y = -100 + Math.sin(angle) * dd + perpY + Math.sin(angle + Math.PI / 2) * waveOffset;
          if (dd === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
  };
  wave('horizontal', 40, 120 + random(45) * 140);
  wave('diagonal', 50);
  wave('vertical', 70, 500 + random(75) * 180);

  // looping lines that swing out and back (drawLoopingPattern), lower third
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.11;
  for (let i = 0; i < 3; i++) {
    const amplitude = 36 + random(60 + i) * 28;
    const centerY = H * 0.6 + i * 75;
    ctx.beginPath();
    for (let x = -40; x <= W + 40; x += 6) {
      const progress = (x + 40) / (W + 80);
      const loop = Math.sin(progress * Math.PI);
      const y = centerY + Math.sin(progress * Math.PI * 6 + random(62 + i) * 6) * amplitude * loop + loop * 70;
      if (x === -40) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // one organic zigzag (drawZigzagPattern), seeded position and direction
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.16;
  {
    const segments = 8 + Math.floor(random(112) * 10);
    const zigLength = 280 + random(113) * 220;
    const zigAmp = 22 + random(114) * 28;
    const zigAngle = random(115) * Math.PI * 2;
    let zx = 110 + random(116) * 430;
    let zy = H * 0.3 + random(117) * 480;
    ctx.beginPath();
    ctx.moveTo(zx, zy);
    for (let i = 0; i < segments; i++) {
      const segmentLength = (zigLength / segments) * (0.2 + random(120 + i) * 1.6);
      const perpAngle = zigAngle + Math.PI / 2 + ((random(140 + i) - 0.5) * Math.PI) / 3;
      const direction = (i % 2 === 0 ? 1 : -1) * (0.7 + random(160 + i) * 0.6);
      zx += Math.cos(zigAngle) * segmentLength + Math.cos(perpAngle) * zigAmp * direction;
      zy += Math.sin(zigAngle) * segmentLength + Math.sin(perpAngle) * zigAmp * direction;
      ctx.lineTo(zx, zy);
    }
    ctx.stroke();
  }

  // filled confetti shapes (drawGeometricShapes): circles, rotated
  // triangles, rectangles — the vignette and the globe keep them peripheral
  ctx.fillStyle = accent;
  for (let i = 0; i < 5; i++) {
    ctx.globalAlpha = 0.16 + random(i + 28) * 0.1;
    ctx.beginPath();
    ctx.arc(random(i * 2 + 25) * W, random(i * 2 + 26) * H, 5 + random(i * 3 + 27) * 15, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 4; i++) {
    const size = 9 + random(i * 3 + 32) * 13;
    ctx.globalAlpha = 0.15 + random(i + 33) * 0.1;
    ctx.save();
    ctx.translate(random(i * 2 + 30) * W, random(i * 2 + 31) * H);
    ctx.rotate(random(i + 40) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.6);
    ctx.lineTo(-size * 0.8, size * 0.4);
    ctx.lineTo(size * 0.8, size * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.15 + random(i + 39) * 0.09;
    ctx.fillRect(
      random(i * 2 + 35) * W,
      random(i * 2 + 36) * H,
      14 + random(i * 3 + 37) * 29,
      7 + random(i * 3 + 38) * 14
    );
  }

  // a few faint accent circles in the corners
  ctx.strokeStyle = accent;
  for (let i = 0; i < 6; i++) {
    const cx = (i % 2 === 0 ? 0.04 + random(50 + i) * 0.18 : 0.78 + random(50 + i) * 0.18) * W;
    const cy = (i < 3 ? 0.05 + random(60 + i) * 0.25 : 0.7 + random(60 + i) * 0.25) * H;
    ctx.globalAlpha = 0.08 + random(70 + i) * 0.1;
    ctx.lineWidth = 2 + random(80 + i) * 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 12 + random(90 + i) * 46, 0, Math.PI * 2);
    ctx.stroke();
  }

  // vignette keeps the eye on the globe
  ctx.globalAlpha = 1;
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  // giant tilted year bleeding off the top-right corner — same treatment as
  // the rewind image's drawYearSection: huge chunky digits, tight negative
  // letter spacing, white over a blue offset shadow, cropped by the edges
  if (year) {
    ctx.save();
    ctx.translate(W + 50, 50);
    ctx.rotate((22 * Math.PI) / 180);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    // same font + spacing ratio as drawYearSection (400px / -80px at 2160w)
    ctx.font = '200 150px "Dela Gothic One", "Arial Black", sans-serif';
    ctx.letterSpacing = '-25px';
    ctx.fillStyle = '#2E9E5B';
    ctx.fillText(String(year), 12, 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(String(year), 0, 0);
    ctx.restore();
  }

  // branding, rewind-header style: title top-left (the year owns the right
  // corner), logo + site URL as a discreet footer — baked into the backdrop
  // so snapshots and video clips are share-ready without extra compositing
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '400 60px "Dela Gothic One", "Arial Black", sans-serif';
  ctx.fillStyle = '#2E9E5B';
  ctx.fillText('Trailhead', 50, 55);
  ctx.fillText('Rewind', 50, 110);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('Trailhead', 45, 50);
  ctx.fillText('Rewind', 45, 105);
  ctx.restore();

  // discreet watermark pill, same design and placement as the banner/rewind
  // artifacts (src/assets/watermarks/thb.svg, bottom-right corner). Drawn
  // natively — the SVG's remote @import font wouldn't rasterize in a canvas.
  // It carries the globe's personal link. Text and pill height never change:
  // a longer link only widens the pill to the left (its bottom-right corner
  // stays put), and past 85% of the image width it shows the plain Rewind
  // address instead.
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '400 22px Anta, sans-serif';
  const PILL_PADDING_X = 34; // both sides together
  const pillH = 31;
  let url = username ? `thb.nabondance.me/rewind/${year}/${username}` : 'thb.nabondance.me/rewind';
  if (ctx.measureText(url).width + PILL_PADDING_X > W * 0.85) url = 'thb.nabondance.me/rewind';
  const pillW = ctx.measureText(url).width + PILL_PADDING_X;
  const pillX = W - pillW - 14;
  const pillY = H - pillH - 14;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#DDDDDD';
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000000';
  ctx.fillText(url, pillX + pillW / 2, pillY + pillH / 2 + 1);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export {
  makeFlakeTexture,
  makeBigFlakeTexture,
  makePowderTexture,
  makeSnowTexture,
  makeEngravedNameTexture,
  makeMakerMarkTexture,
  makeHighlightTexture,
  makeWoodTexture,
  makeMvpRosetteTexture,
  makePlaqueTexture,
  RANK_ACCENTS,
  loadFont,
  makeBackdropTexture,
};
