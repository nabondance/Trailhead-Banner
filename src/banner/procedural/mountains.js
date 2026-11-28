import {
  W,
  H,
  clamp,
  glowDot,
  makeCalm,
  makeNoise,
  palette,
  rankTier,
  resetCtx,
  rgba,
  seeded,
  vignette,
} from './core.js';

// Mountains: layered noise mountains, a dotted hiking path per certification family in its color.
export function drawMountains(ctx, d) {
  const rng = seeded(d.username, 'mountains');
  const noise = makeNoise(rng);
  const pal = palette(d.rankColor);
  const calm = makeCalm();
  const tier = rankTier(d.rank);
  resetCtx(ctx);

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, pal.c(-25, 50, 7));
  sky.addColorStop(0.6, pal.c(0, 55, 16 + tier * 10));
  sky.addColorStop(1, pal.c(30, 70, 32 + tier * 14));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const sunX = W * (0.15 + rng() * 0.7);
  const sunY = H * (0.3 + (1 - tier) * 0.2);
  ctx.globalCompositeOperation = 'lighter';
  const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 300);
  sg.addColorStop(0, pal.c(40, 90, 70, 0.35));
  sg.addColorStop(1, pal.c(40, 90, 70, 0));
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = pal.c(40, 90, 82, 0.8);
  ctx.beginPath();
  ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < Math.min(d.superbadges, 40); i++) {
    const x = rng() * W;
    const y = rng() * H * 0.4;
    glowDot(ctx, x, y, 5, '#FFFFFF', 0.6 * calm(x, y));
  }
  ctx.globalCompositeOperation = 'source-over';

  // More completed trails, more mountain rows
  const layers = clamp(3 + Math.floor(d.trails / 20), 3, 8);
  const depth = 1 / (layers - 1);
  const ridge = (i, x) => {
    let n = 0;
    let amp = 1;
    let fr = 0.0016 * (1 + i * 1.75 * depth);
    let tot = 0;
    for (let oc = 0; oc < 4; oc++) {
      n += (1 - Math.abs(noise(x * fr + i * 31.7, i * 7.3))) * amp;
      tot += amp;
      amp *= 0.5;
      fr *= 2.1;
    }
    n /= tot;
    const base = H * (0.42 + i * 0.5 * depth);
    const height = H * (0.25 + tier * 0.15) * (1 - i * 0.5 * depth);
    return base + height * 0.5 - n * height;
  };

  const slot = W / Math.max(1, d.certs.length);
  const paths = d.certs.map((cert, f) => ({
    cert,
    layer: 1 + Math.floor(rng() * (layers - 2)),
    x0: f * slot + rng() * slot * 0.4,
    span: Math.min(slot * 0.9, 140 + 60 * Math.sqrt(cert.count ?? 1)),
    freq: 1 + rng() * 1.5,
  }));

  for (let i = 0; i < layers; i++) {
    const L = 30 - i * 23 * depth;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) ctx.lineTo(x, ridge(i, x));
    ctx.lineTo(W, H);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, H * (0.2 + i * 0.5 * depth), 0, H);
    g.addColorStop(0, pal.c(10 - i * 20 * depth, 35, L + 5));
    g.addColorStop(1, pal.c(-10, 40, Math.max(3, L - 6)));
    ctx.fillStyle = g;
    ctx.fill();

    ctx.fillStyle = pal.c(30, 70, 40, 0.5);
    // One hiking path per certification family, climbing from low on the slope to just under the ridge
    for (const p of paths) {
      if (p.layer !== i) continue;
      ctx.fillStyle = p.cert.color;
      let last = null;
      for (let x = p.x0; x < p.x0 + p.span; x += 6) {
        const t = (x - p.x0) / p.span;
        const y = ridge(i, x) + 6 + 34 * (1 - t) + 5 * Math.sin(t * Math.PI * 2 * p.freq);
        ctx.globalAlpha = 0.9 * Math.max(calm(x, y), 0.5);
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        last = [x, y];
      }
      if (last) {
        ctx.shadowColor = rgba(p.cert.color, 0.9);
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(last[0], last[1], 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    ctx.globalAlpha = 1;

    if (i < layers - 1) {
      const mist = ctx.createLinearGradient(0, H * (0.35 + i * 0.5 * depth), 0, H);
      mist.addColorStop(0, pal.c(30, 60, 40, 0));
      mist.addColorStop(1, pal.c(30, 60, 40, 0.1));
      ctx.fillStyle = mist;
      ctx.fillRect(0, 0, W, H);
    }
  }
  resetCtx(ctx);
  vignette(ctx);
}
