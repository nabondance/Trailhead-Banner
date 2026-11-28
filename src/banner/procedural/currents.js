import {
  W,
  H,
  clamp,
  makeCalm,
  makeNoise,
  makePlacer,
  paintBase,
  palette,
  resetCtx,
  seeded,
  vignette,
} from './core.js';

// "Trail Currents": every badge is a particle carried by a noise flow field,
// every certification bends the current into a vortex of its color, superbadges are the bright streams.
export function drawCurrents(ctx, d) {
  const rng = seeded(d.username, 'currents');
  const noise = makeNoise(rng);
  const pal = palette(d.rankColor);
  const calm = makeCalm();
  resetCtx(ctx);
  paintBase(ctx, pal, rng);

  const fbm = (x, y) => noise(x, y) * 0.65 + noise(x * 2.1 + 17, y * 2.1 - 9) * 0.35;
  const place = makePlacer(rng, makeCalm(1), { spreadWeight: 1.5, margin: 40 });
  const vortices = d.certs.map((c) => ({
    ...place(),
    r: 70 + rng() * 50 + 28 * Math.sqrt(c.count ?? 1),
    spin: rng() < 0.5 ? -1 : 1,
    color: c.color,
  }));
  const tilt = (rng() - 0.5) * 0.5;
  const sc = 0.0018;
  // Vortices are added as velocity (not blended as angles) so they stay round and shear naturally
  // with the background flow; a slight inward pull turns closed loops into spirals.
  const angle = (x, y) => {
    const a = tilt + fbm(x * sc, y * sc * 2.2) * Math.PI * 1.1;
    let vx = Math.cos(a);
    let vy = Math.sin(a);
    for (const v of vortices) {
      const dx = x - v.x;
      const dy = y - v.y;
      const r2 = dx * dx + dy * dy;
      const core = v.r * 0.35;
      const reach = Math.exp(-r2 / (v.r * v.r * 4));
      if (reach < 0.01) continue;
      const r = Math.sqrt(r2) || 1;
      const vt = ((2.6 * (1 - Math.exp(-r2 / (core * core)))) / (r / core)) * reach;
      vx += ((-dy / r) * v.spin - (dx / r) * 0.12) * vt;
      vy += ((dx / r) * v.spin - (dy / r) * 0.12) * vt;
    }
    return Math.atan2(vy, vx);
  };

  const trace = (x, y, steps, stepLen, width, alpha, color, chunk = 6) => {
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    for (let s = 0; s < steps; s += chunk) {
      const mx = x;
      const my = y;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < chunk; k++) {
        const a = angle(x, y);
        x += Math.cos(a) * stepLen;
        y += Math.sin(a) * stepLen;
        ctx.lineTo(x, y);
      }
      const taper = Math.sin(Math.PI * clamp((s + chunk / 2) / steps, 0, 1));
      ctx.globalAlpha = alpha * taper * calm((mx + x) / 2, (my + y) / 2);
      ctx.stroke();
      if (x < -60 || x > W + 60 || y < -60 || y > H + 60) break;
      // Stop at the eye, or every trail piles up there and blows out to white
      if (vortices.some((v) => Math.hypot(x - v.x, y - v.y) < v.r * 0.18)) break;
    }
  };

  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const count = Math.round(Math.min(3200, 350 + d.badges * 2));
  for (let i = 0; i < count; i++) {
    const x = rng() * (W + 100) - 50;
    const y = rng() * H;
    const near = vortices.find((v) => Math.hypot(x - v.x, y - v.y) < v.r * 1.6);
    let color;
    if (near && rng() < 0.8) color = near.color;
    else {
      const m = (noise(x * 0.001 + 40, y * 0.001) + 1) / 2;
      color = m < 0.5 ? pal.c(0, 80, 55 + m * 20) : pal.c(42, 75, 50 + m * 15);
    }
    trace(x, y, 30 + rng() * 90, 3, 0.5 + rng() * 1.1, 0.12 + rng() * 0.16, color);
  }

  ctx.shadowColor = pal.c(0, 90, 70, 0.9);
  ctx.shadowBlur = 10;
  for (let i = 0; i < d.superbadges; i++) {
    trace(rng() * W * 0.35 - 40, rng() * H, 220 + rng() * 140, 3, 1.4 + rng(), 0.55, pal.c(10, 90, 82));
  }
  resetCtx(ctx);
  vignette(ctx);
}
