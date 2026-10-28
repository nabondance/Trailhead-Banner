import packageJson from '../../package.json';
import { createClient } from '@supabase/supabase-js';
import { getHighestAgentblazerRankPerYear } from './dataUtils';
import { SERVER_ENV } from './envUtils';

// Server-only client: the service role key bypasses RLS, so the analytics tables can stay closed to the public anon key.
// Never prefix this key with NEXT_PUBLIC_ or import this module from client components.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

if (!supabase && process.env.VERCEL_ENV) {
  console.error(
    '[Supabase] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing: analytics will not be saved.'
  );
}

/**
 * Detects whether a value is a Data URL (e.g. "data:image/png;base64,...").
 * @param {unknown} value - Value to test.
 * @returns {boolean} True when the value is a Data URL string.
 */
function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:');
}

class SupabaseUtils {
  /**
   * Retry an async operation with exponential backoff
   * @param {Function} operation - The async operation to retry
   * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
   * @param {number} initialDelay - Initial delay in ms before first retry (default: 1000)
   * @returns {Promise} Result of the operation
   */
  static async retryWithBackoff(operation, maxRetries = 3, initialDelay = 1000) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const isNetworkError =
          error.message?.includes('fetch failed') ||
          error.message?.includes('network') ||
          error.message?.includes('timeout') ||
          error.code === 'ECONNREFUSED' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ENOTFOUND';

        // Only retry on network-related errors
        if (!isNetworkError || attempt === maxRetries) {
          throw error;
        }

