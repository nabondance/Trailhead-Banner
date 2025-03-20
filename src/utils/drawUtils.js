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

  let top = 0,
    bottom = image.height,
    left = 0,
    right = image.width;

  // Find top boundary
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const alpha = data[(y * image.width + x) * 4 + 3];
      if (alpha > 0) {
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
      if (alpha > 0) {
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
      if (alpha > 0) {
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
      if (alpha > 0) {
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

const dynamicBadgeSvg = (label, message, labelColor, messageColor) => {
  let labelToDisplay = label;
  let messageBackgroundColor = '#1f80c0';
  if (message != 0) {
    labelToDisplay += 's';
  }
  switch (label) {
    case 'Superbadge':
      messageBackgroundColor = '#f9a825';
      break;
    case 'Certification':
      messageBackgroundColor = '#8a00c4';
      break;
    case 'Trail':
      messageBackgroundColor = '#06482A';
      break;
    case 'Point':
      messageBackgroundColor = '#18477D';
      break;
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

module.exports = {
  applyGrayscale,
  cropImage,
  drawBadgeCounter,
  generatePlusXSuperbadgesSvg,
  generatePlusXCertificationsSvg,
};
