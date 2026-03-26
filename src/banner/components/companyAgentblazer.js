import { loadImage } from '@napi-rs/canvas';
import { getLocal } from '../../utils/cacheUtils.js';
import { Timer } from '../../utils/timerUtils.js';
import { generateCountBadgeSvg } from '../../utils/drawUtils.js';

/**
 * Company Agentblazer Component
 * Renders up to 3 agentblazer level icons (Legend → Champion → Innovator)
 * with a ×N circle badge overlay when N > 1.
 *
 * Layout: dynamic width based on how many levels are present.
 */

// Display order: highest prestige first (left to right)
const LEVEL_ORDER = ['Legend', 'Innovator', 'Champion'];

const LOGO_HEIGHT = 100;
const ICON_SPACING = 8;
const BADGE_RADIUS_RATIO = 0.18; // Badge circle size relative to icon height
const BADGE_BG_COLOR = '#8a00c4';

/**
 * Prepare company agentblazer icons for rendering.
 * @param {Object} agentblazerCounts - { Innovator: N, Champion: N, Legend: N }
 * @param {Object} options
 * @param {boolean} options.displayAgentblazerIcons - Whether to display agentblazer icons
 * @param {number} options.agentblazerRankDisplay - Already factored into counts by companyDataUtils
 * @returns {Promise<Object>}
 */
async function prepareCompanyAgentblazer(agentblazerCounts, options = {}) {
  const timer = new Timer();
  const warnings = [];

  if (!options.displayAgentblazerIcons) {
    return { shouldRender: false, icons: [], totalWidth: 0, height: 0, warnings, timings: timer.get() };
  }

  timer.start('load');

  const icons = [];

  for (const levelTitle of LEVEL_ORDER) {
    const count = agentblazerCounts?.[levelTitle] ?? 0;
    if (count === 0) continue;

    try {
      const buffer = await getLocal(`${levelTitle}.png`, 'Agentblazer');
      const image = await loadImage(buffer);

      const logoWidth = (image.width / image.height) * LOGO_HEIGHT;

      let badgeImage = null;
      if (count > 1) {
        const svg = generateCountBadgeSvg(count, BADGE_BG_COLOR);
        badgeImage = await loadImage(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
      }

      icons.push({
        title: levelTitle,
        count,
        image,
        badgeImage,
        width: logoWidth,
        height: LOGO_HEIGHT,
        showBadge: count > 1,
      });
    } catch (error) {
      console.error(`Error loading Agentblazer icon for ${levelTitle}:`, error);
      warnings.push(`Error loading Agentblazer icon for ${levelTitle}: ${error.message}`);
    }
  }

  if (icons.length === 0) {
    return {
      shouldRender: false,
      icons: [],
      totalWidth: 0,
      height: LOGO_HEIGHT,
      warnings,
      timings: timer.end('load').get(),
    };
  }

  const totalWidth = icons.reduce((sum, icon) => sum + icon.width, 0) + Math.max(0, icons.length - 1) * ICON_SPACING;

  return {
    shouldRender: true,
    icons,
    totalWidth,
    height: LOGO_HEIGHT,
    warnings,
    timings: timer.end('load').get(),
  };
}

/**
 * Render company agentblazer icons to canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} prepared - From prepareCompanyAgentblazer()
 * @param {number} x - Start X position
 * @param {number} y - Start Y position
 */
async function renderCompanyAgentblazer(ctx, prepared, x, y) {
  if (!prepared.shouldRender || prepared.icons.length === 0) {
    console.debug('Skipping company agentblazer render');
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
function getCompanyAgentblazerWarnings(prepared) {
  return prepared?.warnings || [];
}

/**
 * Get total rendered width of the agentblazer zone.
 * @param {Object} prepared
 * @returns {number}
 */
function getCompanyAgentblazerWidth(prepared) {
  return prepared?.shouldRender ? (prepared.totalWidth ?? 0) : 0;
}

export {
  prepareCompanyAgentblazer,
  renderCompanyAgentblazer,
  getCompanyAgentblazerWarnings,
  getCompanyAgentblazerWidth,
};
