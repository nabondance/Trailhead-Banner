import { loadImage } from '@napi-rs/canvas';
import path from 'path';
import fs from 'fs';
import { drawProceduralBannerBackground } from '../../utils/drawUtils.js';
import { getImage } from '../../utils/cacheUtils.js';
import {
  decodeImageDataUrl,
  validateImageBuffer,
  MAX_PHOTO_DIMENSION,
  MAX_PHOTO_PIXELS,
} from '../../utils/imageSafety.js';
import { Timer } from '../../utils/timerUtils.js';
import { getLibraryFocusY } from '../../utils/libraryBackgrounds.js';
import { drawImageWithFit } from '../bannerSizes.js';

/**
 * Background Component
 * Handles 5 background types: library, customUrl, upload, monochromatic, procedural
 */

// Uploads arrive as base64 data URLs inside the JSON body (capped by the
// platform at 4.5 MB); the decoded image gets the same limits as downloads
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Decode and check an uploaded background.
 * @param {unknown} dataUrl
 * @returns {Buffer} validated image bytes
 */
function decodeUploadedImage(dataUrl) {
  const buffer = decodeImageDataUrl(dataUrl, MAX_UPLOAD_BYTES);
  const validation = validateImageBuffer(buffer, {
    maxDimension: MAX_PHOTO_DIMENSION,
    maxPixels: MAX_PHOTO_PIXELS,
  });
  if (!validation.valid) throw new Error(validation.error);
  return buffer;
}

/**
 * Prepare background for rendering
 * @param {Object} options - Background options
 * @param {string} options.backgroundKind - Type: library|customUrl|upload|monochromatic|procedural
 * @param {string} options.backgroundLibraryUrl - URL for library background
 * @param {string} options.backgroundImageUrl - URL for custom/upload background
 * @param {string} options.backgroundColor - Color for monochromatic background
 * @param {string} options.username - Username for procedural background seeding
 * @param {Object} options.rankData - Rank data for procedural background color
 * @returns {Promise<Object>} Prepared background data
 */
async function prepareBackground(options) {
  const timer = new Timer();
  timer.start('load');
  const warnings = [];
  let backgroundData = null;

  try {
    switch (options.backgroundKind) {
      case 'library':
        if (options.backgroundLibraryUrl) {
          const filename = options.backgroundLibraryUrl.split('/').pop();
          const filePath = path.join(process.cwd(), 'public', 'assets', 'background-library', filename);
          const bgImageBuffer = await fs.promises.readFile(filePath);
          const bgImage = await loadImage(bgImageBuffer);
          backgroundData = { type: 'image', image: bgImage, focusY: getLibraryFocusY(filename) };
        }
        break;

      case 'customUrl':
      case 'upload':
        if (options.backgroundImageUrl) {
          let bgImage;

          if (options.backgroundKind === 'upload') {
            bgImage = await loadImage(decodeUploadedImage(options.backgroundImageUrl));
          } else {
            // getImage fetches through the SSRF-safe client and validates the image
            const bgImageResult = await getImage(String(options.backgroundImageUrl), 'background');
            bgImage = await loadImage(bgImageResult.buffer || bgImageResult);
          }

          backgroundData = { type: 'image', image: bgImage };
        }
        break;

      case 'monochromatic':
        backgroundData = {
          type: 'color',
          color: options.backgroundColor || '#000000',
        };
        break;

      case 'procedural':
        backgroundData = {
          type: 'procedural',
          username: options.username || 'default',
          rank: options.rankData?.rank?.title || 'Scout',
        };
        break;

      default:
        // Default to monochromatic
        backgroundData = {
          type: 'color',
          color: options.backgroundColor || '#000000',
        };
        break;
    }
  } catch (error) {
    console.error('Error loading background:', error);
    // Generic text: raw errors can reveal server paths or network details.
    // The banner still renders, on a black background.
    warnings.push('Could not load the background image, a black background was used instead.');
    backgroundData = {
      type: 'color',
      color: '#000000',
    };
  }

  return {
    data: backgroundData,
    warnings,
    timings: timer.end('load').get(),
  };
}

/**
 * Render background to canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} prepared - Prepared background data from prepareBackground()
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @param {Object} [options]
 * @param {'stretch'|'cover'} [options.fit='stretch'] - 'cover' keeps the image aspect ratio and crops the overflow
 *   (horizontally centered; vertically at the background's focusY, default center)
 */
async function renderBackground(ctx, prepared, canvasWidth, canvasHeight, options = {}) {
  const { fit = 'stretch' } = options;
  const { data } = prepared;

  if (!data) {
    console.debug('No background data to render');
    return;
  }

  switch (data.type) {
    case 'image':
      if (data.image) {
        const { width: imgWidth = 0, height: imgHeight = 0 } = data.image;
        drawImageWithFit(ctx, data.image, imgWidth, imgHeight, canvasWidth, canvasHeight, fit, data.focusY);
      }
      break;

    case 'color':
      ctx.fillStyle = data.color;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      break;

    case 'procedural':
      drawProceduralBannerBackground(ctx, canvasWidth, canvasHeight, data.username, data.rank);
      break;

    default:
      console.warn('Unknown background type:', data.type);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      break;
  }
}

/**
 * Get warnings from background preparation
 * @param {Object} prepared - Prepared background data
 * @returns {Array<string>} Warnings
 */
function getBackgroundWarnings(prepared) {
  return prepared?.warnings || [];
}

export { prepareBackground, renderBackground, getBackgroundWarnings };
