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
  ctx.save();
  ctx.font = '400 20px Anta, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const url = 'thb.nabondance.me';
  const pillH = 28;
  const pillW = ctx.measureText(url).width + 34;
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

export { makeFlakeTexture, makeEngravedNameTexture, makeHighlightTexture, RANK_ACCENTS, loadFont, makeBackdropTexture };
