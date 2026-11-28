import { H, W, cap, clamp, makeCalm, makeNoise, paintBase, palette, resetCtx, rgba, seeded, vignette } from './core.js';

function clipPoly(poly, nx, ny, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    const da = nx * ax + ny * ay - c;
    const db = nx * bx + ny * by - c;
    if (da <= 0) out.push([ax, ay]);
    if (da <= 0 !== db <= 0) {
      const t = da / (da - db);
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
    }
  }
  return out;
}

function voronoi(sites) {
  return sites.map((s, i) => {
    let poly = [
      [-40, -40],
      [W + 40, -40],
      [W + 40, H + 40],
      [-40, H + 40],
    ];
    const nearest = sites
      .map((o, j) => ({ o, j, d: (o.x - s.x) ** 2 + (o.y - s.y) ** 2 }))
      .filter((e) => e.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 24);
    for (const { o } of nearest) {
      const nx = o.x - s.x;
      const ny = o.y - s.y;
      poly = clipPoly(poly, nx, ny, (nx * (s.x + o.x)) / 2 + (ny * (s.y + o.y)) / 2);
    }
    return { poly, neighbors: nearest.slice(0, 6).map((e) => e.j) };
  });
}

function centroid(poly) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  a /= 2;
  return a
    ? { x: cx / (6 * a), y: cy / (6 * a), r: Math.sqrt(Math.abs(a) / Math.PI) }
    : { x: poly[0][0], y: poly[0][1], r: 0 };
}

function inset(poly, c, amount) {
  return poly.map(([x, y]) => {
    const dx = c.x - x;
    const dy = c.y - y;
    const len = Math.hypot(dx, dy) || 1;
    const t = Math.min(0.5, amount / len);
    return [x + dx * t, y + dy * t];
  });
}

function sides(poly) {
  let n = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    if (Math.hypot(bx - ax, by - ay) > 4) n++;
  }
  return n;
}

function tracePoly(ctx, poly) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// "Certified Cells": a relaxed Voronoi mosaic, one cell per few badges; relaxation pulls cells
// toward hexagons (the Trailhead badge shape), true hexagons are subtly brighter.
// Certifications light up a cluster of cells in their color; superbadges are glowing badge-like cells.
export function drawCells(ctx, d) {
  const rng = seeded(d.username, 'cells');
  const noise = makeNoise(rng);
  const pal = palette(d.rankColor);
  // Cells are flat and low-contrast, so they only need a light fade behind content
  const calm = makeCalm(0.25);
  const free = makeCalm(1);
  resetCtx(ctx);
  paintBase(ctx, pal, rng, 0.1);

  const n = Math.round(Math.min(cap(260), 50 + Math.sqrt(d.badges) * 5));
  let sites = [];
  for (let i = 0; i < n; i++) {
    let best = null;
    let bestD = -1;
    for (let k = 0; k < 10; k++) {
      const c = { x: rng() * (W + 40) - 20, y: rng() * (H + 40) - 20 };
      let md = Infinity;
      for (const s of sites) md = Math.min(md, (s.x - c.x) ** 2 + ((s.y - c.y) * 1.3) ** 2);
      if (md > bestD) {
        bestD = md;
        best = c;
      }
    }
    sites.push(best);
  }
  let cells;
  for (let it = 0; it < 3; it++) {
    cells = voronoi(sites);
    sites = cells.map(({ poly }) => {
      const c = centroid(poly);
      return { x: clamp(c.x, -20, W + 20), y: clamp(c.y, -20, H + 20) };
    });
  }
  cells = voronoi(sites).map((cell) => ({ ...cell, c: centroid(cell.poly) }));

  const light = (x, y) => (noise(x * 0.0016, y * 0.0035) + 1) / 2;
  ctx.lineJoin = 'round';
  for (const cell of cells) {
    const { c } = cell;
    const L = light(c.x, c.y);
    const k = calm(c.x, c.y);
    const shape = inset(cell.poly, c, 3.5);
    tracePoly(ctx, shape);
    const g = ctx.createLinearGradient(c.x - c.r, c.y - c.r, c.x + c.r, c.y + c.r);
    g.addColorStop(0, pal.c(L * 40, 60, 9 + L * 22, (0.4 + L * 0.5) * k));
    g.addColorStop(1, pal.c(L * 40 - 15, 60, 4 + L * 10, (0.3 + L * 0.4) * k));
    ctx.fillStyle = g;
    ctx.fill();
    const hex = sides(cell.poly) === 6;
    ctx.lineWidth = hex ? 1.4 : 1;
    ctx.strokeStyle = pal.c(0, 80, 60 + L * 20, (0.12 + L * 0.3 + (hex ? 0.12 : 0)) * k);
    ctx.stroke();
  }

  const used = new Set();
  const pick = () => {
    let best = -1;
    let score = -1;
    cells.forEach((cell, i) => {
      if (used.has(i)) return;
      const spread = used.size
        ? Math.min(...[...used].map((u) => Math.hypot(cells[u].c.x - cell.c.x, cells[u].c.y - cell.c.y)))
        : 300;
      const s = free(cell.c.x, cell.c.y) + Math.min(spread, 300) / 300 + rng() * 0.3;
      if (s > score) {
        score = s;
        best = i;
      }
    });
    if (best >= 0) used.add(best);
    return best;
  };

  for (const cert of d.certs) {
    const first = pick();
    if (first < 0) break;
    const size = Math.min(7, 1 + (cert.count ?? 2));
    const cluster = [first];
    for (let q = 0; q < cluster.length && cluster.length < size; q++) {
      for (const j of cells[cluster[q]].neighbors) {
        if (cluster.length < size && !used.has(j) && !cluster.includes(j)) cluster.push(j);
      }
    }
    cluster.forEach((j) => used.add(j));
    for (const j of cluster) {
      const { c, poly } = cells[j];
      const k = Math.max(calm(c.x, c.y), 0.6);
      const shape = inset(poly, c, 4);
      tracePoly(ctx, shape);
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * 1.4);
      g.addColorStop(0, rgba(cert.color, 0.55 * k));
      g.addColorStop(1, rgba(cert.color, 0.12 * k));
      ctx.fillStyle = g;
      ctx.shadowColor = rgba(cert.color, 0.8 * k);
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = rgba(cert.color, 0.9 * k);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  for (let i = 0; i < Math.min(d.superbadges, cap(30)); i++) {
    const j = pick();
    if (j < 0) break;
    const { c, poly } = cells[j];
    const k = Math.max(calm(c.x, c.y), 0.6);
    ctx.shadowColor = pal.c(0, 90, 65, 0.9 * k);
    ctx.shadowBlur = 12;
    tracePoly(ctx, inset(poly, c, 4));
    ctx.fillStyle = pal.c(0, 85, 50, 0.18 * k);
    ctx.fill();
    ctx.shadowBlur = 0;
    for (let ring = 1; ring <= 2; ring++) {
      tracePoly(ctx, inset(poly, c, 4 + ring * 6));
      ctx.strokeStyle = pal.c(10, 90, 80, (0.7 - ring * 0.15) * k);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  resetCtx(ctx);
  vignette(ctx);
}
