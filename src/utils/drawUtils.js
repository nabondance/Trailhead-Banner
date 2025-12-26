const { createCanvas, loadImage } = require('@napi-rs/canvas');

const applyGrayscale = (ctx, x, y, width, height) => {
  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const isTransparent = data[i + 3] === 0;
    if (!isTransparent) {
      // Apply grayscale to non-transparent pixels
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = avg; // Red
      data[i + 1] = avg; // Green
      data[i + 2] = avg; // Blue
    }
  }
  ctx.putImageData(imageData, x, y);
};

const cropImage = (image) => {
  const tempCanvas = createCanvas(image.width, image.height);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(image, 0, 0);

  const imageData = tempCtx.getImageData(0, 0, image.width, image.height);
  const data = imageData.data;

  // Alpha threshold - only consider pixels with alpha > 10 as actual content
  // This ignores nearly-transparent pixels that cause improper cropping
  const alphaThreshold = 10;

  let top = 0,
    bottom = image.height,
    left = 0,
    right = image.width;

  // Find top boundary
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const alpha = data[(y * image.width + x) * 4 + 3];
      if (alpha > alphaThreshold) {
        top = y;
        break;
      }
    }
    if (top > 0) break;
  }

  // Find bottom boundary
  for (let y = image.height - 1; y >= 0; y--) {
    for (let x = 0; x < image.width; x++) {
      const alpha = data[(y * image.width + x) * 4 + 3];
      if (alpha > alphaThreshold) {
        bottom = y;
        break;
      }
    }
    if (bottom < image.height) break;
  }

  // Find left boundary
  for (let x = 0; x < image.width; x++) {
    for (let y = 0; y < image.height; y++) {
      const alpha = data[(y * image.width + x) * 4 + 3];
      if (alpha > alphaThreshold) {
        left = x;
        break;
      }
    }
    if (left > 0) break;
  }

  // Find right boundary
  for (let x = image.width - 1; x >= 0; x--) {
    for (let y = 0; y < image.height; y++) {
      const alpha = data[(y * image.width + x) * 4 + 3];
      if (alpha > alphaThreshold) {
        right = x;
        break;
      }
    }
    if (right < image.width) break;
  }

  const croppedWidth = right - left + 1;
  const croppedHeight = bottom - top + 1;

  const croppedCanvas = createCanvas(croppedWidth, croppedHeight);
  const croppedCtx = croppedCanvas.getContext('2d');
  croppedCtx.drawImage(image, -left, -top);

  return croppedCanvas;
};

