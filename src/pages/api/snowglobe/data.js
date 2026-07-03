import { buildRewindQueries } from '../../../banner/api/queryBuilder';
import { fetchUserData, handleBannerError } from '../../../banner/api/shared';
import { validateUsername } from '../../../banner/api/validators';
import { filterDataByYear, getCombinedAchievements, getAgentblazerRankForYear } from '../../../utils/rewindUtils';

const MAX_ITEMS = 24;
const RANK_NAME_PATTERN = /^[a-z0-9-]+\.png$/;

/**
 * Lightweight data endpoint for the snow globe: returns the year's
 * certifications + stamps and the current rank, without any image generation.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', message: 'Only POST requests are supported' });
  }

  const { username, year = 2026 } = req.body || {};

  if (!username || typeof username !== 'string' || username.length > 100) {
    return res.status(400).json({ error: 'Username is required', validationError: true });
  }

  const usernameValidation = await validateUsername(username);
  if (!usernameValidation.valid) {
    return res.status(400).json({ error: usernameValidation.message, validationError: true });
  }

  if (typeof year !== 'number' || year < 2020 || year > new Date().getFullYear() + 1) {
    return res.status(400).json({ error: 'Invalid year provided', validationError: true });
  }

  try {
    const queries = buildRewindQueries(username);
    const { responseMap } = await fetchUserData(queries, username);

    const rankResponse = responseMap.GET_TRAILBLAZER_RANK;
    if (!rankResponse?.data?.data?.profile) {
      return res.status(404).json({
        error: 'User not found',
        message: `No Trailhead profile found for username: ${username}`,
      });
    }

    const rankData = rankResponse.data?.data?.profile?.trailheadStats || {};
    const certificationsData = responseMap.GET_USER_CERTIFICATIONS?.data?.data?.profile?.credential || {};
    const stampsData = responseMap.GET_STAMPS?.data?.data?.earnedStamps || {};

    const yearlyData = filterDataByYear({ certificationsData, stampsData }, year);
    const achievements = getCombinedAchievements(yearlyData)
      .slice(0, MAX_ITEMS)
      .map((a) => ({
        type: a.type,
        name: a.name,
        logoUrl: a.logoUrl,
        folder: a.folder,
      }));

    // Agentblazer rank earned that year tumbles with the rest — artwork comes
    // from the repo (the API's imageUrl is an HTML page, not an image)
    const agentblazerData = responseMap.GET_AGENTBLAZER_RANK?.data?.data?.profile?.trailheadStats || {};
    const agentblazer = getAgentblazerRankForYear(agentblazerData.learnerStatusLevels, year);
    if (agentblazer?.title) {
      achievements.unshift({
        type: 'agentblazer',
        name: `Agentblazer ${agentblazer.title}`,
        logoUrl: `/api/snowglobe/local-image?type=Agentblazer&name=${encodeURIComponent(agentblazer.title)}.png&year=${year}`,
        folder: 'images',
      });
    }

    // Rank artwork: repo-stored high-res PNG, filename derived from the API
    // imageUrl the same way rankLogo.js does; remote URL as fallback
    const rankFileName = rankData.rank?.imageUrl?.split('/').pop();
    const rankLogoUrl =
      rankFileName && RANK_NAME_PATTERN.test(rankFileName)
        ? `/api/snowglobe/local-image?type=Rank&name=${encodeURIComponent(rankFileName)}`
        : rankData.rank?.imageUrl || null;

    return res.status(200).json({
      username,
      year,
      rank: {
        title: rankData.rank?.title || null,
        logoUrl: rankLogoUrl,
      },
      achievements,
      totals: {
        certifications: yearlyData.certifications.length,
        stamps: yearlyData.stamps.length,
      },
    });
  } catch (error) {
    return handleBannerError(error, res, 'snowglobe-data', {
      username: username ?? 'unknown',
      year: year ?? 'unknown',
    });
  }
}
