const { logOptions } = require('./dataUtils');
const { generateStandardBanner } = require('../banner/renderers/standardBanner');
require('./fonts');

/**
 * Generate banner image using component-based renderer
 * Maintains backward compatibility with existing API
 */
export const generateImage = async (options) => {
  // Options logging
  logOptions(options);

  // Prepare data structure for new renderer
  const data = {
    rankData: options.rankData,
    badgesData: options.badgesData,
    superbadgesData: options.superbadgesData,
    certificationsData: options.certificationsData,
    mvpData: options.mvpData,
    agentblazerData: options.agentblazerData,
    stampsData: options.stampsData,
  };

  // Use new component-based renderer
  return await generateStandardBanner(data, options);
};
