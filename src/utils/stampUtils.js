import { createCanvas } from '@napi-rs/canvas';

/**
 * Stamp classification and selection utilities
 *
 * Stamp categories (parsed from apiName / kind):
 * - fde:   Agentforce FDE Ready levels (apiName: agentforce-fde-level-<N>-<year>)
 * - ir:    Implementation Ready programs (apiName: <product>-ir-<year>)
 * - event: Event attendance stamps (kind: EVENT_IN_PERSON / EVENT_VIRTUAL)
 */

const FDE_REGEX = /^agentforce-fde-level-(\d+)-(\d{4})$/;
const IR_REGEX = /^(.+)-ir-(\d{4})$/;

/**
 * Classify stamp nodes into categories
 * @param {Array} edges - earnedStamps edges from the API
 * @returns {Object} { fde, ir, event } arrays of stamp nodes, each in display order
 */
const classifyStamps = (edges) => {
  const nodes = (edges || []).map((edge) => edge?.node).filter((node) => node?.apiName);

  // FDE: sort by level descending (highest first)
  const fde = nodes
    .filter((node) => FDE_REGEX.test(node.apiName))
    .map((node) => ({ ...node, fdeLevel: parseInt(node.apiName.match(FDE_REGEX)[1]) }))
    .sort((a, b) => b.fdeLevel - a.fdeLevel);

  // IR: keep the latest year per product, sorted alphabetically by product
  const irByProduct = new Map();
  for (const node of nodes) {
    const match = node.apiName.match(IR_REGEX);
    if (!match) continue;
    const [, product, year] = match;
    const existing = irByProduct.get(product);
    if (!existing || parseInt(year) > existing.irYear) {
      irByProduct.set(product, { ...node, irProduct: product, irYear: parseInt(year) });
    }
  }
  const ir = [...irByProduct.values()].sort((a, b) => a.irProduct.localeCompare(b.irProduct));

  // Events: newest first (missing/invalid dates sort last)
  const eventTime = (node) => {
    const t = new Date(node.eventDate).getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  const event = nodes.filter((node) => node.kind?.startsWith('EVENT')).sort((a, b) => eventTime(b) - eventTime(a));

  return { fde, ir, event };
};

/**
 * Select the stamps to display based on user options
 * @param {Array} edges - earnedStamps edges from the API
 * @param {Object} options - User options
 * @param {Array<string>} options.stampCategories - Ordered category ids ('fde' | 'ir' | 'event')
 * @param {number} options.maxStampsToDisplay - Cut the priority-ordered list at this count
 * @returns {Object} { selected, total, displayed, hidden }
 */
const selectStampsToDisplay = (edges, options = {}) => {
  const classified = classifyStamps(edges);
  const categories = Array.isArray(options.stampCategories) ? options.stampCategories : [];

  const ordered = [];
  for (const category of categories) {
    if (category === 'fde' && classified.fde.length > 0) {
      // Highest level only
      ordered.push(classified.fde[0]);
    } else if (category === 'ir') {
      ordered.push(...classified.ir);
    } else if (category === 'event') {
      ordered.push(...classified.event);
    }
  }

  const total = ordered.length;
  const maxStamps = parseInt(options.maxStampsToDisplay) || 0;
  const selected = maxStamps > 0 ? ordered.slice(0, maxStamps) : ordered;

  return {
    selected,
    total,
    displayed: selected.length,
    hidden: total - selected.length,
  };
};

/**
 * Get the highest earned FDE level (0 if none)
 */
const getHighestFdeLevel = (edges) => {
  const { fde } = classifyStamps(edges);
  return fde.length > 0 ? fde[0].fdeLevel : 0;
};

/**
 * Count distinct Implementation Ready products (repeat years are renewals, counted once)
 */
const getImplementationReadyCount = (edges) => classifyStamps(edges).ir.length;

/**
 * Count event stamps
 */
const getEventStampCount = (edges) => classifyStamps(edges).event.length;

/**
 * Derive a stable Blob filename for a stamp icon URL.
 * org62 renditionDownload URLs carry a versionId param that rotates when the
 * artwork changes — ideal cache key. Other hosts (Cloudinary) use the path basename.
 */
const getStampFileName = (imageUrl) => {
  const url = new URL(imageUrl);
  const versionId = url.searchParams.get('versionId');
  const base = versionId || url.pathname.split('/').pop() || 'stamp';
  return `${base.replace(/[^a-zA-Z0-9._-]/g, '_')}.png`;
};

/**
 * Key the white background of a stamp image to transparency.
 * Flood-fills near-white pixels from the image border inward, so near-white
 * pixels inside the artwork are never punched out. Returns a canvas.
 */
const whiteKeyStampImage = (image, threshold = 240) => {
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  const isNearWhite = (idx) =>
    pixels[idx * 4] >= threshold && pixels[idx * 4 + 1] >= threshold && pixels[idx * 4 + 2] >= threshold;

  const visited = new Uint8Array(width * height);
  const stack = [];

  // Seed from all border pixels
  for (let x = 0; x < width; x++) {
    stack.push(x, (height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    stack.push(y * width, y * width + width - 1);
  }

  while (stack.length > 0) {
    const idx = stack.pop();
    if (visited[idx] || !isNearWhite(idx)) continue;
    visited[idx] = 1;
    pixels[idx * 4 + 3] = 0;

    const x = idx % width;
    const y = (idx / width) | 0;
    if (x > 0) stack.push(idx - 1);
    if (x < width - 1) stack.push(idx + 1);
    if (y > 0) stack.push(idx - width);
    if (y < height - 1) stack.push(idx + width);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

export {
  classifyStamps,
  selectStampsToDisplay,
  getHighestFdeLevel,
  getImplementationReadyCount,
  getEventStampCount,
  getStampFileName,
  whiteKeyStampImage,
};
