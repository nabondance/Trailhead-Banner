const { loadImage } = require('@napi-rs/canvas');
const path = require('path');

/**
 * MVP Ribbon Component
 * Renders diagonal MVP ribbon in top-right corner if user is an MVP
 */

/**
 * Prepare MVP ribbon for rendering
 * @param {Object} mvpData - MVP data from API
 * @param {boolean} mvpData.isMvp - Whether user is an MVP
 * @returns {Promise<Object>} Prepared MVP ribbon data
 */
async function prepareMvpRibbon(mvpData) {
  const startTime = Date.now();
  const warnings = [];

  if (!mvpData?.isMvp) {
    return {
      shouldRender: false,
      image: null,
      warnings,
      timings: {
        load_ms: 0,
      },
    };
  }

  try {
    const mvpSvgPath = path.join(process.cwd(), 'src', 'assets', 'ribbons', 'mvp.svg');
    const mvpSvg = await loadImage(mvpSvgPath);

    return {
      shouldRender: true,
      image: mvpSvg,
      width: 200,
      height: 40,
      warnings,
      timings: {
        load_ms: Date.now() - startTime,
      },
    };
  } catch (error) {
    console.error('Error loading MVP ribbon:', error);
    warnings.push(`Error loading MVP ribbon: ${error.message}`);

    return {
      shouldRender: false,
      image: null,
      warnings,
      timings: {
        load_ms: Date.now() - startTime,
      },
    };
  }
}

/**
 * Render MVP ribbon to canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} prepared - Prepared MVP ribbon data from prepareMvpRibbon()
 * @param {number} canvasWidth - Canvas width for positioning
 */
async function renderMvpRibbon(ctx, prepared, canvasWidth) {
  if (!prepared.shouldRender || !prepared.image) {
    console.debug('Skipping MVP ribbon render');
    return;
  }

  // Reset transparency
  ctx.globalAlpha = 1.0;

  // Save context state for rotation
  ctx.save();

  // Position and rotate ribbon in top-right corner
  const width = prepared.width;
  const height = prepared.height;

  ctx.translate(canvasWidth - width / 2, height / 2);
  ctx.rotate(Math.PI / 4); // Rotate 45 degrees clockwise
  ctx.drawImage(prepared.image, -45, -45, width, height);

  // Restore context state
  ctx.restore();
}

/**
 * Get warnings from MVP ribbon preparation
 * @param {Object} prepared - Prepared MVP ribbon data
 * @returns {Array<string>} Warnings
 */
function getMvpRibbonWarnings(prepared) {
  return prepared?.warnings || [];
}

/**
 * Get timings from MVP ribbon preparation
 * @param {Object} prepared - Prepared MVP ribbon data
 * @returns {Object} Timings
 */
function getMvpRibbonTimings(prepared) {
  return prepared?.timings || {};
}

module.exports = {
  prepareMvpRibbon,
  renderMvpRibbon,
  getMvpRibbonWarnings,
  getMvpRibbonTimings,
};
