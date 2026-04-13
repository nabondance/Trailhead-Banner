import { getCountersConfig, formatCounterValue } from '../../utils/imageUtils.js';
import { drawBadgeCounter } from '../../utils/drawUtils.js';
import { Timer } from '../../utils/timerUtils.js';

/**
 * Counter Badges Component
 * Renders badge counters (Badges, Superbadges, Certifications, Trails, Points, Stamps,
 * Answers, Best Answers, Questions, Followers, Following, Groups)
 */

/**
 * Prepare counter badges for rendering
 * @param {Object} data - All data needed for counters
 * @param {Object} data.badgesData - Badges data from API
 * @param {Object} data.superbadgesData - Superbadges data from API
 * @param {Object} data.certificationsData - Certifications data from API
 * @param {Object} data.rankData - Rank data (for trail count and points)
 * @param {Object} data.stampsData - Stamps data from API
 * @param {Object} data.communityData - Community Q&A stats and connections from API
 * @param {Object} options - Component options
 * @param {Array<string>} options.counterOrder - Order of counters to display
 * @param {boolean} options.includeExpiredCertifications - Include expired certs in count
 * @param {boolean} options.includeRetiredCertifications - Include retired certs in count
 * @param {string} options.badgeLabelColor - Label color for counter badges
 * @returns {Promise<Object>} Prepared counter data
 */
async function prepareCounters(data, options = {}) {
  const timer = new Timer();
  timer.start('prepare');
  const warnings = [];

  // Company-specific counters (pre-computed by companyDataUtils)
  // When present, these override the standard calculations for shared counter types.
  const cc = data.companyCounters || {};

  // Extract counts from data (company pre-computed values take precedence)
  const badgeCount = cc.badge ?? data.badgesData?.trailheadStats?.earnedBadgesCount ?? 0;
  const superbadgeCount = cc.superbadge ?? data.superbadgesData?.trailheadStats?.superbadgeCount ?? 0;
  const certificationCount =
    cc.certification ??
    (
      data.certificationsData?.certifications?.filter(
        (cert) =>
          (options.includeExpiredCertifications || cert.status.expired === false) &&
          (options.includeRetiredCertifications || cert.status.title !== 'Retired')
      ) || []
    ).length;
  const trailCount = data.rankData?.completedTrailCount || 0;
  const pointCount = data.rankData?.earnedPointsSum || 0;
  const stampCount = data.stampsData?.totalCount || 0;
  const answerCount = data.communityData?.questionAndAnswersStats?.answersCount || 0;
  const bestAnswerCount = data.communityData?.questionAndAnswersStats?.bestAnswersCount || 0;
  const questionCount = data.communityData?.questionAndAnswersStats?.questionsCount || 0;
  const followerCount = data.communityData?.communityConnections?.followers?.totalCount || 0;
  const followingCount = data.communityData?.communityConnections?.following?.totalCount || 0;
  const groupCount = data.communityData?.communityConnections?.groups?.totalCount || 0;

  // Define counter mapping
  const COUNTER_MAP = {
    badge: { data: badgeCount, label: 'Badge', color: '#1f80c0' },
    superbadge: { data: superbadgeCount, label: 'Superbadge', color: '#f9a825' },
    certification: { data: certificationCount, label: 'Certification', color: '#8a00c4' },
    trail: { data: trailCount, label: 'Trail', color: '#06482A' },
    point: { data: pointCount, label: 'Point', color: '#18477D' },
    stamp: { data: stampCount, label: 'Stamp', color: '#00B3A4' },
    answer: { data: answerCount, label: 'Answer', color: '#C88000' },
    'best-answer': { data: bestAnswerCount, label: 'Best Answer', color: '#F0B800' },
    question: { data: questionCount, label: 'Question', color: '#9A6200' },
    follower: { data: followerCount, label: 'Follower', color: '#E0357A' },
    following: { data: followingCount, label: 'Following', color: '#B02860' },
    group: { data: groupCount, label: 'Group', color: '#801D48' },
    // Company-only counters
    people: { data: cc.people || 0, label: 'Trailblazer', color: '#1f80c0' },
    ranger: { data: cc.ranger || 0, label: 'Ranger', color: '#06482A' },
    mvp: { data: cc.mvp || 0, label: 'MVP', color: '#E0357A' },
    cta: { data: cc.cta || 0, label: 'CTA', color: '#C23934' },
  };

  // Get counter configuration (scale and spacing)
  const counterConfig = getCountersConfig(options);

  // Build list of counters to display
  const countersToDisplay = [];
  const counterOrder = options.counterOrder || [];

  for (const counterId of counterOrder) {
    const counter = COUNTER_MAP[counterId];
    if (!counter) continue;

    const shouldShow = counter.data > 0;
    if (shouldShow) {
      countersToDisplay.push({
        id: counterId,
        label: counter.label,
        value: formatCounterValue(counter.data),
        color: counter.color,
      });
    }
  }

  return {
    counters: countersToDisplay,
    config: counterConfig,
    warnings,
    timings: timer.end('prepare').get(),
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
  const timer = new Timer();
  timer.start('render');

  if (!prepared.counters || prepared.counters.length === 0) {
    console.debug('No counters to render');
    return timer.end('render').get();
  }

  const { counters, config } = prepared;
  const badgeScale = config.badgeCounterScale;
  const yDelta = config.badgeCounterYDelta;

  let currentY = startY;

  for (const counter of counters) {
    try {
      await drawBadgeCounter(
        ctx,
        counter.label,
        counter.value,
        startX,
        currentY,
        badgeScale,
        badgeLabelColor,
        counter.color
      );
      currentY += yDelta;
    } catch (error) {
      console.error(`Error drawing ${counter.label} counter:`, error);
      prepared.warnings.push(`Error drawing ${counter.label} counter: ${error.message}`);
    }
  }

  return timer.end('render').get();
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

export { prepareCounters, renderCounters, getCountersWarnings, getCountersLayout };
