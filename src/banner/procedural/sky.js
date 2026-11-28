import {
  H,
  W,
  cap,
  clamp,
  gauss,
  glowDot,
  makeCalm,
  makeNoise,
  makePlacer,
  palette,
  resetCtx,
  rgba,
  seeded,
  vignette,
} from './core.js';

function spanningTree(points) {
  const inTree = [0];
  const edges = [];
  const rest = new Set(points.map((_, i) => i).slice(1));
  while (rest.size) {
    let best = null;
    for (const a of inTree) {
      for (const b of rest) {
        const dd = (points[a].x - points[b].x) ** 2 + (points[a].y - points[b].y) ** 2;
        if (!best || dd < best.dd) best = { a, b, dd };
      }
    }
    edges.push([best.a, best.b]);
    inTree.push(best.b);
    rest.delete(best.b);
  }
  return edges;
}

// "Badge Sky": one star per badge gathered along a seeded milky way, each certification
// is a constellation in its color, superbadges are the brightest stars, every 20 trails a shooting star.
export function drawSky(ctx, d) {
  const rng = seeded(d.username, 'sky');
  const noise = makeNoise(rng);
  const pal = palette(d.rankColor);
  const calm = makeCalm();
  const free = makeCalm(1);
  resetCtx(ctx);

  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, pal.c(-20, 55, 4));
  base.addColorStop(1, pal.c(10, 50, 9));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  const tilt = (rng() - 0.5) * 0.5;
  const bandY = (x) => H * (0.5 + 0.3 * noise(x * 0.0011, 5.3) + tilt * (x / W - 0.5));

  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 150; i++) {
    const x = rng() * W;
    const y = bandY(x) + gauss(rng) * 55;
    const r = 40 + rng() * 110;
    const pickHue = rng();
    const color = pickHue < 0.6 ? pal.c(0, 70, 50) : pickHue < 0.85 ? pal.c(42, 65, 50) : pal.c(-150, 40, 45);
    const a = (0.03 + rng() * 0.05) * (0.4 + 0.6 * calm(x, y));
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace(/,1\.000\)$/, `,${a.toFixed(3)})`));
    g.addColorStop(1, color.replace(/,1\.000\)$/, ',0)'));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  for (let i = 0; i < Math.min(d.badges, cap(4000)); i++) {
    const x = rng() * W;
    const y = rng() < 0.6 ? bandY(x) + gauss(rng) * 45 : rng() * H;
    const mag = rng() ** 3;
    const a = (0.25 + mag * 0.75) * calm(x, y);
    const tint = rng();
    const color = tint < 0.2 ? '#F2C6E8' : tint < 0.3 ? '#FFE9C4' : '#FFFFFF';
    if (mag > 0.6) glowDot(ctx, x, y, 6 + mag * 6, color, a * 0.35);
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 0.4 + mag * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const meteors = Math.min(6, Math.ceil(d.trails / 20));
  for (let i = 0; i < meteors; i++) {
    const x = 80 + rng() * (W - 160);
    const y = 20 + rng() * (H - 80);
    const len = 80 + rng() * 90;
    const ang = Math.PI * (0.06 + rng() * 0.08);
    const k = calm(x, y);
    const x2 = x - Math.cos(ang) * len;
    const y2 = y - Math.sin(ang) * len;
    const g = ctx.createLinearGradient(x, y, x2, y2);
    g.addColorStop(0, `rgba(255,255,255,${(0.75 * k).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const place = makePlacer(rng, free, { spreadWeight: 1.2 });

  // Personal: one constellation per certification family. Company: one per certification (see constellations)
  const groups = d.constellations ? d.constellations.slice(0, cap(40)) : d.certs;
  for (const cert of groups) {
    const c = place(90, W - 90);
    const count = cert.stars ? Math.min(cert.stars, 12) : Math.min(10, 3 + (cert.count ?? 2) + Math.floor(rng() * 2));
    const spread = cert.stars ? Math.min(1, 0.35 + count * 0.1) : 1;
    const stars = Array.from({ length: count }, () => ({
      x: clamp(c.x + (rng() - 0.5) * 170 * spread, 8, W - 8),
      y: clamp(c.y + (rng() - 0.5) * 110 * spread, 8, H - 8),
    }));
    ctx.strokeStyle = rgba(cert.color, 0.6);
    ctx.lineWidth = 1.2;
    for (const [a, b] of spanningTree(stars)) {
      const k = calm((stars[a].x + stars[b].x) / 2, (stars[a].y + stars[b].y) / 2);
      ctx.globalAlpha = Math.max(k, 0.3);
      ctx.beginPath();
      ctx.moveTo(stars[a].x, stars[a].y);
      ctx.lineTo(stars[b].x, stars[b].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const s of stars) {
      const k = Math.max(calm(s.x, s.y), 0.3);
      glowDot(ctx, s.x, s.y, 9, cert.color, 0.55 * k);
      ctx.fillStyle = `rgba(255,255,255,${(0.95 * k).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (let i = 0; i < Math.min(d.superbadges, cap(30)); i++) {
    const { x, y } = place();
    const k = Math.max(calm(x, y), 0.3);
    const size = 6 + rng() * 8;
    glowDot(ctx, x, y, size * 1.3, '#FFFFFF', 0.25 * k);
    const rays = rng() < 0.25 ? 6 : 4;
    const rot = rng() * Math.PI;
    for (let r = 0; r < rays; r++) {
      const a = rot + (r * 2 * Math.PI) / rays;
      const len = size * (r % 2 ? 0.55 + rng() * 0.3 : 0.9 + rng() * 0.4);
      const tx = x + Math.cos(a) * len;
      const ty = y + Math.sin(a) * len;
      const nx = -Math.sin(a) * 1.1;
      const ny = Math.cos(a) * 1.1;
      const g = ctx.createLinearGradient(x, y, tx, ty);
      g.addColorStop(0, pal.c(0, 70, 92, 0.85 * k));
      g.addColorStop(1, pal.c(0, 70, 92, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x + nx, y + ny);
      ctx.lineTo(tx, ty);
      ctx.lineTo(x - nx, y - ny);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = `rgba(255,255,255,${k.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  resetCtx(ctx);
  vignette(ctx);
}
