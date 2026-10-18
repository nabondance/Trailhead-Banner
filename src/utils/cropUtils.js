import { BANNER_SIZES } from '../banner/bannerSizes';

const FALLBACK_SCALE = 2; // Fallback resolution = 2× the banner canvas
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
// size: banner size from BANNER_SIZES; the image is shrunk to at most 2× that size
export async function resizeImageForPayload(imageSrc, size = BANNER_SIZES.standard) {
  if (imageSrc.length <= MAX_PAYLOAD_BYTES) return imageSrc;

  const image = await loadImage(imageSrc);
  const scale = Math.min(
    1,
    (size.width * FALLBACK_SCALE) / image.naturalWidth,
    (size.height * FALLBACK_SCALE) / image.naturalHeight
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.92);
}

// size: banner size from BANNER_SIZES, used for the fallback resolution
export async function getCroppedImage(imageSrc, pixelCrop, size = BANNER_SIZES.standard) {
  const image = await loadImage(imageSrc);

  // Try native resolution first
  const dataUrl = drawCrop(image, pixelCrop, pixelCrop.width, pixelCrop.height);
  if (dataUrl.length <= MAX_PAYLOAD_BYTES) {
    return dataUrl;
  }

  // Too large for API payload — fall back to 2× banner width (never upscaled), keeping the crop's aspect ratio
  const fallbackWidth = Math.min(size.width * FALLBACK_SCALE, Math.round(pixelCrop.width));
  const fallbackHeight = Math.round((fallbackWidth * pixelCrop.height) / pixelCrop.width);
  return drawCrop(image, pixelCrop, fallbackWidth, fallbackHeight);
}
