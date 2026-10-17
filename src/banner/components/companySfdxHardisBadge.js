import { loadImage } from '@napi-rs/canvas';
import { getImage } from '../../utils/cacheUtils.js';
import { buildSfdxHardisBannerImageUrl } from '../../utils/sfdxHardisBadgeUtils.js';
import { Timer } from '../../utils/timerUtils.js';
import { generateCountBadgeSvg } from '../../utils/drawUtils.js';

/**
 * Company sfdx-hardis Training Badge Component
 * Renders up to 3 sfdx-hardis training badge icons (level 3 → 2 → 1), one per
 * level held as highest by a team member, with a ×N circle badge overlay when N > 1.
 * Mirrors the companyAgentblazer component.
 *
 * Layout: dynamic width based on how many levels are present.
 */

// Display order: highest level first (left to right)
const LEVEL_ORDER = [3, 2, 1];

const DEFAULT_LOGO_HEIGHT = 100;
const ICON_SPACING = 8;
const BADGE_RADIUS_RATIO = 0.18; // Badge circle size relative to icon height
const BADGE_BG_COLOR = '#032D60';

/**
 * Prepare company sfdx-hardis badge icons for rendering.
 * @param {Object} sfdxHardisCounts - { 3: N, 2: N, 1: N }
 * @param {Object} options
 * @param {boolean} options.displaySfdxHardisBadges - Whether to display sfdx-hardis badge icons
 * @param {number} logoHeight - Icon height
 * @returns {Promise<Object>}
 */
async function prepareCompanySfdxHardisBadge(sfdxHardisCounts, options = {}, logoHeight = DEFAULT_LOGO_HEIGHT) {
  const timer = new Timer();
  const warnings = [];

  if (options.displaySfdxHardisBadges === false) {
    return { shouldRender: false, icons: [], totalWidth: 0, height: 0, warnings, timings: timer.get() };
  }

  timer.start('load');

  const levels = LEVEL_ORDER.filter((level) => (sfdxHardisCounts?.[level] ?? 0) > 0);

  // Icons load in parallel; a failed level is skipped with a warning
  const icons = (
    await Promise.all(
      levels.map(async (level) => {
        const count = sfdxHardisCounts[level];
        try {
          const imageResult = await getImage(buildSfdxHardisBannerImageUrl(level), 'sfdx_hardis_badges');
          const image = await loadImage(Buffer.from(imageResult.buffer || imageResult));
          const logoWidth = (image.width / image.height) * logoHeight;

          let badgeImage = null;
          if (count > 1) {
            const svg = generateCountBadgeSvg(count, BADGE_BG_COLOR);
            badgeImage = await loadImage(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
          }

          return {
            level,
            count,
            image,
            badgeImage,
            width: logoWidth,
            height: logoHeight,
            showBadge: count > 1,
          };
        } catch (error) {
          console.error(`Error loading sfdx-hardis badge icon for level ${level}:`, error);
          warnings.push(`Error loading sfdx-hardis badge icon for level ${level}: ${error.message}`);
          return null;
        }
      })
    )
  ).filter(Boolean);

  if (icons.length === 0) {
    return {
      shouldRender: false,
      icons: [],
      totalWidth: 0,
      height: logoHeight,
      warnings,
      timings: timer.end('load').get(),
    };
  }

  const totalWidth = icons.reduce((sum, icon) => sum + icon.width, 0) + Math.max(0, icons.length - 1) * ICON_SPACING;

  return {
    shouldRender: true,
    icons,
    totalWidth,
    height: logoHeight,
    warnings,
    timings: timer.end('load').get(),
  };
}

/**
 * Render company sfdx-hardis badge icons to canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} prepared - From prepareCompanySfdxHardisBadge()
 * @param {number} x - Start X position
 * @param {number} y - Start Y position
 */
async function renderCompanySfdxHardisBadge(ctx, prepared, x, y) {
  if (!prepared.shouldRender || prepared.icons.length === 0) {
    console.debug('Skipping company sfdx-hardis badge render');
    return;
  }

  let currentX = x;

  for (const icon of prepared.icons) {
    ctx.drawImage(icon.image, currentX, y, icon.width, icon.height);

    if (icon.showBadge && icon.badgeImage) {
      const badgeRadius = icon.height * BADGE_RADIUS_RATIO;
      const badgeCX = currentX + icon.width - badgeRadius * 0.5;
      const badgeCY = y + icon.height - badgeRadius * 1.0;
      ctx.globalAlpha = 1.0;
      ctx.drawImage(icon.badgeImage, badgeCX - badgeRadius, badgeCY - badgeRadius, badgeRadius * 2, badgeRadius * 2);
    }

    currentX += icon.width + ICON_SPACING;
  }
}

/**
 * Get warnings from preparation.
 * @param {Object} prepared
 * @returns {Array<string>}
 */
function getCompanySfdxHardisBadgeWarnings(prepared) {
  return prepared?.warnings || [];
}

/**
 * Get total rendered width of the sfdx-hardis badge zone.
 * @param {Object} prepared
 * @returns {number}
 */
function getCompanySfdxHardisBadgeWidth(prepared) {
  return prepared?.shouldRender ? (prepared.totalWidth ?? 0) : 0;
}

export {
  prepareCompanySfdxHardisBadge,
  renderCompanySfdxHardisBadge,
  getCompanySfdxHardisBadgeWarnings,
  getCompanySfdxHardisBadgeWidth,
};
