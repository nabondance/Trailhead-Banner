import { W, H, clamp, familyPicker, makeCalm, palette, resetCtx, rgba, seeded } from './core.js';

// Bauhaus blocks: a poster grid of flat geometric shapes in rank and certification colors.
export function drawBauhaus(ctx, d) {
  const rng = seeded(d.username, 'bauhaus');
  const pal = palette(d.rankColor);
  const calm = makeCalm();
  const pickFamily = familyPicker(d, rng);
  resetCtx(ctx);
  ctx.fillStyle = pal.c(0, 30, 8);
  ctx.fillRect(0, 0, W, H);

  const base = [
    pal.c(0, 35, 13),
    pal.c(0, 45, 22),
    pal.c(0, 65, 40),
    pal.c(42, 55, 38),
    pal.c(-150, 30, 28),
    pal.c(20, 25, 70),
  ];
  const color = () => (d.certs.length && rng() < 0.25 ? pickFamily().color : base[Math.floor(rng() * base.length)]);
  const split = clamp(d.badges / 1500, 0.1, 0.6);
  const C = 132;

  const shape = (x, y, s) => {
    const bg = base[Math.floor(rng() * 3)];
    let fg = color();
    if (fg === bg) fg = base[3];
    ctx.globalAlpha = calm(x + s / 2, y + s / 2);
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = fg;
    ctx.strokeStyle = fg;
    const kind = Math.floor(rng() * 7);
    const rot = Math.floor(rng() * 4) * (Math.PI / 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, s, s);
    ctx.clip();
    ctx.translate(x + s / 2, y + s / 2);
    ctx.rotate(rot);
    ctx.beginPath();
    if (kind === 0) ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
    else if (kind === 1) ctx.arc(0, s / 2, s / 2, Math.PI, 2 * Math.PI);
    else if (kind === 2) {
      ctx.moveTo(-s / 2, -s / 2);
      ctx.arc(-s / 2, -s / 2, s, 0, Math.PI / 2);
    } else if (kind === 3) for (let b = 0; b < 3; b++) ctx.rect(-s / 2, -s / 2 + (b * s) / 3 + s / 12, s, s / 6);
    else if (kind === 4) {
      ctx.moveTo(-s / 2, -s / 2);
      ctx.lineTo(s / 2, s / 2);
      ctx.lineTo(-s / 2, s / 2);
    } else if (kind === 5) {
      ctx.arc(0, 0, s * 0.32, 0, Math.PI * 2);
      ctx.lineWidth = s * 0.12;
      ctx.stroke();
      ctx.beginPath();
    }
    ctx.fill();
    ctx.restore();
  };

  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 12; i++) {
      const x = i * C;
      const y = j * C;
      if (rng() < split) {
        for (let q = 0; q < 4; q++) shape(x + (q % 2) * (C / 2), y + Math.floor(q / 2) * (C / 2), C / 2);
      } else shape(x, y, C);
    }
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < Math.min(d.superbadges, 30); i++) {
    const x = rng() * W;
    const y = rng() * H;
    ctx.fillStyle = `rgba(255,255,255,${(0.85 * calm(x, y)).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, W, H);
  resetCtx(ctx);
}
