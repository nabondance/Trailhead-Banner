import axios from 'axios';
import { getImage } from './cacheUtils.js';
import RedisCacheUtils from './redisCacheUtils.js';

const SFDX_HARDIS_TRAINING_ORIGIN = 'https://hardisgroupcom.github.io';
const SFDX_HARDIS_TRAINING_PATH = '/sfdx-hardis-training';
const SFDX_HARDIS_BADGES_URL = `${SFDX_HARDIS_TRAINING_ORIGIN}${SFDX_HARDIS_TRAINING_PATH}/badges`;
const USERNAME_PATTERN = /^[a-z0-9._-]{1,60}$/i;
const POSITIVE_CACHE_TTL_SECONDS = 600;
const NEGATIVE_CACHE_TTL_SECONDS = 300;
const SFDX_HARDIS_TIME_BUDGET_MS = 2500;

function normalizeBannerImageUrl(value, level) {
  if (typeof value !== 'string') return null;

  try {
    const url = new URL(value);
    const expectedPath = `${SFDX_HARDIS_TRAINING_PATH}/badges/img/banner-level-${level}.svg`;
    if (
      url.origin !== SFDX_HARDIS_TRAINING_ORIGIN ||
      url.pathname !== expectedPath ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

/**
 * Build the public badge-record URL for a Trailblazer username.
 *
 * @param {string} username
 * @returns {string|null}
 */
function buildSfdxHardisBadgeUrl(username) {
  const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
  if (!USERNAME_PATTERN.test(normalizedUsername)) return null;

  return `${SFDX_HARDIS_BADGES_URL}/${encodeURIComponent(normalizedUsername)}.json`;
}

/**
 * Accept only the small, public contract THB needs and derive image URLs from
 * the trusted origin instead of following a URL supplied by the JSON document.
 *
 * @param {unknown} record
 * @param {string} username
 * @returns {Object|null}
 */
function normalizeSfdxHardisBadgeRecord(record, username) {
  const requestedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
  if (!record || typeof record !== 'object' || !USERNAME_PATTERN.test(requestedUsername)) return null;

  const trailblazer = typeof record.trailblazer === 'string' ? record.trailblazer.trim() : '';
  if (!USERNAME_PATTERN.test(trailblazer) || trailblazer.toLowerCase() !== requestedUsername) return null;

  const badges = Array.isArray(record.badges)
    ? record.badges
        .filter((badge) => {
          const level = Number(badge?.level);
          const checksPassed = Number(badge?.checksPassed);
          const checksTotal = Number(badge?.checksTotal);
          const bannerImage = normalizeBannerImageUrl(badge?.bannerImage, level);

          return (
            badge?.type === 'Achievement' &&
            Number.isInteger(level) &&
            level >= 1 &&
            level <= 3 &&
            typeof badge?.name === 'string' &&
            badge.name.trim().length > 0 &&
            typeof badge?.issuedOn === 'string' &&
            badge.issuedOn.trim().length > 0 &&
            Number.isInteger(checksPassed) &&
            Number.isInteger(checksTotal) &&
            checksTotal > 0 &&
            checksPassed === checksTotal &&
            badge?.issuer?.name === 'Cloudity' &&
            badge?.issuer?.course === `${SFDX_HARDIS_TRAINING_ORIGIN}${SFDX_HARDIS_TRAINING_PATH}` &&
            bannerImage !== null
          );
        })
        .map((badge) => ({
          type: 'Achievement',
          level: Number(badge.level),
          name: badge.name.trim(),
          description: typeof badge.description === 'string' ? badge.description.trim() : '',
          issuedOn: badge.issuedOn.trim(),
          checksPassed: Number(badge.checksPassed),
          checksTotal: Number(badge.checksTotal),
          bannerImage: normalizeBannerImageUrl(badge.bannerImage, Number(badge.level)),
        }))
        .sort((a, b) => a.level - b.level)
    : [];

  if (badges.length === 0) return null;

  return {
    recipient: typeof record.recipient === 'string' ? record.recipient.trim() : '',
    trailblazer,
    name: typeof record.name === 'string' ? record.name.trim() : '',
    badges,
  };
}

/**
 * Return the highest verified training badge in a normalized record.
 *
 * @param {Object|null} record
 * @returns {Object|null}
 */
function getHighestSfdxHardisBadge(record) {
  if (!record?.badges?.length) return null;
  return record.badges.reduce((highest, badge) => (!highest || badge.level > highest.level ? badge : highest), null);
}

/**
 * Fetch a learner's public sfdx-hardis training badges. The integration is
 * deliberately fail-open: missing badges and upstream failures both result in
 * no badge, never a failed Trailhead Banner generation.
 *
 * @param {string} username
 * @param {Object} dependencies test seams for the HTTP client and cache
 * @returns {Promise<Object|null>}
 */
async function fetchSfdxHardisBadges(username, dependencies = {}) {
  const httpClient = dependencies.httpClient || axios;
  const cache = dependencies.cache || RedisCacheUtils;
  const url = buildSfdxHardisBadgeUrl(username);
  if (!url) return null;

  const normalizedUsername = username.trim().toLowerCase();
  const cacheKey = `sfdx-hardis-badges:v2:${normalizedUsername}`;

  try {
    const cached = await cache.getCachedQuery(cacheKey);
    if (cached?.status === 'found') return cached.data;
    if (cached?.status === 'missing') return null;
  } catch (error) {
    console.warn(`[sfdx-hardis badges] Cache read failed for ${normalizedUsername}:`, error.message);
  }

  try {
    const response = await httpClient.get(url, {
      timeout: 4000,
      signal: dependencies.signal,
      headers: { Accept: 'application/json' },
      validateStatus: (status) => status === 200 || status === 404,
    });

    if (response.status === 404) {
      cache
        .setCachedQuery(cacheKey, { status: 'missing' }, NEGATIVE_CACHE_TTL_SECONDS)
        .catch((error) => console.warn('[sfdx-hardis badges] Negative cache write failed:', error.message));
      return null;
    }

    const data = normalizeSfdxHardisBadgeRecord(response.data, normalizedUsername);
    if (!data) {
      console.warn(`[sfdx-hardis badges] Ignoring an invalid badge record for ${normalizedUsername}`);
      return null;
    }

    cache
      .setCachedQuery(cacheKey, { status: 'found', data }, POSITIVE_CACHE_TTL_SECONDS)
      .catch((error) => console.warn('[sfdx-hardis badges] Cache write failed:', error.message));
    return data;
  } catch (error) {
    console.warn(`[sfdx-hardis badges] Unable to read badges for ${normalizedUsername}:`, error.message);
    return null;
  }
}

/**
 * Resolve the badge metadata and its banner-specific image within one optional
 * time budget. A timeout aborts in-flight HTTP reads and returns enough state
 * for the main banner request to continue without waiting on this integration.
 *
 * @param {string} username
 * @param {Object} dependencies test seams and optional timeBudgetMs override
 * @returns {Promise<Object|null>}
 */
async function fetchSfdxHardisBadgeBundle(username, dependencies = {}) {
  const timeBudgetMs = dependencies.timeBudgetMs ?? SFDX_HARDIS_TIME_BUDGET_MS;
  const imageLoader = dependencies.imageLoader || getImage;
  const controller = new AbortController();
  const startedAt = Date.now();
  let badgesData = null;
  let timeoutId;

  const work = (async () => {
    badgesData = await fetchSfdxHardisBadges(username, { ...dependencies, signal: controller.signal });
    if (controller.signal.aborted) {
      return { badgesData, bannerImageBuffer: null, timedOut: true, elapsedMs: Date.now() - startedAt };
    }
    const badge = getHighestSfdxHardisBadge(badgesData);
    if (!badge?.bannerImage) {
      return { badgesData, bannerImageBuffer: null, timedOut: false, elapsedMs: Date.now() - startedAt };
    }

    try {
      const imageResult = await imageLoader(badge.bannerImage, 'sfdx_hardis_badges', {
        signal: controller.signal,
        timeoutMs: timeBudgetMs,
        awaitCacheWrite: false,
      });
      const imageBytes = Buffer.isBuffer(imageResult) ? imageResult : imageResult.buffer || imageResult;
      return {
        badgesData,
        bannerImageBuffer: Buffer.from(imageBytes),
        timedOut: false,
        elapsedMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (!controller.signal.aborted) {
        console.warn(`[sfdx-hardis badges] Unable to load banner image for ${username}:`, error.message);
      }
      return {
        badgesData,
        bannerImageBuffer: null,
        timedOut: controller.signal.aborted,
        elapsedMs: Date.now() - startedAt,
      };
    }
  })();

  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      console.warn(`[sfdx-hardis badges] Skipped ${username} after exceeding the ${timeBudgetMs}ms time budget`);
      resolve({ badgesData, bannerImageBuffer: null, timedOut: true, elapsedMs: Date.now() - startedAt });
    }, timeBudgetMs);
  });

  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export {
  SFDX_HARDIS_BADGES_URL,
  SFDX_HARDIS_TIME_BUDGET_MS,
  buildSfdxHardisBadgeUrl,
  normalizeSfdxHardisBadgeRecord,
  getHighestSfdxHardisBadge,
  fetchSfdxHardisBadges,
  fetchSfdxHardisBadgeBundle,
};
