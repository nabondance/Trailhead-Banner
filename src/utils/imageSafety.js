/**
 * Image header inspection, so untrusted images can be checked before they are
 * decoded. A small, highly compressed PNG can declare 20000×20000 pixels and
 * need over 1.5 GB once decoded — reading the header first avoids that.
 */

export const MAX_IMAGE_DIMENSION = 4096;
export const MAX_IMAGE_PIXELS = 16 * 1024 * 1024;

/**
 * Parse a CSS-like length from an SVG attribute (px or unitless only).
 * @param {string|undefined} value
 * @returns {number|null}
 */
function parseSvgLength(value) {
  if (!value) return null;
  const match = value.trim().match(/^([\d.]+)(px)?$/);
  return match ? Number(match[1]) : null;
}

function getSvgInfo(buffer) {
  const text = buffer.subarray(0, 4096).toString('utf8');
  const tag = text.match(/<svg\b[^>]*>/i)?.[0];
  if (!tag) return null;
  const attr = (name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];
  let width = parseSvgLength(attr('width'));
  let height = parseSvgLength(attr('height'));
  const viewBox = attr('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if ((width === null || height === null) && viewBox?.length === 4) {
    width = width ?? viewBox[2];
    height = height ?? viewBox[3];
  }
  // No usable size: the canvas rasterizes it at its small default size
  return { format: 'svg', width: width ?? 0, height: height ?? 0 };
}

function getJpegInfo(buffer) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    // SOF0-SOF15, excluding DHT (C4), JPG (C8) and DAC (CC)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { format: 'jpeg', height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  return null;
}

function getWebpInfo(buffer) {
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return { format: 'webp', width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  }
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return { format: 'webp', width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  if (chunk === 'VP8 ') {
    return { format: 'webp', width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

/**
 * Identify an image's format and declared size from its header bytes.
 * @param {Buffer} buffer
 * @returns {{format: string, width: number, height: number}|null} null when not a supported image
 */
export function getImageInfo(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return null;
  try {
    if (buffer.readUInt32BE(0) === 0x89504e47) {
      return { format: 'png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8) return getJpegInfo(buffer);
    if (buffer.toString('ascii', 0, 3) === 'GIF') {
      return { format: 'gif', width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    }
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
      return getWebpInfo(buffer);
    }
    // AVIF (CDNs serve it for Accept: image/avif). Size lives deep in the box
    // tree; the byte cap on downloads bounds it instead.
    if (buffer.toString('ascii', 4, 8) === 'ftyp' && ['avif', 'avis'].includes(buffer.toString('ascii', 8, 12))) {
      return { format: 'avif', width: 0, height: 0 };
    }
    if (
      /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg\b/i.test(
        buffer.subarray(0, 1024).toString('utf8')
      )
    ) {
      return getSvgInfo(buffer);
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Check that a buffer is a supported image within the size limits.
 * @param {Buffer} buffer
 * @param {Object} [limits]
 * @param {number} [limits.maxDimension=MAX_IMAGE_DIMENSION]
 * @param {number} [limits.maxPixels=MAX_IMAGE_PIXELS]
 * @returns {{valid: boolean, error?: string, info?: Object}}
 */
export function validateImageBuffer(buffer, { maxDimension = MAX_IMAGE_DIMENSION, maxPixels = MAX_IMAGE_PIXELS } = {}) {
  const info = getImageInfo(buffer);
  if (!info) return { valid: false, error: 'Unsupported or invalid image format' };
  const { width, height } = info;
  if (width > maxDimension || height > maxDimension || width * height > maxPixels) {
    return {
      valid: false,
      error: `Image is too large (${width}×${height}); max ${maxDimension}×${maxDimension}`,
    };
  }
  return { valid: true, info };
}
