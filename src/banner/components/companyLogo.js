import { loadImage } from '@napi-rs/canvas';
import { getImage } from '../../utils/cacheUtils.js';
import { Timer } from '../../utils/timerUtils.js';

/**
 * Company Logo Component
 * Renders an optional company logo in the rank logo slot (top-left area).
 * Accepts a URL or base64 data URL. Auto-resizes to fit the available slot.
 */

/**
 * Validate that a URL is a safe external image URL (SSRF protection).
 * @param {string} url
 * @returns {boolean}
 */
function isValidExternalUrl(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    const hostname = parsed.hostname.toLowerCase();
    const blocked = [
      'localhost',
      '127.',
      '10.',
      '169.254.',
      '::1',
      'fe80:',
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
    ];
    return !blocked.some((range) => hostname.startsWith(range));
  } catch {
    return false;
  }
}

/**
 * Prepare company logo for rendering.
 * @param {Object} options - Component options
 * @param {string|null} options.companyLogoUrl - Logo URL or base64 data URL
 * @param {number} canvasHeight - Canvas height for slot size calculation
 * @param {number} slotWidth - Available width for the logo slot
 * @returns {Promise<Object>} Prepared logo data
 */
async function prepareCompanyLogo(options = {}, slotHeight, slotWidth) {
  const timer = new Timer();
  const warnings = [];

  const logoInput = options.companyLogoUrl;

  if (!logoInput) {
    return { shouldRender: false, image: null, width: 0, height: 0, warnings, timings: timer.get() };
  }

  timer.start('load');
  try {
    let image;
    const isBase64 = logoInput.startsWith('data:');

    if (isBase64) {
      image = await loadImage(logoInput);
    } else {
      if (!isValidExternalUrl(logoInput)) {
        warnings.push('Company logo URL is invalid or points to a private/internal address.');
        return { shouldRender: false, image: null, width: 0, height: 0, warnings, timings: timer.end('load').get() };
      }
      const result = await getImage(logoInput, 'company-logos');
      const buffer = result.buffer || result;
      image = await loadImage(buffer);
    }

    // Scale to fill slot (with 2% padding) while maintaining aspect ratio
    const maxWidth = slotWidth * 0.9;
    const maxHeight = slotHeight * 0.9;
    const imageAspect = image.width / image.height;
    let drawWidth = maxHeight * imageAspect;
    let drawHeight = maxHeight;

    if (drawWidth > maxWidth) {
      drawWidth = maxWidth;
      drawHeight = maxWidth / imageAspect;
    }

    return {
      shouldRender: true,
      image,
      width: drawWidth,
      height: drawHeight,
      slotWidth,
      slotHeight,
      warnings,
      timings: timer.end('load').get(),
    };
  } catch (error) {
    console.error('Error loading company logo:', error);
    warnings.push(`Error loading company logo: ${error.message}`);
    return { shouldRender: false, image: null, width: 0, height: 0, warnings, timings: timer.end('load').get() };
  }
}

/**
 * Render company logo to canvas, centered within the logo slot.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} prepared - From prepareCompanyLogo()
 * @param {number} x - Slot start X
 * @param {number} y - Slot start Y
 */
async function renderCompanyLogo(ctx, prepared, x = 0, y = 0) {
  if (!prepared.shouldRender || !prepared.image) {
    console.debug('Skipping company logo render');
    return;
  }

  // Center horizontally and vertically within the slot
  const offsetX = x + (prepared.slotWidth - prepared.width) / 2;
  const offsetY = y + (prepared.slotHeight - prepared.height) / 2;

  ctx.drawImage(prepared.image, offsetX, offsetY, prepared.width, prepared.height);
}

/**
 * Get warnings from company logo preparation.
 * @param {Object} prepared
 * @returns {Array<string>}
 */
function getCompanyLogoWarnings(prepared) {
  return prepared?.warnings || [];
}

/**
 * Get the effective slot width used by the logo (0 if not rendered).
 * For layout: returns the full slot width if a logo is shown, 0 if not.
 * @param {Object} prepared
 * @returns {number}
 */
function getCompanyLogoSlotWidth(prepared) {
  return prepared?.shouldRender ? (prepared.slotWidth ?? 0) : 0;
}

export { prepareCompanyLogo, renderCompanyLogo, getCompanyLogoWarnings, getCompanyLogoSlotWidth };
