/**
 * Image header inspection, so untrusted images can be checked before they are
 * decoded. A small, highly compressed PNG can declare 20000×20000 pixels and
 * need over 1.5 GB once decoded — reading the header first avoids that.
 */

export const MAX_IMAGE_DIMENSION = 4096;
export const MAX_IMAGE_PIXELS = 16 * 1024 * 1024;

// Photos used as backgrounds (downloaded or uploaded) can be large
export const MAX_PHOTO_DIMENSION = 12000;
export const MAX_PHOTO_PIXELS = 60 * 1000 * 1000;

const IMAGE_DATA_URL = /^data:image\/[a-z0-9.+-]+;base64,/i;

/**
 * Decode a base64 image data URL (uploads). Only data URLs are accepted:
 * loadImage() given any other string would fetch http(s) URLs without SSRF
 * checks or read local files. The format itself is checked later, from the
 * bytes, by validateImageBuffer.
 * @param {unknown} dataUrl
 * @param {number} maxBytes - decoded size limit
 * @returns {Buffer}
 */
export function decodeImageDataUrl(dataUrl, maxBytes) {
  const match = typeof dataUrl === 'string' ? dataUrl.match(IMAGE_DATA_URL) : null;
  if (!match) throw new Error('Unsupported image format');
  // base64 is ~4/3 the decoded size: reject before decoding a huge string
  if ((dataUrl.length - match[0].length) * 0.75 > maxBytes) {
    throw new Error(`Image file is too large (max ${Math.round(maxBytes / (1024 * 1024))} MB)`);
  }
  return Buffer.from(dataUrl.slice(match[0].length), 'base64');
}

// CSS units in px; em/ex assume the default 16px font size
const SVG_UNIT_PX = { '': 1, px: 1, pt: 4 / 3, pc: 16, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, em: 16, ex: 8 };

/**
 * Parse an SVG width/height attribute into px. The rasterizer understands
 * exponents ("1e4") and units ("20000mm"), so a size this parser can't read
 * must be refused, not treated as "no size".
 * @param {string|undefined} value
 * @returns {number|null|undefined} px; null when absent or relative (%); undefined when unreadable
 */
function parseSvgLength(value) {
  if (value === undefined || value.trim() === '') return null;
  const match = value.trim().match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z%]*)$/i);
  if (!match) return undefined;
  const unit = match[2].toLowerCase();
  if (unit === '%') return null; // relative to the viewport: falls back to the viewBox
  const number = Number(match[1]);
  if (!(unit in SVG_UNIT_PX) || !Number.isFinite(number) || number < 0) return undefined;
  return number * SVG_UNIT_PX[unit];
}

// XML declaration, comments and a simple DOCTYPE may come before the root
const SVG_ROOT_PREFIX = /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>[]*>\s*)?<svg\b/i;
const SVG_ATTRIBUTE = /\s+([^\s=/>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;

/**
 * Read the root <svg> tag's attributes, honouring quotes (a quoted value may
 * contain ">" or text that looks like another attribute).
 * @param {string} text
 * @returns {Object<string, string>|null} lower-cased names; null when the tag can't be read safely
 */
function readSvgRootAttributes(text) {
  const prefix = text.match(SVG_ROOT_PREFIX);
  if (!prefix) return null;
  const attributes = {};
  let position = prefix[0].length;
  for (;;) {
    SVG_ATTRIBUTE.lastIndex = position;
    const match = SVG_ATTRIBUTE.exec(text);
    if (!match) break;
    const name = match[1].toLowerCase();
    if (name in attributes) return null; // duplicates: ambiguous, refuse
    attributes[name] = match[2] ?? match[3];
    position = SVG_ATTRIBUTE.lastIndex;
  }
  // Anything but the end of the tag here means we didn't understand it
  return /^\s*\/?>/.test(text.slice(position)) ? attributes : null;
}

/**
 * width/height declared in a style attribute, which override the attributes.
 * @returns {{width?: string, height?: string}|null} null when the style can't be read safely
 */
function readSvgStyleSize(style) {
  if (!style) return {};
  if (/[\\]|\/\*/.test(style)) return null; // CSS escapes or comments
  const size = {};
  for (const declaration of style.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    if (property === 'width' || property === 'height') {
      size[property] = declaration
        .slice(colon + 1)
        .replace(/!important/i, '')
        .trim();
    }
  }
  return size;
}

/**
 * Size the rasterizer will use for an SVG, estimated on the high side.
 * Anything that can't be read is refused rather than counted as "no size".
 */
function getSvgInfo(buffer) {
  const attributes = readSvgRootAttributes(buffer.subarray(0, 4096).toString('utf8'));
  if (!attributes) return null;
  const styleSize = readSvgStyleSize(attributes.style);
  if (!styleSize) return null;
  let width = parseSvgLength(styleSize.width ?? attributes.width);
  let height = parseSvgLength(styleSize.height ?? attributes.height);
  if (width === undefined || height === undefined) return null;

  if (attributes.viewbox !== undefined) {
    const viewBox = attributes.viewbox
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (viewBox.length !== 4 || viewBox.some((n) => !Number.isFinite(n))) return null;
    const viewWidth = Math.abs(viewBox[2]);
    const viewHeight = Math.abs(viewBox[3]);
    // A missing side comes from the viewBox, either as-is or scaled by its
    // aspect ratio depending on the renderer: take the larger
    const scaledWidth = height !== null && viewHeight > 0 ? (height * viewWidth) / viewHeight : 0;
    const scaledHeight = width !== null && viewWidth > 0 ? (width * viewHeight) / viewWidth : 0;
    width = width ?? Math.max(viewWidth, scaledWidth);
    height = height ?? Math.max(viewHeight, scaledHeight);
  }
  // No usable size: the canvas rasterizes it at its small default size
  return { format: 'svg', width: width ?? 0, height: height ?? 0 };
}

/**
 * AVIF/HEIF store the size in "ispe" boxes (one per image item, including the
 * full-size grid). Take the largest; refuse files without one.
 */
function getAvifInfo(buffer) {
  let width = 0;
  let height = 0;
  let found = false;
  for (let index = buffer.indexOf('ispe'); index !== -1; index = buffer.indexOf('ispe', index + 4)) {
    if (index + 16 > buffer.length) break;
    found = true;
    width = Math.max(width, buffer.readUInt32BE(index + 8));
    height = Math.max(height, buffer.readUInt32BE(index + 12));
  }
  return found ? { format: 'avif', width, height } : null;
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
    // AVIF (CDNs serve it for Accept: image/avif)
    if (buffer.toString('ascii', 4, 8) === 'ftyp' && ['avif', 'avis'].includes(buffer.toString('ascii', 8, 12))) {
      return getAvifInfo(buffer);
    }
    if (SVG_ROOT_PREFIX.test(buffer.subarray(0, 4096).toString('utf8'))) {
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
      error: `Image is too large (${Math.round(width)}×${Math.round(height)}); max ${maxDimension}×${maxDimension}`,
    };
  }
  return { valid: true, info };
}
