import { loadImage } from '@napi-rs/canvas';
import path from 'path';

/**
 * Watermark Component
 * Renders the "Trailhead Banner" branding watermark
 */

/**
 * Prepare watermark for rendering
 * @param {Object} options - Component options (currently none)
 * @returns {Promise<Object>} Prepared watermark data with image and dimensions
 */
async function prepareWatermark(options = {}) {
  const startTime = Date.now();
  const warnings = [];

  try {
    const thbSvgPath = path.join(process.cwd(), 'src', 'assets', 'watermarks', 'thb-small.svg');
    const thbSvg = await loadImage(thbSvgPath);

    const width = 160;
    const height = 20;

    return {
      image: thbSvg,
      width,
      height,
      warnings,
      timings: {
        load_ms: Date.now() - startTime,
      },
    };
  } catch (error) {
    console.error('Error loading watermark:', error);
    warnings.push(`Error loading watermark: ${error.message}`);

    return {
      image: null,
      width: 160,
      height: 20,
      warnings,
      timings: {
        load_ms: Date.now() - startTime,
      },
    };
  }
}

/**
 * Render watermark to canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} prepared - Prepared watermark data from prepareWatermark()
 * @param {number} canvasWidth - Canvas width for positioning
 * @param {number} canvasHeight - Canvas height for positioning
 */
async function renderWatermark(ctx, prepared, canvasWidth, canvasHeight) {
  if (!prepared.image) {
    console.debug('Skipping watermark render - image not loaded');
    return;
  }

  // Reset transparency
  ctx.globalAlpha = 1.0;

  // Position in bottom right corner
  const x = canvasWidth - prepared.width;
  const y = canvasHeight - prepared.height - 2;

  ctx.drawImage(prepared.image, x, y, prepared.width, prepared.height);
}

/**
 * Get warnings from watermark preparation
 * @param {Object} prepared - Prepared watermark data
 * @returns {Array<string>} Warnings
 */
function getWatermarkWarnings(prepared) {
  return prepared?.warnings || [];
}

/**
 * Get timings from watermark preparation
 * @param {Object} prepared - Prepared watermark data
 * @returns {Object} Timings
 */
function getWatermarkTimings(prepared) {
  return prepared?.timings || {};
}

export { prepareWatermark, renderWatermark, getWatermarkWarnings, getWatermarkTimings };
