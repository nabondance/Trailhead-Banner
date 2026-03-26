import { getHighestAgentblazerRankPerYear } from './dataUtils.js';

const CTA_CERT_TITLE = 'Salesforce Certified Technical Architect';

// Agentblazer level display order (highest prestige first)
const AGENTBLAZER_LEVELS = ['Legend', 'Champion', 'Innovator'];

/**
 * Determine the agentblazer level for a user given their raw agentblazer data and display mode.
 * @param {Object} agentblazerData - Raw agentblazer data from GraphQL
 * @param {string} displayMode - 'current' or 'allTimeHigh'
 * @returns {string|null} Level title or null
 */
function getUserAgentblazerLevel(agentblazerData, displayMode) {
  const levels = agentblazerData?.learnerStatusLevels;
  if (!levels) return null;

  const ranksPerYear = getHighestAgentblazerRankPerYear(levels);
  if (!ranksPerYear || ranksPerYear.length === 0) return null;

  let selectedRank = null;
  if (displayMode === 'allTimeHigh') {
    selectedRank = ranksPerYear.reduce((highest, current) => {
      if (!highest || current.level > highest.level) return current;
      return highest;
    }, null);
  } else {
    // current: most recent active rank
    selectedRank = ranksPerYear.find((r) => r.active === true) || ranksPerYear[0];
  }

  return selectedRank?.title || null;
}

/**
 * Determine if a cert is an Accredited Professional cert.
 * @param {Object} cert
 * @returns {boolean}
 */
function isAccreditedProfessional(cert) {
  return cert.title.includes('Accredited Professional');
}

/**
 * Filter a cert based on cert type options.
 * @param {Object} cert
 * @param {Object} options
 * @returns {boolean}
 */
function certPassesTypeFilter(cert, options) {
  const displaySalesforce = options.displaySalesforceCertifications ?? true;
  const displayAccredited = options.displayAccreditedProfessionalCertifications ?? true;
  const isAP = isAccreditedProfessional(cert);
  return (displaySalesforce || isAP) && (displayAccredited || !isAP);
}

/**
 * Aggregate data from multiple users into a company data object.
 *
 * @param {Array} usersData - Array of { username, rankData, certificationsData, superbadgesData, mvpData, agentblazerData }
 * @param {Object} options - Banner options
 * @returns {Object} Aggregated company data
 */
