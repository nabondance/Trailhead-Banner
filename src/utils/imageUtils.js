const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { makeBadge, ValidationError } = require('badge-maker');

const applyGrayscale = (ctx, x, y, width, height) => {
  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const isTransparent = data[i + 3] === 0;
    const isBackgroundColor = data[i] === 0 && data[i + 1] === 136 && data[i + 2] === 204 && data[i + 3] === 255;
    if (!isTransparent && !isBackgroundColor) {
      // Only apply grayscale to non-transparent and non-background pixels
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

const calculateCertificationsDesign = (logos, canvasWidth, canvasHeight, logoSpacing) => {
  let logoWidth = logos[0].width;
  let logoHeight = logos[0].height;
  let scale = 1.0;
  let numRows = 1;
  let maxLogosPerRow = 0;

  while (true) {
    // Step 1: Calculate the maximum number of logos per row at the current scale
    maxLogosPerRow = Math.floor((canvasWidth + logoSpacing) / (logoWidth * scale + logoSpacing));

    // Step 2: Calculate the number of rows needed to display all logos
    const numRowsNeeded = Math.ceil(logos.length / maxLogosPerRow);

    // Step 3: Check if the current scale allows all rows to fit within the canvas height
    if (numRowsNeeded * (logoHeight * scale + logoSpacing) - logoSpacing <= canvasHeight) {
      break; // The current scale fits, so stop adjusting
    } else {
      // Step 4: Reduce the scale proportionally to fit more rows
      scale *= 0.9; // Gradually reduce scale (adjust decrement factor if necessary)
    }
  }

  // Step 5: Compute the final number of rows
  numRows = Math.ceil(logos.length / maxLogosPerRow);

  // Step 6: Compute the final logo dimensions
  const finalLogoWidth = logoWidth * scale;
  const finalLogoHeight = logoHeight * scale;

  // Calculate the starting X position for each line
  const logoLineStartX = [];
  for (let row = 0; row < numRows; row++) {
    const logosInLine = row === numRows - 1 ? logos.length % maxLogosPerRow || maxLogosPerRow : maxLogosPerRow;
    const lineWidth = logosInLine * finalLogoWidth + (logosInLine - 1) * logoSpacing;
    logoLineStartX.push((canvasWidth - lineWidth) / 2);
  }

  // Return the results
  return {
    logoWidth: finalLogoWidth,
    logoHeight: finalLogoHeight,
    numLines: numRows,
    maxLogosPerLine: maxLogosPerRow,
    logoLineStartX,
  };
};

const drawBadgeCounter = async (ctx, label, message, x, y, scale, labelColor, messageColor) => {
  const badge = makeBadge({
    message: `${message}`,
    label: `${label}${message !== 1 ? 's' : ''}`,
    labelColor: labelColor,
    color: messageColor,
    style: 'flat-square',
  });
  const badgeImage = await loadImage(`data:image/svg+xml;base64,${Buffer.from(badge).toString('base64')}`);
  ctx.drawImage(badgeImage, x, y, badgeImage.width * scale, badgeImage.height * scale);
};

module.exports = {
  applyGrayscale,
  cropImage,
  calculateCertificationsDesign,
  drawBadgeCounter,
};
