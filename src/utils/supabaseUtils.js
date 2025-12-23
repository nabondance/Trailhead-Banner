import packageJson from '../../package.json';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

class SupabaseUtils {
  static async updateBannerCounterViaAPI(thb_data, protocol, host) {
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

  static async updateBannerCounter(thb_data) {
    thb_data = SupabaseUtils.cleanData(thb_data);
    try {
      const { data, error } = await supabase.from('banners').insert([
        {
          th_username: thb_data.th_username,
          thb_processing_time: thb_data.thb_processing_time,
          source_env: process.env.VERCEL_ENV ? process.env.VERCEL_ENV : 'development',
          thb_options: thb_data.thb_options,
          thb_version: thb_data.thb_version,
          thb_banner_hash: thb_data.bannerHash,
          th_nb_points: thb_data.rankData.points,
          th_nb_certif: thb_data.certificationsData.certifications.length,
          th_nb_sb: thb_data.superbadgesData.earnedAwards.edges.length,
          th_nb_badge: thb_data.rankData.badges,
          th_nb_stamps: thb_data.stampsData.totalCount,
          th_certif: thb_data.certificationsData.certifications,
          th_sb: thb_data.superbadgesData.earnedAwards.edges,
          th_stamps: thb_data.stampsData,
          th_mvp: thb_data.mvp,
          th_agentblazer: `${thb_data.learnerStatusLevels?.statusName}-${thb_data.learnerStatusLevels?.title}`,
        },
      ]);

      if (error) {
        throw new Error('Failed to add banner: ' + error.message);
      }

      return data;
    } catch (error) {
      console.error('Error adding banner:', error.message);
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
      learnerStatusLevels: {
        statusName: data.rankData.learnerStatusLevels[0]?.statusName,
        title: data.rankData.learnerStatusLevels[0]?.title,
        level: data.rankData.learnerStatusLevels[0]?.level,
      },
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
      stampsData: {
        totalCount: data.stampsData.totalCount,
        edges: data.stampsData.edges.map((edge) => ({
          node: {
            kind: edge.node.kind,
            apiName: edge.node.apiName,
            name: edge.node.name,
            eventDate: edge.node.eventDate,
            eventLocation: edge.node.eventLocation,
            iconUrl: edge.node.iconUrl,
            linkUrl: edge.node.linkUrl,
          },
        })),
      },
    };
    return cleanedData;
  }

  static async updateRewindCounter(rewind_data) {
    try {
      const { data, error } = await supabase.from('rewinds').insert([
        {
          th_username: rewind_data.th_username,
          rewind_processing_time: rewind_data.rewind_processing_time,
          source_env: process.env.VERCEL_ENV ? process.env.VERCEL_ENV : 'development',
          year: rewind_data.year,
          thb_version: packageJson.version,
          th_current_rank: rewind_data.rankData.rank?.title,
          th_current_points: rewind_data.rankData.earnedPointsSum,
          th_current_badges: rewind_data.rankData.earnedBadgesCount,
          th_current_trails: rewind_data.rankData.completedTrailCount,
          yearly_stamps_count: rewind_data.yearlyData.stamps.length,
          yearly_certifications_count: rewind_data.yearlyData.certifications.length,
          yearly_stamps: rewind_data.yearlyData.stamps,
          yearly_certifications: rewind_data.yearlyData.certifications,
          yearly_achievements: rewind_data.rewindSummary.yearlyAchievements,
          most_active_month: rewind_data.rewindSummary.mostActiveMonth,
          monthly_breakdown_certifications: rewind_data.rewindSummary.monthlyCertifications || [],
          monthly_breakdown_stamps: rewind_data.rewindSummary.monthlyStamps || [],
          certification_products: rewind_data.rewindSummary.certificationProducts,
          agentblazer_progress: rewind_data.rewindSummary.agentblazerRank,
          timeline_data: rewind_data.rewindSummary.timelineData,
          rewind_summary: rewind_data.rewindSummary,
          total_stamps_all_time: rewind_data.rewindSummary.totalStamps,
          total_certifications_all_time: rewind_data.rewindSummary.totalCertifications,
        },
      ]);

      if (error) {
        throw new Error('Failed to add rewind: ' + error.message);
      }

      return data;
    } catch (error) {
      console.error('Error adding rewind:', error.message);
      throw error;
    }
  }

  static async updateErrors(errors_data) {
    try {
      const { data, error } = await supabase.from('errors').insert([
        {
          source_env: process.env.VERCEL_ENV ? process.env.VERCEL_ENV : 'development',
          type: errors_data.type,
          error: errors_data.error,
          error_data: errors_data.error_data,
          thb_version: packageJson.version,
        },
      ]);

      if (error) {
        throw new Error('Failed to add error: ' + error.message);
      }

      return data;
    } catch (error) {
      console.error('Error adding error:', error.message);
    }
  }
}

export default SupabaseUtils;
