import { loadImage } from '@napi-rs/canvas';
import { getImage } from '../../utils/cacheUtils.js';
import { uploadImage } from '../../utils/blobUtils.js';
import { selectStampsToDisplay, getStampFileName, whiteKeyStampImage } from '../../utils/stampUtils.js';
import { generatePlusXStampsImage } from '../../utils/drawUtils.js';
import { Timer } from '../../utils/timerUtils.js';

/**
 * Stamps Component
 * Renders program stamps (FDE / Implementation Ready / Event) in a horizontal row.
 * FDE icons ship as JPEGs with a white background — they are white-keyed to
 * transparency once, then cached in the 'stamps_keyed' Blob folder.
 */

const STAMP_SPACING = 10;

/**
 * Load a stamp icon: keyed Blob cache first, else original (Blob-cached) with
 * white-keying applied to JPEGs, uploading the processed result for next time.
 */
async function loadStampImage(stamp) {
  try {
    const keyedResult = await getImage(stamp.iconUrl, 'stamps_keyed');
    return { image: await loadImage(Buffer.from(keyedResult.buffer || keyedResult)), keyedCacheHit: true };
  } catch (error) {
    console.debug(`Keyed cache miss for stamp ${stamp.apiName}, processing now...`);
  }

  const originalResult = await getImage(stamp.iconUrl, 'stamps');
  const originalBuffer = Buffer.from(originalResult.buffer || originalResult);
  const rawImage = await loadImage(originalBuffer);

  const isJpeg = originalBuffer[0] === 0xff && originalBuffer[1] === 0xd8;
  const image = isJpeg ? whiteKeyStampImage(rawImage) : rawImage;

  // Cache the processed version so future generations hit stamps_keyed directly (non-blocking)
  try {
    const keyedBuffer = isJpeg ? image.toBuffer('image/png') : originalBuffer;
    uploadImage(keyedBuffer, getStampFileName(stamp.iconUrl), 'stamps_keyed').catch((err) =>
      console.error(`Failed to cache keyed stamp ${stamp.apiName}:`, err)
    );
  } catch (cacheError) {
    console.error(`Error caching keyed stamp ${stamp.apiName}:`, cacheError);
  }

  return { image, keyedCacheHit: false };
}

/**
 * Prepare stamps for rendering
 * @param {Object} stampsData - Stamps data from API (earnedStamps)
 * @param {Object} options - Component options
 * @param {boolean} options.displayStamps - Whether to display stamps
 * @param {Array<string>} options.stampCategories - Ordered category ids ('fde' | 'ir' | 'event')
 * @param {number} options.maxStampsToDisplay - Cut the priority-ordered list at this count
 * @param {Object} layout - Layout constraints { logoHeight }
 * @returns {Promise<Object>} Prepared stamps data
 */
async function prepareStamps(stampsData, options = {}, layout = {}) {
  const timer = new Timer();
  const warnings = [];

  const emptyResult = {
    shouldRender: false,
    images: [],
    logoHeight: 0,
    naturalWidth: 0,
    counts: { total: 0, displayed: 0, hidden: 0 },
    warnings,
    timings: timer.get(),
  };

  if (!options.displayStamps || !stampsData?.edges?.length) {
    return emptyResult;
  }

  const { selected, total, displayed, hidden } = selectStampsToDisplay(stampsData.edges, options);
  if (selected.length === 0) {
    return emptyResult;
  }

  const logoHeight = layout.logoHeight || 90;

  timer.start('total');
  timer.start('download');
  const imageResults = await Promise.all(
    selected.map(async (stamp) => {
      if (!stamp.iconUrl) return null;
      try {
        const { image } = await loadStampImage(stamp);
        return {
          image,
          width: (image.width / image.height) * logoHeight,
          name: stamp.name,
        };
      } catch (error) {
        console.error(`Error loading stamp icon for ${stamp.name}:`, error);
        warnings.push(`Error loading stamp icon for ${stamp.name}: ${error.message}`);
        return null;
      }
    })
  );
  timer.end('download');

  const images = imageResults.filter(Boolean);

  // Add "+X" badge if stamps were cut by maxStampsToDisplay.
  // Wrapped so a missing/corrupt stamp asset degrades to "no badge" instead of
  // failing the whole banner (prepareStamps runs inside a Promise.all).
  if (hidden > 0 && images.length > 0) {
    try {
      const plusXImage = await generatePlusXStampsImage(hidden);
      images.push({
        image: plusXImage,
        width: (plusXImage.width / plusXImage.height) * logoHeight,
        name: `+${hidden} stamps`,
      });
    } catch (error) {
      console.error(`Error generating +${hidden} stamp badge:`, error);
      warnings.push(`Error generating +${hidden} stamp badge: ${error.message}`);
    }
  }

  if (images.length === 0) {
    timer.end('total');
    return { ...emptyResult, counts: { total, displayed, hidden }, timings: timer.get() };
  }

  const naturalWidth = images.reduce((sum, { width }) => sum + width, 0) + STAMP_SPACING * (images.length - 1);

  timer.end('total');
  timer.set('prep_ms', timer.timings.total_ms - timer.timings.download_ms);

  return {
    shouldRender: true,
    images,
    logoHeight,
    naturalWidth,
    counts: { total, displayed, hidden },
    warnings,
    timings: timer.get(),
  };
}

/**
 * Render stamps to canvas (compresses with negative spacing when exceeding availableWidth,
 * matching superbadge behavior)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} prepared - Prepared stamps data from prepareStamps()
 * @param {number} x - X position of the stamp zone
 * @param {number} y - Y position
 * @param {number} availableWidth - Maximum width the row may occupy
 */
async function renderStamps(ctx, prepared, x, y, availableWidth) {
  const timer = new Timer();
  timer.start('render');

  if (!prepared.shouldRender || prepared.images.length === 0) {
    console.debug('No stamps to render');
    return timer.end('render').get();
  }

  const { images, logoHeight, naturalWidth } = prepared;
  const totalImageWidth = images.reduce((sum, { width }) => sum + width, 0);

  let spacing = STAMP_SPACING;
  if (naturalWidth > availableWidth && images.length > 1) {
    spacing = (availableWidth - totalImageWidth) / (images.length - 1);
  }

  let currentX = x;
  for (const { image, width } of images) {
    const drawWidth = images.length === 1 ? Math.min(width, availableWidth) : width;
    ctx.drawImage(image, currentX, y, drawWidth, logoHeight);
    currentX += drawWidth + spacing;
  }

  return timer.end('render').get();
}

/**
 * Get warnings from stamps preparation
 * @param {Object} prepared - Prepared stamps data
 * @returns {Array<string>} Warnings
 */
function getStampsWarnings(prepared) {
  return prepared?.warnings || [];
}

/**
 * Get stamp counts
 * @param {Object} prepared - Prepared stamps data
 * @returns {Object} Counts
 */
function getStampsCounts(prepared) {
  return prepared?.counts || { total: 0, displayed: 0, hidden: 0 };
}

/**
 * Get performance metrics
 * @param {Object} prepared - Prepared stamps data
 * @returns {Object} Timings
 */
function getStampsTimings(prepared) {
  return prepared?.timings || {};
}

export { prepareStamps, renderStamps, getStampsWarnings, getStampsCounts, getStampsTimings };
