import { getCountersConfig, getCounterPointText } from '../../utils/imageUtils.js';
import { drawBadgeCounter } from '../../utils/drawUtils.js';

/**
 * Counter Badges Component
 * Renders badge counters (Badges, Superbadges, Certifications, Trails, Points, Stamps)
 */

/**
 * Prepare counter badges for rendering
 * @param {Object} data - All data needed for counters
 * @param {Object} data.badgesData - Badges data from API
 * @param {Object} data.superbadgesData - Superbadges data from API
 * @param {Object} data.certificationsData - Certifications data from API
 * @param {Object} data.rankData - Rank data (for trail count and points)
 * @param {Object} data.stampsData - Stamps data from API
 * @param {Object} options - Component options
 * @param {Array<string>} options.counterOrder - Order of counters to display
 * @param {boolean} options.includeExpiredCertifications - Include expired certs in count
 * @param {boolean} options.includeRetiredCertifications - Include retired certs in count
 * @param {string} options.badgeLabelColor - Label color for counter badges
 * @returns {Promise<Object>} Prepared counter data
 */
async function prepareCounters(data, options) {
  const startTime = Date.now();
  const warnings = [];

  // Extract counts from data
  const badgeCount = data.badgesData?.trailheadStats?.earnedBadgesCount || 0;
  const superbadgeCount = data.superbadgesData?.trailheadStats?.superbadgeCount || 0;
  const certificationCount = (
    data.certificationsData?.certifications?.filter(
      (cert) =>
        (options.includeExpiredCertifications || cert.status.expired === false) &&
        (options.includeRetiredCertifications || cert.status.title !== 'Retired')
    ) || []
  ).length;
  const trailCount = data.rankData?.completedTrailCount || 0;
  const pointCount = getCounterPointText(data.rankData?.earnedPointsSum || 0);
  const stampCount = data.stampsData?.totalCount || 0;

  // Define counter mapping
  const COUNTER_MAP = {
    badge: { data: badgeCount, label: 'Badge', color: '#1f80c0' },
    superbadge: { data: superbadgeCount, label: 'Superbadge', color: '#f9a825' },
    certification: { data: certificationCount, label: 'Certification', color: '#8a00c4' },
    trail: { data: trailCount, label: 'Trail', color: '#06482A' },
    point: { data: pointCount, label: 'Point', color: '#18477D' },
    stamp: { data: stampCount, label: 'Stamp', color: '#00B3A4' },
  };

  // Get counter configuration (scale and spacing)
  const counterConfig = getCountersConfig(options);

  // Build list of counters to display
  const countersToDisplay = [];
  const counterOrder = options.counterOrder || [];

  for (const counterId of counterOrder) {
    const counter = COUNTER_MAP[counterId];
    if (!counter) continue;

    const shouldShow = counterId === 'point' ? counter.data != 0 : counter.data > 0;
    if (shouldShow) {
      countersToDisplay.push({
        id: counterId,
        label: counter.label,
        value: counter.data,
        color: counter.color,
      });
    }
  }

  return {
    counters: countersToDisplay,
    config: counterConfig,
    warnings,
    timings: {
      prepare_ms: Date.now() - startTime,
    },
  };
}

/**
 * Render counter badges to canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} prepared - Prepared counter data from prepareCounters()
 * @param {number} startX - Starting X position
 * @param {number} startY - Starting Y position
 * @param {string} badgeLabelColor - Label color for badges
 */
async function renderCounters(ctx, prepared, startX, startY, badgeLabelColor) {
  const startTime = Date.now();

  if (!prepared.counters || prepared.counters.length === 0) {
    console.debug('No counters to render');
    return {
      render_ms: 0,
    };
  }

  const { counters, config } = prepared;
  const badgeScale = config.badgeCounterScale;
  const yDelta = config.badgeCounterYDelta;

  let currentY = startY;

  for (const counter of counters) {
    try {
      await drawBadgeCounter(ctx, counter.label, counter.value, startX, currentY, badgeScale, badgeLabelColor, counter.color);
      currentY += yDelta;
    } catch (error) {
      console.error(`Error drawing ${counter.label} counter:`, error);
      prepared.warnings.push(`Error drawing ${counter.label} counter: ${error.message}`);
    }
  }

  return {
    render_ms: Date.now() - startTime,
  };
}

/**
 * Get warnings from counter preparation/rendering
 * @param {Object} prepared - Prepared counter data
 * @returns {Array<string>} Warnings
 */
function getCountersWarnings(prepared) {
  return prepared?.warnings || [];
}

/**
 * Get timings from counter preparation
 * @param {Object} prepared - Prepared counter data
 * @returns {Object} Timings
 */
function getCountersTimings(prepared) {
  return prepared?.timings || {};
}

/**
 * Get counter layout info for positioning other components
 * @param {Object} prepared - Prepared counter data
 * @returns {Object} Layout information
 */
function getCountersLayout(prepared) {
  const { config, counters } = prepared;
  const count = counters?.length || 0;
  const yDelta = config?.badgeCounterYDelta || 0;
  const totalHeight = count > 0 ? count * yDelta : 0;

  return {
    count,
    totalHeight,
    yDelta,
  };
}

export {
  prepareCounters,
  renderCounters,
  getCountersWarnings,
  getCountersTimings,
  getCountersLayout,
};
