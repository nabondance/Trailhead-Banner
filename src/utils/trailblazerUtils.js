/**
 * Merges trailblazer data from multiple users into a single aggregated object
 * that matches the same structure as a single user's data.
 */
function mergeTrailblazerData(trailblazerDataArray) {
  console.log('Merging Trailblazer Data for', trailblazerDataArray.length, 'users');
  return trailblazerDataArray.reduce(
    (acc, userData) => {
      const { rankData, certificationsData, badgesData, superbadgesData, mvpData } = userData;

      // Aggregate rank data (sum points, badges, and trails)
      acc.rankData.points = (acc.rankData.points || 0) + (rankData?.trailheadStats?.earnedPointsSum || 0);
      acc.rankData.badges = (acc.rankData.badges || 0) + (rankData?.trailheadStats?.badges || 0);
      acc.rankData.trails = (acc.rankData.trails || 0) + (rankData?.trailheadStats?.completedTrailCount || 0);

      // Combine unique certifications
      const certIds = new Set(acc.certificationsData.certifications.map((cert) => cert.id));
      acc.certificationsData.certifications.push(
        ...(certificationsData?.certifications || []).filter((cert) => {
          if (!certIds.has(cert.id)) {
            certIds.add(cert.id);
            return true;
          }
          return false;
        })
      );

      // Combine unique badges
      const badgeIds = new Set(acc.badgesData.earnedBadges.edges.map((edge) => edge.node.id));
      acc.badgesData.earnedBadges.edges.push(
        ...(badgesData?.earnedBadges?.edges || []).filter((edge) => {
          if (!badgeIds.has(edge.node.id)) {
            badgeIds.add(edge.node.id);
            return true;
          }
          return false;
        })
      );

      // Update badge count
      acc.badgesData.trailheadStats.earnedBadgesCount = acc.badgesData.earnedBadges.edges.length;

      // Combine unique superbadges
      const superbadgeIds = new Set(acc.superbadgesData.earnedBadges.edges.map((edge) => edge.node.id));
      acc.superbadgesData.earnedBadges.edges.push(
        ...(superbadgesData?.earnedBadges?.edges || []).filter((edge) => {
          if (!superbadgeIds.has(edge.node.id)) {
            superbadgeIds.add(edge.node.id);
            return true;
          }
          return false;
        })
      );

      // Update superbadge count
      acc.superbadgesData.trailheadStats.superbadgeCount = acc.superbadgesData.earnedBadges.edges.length;

      // Track MVP count
      if (mvpData?.isMvp) {
        acc.mvpCount++;
      }

      return acc;
    },
    {
      rankData: {
        points: 0,
        badges: 0,
        trails: 0,
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
        trailheadStats: { superbadgeCount: 0 },
      },
      mvpCount: 0,
    }
  );
}

module.exports = {
  mergeTrailblazerData,
};
