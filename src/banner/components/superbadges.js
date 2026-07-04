import { loadImage } from '@napi-rs/canvas';
import { generatePlusXSuperbadgesSvg, generateCountBadgeSvg } from '../../utils/drawUtils.js';
import { getImage } from '../../utils/cacheUtils.js';
import { Timer } from '../../utils/timerUtils.js';

/**
 * Superbadges Component
 * Renders superbadge icons in a horizontal row with alignment
 */

/**
 * Prepare superbadges for rendering
 * @param {Object} superbadgesData - Superbadges data from API
 * @param {Object} options - Component options
 * @param {boolean} options.displaySuperbadges - Whether to display superbadges
 * @param {boolean} options.displayLastXSuperbadges - Limit to last X superbadges
 * @param {number} options.lastXSuperbadges - Number of last superbadges to display
 * @param {string} options.superbadgeAlignment - Alignment: left|center|right
 * @param {Object} layout - Layout constraints { availableWidth, logoHeight }
 * @returns {Promise<Object>} Prepared superbadge data
 */
async function prepareSuperbadges(superbadgesData, options, layout) {
  const timer = new Timer();
  const warnings = [];

  if (!options.displaySuperbadges) {
    return {
      shouldRender: false,
      images: [],
      layout: null,
      warnings,
      timings: timer.get(),
    };
  }

  const totalSuperbadges =
    superbadgesData?.earnedAwards?.edges?.filter((edge) => edge.node.award && edge.node.award.icon).length || 0;

  // Keep each superbadge's icon URL together with its `count` (how many team members
  // earned it — only present on deduplicated company data; defaults to 1 otherwise).
  let superbadgeEntries =
    superbadgesData?.earnedAwards?.edges
      ?.filter((edge) => edge.node.award && edge.node.award.icon)
      .map((edge) => ({ icon: edge.node.award.icon, count: edge.node.award.count ?? 1 })) || [];

  if (options.displayLastXSuperbadges && options.lastXSuperbadges) {
    superbadgeEntries = superbadgeEntries.slice(-options.lastXSuperbadges);
  }

  const displayedSuperbadges = superbadgeEntries.length;
  const hiddenSuperbadges = totalSuperbadges - displayedSuperbadges;

  // Download all superbadge logos in parallel
  timer.start('total');
  timer.start('download');
  const superbadgeLogoPromises = superbadgeEntries.map(async (entry) => {
    try {
      const logoResult = await getImage(entry.icon, 'superbadges');
      const logoBuffer = logoResult.buffer || logoResult;
      const logo = await loadImage(logoBuffer);
      return { logo, count: entry.count };
    } catch (error) {
      console.error(`Error loading superbadge logo from URL: ${entry.icon}`, error);
      warnings.push(`Error loading superbadge logo from URL: ${entry.icon}: ${error.message}`);
      return null;
    }
  });

  // Wait for all superbadge logos to be downloaded
  const superbadgeLogosImages = await Promise.all(superbadgeLogoPromises);
  timer.end('download');

  // Pre-load ×N count badges for sharp rendering (company banner, when enabled)
  if (options.superbadgeShowCount) {
    await Promise.all(
      superbadgeLogosImages.map(async (entry) => {
        if (entry && entry.count > 1) {
          const svg = generateCountBadgeSvg(entry.count, '#8a00c4');
          entry.countBadgeImage = await loadImage(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
        }
      })
    );
  }

  // Add "+X" badge if superbadges are hidden
  if (hiddenSuperbadges > 0) {
    const plusXBadgeSvg = generatePlusXSuperbadgesSvg(hiddenSuperbadges);
    const plusXBadgeImage = await loadImage(
      `data:image/svg+xml;base64,${Buffer.from(plusXBadgeSvg).toString('base64')}`
    );
    superbadgeLogosImages.push({ logo: plusXBadgeImage, count: 1 });
  }

  // Filter out null images (failed loads)
  const validImages = superbadgeLogosImages.filter((entry) => entry !== null && entry.logo);

  if (validImages.length === 0) {
    timer.end('total');
    timer.set('prep_ms', timer.timings.total_ms - timer.timings.download_ms);
    return {
      shouldRender: false,
      images: [],
      layout: null,
      counts: {
        total: totalSuperbadges,
        displayed: displayedSuperbadges,
        hidden: hiddenSuperbadges,
      },
      warnings,
      timings: timer.get(),
    };
  }

  // Calculate superbadge layout with overlapping (matching old behavior)
  const superbadgeLogoHeight = layout.logoHeight;
  const superbadgeLogoWidth = superbadgeLogoHeight; // Assuming square logos
  let superbadgeSpacing = 10; // Default spacing
  const superbadgeAvailableWidth = layout.availableWidth;

  // Calculate total width required for superbadges
  const totalSuperbadgeWidth = validImages.length * superbadgeLogoWidth + (validImages.length - 1) * superbadgeSpacing;

  // Adjust spacing if total width exceeds available space (can go negative for overlap)
  if (totalSuperbadgeWidth > superbadgeAvailableWidth) {
    superbadgeSpacing =
      (superbadgeAvailableWidth - validImages.length * superbadgeLogoWidth) / (validImages.length - 1);
  }

  // Calculate starting X position based on alignment
  let superbadgeStartX;

  if (totalSuperbadgeWidth > superbadgeAvailableWidth) {
    // When compressed, always start from left edge of available area
    superbadgeStartX = 0;
  } else {
    // When there's enough space, apply alignment
    if (options.superbadgeAlignment === 'left') {
      superbadgeStartX = 0;
    } else if (options.superbadgeAlignment === 'right') {
      superbadgeStartX = superbadgeAvailableWidth - totalSuperbadgeWidth;
    } else {
      // center
      superbadgeStartX = (superbadgeAvailableWidth - totalSuperbadgeWidth) / 2;
    }
  }

  timer.end('total');
  timer.set('prep_ms', timer.timings.total_ms - timer.timings.download_ms);

  return {
    shouldRender: true,
    images: validImages,
    layout: {
      logoWidth: superbadgeLogoWidth,
      logoHeight: superbadgeLogoHeight,
      spacing: superbadgeSpacing,
      startX: superbadgeStartX,
      totalWidth: totalSuperbadgeWidth,
    },
    counts: {
      total: totalSuperbadges,
      displayed: displayedSuperbadges,
      hidden: hiddenSuperbadges,
    },
    warnings,
    timings: timer.get(),
  };
}

/**
 * Render superbadges to canvas (with overlapping if needed)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} prepared - Prepared superbadge data from prepareSuperbadges()
 * @param {number} absoluteX - Absolute X position for the available area
 * @param {number} y - Y position
 */
async function renderSuperbadges(ctx, prepared, absoluteX, y) {
  const timer = new Timer();
  timer.start('render');

  if (!prepared.shouldRender || !prepared.images || prepared.images.length === 0) {
    console.debug('No superbadges to render');
    return timer.end('render').get();
  }

  const { images, layout } = prepared;
  let currentX = absoluteX + layout.startX;

  // Render badges with spacing (can be negative for overlapping effect)
  for (const entry of images) {
    if (entry && entry.logo) {
      ctx.drawImage(entry.logo, currentX, y, layout.logoWidth, layout.logoHeight);

      // Draw ×N badge at bottom-right when a superbadge was earned by multiple members
      if (entry.count > 1 && entry.countBadgeImage) {
        const badgeRadius = layout.logoHeight * 0.18;
        const badgeCX = currentX + layout.logoWidth - badgeRadius * 1.4;
        const badgeCY = y + layout.logoHeight - badgeRadius * 1.0;
        ctx.globalAlpha = 1.0;
        ctx.drawImage(
          entry.countBadgeImage,
          badgeCX - badgeRadius,
          badgeCY - badgeRadius,
          badgeRadius * 2,
          badgeRadius * 2
        );
      }

      currentX += layout.logoWidth + layout.spacing;
    }
  }

  return timer.end('render').get();
}

/**
 * Get warnings from superbadge preparation
 * @param {Object} prepared - Prepared superbadge data
 * @returns {Array<string>} Warnings
 */
function getSuperbadgesWarnings(prepared) {
  return prepared?.warnings || [];
}

/**
 * Get superbadge counts
 * @param {Object} prepared - Prepared superbadge data
 * @returns {Object} Counts
 */
function getSuperbadgesCounts(prepared) {
  return prepared?.counts || { total: 0, displayed: 0, hidden: 0 };
}

export { prepareSuperbadges, renderSuperbadges, getSuperbadgesWarnings, getSuperbadgesCounts };
