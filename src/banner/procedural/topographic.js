import {
  H,
  W,
  cap,
  clamp,
  makeCalm,
  makeNoise,
  marchingSquares,
  paintBase,
  palette,
  resetCtx,
  rgba,
  seeded,
  strokeSegs,
  vignette,
} from './core.js';

// Topographic map: contour lines of a seeded terrain, certification families as dashed trails, superbadges as summits.
export function drawTopo(ctx, d) {
  const rng = seeded(d.username, 'topo');
  const noise = makeNoise(rng);
  const pal = palette(d.rankColor);
  const calm = makeCalm();
  resetCtx(ctx);
  paintBase(ctx, pal, rng, 0.08);

  const cell = 6;
  const cols = Math.ceil(W / cell);
  const rows = Math.ceil(H / cell);
  const grid = new Float32Array((cols + 1) * (rows + 1));
  const sc = 0.0022;
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const x = i * cell;
      const y = j * cell;
      grid[j * (cols + 1) + i] =
        noise(x * sc, y * sc) * 0.7 +
        noise(x * sc * 2.3 + 9, y * sc * 2.3) * 0.25 +
        noise(x * sc * 5, y * sc * 5 - 4) * 0.05;
    }
  }
  const levels = clamp(Math.round(12 + d.badges / 60), 12, cap(30));
  for (let l = 0; l < levels; l++) {
    const level = -0.8 + (1.6 * (l + 0.5)) / levels;
    const index = l % 5 === 0;
    const t = l / levels;
    ctx.strokeStyle = pal.c(-20 + t * 60, 60, 40 + t * 30, index ? 0.55 : 0.28);
    ctx.lineWidth = index ? 1.6 : 0.9;
    strokeSegs(ctx, marchingSquares(grid, cols, rows, cell, level));
  }

  const peaks = [];
  for (let j = 2; j < rows - 1; j++) {
    for (let i = 2; i < cols - 1; i++) {
      const v = grid[j * (cols + 1) + i];
      let top = true;
      for (let dj = -2; dj <= 2 && top; dj++)
        for (let di = -2; di <= 2; di++) if (grid[(j + dj) * (cols + 1) + i + di] > v) top = false;
      if (top) peaks.push({ x: i * cell, y: j * cell, v });
    }
  }
  peaks.sort((a, b) => b.v - a.v);

  ctx.setLineDash([7, 5]);
  ctx.lineCap = 'round';
  for (const cert of d.certs) {
    let x = rng() * W;
    let y = rng() * H;
    const steps = 30 + (cert.count ?? 1) * 12;
    ctx.strokeStyle = rgba(cert.color, 0.85);
    ctx.lineWidth = 2;
    ctx.shadowColor = rgba(cert.color, 0.7);
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < steps; s++) {
      const e = 2;
      const gx = noise((x + e) * sc, y * sc) - noise((x - e) * sc, y * sc);
      const gy = noise(x * sc, (y + e) * sc) - noise(x * sc, (y - e) * sc);
      const a = Math.atan2(gy, gx) + Math.PI / 2 + (rng() - 0.5) * 0.6;
      x = clamp(x + Math.cos(a) * 6, 4, W - 4);
      y = clamp(y + Math.sin(a) * 6, 4, H - 4);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;

  for (const pk of peaks.slice(0, Math.min(d.superbadges, cap(30)))) {
    const k = Math.max(calm(pk.x, pk.y), 0.5);
    ctx.fillStyle = pal.c(30, 90, 80, 0.9 * k);
    ctx.shadowColor = pal.c(30, 90, 70, 0.8);
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(pk.x, pk.y - 6);
    ctx.lineTo(pk.x + 5, pk.y + 3);
    ctx.lineTo(pk.x - 5, pk.y + 3);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  resetCtx(ctx);
  vignette(ctx);
}