export function aggregateCompanyData(usersData, options = {}) {
  const includeExpired = options.includeExpiredCertifications ?? true;
  const agentblazerDisplayMode = options.agentblazerRankDisplay ?? 'current';

  // --- Cert aggregation ---
  // Map: cert title → { cert object, holders: [{ username, dateCompleted, expired }] }
  const certMap = new Map();

  // --- Superbadge aggregation ---
  const allSuperbadges = [];
  const uniqueSuperbadgeMap = new Map(); // title → first superbadge node

  // --- Counters ---
  let totalBadges = 0;
  let mvpCount = 0;
  let rangerCount = 0;
  let ctaCount = 0;

  // --- Agentblazer ---
  const agentblazerCounts = { Innovator: 0, Champion: 0, Legend: 0 };
  const agentblazerCurrentLevels = []; // for CSV: current level per user
  const agentblazerAllTimeLevels = []; // for CSV: all-time high per user

  // --- Per-user data for CSV ---
  const perUserData = [];

  for (const user of usersData) {
    const { username, rankData, certificationsData, superbadgesData, mvpData, agentblazerData } = user;

    // Badges
    totalBadges += rankData?.earnedBadgesCount || 0;

    // Rank check for Ranger+ (Ranger and above)
    const rankTitle = rankData?.rank?.title || '';
    if (rankTitle.toLowerCase().includes('ranger')) {
      rangerCount++;
    }

    // MVP
    const isMvp = mvpData?.isMvp || false;
    if (isMvp) mvpCount++;

    // Certifications
    const certs = certificationsData?.certifications || [];
    let userActiveCerts = 0;
    let userExpiredCerts = 0;
    let userTotalCerts = 0;
    let hasCta = false;

    for (const cert of certs) {
      if (!certPassesTypeFilter(cert, options)) continue;

      const isExpired = cert.status?.expired === true;
      const isRetired = cert.status?.title === 'Retired';

      // Skip expired if option says active only (default for company is include all-time)
      if (!includeExpired && isExpired) continue;

      userTotalCerts++;
      if (isExpired) {
        userExpiredCerts++;
      } else {
        userActiveCerts++;
      }

      if (cert.title === CTA_CERT_TITLE && !isExpired) hasCta = true;

      // Add to cert map
      if (!certMap.has(cert.title)) {
        certMap.set(cert.title, {
          title: cert.title,
          logoUrl: cert.logoUrl,
          product: cert.product,
          dateExpired: cert.dateExpired,
          isRetired,
          holders: [],
        });
      }
      certMap.get(cert.title).holders.push({
        username,
        dateCompleted: cert.dateCompleted,
        expired: isExpired,
      });
    }

    if (hasCta) ctaCount++;

    // Superbadges
    const sbEdges = superbadgesData?.earnedAwards?.edges || [];
    for (const edge of sbEdges) {
      const award = edge?.node?.award;
      if (!award) continue;
      allSuperbadges.push(award);
      if (!uniqueSuperbadgeMap.has(award.title)) {
        uniqueSuperbadgeMap.set(award.title, award);
      }
    }

    // Agentblazer
    const currentLevel = getUserAgentblazerLevel(agentblazerData, 'current');
    const allTimeHighLevel = getUserAgentblazerLevel(agentblazerData, 'allTimeHigh');

    agentblazerCurrentLevels.push({ username, level: currentLevel });
    agentblazerAllTimeLevels.push({ username, level: allTimeHighLevel });

    // Count for banner using selected display mode
    const levelForBanner = agentblazerDisplayMode === 'allTimeHigh' ? allTimeHighLevel : currentLevel;
    if (levelForBanner && agentblazerCounts.hasOwnProperty(levelForBanner)) {
      agentblazerCounts[levelForBanner]++;
    }

    perUserData.push({
      username,
      rank: rankTitle,
      badges: rankData?.earnedBadgesCount || 0,
      superbadges: sbEdges.length,
      certifications_total: userTotalCerts,
      certifications_active: userActiveCerts,
      certifications_expired: userExpiredCerts,
      mvp: isMvp,
      agentblazer_current: currentLevel || 'none',
      agentblazer_alltime_high: allTimeHighLevel || 'none',
      cta: hasCta,
      certs: certs.filter((c) => certPassesTypeFilter(c, options)),
    });
  }

  // --- Build aggregated cert list ---
  const aggregatedCerts = [];
  for (const [, certData] of certMap) {
    const { holders, isRetired, ...certBase } = certData;
    const count = holders.length;
    const activeHolders = holders.filter((h) => !h.expired);
    const allExpired = activeHolders.length === 0;

    // firstTimeWon: earliest dateCompleted across all holders
    const firstTimeWon =
      holders
        .map((h) => h.dateCompleted)
        .filter(Boolean)
        .sort()[0] || null;

    // For the banner: show as active unless everyone has it expired
    const displayExpired = allExpired && !isRetired;

    aggregatedCerts.push({
      ...certBase,
      dateCompleted: firstTimeWon,
      status: {
        expired: displayExpired,
        title: isRetired ? 'Retired' : displayExpired ? 'Expired' : 'Active',
      },
      count,
      isRetired,
    });
  }

  const totalCerts = aggregatedCerts.reduce((sum, c) => sum + c.count, 0);
  const activeCerts = aggregatedCerts
    .filter((c) => !c.status.expired && !c.isRetired)
    .reduce((sum, c) => sum + c.count, 0);
  return {
    // For cert grid rendering (passed as certificationsData to certifications component)
    certificationsData: {
      certifications: aggregatedCerts,
    },

    // For counters component
    counters: {
      people: usersData.length,
      badge: totalBadges,
      certification: totalCerts,
      superbadge: allSuperbadges.length,
      mvp: mvpCount,
      ranger: rangerCount,
      'active-certs': activeCerts,
      cta: ctaCount,
    },

    // For companyAgentblazer component
    agentblazer: agentblazerCounts,

    // For superbadges component
    superbadgesData: {
      all: allSuperbadges,
      unique: Array.from(uniqueSuperbadgeMap.values()),
    },

    // For CSV
    perUserData,
    agentblazerCurrentLevels,
    agentblazerAllTimeLevels,
    allCertTitles: aggregatedCerts.map((c) => c.title),

    // Metadata
    agentblazerLevels: AGENTBLAZER_LEVELS,
  };
}

export { CTA_CERT_TITLE, AGENTBLAZER_LEVELS };
