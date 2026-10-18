/**
 * Canvas size and background fit per banner type.
 * Shared by the server renderers and the client forms/previews (no server-only imports here).
 * fit: 'stretch' draws the background to the full canvas; 'cover' keeps its aspect ratio and crops the overflow.
 */
export const BANNER_SIZES = {
  standard: { width: 1584, height: 396, fit: 'stretch' }, // LinkedIn profile banner
  company: { width: 1128, height: 191, fit: 'cover' }, // LinkedIn company page header
};

/**
 * Source rectangle to draw so an image covers the target area without distortion.
 * Horizontally centered; vertically positioned by focusY (0 = keep top, 0.5 = center, 1 = keep bottom).
 * Used by the server render and the client preview so both crop the same way.
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function getCoverSourceRect(imgWidth, imgHeight, targetWidth, targetHeight, focusY = 0.5) {
  const scale = Math.max(targetWidth / imgWidth, targetHeight / imgHeight);
  const width = targetWidth / scale;
  const height = targetHeight / scale;
  // Anything that isn't a finite number (missing, "top", NaN) falls back to center
  const numericFocusY = Number(focusY);
  const clampedFocusY = Number.isFinite(numericFocusY) ? Math.min(Math.max(numericFocusY, 0), 1) : 0.5;
  return { x: (imgWidth - width) / 2, y: (imgHeight - height) * clampedFocusY, width, height };
}

/**
 * Draw a background image to fill a target area with the given fit.
 * Single implementation for the server render and the client preview, so they always match.
 * Falls back to 'stretch' when the image size is unknown.
 * @param {CanvasRenderingContext2D} ctx - Canvas context (@napi-rs/canvas or browser)
 * @param {CanvasImageSource} image - Image to draw
 * @param {number} imgWidth - Image width (natural size)
 * @param {number} imgHeight - Image height (natural size)
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @param {'stretch'|'cover'} [fit='stretch'] - How to fit the image
 * @param {number} [focusY=0.5] - Vertical crop focus for 'cover'
 */
export function drawImageWithFit(ctx, image, imgWidth, imgHeight, width, height, fit = 'stretch', focusY = 0.5) {
  if (fit === 'cover' && imgWidth > 0 && imgHeight > 0) {
    const src = getCoverSourceRect(imgWidth, imgHeight, width, height, focusY);
    ctx.drawImage(image, src.x, src.y, src.width, src.height, 0, 0, width, height);
  } else {
    ctx.drawImage(image, 0, 0, width, height);
  }
}
