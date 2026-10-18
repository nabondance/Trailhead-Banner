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
  const clampedFocusY = Math.min(Math.max(focusY ?? 0.5, 0), 1);
  return { x: (imgWidth - width) / 2, y: (imgHeight - height) * clampedFocusY, width, height };
}
