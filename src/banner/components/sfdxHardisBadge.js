import { loadImage } from '@napi-rs/canvas';
import { getImage } from '../../utils/cacheUtils.js';
import { getHighestSfdxHardisBadge } from '../../utils/sfdxHardisBadgeUtils.js';
import { Timer } from '../../utils/timerUtils.js';

function emptyResult(timer, warnings = []) {
  return {
    shouldRender: false,
    image: null,
    width: 0,
    height: 0,
    badge: null,
    warnings,
    timings: timer.get(),
  };
}

/**
 * Load the highest verified sfdx-hardis training badge for the top banner band.
 */
async function prepareSfdxHardisBadge(badgesData, options = {}, layout = {}) {
  const timer = new Timer();
  const warnings = [];

  if (options.displaySfdxHardisBadge === false) return emptyResult(timer, warnings);

  const badge = getHighestSfdxHardisBadge(badgesData);
  if (!badge) return emptyResult(timer, warnings);

  timer.start('load');
  try {
    const imageResult = await getImage(badge.image, 'sfdx_hardis_badges');
    const image = await loadImage(Buffer.from(imageResult.buffer || imageResult));
    const height = layout.logoHeight || 90;
    const width = (image.width / image.height) * height;

    return {
      shouldRender: true,
      image,
      width,
      height,
      badge,
      warnings,
      timings: timer.end('load').get(),
    };
  } catch (error) {
    console.error('Error loading sfdx-hardis training badge:', error);
    warnings.push(`Error loading sfdx-hardis training badge: ${error.message}`);
    return emptyResult(timer.end('load'), warnings);
  }
}

async function renderSfdxHardisBadge(ctx, prepared, x, y) {
  if (!prepared.shouldRender || !prepared.image) return;
  ctx.drawImage(prepared.image, x, y, prepared.width, prepared.height);
}

function getSfdxHardisBadgeWarnings(prepared) {
  return prepared?.warnings || [];
}

function getSfdxHardisBadgeDimensions(prepared) {
  return {
    width: prepared?.width || 0,
    height: prepared?.height || 0,
  };
}

export { prepareSfdxHardisBadge, renderSfdxHardisBadge, getSfdxHardisBadgeWarnings, getSfdxHardisBadgeDimensions };
