const FALLBACK_WIDTH = 1584 * 2;
const FALLBACK_HEIGHT = 396 * 2;
const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024; // 4MB — safe headroom under the 5MB API limit

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function drawCrop(image, pixelCrop, outputWidth, outputHeight) {
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  canvas
    .getContext('2d')
    .drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, outputWidth, outputHeight);
  return canvas.toDataURL('image/jpeg', 0.92);
}

// Ensures an image is within the API payload limit.
// Used when crop is skipped — preserves original aspect ratio.
export async function resizeImageForPayload(imageSrc) {
  if (imageSrc.length <= MAX_PAYLOAD_BYTES) return imageSrc;

  const image = await loadImage(imageSrc);
  const scale = Math.min(1, FALLBACK_WIDTH / image.naturalWidth, FALLBACK_HEIGHT / image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.92);
}

export async function getCroppedImage(imageSrc, pixelCrop) {
  const image = await loadImage(imageSrc);

  // Try native resolution first
  const dataUrl = drawCrop(image, pixelCrop, pixelCrop.width, pixelCrop.height);
  if (dataUrl.length <= MAX_PAYLOAD_BYTES) {
    return dataUrl;
  }

  // Too large for API payload — fall back to 2× banner dimensions
  return drawCrop(image, pixelCrop, FALLBACK_WIDTH, FALLBACK_HEIGHT);
}
