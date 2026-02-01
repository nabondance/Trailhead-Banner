const { loadImage } = require('@napi-rs/canvas');
const { getImage, getLocal } = require('../../utils/cacheUtils');

/**
 * Rank Logo Component
 * Renders the Trailblazer/Ranger rank logo in the top-left area
 */

const DEFAULT_RANK_WIDTH = 180;
const DEFAULT_RANK_HEIGHT = 40;

/**
 * Prepare rank logo for rendering
 * @param {Object} rankData - Rank data from API
 * @param {Object} options - Component options
 * @param {boolean} options.displayRankLogo - Whether to display the rank logo
 * @param {number} options.scalingFactor - Scaling factor for the logo (default 1.2)
 * @param {number} canvasHeight - Canvas height for size calculation
 * @returns {Promise<Object>} Prepared rank logo data
 */
async function prepareRankLogo(rankData, options, canvasHeight) {
  const startTime = Date.now();
  const warnings = [];
  const scalingFactor = options.scalingFactor || 1.2;
  const topPartRatio = 1 / 4; // Top 1/4 of canvas

  // Check if rank data exists
  if (!rankData?.rank || !rankData.rank.imageUrl) {
    console.debug('Rank data not available, using default dimensions');
    return {
      shouldRender: false,
      image: null,
      width: DEFAULT_RANK_WIDTH,
      height: DEFAULT_RANK_HEIGHT,
      scalingFactor,
      warnings,
      timings: {
        load_ms: 0,
      },
    };
  }

  try {
    let rankLogoBuffer;
    let rankLogo;

    // Try to load from local assets first, then fallback to remote URL
    try {
      const rankFileName = rankData.rank.imageUrl.split('/').pop();
      rankLogoBuffer = await getLocal(rankFileName, 'Rank');
      rankLogo = await loadImage(rankLogoBuffer);
      console.debug(`Loaded rank logo locally: ${rankFileName}`);
    } catch (localError) {
      console.debug(`Local rank logo not found, downloading from URL: ${rankData.rank.imageUrl}`);
      const rankLogoResult = await getImage(rankData.rank.imageUrl, 'ranks');
      rankLogoBuffer = rankLogoResult.buffer || rankLogoResult;
      rankLogo = await loadImage(rankLogoBuffer);
    }

    // Calculate dimensions maintaining aspect ratio
    const rankLogoHeight = canvasHeight * topPartRatio * 1;
    const rankLogoWidth = (rankLogo.width / rankLogo.height) * rankLogoHeight;

    return {
      shouldRender: options.displayRankLogo,
      image: rankLogo,
      width: rankLogoWidth,
      height: rankLogoHeight,
      scalingFactor,
      warnings,
      timings: {
        load_ms: Date.now() - startTime,
      },
    };
  } catch (error) {
    const rankUrl = rankData.rank?.imageUrl || 'unknown';
    console.error(`Error loading rank logo ${rankUrl}:`, error);
    warnings.push(`Error loading rank logo ${rankUrl}: ${error.message}`);

    return {
      shouldRender: false,
      image: null,
      width: DEFAULT_RANK_WIDTH,
      height: DEFAULT_RANK_HEIGHT,
      scalingFactor,
      warnings,
      timings: {
        load_ms: Date.now() - startTime,
      },
    };
  }
}

/**
 * Render rank logo to canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} prepared - Prepared rank logo data from prepareRankLogo()
 * @param {number} x - X position (typically 0 for top-left)
 * @param {number} y - Y position (typically 0 for top-left)
 */
async function renderRankLogo(ctx, prepared, x = 0, y = 0) {
  if (!prepared.shouldRender || !prepared.image) {
    console.debug('Skipping rank logo render');
    return;
  }

  const width = prepared.width * prepared.scalingFactor;
  const height = prepared.height * prepared.scalingFactor;

  ctx.drawImage(prepared.image, x, y, width, height);
}

/**
 * Get warnings from rank logo preparation
 * @param {Object} prepared - Prepared rank logo data
 * @returns {Array<string>} Warnings
 */
function getRankLogoWarnings(prepared) {
  return prepared?.warnings || [];
}

/**
 * Get timings from rank logo preparation
 * @param {Object} prepared - Prepared rank logo data
 * @returns {Object} Timings
 */
function getRankLogoTimings(prepared) {
  return prepared?.timings || {};
}

/**
 * Get rank logo dimensions for layout calculations
 * @param {Object} prepared - Prepared rank logo data
 * @returns {Object} Width and height (scaled)
 */
function getRankLogoDimensions(prepared) {
  return {
    width: prepared.width * prepared.scalingFactor,
    height: prepared.height * prepared.scalingFactor,
    unscaledWidth: prepared.width,
    unscaledHeight: prepared.height,
  };
}

module.exports = {
  prepareRankLogo,
  renderRankLogo,
  getRankLogoWarnings,
  getRankLogoTimings,
  getRankLogoDimensions,
};
