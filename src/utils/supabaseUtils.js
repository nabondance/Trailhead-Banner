import packageJson from '../../package.json';

class SupabaseUtils {
  static async updateBannerCounter(thb_data, protocol, host) {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}` // Use Vercel's domain in production
      : `${protocol}://${host}`; // Fallback for local development

    const addBannerUrl = `${baseUrl}/api/add-banner`;
    const cleanedData = SupabaseUtils.cleanData(thb_data);
    try {
      const response = await fetch(addBannerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          thb_data: cleanedData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save banner hash');
      }
    } catch (error) {
      console.error('Error updating banner counter:', error);
    }
  }

  static cleanData(data) {
    // Clean the data as needed
    const cleanedData = {
      th_username: data.th_username,
      thb_processing_time: data.thb_processing_time,
      thb_options: data.options,
      thb_version: packageJson.version,
      bannerHash: data.bannerHash,
      mvp: data.mvpData.isMvp,
      rankData: {
        rank: data.rankData.rank.title,
        points: data.rankData.earnedPointsSum,
        badges: data.rankData.earnedBadgesCount,
        trails: data.rankData.completedTrailCount,
      },
      certificationsData: {
        certifications: data.certificationsData.certifications.map((cert) => ({
          title: cert.title,
          dateCompleted: cert.dateCompleted,
          dateExpired: cert.dateExpired,
          status: cert.status.title,
          logoUrl: cert.logoUrl,
          product: cert.product,
        })),
      },
      superbadgesData: {
        earnedAwards: {
          edges: data.superbadgesData.earnedAwards.edges
            .map((edge) => {
              if (edge.node.award) {
                return {
                  node: {
                    award: {
                      title: edge.node.award.title,
                      icon: edge.node.award.icon,
                    },
                  },
                };
              }
              return null;
            })
            .filter((edge) => edge !== null),
        },
      },
    };
    return cleanedData;
  }
}

export default SupabaseUtils;
