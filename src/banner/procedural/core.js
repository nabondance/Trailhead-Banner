// Shared helpers for the procedural background styles: seeded randomness, noise, colors, layout.
// Plain Canvas 2D only, no getImageData/putImageData, so every style runs as-is on @napi-rs/canvas.

const RANK_ORDER = [
  'Scout',
  'Hiker',
  'Explorer',
  'Adventurer',
  'Mountaineer',
  'Expeditioner',
  'Ranger',
  'Double Star Ranger',
  'Triple Star Ranger',
  'Four Star Ranger',
  'Five Star Ranger',
  'All Star Ranger',
];

// Canvas size and the areas where the art fades (logo, counters, top badge row, watermark) for the
// banner being drawn. Module-level so every helper can read them; set by setFrame() right before a
// style draws, which is safe because drawing is synchronous.
export let W = 0;
export let H = 0;
let ZONES = [];

export function setFrame(width, height, zones) {
  W = width;
  H = height;
  ZONES = zones;
}

// Caps are tuned for the 1584×396 personal banner; smaller canvases get proportionally fewer elements
export const areaScale = () => (W * H) / (1584 * 396);

const FEATHER = 60;

function cyrb128(str) {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

function sfc32(a, b, c, d) {
  return function () {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function seeded(username, style) {
  const rng = sfc32(...cyrb128(`${String(username).toLowerCase()}|${style}`));
  for (let i = 0; i < 12; i++) rng();
  return rng;
}

export function makeNoise(rng) {
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  const corner = (x, y, g) => {
    let t = 0.5 - x * x - y * y;
    if (t < 0) return 0;
    t *= t;
    const gr = grad[g & 7];
    return t * t * (gr[0] * x + gr[1] * y);
  };
  return (xin, yin) => {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = 1 - i1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    return (
      70 *
      (corner(x0, y0, perm[ii + perm[jj]]) +
        corner(x1, y1, perm[ii + i1 + perm[jj + j1]]) +
        corner(x2, y2, perm[ii + 1 + perm[jj + 1]]))
    );
  };
}

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

const hsl = (h, s, l, a = 1) =>
  `hsla(${(((h % 360) + 360) % 360).toFixed(1)},${s.toFixed(1)}%,${l.toFixed(1)}%,${a.toFixed(3)})`;

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
}

export function palette(rankColor) {
  const [h] = hexToHsl(rankColor);
  return { c: (offset, s, l, a = 1) => hsl(h + offset, s, l, a) };
}

const smooth = (t) => t * t * (3 - 2 * t);

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 1 = free space, lower = behind banner content
export function makeCalm(strength = 0.65) {
  return (x, y) => {
    let m = 0;
    for (const z of ZONES) {
      const dx = Math.max(z.x0 - x, 0, x - z.x1);
      const dy = Math.max(z.y0 - y, 0, y - z.y1);
      const d = Math.hypot(dx, dy);
      if (d < FEATHER) m = Math.max(m, (1 - smooth(d / FEATHER)) * z.w);
    }
    return 1 - strength * m;
  };
}

export function makePlacer(rng, free, { spreadWeight = 1, margin = 20 } = {}) {
  const taken = [];
  return (x0 = margin, x1 = W - margin) => {
    let best = null;
    let score = -Infinity;
    for (let t = 0; t < 60; t++) {
      const x = x0 + rng() * (x1 - x0);
      const y = margin + rng() * (H - margin * 2);
      const spread = taken.length ? Math.min(...taken.map((c) => Math.hypot(c.x - x, c.y - y))) : 300;
      const s = free(x, y) * 3 + (Math.min(spread, 300) / 300) * spreadWeight;
      if (s > score) {
        score = s;
        best = { x, y };
      }
    }
    taken.push(best);
    return best;
  };
}

export function gauss(rng) {
  return Math.sqrt(-2 * Math.log(rng() || 1e-9)) * Math.cos(2 * Math.PI * rng());
}

export function paintBase(ctx, pal, rng, glow = 0.16) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, pal.c(-12, 45, 6));
  g.addColorStop(1, pal.c(25, 50, 10));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const r = 260 + rng() * 380;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    const off = i === 1 ? 42 : 0;
    rg.addColorStop(0, pal.c(off, 70, 45, glow));
    rg.addColorStop(1, pal.c(off, 70, 45, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = 'source-over';
}

export function vignette(ctx) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function resetCtx(ctx) {
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'rgba(0,0,0,0)';
}

export function glowDot(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export const rankTier = (rank) =>
  RANK_ORDER.includes(rank) ? RANK_ORDER.indexOf(rank) / (RANK_ORDER.length - 1) : 0.5;

export function familyPicker(d, rng) {
  const total = d.certs.reduce((a, c) => a + (c.count ?? 1), 0);
  return () => {
    let t = rng() * total;
    for (const c of d.certs) {
      t -= c.count ?? 1;
      if (t <= 0) return c;
    }
    return d.certs[0];
  };
}

export function marchingSquares(grid, cols, rows, cell, level) {
  const g = (i, j) => grid[j * (cols + 1) + i];
  const segs = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = g(i, j);
      const b = g(i + 1, j);
      const c = g(i + 1, j + 1);
      const dd = g(i, j + 1);
      const x = i * cell;
      const y = j * cell;
      const pts = [];
      if (a < level !== b < level) pts.push([x + (cell * (level - a)) / (b - a), y]);
      if (b < level !== c < level) pts.push([x + cell, y + (cell * (level - b)) / (c - b)]);
      if (dd < level !== c < level) pts.push([x + (cell * (level - dd)) / (c - dd), y + cell]);
      if (a < level !== dd < level) pts.push([x, y + (cell * (level - a)) / (dd - a)]);
      if (pts.length >= 2) segs.push([pts[0], pts[1]]);
      if (pts.length === 4) segs.push([pts[2], pts[3]]);
    }
  }
  return segs;
}

export function strokeSegs(ctx, segs) {
  ctx.beginPath();
  for (const [[x0, y0], [x1, y1]] of segs) {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  }
  ctx.stroke();
}

const PRODUCT_COLORS = {
  Platform: '#1B96FF',
  Agentforce: '#3EE0C0',
  'Data 360': '#FFC20E',
  Sales: '#45C65A',
  Service: '#7F6BFF',
  Marketing: '#FF6A3D',
  Commerce: '#9CEB5A',
  Experience: '#FF5D8F',
  Industries: '#8C9EFF',
  'CRM Analytics': '#00D2FF',
  MuleSoft: '#F25C54',
  Slack: '#E36BFF',
  Tableau: '#F2A93B',
};

const EXTRA_CERT_COLORS = ['#FF5D2D', '#45C65A', '#B07CFF', '#F38303', '#FF538A', '#0D9DDA', '#E8E36B', '#7AE582'];

// One entry per product family, so 70 certifications stay readable
export function certFamilies(certs) {
  const byProduct = new Map();
  for (const c of certs) {
    if (c.status?.expired || c.status?.title === 'Retired') continue;
    const product = c.product || 'Other';
    byProduct.set(product, (byProduct.get(product) || 0) + 1);
  }
  return [...byProduct].map(([product, count]) => ({
    product,
    count,
    color: PRODUCT_COLORS[product] || EXTRA_CERT_COLORS[cyrb128(product)[0] % EXTRA_CERT_COLORS.length],
  }));
}
