/**
 * Merges trailblazer data from multiple users into a single aggregated object
 * that matches the same structure as a single user's data.
 */
function mergeTrailblazerData(trailblazerDataArray) {
  console.log('Merging Trailblazer Data for', trailblazerDataArray.length, 'users');

  // Initialize the merged data structure
  const mergedData = {
    rankData: {
      points: 0,
      badges: 0,
      trails: 0,
      completedTrailCount: 0,
      earnedPointsSum: 0,
      rank: {
        imageUrl:
          'https://res.cloudinary.com/trailhead/image/upload/public-trailhead/assets/images/ranks/triple-star-ranger.png',
      },
    },
    certificationsData: {
      certifications: [],
    },
    badgesData: {
      earnedBadges: { edges: [] },
      trailheadStats: { earnedBadgesCount: 0 },
    },
    superbadgesData: {
      earnedBadges: { edges: [] },
      earnedAwards: { edges: [] },
      trailheadStats: { superbadgeCount: 0 },
    },
    mvpData: {
      isMvp: false,
    },
    mvpCount: 0,
  };

  // Track unique items using Sets
  const certIds = new Set();
  const badgeIds = new Set();
  const superbadgeIds = new Set();

  // Process each user's data
  for (const userData of trailblazerDataArray) {
    const { rankData, certificationsData, badgesData, superbadgesData, mvpData } = userData;

    // Merge rank data
    const earnedPoints = rankData?.earnedPointsSum || 0;
    mergedData.rankData.points += earnedPoints;
    mergedData.rankData.earnedPointsSum += earnedPoints;

    const badges = rankData?.earnedBadgesCount || 0;
    mergedData.rankData.badges += badges;

    const trails = rankData?.completedTrailCount || 0;
    mergedData.rankData.trails += trails;
    mergedData.rankData.completedTrailCount += trails;

    // Merge certifications
    if (certificationsData?.certifications) {
      for (const cert of certificationsData.certifications) {
        if (!certIds.has(cert.title)) {
          certIds.add(cert.title);
          mergedData.certificationsData.certifications.push(cert);
        }
      }
    }

    // Merge badges
    if (badgesData?.earnedBadges?.edges) {
      for (const edge of badgesData.earnedBadges.edges) {
        if (!badgeIds.has(edge.node.id)) {
          badgeIds.add(edge.node.id);
          mergedData.badgesData.earnedBadges.edges.push(edge);
        }
      }
    }

    // Merge superbadges from earnedAwards structure
    if (superbadgesData?.earnedAwards?.edges) {
      for (const edge of superbadgesData.earnedAwards.edges) {
        if (edge.node?.award?.type === 'SUPERBADGE' && !superbadgeIds.has(edge.node.award.id)) {
          superbadgeIds.add(edge.node.award.id);
          // Store in both data structures for compatibility
          mergedData.superbadgesData.earnedBadges.edges.push({
            node: {
              id: edge.node.award.id,
              title: edge.node.award.title,
              imageUrl: edge.node.award.icon,
            },
          });
          mergedData.superbadgesData.earnedAwards.edges.push(edge);
        }
      }
    }

    // Track MVP status
    if (mvpData?.isMvp) {
      mergedData.mvpCount++;
      mergedData.mvpData.isMvp = true;
    }

    // Update badge and superbadge counts directly from trailheadStats
    if (badgesData?.trailheadStats?.earnedBadgesCount) {
      mergedData.badgesData.trailheadStats.earnedBadgesCount += badgesData.trailheadStats.earnedBadgesCount;
    }

    if (superbadgesData?.trailheadStats?.superbadgeCount) {
      mergedData.superbadgesData.trailheadStats.superbadgeCount += superbadgesData.trailheadStats.superbadgeCount;
    }
  }

  console.log('Merged Trailblazer Data:', mergedData);
  return mergedData;
}

module.exports = {
  mergeTrailblazerData,
};
