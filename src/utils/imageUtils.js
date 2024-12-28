const { createCanvas } = require('@napi-rs/canvas');

const applyGrayscale = (ctx, x, y, width, height) => {
  const imageData = ctx.getImageData(x, y, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i] = avg; // Red
    data[i + 1] = avg; // Green
    data[i + 2] = avg; // Blue
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

module.exports = {
  applyGrayscale,
  cropImage,
};
