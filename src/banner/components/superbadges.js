import { loadImage } from '@napi-rs/canvas';
import { generatePlusXSuperbadgesSvg } from '../../utils/drawUtils.js';
import { getImage } from '../../utils/cacheUtils.js';

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
  const startTime = Date.now();
  const warnings = [];

  if (!options.displaySuperbadges) {
    return {
      shouldRender: false,
      images: [],
      layout: null,
      warnings,
      timings: {
        download_ms: 0,
        prep_ms: 0,
      },
    };
  }

  const totalSuperbadges =
    superbadgesData?.earnedAwards?.edges?.filter((edge) => edge.node.award && edge.node.award.icon).length || 0;

  let superbadgeLogos =
    superbadgesData?.earnedAwards?.edges
      ?.filter((edge) => edge.node.award && edge.node.award.icon)
      .map((edge) => edge.node.award.icon) || [];

  if (options.displayLastXSuperbadges && options.lastXSuperbadges) {
    superbadgeLogos = superbadgeLogos.slice(-options.lastXSuperbadges);
  }

  const displayedSuperbadges = superbadgeLogos.length;
  const hiddenSuperbadges = totalSuperbadges - displayedSuperbadges;

  // Download all superbadge logos in parallel
  const superbadgeLogoPromises = superbadgeLogos.map(async (logoUrl) => {
    try {
      const logoResult = await getImage(logoUrl, 'superbadges');
      const logoBuffer = logoResult.buffer || logoResult;
      const logo = await loadImage(logoBuffer);
      return logo;
    } catch (error) {
      console.error(`Error loading superbadge logo from URL: ${logoUrl}`, error);
      warnings.push(`Error loading superbadge logo from URL: ${logoUrl}: ${error.message}`);
      return null;
    }
  });

  // Wait for all superbadge logos to be downloaded
  const superbadgesDownloadStart = Date.now();
  const superbadgeLogosImages = await Promise.all(superbadgeLogoPromises);
  const downloadMs = Date.now() - superbadgesDownloadStart;

  // Add "+X" badge if superbadges are hidden
  if (hiddenSuperbadges > 0) {
    const plusXBadgeSvg = generatePlusXSuperbadgesSvg(hiddenSuperbadges);
    const plusXBadgeImage = await loadImage(
      `data:image/svg+xml;base64,${Buffer.from(plusXBadgeSvg).toString('base64')}`
    );
    superbadgeLogosImages.push(plusXBadgeImage);
  }

  // Filter out null images (failed loads)
  const validImages = superbadgeLogosImages.filter((img) => img !== null);

  if (validImages.length === 0) {
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
      timings: {
        download_ms: downloadMs,
        prep_ms: Date.now() - startTime - downloadMs,
      },
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

  const prepMs = Date.now() - startTime - downloadMs;

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
    timings: {
      download_ms: downloadMs,
      prep_ms: prepMs,
      count: displayedSuperbadges,
    },
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
  const renderStart = Date.now();

  if (!prepared.shouldRender || !prepared.images || prepared.images.length === 0) {
    console.debug('No superbadges to render');
    return {
      render_ms: 0,
    };
  }

  const { images, layout } = prepared;
  let currentX = absoluteX + layout.startX;

  // Render badges with spacing (can be negative for overlapping effect)
  for (const logo of images) {
    if (logo) {
      ctx.drawImage(logo, currentX, y, layout.logoWidth, layout.logoHeight);
      currentX += layout.logoWidth + layout.spacing;
    }
  }

  return {
    render_ms: Date.now() - renderStart,
  };
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
 * Get timings from superbadge preparation/rendering
 * @param {Object} prepared - Prepared superbadge data
 * @returns {Object} Timings
 */
function getSuperbadgesTimings(prepared) {
  return prepared?.timings || {};
}

/**
 * Get superbadge counts
 * @param {Object} prepared - Prepared superbadge data
 * @returns {Object} Counts
 */
function getSuperbadgesCounts(prepared) {
  return prepared?.counts || { total: 0, displayed: 0, hidden: 0 };
}

export { prepareSuperbadges, renderSuperbadges, getSuperbadgesWarnings, getSuperbadgesTimings, getSuperbadgesCounts };
