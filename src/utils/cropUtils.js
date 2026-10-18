import { BANNER_SIZES } from '../banner/bannerSizes';

const FALLBACK_SCALE = 2; // Fallback resolution = 2× the banner canvas
const SHRINK_STEP = 0.8; // Each retry is 80% of the previous size
const MAX_SHRINK_ATTEMPTS = 10;
const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024; // 4MB — safe headroom under the 5MB API limit

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

// Encode at the given size, shrinking step by step until the data URL fits the payload limit
function encodeWithinLimit(draw, width, height) {
  let w = width;
  let h = height;
  let dataUrl = draw(Math.round(w), Math.round(h));
  for (let i = 0; i < MAX_SHRINK_ATTEMPTS && dataUrl.length > MAX_PAYLOAD_BYTES; i++) {
    w *= SHRINK_STEP;
    h *= SHRINK_STEP;
    dataUrl = draw(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
  return dataUrl;
}

function drawFull(image, outputWidth, outputHeight) {
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  canvas.getContext('2d').drawImage(image, 0, 0, outputWidth, outputHeight);
  return canvas.toDataURL('image/jpeg', 0.92);
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
// size: banner size from BANNER_SIZES. Targets 2× the banner: 'cover' banners need the image to fill
// that area (it gets cropped), 'stretch' banners only need it to fit inside.
export async function resizeImageForPayload(imageSrc, size = BANNER_SIZES.standard) {
  if (imageSrc.length <= MAX_PAYLOAD_BYTES) return imageSrc;

  const image = await loadImage(imageSrc);
  const pickScale = size.fit === 'cover' ? Math.max : Math.min;
  const scale = Math.min(
    1,
    pickScale((size.width * FALLBACK_SCALE) / image.naturalWidth, (size.height * FALLBACK_SCALE) / image.naturalHeight)
  );
  return encodeWithinLimit((w, h) => drawFull(image, w, h), image.naturalWidth * scale, image.naturalHeight * scale);
}

// size: banner size from BANNER_SIZES, used for the fallback resolution
export async function getCroppedImage(imageSrc, pixelCrop, size = BANNER_SIZES.standard) {
  const image = await loadImage(imageSrc);

  // Try native resolution first
  const dataUrl = drawCrop(image, pixelCrop, pixelCrop.width, pixelCrop.height);
  if (dataUrl.length <= MAX_PAYLOAD_BYTES) {
    return dataUrl;
  }

  // Too large for API payload — start at 2× banner width (never upscaled, always smaller than native),
  // keep the crop's aspect ratio, and shrink further until it fits
  let fallbackWidth = Math.min(size.width * FALLBACK_SCALE, pixelCrop.width);
  if (fallbackWidth >= pixelCrop.width) fallbackWidth = pixelCrop.width * SHRINK_STEP;
  const fallbackHeight = (fallbackWidth * pixelCrop.height) / pixelCrop.width;
  return encodeWithinLimit((w, h) => drawCrop(image, pixelCrop, w, h), fallbackWidth, fallbackHeight);
}