        // Calculate exponential backoff delay: 1s, 2s, 4s
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms due to: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }

  static async updateBannerCounter(thb_data) {
    if (!supabase) {
      console.log('[Supabase] Credentials not configured, skipping banner counter update.');
      return;
    }
    const originalTimings = thb_data.timings; // Save timings before cleaning
    thb_data = SupabaseUtils.cleanData(thb_data);
    try {
      const result = await SupabaseUtils.retryWithBackoff(async () => {
        const { data, error } = await supabase.from('banners').insert([
          {
            th_username: thb_data.th_username,
            thb_processing_time: thb_data.thb_processing_time,
            source_env: SERVER_ENV,
            thb_options: thb_data.thb_options,
            thb_version: thb_data.thb_version,
            thb_banner_hash: thb_data.bannerHash,
            th_nb_points: thb_data.rankData?.points,
            th_nb_certif: thb_data.certificationsData?.certifications?.length || 0,
            th_nb_sb: thb_data.superbadgesData?.earnedAwards?.edges?.length || 0,
            th_nb_badge: thb_data.rankData?.badges,
            th_nb_stamps: thb_data.stampsData?.totalCount,
            th_certif: thb_data.certificationsData?.certifications || [],
            th_sb: thb_data.superbadgesData?.earnedAwards?.edges || [],
            th_stamps: thb_data.stampsData,
            th_mvp: thb_data.mvp,
            th_agentblazer: thb_data.learnerStatusLevels
              ? `${thb_data.learnerStatusLevels.statusName}-${thb_data.learnerStatusLevels.title}-${thb_data.learnerStatusLevels.edition}`
              : null,
            th_community: thb_data.communityData,
            th_name: thb_data.profileData?.name,
            th_country: thb_data.profileData?.country,
            th_company_name: thb_data.profileData?.companyName,
            th_is_public_profile: thb_data.profileData?.isPublicProfile,
            th_has_avatar: thb_data.profileData?.hasAvatar,
            th_has_custom_background: thb_data.profileData?.hasCustomBackground,
            timings: originalTimings,
          },
        ]);

        if (error) {
          throw new Error('Failed to add banner: ' + error.message);
        }

        return data;
      });

      return result;
    } catch (error) {
      console.error('Error adding banner (after retries):', error.message);
    }
  }

  /**
   * Returns a sanitized shallow copy of banner `thb_options` that is safe to
   * persist in the analytics database.
   *
   * Uploaded custom backgrounds arrive as base64 Data URLs on
   * `backgroundImageUrl` (and, defensively, `customBackgroundImageUrl`). Each
   * one can be hundreds of KB; storing them previously bloated the
   * `banners.thb_options` column to hundreds of MB. This strips any such Data
   * URL and replaces it with a lightweight `hasCustomBackgroundImage: true`
   * flag. Normal HTTP(S) URLs are left untouched.
   *
   * The original object is never mutated — only the analytics record is
   * sanitized, so banner rendering keeps using the in-memory options as-is.
   *
   * @param {Record<string, any> | null | undefined} options - Raw banner options.
   * @returns {Record<string, any> | null | undefined} A sanitized shallow copy,
   *   or the input unchanged when it is not an object.
   */
  static sanitizeThbOptions(options) {
    if (!options || typeof options !== 'object') {
      return options;
    }

    const sanitized = { ...options };
    let hasCustomBackgroundImage = false;

    for (const key of ['backgroundImageUrl', 'customBackgroundImageUrl']) {
      if (isDataUrl(sanitized[key])) {
        delete sanitized[key];
        hasCustomBackgroundImage = true;
      }
    }

    if (hasCustomBackgroundImage) {
      sanitized.hasCustomBackgroundImage = true;
    }

    return sanitized;
  }

  static cleanData(data) {
    // Clean the data as needed
    const cleanedData = {
      th_username: data.th_username,
      thb_processing_time: data.thb_processing_time,
      thb_options: SupabaseUtils.sanitizeThbOptions(data.options),
      thb_version: packageJson.version,
      bannerHash: data.bannerHash,
      // null = MVP status unknown (community API failed), not "not an MVP"
      mvp: data.mvpUnavailable ? null : data.mvpData?.isMvp || false,
      learnerStatusLevels: (() => {
        // Find the active status level from agentblazerData
        const activeStatus = data.agentblazerData?.learnerStatusLevels?.find((level) => level.active === true);
        if (activeStatus) {
          return {
            statusName: activeStatus.statusName,
            title: activeStatus.title,
            level: activeStatus.level,
            edition: activeStatus.edition,
            active: activeStatus.active,
          };
        }
        return null;
      })(),
      rankData: {
        rank: data.rankData?.rank?.title,
        points: data.rankData?.earnedPointsSum,
        badges: data.rankData?.earnedBadgesCount,
        trails: data.rankData?.completedTrailCount,
      },
      agentblazerData: getHighestAgentblazerRankPerYear(data.agentblazerData?.learnerStatusLevels),
      certificationsData: {
        certifications:
          data.certificationsData?.certifications?.map((cert) => ({
            title: cert.title,
            dateCompleted: cert.dateCompleted,
            dateExpired: cert.dateExpired,
            status: cert.status.title,
            logoUrl: cert.logoUrl,
            product: cert.product,
          })) || [],
      },
      superbadgesData: {
        earnedAwards: {
          edges:
            data.superbadgesData?.earnedAwards?.edges
              ?.map((edge) => {
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
              .filter((edge) => edge !== null) || [],
        },
      },
      stampsData: {
        totalCount: data.stampsData?.totalCount,
        edges:
          data.stampsData?.edges?.map((edge) => ({
            node: {
              kind: edge.node.kind,
              apiName: edge.node.apiName,
              name: edge.node.name,
              eventDate: edge.node.eventDate,
              eventLocation: edge.node.eventLocation,
              iconUrl: edge.node.iconUrl,
              linkUrl: edge.node.linkUrl,
            },
          })) || [],
      },
      communityData: {
        answers: data.communityData?.questionAndAnswersStats?.answersCount ?? null,
        bestAnswers: data.communityData?.questionAndAnswersStats?.bestAnswersCount ?? null,
        questions: data.communityData?.questionAndAnswersStats?.questionsCount ?? null,
        followers: data.communityData?.communityConnections?.followers?.totalCount ?? null,
        following: data.communityData?.communityConnections?.following?.totalCount ?? null,
        groups: data.communityData?.communityConnections?.groups?.totalCount ?? null,
      },
      profileData: {
        name: data.profileData?.name ?? null,
        country: data.profileData?.country ?? null,
        companyName: data.profileData?.companyName ?? null,
        isPublicProfile: data.profileData?.isPublicProfile ?? null,
        hasAvatar: !!data.profileData?.avatarUrl,
        hasCustomBackground:
          !!data.profileData?.backgroundImageUrl && !data.profileData.backgroundImageUrl.includes('/default/'),
      },
    };
    return cleanedData;
  }

  static async updateRewindCounter(rewind_data) {
    if (!supabase) {
      console.log('[Supabase] Credentials not configured, skipping rewind counter update.');
      return;
    }
    try {
      const result = await SupabaseUtils.retryWithBackoff(async () => {
        const { data, error } = await supabase.from('rewinds').insert([
          {
            th_username: rewind_data.th_username,
            rewind_processing_time: rewind_data.rewind_processing_time,
            source_env: SERVER_ENV,
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
            timings: rewind_data.timings,
          },
        ]);

        if (error) {
          throw new Error('Failed to add rewind: ' + error.message);
        }

        return data;
      });

      return result;
    } catch (error) {
      console.error('Error adding rewind (after retries):', error.message);
      throw error;
    }
  }

  static async updateCompanyBannerCounter(company_data) {
    if (!supabase) {
      console.log('[Supabase] Credentials not configured, skipping company banner counter update.');
      return;
    }
    try {
      const result = await SupabaseUtils.retryWithBackoff(async () => {
        const { error } = await supabase.from('company_banners').insert([
          {
            thb_source_env: SERVER_ENV,
            thb_version: packageJson.version,
            thb_processing_time: company_data.processing_time,
            thb_banner_hash: company_data.team_hash,
            thb_team_size: company_data.team_size,
            thb_count_resolved: company_data.resolved_count,
            thb_count_failed: company_data.failed_count,
            thb_failed_users: company_data.failed_users,
            th_count_cert: company_data.cert_count,
            th_count_active_cert: company_data.active_cert_count,
            th_count_badge: company_data.badge_count,
            th_count_sb: company_data.sb_count,
            th_count_mvp: company_data.mvp_count,
            th_count_ranger: company_data.ranger_count,
            th_count_cta: company_data.cta_count,
            thb_agentblazer: company_data.agentblazer,
            thb_sfdx_hardis: company_data.sfdx_hardis,
            thb_options: company_data.options,
            thb_csv_requested: company_data.csv_requested,
            thb_timings: company_data.timings,
          },
        ]);

        if (error) {
          throw new Error('Failed to add company banner: ' + error.message);
        }
      });
      return result;
    } catch (error) {
      console.error('Error adding company banner (after retries):', error.message);
    }
  }

  static async updateErrors(errors_data) {
    if (!supabase) {
      console.log('[Supabase] Credentials not configured, skipping error update.');
      return;
    }
    try {
      const result = await SupabaseUtils.retryWithBackoff(async () => {
        const { data, error } = await supabase.from('errors').insert([
          {
            source_env: SERVER_ENV,
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
      });

      return result;
    } catch (error) {
      console.error('Error adding error (after retries):', error.message);
    }
  }
}

export { supabase };
export default SupabaseUtils;
