import { loadImage } from '@napi-rs/canvas';
import { safeFetchBuffer } from '../../utils/urlSafety.js';
import { decodeImageDataUrl, validateImageBuffer } from '../../utils/imageSafety.js';
import { Timer } from '../../utils/timerUtils.js';

/**
 * Company Logo Component
 * Renders an optional company logo in the rank logo slot (top-left area).
 * Accepts a URL or base64 data URL. Auto-resizes to fit the available slot.
 */

// Logos come from the user, so they are fetched fresh (never Blob-cached:
// the cache is keyed by file name, and different companies' "logo.png" would
// collide) and checked before decoding.
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * Load the logo bytes from a data URL or a public http(s) URL.
 * @param {string} logoInput
 * @returns {Promise<Buffer>}
 */
async function loadLogoBuffer(logoInput) {
  if (logoInput.startsWith('data:')) {
    return decodeImageDataUrl(logoInput, MAX_LOGO_BYTES);
  }
  return safeFetchBuffer(logoInput, { maxBytes: MAX_LOGO_BYTES });
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
    const buffer = await loadLogoBuffer(String(logoInput));
    const validation = validateImageBuffer(buffer);
    if (!validation.valid) throw new Error(validation.error);
    const image = await loadImage(buffer);

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
