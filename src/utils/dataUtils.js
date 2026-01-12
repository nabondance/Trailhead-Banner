const certificationsDataJson = require('../data/certifications.json');
import SupabaseUtils from './supabaseUtils';

export const getLocalCertificationData = (certification) => {
  const certificationData = certificationsDataJson[certification.title];
  if (!certificationData) {
    console.error(`No data found for certification: ${certification.title}:`, certification);
    SupabaseUtils.updateErrors({
      type: 'certification',
      error: `No data found for certification: ${certification.title}`,
      error_data: certification,
    });
  }
  return certificationData;
};

/**
 * Extract the highest Agentblazer rank per year from learner status levels
 * @param {Array} learnerStatusLevels - Array of learner status level objects from GraphQL
 * @returns {Array} Array of highest rank per year, sorted by year descending (most recent first)
 *
 * @example
 * const agentblazerData = { learnerStatusLevels: [...] };
 * const highestRanks = getHighestAgentblazerRankPerYear(agentblazerData.learnerStatusLevels);
 * // Returns:
 * // [
 * //   { year: "2026", title: "Champion", level: 1, active: true, ... },
 * //   { year: "2025", title: "Legend", level: 3, active: false, ... }
 * // ]
 */
export const getHighestAgentblazerRankPerYear = (learnerStatusLevels) => {
  if (!learnerStatusLevels || !Array.isArray(learnerStatusLevels)) {
    return [];
  }

  // Filter only Agentblazer status levels that are completed (progress === 100 or has completedAt date)
  const agentblazerLevels = learnerStatusLevels.filter(
    (level) => level.statusName === 'Agentblazer' && (level.progress === 100 || level.completedAt)
  );

  // Group by edition (year) and get the highest level for each year
  const highestByYear = {};
  agentblazerLevels.forEach((level) => {
    const year = level.edition;
    if (!highestByYear[year] || level.level > highestByYear[year].level) {
      highestByYear[year] = {
        year: year,
        title: level.title,
        level: level.level,
        imageUrl: level.imageUrl,
        completedAt: level.completedAt,
        progress: level.progress,
        medalImageUrl: level.medalImageUrl,
        active: level.active,
      };
    }
  });

  // Convert to array sorted by year descending (most recent first)
  return Object.values(highestByYear).sort((a, b) => b.year.localeCompare(a.year));
};

export const logOptions = (options) => {
  console.log('Generating banner with the following data:');
  console.log('Username:', options.username);
  console.log('Rank Data:', options.rankData);
  console.log('Certifications Data:', options.certificationsData);
  console.log('Badges Data:', options.badgesData);
  console.log('Superbadges Data:', options.superbadgesData);
  console.log('Stamps Data:', options.stampsData);
  console.log('Agentblazer Data:', options.agentblazerData);
  console.log('Background Options:', {
    kind: options.backgroundKind,
    libraryUrl: options.backgroundLibraryUrl,
    backgroundImageUrl: options.backgroundImageUrl,
    customBackgroundImageUrl: options.customBackgroundImageUrl,
    backgroundColor: options.backgroundColor,
  });
  console.log('Display Options:', {
    rankLogo: options.displayRankLogo,
    agentblazerRank: options.displayAgentblazerRank,
    agentblazerRankDisplay: options.agentblazerRankDisplay,
  });
  console.log('Counter Options:', {
    textColor: options.textColor,
    badgeCount: options.displayBadgeCount,
    superbadgeCount: options.displaySuperbadgeCount,
    certificationCount: options.displayCertificationCount,
    trailCount: options.displayTrailCount,
    pointCount: options.displayPointCount,
    stampCount: options.displayStampCount,
  });
  console.log('Badge Options:', {
    labelColor: options.badgeLabelColor,
    messageColor: options.badgeMessageColor,
  });
  console.log('Superbadge Options:', {
    superbadges: options.displaySuperbadges,
    displayLastXSuperbadges: options.lastXSuperbadges,
    lastXSuperbadges: options.lastXSuperbadges,
    superbadgeAlignment: options.superbadgeAlignment,
  });
  console.log('Certification Options:', {
    includeExpired: options.includeExpiredCertifications,
    includeRetired: options.includeRetiredCertifications,
    displayLastXCertifications: options.lastXCertifications,
    lastXCertifications: options.lastXCertifications,
    certificationAlignment: options.certificationAlignment,
  });
  console.log('MVP Data:', options.mvpData);
};
