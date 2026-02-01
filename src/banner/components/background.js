import { loadImage } from '@napi-rs/canvas';
import path from 'path';
import fs from 'fs';
import { drawProceduralBannerBackground } from '../../utils/drawUtils.js';
import { getImage } from '../../utils/cacheUtils.js';

/**
 * Background Component
 * Handles 5 background types: library, customUrl, upload, monochromatic, procedural
 */

/**
 * Validate if URL points to a valid image
 * @param {string} url - URL to validate
 * @returns {Promise<boolean>} True if valid image URL
 */
async function isValidImageType(url) {
  try {
    // Validate URL protocol (only allow http/https)
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      console.error('Invalid protocol:', parsedUrl.protocol);
      return false;
    }

    // Check for localhost and private IP ranges to prevent SSRF
    const hostname = parsedUrl.hostname.toLowerCase();
    const privateRanges = [
      'localhost',
      '127.',
      '10.',
      '172.16.',
      '172.17.',
      '172.18.',
      '172.19.',
      '172.20.',
      '172.21.',
      '172.22.',
      '172.23.',
      '172.24.',
      '172.25.',
      '172.26.',
      '172.27.',
      '172.28.',
      '172.29.',
      '172.30.',
      '172.31.',
      '192.168.',
      '169.254.', // Link-local
      '[::1]', // IPv6 localhost
      'fe80:', // IPv6 link-local
    ];

    if (privateRanges.some((range) => hostname.startsWith(range))) {
      console.error('Private/internal address blocked:', hostname);
      return false;
    }

    // Use AbortController with timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('Non-OK response:', response.status);
        return false;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.startsWith('image/')) {
        return true;
      }

      // Fallback to checking URL patterns if content-type is not reliable
      const urlWithoutParams = url.split('?')[0];
      const extension = path.extname(urlWithoutParams).toLowerCase();

      if (extension) {
        switch (extension) {
          case '.jpg':
          case '.jpeg':
          case '.png':
          case '.webp':
          case '.gif':
            return true;
          default:
            break;
        }
      }

      // Check common image patterns in URL
      const imagePatterns = [
        '/image/',
        'profile-displaybackgroundimage',
        '/img/',
        '/photo/',
        'media.licdn.com',
      ];

      return imagePatterns.some((pattern) => url.toLowerCase().includes(pattern));
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('Request timeout for URL:', url);
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Error validating image URL:', error);
    return false;
  }
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
  const startTime = Date.now();
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
          backgroundData = { type: 'image', image: bgImage };
        }
        break;

      case 'customUrl':
      case 'upload':
        if (options.backgroundImageUrl) {
          // For upload, backgroundImageUrl is a data URL (already validated)
          // For custom URLs, validate first
          if (options.backgroundKind === 'customUrl' && !(await isValidImageType(options.backgroundImageUrl))) {
            throw new Error('Unsupported image type');
          }

          const bgImageResult = await getImage(options.backgroundImageUrl, 'background');
          const bgImageBuffer = bgImageResult.buffer || bgImageResult;
          const bgImage = await loadImage(bgImageBuffer);
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
    warnings.push(`Error loading background: ${error.message}`);

    // Fallback to black background
    backgroundData = {
      type: 'color',
      color: '#000000',
    };

    // Re-throw for certain error types
    if (error.message === 'Unsupported image type') {
      throw error;
    }
  }

  return {
    data: backgroundData,
    warnings,
    timings: {
      load_ms: Date.now() - startTime,
    },
  };
}

/**
 * Render background to canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} prepared - Prepared background data from prepareBackground()
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 */
async function renderBackground(ctx, prepared, canvasWidth, canvasHeight) {
  const { data } = prepared;

  if (!data) {
    console.debug('No background data to render');
    return;
  }

  switch (data.type) {
    case 'image':
      if (data.image) {
        ctx.drawImage(data.image, 0, 0, canvasWidth, canvasHeight);
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

/**
 * Get timings from background preparation
 * @param {Object} prepared - Prepared background data
 * @returns {Object} Timings
 */
function getBackgroundTimings(prepared) {
  return prepared?.timings || {};
}

export {
  prepareBackground,
  renderBackground,
  getBackgroundWarnings,
  getBackgroundTimings,
};
