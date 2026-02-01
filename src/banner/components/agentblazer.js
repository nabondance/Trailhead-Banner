import { loadImage } from '@napi-rs/canvas';
import { getLocal } from '../../utils/cacheUtils.js';
import { getHighestAgentblazerRankPerYear } from '../../utils/dataUtils.js';

/**
 * Agentblazer Rank Component
 * Renders the Agentblazer rank logo (Champion/Innovator/Legend)
 */

/**
 * Prepare Agentblazer rank logo for rendering
 * @param {Object} agentblazerData - Agentblazer data from API
 * @param {Object} options - Component options
 * @param {boolean} options.displayAgentblazerRank - Whether to display Agentblazer rank
 * @param {string} options.agentblazerRankDisplay - Display mode: allTimeHigh|currentYear
 * @returns {Promise<Object>} Prepared Agentblazer data
 */
async function prepareAgentblazer(agentblazerData, options) {
  const startTime = Date.now();
  const warnings = [];

  if (!options.displayAgentblazerRank || !agentblazerData?.learnerStatusLevels) {
    return {
      shouldRender: false,
      image: null,
      width: 0,
      height: 0,
      warnings,
      timings: {
        load_ms: 0,
      },
    };
  }

  try {
    // Get the highest rank per year
    const highestRanksPerYear = getHighestAgentblazerRankPerYear(agentblazerData.learnerStatusLevels);

    let selectedRank = null;
    if (options.agentblazerRankDisplay === 'allTimeHigh') {
      // Find the highest level across all years
      selectedRank = highestRanksPerYear.reduce((highest, current) => {
        if (!highest || current.level > highest.level) {
          return current;
        }
        return highest;
      }, null);
    } else {
      // Default: show current active rank (the most recent year, or the one marked as active)
      selectedRank = highestRanksPerYear.find((rank) => rank.active === true) || highestRanksPerYear[0];
    }

    if (!selectedRank) {
      return {
        shouldRender: false,
        image: null,
        width: 0,
        height: 0,
        warnings,
        timings: {
          load_ms: Date.now() - startTime,
        },
      };
    }

    const agentBlazerBuffer = await getLocal(`${selectedRank.title}.png`, 'Agentblazer');
    const agentBlazerImage = await loadImage(agentBlazerBuffer);

    const logoHeight = 100;
    const logoWidth = (agentBlazerImage.width / agentBlazerImage.height) * logoHeight;

    return {
      shouldRender: true,
      image: agentBlazerImage,
      width: logoWidth,
      height: logoHeight,
      rank: selectedRank,
      warnings,
      timings: {
        load_ms: Date.now() - startTime,
      },
    };
  } catch (error) {
    console.error('Error loading Agentblazer logo:', error);
    warnings.push(`Error loading Agentblazer logo: ${error.message}`);

    return {
      shouldRender: false,
      image: null,
      width: 0,
      height: 0,
      warnings,
      timings: {
        load_ms: Date.now() - startTime,
      },
    };
  }
}

/**
 * Render Agentblazer rank logo to canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} prepared - Prepared Agentblazer data from prepareAgentblazer()
 * @param {number} x - X position
 * @param {number} y - Y position
 */
async function renderAgentblazer(ctx, prepared, x, y) {
  if (!prepared.shouldRender || !prepared.image) {
    console.debug('Skipping Agentblazer render');
    return;
  }

  ctx.drawImage(prepared.image, x, y, prepared.width, prepared.height);
}

/**
 * Get warnings from Agentblazer preparation
 * @param {Object} prepared - Prepared Agentblazer data
 * @returns {Array<string>} Warnings
 */
function getAgentblazerWarnings(prepared) {
  return prepared?.warnings || [];
}

/**
 * Get timings from Agentblazer preparation
 * @param {Object} prepared - Prepared Agentblazer data
 * @returns {Object} Timings
 */
function getAgentblazerTimings(prepared) {
  return prepared?.timings || {};
}

/**
 * Get Agentblazer dimensions for layout calculations
 * @param {Object} prepared - Prepared Agentblazer data
 * @returns {Object} Width and height
 */
function getAgentblazerDimensions(prepared) {
  return {
    width: prepared.width,
    height: prepared.height,
  };
}

export {
  prepareAgentblazer,
  renderAgentblazer,
  getAgentblazerWarnings,
  getAgentblazerTimings,
  getAgentblazerDimensions,
};