const dynamicBadgeSvg = (label, message, labelColor, messageBackgroundColor) => {
  let labelToDisplay = label;
  if (message != 0) {
    labelToDisplay += 's';
  }

  const counterBadgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="35" role="img">
      <style bx:fonts="Anta">@import url(https://fonts.googleapis.com/css2?family=Anta%3Aital%2Cwght%400%2C400&amp;display=swap);</style>
  <linearGradient id="s" x2="0" y2="100%">
        <stop offset="0" stop-color="#bbb" stop-opacity=".1" />
        <stop offset="1" stop-opacity=".1" />
    </linearGradient>
    <clipPath id="r">
        <rect width="200" height="30" rx="3" fill="#fff" />
    </clipPath>
    <g clip-path="url(#r)">
        <rect width="140" height="35" fill="#555" />
        <rect x="140" width="60" height="35" fill="${messageBackgroundColor}" />
        <rect width="200" height="35" fill="url(#s)" />
    </g>
    <g fill="#fff" text-anchor="middle" font-family="Anta" text-rendering="geometricPrecision" font-size="200">
    <text x="700" y="240" fill="#010101" fill-opacity=".3" transform="scale(.1)">${labelToDisplay}</text>
    <text x="700" y="220" transform="scale(.1)" fill="#fff">${labelToDisplay}</text>
    <text x="1700" y="240" fill="#010101" fill-opacity=".3" transform="scale(.1)">${message}</text>
    <text x="1700" y="220" transform="scale(.1)" fill="#fff">${message}</text></g>
    </svg>`;
  return counterBadgeSvg;
};

const drawBadgeCounter = async (ctx, label, message, x, y, scale, labelColor, messageColor) => {
  const badge = dynamicBadgeSvg(label, message, labelColor, messageColor);
  const badgeImage = await loadImage(`data:image/svg+xml;base64,${Buffer.from(badge).toString('base64')}`);
  ctx.drawImage(badgeImage, x, y, badgeImage.width * scale, badgeImage.height * scale);
};

const generatePlusXSuperbadgesSvg = (count) => {
  const plusXSuperbadgesSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="512" height="512" role="img">
      <style bx:fonts="Anta">@import url(https://fonts.googleapis.com/css2?family=Anta%3Aital%2Cwght%400%2C400&amp;display=swap);</style>
      <path
        d="M 228.066 9.393 Q 250 -3.27 271.934 9.393 L 447.404 110.702 Q 469.338 123.365 469.338 148.692 L 469.338 351.308 Q 469.338 376.635 447.404 389.299 L 271.934 490.607 Q 250 503.27 228.066 490.607 L 52.596 389.299 Q 30.662 376.635 30.662 351.308 L 30.662 148.692 Q 30.662 123.365 52.596 110.701 Z"
        bx:shape="n-gon 250 250 253.27 253.27 6 0.1 1@dbd6cdd9" style="fill:#C5CDCD;"
        transform="matrix(1, 0, 0, 1, 0, 0)" />
      <path
        d="M 230.349 34.434 Q 250 23.088 269.651 34.434 L 426.86 125.198 Q 446.512 136.544 446.512 159.235 L 446.512 340.765 Q 446.512 363.456 426.86 374.802 L 269.651 465.566 Q 250 476.912 230.349 465.566 L 73.14 374.802 Q 53.488 363.456 53.488 340.765 L 53.488 159.235 Q 53.488 136.544 73.14 125.198 Z"
        bx:shape="n-gon 250 250 226.912 226.912 6 0.1 1@9dde08be" style="fill:#8a00c4;"
        transform="matrix(1, 0, 0, 1, 0, 0)" />
      <text x="250" y="330" fill="#fff" font-family="Roboto" font-weight="700" font-size="200" text-anchor="middle">+${count}</text>
    </svg>`;
  return plusXSuperbadgesSvg;
};

const generatePlusXCertificationsSvg = (count) => {
  const plusXCertificationsSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="500" height="500" role="img">
      <style fonts="Anta">@import url(https://fonts.googleapis.com/css2?family=Anta%3Aital%2Cwght%400%2C400&amp;display=swap);</style>
      <g transform="translate(0,500) scale(0.100000,-0.100000)" fill="#0A9DDA" stroke="none">
      <path d="M1436 4890 c-26 -10 -64 -29 -83 -42 -48 -32 -1250 -1536 -1288
      -1612 -54 -109 -54 -113 152 -1011 99 -434 195 -855 212 -935 18 -80 43 -168
      57 -197 53 -109 50 -108 989 -560 473 -228 886 -423 917 -434 64 -21 133 -24
      193 -8 22 6 436 200 919 432 962 462 956 459 1010 570 14 29 39 113 55 187 16
      74 114 504 216 955 207 906 204 886 152 998 -30 65 -1209 1547 -1272 1599 -25
      20 -70 46 -100 57 -55 21 -67 21 -1068 21 -969 -1 -1014 -2 -1061 -20z"/>
      </g>
      <text x="250" y="300" fill="#fff" font-family="Anta" font-weight="700" font-size="200" text-anchor="middle">+${count}</text>
    </svg>`;
  return plusXCertificationsSvg;
};

// Accent color used ONLY for background elements (lines / waves / dots / geometry).
function getRankAccentColor(rank) {
  const rankAccentMap = {
    // Basic ranks - warm progression: gold → amber → orange → coral → red
    Scout: '#F7C948', // warm gold (entry level, welcoming)
    Hiker: '#F5A623', // amber/orange (matches badge's warm tones)
    Explorer: '#F26B50', // coral red (compass face, sunset)
    Adventurer: '#E84D30', // flame red-orange (campfire intensity)
    Mountaineer: '#D93B4A', // rich crimson (peak achievement pre-ranger)
    Expeditioner: '#C42E5C', // deep rose (transition toward ranger premium)

    // Ranger family - cool premium progression: cyan → blue → indigo → violet → purple → magenta
    Ranger: '#2196E8', // bright azure (fresh start as ranger)
    'Double Star Ranger': '#3D6BDB', // royal blue (growing prestige)
    'Triple Star Ranger': '#5347C4', // indigo (deepening expertise)
    'Four Star Ranger': '#7142B8', // violet (approaching elite)
    'Five Star Ranger': '#9234A8', // purple-magenta (premium territory)
    'All Star Ranger': '#B5278F', // rich magenta (ultimate prestige)
  };

  return rankAccentMap[rank] || '#22C3B5'; // fallback teal
}

function getAgentblazerStyle(agentblazerRank) {
  const agentblazerStyleMap = {
    Champion: { color: '#C0C0C0', metalType: 'silver' },
    Innovator: { color: '#FFD700', metalType: 'gold' },
    Legend: { color: '#E5E4E2', metalType: 'holographic' },
  };
  return agentblazerStyleMap[agentblazerRank] || { color: '#0176D3', metalType: null };
}

// Draw geometric elements based on rank colors
function drawGeometricElements(ctx, rewindSummary, rankColors) {
  // Create seeded random based on username for consistent patterns
  const seed = rewindSummary.username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (index) => (Math.sin(seed + index * 1.414) + 1) / 2;

  ctx.save();

  // Draw curved lines
  drawCurvedLines(ctx, rankColors, random);

  // Draw flowing line patterns
  drawFlowingLinePatterns(ctx, rankColors, random);

  // Draw circular spiral patterns
  drawCircularLinePatterns(ctx, rankColors, random);

  // Draw geometric shapes
  drawGeometricShapes(ctx, rankColors, random);

  // Draw corner accents
  drawCornerAccents(ctx, rankColors);

  ctx.restore();
}

// Draw flowing curved lines
function drawCurvedLines(ctx, rankColors, random) {
  ctx.strokeStyle = rankColors;
  ctx.lineWidth = 8;
  ctx.globalAlpha = 0.4;

  // Top flowing line (extended beyond canvas)
  ctx.beginPath();
  ctx.moveTo(-150, 400 + random(1) * 200);
  ctx.quadraticCurveTo(540 + random(2) * 400, 200 + random(3) * 300, 1080 + random(4) * 400, 500 + random(5) * 200);
  ctx.quadraticCurveTo(1620 + random(6) * 400, 300 + random(7) * 300, 2310, 600 + random(8) * 200);
  ctx.stroke();

  // Middle flowing line (extended beyond canvas)
  ctx.strokeStyle = rankColors;
  ctx.lineWidth = 12;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.moveTo(-200, 1200 + random(9) * 300);
  ctx.quadraticCurveTo(
    720 + random(10) * 300,
    1000 + random(11) * 400,
    1440 + random(12) * 300,
    1400 + random(13) * 300
  );
  ctx.quadraticCurveTo(1800 + random(14) * 300, 1100 + random(15) * 400, 2360, 1500 + random(16) * 300);
  ctx.stroke();

  // Bottom flowing line (extended beyond canvas)
  ctx.strokeStyle = rankColors;
  ctx.lineWidth = 6;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(-100, 2000 + random(17) * 300);
  ctx.quadraticCurveTo(
    600 + random(18) * 400,
    2200 + random(19) * 200,
    1200 + random(20) * 400,
    1900 + random(21) * 300
  );
  ctx.quadraticCurveTo(1800 + random(22) * 300, 2100 + random(23) * 200, 2400, 2300 + random(24) * 200);
  ctx.stroke();
}

// Draw flowing line patterns inspired by Spotify Wrapped
function drawFlowingLinePatterns(ctx, rankColors, random) {
  // Full-width flowing lines from left to right (extend beyond canvas)
  drawFullFlowingPattern(ctx, rankColors, -200, 400, 2360, 0, 'horizontal', random, 40);

  // Diagonal flowing lines from outside top-left to outside bottom-right
  drawFullFlowingPattern(ctx, rankColors, -300, -100, 2500, 2900, 'diagonal', random, 50);

  // Curved flowing lines that loop back (extend beyond sides)
  drawLoopingPattern(ctx, rankColors, -200, 1600, 2560, 600, random, 60);

  // Vertical flowing lines from top to bottom (extend beyond canvas)
  drawFullFlowingPattern(ctx, rankColors, 1800, -100, 0, 2800, 'vertical', random, 70);
}

// Draw full-canvas flowing patterns (horizontal, vertical, diagonal)
function drawFullFlowingPattern(ctx, color, startX, startY, endX, endY, type, random, seedOffset) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.globalAlpha = 0.15;

  const lineCount = 5;
  const lineSpacing = 30;

  for (let i = 0; i < lineCount; i++) {
    ctx.beginPath();

    const waveAmplitude = 60 + random(seedOffset + i) * 40;
    const waveFrequency = 0.006 + random(seedOffset + i + 10) * 0.004;

    if (type === 'horizontal') {
      // Horizontal lines across full width
      const baseY = startY + i * lineSpacing;
      for (let x = -100; x <= 2260; x += 15) {
        const progress = (x + 100) / 2360;
        const waveY = Math.sin(progress * Math.PI * 4 + random(seedOffset + i + 20)) * waveAmplitude;
        const finalY = baseY + waveY;

        if (x === -100) {
          ctx.moveTo(x, finalY);
        } else {
          ctx.lineTo(x, finalY);
        }
      }
    } else if (type === 'vertical') {
      // Vertical lines across full height
      const baseX = startX + i * lineSpacing;
      for (let y = -100; y <= 2800; y += 15) {
        const progress = (y + 100) / 2900;
        const waveX = Math.sin(progress * Math.PI * 3 + random(seedOffset + i + 20)) * waveAmplitude;
        const finalX = baseX + waveX;

        if (y === -100) {
          ctx.moveTo(finalX, y);
        } else {
          ctx.lineTo(finalX, y);
        }
      }
    } else if (type === 'diagonal') {
      // Diagonal lines from corner to corner
      const distance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
      const angle = Math.atan2(endY - startY, endX - startX);

      // Perpendicular offset for parallel lines
      const perpX = Math.cos(angle + Math.PI / 2) * lineSpacing * i;
      const perpY = Math.sin(angle + Math.PI / 2) * lineSpacing * i;

      for (let d = 0; d <= distance; d += 15) {
        const progress = d / distance;
        const baseX = startX + Math.cos(angle) * d + perpX;
        const baseY = startY + Math.sin(angle) * d + perpY;

        // Add wave perpendicular to line direction
        const waveOffset = Math.sin(progress * Math.PI * 3 + random(seedOffset + i + 20)) * waveAmplitude;
        const finalX = baseX + Math.cos(angle + Math.PI / 2) * waveOffset;
        const finalY = baseY + Math.sin(angle + Math.PI / 2) * waveOffset;

        if (d === 0) {
          ctx.moveTo(finalX, finalY);
        } else {
          ctx.lineTo(finalX, finalY);
        }
      }
    }

    ctx.stroke();
  }
}

// Draw looping patterns that curve back on themselves
function drawLoopingPattern(ctx, color, startX, startY, width, height, random, seedOffset) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.12;

  const lineCount = 4;

  for (let i = 0; i < lineCount; i++) {
    ctx.beginPath();

    const amplitude = 100 + random(seedOffset + i) * 80;
    const frequency = 0.01 + random(seedOffset + i + 10) * 0.005;
    const loopHeight = height / lineCount;
    const centerY = startY + i * loopHeight + loopHeight / 2;

    // Create looping pattern that curves back
    for (let x = -100; x <= width + 100; x += 10) {
      const progress = (x + 100) / (width + 200);

      // Create a loop that goes out and comes back
      const loopProgress = Math.sin(progress * Math.PI);
      const waveY = Math.sin(progress * Math.PI * 6 + random(seedOffset + i + 20)) * amplitude * loopProgress;

      // Add overall curve that brings line back toward start
      const returnCurve = Math.sin(progress * Math.PI) * (height * 0.3);

      const finalX = startX + x;
      const finalY = centerY + waveY + returnCurve;

      if (x === -100) {
        ctx.moveTo(finalX, finalY);
      } else {
        ctx.lineTo(finalX, finalY);
      }
    }

    ctx.stroke();
  }
}

// Draw zigzag line pattern
function drawCircularLinePatterns(ctx, rankColors, random) {
  // Single zigzag pattern positioned based on username seed
  const baseX = 300 + random(110) * 1200; // Random X between 300-1500
  const baseY = 800 + random(111) * 1000; // Random Y between 800-1800

  drawZigzagPattern(ctx, rankColors, baseX, baseY, random, 112);
}

// Draw a single zigzag pattern
function drawZigzagPattern(ctx, color, startX, startY, random, seedOffset) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.18;

  ctx.beginPath();

  // Zigzag parameters based on random seed
  const totalLength = 800 + random(seedOffset) * 600; // 800-1400px total length
  const baseAmplitude = 60 + random(seedOffset + 1) * 80; // 60-140px base amplitude
  const segmentCount = 8 + Math.floor(random(seedOffset + 2) * 12); // 8-20 segments
  const angle = random(seedOffset + 3) * Math.PI * 2; // Random direction

  let currentX = startX;
  let currentY = startY;
  let totalDistance = 0;

  ctx.moveTo(currentX, currentY);

  // Draw organic zigzag pattern with varying sizes and angles
  for (let i = 0; i < segmentCount; i++) {
    // Vary segment length (20% to 180% of average)
    const avgSegmentLength = totalLength / segmentCount;
    const segmentLength = avgSegmentLength * (0.2 + random(seedOffset + 10 + i) * 1.6);

    // Vary amplitude for each segment (50% to 150% of base)
    const segmentAmplitude = baseAmplitude * (0.5 + random(seedOffset + 30 + i) * 1.0);

    // Vary the perpendicular angle slightly (-30° to +30°)
    const angleVariation = ((random(seedOffset + 50 + i) - 0.5) * Math.PI) / 3;
    const perpAngle = angle + Math.PI / 2 + angleVariation;

    // Direction alternates but with some randomness
    const direction = (i % 2 === 0 ? 1 : -1) * (0.7 + random(seedOffset + 70 + i) * 0.6);

    // Calculate segment end point
    const segmentEndX = currentX + Math.cos(angle) * segmentLength;
    const segmentEndY = currentY + Math.sin(angle) * segmentLength;

    // Add perpendicular offset for zigzag effect
    const offsetX = Math.cos(perpAngle) * segmentAmplitude * direction;
    const offsetY = Math.sin(perpAngle) * segmentAmplitude * direction;

    const nextX = segmentEndX + offsetX;
    const nextY = segmentEndY + offsetY;

    ctx.lineTo(nextX, nextY);

    currentX = nextX;
    currentY = nextY;
    totalDistance += segmentLength;

    // Stop if we've reached the desired total length
    if (totalDistance >= totalLength) break;
  }

  ctx.stroke();
}

// Draw geometric shapes (circles, triangles, rectangles)
function drawGeometricShapes(ctx, rankColors, random) {
  // Circles
  for (let i = 0; i < 5; i++) {
    const x = random(i * 2 + 25) * 2160;
    const y = random(i * 2 + 26) * 2700;
    const radius = 15 + random(i * 3 + 27) * 40;

    ctx.fillStyle = rankColors;
    ctx.globalAlpha = 0.2 + random(i + 28) * 0.1;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Triangles (random rotations and shapes)
  for (let i = 0; i < 4; i++) {
    const x = random(i * 2 + 30) * 2160;
    const y = random(i * 2 + 31) * 2700;
    const size = 25 + random(i * 3 + 32) * 35;

    ctx.fillStyle = rankColors;
    ctx.globalAlpha = 0.18 + random(i + 33) * 0.12;

    ctx.save();
    ctx.translate(x, y);

    // Random rotation (0 to 360 degrees)
    const rotation = random(i + 40) * Math.PI * 2;
    ctx.rotate(rotation);

    // Random triangle shape variations
    const baseWidth = 0.7 + random(i + 41) * 0.3; // 0.7 to 1.0
    const heightRatio = 0.8 + random(i + 42) * 0.4; // 0.8 to 1.2
    const asymmetry = (random(i + 43) - 0.5) * 0.3; // -0.15 to 0.15

    ctx.beginPath();
    // Top point (with height variation)
    ctx.moveTo(0, -size * heightRatio * 0.6);
    // Bottom left (with width and asymmetry variation)
    ctx.lineTo(-size * baseWidth * (0.8 + asymmetry), size * heightRatio * 0.4);
    // Bottom right (with width and asymmetry variation)
    ctx.lineTo(size * baseWidth * (0.8 - asymmetry), size * heightRatio * 0.4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // Rectangles
  for (let i = 0; i < 3; i++) {
    const x = random(i * 2 + 35) * 2160;
    const y = random(i * 2 + 36) * 2700;
    const width = 40 + random(i * 3 + 37) * 80;
    const height = 20 + random(i * 3 + 38) * 40;

    ctx.fillStyle = rankColors;
    ctx.globalAlpha = 0.18 + random(i + 39) * 0.1;
    ctx.fillRect(x, y, width, height);
  }
}

// Draw corner accent elements
function drawCornerAccents(ctx, rankColors) {
  // Top-left corner accent
  ctx.strokeStyle = rankColors;
  ctx.lineWidth = 8;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.moveTo(0, 150);
  ctx.lineTo(200, 150);
  ctx.moveTo(150, 0);
  ctx.lineTo(150, 200);
  ctx.stroke();

  // Bottom-left corner accent
  ctx.strokeStyle = rankColors;
  ctx.lineWidth = 8;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.moveTo(0, 2550);
  ctx.lineTo(200, 2550);
  ctx.moveTo(150, 2700);
  ctx.lineTo(150, 2500);
  ctx.stroke();

  // Top-right decorative lines
  ctx.strokeStyle = rankColors;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(1900 + i * 40, 100 + i * 20);
    ctx.lineTo(2000 + i * 40, 200 + i * 20);
    ctx.stroke();
  }
}

// Draw text with stylized effect
function drawStylizedText(ctx, text, fontSize, x, y, style) {
  const textWidth = ctx.measureText(text).width;

  let gradient, glowColor, strokeColor, highlightColor, glowPasses;

  // Create gradient based on style
  gradient = ctx.createLinearGradient(x, y - fontSize * 0.5, x + textWidth, y + fontSize * 0.3);

  if (style === 'gold') {
    gradient.addColorStop(0, '#FFF9E6');
    gradient.addColorStop(0.2, '#FFE082');
    gradient.addColorStop(0.4, '#FFD54F');
    gradient.addColorStop(0.5, '#FFCA28');
    gradient.addColorStop(0.65, '#FFB300');
    gradient.addColorStop(0.8, '#FF8F00');
    gradient.addColorStop(1, '#E65100');
    glowColor = '#FFB300';
    strokeColor = '#5D4037';
    highlightColor = '#FFECB3';
    glowPasses = 3;
  } else if (style === 'silver') {
    gradient.addColorStop(0, '#FFFFFF');
    gradient.addColorStop(0.25, '#E8E8E8');
    gradient.addColorStop(0.45, '#D0D0D0');
    gradient.addColorStop(0.6, '#B8B8B8');
    gradient.addColorStop(0.8, '#A0A0A0');
    gradient.addColorStop(1, '#888888');
    glowColor = '#C0C0C0';
    strokeColor = '#404040';
    highlightColor = '#FFFFFF';
    glowPasses = 3;
  } else if (style === 'holographic') {
    gradient.addColorStop(0, '#E8B4F8');
    gradient.addColorStop(0.2, '#D4A0F0');
    gradient.addColorStop(0.35, '#B8C8F8');
    gradient.addColorStop(0.5, '#E8F0FF');
    gradient.addColorStop(0.65, '#A8E8F0');
    gradient.addColorStop(0.8, '#80D8E8');
    gradient.addColorStop(1, '#9878C8');
    glowColor = '#E0E0FF';
    strokeColor = '#6050A0';
    highlightColor = '#F0E8FF';
    glowPasses = 2;
  } else if (style === 'stamp') {
    // Rubber stamp effect - bold red with distressed look
    gradient.addColorStop(0, '#D32F2F');
    gradient.addColorStop(0.3, '#C62828');
    gradient.addColorStop(0.5, '#B71C1C');
    gradient.addColorStop(0.7, '#C62828');
    gradient.addColorStop(1, '#D32F2F');
    glowColor = '#FF5252';
    strokeColor = '#7B1A1A';
    highlightColor = '#FF8A80';
    glowPasses = 1;
  } else if (style === 'learn') {
    // Blue learning theme - light blue to indigo gradient
    gradient.addColorStop(0, '#90CAF9');
    gradient.addColorStop(0.2, '#6FA8E0');
    gradient.addColorStop(0.4, '#5580D0');
    gradient.addColorStop(0.5, '#4A60C8');
    gradient.addColorStop(0.65, '#4040B8');
    gradient.addColorStop(0.8, '#3528A8');
    gradient.addColorStop(1, '#280F8F');
    glowColor = '#5580D0';
    strokeColor = '#1A0860';
    highlightColor = '#B8D8F8';
    glowPasses = 2;
  } else if (style === 'explore') {
    // Green exploration theme - discovery/adventure vibe
    gradient.addColorStop(0, '#E8F5E9');
    gradient.addColorStop(0.2, '#A5D6A7');
    gradient.addColorStop(0.4, '#81C784');
    gradient.addColorStop(0.5, '#66BB6A');
    gradient.addColorStop(0.65, '#4CAF50');
    gradient.addColorStop(0.8, '#43A047');
    gradient.addColorStop(1, '#2E7D32');
    glowColor = '#81C784';
    strokeColor = '#1B5E20';
    highlightColor = '#C8E6C9';
    glowPasses = 2;
  } else {
    // Default
    glowColor = '#FFFFFF';
    strokeColor = '#FFFFFF';
    highlightColor = '#FFFFFF';
    glowPasses = 0;
  }

  // LAYER 1: Outer glow (multiple passes)
  ctx.save();
  for (let i = 0; i < glowPasses; i++) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 30 + i * 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 1;
    ctx.strokeText(text, x, y);
  }
  ctx.restore();

  // LAYER 2: Drop shadow
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillText(text, x + 2, y + 3);
  ctx.restore();

  // LAYER 3: Dark stroke outline
  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y);
  ctx.restore();

  // LAYER 4: Main gradient fill
  ctx.fillStyle = gradient;
  ctx.fillText(text, x, y);

  // LAYER 5: Inner highlight
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 10, y - fontSize, 500, fontSize * 0.6);
  ctx.clip();

  const innerHighlight = ctx.createLinearGradient(x, y - fontSize, x, y - fontSize * 0.3);
  innerHighlight.addColorStop(0, highlightColor);
  innerHighlight.addColorStop(0.5, 'rgba(255,255,255,0.3)');
  innerHighlight.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = innerHighlight;
  ctx.fillText(text, x, y);
  ctx.restore();

  // LAYER 6: Specular highlight
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.5;

  const specular = ctx.createRadialGradient(x + 80, y - fontSize * 0.3, 0, x + 80, y - fontSize * 0.3, fontSize * 1.5);
  specular.addColorStop(0, '#FFFFFF');
  specular.addColorStop(0.3, 'rgba(255,255,255,0.3)');
  specular.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = specular;
  ctx.fillText(text, x, y);
  ctx.restore();
}

module.exports = {
  applyGrayscale,
  cropImage,
  drawBadgeCounter,
  generatePlusXSuperbadgesSvg,
  generatePlusXCertificationsSvg,
  getRankAccentColor,
  getAgentblazerStyle,
  drawStylizedText,
  drawGeometricElements,
  drawCurvedLines,
  drawFlowingLinePatterns,
  drawFullFlowingPattern,
  drawLoopingPattern,
  drawCircularLinePatterns,
  drawZigzagPattern,
  drawGeometricShapes,
  drawCornerAccents,
};
